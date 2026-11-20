from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from bayan.api.app import create_app
from bayan.core.config import Settings


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    app = create_app(Settings(env="dev", demo_mode=True))
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def personas(client: TestClient) -> dict[str, dict[str, Any]]:
    return {p["id"]: p for p in client.get("/v1/demo/personas").json()}


@pytest.fixture(scope="module")
def auth(personas: dict[str, dict[str, Any]]) -> Callable[[str], dict[str, str]]:
    def headers(persona_id: str) -> dict[str, str]:
        return {"Authorization": "Bearer " + personas[persona_id]["token"]["access_token"]}

    return headers
