from __future__ import annotations

import pytest

from bayan.genetics.service import GeneticsService, build_genetics_service


@pytest.fixture(scope="session")
def svc() -> GeneticsService:
    return build_genetics_service()
