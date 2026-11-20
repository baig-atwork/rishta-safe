"""Builds the lane services onto app.state, and (re)seeds the demo. Controller-owned."""

from __future__ import annotations

import importlib
from typing import Any

import structlog
from fastapi import FastAPI

from bayan.core.clock import PinnableClock
from bayan.core.config import Settings

log = structlog.get_logger("bayan.wiring")

REQUIRED = frozenset({"genetics", "haem", "governance", "journey", "explain"})


def build_services(app: FastAPI, settings: Settings, clock: Any) -> list[str]:
    """Build each lane's service onto app.state. Returns the names that were built."""
    built: list[str] = []
    missing: list[str] = []

    def attach(name: str, module: str, fn: str, *args: Any) -> None:
        try:
            factory = getattr(importlib.import_module(module), fn)
        except (ImportError, AttributeError):
            missing.append(name)
            return
        setattr(app.state, name, factory(*args))
        built.append(name)

    attach("genetics", "bayan.genetics.service", "build_genetics_service")
    attach("haem", "bayan.haem.service", "build_haem_service")
    attach("governance", "bayan.governance.service", "build_governance_service", clock, settings)
    attach("journey", "bayan.journey.service", "build_journey_service", clock)
    attach("explain", "bayan.explain.service", "build_explain_service")
    if missing and settings.env != "dev":
        raise RuntimeError(f"services not available outside dev: {missing}")
    if missing:
        log.warning("services_missing_in_dev", missing=missing)
    return built


def build_and_seed(app: FastAPI) -> list[str]:
    """(Re)build every service from scratch and, in demo mode, seed the synthetic cases."""
    settings: Settings = app.state.settings
    clock = app.state.clock
    app.state.flags = {}
    built = build_services(app, settings, clock)
    app.state.demo = None
    if settings.demo_mode and set(built) >= REQUIRED and isinstance(clock, PinnableClock):
        from bayan.compose import services_from_state
        from bayan.demo.seed import seed_demo

        app.state.demo = seed_demo(services_from_state(app.state), clock)
        log.info(
            "demo_seeded",
            cases=len(app.state.demo.scenarios),
            personas=len(app.state.demo.personas),
        )
    return built
