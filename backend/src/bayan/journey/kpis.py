"""Programme KPIs, computed from the stored cases. Never invented: no data means None."""

from __future__ import annotations

import statistics
from collections.abc import Sequence
from datetime import datetime, timedelta

from bayan.journey.config import PathwayConfig
from bayan.journey.machine import is_open, is_stale
from bayan.journey.models import DurationSummary, ProgrammeKpis, TaskCode, TaskStatus
from bayan.journey.store import CaseRecord

_SECONDS_PER_HOUR = 3600.0


def summarise(hours: Sequence[float]) -> DurationSummary:
    if not hours:
        return DurationSummary(n=0, median_hours=None, p90_hours=None)
    ordered = sorted(hours)
    p90 = (
        ordered[0]
        if len(ordered) == 1
        else statistics.quantiles(ordered, n=10, method="inclusive")[8]
    )
    return DurationSummary(
        n=len(ordered), median_hours=round(statistics.median(ordered), 2), p90_hours=round(p90, 2)
    )


def _share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def compute_kpis(
    config: PathwayConfig, cases: Sequence[CaseRecord], now: datetime
) -> ProgrammeKpis:
    to_result: list[float] = []
    to_referral: list[float] = []
    flagged = booked = completed = declined = within = 0
    open_count = stale = 0
    standard = timedelta(days=config.referral_standard_days)
    for case in cases:
        sample, report = case.first_at("sample_collected"), case.first_at("joint_report_ready")
        if sample and report:
            to_result.append((report - sample).total_seconds() / _SECONDS_PER_HOUR)
        for task in case.tasks:
            open_count += is_open(config, task)
            stale += is_stale(config, task, now)
        if not case.flagged:
            continue
        flagged += 1
        counselling = [t for t in case.tasks if t.code is TaskCode.COUNSELLING]
        booked_at: list[tuple[datetime, datetime]] = [
            (t.t3, t.t0) for t in counselling if t.t3 is not None
        ]
        if booked_at:
            first_booked, t0 = min(booked_at)
            booked += 1
            elapsed = first_booked - t0
            to_referral.append(elapsed.total_seconds() / _SECONDS_PER_HOUR)
            within += elapsed <= standard
        completed += any(t.status is TaskStatus.COMPLETED for t in counselling)
        declined += case.first_at("counselling_declined") is not None
    share_referred = _share(booked, flagged)
    return ProgrammeKpis(
        n_cases=len(cases),
        n_closed=sum(1 for c in cases if c.closed),
        n_flagged=flagged,
        time_to_result=summarise(to_result),
        time_to_referral=summarise(to_referral),
        counselling_booked=booked,
        counselling_completed=completed,
        counselling_declined=declined,
        counselling_uptake_booked_share=_share(booked, flagged),
        counselling_uptake_completed_share=_share(completed, flagged),
        share_referred=share_referred,
        referral_target_share=config.referral_target_share,
        meets_referral_target=None
        if share_referred is None
        else share_referred >= config.referral_target_share,
        share_referred_within_standard=_share(within, flagged),
        referral_standard_days=config.referral_standard_days,
        referral_standard_is_illustrative=config.timers["referral"].illustrative,
        open_tasks=open_count,
        stale_tasks=stale,
        basis=config.kpi_basis,
    )
