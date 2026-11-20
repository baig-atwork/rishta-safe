"""Composition: the operations that join several lanes.

Controller-owned. Lanes stay independent (genetics computes, governance decides who sees what,
explain words it, journey tracks the pathway); this module is the only place that calls them in
sequence: compute the result, filter it for the viewer, render it, communicate it, brief a human.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

from fastapi import Request

from bayan.core.contracts import (
    CoupleResult,
    DetectionStatement,
    ExplainerDoc,
    Frozen,
    PersonReport,
    ReviewPriority,
    SharedCondition,
)
from bayan.core.errors import Conflict, Invalid
from bayan.core.types import Locale, Principal, Relationship
from bayan.explain.service import ExplainService
from bayan.genetics.service import GeneticsService
from bayan.governance.escalation import EscalationDecision, context_from_reports, evaluate
from bayan.governance.models import ConsentRecord, GovernedDisclosure
from bayan.governance.service import GovernanceService
from bayan.journey.models import (
    ClosureRecord,
    CoupleCase,
    Member,
    PathwayEvent,
    PathwayEventKind,
    PathwayView,
    ResultReference,
)
from bayan.journey.service import JourneyService

# States after which counselling has happened or been declined, or was never indicated: the
# couple-level category may be released to the couple (governance fails closed otherwise).
RELEASABLE_STATES = frozenset(
    {
        "result_clear",
        "counselling_done",
        "counselling_declined",
        "certificate_withheld",
        "declaration_signed",
        "certificate_issued",
        "judicial_handoff_sent",
        "closed",
    }
)
# Variable expression in heterozygotes is reported for MEFV in the dossier (section 4.1).
PENETRANCE_GENES = ("MEFV",)


@dataclass(frozen=True)
class Services:
    genetics: GeneticsService
    governance: GovernanceService
    journey: JourneyService
    explain: ExplainService
    flags: dict[str, dict[str, bool]]


def services(request: Request) -> Services:
    return services_from_state(request.app.state)


def services_from_state(state: Any) -> Services:
    return Services(
        genetics=cast("GeneticsService", state.genetics),
        governance=cast("GovernanceService", state.governance),
        journey=cast("JourneyService", state.journey),
        explain=cast("ExplainService", state.explain),
        flags=cast("dict[str, dict[str, bool]]", state.flags),
    )


def pregnancy_in_progress(svc: Services, couple_id: str) -> bool:
    return svc.flags.get(couple_id, {}).get("pregnancy_in_progress", False)


# ------------------------------------------------------------------------------ result


def compute(
    svc: Services, couple_id: str
) -> tuple[CoupleCase, tuple[PersonReport, ...], CoupleResult]:
    case = svc.journey.get_case(couple_id)
    reports = svc.journey.reports(couple_id)
    if not reports:
        raise Conflict(
            "No screening report has been filed for this couple yet.", reason="report_not_filed"
        )
    result = svc.genetics.compute_couple_result(couple_id, reports, case.relationship)
    return case, reports, result


class ResultView(Frozen):
    """What one viewer sees: the disclosure-filtered result and its rendered explanation."""

    couple_id: str
    locale: Locale
    disclosed: GovernedDisclosure
    document: ExplainerDoc


def result_view(svc: Services, principal: Principal, couple_id: str, locale: Locale) -> ResultView:
    case, reports, result = compute(svc, couple_id)
    disclosed = svc.governance.disclose(
        principal,
        couple_id,
        result,
        reports,
        case.emirate_policy,
        counselling_completed=case.state in RELEASABLE_STATES,
        pregnancy_in_progress=pregnancy_in_progress(svc, couple_id),
    )
    document = svc.explain.render(disclosed, locale, reasons=result.needs_more_information_reasons)
    return ResultView(couple_id=couple_id, locale=locale, disclosed=disclosed, document=document)


# ------------------------------------------------------------------------ communicate


class CommunicateBody(Frozen):
    pregnancy_in_progress: bool = False


class CommunicateResponse(Frozen):
    pathway: PathwayView
    escalations: tuple[EscalationDecision, ...]
    category: str


def _family_history_recessive(case: CoupleCase) -> bool:
    recessive_items = {
        "blood_disease_in_family",
        "thalassaemia_in_family",
        "sickle_cell_disease_in_family",
        "childhood_death_in_family",
        "previous_child_with_inherited_condition",
        "known_carrier_in_family",
        "hearing_or_vision_loss_in_family",
    }
    return any(item.value in recessive_items for m in case.members for item in m.family_history)


def escalation_context_for(
    svc: Services, case: CoupleCase, reports: Sequence[PersonReport], result: CoupleResult
) -> Any:
    severity_a = [c.id for c in svc.genetics.catalogue().conditions if c.severity_tier == "A"]
    return context_from_reports(
        case.couple_id,
        reports,
        result,
        severity_a_condition_ids=severity_a,
        penetrance_gene_symbols=PENETRANCE_GENES,
        locale=case.members[0].language,
        pregnancy_in_progress=pregnancy_in_progress(svc, case.couple_id),
        family_history_recessive=_family_history_recessive(case),
    )


def communicate(
    svc: Services, principal: Principal, couple_id: str, *, pregnancy: bool
) -> CommunicateResponse:
    """Record that the result was communicated, with the category taken from the engine (never
    from the client), and run the escalation triggers on the same facts."""
    if pregnancy:
        svc.flags.setdefault(couple_id, {})["pregnancy_in_progress"] = True
    case, reports, result = compute(svc, couple_id)
    affected = max(
        (o.per_100 for s in result.shared for o in s.outcomes if o.label == "affected"),
        default=None,
    )
    ref = ResultReference(category=result.category, affected_per_100=affected)
    ctx = escalation_context_for(svc, case, reports, result)
    decisions = svc.governance.evaluate_escalation(ctx, result)
    view = svc.journey.advance(
        couple_id,
        PathwayEvent(kind=PathwayEventKind.RESULT_COMMUNICATED, result=ref),
        principal,
    )
    return CommunicateResponse(pathway=view, escalations=decisions, category=result.category.value)


# ----------------------------------------------------------------------------- brief


class BriefMember(Frozen):
    display_name: str
    sex: str
    age: int
    language: str
    family_history: tuple[str, ...]


class BriefSection(Frozen):
    key: str
    title: str
    lines: tuple[str, ...]


class CounsellorBrief(Frozen):
    """A one-page, grounded brief for the human who will see the couple. Facts and sources only;
    it is not clinical advice and it makes no recommendation."""

    couple_id: str
    locale: Locale
    members: tuple[BriefMember, BriefMember]
    relationship: Relationship
    emirate_policy: str
    pathway_state: str
    category: str | None
    review_priority: ReviewPriority | None
    shared: tuple[SharedCondition, ...]
    detection: tuple[DetectionStatement, ...]
    escalations: tuple[EscalationDecision, ...]
    sections: tuple[BriefSection, ...]
    trace: tuple[str, ...]
    consents: tuple[ConsentRecord, ...]
    closure_records: tuple[ClosureRecord, ...]
    pathway: PathwayView
    document: ExplainerDoc
    boundary_notice: str
    synthetic: bool = True


def _member(m: Member) -> BriefMember:
    return BriefMember(
        display_name=m.display_name,
        sex=m.sex.value,
        age=m.age,
        language=m.language.value,
        family_history=tuple(i.value for i in m.family_history),
    )


def build_brief(
    svc: Services, principal: Principal, couple_id: str, locale: Locale
) -> CounsellorBrief:
    case, reports, result = compute(svc, couple_id)
    view = result_view(svc, principal, couple_id, locale)
    pathway = svc.journey.pathway(couple_id, locale)
    ctx = escalation_context_for(svc, case, reports, result)
    # A read must not write: the pure rule evaluation, no queue entry and no audit event.
    escalations = evaluate(ctx, result)
    consents = svc.governance.consents_for(principal, couple_id)
    closures = svc.journey.closure_records(couple_id)
    disclosed = view.disclosed

    result_lines = [f"Category: {result.category.value}", f"Ruleset: {result.ruleset_version}"]
    for s in result.shared:
        outcome = ", ".join(f"{o.per_100} of 100 {o.label}" for o in s.outcomes)
        result_lines.append(f"{s.condition_id} ({s.gene}, {s.inheritance.value}): {outcome}")
    result_lines.extend(
        f"More information needed: {reason}" for reason in result.needs_more_information_reasons
    )
    why_lines = [
        f"{d.trigger_id}: tier {d.tier.value}, due {d.due_by_hint}" for d in escalations
    ] or ["No escalation trigger fired on the stored facts."]
    open_items: list[str] = []
    if pathway.open_referral_tasks:
        open_items.append(f"{pathway.open_referral_tasks} referral task(s) open.")
    open_items.extend(f"Next: {action.label}" for action in pathway.next_actions)
    if not closures:
        open_items.append("No closure record has been filed yet.")
    sharing = [
        f"{c.subject_person_id} to {c.recipient}: {c.scope.value if c.scope else 'statutory'} "
        f"({'revoked' if c.revoked_at else 'active'})"
        for c in consents
    ] or ["No sharing consent recorded."]

    sections = (
        BriefSection(key="result", title="Result on file", lines=tuple(result_lines)),
        BriefSection(key="why", title="Why a human is asked to look", lines=tuple(why_lines)),
        BriefSection(key="sharing", title="Who may see what", lines=tuple(sharing)),
        BriefSection(key="open", title="Open items", lines=tuple(open_items) or ("None.",)),
    )
    if len(case.members) != 2:
        raise Invalid("A case has exactly two members.")
    return CounsellorBrief(
        couple_id=couple_id,
        locale=locale,
        members=(_member(case.members[0]), _member(case.members[1])),
        relationship=case.relationship,
        emirate_policy=case.emirate_policy.value,
        pathway_state=case.state,
        category=disclosed.category.value if disclosed.category else None,
        review_priority=disclosed.review_priority,
        shared=disclosed.shared,
        detection=disclosed.detection,
        escalations=escalations,
        sections=sections,
        trace=disclosed.staff_trace,
        consents=consents,
        closure_records=closures,
        pathway=pathway,
        document=view.document,
        boundary_notice=disclosed.boundary_notice_key,
    )
