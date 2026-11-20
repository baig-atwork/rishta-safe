"""Load and validate the condition catalogue and the panels from `bayan/data/*.yaml`.

Loading fails fast on a broken reference (an unknown condition in a panel, an undefined tier, a non-illustrative
frequency without a source), so a bad data edit cannot reach a running service.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache
from importlib.resources import files

import yaml

from bayan.genetics.models import ConditionCatalogue, PanelCatalogue

_DATA_FILES = ("conditions.yaml", "panels.yaml")


def _read(name: str) -> str:
    return files("bayan").joinpath("data", name).read_text(encoding="utf-8")


def _mapping(text: str, name: str) -> dict[str, object]:
    raw: object = yaml.safe_load(text)
    if not isinstance(raw, dict):
        msg = f"{name} must be a YAML mapping"
        raise TypeError(msg)
    return {str(k): v for k, v in raw.items()}


@lru_cache(maxsize=1)
def data_content_hash() -> str:
    """SHA-256 over the data files with line endings normalised (so Windows and Linux agree)."""
    digest = hashlib.sha256()
    for name in _DATA_FILES:
        digest.update(name.encode())
        digest.update(_read(name).replace("\r\n", "\n").encode("utf-8"))
    return digest.hexdigest()


@lru_cache(maxsize=1)
def load_catalogue() -> ConditionCatalogue:
    raw = _mapping(_read("conditions.yaml"), "conditions.yaml")
    catalogue = ConditionCatalogue.model_validate(raw)
    return catalogue.model_copy(update={"content_hash": data_content_hash()})


@lru_cache(maxsize=1)
def load_panels() -> PanelCatalogue:
    raw = _mapping(_read("panels.yaml"), "panels.yaml")
    catalogue = load_catalogue()
    parsed = PanelCatalogue.model_validate(raw)
    seen: set[str] = set()
    panels = []
    for panel in parsed.panels:
        if panel.id in seen:
            msg = f"duplicate panel id {panel.id}"
            raise ValueError(msg)
        seen.add(panel.id)
        genes: list[str] = []
        for condition_id in panel.condition_ids:
            row = catalogue.get(condition_id)
            if row is None:
                msg = f"panel {panel.id}: unknown condition {condition_id}"
                raise ValueError(msg)
            if row.couple_matrix == "out_of_scope":
                msg = f"panel {panel.id}: {condition_id} is out of the couple-level matrix and cannot be on a panel"
                raise ValueError(msg)
            if row.gene not in genes:
                genes.append(row.gene)
        for condition_id in panel.detection_by_condition:
            if condition_id not in panel.condition_ids:
                msg = f"panel {panel.id}: detection override for {condition_id}, which is not on the panel"
                raise ValueError(msg)
        panels.append(panel.model_copy(update={"genes": tuple(genes)}))
    return parsed.model_copy(update={"panels": tuple(panels), "content_hash": data_content_hash()})
