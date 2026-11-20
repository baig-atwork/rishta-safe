"""Router tests on a local FastAPI app (the real app does not exist yet): the app sets
`app.state.governance` itself and maps `BayanError` to RFC 9457 problem details the way the
controller's app will."""

# ruff: noqa: PT018
# Compound assertions keep status-code and body checks on one line each.

from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from gov_helpers import (
    COUPLE,
    P1,
    P2,
    STAFF_A,
    STAFF_B,
    T0,
    both_carriers_case,
    make_service,
    member,
    seed_staff,
    staff,
)

from bayan.api.routers import audit, auth, consent, escalation, third_party
from bayan.core.contracts import CoupleResult, PersonReport
from bayan.core.errors import BayanError
from bayan.core.types import Principal, Relationship, Role
from bayan.governance import GovernanceService

PROGRAMME = Principal(role=Role.PROGRAMME, subject_id="synthetic-programme-1")
JUDGE = Principal(role=Role.JUDGE, subject_id="synthetic-judge-1")


class FakeJourney:
    def __init__(self, reports: Sequence[PersonReport]) -> None:
        self._reports = tuple(reports)

    def reports(self, couple_id: str) -> tuple[PersonReport, ...]:
        assert couple_id == COUPLE
        return self._reports


class FakeGenetics:
    def __init__(self, result: CoupleResult) -> None:
        self._result = result

    def compute_couple_result(
        self, couple_id: str, reports: Sequence[PersonReport], relationship: Relationship
    ) -> CoupleResult:
        assert couple_id == COUPLE and len(reports) == 2
        assert isinstance(relationship, Relationship)
        return self._result


def make_app(svc: GovernanceService, *, lanes: bool = True) -> FastAPI:
    app = FastAPI()
    app.state.governance = svc
    if lanes:
        reports, res = both_carriers_case()
        app.state.journey = FakeJourney(reports)
        app.state.genetics = FakeGenetics(res)

    @app.exception_handler(BayanError)
    def problem(_: Request, exc: BayanError) -> JSONResponse:
        return JSONResponse(
            {
                "type": f"urn:bayan:problem:{exc.code}",
                "title": exc.code,
                "status": exc.status,
                "detail": exc.detail,
                **{k: v for k, v in exc.extra.items() if isinstance(v, str)},
            },
            status_code=exc.status,
            media_type="application/problem+json",
        )

    for r in (auth.router, consent.router, audit.router, third_party.router, escalation.router):
        app.include_router(r)
    return app


def bearer(svc: GovernanceService, who: Principal) -> dict[str, str]:
    return {"Authorization": f"Bearer {svc.issue_demo_token(who).access_token}"}


@pytest.fixture
def env() -> tuple[GovernanceService, TestClient]:
    svc, _ = make_service()
    seed_staff(svc)
    return svc, TestClient(make_app(svc))


# ------------------------------------------------------------------ auth -----------------------


@pytest.mark.integration
def test_otp_flow_over_http_and_me(env) -> None:
    svc, client = env
    svc.register_identity("email", "alice@example.test", member(P1))
    ch = client.post(
        "/v1/auth/otp/request", json={"channel": "email", "target": "alice@example.test"}
    ).json()
    assert ch["simulated"] is True and len(ch["demo_code"]) == 6
    bad = client.post(
        "/v1/auth/otp/verify", json={"challenge_id": ch["challenge_id"], "code": "999999"}
    )
    assert bad.status_code == 401 and bad.headers["content-type"].startswith(
        "application/problem+json"
    )
    ok = client.post(
        "/v1/auth/otp/verify", json={"challenge_id": ch["challenge_id"], "code": ch["demo_code"]}
    )
    assert ok.status_code == 200 and ok.json()["simulated"] is True
    me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {ok.json()['access_token']}"})
    assert me.status_code == 200
    assert me.json()["principal"]["subject_id"] == P1 and me.json()["simulated"] is True


@pytest.mark.integration
def test_missing_malformed_and_tampered_tokens_are_401(env) -> None:
    svc, client = env
    assert client.get("/v1/auth/me").status_code == 401
    assert client.get("/v1/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401
    assert (
        client.get("/v1/auth/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    )
    token = svc.issue_demo_token(member(P1)).access_token
    assert (
        client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token[:-3]}abc"}).status_code
        == 401
    )


@pytest.mark.integration
def test_governance_missing_is_501_not_a_crash() -> None:
    app = make_app(make_service()[0])
    del app.state.governance
    resp = TestClient(app).get("/v1/auth/me")
    assert resp.status_code == 501


# ------------------------------------------------------------------ consent --------------------


@pytest.mark.integration
def test_consent_grant_list_revoke_over_http(env) -> None:
    svc, client = env
    alice, bob = bearer(svc, member(P1)), bearer(svc, member(P2))
    body = {"recipient": P2, "scope": "gene_names_only", "purpose": "partner_disclosure"}
    created = client.post(f"/v1/couples/{COUPLE}/consents", json=body, headers=alice)
    assert created.status_code == 201
    rec = created.json()
    assert rec["subject_person_id"] == P1 and rec["basis"] == "explicit_consent"
    listed = client.get(f"/v1/couples/{COUPLE}/consents", headers=bob).json()
    assert [r["consent_id"] for r in listed["records"]] == [rec["consent_id"]]
    assert "not consent-based" in listed["basis_note"]
    assert client.post(f"/v1/consents/{rec['consent_id']}/revoke", headers=bob).status_code == 403
    revoked = client.post(f"/v1/consents/{rec['consent_id']}/revoke", headers=alice)
    assert revoked.status_code == 200 and revoked.json()["revoked_at"] is not None
    assert client.post(f"/v1/consents/{rec['consent_id']}/revoke", headers=alice).status_code == 409
    assert client.post("/v1/consents/consent-99999/revoke", headers=alice).status_code == 404


@pytest.mark.integration
def test_consent_endpoints_enforce_roles_and_validation(env) -> None:
    svc, client = env
    body = {"recipient": P2, "scope": "gene_names_only", "purpose": "partner_disclosure"}
    assert client.post(f"/v1/couples/{COUPLE}/consents", json=body).status_code == 401
    counsellor = bearer(svc, staff())
    assert (
        client.post(f"/v1/couples/{COUPLE}/consents", json=body, headers=counsellor).status_code
        == 403
    )
    other = bearer(svc, member("synthetic-other-1", "other-couple"))
    assert (
        client.post(f"/v1/couples/{COUPLE}/consents", json=body, headers=other).status_code == 403
    )
    alice = bearer(svc, member(P1))
    assert (
        client.post(
            f"/v1/couples/{COUPLE}/consents", json={**body, "scope": "everything"}, headers=alice
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/v1/couples/{COUPLE}/consents", json={**body, "recipient": "programme"}, headers=alice
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/v1/couples/{COUPLE}/consents", json={**body, "extra": 1}, headers=alice
        ).status_code
        == 422
    )
    assert (
        client.get(f"/v1/couples/{COUPLE}/consents", headers=bearer(svc, PROGRAMME)).status_code
        == 403
    )
    denied = [e for e in svc.audit_events() if e.outcome == "denied"]
    assert len(denied) >= 3  # role guards and the programme read were audited


@pytest.mark.integration
def test_right_not_to_know_endpoints(env) -> None:
    svc, client = env
    alice = bearer(svc, member(P1))
    put = client.put(f"/v1/couples/{COUPLE}/right-not-to-know", headers=alice)
    assert put.status_code == 200 and put.json()["active"] is True
    assert svc.right_not_to_know_active(COUPLE, P1)
    assert (
        client.delete(f"/v1/couples/{COUPLE}/right-not-to-know", headers=alice).json()["active"]
        is False
    )
    assert not svc.right_not_to_know_active(COUPLE, P1)
    assert (
        client.put("/v1/couples/other-couple/right-not-to-know", headers=alice).status_code == 403
    )


@pytest.mark.integration
def test_assignment_endpoint_authority(env) -> None:
    svc, client = env
    path = f"/v1/couples/{COUPLE}/assignments"
    body = {"staff_subject_id": STAFF_A}
    assert (
        client.post(
            path, json=body, headers=bearer(svc, staff(Role.COUNSELLOR, STAFF_A))
        ).status_code
        == 403
    )  # self
    assert (
        client.post(path, json=body, headers=bearer(svc, member(P1))).status_code == 403
    )  # role guard
    assert client.post(path, json=body, headers=bearer(svc, JUDGE)).status_code == 403
    assert (
        client.post(
            path, json={"staff_subject_id": "ghost"}, headers=bearer(svc, PROGRAMME)
        ).status_code
        == 422
    )
    assert client.post(path, json=body, headers=bearer(svc, PROGRAMME)).status_code == 204
    assert svc.assigned_staff(COUPLE) == {STAFF_A}
    # An assigned colleague may assign another registered staff member but not themselves.
    a = bearer(svc, staff(Role.COUNSELLOR, STAFF_A))
    assert client.post(path, json=body, headers=a).status_code == 403
    assert client.post(path, json={"staff_subject_id": STAFF_B}, headers=a).status_code == 204


# ------------------------------------------------------------------ audit ----------------------


@pytest.mark.integration
def test_audit_endpoints(env) -> None:
    svc, client = env
    svc.assign_staff(COUPLE, STAFF_A)
    alice = bearer(svc, member(P1))
    client.put(f"/v1/couples/{COUPLE}/right-not-to-know", headers=alice)
    own = client.get(f"/v1/couples/{COUPLE}/audit", headers=alice)
    assert own.status_code == 200
    assert all(P1 in (e["subject_id"], e["actor_id"]) for e in own.json()["events"])
    staff_view = client.get(f"/v1/couples/{COUPLE}/audit", headers=bearer(svc, staff())).json()[
        "events"
    ]
    assert len(staff_view) >= len(own.json()["events"])
    assert (
        client.get(f"/v1/couples/{COUPLE}/audit", headers=bearer(svc, PROGRAMME)).status_code == 403
    )
    assert client.get(f"/v1/couples/{COUPLE}/audit").status_code == 401
    v = client.get("/v1/audit/verify", headers=bearer(svc, PROGRAMME))
    assert v.status_code == 200 and v.json()["ok"] is True
    # a couple member gets the reduced answer: ok and their own couple's event count only
    own = client.get("/v1/audit/verify", headers=alice)
    assert own.status_code == 200
    assert own.json()["scope"] == "own_couple" and own.json()["ok"] is True
    assert own.json()["length"] is None and own.json()["head_hash"] is None
    svc._audit._events[0] = svc._audit._events[0].model_copy(update={"reason": "tampered"})
    broken = client.get("/v1/audit/verify", headers=bearer(svc, JUDGE)).json()
    assert broken["ok"] is False and broken["first_bad_index"] == 0


# ------------------------------------------------------------------ third party / refusals ------


@pytest.mark.integration
def test_third_party_request_is_always_403_logged_and_cites_the_decree_law(env) -> None:
    svc, client = env
    for kind in ("employer", "insurer", "relative"):
        resp = client.post("/v1/third-party-requests", json={"couple_id": COUPLE, "kind": kind})
        assert resp.status_code == 403
        assert resp.headers["content-type"].startswith("application/problem+json")
        problem = resp.json()
        assert problem["status"] == 403 and problem["title"] == "forbidden"
        assert "Decree-Law 49/2023" in problem["detail"]
        assert ("Art. 19 to 21" in problem["detail"]) == (kind != "relative")
    # Even a valid token of a couple member, or garbage, gets the same refusal.
    assert (
        client.post(
            "/v1/third-party-requests",
            json={"couple_id": COUPLE, "kind": "other"},
            headers=bearer(svc, member(P1)),
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/v1/third-party-requests",
            json={"couple_id": COUPLE, "kind": "other"},
            headers={"Authorization": "Bearer garbage"},
        ).status_code
        == 403
    )
    assert (
        sum(
            1
            for e in svc.audit_events()
            if e.action == "third_party_request" and e.outcome == "refused"
        )
        == 5
    )
    assert client.post("/v1/third-party-requests", json={"couple_id": COUPLE}).status_code == 422


@pytest.mark.integration
def test_classify_endpoint_refuses_escalates_only_for_own_couple_and_allows_benign(env) -> None:
    svc, client = env
    svc.assign_staff(COUPLE, STAFF_A)
    alice = bearer(svc, member(P1))
    benign = client.post(
        "/v1/refusals/classify", json={"text": "What does carrier mean?"}, headers=alice
    ).json()
    assert benign["refuse"] is False
    refused = client.post(
        "/v1/refusals/classify",
        json={"text": "هل نفسخ الخطوبة؟", "locale": "en", "couple_id": COUPLE},
        headers=alice,
    ).json()
    assert refused["refuse"] and refused["category"] == "marriage_decision" and refused["escalate"]
    assert refused["message"].startswith(
        "Rishta Safe"
    )  # locale en: English message for an Arabic question
    assert len(svc.escalation_queue(staff())) == 1
    client.post(
        "/v1/refusals/classify",
        json={"text": "should we cancel the wedding", "couple_id": "other-couple"},
        headers=alice,
    )
    assert len(svc.escalation_queue(staff())) == 1  # someone else's couple id is ignored
    assert client.post("/v1/refusals/classify", json={"text": "x"}).status_code == 401


# ------------------------------------------------------------------ escalation -----------------


@pytest.mark.integration
def test_escalation_evaluate_and_queue(env) -> None:
    svc, client = env
    path = f"/v1/couples/{COUPLE}/escalations/evaluate"
    a = bearer(svc, staff(Role.COUNSELLOR, STAFF_A))
    assert client.post(path, json={}, headers=a).status_code == 403  # not assigned
    svc.assign_staff(COUPLE, STAFF_A)
    resp = client.post(
        path, json={"pregnancy_in_progress": True, "free_text": "I can't cope"}, headers=a
    )
    assert resp.status_code == 200
    ids = {d["trigger_id"] for d in resp.json()["decisions"]}
    assert {"shared_result", "pregnancy_in_progress", "user_distress"} <= ids
    assert all(d["needs_clinician_signoff"] is True for d in resp.json()["decisions"])
    assert "sign-off" in resp.json()["notice"]
    queue = client.get("/v1/escalations", headers=a).json()["records"]
    assert len(queue) == 1 and queue[0]["couple_id"] == COUPLE
    assert "can't cope" not in str(queue)
    assert (
        client.get("/v1/escalations", headers=bearer(svc, staff(Role.COUNSELLOR, STAFF_B))).json()[
            "records"
        ]
        == []
    )
    assert len(client.get("/v1/escalations", headers=bearer(svc, JUDGE)).json()["records"]) == 1
    assert client.get("/v1/escalations", headers=bearer(svc, member(P1))).status_code == 403
    assert client.get("/v1/escalations", headers=bearer(svc, PROGRAMME)).status_code == 403
    assert client.post(path, json={"unknown_field": 1}, headers=a).status_code == 422
    assert client.post(path, json={"relationship": "twin"}, headers=a).status_code == 422


@pytest.mark.integration
def test_escalation_evaluate_without_the_other_lanes_is_501_not_a_guess() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A)
    client = TestClient(make_app(svc, lanes=False))
    resp = client.post(
        f"/v1/couples/{COUPLE}/escalations/evaluate", json={}, headers=bearer(svc, staff())
    )
    assert resp.status_code == 501
    assert resp.json()["title"] == "not_configured"


@pytest.mark.integration
def test_expired_token_is_401_over_http() -> None:
    svc, clock = make_service(ttl_minutes=5)
    client = TestClient(make_app(svc))
    headers = bearer(svc, member(P1))
    assert client.get("/v1/auth/me", headers=headers).status_code == 200
    clock.advance(minutes=5)
    assert client.get("/v1/auth/me", headers=headers).status_code == 401
    assert clock.now() == T0 + timedelta(minutes=5)


# ------------------------------------------------------------------ cross-couple scope ---------
# The controller's `assert_couple_access` (via `guard_couple`) on every couple-scoped route.


def _scope_denials(svc: GovernanceService) -> list[str]:
    return [e.action for e in svc.audit_events() if e.reason == "couple_scope_refused"]


@pytest.mark.integration
def test_a_member_of_another_couple_is_denied_on_every_couple_scoped_route(env) -> None:
    svc, client = env
    svc.assign_staff(COUPLE, STAFF_A)
    foreign = bearer(svc, member("synthetic-other-1", "other-couple"))
    alice = bearer(svc, member(P1))
    rec = client.post(
        f"/v1/couples/{COUPLE}/consents",
        json={"recipient": P2, "scope": "gene_names_only", "purpose": "partner_disclosure"},
        headers=alice,
    ).json()
    calls = [
        client.get(f"/v1/couples/{COUPLE}/consents", headers=foreign),
        client.post(
            f"/v1/couples/{COUPLE}/consents",
            json={"recipient": P2, "scope": "gene_names_only", "purpose": "partner_disclosure"},
            headers=foreign,
        ),
        client.post(f"/v1/consents/{rec['consent_id']}/revoke", headers=foreign),
        client.put(f"/v1/couples/{COUPLE}/right-not-to-know", headers=foreign),
        client.delete(f"/v1/couples/{COUPLE}/right-not-to-know", headers=foreign),
        client.get(f"/v1/couples/{COUPLE}/audit", headers=foreign),
    ]
    assert [c.status_code for c in calls] == [403] * 6
    assert len(_scope_denials(svc)) == 6  # every refusal is in the audit chain
    assert svc.right_not_to_know_active(COUPLE, P1) is False
    assert not any(
        r["revoked_at"]
        for r in client.get(f"/v1/couples/{COUPLE}/consents", headers=alice).json()["records"]
    )


@pytest.mark.integration
def test_unassigned_staff_are_denied_on_couple_routes_and_assigned_staff_are_not(env) -> None:
    svc, client = env
    svc.assign_staff(COUPLE, STAFF_A)
    b = bearer(svc, staff(Role.COUNSELLOR, STAFF_B))
    a = bearer(svc, staff(Role.COUNSELLOR, STAFF_A))
    assert client.get(f"/v1/couples/{COUPLE}/consents", headers=b).status_code == 403
    assert client.get(f"/v1/couples/{COUPLE}/audit", headers=b).status_code == 403
    assert (
        client.post(f"/v1/couples/{COUPLE}/escalations/evaluate", json={}, headers=b).status_code
        == 403
    )
    assert len(_scope_denials(svc)) == 3
    assert client.get(f"/v1/couples/{COUPLE}/consents", headers=a).status_code == 200
    assert client.get(f"/v1/couples/{COUPLE}/audit", headers=a).status_code == 200
    assert (
        client.post(f"/v1/couples/{COUPLE}/escalations/evaluate", json={}, headers=a).status_code
        == 200
    )


@pytest.mark.integration
def test_judge_may_read_synthetic_couples_but_never_write(env) -> None:
    svc, client = env
    alice = bearer(svc, member(P1))
    rec = client.post(
        f"/v1/couples/{COUPLE}/consents",
        json={"recipient": P2, "scope": "couple_result_only", "purpose": "partner_disclosure"},
        headers=alice,
    ).json()
    judge = bearer(svc, JUDGE)
    assert client.get(f"/v1/couples/{COUPLE}/consents", headers=judge).status_code == 200
    assert client.get(f"/v1/couples/{COUPLE}/audit", headers=judge).status_code == 200
    revoke = client.post(f"/v1/consents/{rec['consent_id']}/revoke", headers=judge)
    assert revoke.status_code == 403  # the controller guard: judge is read-only
    assert "read-only" in revoke.json()["detail"]
    assert client.put(f"/v1/couples/{COUPLE}/right-not-to-know", headers=judge).status_code == 403
    assert (
        client.post(
            f"/v1/couples/{COUPLE}/escalations/evaluate", json={}, headers=judge
        ).status_code
        == 403
    )
    assert not svc.consents(COUPLE)[0].revoked_at
    # A judge never sees a case that is not synthetic.
    svc.mark_case_synthetic(COUPLE, False)
    assert client.get(f"/v1/couples/{COUPLE}/consents", headers=judge).status_code == 403
    assert client.get(f"/v1/couples/{COUPLE}/audit", headers=judge).status_code == 403


@pytest.mark.integration
def test_programme_and_external_have_no_couple_level_access(env) -> None:
    svc, client = env
    programme = bearer(svc, PROGRAMME)
    assert client.get(f"/v1/couples/{COUPLE}/consents", headers=programme).status_code == 403
    assert client.get(f"/v1/couples/{COUPLE}/audit", headers=programme).status_code == 403
    assert (
        client.get(
            f"/v1/couples/{COUPLE}/audit",
            headers=bearer(svc, Principal(role=Role.EXTERNAL, subject_id="x")),
        ).status_code
        == 403
    )
    assert (
        client.get("/v1/audit/verify", headers=programme).status_code == 200
    )  # programme-level, chain only
