"""Typed loader for ``data/pathway.yaml``: states, transitions, permissions, timers, KPI parameters."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from bayan.core.errors import Invalid
from bayan.core.types import Emirate, Locale, Role
from bayan.explain.loader import read_yaml


@dataclass(frozen=True)
class Transition:
    event: str
    from_states: frozenset[str]
    to: str
    guard: str | None


@dataclass(frozen=True)
class StepDef:
    id: str
    events: tuple[str, ...]
    applies_if: str
    external_system: str | None
    timer: str | None
    planning_minutes: int | None


@dataclass(frozen=True)
class TimerDef:
    id: str
    from_event: str
    to_events: tuple[str, ...]
    standard_hours_by_policy: dict[str, float] | None
    validity_months: int | None
    illustrative: bool
    source: str


@dataclass(frozen=True)
class PathwayConfig:
    initial_state: str
    terminal_states: frozenset[str]
    transitions: tuple[Transition, ...]
    side_events: dict[str, frozenset[str]]
    permissions: dict[str, frozenset[Role]]
    steps: tuple[StepDef, ...]
    timers: dict[str, TimerDef]
    at_risk_fraction: float
    referral_target_share: float
    referral_standard_days: int
    stale_after_days: int
    kpi_basis: str
    task_terminal: frozenset[str]
    task_reason_required: frozenset[str]
    default_owner_role: dict[str, str]
    family_history_items: tuple[str, ...]


def _timer(name: str, raw: dict[str, Any]) -> TimerDef:
    hours: dict[str, float] | None = None
    if "standard_hours" in raw:
        hours = {p.value: float(raw["standard_hours"]) for p in Emirate}
    elif "standard_days" in raw:
        days = raw["standard_days"]
        if isinstance(days, dict):
            hours = {str(k): float(v) * 24 for k, v in days.items()}
        else:
            hours = {p.value: float(days) * 24 for p in Emirate}
    return TimerDef(
        id=name,
        from_event=str(raw["from_event"]),
        to_events=tuple(raw.get("to_events", ())),
        standard_hours_by_policy=hours,
        validity_months=int(raw["validity_months"]) if "validity_months" in raw else None,
        illustrative=bool(raw["illustrative"]),
        source=str(raw["source"]),
    )


@lru_cache(maxsize=1)
def load_pathway() -> PathwayConfig:
    raw = read_yaml("pathway.yaml")
    transitions = tuple(
        Transition(t["event"], frozenset(t["from"]), t["to"], t.get("guard"))
        for t in raw["transitions"]
    )
    side = {s["event"]: frozenset(s["from"]) for s in raw["side_events"]}
    permissions = {e: frozenset(Role(r) for r in roles) for e, roles in raw["permissions"].items()}
    steps = tuple(
        StepDef(
            id=s["id"],
            events=tuple(s["events"]),
            applies_if=s["applies_if"],
            external_system=s["external_system"],
            timer=s["timer"],
            planning_minutes=s.get("planning_minutes"),
        )
        for s in raw["steps"]
    )
    timers = {name: _timer(name, t) for name, t in raw["sla"]["timers"].items()}
    kpi = raw["kpi"]
    tasks = raw["referral_tasks"]
    config = PathwayConfig(
        initial_state=raw["initial_state"],
        terminal_states=frozenset(raw["terminal_states"]),
        transitions=transitions,
        side_events=side,
        permissions=permissions,
        steps=steps,
        timers=timers,
        at_risk_fraction=float(raw["sla"]["at_risk_fraction"]["value"]),
        referral_target_share=float(kpi["referral_target_share"]["value"]),
        referral_standard_days=int(raw["sla"]["timers"]["referral"]["standard_days"]),
        stale_after_days=int(kpi["task_stale_after_days"]["value"]),
        kpi_basis=str(kpi["basis"]),
        task_terminal=frozenset(tasks["terminal_statuses"]),
        task_reason_required=frozenset(tasks["reasons_required_for"]),
        default_owner_role=dict(tasks["default_owner_role"]),
        family_history_items=tuple(raw["intake"]["family_history_items"]),
    )
    _validate(config)
    return config


def _validate(config: PathwayConfig) -> None:
    events = {t.event for t in config.transitions} | set(config.side_events)
    if events != set(config.permissions):
        raise Invalid(
            f"pathway.yaml: permissions and events differ: {events ^ set(config.permissions)}"
        )
    for step in config.steps:
        if not set(step.events) <= events | {"registered"}:
            raise Invalid(f"pathway.yaml: step {step.id} uses an unknown event")
        if step.timer and step.timer not in config.timers:
            raise Invalid(f"pathway.yaml: step {step.id} uses an unknown timer")
    for role_set in config.permissions.values():
        if Role.JUDGE in role_set or Role.EXTERNAL in role_set:
            raise Invalid("pathway.yaml: judges and external parties may never advance a case")


@lru_cache(maxsize=3)
def load_pathway_texts(locale: Locale) -> dict[str, Any]:
    return read_yaml(f"pathway.{locale.value}.yaml")


@lru_cache(maxsize=1)
def load_closure() -> dict[str, Any]:
    return read_yaml("closure.yaml")


@lru_cache(maxsize=3)
def load_closure_texts(locale: Locale) -> dict[str, Any]:
    return read_yaml(f"closure.{locale.value}.yaml")
