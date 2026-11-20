"""Seeded synthetic demo: ten couples, each exercising a different branch, plus the personas.

Everything here is made up. Names are invented, ids are pseudonymous tokens, results are
hand-written to exercise the engine's branches. Timelines are backdated with the pinnable clock so
the pathway SLAs and the programme KPIs have something real (simulated) to measure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from bayan.compose import Services, communicate
from bayan.core.clock import PinnableClock
from bayan.core.contracts import Finding, Inheritance, PersonReport, Sex, Zygosity
from bayan.core.types import Emirate, Locale, Principal, Relationship, Role
from bayan.governance.models import ConsentScope
from bayan.journey.models import (
    FamilyHistoryItem,
    IntakeInput,
    MemberInput,
    PathwayEvent,
    PathwayEventKind,
)

PANEL = "uae_demo_panel_v1"
CLINICIAN = Principal(
    role=Role.CLINICIAN, subject_id="stf-clinician-01", display_name="Clinician (synthetic persona)"
)
COUNSELLOR = Principal(
    role=Role.COUNSELLOR,
    subject_id="stf-counsellor-01",
    display_name="Counsellor (synthetic persona)",
)
PROGRAMME = Principal(
    role=Role.PROGRAMME,
    subject_id="prg-operator-01",
    display_name="Programme operator (synthetic persona)",
)
JUDGE = Principal(
    role=Role.JUDGE,
    subject_id="jdg-evaluator-01",
    display_name="Evaluator (read-only, synthetic cases)",
)

# Pathway order used to walk a case to a target state.
ORDER = (
    "registered",
    "consult_done",
    "sample_collected",
    "lab_in_progress",
    "report_ready",
    "result_communicated",
    "counselling_booked",
    "counselling_done",
    "declaration_signed",
    "certificate_issued",
    "judicial_handoff_sent",
)


def _f(
    gene: str, cond: str, z: Zygosity, inh: Inheritance = Inheritance.AUTOSOMAL_RECESSIVE, **kw: Any
) -> Finding:
    return Finding(
        gene=gene,
        condition_id=cond,
        zygosity=z,
        inheritance=inh,
        variant_label=kw.get("variant"),
        classification=kw.get("classification", "pathogenic"),
    )


C, A, V = Zygosity.CARRIER, Zygosity.AFFECTED, Zygosity.VUS
H = FamilyHistoryItem


@dataclass(frozen=True)
class Scenario:
    n: int
    title: str
    summary: str
    relationship: Relationship
    emirate: Emirate
    a: tuple[str, int, tuple[FamilyHistoryItem, ...]]  # name, age, history (member 1 is female)
    b: tuple[str, int, tuple[FamilyHistoryItem, ...]]  # member 2 is male
    findings_a: tuple[Finding, ...] = ()
    findings_b: tuple[Finding, ...] = ()
    haem_stage: str = "genotype_confirmed"
    target: str = "registered"  # last pathway step reached
    started_days_ago: int = 30
    report_after_days: int = 11
    pregnancy: bool = False
    partner_declines: bool = False
    languages: tuple[Locale, Locale] = (Locale.EN, Locale.AR)
    consents: tuple[
        tuple[str, str, ConsentScope], ...
    ] = ()  # (subject 'a'|'b', recipient 'a'|'b', scope)
    note: str = ""
    expected_category: str = field(default="")

    @property
    def couple_id(self) -> str:
        return f"cpl-demo-{self.n:02d}"

    def person_id(self, side: str) -> str:
        return f"prs-{self.n:02d}{side}"


SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        1,
        "Unrelated, nothing shared on this panel",
        "One partner carries a change in a gene the other does not; the couple-level result is no shared change found, and the partner's finding stays private.",
        Relationship.UNRELATED,
        Emirate.ABU_DHABI,
        ("Salma Demo", 26, (H.NONE_DECLARED,)),
        ("Faris Demo", 29, (H.NONE_DECLARED,)),
        findings_b=(_f("MEFV", "familial_mediterranean_fever", C),),
        target="declaration_signed",
        started_days_ago=40,
    ),
    Scenario(
        2,
        "First cousins, both carry the same condition",
        "A shared result on one condition (Usher syndrome type 2A): counselling is booked, the counsellor sees a grounded brief.",
        Relationship.FIRST_COUSIN,
        Emirate.ABU_DHABI,
        ("Layla Demo", 24, (H.KNOWN_CARRIER,)),
        ("Anwar Demo", 27, (H.KNOWN_CARRIER,)),
        findings_a=(_f("USH2A", "usher_syndrome_type_2a", C),),
        findings_b=(_f("USH2A", "usher_syndrome_type_2a", C),),
        target="counselling_done",
        started_days_ago=26,
    ),
    Scenario(
        3,
        "First cousins, nothing found, related-couple caveat",
        "No shared change found on this panel, shown together with the caveat that for related partners a negative result lowers the chance less than for unrelated partners.",
        Relationship.FIRST_COUSIN,
        Emirate.ABU_DHABI,
        ("Rubina Demo", 25, (H.NONE_DECLARED,)),
        ("Imran Demo", 28, (H.NONE_DECLARED,)),
        target="declaration_signed",
        started_days_ago=35,
    ),
    Scenario(
        4,
        "Alpha-thalassaemia carrier pair (Dubai policy)",
        "Both partners carry an alpha-thalassaemia change; the Dubai standard informs each person of their own result first.",
        Relationship.UNRELATED,
        Emirate.DUBAI,
        ("Dalia Demo", 27, (H.THALASSAEMIA,)),
        ("Hamad Demo", 30, (H.NONE_DECLARED,)),
        findings_a=(_f("HBA1/HBA2", "alpha_thalassaemia_alpha0", C),),
        findings_b=(_f("HBA1/HBA2", "alpha_thalassaemia_alpha0", C),),
        target="counselling_done",
        started_days_ago=28,
        languages=(Locale.AR, Locale.EN),
    ),
    Scenario(
        5,
        "One partner affected, the other a carrier",
        "A sickle cell result in one partner and carrier status in the other: urgent staff review, counselling is overdue (the referral clock is breached).",
        Relationship.UNRELATED,
        Emirate.DUBAI,
        ("Basma Demo", 28, (H.SICKLE_CELL,)),
        ("Walid Demo", 31, (H.BLOOD_DISEASE,)),
        findings_a=(_f("HBB", "sickle_cell_disease", A),),
        findings_b=(_f("HBB", "sickle_cell_disease", C),),
        target="result_communicated",
        started_days_ago=33,
        report_after_days=12,
    ),
    Scenario(
        6,
        "X-linked finding",
        "A G6PD carrier female with a male partner: an X-linked finding goes to staff review; the product states what it does not decide.",
        Relationship.UNRELATED,
        Emirate.ABU_DHABI,
        ("Hind Demo", 26, (H.NONE_DECLARED,)),
        ("Marwan Demo", 29, (H.NONE_DECLARED,)),
        findings_a=(_f("G6PD", "g6pd_deficiency", C, Inheritance.X_LINKED),),
        target="counselling_booked",
        started_days_ago=22,
        languages=(Locale.UR, Locale.EN),
    ),
    Scenario(
        7,
        "Variant of uncertain significance",
        "A VUS is never counted as a result: the couple-level answer is more information needed and a staff review is raised.",
        Relationship.UNRELATED,
        Emirate.ABU_DHABI,
        ("Samar Demo", 27, (H.HEARING_VISION,)),
        ("Tawfiq Demo", 30, (H.NONE_DECLARED,)),
        findings_a=(_f("CFTR", "cystic_fibrosis", V, classification="vus"),),
        target="result_communicated",
        started_days_ago=20,
    ),
    Scenario(
        8,
        "A partner declines to share (certificate tension)",
        "Both partners carry a change in the same gene; one partner declines to share. The standards withhold the certificate in that case, and the product shows the tension plainly.",
        Relationship.UNRELATED,
        Emirate.DUBAI,
        ("Sana Demo", 25, (H.NONE_DECLARED,)),
        ("Zubair Demo", 28, (H.NONE_DECLARED,)),
        findings_a=(_f("MEFV", "familial_mediterranean_fever", C),),
        findings_b=(_f("MEFV", "familial_mediterranean_fever", C),),
        target="counselling_done",
        partner_declines=True,
        started_days_ago=45,
    ),
    Scenario(
        9,
        "Pregnancy in progress with a shared result",
        "A shared beta-thalassaemia result while a pregnancy is in progress: the highest-priority escalation, to an accredited geneticist.",
        Relationship.FIRST_COUSIN_ONCE_REMOVED,
        Emirate.ABU_DHABI,
        ("Joud Demo", 29, (H.THALASSAEMIA, H.PREVIOUS_CHILD)),
        ("Adel Demo", 32, (H.THALASSAEMIA,)),
        findings_a=(_f("HBB", "beta_thalassaemia", C),),
        findings_b=(_f("HBB", "beta_thalassaemia", C),),
        target="result_communicated",
        pregnancy=True,
        started_days_ago=18,
    ),
    Scenario(
        10,
        "Blood count only, no genotype yet",
        "Only a complete blood count has been done: a blood count alone can never produce a carrier statement, so the answer is more information needed.",
        Relationship.UNRELATED,
        Emirate.ABU_DHABI,
        ("Ruba Demo", 24, (H.NONE_DECLARED,)),
        ("Kamal Demo", 26, (H.NONE_DECLARED,)),
        haem_stage="cbc_only",
        target="report_ready",
        started_days_ago=14,
    ),
)


@dataclass(frozen=True)
class DemoPersona:
    id: str
    role: Role
    display_name: str
    description: str
    couple_id: str | None
    principal: Principal


@dataclass
class DemoCatalogue:
    personas: list[DemoPersona] = field(default_factory=list)
    scenarios: tuple[Scenario, ...] = SCENARIOS


def _reports(s: Scenario) -> tuple[PersonReport, PersonReport]:
    return (
        PersonReport(
            person_id=s.person_id("a"),
            sex=Sex.FEMALE,
            panel_id=PANEL,
            findings=s.findings_a,
            haem_stage=s.haem_stage,
        ),
        PersonReport(
            person_id=s.person_id("b"),
            sex=Sex.MALE,
            panel_id=PANEL,
            findings=s.findings_b,
            haem_stage=s.haem_stage,
        ),
    )


def _walk(svc: Services, clock: PinnableClock, s: Scenario) -> None:
    """Walk one case along the pathway to its target with realistic gaps (all simulated)."""
    cid = s.couple_id
    reached = ORDER.index(s.target) if s.target in ORDER else 0
    start = datetime.now(UTC) - timedelta(days=s.started_days_ago)

    def fire(kind: PathwayEventKind, who: Principal, after: timedelta) -> None:
        clock.tick(seconds=after.total_seconds())
        svc.journey.advance(cid, PathwayEvent(kind=kind), who)

    with clock.pinned(start):
        # the case itself was created at `start` by the caller
        if reached >= 1:
            fire(PathwayEventKind.CONSULT_COMPLETED, CLINICIAN, timedelta(hours=2))
        if reached >= 2:
            fire(PathwayEventKind.SAMPLE_COLLECTED, CLINICIAN, timedelta(days=1))
        if reached >= 3:
            fire(PathwayEventKind.LAB_STARTED, CLINICIAN, timedelta(hours=3))
        if reached >= 4:
            clock.tick(days=s.report_after_days)
            svc.journey.advance(
                cid, PathwayEvent(kind=PathwayEventKind.JOINT_REPORT_READY), CLINICIAN
            )
        if reached >= 5:
            clock.tick(hours=4)
            communicate(svc, CLINICIAN, cid, pregnancy=s.pregnancy)
        flagged = reached >= 5 and svc.journey.get_case(cid).state != "result_clear"
        if flagged and reached >= 6:
            fire(PathwayEventKind.COUNSELLING_BOOKED, COUNSELLOR, timedelta(days=2))
        if flagged and reached >= 7:
            fire(PathwayEventKind.COUNSELLING_COMPLETED, COUNSELLOR, timedelta(days=3))
        if s.partner_declines:
            fire(PathwayEventKind.PARTNER_DECLINED_TO_SHARE, CLINICIAN, timedelta(hours=6))
        if reached >= 8:
            fire(PathwayEventKind.DECLARATION_SIGNED, CLINICIAN, timedelta(days=1))
        if reached >= 9:
            fire(PathwayEventKind.CERTIFICATE_ISSUED, CLINICIAN, timedelta(hours=2))
        if reached >= 10:
            fire(PathwayEventKind.JUDICIAL_HANDOFF_SENT, CLINICIAN, timedelta(hours=1))


def seed_demo(svc: Services, clock: PinnableClock) -> DemoCatalogue:
    """Create the personas and the ten cases on freshly built services."""
    gov = svc.governance
    catalogue = DemoCatalogue()
    for staff in (CLINICIAN, COUNSELLOR):
        gov.register_staff(staff)
    gov.register_identity("email", "clinician@demo.invalid", CLINICIAN)
    gov.register_identity("email", "counsellor@demo.invalid", COUNSELLOR)
    catalogue.personas.extend(
        [
            DemoPersona(
                "clinician",
                Role.CLINICIAN,
                CLINICIAN.display_name,
                "Files reports, records the pathway, uses the haematology aid.",
                None,
                CLINICIAN,
            ),
            DemoPersona(
                "counsellor",
                Role.COUNSELLOR,
                COUNSELLOR.display_name,
                "Sees the escalation queue and a grounded brief for each assigned couple.",
                None,
                COUNSELLOR,
            ),
            DemoPersona(
                "programme",
                Role.PROGRAMME,
                PROGRAMME.display_name,
                "Sees aggregate pathway measures only, never an individual result.",
                None,
                PROGRAMME,
            ),
            DemoPersona(
                "judge",
                Role.JUDGE,
                JUDGE.display_name,
                "Read-only view of every synthetic case and the evaluation scoreboard.",
                None,
                JUDGE,
            ),
        ]
    )
    for s in SCENARIOS:
        start = datetime.now(UTC) - timedelta(days=s.started_days_ago)
        with clock.pinned(start):
            svc.journey.create_case(
                IntakeInput(
                    couple_id=s.couple_id,
                    members=(
                        MemberInput(
                            person_id=s.person_id("a"),
                            display_name=s.a[0],
                            sex=Sex.FEMALE,
                            age=s.a[1],
                            language=s.languages[0],
                            family_history=s.a[2],
                        ),
                        MemberInput(
                            person_id=s.person_id("b"),
                            display_name=s.b[0],
                            sex=Sex.MALE,
                            age=s.b[1],
                            language=s.languages[1],
                            family_history=s.b[2],
                        ),
                    ),
                    relationship=s.relationship,
                    emirate_policy=s.emirate,
                )
            )
        gov.mark_case_synthetic(s.couple_id)
        for staff in (CLINICIAN, COUNSELLOR):
            gov.assign_staff(s.couple_id, staff.subject_id, by=None)
        svc.journey.store_reports(s.couple_id, _reports(s))
        if s.pregnancy:
            svc.flags.setdefault(s.couple_id, {})["pregnancy_in_progress"] = True
        members = {"a": (s.person_id("a"), s.a[0]), "b": (s.person_id("b"), s.b[0])}
        principals = {}
        for side, (pid, name) in members.items():
            p = Principal(
                role=Role.COUPLE_MEMBER,
                subject_id=pid,
                couple_id=s.couple_id,
                display_name=f"{name} (synthetic)",
            )
            principals[side] = p
            gov.register_identity("email", f"{pid}@demo.invalid", p)
            catalogue.personas.append(
                DemoPersona(
                    f"{s.couple_id}-{side}",
                    Role.COUPLE_MEMBER,
                    p.display_name,
                    f"Case {s.n}: {s.title}.",
                    s.couple_id,
                    p,
                )
            )
        for subject, recipient, scope in s.consents:
            gov.grant(
                s.couple_id,
                members[subject][0],
                members[recipient][0],
                scope,
                "share_with_partner",
                None,
                by=principals[subject],
            )
        _walk(svc, clock, s)
    return catalogue
