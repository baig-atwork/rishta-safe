"""Shared factories for the governance tests (synthetic people only)."""

from __future__ import annotations

from datetime import UTC, datetime

from bayan.core.clock import FixedClock
from bayan.core.config import Settings
from bayan.core.contracts import (
    CoupleResult,
    Finding,
    Inheritance,
    PersonReport,
    ResultCategory,
    ReviewPriority,
    Sex,
    SharedCondition,
    Zygosity,
)
from bayan.core.types import Principal, Relationship, Role
from bayan.governance import GovernanceService, build_governance_service

T0 = datetime(2026, 11, 20, 9, 0, tzinfo=UTC)
COUPLE = "synthetic-couple-1"
P1 = "synthetic-person-1"
P2 = "synthetic-person-2"
STAFF_A = "synthetic-staff-a"
STAFF_B = "synthetic-staff-b"
STAFF_C = "synthetic-staff-c"

DEMO_SECRET = "unit-test-secret-not-a-real-secret"

# Exact counts of the property run, printed by conftest.py at the end of the session.
PROPERTY_COUNTS: dict[str, int] = dict.fromkeys(
    (
        "sequences",
        "ops",
        "disclosures",
        "allowed",
        "denied",
        "withheld",
        "leak_scans",
        "escalations",
        "abnormal_sequences",
    ),
    0,
)

# Measured numbers from the refusal and escalation evaluations, printed by conftest.py.
EVAL_REPORT: dict[str, str] = {}


def make_service(
    *, demo_mode: bool = True, env: str = "dev", ttl_minutes: int = 240, secret: str = DEMO_SECRET
) -> tuple[GovernanceService, FixedClock]:
    clock = FixedClock(T0)
    settings = Settings(
        env=env, demo_mode=demo_mode, session_secret=secret, session_ttl_minutes=ttl_minutes
    )
    return build_governance_service(clock, settings), clock


def finding(
    gene: str,
    zygosity: Zygosity = Zygosity.CARRIER,
    *,
    inheritance: Inheritance = Inheritance.AUTOSOMAL_RECESSIVE,
    classification: str = "pathogenic",
    label: str | None = None,
) -> Finding:
    return Finding(
        gene=gene,
        condition_id=f"cond-{gene.lower()}",
        zygosity=zygosity,
        inheritance=inheritance,
        classification=classification,  # type: ignore[arg-type]
        variant_label=label,
    )


def report(
    person_id: str,
    sex: Sex,
    findings: tuple[Finding, ...] = (),
    *,
    status: str = "final",
    haem_stage: str = "genotype_confirmed",
) -> PersonReport:
    return PersonReport(
        person_id=person_id,
        sex=sex,
        panel_id="synthetic-panel",
        findings=findings,
        status=status,  # type: ignore[arg-type]
        haem_stage=haem_stage,  # type: ignore[arg-type]
    )


def result(
    couple_id: str = COUPLE,
    category: ResultCategory = ResultCategory.NO_SHARED_CHANGE_FOUND,
    *,
    shared: tuple[SharedCondition, ...] = (),
    priority: ReviewPriority = ReviewPriority.ROUTINE,
    trace: tuple[str, ...] = ("rule R1 fired",),
    relationship: Relationship = Relationship.UNRELATED,
) -> CoupleResult:
    return CoupleResult(
        couple_id=couple_id,
        category=category,
        review_priority=priority,
        shared=shared,
        trace=trace,
        relationship=relationship,
        ruleset_version="test-1",
    )


def shared_condition(gene: str = "SH_1", basis: str = "both_carriers") -> SharedCondition:
    return SharedCondition(
        condition_id=f"cond-{gene.lower()}",
        gene=gene,
        inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
        basis=basis,  # type: ignore[arg-type]
        outcomes=(),
    )


def member(person_id: str = P1, couple_id: str = COUPLE) -> Principal:
    return Principal(role=Role.COUPLE_MEMBER, subject_id=person_id, couple_id=couple_id)


def staff(role: Role = Role.COUNSELLOR, subject_id: str = STAFF_A) -> Principal:
    return Principal(role=role, subject_id=subject_id)


def both_carriers_case() -> tuple[tuple[PersonReport, ...], CoupleResult]:
    """Two carriers of the same synthetic gene: a shared result."""
    reports = (
        report(P1, Sex.FEMALE, (finding("SH_1", label="VAR-P1-0"),)),
        report(P2, Sex.MALE, (finding("SH_1", label="VAR-P2-0"),)),
    )
    res = result(
        category=ResultCategory.SHARED_RESULT_FOUND,
        shared=(shared_condition("SH_1"),),
        priority=ReviewPriority.PRIORITY,
        trace=("TRACE_SENTINEL",),
    )
    return reports, res


def seed_staff(service: GovernanceService) -> None:
    for role, sid in (
        (Role.COUNSELLOR, STAFF_A),
        (Role.COUNSELLOR, STAFF_B),
        (Role.CLINICIAN, STAFF_C),
    ):
        service.register_staff(staff(role, sid))
