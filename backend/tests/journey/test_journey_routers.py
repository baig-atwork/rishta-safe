"""Router tests on a local app that sets app.state itself (the real app is composed elsewhere)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from bayan.api.deps import get_principal
from bayan.api.routers import closure, couples, explain, pathway
from bayan.core.clock import FixedClock
from bayan.core.errors import BayanError, Forbidden
from bayan.core.types import Locale, Principal, Role
from bayan.explain.service import build_explain_service
from bayan.journey.models import (
    ClosureAnswers,
    IntakeInput,
    PathwayEvent,
    PathwayEventKind,
    TeachBackSubmission,
)
from bayan.journey.service import build_journey_service

pytestmark = pytest.mark.integration

STAFF_A = Principal(role=Role.CLINICIAN, subject_id="clin-A")
STAFF_B = Principal(role=Role.CLINICIAN, subject_id="clin-B")
COUNSELLOR_A = Principal(role=Role.COUNSELLOR, subject_id="coun-A")
MEMBER_X = Principal(role=Role.COUPLE_MEMBER, subject_id="X-p1", couple_id="X")
MEMBER_Y = Principal(role=Role.COUPLE_MEMBER, subject_id="Y-p1", couple_id="Y")
JUDGE = Principal(role=Role.JUDGE, subject_id="judge-1")
PROGRAMME = Principal(role=Role.PROGRAMME, subject_id="prog-1")
EXTERNAL = Principal(role=Role.EXTERNAL, subject_id="ext-1")


class StubGovernance:
    """Care-team assignment: clin-A and coun-A look after couple X only."""

    def assigned_staff(self, couple_id: str) -> frozenset[str]:
        return frozenset({"clin-A", "coun-A"}) if couple_id == "X" else frozenset({"clin-A"})


def _intake(couple_id: str) -> dict[str, object]:
    return {
        "couple_id": couple_id,
        "members": [
            {
                "person_id": f"{couple_id}-p1",
                "display_name": "Test Person A",
                "sex": "female",
                "age": 28,
            },
            {
                "person_id": f"{couple_id}-p2",
                "display_name": "Test Person B",
                "sex": "male",
                "age": 31,
            },
        ],
    }


@pytest.fixture
def app() -> Iterator[FastAPI]:
    application = FastAPI()

    @application.exception_handler(BayanError)
    async def handler(request: Request, exc: BayanError):  # type: ignore[no-untyped-def]
        from fastapi.responses import JSONResponse

        return JSONResponse({"code": exc.code, "detail": exc.detail}, status_code=exc.status)

    for module in (couples, pathway, closure, explain):
        application.include_router(module.router)
    application.state.journey = build_journey_service(
        FixedClock(datetime(2026, 11, 2, 9, 0, tzinfo=UTC))
    )
    application.state.explain = build_explain_service()
    application.state.governance = StubGovernance()
    application.state.journey.create_case(IntakeInput.model_validate(_intake("X")))
    application.state.journey.create_case(IntakeInput.model_validate(_intake("Y")))
    yield application
    application.dependency_overrides.clear()


def call(app: FastAPI, principal: Principal, method: str, url: str, json: object | None = None):
    app.dependency_overrides[get_principal] = lambda: principal
    return TestClient(app).request(method, url, json=json)


EVENT = {"kind": "consult_completed"}
PROFORMA = {
    "encounter": {
        "mode": "virtual",
        "duration_minutes": 20,
        "session_language": "en",
        "interpreter_used": False,
    },
    "information_given": {},
    "next_step_status": "decided",
    "teach_back_done": False,
    "patient_questions_invited": False,
}


def test_create_and_list_and_get(app: FastAPI) -> None:
    created = call(app, STAFF_A, "POST", "/v1/couples", _intake("Z"))
    assert created.status_code == 201
    assert created.json()["state"] == "registered"
    assert call(app, MEMBER_X, "POST", "/v1/couples", _intake("Q")).status_code == 403
    assert (
        call(app, STAFF_A, "POST", "/v1/couples", {**_intake("W"), "synthetic": False}).status_code
        == 422
    )
    listed = call(app, STAFF_B, "GET", "/v1/couples").json()
    assert listed == []  # clin-B is assigned to nobody
    assert {c["couple_id"] for c in call(app, COUNSELLOR_A, "GET", "/v1/couples").json()} == {"X"}
    assert {c["couple_id"] for c in call(app, JUDGE, "GET", "/v1/couples").json()} == {
        "X",
        "Y",
        "Z",
    }
    assert call(app, MEMBER_X, "GET", "/v1/couples").status_code == 403
    assert call(app, MEMBER_X, "GET", "/v1/couples/X").status_code == 200


def test_pathway_and_events_round_trip(app: FastAPI) -> None:
    body = call(app, STAFF_A, "GET", "/v1/couples/X/pathway?locale=ar").json()
    assert body["state"] == "registered"
    assert body["language_status"] == "draft"
    assert body["simulated"] is True
    after = call(app, STAFF_A, "POST", "/v1/couples/X/pathway/events", EVENT)
    assert after.status_code == 200
    assert after.json()["state"] == "consult_done"
    assert call(app, STAFF_A, "POST", "/v1/couples/X/pathway/events", EVENT).status_code == 409
    assert (
        call(app, STAFF_A, "POST", "/v1/couples/X/pathway/events", {"kind": "nonsense"}).status_code
        == 422
    )
    assert call(app, STAFF_A, "GET", "/v1/couples/X/referrals").json() == []
    kpis = call(app, PROGRAMME, "GET", "/v1/programme/kpis").json()
    assert kpis["n_cases"] == 2
    assert kpis["simulated"] is True
    assert kpis["share_referred"] is None


def test_closure_and_teachback_round_trip(app: FastAPI) -> None:
    schema = call(app, MEMBER_X, "GET", "/v1/closure/schema?locale=ur").json()
    assert len(schema["clinician_fields"]) == 12
    assert schema["marriage_decision_field"] is False
    assert (
        call(app, MEMBER_X, "GET", "/v1/couples/X/teachback").status_code == 409
    )  # before the result
    journey = app.state.journey
    for kind in (
        PathwayEventKind.CONSULT_COMPLETED,
        PathwayEventKind.SAMPLE_COLLECTED,
        PathwayEventKind.LAB_STARTED,
        PathwayEventKind.JOINT_REPORT_READY,
    ):
        journey.advance("X", PathwayEvent(kind=kind), STAFF_A)
    result = {
        "kind": "result_communicated",
        "result": {"category": "shared_result_found", "affected_per_100": 25},
    }
    assert call(app, STAFF_A, "POST", "/v1/couples/X/pathway/events", result).status_code == 200
    quiz = call(app, MEMBER_X, "GET", "/v1/couples/X/teachback?locale=en").json()
    assert len(quiz["items"]) == 5
    graded = call(
        app, MEMBER_X, "POST", "/v1/couples/X/teachback", {"locale": "en", "answers": {"sr1": "a"}}
    ).json()
    assert graded["correct_count"] == 1
    mine = {"person_id": "X-p1", "answers": {"carrier_is_disease": "false", "out_of_100": 25}}
    assert call(app, MEMBER_X, "POST", "/v1/couples/X/closure/patient", mine).status_code == 201
    other = {"person_id": "X-p2", "answers": {}}
    assert call(app, MEMBER_X, "POST", "/v1/couples/X/closure/patient", other).status_code == 403
    assert (
        call(
            app,
            MEMBER_X,
            "POST",
            "/v1/couples/X/closure/patient",
            {**mine, "marriage_decision": "x"},
        ).status_code
        == 422
    )


def test_explain_reference_endpoints_are_public_reference_text(app: FastAPI) -> None:
    client = TestClient(app)
    glossary = client.get("/v1/explain/glossary?locale=ar").json()
    assert len(glossary) >= 25
    assert all(e["language_status"] == "draft" for e in glossary)
    options = client.get("/v1/explain/options?locale=en").json()
    assert options["check"]["ok"] is True
    assert options["language_status"] == "draft"
    assert client.get("/v1/explain/options?locale=xx").status_code == 422


# ------------------------------------------------------------------------------ cross-couple denial
COUPLE_ROUTES = [
    ("GET", "/v1/couples/{c}", None, False),
    ("GET", "/v1/couples/{c}/pathway", None, False),
    ("POST", "/v1/couples/{c}/pathway/events", EVENT, True),
    ("GET", "/v1/couples/{c}/referrals", None, False),
    ("GET", "/v1/couples/{c}/teachback", None, False),
    ("POST", "/v1/couples/{c}/teachback", {"locale": "en", "answers": {}}, True),
    ("POST", "/v1/couples/{c}/closure/patient", {"person_id": "Y-p1", "answers": {}}, True),
    ("POST", "/v1/couples/{c}/closure/clinician", PROFORMA, True),
]


@pytest.mark.parametrize(("method", "url", "body", "write"), COUPLE_ROUTES)
def test_member_of_x_is_denied_on_couple_y(
    app: FastAPI, method: str, url: str, body: object, write: bool
) -> None:
    del write
    response = call(app, MEMBER_X, method, url.format(c="Y"), body)
    assert response.status_code == 403, (method, url)


@pytest.mark.parametrize(("method", "url", "body", "write"), COUPLE_ROUTES)
def test_unassigned_staff_are_denied(
    app: FastAPI, method: str, url: str, body: object, write: bool
) -> None:
    del write
    # clin-B is assigned to nobody; coun-A is assigned to X only.
    assert call(app, STAFF_B, method, url.format(c="X"), body).status_code == 403, (method, url)
    assert call(app, COUNSELLOR_A, method, url.format(c="Y"), body).status_code == 403, (
        method,
        url,
    )


@pytest.mark.parametrize(("method", "url", "body", "write"), COUPLE_ROUTES)
def test_judge_never_writes_and_programme_and_external_never_reach_a_couple(
    app: FastAPI, method: str, url: str, body: object, write: bool
) -> None:
    if write:
        assert call(app, JUDGE, method, url.format(c="X"), body).status_code == 403, (method, url)
    else:
        assert call(app, JUDGE, method, url.format(c="X"), body).status_code in (200, 409)
    for blocked in (PROGRAMME, EXTERNAL):
        assert call(app, blocked, method, url.format(c="X"), body).status_code == 403, (
            blocked.role,
            url,
        )


def test_listing_without_governance_is_refused_fail_closed(app: FastAPI) -> None:
    del app.state.governance
    assert call(app, STAFF_A, "GET", "/v1/couples").status_code == 403


def test_service_refuses_cross_couple_actors_even_if_a_route_forgot_to_check(app: FastAPI) -> None:
    journey = app.state.journey
    with pytest.raises(Forbidden):
        journey.advance("Y", PathwayEvent(kind=PathwayEventKind.COUNSELLING_DECLINED), MEMBER_X)
    with pytest.raises(Forbidden):
        journey.submit_patient_closure("Y", "Y-p1", ClosureAnswers(), MEMBER_X)
    with pytest.raises(Forbidden):
        journey.teachback("Y", actor=MEMBER_X)
    with pytest.raises(Forbidden):
        journey.submit_teachback("Y", TeachBackSubmission(locale=Locale.EN, answers={}), MEMBER_X)
    with pytest.raises(Forbidden):
        journey.submit_patient_closure(
            "X", "X-p2", ClosureAnswers(), MEMBER_X
        )  # another person's items
