"""Typed loader for `data/consent_policies.yaml` (disclosure policies, purposes, refusal data)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Final, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

from bayan.core.contracts import ResultCategory
from bayan.core.types import Emirate, Locale, Role
from bayan.governance.errors import GovernanceConfigError
from bayan.governance.text import fold_pattern

DATA_DIR: Final = Path(__file__).resolve().parents[1] / "data"

RefusalCategory = Literal[
    "diagnosis",
    "treatment_advice",
    "marriage_decision",
    "termination_advice",
    "lineage_inference",
    "employer_insurer",
    "other_person_result",
]


class _Strict(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class PolicySource(_Strict):
    ref: str
    says: str


class PolicyDef(_Strict):
    """One emirate's disclosure rule, as data."""

    label: str
    category_gate: Literal["joint_report", "affected_individual_first"]
    counselling_first_categories: tuple[ResultCategory, ...]
    certificate_note_key: str
    sources: tuple[PolicySource, ...]


class CommonDef(_Strict):
    individual_owned_shared_bases: tuple[str, ...]
    rntk_override_trigger: str


class RefusalCategoryDef(_Strict):
    escalate: bool
    legal_basis: str
    messages: dict[str, str]


class RefusalPatternDef(_Strict):
    id: str
    locale: Locale
    category: RefusalCategory
    pattern: str = Field(min_length=3)


class RefusalData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    categories: dict[str, RefusalCategoryDef]
    patterns: tuple[RefusalPatternDef, ...]


class PolicyFile(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    consent_purposes: dict[str, str]
    recipient_roles_allowed: tuple[Role, ...]
    common: CommonDef
    policies: dict[Emirate, PolicyDef]
    refusal: RefusalData


@dataclass(frozen=True, slots=True)
class CompiledPattern:
    id: str
    locale: Locale
    category: RefusalCategory
    regex: re.Pattern[str]


@cache
def load_policy_file() -> PolicyFile:
    path = DATA_DIR / "consent_policies.yaml"
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        parsed = PolicyFile.model_validate(raw)
    except (OSError, yaml.YAMLError, ValueError) as exc:
        raise GovernanceConfigError(
            f"consent_policies.yaml is unreadable or invalid: {str(exc)[:600]}"
        ) from exc
    missing = set(Emirate) - set(parsed.policies)
    if missing:
        raise GovernanceConfigError(f"consent_policies.yaml has no policy for {sorted(missing)}")
    for name, cat in parsed.refusal.categories.items():
        absent = {loc.value for loc in Locale} - set(cat.messages)
        if absent:
            raise GovernanceConfigError(
                f"refusal category {name} lacks messages for {sorted(absent)}"
            )
    return parsed


@cache
def compiled_refusal_patterns() -> tuple[CompiledPattern, ...]:
    """Compile every pattern once. A bad pattern is a data defect and fails loudly at load."""
    data = load_policy_file().refusal
    compiled: list[CompiledPattern] = []
    for p in data.patterns:
        if p.category not in data.categories:
            raise GovernanceConfigError(f"pattern {p.id} names an unknown category {p.category}")
        try:
            rx = re.compile(fold_pattern(p.pattern))
        except re.error as exc:
            raise GovernanceConfigError(
                f"pattern {p.id} is not a valid regular expression"
            ) from exc
        compiled.append(CompiledPattern(id=p.id, locale=p.locale, category=p.category, regex=rx))
    return tuple(compiled)


def policy_for(emirate: Emirate) -> PolicyDef:
    return load_policy_file().policies[emirate]
