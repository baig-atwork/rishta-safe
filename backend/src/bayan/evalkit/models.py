"""Scoreboard models. Every metric states its method and what it does NOT show."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from bayan.core.contracts import Frozen


class Metric(Frozen):
    id: str  # M1.. style identifier from the evaluation design (ADR 0006)
    title: str
    status: Literal["measured", "protocol_only", "not_run"]
    value: str  # display string, e.g. "20,000 of 20,000 couples agree (100.0%)"
    numeric: float | None = None
    n: int | None = None
    interval: tuple[float, float] | None = None  # 95% interval where one applies
    method: str
    does_not_show: str  # the honest limit, always present
    seed: int | None = None
    command: str | None = None  # how to reproduce


class Scoreboard(Frozen):
    generated_at: datetime
    code_version: str  # git commit short hash baked in at build time, or "dev"
    data_label: Literal["synthetic"] = "synthetic"
    metrics: tuple[Metric, ...]
    caveats: tuple[str, ...]
