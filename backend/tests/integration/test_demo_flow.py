"""End-to-end checks of the composed app on the seeded synthetic cases."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration

Auth = Callable[[str], dict[str, str]]

# What each seeded case must produce for the staff view (the engine's own category).
EXPECTED_STAFF_CATEGORY = {
    1: "no_shared_change_found",
    2: "shared_result_found",
    3: "no_shared_change_found",
    4: "shared_result_found",
    5: "shared_result_found",
    6: "shared_result_found",
    7: "more_information_needed",
    8: "shared_result_found",
    9: "shared_result_found",
    10: "more_information_needed",
}
BANNED = (
    "compatible",
    "incompatible",
    "no risk",
    "high risk",
    "low risk",
    "proceed with the marriage",
)


def cid(n: int) -> str:
    return f"cpl-demo-{n:02d}"


def test_listing_personas_writes_no_audit_rows(
    client: TestClient, auth: Callable[[str], dict[str, str]]
) -> None:
    """Every page load lists the personas; that must not fill each couple's audit log with token rows."""
    judge = auth("judge")
    before = client.get("/v1/audit/verify", headers=judge).json()["length"]
    for _ in range(3):
        assert client.get("/v1/demo/personas").status_code == 200
    assert client.get("/v1/audit/verify", headers=judge).json()["length"] == before


def test_health_and_personas(client: TestClient, personas: dict[str, Any]) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}
    assert {"clinician", "counsellor", "programme", "judge"} <= set(personas)
    members = [p for p in personas.values() if p["role"] == "couple_member"]
    assert len(members) == 20
    assert all(p["token"]["simulated"] is True for p in personas.values())
    assert len(client.get("/v1/demo/cases").json()) == 10


@pytest.mark.parametrize("n", range(1, 11))
def test_staff_view_matches_expected_category(client: TestClient, auth: Auth, n: int) -> None:
    r = client.get(f"/v1/couples/{cid(n)}/result?locale=en", headers=auth("judge"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["disclosed"]["category"] == EXPECTED_STAFF_CATEGORY[n]
    assert body["disclosed"]["review_priority"] in {"routine", "priority", "urgent"}
    assert body["document"]["language_status"] == "draft"
    assert body["document"]["check"]["ok"] is True


@pytest.mark.parametrize("locale", ["en", "ar", "ur"])
def test_couple_sees_released_result_in_every_language(
    client: TestClient, auth: Auth, locale: str
) -> None:
    r = client.get(f"/v1/couples/{cid(2)}/result?locale={locale}", headers=auth(f"{cid(2)}-a"))
    assert r.status_code == 200
    doc = r.json()
    assert doc["disclosed"]["category"] == "shared_result_found"
    # staff-only fields never reach a couple member
    assert doc["disclosed"]["review_priority"] is None
    assert doc["disclosed"]["staff_trace"] == []
    assert any(b["kind"] == "icon_array" for b in doc["document"]["blocks"])
    text = " ".join(b["text"] for b in doc["document"]["blocks"]).lower()
    assert not any(word in text for word in BANNED)


def test_result_is_withheld_until_counselling(client: TestClient, auth: Auth) -> None:
    r = client.get(f"/v1/couples/{cid(5)}/result", headers=auth(f"{cid(5)}-a"))
    d = r.json()["disclosed"]
    assert d["category"] is None
    assert d["withheld_reason_key"] == "counselling_first"


def test_partner_consent_is_required_under_dubai_policy(client: TestClient, auth: Auth) -> None:
    r = client.get(f"/v1/couples/{cid(4)}/result", headers=auth(f"{cid(4)}-b"))
    d = r.json()["disclosed"]
    assert d["category"] is None
    assert d["withheld_reason_key"] == "awaiting_partner_consent"
    assert d["partner_findings"] == []


def test_cross_couple_access_is_denied_and_audited(client: TestClient, auth: Auth) -> None:
    other = client.get(f"/v1/couples/{cid(3)}/result", headers=auth(f"{cid(2)}-a"))
    assert other.status_code == 403
    assert other.headers["content-type"].startswith("application/problem+json")
    assert other.json()["correlation_id"]
    pathway = client.post(
        f"/v1/couples/{cid(3)}/pathway/events",
        headers=auth(f"{cid(2)}-a"),
        json={"kind": "case_closed"},
    )
    assert pathway.status_code == 403
    assert client.get("/v1/audit/verify", headers=auth("judge")).json()["ok"] is True


def test_programme_role_never_sees_an_individual_result(client: TestClient, auth: Auth) -> None:
    assert client.get(f"/v1/couples/{cid(2)}/result", headers=auth("programme")).status_code == 403
    assert client.get("/v1/programme/kpis", headers=auth("programme")).status_code == 200


def test_judge_cannot_write(client: TestClient, auth: Auth) -> None:
    r = client.post(f"/v1/couples/{cid(2)}/result/communicate", headers=auth("judge"), json={})
    assert r.status_code == 403


@pytest.mark.parametrize("kind", ["employer", "insurer"])
def test_third_party_request_is_refused_and_logged(
    client: TestClient, auth: Auth, kind: str
) -> None:
    before = client.get("/v1/audit/verify", headers=auth("judge")).json()["length"]
    r = client.post(
        "/v1/third-party-requests", json={"couple_id": cid(1), "kind": kind}
    )  # an employer or insurer has no token: the refusal needs none
    assert r.status_code == 403
    assert "Art. 19 to 21" in r.text
    after = client.get("/v1/audit/verify", headers=auth("judge")).json()
    assert after["length"] > before
    assert after["ok"] is True


def test_brief_is_grounded_and_structured(client: TestClient, auth: Auth) -> None:
    r = client.get(f"/v1/couples/{cid(9)}/brief", headers=auth("counsellor"))
    assert r.status_code == 200
    brief = r.json()
    assert brief["category"] == "shared_result_found"
    triggers = {e["trigger_id"] for e in brief["escalations"]}
    assert "pregnancy_in_progress" in triggers
    assert {s["key"] for s in brief["sections"]} == {"result", "why", "sharing", "open"}


def test_haem_aid_is_staff_only(client: TestClient, auth: Auth) -> None:
    body = {"cbc": {"sex": "female", "hb_g_dl": 11.0, "mcv_fl": 70.0, "mch_pg": 22.0}}
    assert client.post("/v1/haem/interpret", json=body).status_code == 401
    forbidden = client.post("/v1/haem/interpret", headers=auth(f"{cid(1)}-a"), json=body)
    assert forbidden.status_code == 403


def test_unauthenticated_access_is_refused(client: TestClient) -> None:
    r = client.get(f"/v1/couples/{cid(1)}/result")
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")


def test_scoreboard_declarations_and_kpis(client: TestClient, auth: Auth) -> None:
    board = client.get("/v1/eval/scoreboard", headers=auth("judge")).json()
    assert board["data_label"] == "synthetic"
    ids = {m["id"] for m in board["metrics"]}
    assert {"M1", "M2", "M4", "M7", "M8", "M9"} <= ids
    assert all(m["does_not_show"] for m in board["metrics"])
    docs = client.get("/v1/governance/declarations").json()
    assert {d["id"] for d in docs} >= {"data_declaration", "limitations"}
    one = client.get(f"/v1/governance/declarations/{docs[0]['id']}").json()
    assert one["markdown"].startswith("#")


def test_audit_verify_is_reduced_for_a_couple_member(client: TestClient, auth: Auth) -> None:
    mine = client.get("/v1/audit/verify", headers=auth(f"{cid(2)}-a")).json()
    assert mine["scope"] == "own_couple"
    assert mine["ok"] is True
    assert mine["own_events"] >= 1
    assert mine["length"] is None
    assert mine["head_hash"] is None
    full = client.get("/v1/audit/verify", headers=auth("judge")).json()
    assert full["scope"] == "chain"
    assert full["length"] > 0
    assert full["head_hash"]


def test_reading_a_brief_does_not_grow_the_queue_but_is_audited(
    client: TestClient, auth: Auth
) -> None:
    before_queue = len(client.get("/v1/escalations", headers=auth("counsellor")).json()["records"])
    before_chain = client.get("/v1/audit/verify", headers=auth("judge")).json()["length"]
    for _ in range(3):
        assert (
            client.get(f"/v1/couples/{cid(9)}/brief", headers=auth("counsellor")).status_code == 200
        )
    after_queue = len(client.get("/v1/escalations", headers=auth("counsellor")).json()["records"])
    after_chain = client.get("/v1/audit/verify", headers=auth("judge")).json()["length"]
    # reading must not create escalation records (the queue is a work list) ...
    assert after_queue == before_queue
    # ... but a staff disclosure is an access to health data, so it is written to the audit chain
    assert after_chain > before_chain
