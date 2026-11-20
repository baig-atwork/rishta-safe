"""Deterministic Mendelian classification of a couple (the result engine).

SYNTHETIC-DATA PROTOTYPE. Not a medical device, not a diagnosis, not clinical advice. Every rule below needs
clinician sign-off (spec rule 2); the whole ruleset is therefore reported as `needs_clinician_signoff`.

What it does, from test-confirmed findings only:

* both partners carry the same autosomal recessive condition: 25 affected, 50 carrier, 25 neither per 100 pregnancies;
* one affected partner and one carrier: 50 affected, 50 carrier; both affected: 100 affected;
* X-linked: sons and daughters get their own lines (explicit table below, per 100 sons and per 100 daughters);
* carriers of different conditions at one locus (the HBB group) pair into the group's compound condition;
* a variant of uncertain significance is never counted as a result;
* a result that is pending, or a haematology work-up that stopped at CBC or CBC plus HPLC, can never produce a shared
  or a no-shared statement;
* autosomal dominant findings are outside the couple-level matrix.

The engine reasons about person-level findings (carrier or affected per condition). The independent oracle in
`oracle.py` reasons about alleles and shares no code with this module; `tests` compare the two.

Relatedness never changes the Mendelian outcome lines once genotypes are known (research report 03 section 2.3).
It matters only for how much a negative test reassures, and that is carried by the detection statements.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from bayan.core.contracts import (
    CoupleResult,
    Finding,
    Inheritance,
    OutcomeLine,
    PersonReport,
    ResultCategory,
    ReviewPriority,
    Sex,
    SharedCondition,
    Zygosity,
)
from bayan.core.errors import Invalid
from bayan.core.types import Relationship
from bayan.genetics.models import (
    ConditionCatalogue,
    ConditionRow,
    LocusGroup,
    PanelCatalogue,
    PanelInfo,
    RuleDoc,
)

RULESET_BASE = "rishta-safe-couple-1.0"

# Reason keys (keys into the explainer templates; lane C renders them).
REASON_PENDING = "result_pending_confirmation"
REASON_CBC_ONLY = "haem_work_up_cbc_only"
REASON_HPLC_ONLY = "haem_work_up_hplc_unconfirmed"
REASON_VUS = "vus_present"
REASON_PANEL_MISMATCH = "panel_mismatch"
REASON_OUTSIDE_PANEL = "finding_outside_declared_panel"
REASON_SEX_INCONSISTENT = "finding_inconsistent_with_sex"
REASON_CATALOGUE_INCONSISTENT = "finding_inconsistent_with_catalogue"
REASON_DUPLICATE = "duplicate_findings_same_locus"
REASON_SPECIALIST = "specialist_read_needed"
REASON_XL_READ = "x_linked_clinical_read_needed"
REASON_XL_SEX_PAIR = "x_linked_sex_pair_needed"

ENGINE_RULES: tuple[RuleDoc, ...] = (
    RuleDoc(
        id="E01", text="Relationship is recorded; it does not change the Mendelian outcome lines."
    ),
    RuleDoc(
        id="E02",
        text="A pending-confirmation report, or a work-up that stopped at CBC or CBC plus HPLC, gives 'more information needed' and never a shared or no-shared statement.",
    ),
    RuleDoc(
        id="E03", text="A finding for an unknown panel or condition is rejected as invalid input."
    ),
    RuleDoc(
        id="E04",
        text="A variant of uncertain significance is never counted as a result (reason key vus_present when no shared result exists; listed in the trace when one does).",
    ),
    RuleDoc(
        id="E05",
        text="Autosomal dominant findings are outside the couple-level matrix and are not surfaced.",
    ),
    RuleDoc(
        id="E06",
        text="A finding that is inconsistent with the catalogue, the person's sex or the declared panel gives 'more information needed'.",
    ),
    RuleDoc(
        id="E07",
        text="Two findings for one person at the same locus (duplicate or conflicting) give 'more information needed'.",
    ),
    RuleDoc(
        id="E08",
        text="Different panels: compared only where both partners' panels cover the locus; a locus covered for one partner with a finding and not for the other gives 'more information needed' (panel_mismatch).",
    ),
    RuleDoc(
        id="E10",
        text="Autosomal recessive, both carriers: 25 affected, 50 carrier, 25 neither per 100 pregnancies.",
    ),
    RuleDoc(
        id="E11",
        text="Autosomal recessive, one affected and one carrier: 50 affected, 50 carrier per 100.",
    ),
    RuleDoc(id="E12", text="Autosomal recessive, both affected: 100 affected per 100."),
    RuleDoc(
        id="E13",
        text="Autosomal recessive, affected partner with a partner who has no finding: no shared result (all children would carry); partner is flagged for review.",
    ),
    RuleDoc(
        id="E14",
        text="Carriers of different conditions at one locus group pair into that group's compound condition; pairings that involve a specialist-read condition give 'more information needed'.",
    ),
    RuleDoc(
        id="E20",
        text="X-linked, carrier female and male without the variant: sons 50 affected 50 neither, daughters 50 carrier 50 neither (per 100 sons, per 100 daughters).",
    ),
    RuleDoc(
        id="E21",
        text="X-linked, affected male and female without the variant: sons 100 neither, daughters 100 carrier.",
    ),
    RuleDoc(
        id="E22",
        text="X-linked, affected male and carrier female: sons 50/50, daughters 50 affected 50 carrier.",
    ),
    RuleDoc(
        id="E23",
        text="X-linked, affected male and affected female: sons and daughters 100 affected.",
    ),
    RuleDoc(
        id="E24",
        text="X-linked, affected female and male without the variant: a clinical read is needed (reason key x_linked_clinical_read_needed).",
    ),
    RuleDoc(
        id="E25",
        text="X-linked findings need one female and one male partner to give son and daughter lines.",
    ),
    RuleDoc(
        id="P1",
        text="Review priority urgent: a shared condition of severity tier A (illustrative), or an affected partner with a tier A or B condition.",
    ),
    RuleDoc(
        id="P2",
        text="Review priority priority: any other shared result, any 'more information needed', a variant of uncertain significance, or an affected partner with a tier C condition.",
    ),
    RuleDoc(
        id="P3",
        text="Review priority routine: nothing above applies. Pregnancy-related and other context escalations are made elsewhere (governance), not here.",
    ),
)

Kind = Literal["carrier", "affected"]

# Per 100 pregnancies (fixed denominator). Tuples are (affected, carrier, neither).
_AR_TABLE: dict[tuple[Kind, Kind], tuple[int, int, int]] = {
    ("carrier", "carrier"): (25, 50, 25),
    ("affected", "carrier"): (50, 50, 0),
    ("carrier", "affected"): (50, 50, 0),
    ("affected", "affected"): (100, 0, 0),
}
_AR_BASIS: dict[
    tuple[Kind, Kind], Literal["both_carriers", "affected_partner_and_carrier", "both_affected"]
] = {
    ("carrier", "carrier"): "both_carriers",
    ("affected", "carrier"): "affected_partner_and_carrier",
    ("carrier", "affected"): "affected_partner_and_carrier",
    ("affected", "affected"): "both_affected",
}
_AR_RULE: dict[tuple[Kind, Kind], str] = {
    ("carrier", "carrier"): "E10",
    ("affected", "carrier"): "E11",
    ("carrier", "affected"): "E11",
    ("affected", "affected"): "E12",
}

# X-linked: key (variant copies in the female 0..2, variant in the male 0..1) -> (sons, daughters) as
# (affected, carrier, neither) per 100 sons and per 100 daughters, plus basis and rule id.
_XL_TABLE: dict[
    tuple[int, int],
    tuple[
        tuple[int, int, int],
        tuple[int, int, int],
        Literal[
            "x_linked_carrier_female",
            "x_linked_affected_male",
            "affected_partner_and_carrier",
            "both_affected",
        ],
        str,
    ],
] = {
    (1, 0): ((50, 0, 50), (0, 50, 50), "x_linked_carrier_female", "E20"),
    (0, 1): ((0, 0, 100), (0, 100, 0), "x_linked_affected_male", "E21"),
    (1, 1): ((50, 0, 50), (50, 50, 0), "affected_partner_and_carrier", "E22"),
    (2, 1): ((100, 0, 0), (100, 0, 0), "both_affected", "E23"),
}

_LABELS: tuple[Literal["affected", "carrier", "neither"], ...] = ("affected", "carrier", "neither")


def _lines(
    counts: tuple[int, int, int],
    applies_to: Literal["any_child", "son", "daughter"],
) -> tuple[OutcomeLine, ...]:
    return tuple(
        OutcomeLine(label=label, per_100=n, applies_to=applies_to)
        for label, n in zip(_LABELS, counts, strict=True)
        if n > 0
    )


@dataclass(frozen=True, slots=True)
class _State:
    idx: int  # 0 or 1: which partner
    sex: Sex
    kind: Kind
    row: ConditionRow


@dataclass(slots=True)
class _Acc:
    """What the comparison stages accumulate: shared results, affected rows, reason keys and the trace."""

    shared: list[SharedCondition]
    affected: list[ConditionRow]
    reasons: list[str]
    trace: list[str]


@dataclass(slots=True)
class _Person:
    idx: int
    report: PersonReport
    panel: PanelInfo
    states: dict[str, _State]
    vus: list[Finding]
    conflicts: set[
        str
    ]  # loci where this person has more than one finding: no state is trusted there


class CoupleEngine:
    """Stateless once built. Build one per catalogue; `classify` is a pure function of its arguments."""

    def __init__(
        self, catalogue: ConditionCatalogue, panels: PanelCatalogue, ruleset_version: str
    ) -> None:
        self._catalogue = catalogue
        self._panels = panels
        self._version = ruleset_version
        self._rows: dict[str, ConditionRow] = {c.id: c for c in catalogue.conditions}
        self._groups: dict[str, LocusGroup] = {g.id: g for g in catalogue.locus_groups}
        self._order: dict[str, int] = {c.id: i for i, c in enumerate(catalogue.conditions)}
        self._unit_members: dict[str, tuple[str, ...]] = {}
        members: dict[str, list[str]] = {}
        for c in catalogue.conditions:
            members.setdefault(self._unit(c), []).append(c.id)
        self._unit_members = {k: tuple(v) for k, v in members.items()}

    @property
    def ruleset_version(self) -> str:
        return self._version

    @staticmethod
    def _unit(row: ConditionRow) -> str:
        return row.locus_group or row.id

    # ------------------------------------------------------------------ entry point

    def classify(
        self,
        couple_id: str,
        reports: Sequence[PersonReport],
        relationship: Relationship,
    ) -> CoupleResult:
        if len(reports) != 2:
            msg = "a couple result needs exactly two person reports"
            raise Invalid(msg)
        first, second = reports
        if first.person_id == second.person_id:
            msg = "the two person reports must belong to two different people"
            raise Invalid(msg)
        acc = _Acc(
            shared=[],
            affected=[],
            reasons=[],
            trace=[
                f"E01 relationship recorded as {relationship.value}; Mendelian outcome lines do not depend on it"
            ],
        )

        gate = self._gate(reports, acc.trace)
        if gate:
            acc.trace.append("E02 no shared or no-shared statement is possible on these reports")
            return self._gated_result(couple_id, gate, relationship, acc.trace)

        people = [self._read_person(i, r, acc) for i, r in enumerate(reports)]
        self._compare(people, acc)
        # Canonical order (catalogue order), so the result does not depend on which partner is listed first.
        acc.shared.sort(key=lambda sc: self._order[sc.condition_id])

        vus_count = sum(len(p.vus) for p in people)
        if vus_count and not acc.shared:
            acc.reasons.append(REASON_VUS)
        if self._panels_differ(people):
            acc.trace.append(
                "E08 the partners were tested on different panels; only loci covered for both partners were compared"
            )
        unique_reasons = tuple(dict.fromkeys(acc.reasons))
        if acc.shared:
            category = ResultCategory.SHARED_RESULT_FOUND
        elif unique_reasons:
            category = ResultCategory.MORE_INFORMATION_NEEDED
        else:
            category = ResultCategory.NO_SHARED_CHANGE_FOUND
        priority = self._priority(category, acc, vus_count)
        return CoupleResult(
            couple_id=couple_id,
            category=category,
            review_priority=priority,
            shared=tuple(acc.shared),
            needs_more_information_reasons=unique_reasons,
            relationship=relationship,
            ruleset_version=self._version,
            trace=tuple(acc.trace),
        )

    # ------------------------------------------------------------------ stages

    def _gated_result(
        self,
        couple_id: str,
        reasons: Sequence[str],
        relationship: Relationship,
        trace: list[str],
    ) -> CoupleResult:
        # Gate results always need a person to look: priority, never routine.
        trace.append("P2 review priority: priority (more information needed)")
        return CoupleResult(
            couple_id=couple_id,
            category=ResultCategory.MORE_INFORMATION_NEEDED,
            review_priority=ReviewPriority.PRIORITY,
            needs_more_information_reasons=tuple(dict.fromkeys(reasons)),
            relationship=relationship,
            ruleset_version=self._version,
            trace=tuple(trace),
        )

    def _panel(self, panel_id: str) -> PanelInfo:
        panel = self._panels.get(panel_id)
        if panel is None:
            msg = f"unknown panel id {panel_id!r}"
            raise Invalid(msg)
        return panel

    def _gate(self, reports: Sequence[PersonReport], trace: list[str]) -> list[str]:
        reasons: list[str] = []
        for i, report in enumerate(reports, start=1):
            self._panel(report.panel_id)
            if report.status == "pending_confirmation":
                reasons.append(REASON_PENDING)
                trace.append(f"E02 partner {i}: report status is pending_confirmation")
            if report.haem_stage == "cbc_only":
                reasons.append(REASON_CBC_ONLY)
                trace.append(
                    f"E02 partner {i}: haematology work-up stopped at CBC; a CBC never gives a carrier statement"
                )
            elif report.haem_stage == "cbc_hplc":
                reasons.append(REASON_HPLC_ONLY)
                trace.append(
                    f"E02 partner {i}: haematology work-up has no genotype confirmation yet"
                )
        return reasons

    def _read_person(self, idx: int, report: PersonReport, acc: _Acc) -> _Person:
        panel = self._panel(report.panel_id)
        person = _Person(idx=idx, report=report, panel=panel, states={}, vus=[], conflicts=set())
        label = f"partner {idx + 1}"
        for finding in report.findings:
            row = self._rows.get(finding.condition_id)
            if row is None:
                msg = f"E03 unknown condition id {finding.condition_id!r}"
                raise Invalid(msg)
            if finding.zygosity is Zygosity.NOT_DETECTED:
                continue
            if finding.zygosity is Zygosity.VUS or finding.classification == "vus":
                person.vus.append(finding)
                acc.trace.append(
                    f"E04 {label}: variant of uncertain significance in {row.gene} is not counted as a result"
                )
                continue
            if (
                row.inheritance is Inheritance.AUTOSOMAL_DOMINANT
                or finding.inheritance is Inheritance.AUTOSOMAL_DOMINANT
            ):
                acc.trace.append(
                    f"E05 {label}: dominant finding in {row.gene} is outside the couple-level matrix and is not surfaced"
                )
                continue
            self._admit(person, finding, row, label, acc)
        return person

    def _admit(
        self,
        person: _Person,
        finding: Finding,
        row: ConditionRow,
        label: str,
        acc: _Acc,
    ) -> None:
        reasons, trace = acc.reasons, acc.trace
        if finding.inheritance is not row.inheritance:
            reasons.append(REASON_CATALOGUE_INCONSISTENT)
            trace.append(
                f"E06 {label}: finding for {row.id} states {finding.inheritance.value} but the catalogue says {row.inheritance.value}"
            )
            return
        if row.id not in person.panel.condition_ids:
            reasons.append(REASON_OUTSIDE_PANEL)
            trace.append(f"E06 {label}: {row.id} is not on the declared panel {person.panel.id}")
            return
        if (
            row.inheritance is Inheritance.X_LINKED
            and person.report.sex is Sex.MALE
            and finding.zygosity is Zygosity.CARRIER
        ):
            reasons.append(REASON_SEX_INCONSISTENT)
            trace.append(
                f"E06 {label}: a male cannot be an X-linked carrier; the finding for {row.id} is inconsistent"
            )
            return
        unit = self._unit(row)
        if unit in person.states or unit in person.conflicts:
            # More than one finding at one locus: trust none of them (no state, so no result there).
            person.states.pop(unit, None)
            person.conflicts.add(unit)
            reasons.append(REASON_DUPLICATE)
            trace.append(
                f"E07 {label}: more than one finding at locus {unit}; no result is stated there, needs a specialist read"
            )
            return
        kind: Kind = "affected" if finding.zygosity is Zygosity.AFFECTED else "carrier"
        person.states[unit] = _State(idx=person.idx, sex=person.report.sex, kind=kind, row=row)

    def _covers(self, person: _Person, unit: str) -> bool:
        return any(m in person.panel.condition_ids for m in self._unit_members[unit])

    @staticmethod
    def _panels_differ(people: Sequence[_Person]) -> bool:
        return set(people[0].panel.condition_ids) != set(people[1].panel.condition_ids)

    def _compare(self, people: Sequence[_Person], acc: _Acc) -> None:
        units = list(dict.fromkeys([*people[0].states, *people[1].states]))
        for unit in units:
            if unit in people[0].conflicts or unit in people[1].conflicts:
                continue
            a = people[0].states.get(unit)
            b = people[1].states.get(unit)
            present = a or b
            if present is None:
                continue
            # E08: both partners panels must cover the locus for a comparison to mean anything.
            missing = [p for p in people if not self._covers(p, unit)]
            if missing:
                acc.reasons.append(REASON_PANEL_MISMATCH)
                acc.trace.append(
                    f"E08 locus {unit}: the panel of partner {missing[0].idx + 1} ({missing[0].panel.id}) does not "
                    "cover it, so the two results cannot be compared there"
                )
                continue
            if present.row.inheritance is Inheritance.X_LINKED:
                self._xlinked(people, unit, acc)
            elif a is not None and b is not None:
                self._autosomal(a, b, unit, acc)
            elif present.kind == "affected":
                acc.affected.append(present.row)
                acc.trace.append(
                    f"E13 locus {unit}: partner {present.idx + 1} is affected and the other partner has no finding there; "
                    "no shared result, all children would carry; flagged for review"
                )

    def _autosomal(
        self,
        a: _State,
        b: _State,
        unit: str,
        acc: _Acc,
    ) -> None:
        reasons, trace = acc.reasons, acc.trace
        for s in (a, b):
            if s.kind == "affected":
                acc.affected.append(s.row)
        if a.row.couple_matrix != "simple" or b.row.couple_matrix != "simple":
            reasons.append(REASON_SPECIALIST)
            trace.append(
                f"E14 locus {unit}: {a.row.id} with {b.row.id} is not covered by the simple table; needs a specialist read "
                "(needs_clinician_signoff)"
            )
            return
        if a.row.id == b.row.id:
            condition = a.row
        else:
            group = self._groups.get(unit)
            compound = self._rows.get(group.compound_condition_id) if group else None
            if compound is None:
                reasons.append(REASON_SPECIALIST)
                trace.append(
                    f"E14 locus {unit}: {a.row.id} with {b.row.id} has no defined pairing; needs a specialist read"
                )
                return
            condition = compound
            trace.append(
                f"E14 locus {unit}: {a.row.id} with {b.row.id} pairs into {compound.id} (NHS referral chapter, NHS-REFER in the catalogue)"
            )
        key = (a.kind, b.kind)
        counts = _AR_TABLE[key]
        acc.shared.append(
            SharedCondition(
                condition_id=condition.id,
                gene=condition.gene,
                inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
                basis=_AR_BASIS[key],
                outcomes=_lines(counts, "any_child"),
            )
        )
        trace.append(
            f"{_AR_RULE[key]} {condition.id}: partner 1 {a.kind}, partner 2 {b.kind}; "
            f"{counts[0]} affected, {counts[1]} carrier, {counts[2]} neither per 100 pregnancies"
        )

    def _xlinked(
        self,
        people: Sequence[_Person],
        unit: str,
        acc: _Acc,
    ) -> None:
        reasons, trace = acc.reasons, acc.trace
        females = [p for p in people if p.report.sex is Sex.FEMALE]
        males = [p for p in people if p.report.sex is Sex.MALE]
        row = self._rows[self._unit_members[unit][0]]
        if len(females) != 1 or len(males) != 1:
            reasons.append(REASON_XL_SEX_PAIR)
            trace.append(
                f"E25 locus {unit}: son and daughter lines need one female and one male partner"
            )
            return
        f_state = females[0].states.get(unit)
        m_state = males[0].states.get(unit)
        k = 0 if f_state is None else (1 if f_state.kind == "carrier" else 2)
        h = 0 if m_state is None else 1
        for s in (f_state, m_state):
            if s is not None and s.kind == "affected":
                acc.affected.append(s.row)
        if (k, h) == (2, 0):
            reasons.append(REASON_XL_READ)
            trace.append(
                f"E24 {unit}: an affected female with a male partner without the variant needs a clinical read "
                "(needs_clinician_signoff)"
            )
            return
        sons, daughters, basis, rule = _XL_TABLE[(k, h)]
        acc.shared.append(
            SharedCondition(
                condition_id=row.id,
                gene=row.gene,
                inheritance=Inheritance.X_LINKED,
                basis=basis,
                outcomes=_lines(sons, "son") + _lines(daughters, "daughter"),
            )
        )
        trace.append(
            f"{rule} {row.id}: female copies {k}, male {'affected' if h else 'without the variant'}; "
            "lines are per 100 sons and per 100 daughters"
        )

    # ------------------------------------------------------------------ review priority (staff-only)

    def _priority(
        self,
        category: ResultCategory,
        acc: _Acc,
        vus_count: int,
    ) -> ReviewPriority:
        shared, affected_flags, trace = acc.shared, acc.affected, acc.trace
        # Tiers are illustrative; this ladder is a design rule with no source and needs sign-off.
        tier_a = [s.condition_id for s in shared if self._rows[s.condition_id].severity_tier == "A"]
        urgent_affected = [r.id for r in affected_flags if r.severity_tier in ("A", "B")]
        if tier_a or urgent_affected:
            why = (
                f"shared condition of severity tier A (illustrative): {', '.join(tier_a)}"
                if tier_a
                else f"affected partner with a tier A or B condition (illustrative): {', '.join(urgent_affected)}"
            )
            trace.append(f"P1 review priority: urgent ({why})")
            return ReviewPriority.URGENT
        if (
            shared
            or category is ResultCategory.MORE_INFORMATION_NEEDED
            or vus_count
            or affected_flags
        ):
            trace.append("P2 review priority: priority")
            return ReviewPriority.PRIORITY
        trace.append("P3 review priority: routine")
        return ReviewPriority.ROUTINE
