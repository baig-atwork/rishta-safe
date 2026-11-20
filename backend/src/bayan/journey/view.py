"""Build the pathway view: steps with timestamps, SLA status per step, next actions, certificate."""

from __future__ import annotations

import calendar
from datetime import datetime, timedelta
from typing import Any

from bayan.core.types import Locale
from bayan.journey.config import PathwayConfig, StepDef, TimerDef, load_pathway_texts
from bayan.journey.machine import closable, is_open, open_tasks
from bayan.journey.models import (
    CaseKpi,
    CertificateView,
    NextAction,
    PathwayEventKind,
    PathwayStepView,
    PathwayView,
    SlaStatus,
    StepStatus,
    TaskCode,
    TimerView,
)
from bayan.journey.store import CaseRecord

_SECONDS_PER_HOUR = 3600.0


def add_months(moment: datetime, months: int) -> datetime:
    """Calendar months, clamped to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb)."""
    index = moment.month - 1 + months
    year, month = moment.year + index // 12, index % 12 + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


def _hours(delta: timedelta) -> float:
    return delta.total_seconds() / _SECONDS_PER_HOUR


def sla_for(
    config: PathwayConfig, standard_hours: float, elapsed_hours: float, *, finished: bool
) -> SlaStatus:
    """on_time / at_risk / breached. A finished timer is on_time or breached; an open one can be at_risk."""
    if elapsed_hours > standard_hours:
        return SlaStatus.BREACHED
    if finished:
        return SlaStatus.ON_TIME
    return (
        SlaStatus.AT_RISK
        if elapsed_hours >= config.at_risk_fraction * standard_hours
        else SlaStatus.ON_TIME
    )


def timer_view(
    config: PathwayConfig, case: CaseRecord, timer: TimerDef, now: datetime, notice: str
) -> TimerView | None:
    started = case.first_at(timer.from_event)
    if started is None:
        return None
    if timer.id == "referral" and case.flagged is not True:
        return None
    if timer.validity_months is not None:
        valid_until = add_months(started, timer.validity_months)
        total = _hours(valid_until - started)
        elapsed = _hours(now - started)
        status = (
            SlaStatus.BREACHED
            if now > valid_until
            else sla_for(config, total, elapsed, finished=False)
        )
        return TimerView(
            id=timer.id,
            standard_hours=None,
            elapsed_hours=round(elapsed, 2),
            sla=status,
            illustrative=timer.illustrative,
            source=timer.source,
        )
    assert timer.standard_hours_by_policy is not None
    standard = timer.standard_hours_by_policy[case.emirate_policy.value]
    ended = next((t for t in (case.first_at(e) for e in timer.to_events) if t is not None), None)
    elapsed = _hours((ended or now) - started)
    return TimerView(
        id=timer.id,
        standard_hours=standard,
        elapsed_hours=round(elapsed, 2),
        sla=sla_for(config, standard, elapsed, finished=ended is not None),
        illustrative=timer.illustrative,
        source=timer.source,
        illustrative_notice=notice if timer.illustrative else None,
    )


def _step_done_at(case: CaseRecord, step: StepDef) -> datetime | None:
    times = [t for t in (case.first_at(e) for e in step.events) if t is not None]
    return min(times) if times else None


def _steps(
    config: PathwayConfig, case: CaseRecord, now: datetime, texts: dict[str, Any]
) -> tuple[PathwayStepView, ...]:
    views: list[PathwayStepView] = []
    current_assigned = False
    declined = case.first_at("counselling_declined") is not None
    for step in config.steps:
        applies = step.applies_if == "always" or case.flagged is not False
        done_at = _step_done_at(case, step)
        if not applies:
            status = StepStatus.NOT_APPLICABLE
        elif done_at is not None:
            only_declined = declined and not any(
                case.first_at(e) for e in step.events if e != "counselling_declined"
            )
            status = StepStatus.SKIPPED if only_declined else StepStatus.DONE
        elif case.closed:
            status = StepStatus.NOT_APPLICABLE
        elif case.state == "certificate_withheld" and step.id in (
            "certificate_issued",
            "judicial_handoff_sent",
        ):
            status = StepStatus.BLOCKED
        elif not current_assigned:
            status, current_assigned = StepStatus.CURRENT, True
        else:
            status = StepStatus.UPCOMING
        timer = None
        if step.timer is not None:
            timer = timer_view(
                config,
                case,
                config.timers[step.timer],
                now,
                texts["notices"]["standard_illustrative"],
            )
        system = (
            texts["external_systems"].get(step.external_system) if step.external_system else None
        )
        text = texts["steps"][step.id]
        views.append(
            PathwayStepView(
                id=step.id,
                label=text["label"],
                description=text["description"],
                status=status,
                completed_at=done_at,
                external_system=system,
                simulated=step.external_system is not None,
                planning_minutes=step.planning_minutes,
                timer=timer,
            )
        )
    return tuple(views)


def _next_actions(
    config: PathwayConfig, case: CaseRecord, texts: dict[str, Any]
) -> tuple[NextAction, ...]:
    if case.closed:
        return ()
    kinds: dict[str, None] = {}
    for transition in config.transitions:
        if case.state in transition.from_states:
            if transition.guard == "closable" and closable(config, case) is not None:
                continue
            kinds[transition.event] = None
    for event, states in config.side_events.items():
        if case.state in states:
            kinds[event] = None
    if not open_tasks(config, case, TaskCode.CONFIRMATORY_TESTING):
        kinds.pop("confirmatory_test_resulted", None)
    if not open_tasks(config, case, TaskCode.SPECIALIST_REFERRAL):
        kinds.pop("specialist_referral_completed", None)
    briefable = [t for t in open_tasks(config, case, TaskCode.COUNSELLING) if t.t2 is None]
    if not briefable:
        kinds.pop("brief_generated", None)
    return tuple(
        NextAction(
            event=PathwayEventKind(event),
            label=texts["events"][event],
            roles=tuple(sorted(r.value for r in config.permissions[event])),
        )
        for event in kinds
    )


def case_kpi(case: CaseRecord) -> CaseKpi:
    sample, report = case.first_at("sample_collected"), case.first_at("joint_report_ready")
    result, booked = case.first_at("result_communicated"), case.first_at("counselling_booked")
    counselling: str | None = None
    if case.flagged is False:
        counselling = "not_indicated"
    elif case.flagged:
        counselling = (
            "declined"
            if case.first_at("counselling_declined")
            else "completed"
            if case.first_at("counselling_completed")
            else "booked"
            if booked
            else "pending"
        )
    return CaseKpi(
        time_to_result_hours=round(_hours(report - sample), 2) if sample and report else None,
        time_to_referral_hours=round(_hours(booked - result), 2) if result and booked else None,
        counselling=counselling,
    )


def build_view(
    config: PathwayConfig, case: CaseRecord, now: datetime, locale: Locale
) -> PathwayView:
    texts = load_pathway_texts(locale)
    meta = texts["meta"]
    issued = case.first_at("certificate_issued")
    certificate = None
    if issued is not None:
        valid_until = add_months(issued, config.timers["certificate_validity"].validity_months or 0)
        certificate = CertificateView(
            issued_at=issued, valid_until=valid_until, expired=now > valid_until
        )
    notices = [texts["notices"]["simulated"], texts["notices"]["synthetic"]]
    if meta["language_status"] == "draft":
        notices.append(texts["notices"]["draft"])
    if certificate is not None and certificate.expired:
        notices.append(texts["notices"]["certificate_expired"])
    open_count = sum(1 for t in case.tasks if is_open(config, t))
    return PathwayView(
        couple_id=case.couple_id,
        state=case.state,
        locale=locale,
        language_status=meta["language_status"],
        steps=_steps(config, case, now, texts),
        next_actions=_next_actions(config, case, texts),
        open_referral_tasks=open_count,
        certificate=certificate,
        kpi=case_kpi(case),
        notices=tuple(notices),
    )
