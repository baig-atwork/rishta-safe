"""The disclosure policy engine: who may see what of a couple's result.

`decide_disclosure` is a pure function of its inputs (no clock, no state, no I/O). The service
gathers the inputs (consent records, right-not-to-know state, staff assignments) and records the
outcome in the audit chain; the reference model in tests/governance decides the same question from
first principles and the property tests compare the two.

Rules (each with its source; all flagged `needs_legal_read` in the data file where noted):

1. A couple member always sees their OWN findings (Decree-Law 49/2023 Art. 9(1)), unless they have
   recorded a right not to know (Art. 9(2)). Then they see no result at all: category None, reason
   `right_not_to_know`, no findings, no shared conditions, no partner information. Where life or
   fetal life is threatened (Art. 9; proxy defined below) the app view STAYS withheld and an
   escalation is raised so an accredited professional makes the statutory disclosure with
   counselling. That reading is flagged for a legal read (ADR 0123).
2. The couple-level category follows the emirate policy and a counselling-first gate. Under
   `abu_dhabi` (joint report) it is released to both partners once counselling is completed. Under
   `dubai` (affected individual first) a `shared_result_found` is withheld from a member until
   every OTHER member with an abnormal finding has granted at least `couple_result_only`
   (DHA 9.1.4). Under BOTH policies the same consent gate applies when a shared condition is
   owned by one person (X-linked carrier female, X-linked affected male): research 03 rows 2, 4.
3. The partner's findings are filtered to the scope THE PARTNER granted (none by default):
   `couple_result_only` adds nothing, `gene_names_only` adds gene names, `full_variant_detail`
   adds the findings.
4. Counsellor and clinician see everything for couples ASSIGNED to them (basis: care-team
   assignment, audited on every access), including the staff trace and review priority.
5. Programme role sees NO individual result (aggregates only): denied in code even with a grant.
6. Judge role sees the staff view of SYNTHETIC cases only, read-only.
7. External role sees nothing.

No ancestry, lineage or relatedness inference is produced anywhere: `relationship` is the
relationship the couple declared at intake and is passed through untouched.

Life or fetal-life threat proxy: the engine's staff-only review priority is `urgent`, OR a
pregnancy is in progress and a shared result was found. It is a deterministic trigger for human
review, never a clinical determination.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from bayan.core.contracts import (
    CoupleResult,
    DetectionStatement,
    Finding,
    PersonReport,
    ResultCategory,
    ReviewPriority,
    SharedCondition,
    Zygosity,
)
from bayan.core.errors import Forbidden, Invalid
from bayan.core.types import Emirate, Principal, Role
from bayan.governance.consent import effective_scope
from bayan.governance.models import (
    SCOPE_RANK,
    ConsentRecord,
    ConsentScope,
    GovernedDisclosure,
    MemberFindings,
)
from bayan.governance.policies import CommonDef, PolicyDef

STAFF_ROLES = frozenset({Role.COUNSELLOR, Role.CLINICIAN})


@dataclass(frozen=True, slots=True)
class DisclosureInputs:
    principal: Principal
    couple_id: str
    result: CoupleResult
    reports: tuple[PersonReport, ...]
    emirate: Emirate
    policy: PolicyDef
    common: CommonDef
    records: tuple[ConsentRecord, ...]
    rntk_persons: frozenset[str]  # persons whose right not to know is in force at `at`
    assigned_staff: frozenset[str]  # staff subject ids assigned to this couple
    synthetic: bool
    counselling_completed: bool
    pregnancy_in_progress: bool
    at: datetime


@dataclass(frozen=True, slots=True)
class DisclosureOutcome:
    """What the service needs to audit and act on. Only `disclosure` goes back to the caller."""

    disclosure: GovernedDisclosure
    reason: str  # closed-vocabulary audit reason
    category_released: bool
    escalation_trigger_ids: tuple[str, ...]


def has_abnormal_finding(report: PersonReport) -> bool:
    """A pathogenic or likely pathogenic carrier or affected finding. A VUS is not abnormal."""
    return any(
        f.zygosity in (Zygosity.CARRIER, Zygosity.AFFECTED) and f.classification != "vus"
        for f in report.findings
    )


def life_threat_proxy(result: CoupleResult, pregnancy_in_progress: bool) -> bool:
    return result.review_priority is ReviewPriority.URGENT or (
        pregnancy_in_progress and result.category is ResultCategory.SHARED_RESULT_FOUND
    )


def _deny(reason: str, detail: str) -> Forbidden:
    return Forbidden(detail, reason=reason)


def decide_disclosure(inp: DisclosureInputs) -> DisclosureOutcome:
    """Raise `Forbidden` (with a closed `reason`) when the viewer may see no result at all."""
    if inp.result.couple_id != inp.couple_id:
        raise Invalid("the result does not belong to this couple", reason="result_couple_mismatch")
    role = inp.principal.role
    if role is Role.PROGRAMME:
        raise _deny(
            "programme_aggregates_only",
            "The programme role sees aggregate figures only, never an individual or couple result.",
        )
    if role is Role.EXTERNAL:
        raise _deny("external_no_access", "No result is available to this role.")
    if role is Role.JUDGE:
        if not inp.synthetic:
            raise _deny("judge_synthetic_only", "The judge role may only view synthetic cases.")
        return _staff_view(inp, Role.JUDGE, "judge_synthetic_view")
    if role in STAFF_ROLES:
        if inp.principal.subject_id not in inp.assigned_staff:
            raise _deny("staff_not_assigned", "This couple is not assigned to you.")
        return _staff_view(inp, role, "staff_assigned_view")
    return _member_view(inp)


# --------------------------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------------------------


def _owners_gate_applies(inp: DisclosureInputs) -> bool:
    """Is the couple-level `shared_result_found` consent-gated for the OTHER partner?"""
    owned = set(inp.common.individual_owned_shared_bases)
    return inp.policy.category_gate == "affected_individual_first" or any(
        s.basis in owned for s in inp.result.shared
    )


def _certificate_note(inp: DisclosureInputs) -> str | None:
    """The certificate-refusal tension: both emirates withhold the certificate if a partner who
    has an abnormal finding has not agreed to share it with the other. Labelled, not hidden."""
    for report in inp.reports:
        if not has_abnormal_finding(report):
            continue
        others = [r.person_id for r in inp.reports if r.person_id != report.person_id]
        for other in others:
            if (
                effective_scope(
                    inp.records,
                    inp.couple_id,
                    report.person_id,
                    {other, Role.COUPLE_MEMBER.value},
                    inp.at,
                )
                is None
            ):
                return inp.policy.certificate_note_key
    return None


PartnerScope = Literal["none", "couple_result_only", "gene_names_only", "full_variant_detail"]
_SCOPE_LITERAL: dict[ConsentScope, PartnerScope] = {
    ConsentScope.COUPLE_RESULT_ONLY: "couple_result_only",
    ConsentScope.GENE_NAMES_ONLY: "gene_names_only",
    ConsentScope.FULL_VARIANT_DETAIL: "full_variant_detail",
}


def _build(
    inp: DisclosureInputs,
    *,
    viewer_role: Role,
    viewer_person_id: str | None,
    category: ResultCategory | None,
    withheld_reason_key: str | None = None,
    shared: tuple[SharedCondition, ...] = (),
    own_findings: tuple[Finding, ...] = (),
    partner_finding_scope: PartnerScope = "none",
    partner_findings: tuple[Finding, ...] = (),
    partner_gene_names: tuple[str, ...] = (),
    member_findings: tuple[MemberFindings, ...] = (),
    detection: tuple[DetectionStatement, ...] = (),
    review_priority: ReviewPriority | None = None,
    staff_trace: tuple[str, ...] = (),
    certificate_note_key: str | None = None,
) -> GovernedDisclosure:
    return GovernedDisclosure(
        couple_id=inp.couple_id,
        viewer_role=viewer_role,
        viewer_person_id=viewer_person_id,
        policy=inp.emirate,
        category=category,
        withheld_reason_key=withheld_reason_key,
        shared=shared,
        own_findings=own_findings,
        partner_finding_scope=partner_finding_scope,
        partner_findings=partner_findings,
        partner_gene_names=partner_gene_names,
        member_findings=member_findings,
        detection=detection,
        relationship=inp.result.relationship,
        review_priority=review_priority,
        staff_trace=staff_trace,
        certificate_note_key=certificate_note_key,
        ruleset_version=inp.result.ruleset_version,
        synthetic=inp.synthetic,
    )


# --------------------------------------------------------------------------------------------
# Staff and judge view
# --------------------------------------------------------------------------------------------


def _staff_view(inp: DisclosureInputs, role: Role, reason: str) -> DisclosureOutcome:
    members = tuple(MemberFindings(person_id=r.person_id, findings=r.findings) for r in inp.reports)
    flat: tuple[Finding, ...] = tuple(f for m in members for f in m.findings)
    disclosure = _build(
        inp,
        viewer_role=role,
        viewer_person_id=None,
        category=inp.result.category,
        shared=inp.result.shared,
        partner_finding_scope="full_variant_detail",
        partner_findings=flat,
        member_findings=members,
        detection=inp.result.detection,
        review_priority=inp.result.review_priority,
        staff_trace=inp.result.trace,
        certificate_note_key=_certificate_note(inp),
    )
    return DisclosureOutcome(disclosure, reason, True, ())


# --------------------------------------------------------------------------------------------
# Couple member view
# --------------------------------------------------------------------------------------------


def _member_view(inp: DisclosureInputs) -> DisclosureOutcome:
    principal = inp.principal
    if principal.couple_id != inp.couple_id:
        raise _deny("not_member_of_couple", "You are not a member of this couple.")
    me = next((r for r in inp.reports if r.person_id == principal.subject_id), None)
    if me is None:
        raise _deny("not_member_of_couple", "You are not a member of this couple.")
    partners = [r for r in inp.reports if r.person_id != me.person_id]
    result = inp.result

    if me.person_id in inp.rntk_persons:
        triggers = (
            (inp.common.rntk_override_trigger,)
            if life_threat_proxy(result, inp.pregnancy_in_progress)
            else ()
        )
        withheld = _build(
            inp,
            viewer_role=Role.COUPLE_MEMBER,
            viewer_person_id=me.person_id,
            category=None,
            withheld_reason_key="right_not_to_know",
        )
        return DisclosureOutcome(withheld, "withheld:right_not_to_know", False, triggers)

    recipients = {me.person_id, Role.COUPLE_MEMBER.value}
    withheld_key: str | None = None
    if result.category in inp.policy.counselling_first_categories and not inp.counselling_completed:
        withheld_key = "counselling_first"
    elif result.category is ResultCategory.SHARED_RESULT_FOUND and _owners_gate_applies(inp):
        owners = [p for p in partners if has_abnormal_finding(p)]
        if any(
            effective_scope(inp.records, inp.couple_id, p.person_id, recipients, inp.at) is None
            for p in owners
        ):
            withheld_key = "awaiting_partner_consent"
    released = withheld_key is None

    scopes: list[ConsentScope] = []
    partner_findings: list[Finding] = []
    gene_names: set[str] = set()
    for p in partners:
        scope = effective_scope(inp.records, inp.couple_id, p.person_id, recipients, inp.at)
        if scope is None:
            continue
        scopes.append(scope)
        if SCOPE_RANK[scope] >= SCOPE_RANK[ConsentScope.GENE_NAMES_ONLY]:
            gene_names.update(f.gene for f in p.findings)
        if scope is ConsentScope.FULL_VARIANT_DETAIL:
            partner_findings.extend(p.findings)
    top = max(scopes, key=lambda s: SCOPE_RANK[s], default=None)

    disclosure = _build(
        inp,
        viewer_role=Role.COUPLE_MEMBER,
        viewer_person_id=me.person_id,
        category=result.category if released else None,
        withheld_reason_key=withheld_key,
        shared=result.shared if released else (),
        own_findings=me.findings,
        partner_finding_scope=_SCOPE_LITERAL[top] if top is not None else "none",
        partner_findings=tuple(partner_findings),
        partner_gene_names=tuple(sorted(gene_names)),
        detection=result.detection,
        certificate_note_key=_certificate_note(inp),
    )
    reason = "released" if released else f"withheld:{withheld_key}"
    return DisclosureOutcome(disclosure, reason, released, ())
