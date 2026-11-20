"""Catalogue routes, exercised through FastAPI's TestClient on a tiny local app (the real app factory does not exist yet)."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bayan.api.routers import catalogue
from bayan.genetics.service import GeneticsService, build_genetics_service

pytestmark = pytest.mark.integration


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.state.genetics = build_genetics_service()
    app.include_router(catalogue.router)
    return TestClient(app)


def test_conditions_route_returns_the_catalogue(client: TestClient) -> None:
    response = client.get("/v1/catalogue/conditions")
    assert response.status_code == 200
    body = response.json()
    assert body["needs_clinician_signoff"] is True
    assert len(body["conditions"]) >= 12
    row = next(c for c in body["conditions"] if c["id"] == "cystic_fibrosis")
    assert row["gene"] == "CFTR"
    assert row["inheritance"] == "AR"
    assert row["severity_status"] == "illustrative"
    assert row["carrier_frequency"]["source_id"] == "JAIN-2025"
    assert "Education and decision support" in body["boundary_note"]
    assert body["content_hash"]


def test_panels_route_flags_every_rate_as_assumed(client: TestClient) -> None:
    response = client.get("/v1/catalogue/panels")
    assert response.status_code == 200
    panels = response.json()["panels"]
    assert {p["id"] for p in panels} >= {"uae_demo_panel_v1", "haemoglobinopathy_demo_panel_v1"}
    for panel in panels:
        assert panel["assumed"] is True
        assert panel["illustrative"] is True
        assert panel["needs_clinician_signoff"] is True
        assert panel["genes"]


def test_openapi_describes_both_routes(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert "/v1/catalogue/conditions" in paths
    assert "/v1/catalogue/panels" in paths


def test_an_unwired_app_fails_loudly_not_silently() -> None:
    app = FastAPI()
    app.include_router(catalogue.router)
    bare = TestClient(app, raise_server_exceptions=False)
    assert bare.get("/v1/catalogue/conditions").status_code == 500


def test_the_service_object_is_the_one_on_app_state() -> None:
    app = FastAPI()
    service = build_genetics_service()
    app.state.genetics = service
    app.include_router(catalogue.router)
    assert isinstance(app.state.genetics, GeneticsService)
    assert TestClient(app).get("/v1/catalogue/panels").status_code == 200
