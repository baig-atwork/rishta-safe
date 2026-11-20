"""Haematology-aid routes through FastAPI's TestClient on a tiny local app (the real app factory does not exist yet)."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bayan.api.routers import haem
from bayan.haem.models import CBC_ONLY_LABELS, HPLC_LABELS
from bayan.haem.service import build_haem_service

pytestmark = pytest.mark.integration


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.state.haem = build_haem_service()
    app.include_router(haem.router)
    return TestClient(app)


CBC = {
    "age_years": 26,
    "sex": "F",
    "pregnant": False,
    "transfused_last_4_months": False,
    "hb_g_per_l": 112,
    "mcv_fl": 62,
    "mch_pg": 19.5,
    "ferritin_status": "not_measured",
}


def test_cbc_only_request(client: TestClient) -> None:
    response = client.post("/v1/haem/interpret", json={"cbc": CBC})
    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "indices_reduced"
    assert body["label"] in CBC_ONLY_LABELS
    assert body["stage"] == "cbc_only"
    assert body["needs_clinician_signoff"] is True
    assert "not a diagnosis" in body["not_a_diagnosis"].lower()
    assert "not claimed as new" in body["prior_art_note"]
    assert body["trace"][0]["rule_id"]
    assert body["sources"]


def test_cbc_plus_hplc_request(client: TestClient) -> None:
    hplc = {
        "hba2_pct": 5.1,
        "hba2_is_total": True,
        "hbf_pct": 1.5,
        "variant_detected": "none",
        "single_hba_band_only": True,
    }
    response = client.post("/v1/haem/interpret", json={"cbc": CBC, "hplc": hplc})
    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "pattern_suggests_beta_thal_trait"
    assert body["label"] in HPLC_LABELS
    assert body["stage"] == "cbc_plus_hplc"


def test_nonsense_values_are_rejected_before_the_rules(client: TestClient) -> None:
    for patch in (
        {"hb_g_per_l": 5000},
        {"mch_pg": -4},
        {"age_years": 500},
        {"pregnant": "perhaps"},
    ):
        response = client.post("/v1/haem/interpret", json={"cbc": {**CBC, **patch}})
        assert response.status_code == 422, patch
    bad_hplc = {"hba2_pct": 900}
    assert client.post("/v1/haem/interpret", json={"cbc": CBC, "hplc": bad_hplc}).status_code == 422


def test_unknown_request_fields_are_rejected(client: TestClient) -> None:
    assert client.post("/v1/haem/interpret", json={"cbc": CBC, "diagnosis": "x"}).status_code == 422
    assert client.post("/v1/haem/interpret", json={}).status_code == 422


def test_rules_route_lists_the_table_with_provenance(client: TestClient) -> None:
    response = client.get("/v1/haem/rules")
    assert response.status_code == 200
    body = response.json()
    assert body["needs_clinician_signoff"] is True
    assert len(body["rules"]) == 24
    assert all(
        r["needs_clinician_signoff"] is True and r["source"]["locator"] for r in body["rules"]
    )
    assert {"carrier", "not_a_carrier", "disease"} <= set(
        body["forbidden_outputs_unless_a_cited_guideline_allows"]
    )
    assert body["rules_deliberately_left_out"]
    assert "not claimed as new" in body["prior_art_note"]


def test_openapi_describes_both_routes(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert "post" in paths["/v1/haem/interpret"]
    assert "get" in paths["/v1/haem/rules"]


def test_an_unwired_app_fails_loudly() -> None:
    app = FastAPI()
    app.include_router(haem.router)
    bare = TestClient(app, raise_server_exceptions=False)
    assert bare.get("/v1/haem/rules").status_code == 500
