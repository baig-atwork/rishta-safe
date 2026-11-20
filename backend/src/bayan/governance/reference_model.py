"""REFERENCE MODEL of who may see what, decided from first principles.

Deliberately independent of `bayan.governance.disclosure` and `bayan.governance.consent`: it
imports only data types, keeps its own list of grants, and re-states the rules in plain terms.
The property tests drive the real service and this model with the same randomised operations and
require them to agree on every disclosure.

Rules (as in the disclosure module docstring, restated, not shared):
  deny:    programme and external always; judge unless the case is synthetic; staff unless assigned;
           a couple member who is not in this couple.
  staff and judge (allowed): everything.
  member:  right not to know gives nothing (and an escalation if life or fetal life is threatened).
           Otherwise own findings always; the couple category is withheld for counselling first when
           it is shared or more-information and counselling is not done; under the dubai policy, or
           when an X-linked condition is shared, a shared category also waits for every OTHER partner
           with an abnormal finding to have granted at least the couple-result scope; the partner's
           findings follow the scope the partner granted (gene names, or full findings).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from bayan.core.contracts import (
    CoupleResult,
    Finding,
    PersonReport,
    ResultCategory,
    ReviewPriority,
)
from bayan.core.types import Role

RANK = {"couple_result_only": 1, "gene_names_only": 2, "full_variant_detail": 3}
OWNED_BASES = {"x_linked_carrier_female", "x_linked_affected_male"}
COUNSELLING_FIRST = {ResultCategory.SHARED_RESULT_FOUND, ResultCategory.MORE_INFORMATION_NEEDED}


@dataclass
class Grant:
    subject: str
    recipient: str
    scope: str
    start: datetime
    expires: datetime | None
    revoked: datetime | None = None


@dataclass
class ModelState:
    grants: list[Grant] = field(default_factory=list)
    rntk: set[str] = field(default_factory=set)
    assigned: set[str] = field(default_factory=set)
    registered_staff: set[str] = field(default_factory=set)
    synthetic: bool = True


@dataclass(frozen=True)
class Viewer:
    role: Role
    subject_id: str
    couple_id: str | None


@dataclass(frozen=True)
class Expected:
    category: ResultCategory | None
    withheld: str | None
    shared_visible: bool
    own: tuple[Finding, ...]
    partner_scope: str
    partner_findings: tuple[Finding, ...]
    gene_names: tuple[str, ...]
    is_staff_view: bool
    certificate_note: bool
    escalation: bool


def abnormal(r: PersonReport) -> bool:
    return any(
        f.zygosity.value in ("carrier", "affected") and f.classification != "vus"
        for f in r.findings
    )


def scope_given(st: ModelState, subject: str, viewer_ids: set[str], now: datetime) -> str | None:
    best: str | None = None
    for g in st.grants:
        if g.subject != subject or g.recipient == subject or g.recipient not in viewer_ids:
            continue
        if now < g.start or (g.expires is not None and now >= g.expires):
            continue
        if g.revoked is not None and now >= g.revoked:
            continue
        if best is None or RANK[g.scope] > RANK[best]:
            best = g.scope
    return best


def _cert_note(st: ModelState, reports: tuple[PersonReport, ...], now: datetime) -> bool:
    for p in reports:
        if not abnormal(p):
            continue
        for q in reports:
            if q.person_id == p.person_id:
                continue
            if scope_given(st, p.person_id, {q.person_id, "couple_member"}, now) is None:
                return True
    return False


def expected_disclosure(  # noqa: PLR0917  (the six leading arguments read as one sentence)
    st: ModelState,
    viewer: Viewer,
    couple_id: str,
    result: CoupleResult,
    reports: tuple[PersonReport, ...],
    policy: str,
    *,
    counselling_done: bool,
    pregnancy: bool,
    now: datetime,
) -> Expected | None:
    """None means the viewer must be denied."""
    staff_view = Expected(
        category=result.category,
        withheld=None,
        shared_visible=True,
        own=(),
        partner_scope="full_variant_detail",
        partner_findings=tuple(f for r in reports for f in r.findings),
        gene_names=tuple(sorted({f.gene for r in reports for f in r.findings})),
        is_staff_view=True,
        certificate_note=_cert_note(st, reports, now),
        escalation=False,
    )
    if viewer.role in (Role.PROGRAMME, Role.EXTERNAL):
        return None
    if viewer.role is Role.JUDGE:
        return staff_view if st.synthetic else None
    if viewer.role in (Role.COUNSELLOR, Role.CLINICIAN):
        return staff_view if viewer.subject_id in st.assigned else None
    me = next((r for r in reports if r.person_id == viewer.subject_id), None)
    if viewer.couple_id != couple_id or me is None:
        return None
    threat = result.review_priority is ReviewPriority.URGENT or (
        pregnancy and result.category is ResultCategory.SHARED_RESULT_FOUND
    )
    if me.person_id in st.rntk:
        return Expected(None, "right_not_to_know", False, (), "none", (), (), False, False, threat)
    ids = {me.person_id, "couple_member"}
    partners = [r for r in reports if r.person_id != me.person_id]
    withheld = None
    if result.category in COUNSELLING_FIRST and not counselling_done:
        withheld = "counselling_first"
    elif result.category is ResultCategory.SHARED_RESULT_FOUND and (
        policy == "dubai" or any(s.basis in OWNED_BASES for s in result.shared)
    ):
        owners = [p for p in partners if abnormal(p)]
        if any(scope_given(st, p.person_id, ids, now) is None for p in owners):
            withheld = "awaiting_partner_consent"
    scopes = {p.person_id: scope_given(st, p.person_id, ids, now) for p in partners}
    best = max((s for s in scopes.values() if s), key=lambda s: RANK[s], default=None)
    full = tuple(
        f for p in partners if scopes[p.person_id] == "full_variant_detail" for f in p.findings
    )
    genes = tuple(
        sorted(
            {
                f.gene
                for p in partners
                if scopes[p.person_id] is not None and RANK[scopes[p.person_id] or ""] >= 2
                for f in p.findings
            }
        )
    )
    return Expected(
        category=None if withheld else result.category,
        withheld=withheld,
        shared_visible=withheld is None,
        own=me.findings,
        partner_scope=best or "none",
        partner_findings=full,
        gene_names=genes,
        is_staff_view=False,
        certificate_note=_cert_note(st, reports, now),
        escalation=False,
    )
