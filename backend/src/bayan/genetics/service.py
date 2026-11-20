"""The genetics lane's public service (spec section 3.1).

SYNTHETIC-DATA PROTOTYPE. Education and decision support only, never clinical advice.
"""

from __future__ import annotations

from collections.abc import Sequence

from bayan.core.contracts import CoupleResult, DetectionStatement, PersonReport
from bayan.core.errors import NotFound
from bayan.core.types import Relationship
from bayan.genetics.catalogue import data_content_hash, load_catalogue, load_panels
from bayan.genetics.detection import build_detection_statements
from bayan.genetics.engine import ENGINE_RULES, RULESET_BASE, CoupleEngine
from bayan.genetics.models import (
    ConditionCatalogue,
    PanelCatalogue,
    PanelInfo,
    RulesetInfo,
)

__all__ = [
    "ConditionCatalogue",
    "GeneticsService",
    "PanelCatalogue",
    "PanelInfo",
    "RulesetInfo",
    "build_genetics_service",
]


class GeneticsService:
    def __init__(
        self, catalogue: ConditionCatalogue, panels: PanelCatalogue, data_hash: str
    ) -> None:
        self._catalogue = catalogue
        self._panels = panels
        self._version = f"{RULESET_BASE}+{data_hash[:12]}"
        self._data_hash = data_hash
        self._engine = CoupleEngine(catalogue, panels, self._version)

    def compute_couple_result(
        self,
        couple_id: str,
        reports: Sequence[PersonReport],
        relationship: Relationship,
    ) -> CoupleResult:
        """Deterministic couple result. Raises `Invalid` for an unknown panel or condition id."""
        result = self._engine.classify(couple_id, reports, relationship)
        statements: list[DetectionStatement] = []
        for panel_id in dict.fromkeys(r.panel_id for r in reports):
            statements.extend(self.detection_statements(panel_id, relationship))
        return result.model_copy(update={"detection": tuple(statements)})

    def catalogue(self) -> ConditionCatalogue:
        return self._catalogue

    def panels(self) -> PanelCatalogue:
        return self._panels

    def panel(self, panel_id: str) -> PanelInfo:
        info = self._panels.get(panel_id)
        if info is None:
            msg = f"unknown panel id {panel_id!r}"
            raise NotFound(msg)
        return info

    def detection_statements(
        self, panel_id: str, relationship: Relationship
    ) -> tuple[DetectionStatement, ...]:
        return build_detection_statements(self.panel(panel_id), relationship)

    def ruleset_info(self) -> RulesetInfo:
        return RulesetInfo(
            version=self._version,
            base=RULESET_BASE,
            data_content_hash=self._data_hash,
            rules=ENGINE_RULES,
        )


def build_genetics_service() -> GeneticsService:
    return GeneticsService(load_catalogue(), load_panels(), data_content_hash())
