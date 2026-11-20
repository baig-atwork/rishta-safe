"""Importable disclosure property evaluation: randomised sequences against an independent
reference model, plus a mutant-kill check on the checker itself.

This is the ONE definition used by the judge scoreboard and by the hypothesis tests in
`tests/governance`. A scenario is a couple (two synthetic people, a result, a policy) and a random
sequence of operations: grants, revocations, time passing, right-not-to-know changes, staff
assignment, synthetic-flag changes and disclosures. `run_scenario` drives the REAL
`GovernanceService` and `reference_model.expected_disclosure` (which imports no policy code) with
the same operations, and records a mismatch when

* a state change succeeds or fails differently from the model's prediction (same exception CLASS), or
* a disclosure differs from the model's decision in any field, or
* the serialised output contains a sentinel (variant label, person-unique gene name, trace line)
  that the model says the viewer may not see (a textual leak scan independent of the field-by-field
  comparison).

Each scenario stops at its first mismatch, so `mismatches` counts failing scenarios. After the
sequences, a final sweep discloses to every viewer kind, then to both members after 45 and 600 more
minutes, so every scenario ends with at least fourteen decisions and expiry is probed.

Mutants are deliberately broken variants of the disclosure rules (and one of assignment
authority). Each is run on an ISOLATED service instance (the decision function is an instance
attribute; assignment authority is a subclass), never by patching shared module state, so this is
safe to call inside a running API process. A mutant is killed when the checker reports a mismatch
within a small fixed budget of sequences.

Honest limits: sequences are random, not exhaustive, and this is not a proof. The model and the
service were written by the same author, so a shared misreading of a rule would pass both; the
textual leak scan and the mutant-kill result are the independent checks. Everything is synthetic.
"""

from __future__ import annotations

import dataclasses
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final, Literal

from bayan.core.clock import FixedClock
from bayan.core.config import Settings
from bayan.core.contracts import (
    CoupleResult,
    Finding,
    Frozen,
    Inheritance,
    PersonReport,
    ResultCategory,
    ReviewPriority,
    Sex,
    SharedCondition,
    Zygosity,
)
from bayan.core.errors import BayanError, Conflict, Forbidden, Invalid, RuleViolation
from bayan.core.types import Emirate, Principal, Relationship, Role
from bayan.governance.disclosure import DisclosureInputs, DisclosureOutcome
from bayan.governance.models import ConsentBasis, ConsentRecord, ConsentScope, RecipientKind
from bayan.governance.reference_model import (
    Expected,
    Grant,
    ModelState,
    Viewer,
    abnormal,
    expected_disclosure,
)
from bayan.governance.service import GovernanceService

DEFAULT_SEED: Final = 20261120
EVAL_T0: Final = datetime(2026, 11, 20, 9, 0, tzinfo=UTC)
COUPLE: Final = "synthetic-couple-1"
OTHER_COUPLE: Final = "synthetic-couple-other"
P1: Final = "synthetic-person-1"
P2: Final = "synthetic-person-2"
STAFF_A: Final = "synthetic-staff-a"
STAFF_B: Final = "synthetic-staff-b"
STAFF_C: Final = "synthetic-staff-c"
SHARED_GENES: Final = ("SH_1", "SH_2")
SCOPES: Final = tuple(s.value for s in ConsentScope)
SharedBasis = Literal[
    "both_carriers",
    "affected_partner_and_carrier",
    "both_affected",
    "x_linked_carrier_female",
    "x_linked_affected_male",
]
BASES: Final[tuple[SharedBasis, ...]] = (
    "both_carriers",
    "affected_partner_and_carrier",
    "x_linked_carrier_female",
    "x_linked_affected_male",
    "both_affected",
)
Classification = Literal["pathogenic", "likely_pathogenic", "vus"]
_CLASSIFICATIONS: Final[tuple[Classification, ...]] = (
    "pathogenic",
    "pathogenic",
    "likely_pathogenic",
    "vus",
)
_EVAL_SECRET: Final = "property-evaluation-secret-not-a-real-secret"  # noqa: S105
_REVOKE_LAST: Final = -1

VIEWERS: Final[tuple[Viewer, ...]] = (
    Viewer(Role.COUPLE_MEMBER, P1, COUPLE),
    Viewer(Role.COUPLE_MEMBER, P2, COUPLE),
    Viewer(Role.COUPLE_MEMBER, "synthetic-person-9", COUPLE),  # right couple id, not in the couple
    Viewer(Role.COUPLE_MEMBER, "synthetic-other-1", OTHER_COUPLE),
    Viewer(Role.COUNSELLOR, STAFF_A, None),
    Viewer(Role.COUNSELLOR, STAFF_B, None),
    Viewer(Role.CLINICIAN, STAFF_C, None),
    Viewer(Role.PROGRAMME, "synthetic-programme-1", None),
    Viewer(Role.JUDGE, "synthetic-judge-1", None),
    Viewer(Role.EXTERNAL, "anonymous", None),
)
_ASSIGNERS: Final[dict[str, Viewer]] = {
    "programme": VIEWERS[7],
    "staff_a": VIEWERS[4],
    "staff_b": VIEWERS[5],
    "staff_c": VIEWERS[6],
    "member": VIEWERS[0],
    "judge": VIEWERS[8],
    "external": VIEWERS[9],
}
_TARGETS: Final[dict[str, str]] = {
    "a": STAFF_A,
    "b": STAFF_B,
    "c": STAFF_C,
    "ghost": "synthetic-staff-ghost",
}
_STAFF: Final = ((Role.COUNSELLOR, STAFF_A), (Role.COUNSELLOR, STAFF_B), (Role.CLINICIAN, STAFF_C))


def _principal(v: Viewer) -> Principal:
    return Principal(role=v.role, subject_id=v.subject_id, couple_id=v.couple_id)


# --------------------------------------------------------------------------------------------
# Scenario and operations
# --------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class GrantOp:
    by_kind: str  # subject | partner | staff
    subject_idx: int
    recipient_kind: str
    scope: str
    expiry_minutes: int | None  # None: no expiry; <= 0: already in the past


@dataclass(frozen=True)
class RevokeOp:
    index: int
    by_kind: str  # subject | partner


@dataclass(frozen=True)
class GrantRevokeOp:
    subject_idx: int
    scope: str


@dataclass(frozen=True)
class AdvanceOp:
    minutes: int


@dataclass(frozen=True)
class RntkOp:
    person_idx: int
    action: str  # declare | withdraw
    by_kind: str  # subject | partner


@dataclass(frozen=True)
class AssignOp:
    by_kind: str
    target_kind: str


@dataclass(frozen=True)
class SyntheticOp:
    value: bool


@dataclass(frozen=True)
class DiscloseOp:
    viewer_idx: int


Op = GrantOp | RevokeOp | GrantRevokeOp | AdvanceOp | RntkOp | AssignOp | SyntheticOp | DiscloseOp


@dataclass(frozen=True)
class Scenario:
    policy: Emirate
    reports: tuple[PersonReport, ...]
    result: CoupleResult
    counselling: bool
    pregnancy: bool
    demo_mode: bool
    register_c: bool
    ops: tuple[Op, ...]


def _person_findings(rng: random.Random, pid: str) -> tuple[Finding, ...]:
    out: list[Finding] = []
    for i in range(rng.randint(0, 3)):
        gene = rng.choice(SHARED_GENES) if rng.random() < 0.5 else f"G_{pid}_{i}"
        out.append(
            Finding(
                gene=gene,
                condition_id=f"cond-{gene}",
                zygosity=rng.choice(
                    [
                        Zygosity.CARRIER,
                        Zygosity.CARRIER,
                        Zygosity.AFFECTED,
                        Zygosity.VUS,
                        Zygosity.NOT_DETECTED,
                    ]
                ),
                inheritance=rng.choice(list(Inheritance)),
                classification=rng.choice(_CLASSIFICATIONS),
                variant_label=f"VAR-{pid}-{i}",
            )
        )
    return tuple(out)


def _random_op(rng: random.Random) -> Op:  # noqa: PLR0911  (one return per operation kind)
    kind = rng.choices(
        ["grant", "revoke", "grant_revoke", "advance", "rntk", "assign", "synthetic", "disclose"],
        weights=[3, 2, 2, 2, 2, 2, 1, 3],
    )[0]
    if kind == "grant":
        roll = rng.random()
        expiry = None if roll < 0.4 else (rng.randint(1, 300) if roll < 0.9 else -5)
        return GrantOp(
            by_kind=rng.choice(["subject", "subject", "subject", "partner", "staff"]),
            subject_idx=rng.randint(0, 1),
            recipient_kind=rng.choice(
                [
                    "partner",
                    "partner",
                    "role_couple_member",
                    "role_counsellor",
                    "role_clinician",
                    "role_external",
                    "role_programme",
                    "role_judge",
                    "self",
                ]
            ),
            scope=rng.choice(SCOPES),
            expiry_minutes=expiry,
        )
    if kind == "revoke":
        return RevokeOp(rng.randint(0, 20), rng.choice(["subject", "subject", "partner"]))
    if kind == "grant_revoke":
        return GrantRevokeOp(rng.randint(0, 1), rng.choice(SCOPES))
    if kind == "advance":
        return AdvanceOp(rng.randint(1, 400))
    if kind == "rntk":
        return RntkOp(
            rng.randint(0, 1),
            rng.choice(["declare", "withdraw"]),
            rng.choice(["subject", "subject", "partner"]),
        )
    if kind == "assign":
        return AssignOp(rng.choice(sorted(_ASSIGNERS)), rng.choice(sorted(_TARGETS)))
    if kind == "synthetic":
        return SyntheticOp(rng.random() < 0.5)
    return DiscloseOp(rng.randint(0, len(VIEWERS) - 1))


def generate_scenario(rng: random.Random) -> Scenario:
    """One random scenario from `rng`. The same generator drives the hypothesis tests (which draw
    the seed) and the importable evaluation, so there is a single definition."""
    reports = (
        PersonReport(
            person_id=P1, sex=Sex.FEMALE, panel_id="p", findings=_person_findings(rng, P1)
        ),
        PersonReport(person_id=P2, sex=Sex.MALE, panel_id="p", findings=_person_findings(rng, P2)),
    )
    shared = tuple(
        SharedCondition(
            condition_id=f"cond-{g}",
            gene=g,
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
            basis=rng.choice(BASES),
            outcomes=(),
        )
        for g in rng.sample(SHARED_GENES, rng.randint(0, 2))
    )
    result = CoupleResult(
        couple_id=COUPLE,
        category=rng.choice(list(ResultCategory)),
        review_priority=rng.choice(list(ReviewPriority)),
        shared=shared,
        relationship=rng.choice(list(Relationship)),
        trace=("TRACE_SENTINEL",),
    )
    return Scenario(
        policy=rng.choice(list(Emirate)),
        reports=reports,
        result=result,
        counselling=rng.random() < 0.5,
        pregnancy=rng.random() < 0.5,
        demo_mode=rng.random() < 0.5,
        register_c=rng.random() < 0.5,
        ops=tuple(_random_op(rng) for _ in range(rng.randint(0, 14))),
    )


def scenario_rng(seed: int, index: int) -> random.Random:
    """Deterministic per-sequence generator (string seeds hash the same way on every run)."""
    return random.Random(f"bayan-disclosure-property-{seed}-{index}")  # noqa: S311


# --------------------------------------------------------------------------------------------
# Execution
# --------------------------------------------------------------------------------------------


@dataclass
class EvalCounts:
    sequences: int = 0
    ops: int = 0
    decisions: int = 0
    allowed: int = 0
    denied: int = 0
    withheld: int = 0
    leak_scans: int = 0
    escalations: int = 0
    abnormal_sequences: int = 0

    def add(self, other: EvalCounts) -> None:
        for f in dataclasses.fields(self):
            setattr(self, f.name, getattr(self, f.name) + getattr(other, f.name))


@dataclass(frozen=True)
class ScenarioOutcome:
    counts: EvalCounts
    mismatch: str | None


ServiceFactory = Callable[[bool], tuple[GovernanceService, FixedClock]]


def default_service_factory(demo_mode: bool) -> tuple[GovernanceService, FixedClock]:
    clock = FixedClock(EVAL_T0)
    settings = Settings(env="dev", demo_mode=demo_mode, session_secret=_EVAL_SECRET)
    return GovernanceService(clock, settings), clock


class _Stop(Exception):
    pass


class _Run:
    def __init__(self, sc: Scenario, factory: ServiceFactory) -> None:
        self.sc = sc
        self.svc, self.clock = factory(sc.demo_mode)
        self.state = ModelState(synthetic=sc.demo_mode)
        self.counts = EvalCounts(sequences=1)
        self.mismatch: str | None = None
        self.granted: list[tuple[str, Grant]] = []
        self.members = {
            P1: Viewer(Role.COUPLE_MEMBER, P1, COUPLE),
            P2: Viewer(Role.COUPLE_MEMBER, P2, COUPLE),
        }
        self.person_ids = (P1, P2)
        self.labels = {f.variant_label for r in sc.reports for f in r.findings if f.variant_label}
        self.unique_genes = {
            f.gene for r in sc.reports for f in r.findings if f.gene not in SHARED_GENES
        }

    def ck(self, ok: bool, message: str) -> None:
        if not ok:
            self.mismatch = message
            raise _Stop

    def call(
        self, fn: Callable[[], object], expected: type[BayanError] | None, label: str
    ) -> object | None:
        """Run a state change; require success, or exactly the predicted exception class."""
        try:
            value = fn()
        except BayanError as exc:
            self.ck(
                expected is not None and type(exc) is expected,
                f"{label}: expected {expected.__name__ if expected else 'success'}, "
                f"got {type(exc).__name__}",
            )
            return None
        self.ck(
            expected is None,
            f"{label}: expected {expected.__name__ if expected else ''}, but the call succeeded",
        )
        return value

    # ---- operations ------------------------------------------------------------------------

    def run(self) -> ScenarioOutcome:
        try:
            for op in self.sc.ops:
                self._apply(op)
            for v in VIEWERS:
                self._disclose(v)
            for minutes in (45, 600):
                self.clock.advance(minutes=minutes)
                for v in VIEWERS[:2]:
                    self._disclose(v)
            self.ck(self.svc.verify_audit_chain().ok, "audit chain does not verify")
            self.counts.abnormal_sequences += int(any(abnormal(r) for r in self.sc.reports))
        except _Stop:
            pass
        return ScenarioOutcome(self.counts, self.mismatch)

    def _apply(self, op: Op) -> None:
        self.counts.ops += 1
        if isinstance(op, GrantRevokeOp):
            self._grant(GrantOp("subject", op.subject_idx, "partner", op.scope, None))
            self._revoke(RevokeOp(_REVOKE_LAST, "subject"))
        elif isinstance(op, GrantOp):
            self._grant(op)
        elif isinstance(op, RevokeOp):
            self._revoke(op)
        elif isinstance(op, AdvanceOp):
            self.clock.advance(minutes=op.minutes)
        elif isinstance(op, RntkOp):
            self._rntk(op)
        elif isinstance(op, AssignOp):
            self._assign(op)
        elif isinstance(op, SyntheticOp):
            self.svc.mark_case_synthetic(COUPLE, op.value)
            self.state.synthetic = op.value
        else:
            self._disclose(VIEWERS[op.viewer_idx])

    def _grant(self, op: GrantOp) -> None:
        now = self.clock.now()
        subject = self.person_ids[op.subject_idx]
        partner = self.person_ids[1 - op.subject_idx]
        by = {
            "subject": self.members[subject],
            "partner": self.members[partner],
            "staff": Viewer(Role.COUNSELLOR, STAFF_A, None),
        }[op.by_kind]
        recipient = {
            "partner": partner,
            "self": subject,
            "role_couple_member": "couple_member",
            "role_counsellor": "counsellor",
            "role_clinician": "clinician",
            "role_external": "external",
            "role_programme": "programme",
            "role_judge": "judge",
        }[op.recipient_kind]
        expected: type[BayanError] | None = None
        if op.by_kind != "subject":
            expected = Forbidden
        elif op.recipient_kind == "self":
            expected = Invalid
        elif op.recipient_kind in ("role_external", "role_programme", "role_judge"):
            expected = RuleViolation
        elif op.expiry_minutes is not None and op.expiry_minutes <= 0:
            expected = Invalid
        expires = None if op.expiry_minutes is None else now + timedelta(minutes=op.expiry_minutes)
        record = self.call(
            lambda: self.svc.grant(
                COUPLE,
                subject,
                recipient,
                ConsentScope(op.scope),
                "partner_disclosure",
                expires,
                by=_principal(by),
            ),
            expected,
            f"grant {op.recipient_kind} by {op.by_kind}",
        )
        if expected is None and isinstance(record, ConsentRecord):
            grant = Grant(subject, recipient, op.scope, now, expires)
            self.state.grants.append(grant)
            self.granted.append((record.consent_id, grant))

    def _revoke(self, op: RevokeOp) -> None:
        if not self.granted:
            return
        consent_id, grant = self.granted[op.index % len(self.granted)]
        other = self.person_ids[1 - self.person_ids.index(grant.subject)]
        by = self.members[grant.subject if op.by_kind == "subject" else other]
        expected: type[BayanError] | None = None
        if op.by_kind != "subject":
            expected = Forbidden
        elif grant.revoked is not None:
            expected = Conflict
        self.call(lambda: self.svc.revoke(consent_id, _principal(by)), expected, "revoke")
        if expected is None:
            grant.revoked = self.clock.now()

    def _rntk(self, op: RntkOp) -> None:
        person = self.person_ids[op.person_idx]
        other = self.person_ids[1 - op.person_idx]
        by = _principal(self.members[person if op.by_kind == "subject" else other])
        expected = None if op.by_kind == "subject" else Forbidden
        if op.action == "declare":
            self.call(
                lambda: self.svc.record_right_not_to_know(COUPLE, person, by),
                expected,
                "rntk declare",
            )
        else:
            self.call(
                lambda: self.svc.withdraw_right_not_to_know(COUPLE, person, by),
                expected,
                "rntk withdraw",
            )
        if expected is None:
            (self.state.rntk.add if op.action == "declare" else self.state.rntk.discard)(person)

    def _assign(self, op: AssignOp) -> None:
        by = _ASSIGNERS[op.by_kind]
        target = _TARGETS[op.target_kind]
        authorised = by.role is Role.PROGRAMME or (
            by.role in (Role.COUNSELLOR, Role.CLINICIAN) and by.subject_id in self.state.assigned
        )
        expected: type[BayanError] | None = None
        if not authorised or (target == by.subject_id and by.role is not Role.PROGRAMME):
            expected = Forbidden
        elif target not in self.state.registered_staff:
            expected = Invalid
        self.call(
            lambda: self.svc.assign_staff(COUPLE, target, _principal(by)),
            expected,
            f"assign {op.target_kind} by {op.by_kind}",
        )
        if expected is None:
            self.state.assigned.add(target)

    # ---- the check ---------------------------------------------------------------------------

    def _disclose(self, v: Viewer) -> None:
        sc, svc = self.sc, self.svc
        exp = expected_disclosure(
            self.state,
            v,
            COUPLE,
            sc.result,
            sc.reports,
            sc.policy.value,
            counselling_done=sc.counselling,
            pregnancy=sc.pregnancy,
            now=self.clock.now(),
        )
        queue_before = svc.escalation_count()
        audits_before = sum(1 for e in svc.audit_events() if e.action == "disclose")
        self.counts.decisions += 1
        label = f"disclose to {v.role.value}"
        if exp is None:
            self.counts.denied += 1
            self.call(
                lambda: svc.disclose(
                    _principal(v),
                    COUPLE,
                    sc.result,
                    sc.reports,
                    sc.policy,
                    counselling_completed=sc.counselling,
                    pregnancy_in_progress=sc.pregnancy,
                ),
                Forbidden,
                label,
            )
        else:
            self.counts.allowed += 1
            try:
                out = svc.disclose(
                    _principal(v),
                    COUPLE,
                    sc.result,
                    sc.reports,
                    sc.policy,
                    counselling_completed=sc.counselling,
                    pregnancy_in_progress=sc.pregnancy,
                )
            except BayanError as exc:
                self.ck(False, f"{label}: expected a disclosure, got {type(exc).__name__}")
                return
            self.ck(out.category == exp.category, f"{label}: category differs from the model")
            self.ck(out.withheld_reason_key == exp.withheld, f"{label}: withheld reason differs")
            if exp.category is None:
                self.counts.withheld += 1
            self.ck(
                out.shared == (sc.result.shared if exp.shared_visible else ()),
                f"{label}: shared conditions differ from the model",
            )
            self.ck(out.own_findings == exp.own, f"{label}: own findings differ")
            self.ck(out.partner_finding_scope == exp.partner_scope, f"{label}: partner scope")
            self.ck(out.partner_findings == exp.partner_findings, f"{label}: partner findings")
            if exp.is_staff_view:
                self.ck(out.review_priority is sc.result.review_priority, f"{label}: priority")
                self.ck(out.staff_trace == sc.result.trace, f"{label}: staff trace")
            else:
                self.ck(out.partner_gene_names == exp.gene_names, f"{label}: partner gene names")
                self.ck(out.review_priority is None, f"{label}: review priority leaked")
                self.ck(out.staff_trace == (), f"{label}: staff trace leaked")
                self.ck(out.member_findings == (), f"{label}: member findings leaked")
            self.ck(
                (out.certificate_note_key is not None) == exp.certificate_note,
                f"{label}: certificate note differs",
            )
            if exp.certificate_note:
                self.ck(
                    out.certificate_note_key == f"certificate_note.{sc.policy.value}",
                    f"{label}: certificate note key",
                )
            self.ck(out.synthetic == self.state.synthetic, f"{label}: synthetic flag")
            self._leak_scan(v, exp, out.model_dump_json())
        raised = svc.escalation_count() - queue_before
        self.ck(
            raised == (1 if exp is not None and exp.escalation else 0),
            f"{label}: escalation raised {raised} times, model expected "
            f"{1 if exp is not None and exp.escalation else 0}",
        )
        self.counts.escalations += raised
        self.ck(
            sum(1 for e in svc.audit_events() if e.action == "disclose") == audits_before + 1,
            f"{label}: the decision was not audited exactly once",
        )

    def _leak_scan(self, v: Viewer, exp: object, dump: str) -> None:
        # `exp` is reference_model.Expected; typed loosely to keep the import list short.

        assert isinstance(exp, Expected)
        findings = (
            {f for r in self.sc.reports for f in r.findings}
            if exp.is_staff_view
            else set(exp.own) | set(exp.partner_findings)
        )
        allowed_labels = {f.variant_label for f in findings}
        allowed_genes = {f.gene for f in findings} | set(exp.gene_names)
        if exp.is_staff_view:
            allowed_genes |= self.unique_genes
        for label in self.labels - allowed_labels:
            self.ck(label not in dump, f"variant label {label} leaked to {v.role.value}")
        for gene in self.unique_genes - allowed_genes:
            self.ck(gene not in dump, f"gene {gene} leaked to {v.role.value}")
        if not exp.is_staff_view:
            self.ck("TRACE_SENTINEL" not in dump, f"trace leaked to {v.role.value}")
        self.ck("rntk_life_threat_override" not in dump, "an escalation id was shown to a viewer")
        self.counts.leak_scans += 1


def run_scenario(
    sc: Scenario, factory: ServiceFactory = default_service_factory
) -> ScenarioOutcome:
    """Drive the service and the reference model through one scenario (stops at the first mismatch)."""
    run = _Run(sc, factory)
    for role, sid in _STAFF:
        if sid == STAFF_C and not sc.register_c:
            continue
        run.svc.register_staff(Principal(role=role, subject_id=sid))
        run.state.registered_staff.add(sid)
    return run.run()


# --------------------------------------------------------------------------------------------
# Mutants
# --------------------------------------------------------------------------------------------

Decide = Callable[[DisclosureInputs], DisclosureOutcome]


def _leak_partner_findings(inner: Decide) -> Decide:
    def mutant(inp: DisclosureInputs) -> DisclosureOutcome:
        out = inner(inp)
        if out.disclosure.viewer_role is Role.COUPLE_MEMBER and out.disclosure.category is not None:
            mine = out.disclosure.viewer_person_id
            leaked = tuple(f for r in inp.reports if r.person_id != mine for f in r.findings)
            out = dataclasses.replace(
                out,
                disclosure=out.disclosure.model_copy(
                    update={
                        "partner_findings": leaked,
                        "partner_finding_scope": "full_variant_detail",
                    }
                ),
            )
        return out

    return mutant


def _leak_trace_to_members(inner: Decide) -> Decide:
    def mutant(inp: DisclosureInputs) -> DisclosureOutcome:
        out = inner(inp)
        if out.disclosure.viewer_role is Role.COUPLE_MEMBER:
            out = dataclasses.replace(
                out, disclosure=out.disclosure.model_copy(update={"staff_trace": inp.result.trace})
            )
        return out

    return mutant


def _ignore_rntk(inner: Decide) -> Decide:
    return lambda inp: inner(dataclasses.replace(inp, rntk_persons=frozenset()))


def _staff_without_assignment(inner: Decide) -> Decide:
    return lambda inp: inner(
        dataclasses.replace(inp, assigned_staff=inp.assigned_staff | {inp.principal.subject_id})
    )


def _programme_sees_results(inner: Decide) -> Decide:
    def mutant(inp: DisclosureInputs) -> DisclosureOutcome:
        if inp.principal.role is Role.PROGRAMME:
            as_staff = Principal(role=Role.COUNSELLOR, subject_id=inp.principal.subject_id)
            inp = dataclasses.replace(
                inp, principal=as_staff, assigned_staff=inp.assigned_staff | {as_staff.subject_id}
            )
        return inner(inp)

    return mutant


def _judge_ignores_synthetic_flag(inner: Decide) -> Decide:
    return lambda inp: inner(dataclasses.replace(inp, synthetic=True))


def _skip_consent_gate(inner: Decide) -> Decide:
    """Pretend every partner has always granted the couple-result scope."""

    def mutant(inp: DisclosureInputs) -> DisclosureOutcome:
        always = tuple(
            ConsentRecord(
                consent_id=f"mutant-{r.person_id}",
                couple_id=inp.couple_id,
                subject_person_id=r.person_id,
                recipient=Role.COUPLE_MEMBER.value,
                recipient_kind=RecipientKind.ROLE,
                scope=ConsentScope.COUPLE_RESULT_ONLY,
                purpose="partner_disclosure",
                basis=ConsentBasis.EXPLICIT_CONSENT,
                granted_at=inp.at,
            )
            for r in inp.reports
        )
        return inner(dataclasses.replace(inp, records=inp.records + always))

    return mutant


def _ignore_revocation(inner: Decide) -> Decide:
    return lambda inp: inner(
        dataclasses.replace(
            inp, records=tuple(r.model_copy(update={"revoked_at": None}) for r in inp.records)
        )
    )


def _ignore_expiry(inner: Decide) -> Decide:
    return lambda inp: inner(
        dataclasses.replace(
            inp, records=tuple(r.model_copy(update={"expires_at": None}) for r in inp.records)
        )
    )


class _AssignmentWithoutAuthority(GovernanceService):
    """Mutant: assignment authority removed (anyone may assign anyone)."""

    def _authorise_assignment(self, by: Principal, couple_id: str, staff_subject_id: str) -> None:
        del by, couple_id, staff_subject_id


DISCLOSURE_MUTANTS: Final[dict[str, Callable[[Decide], Decide]]] = {
    "partner_findings_leak": _leak_partner_findings,
    "staff_trace_leak_to_members": _leak_trace_to_members,
    "right_not_to_know_ignored": _ignore_rntk,
    "staff_view_without_assignment": _staff_without_assignment,
    "programme_sees_individual_results": _programme_sees_results,
    "judge_sees_non_synthetic": _judge_ignores_synthetic_flag,
    "consent_gate_skipped": _skip_consent_gate,
    "revocation_ignored": _ignore_revocation,
    "expiry_ignored": _ignore_expiry,
}
ASSIGNMENT_MUTANT: Final = "assignment_authority_removed"
MUTANT_NAMES: Final = (*DISCLOSURE_MUTANTS, ASSIGNMENT_MUTANT)


def mutant_factory(name: str) -> ServiceFactory:
    """A service factory that builds an ISOLATED broken service for the named mutant."""

    def factory(demo_mode: bool) -> tuple[GovernanceService, FixedClock]:
        clock = FixedClock(EVAL_T0)
        settings = Settings(env="dev", demo_mode=demo_mode, session_secret=_EVAL_SECRET)
        if name == ASSIGNMENT_MUTANT:
            return _AssignmentWithoutAuthority(clock, settings), clock
        svc = GovernanceService(clock, settings)
        svc._decide = DISCLOSURE_MUTANTS[name](svc._decide)
        return svc, clock

    return factory


class MutantResult(Frozen):
    name: str
    killed: bool
    sequences_run: int
    first_mismatch: str | None = None


def evaluate_mutants(
    sequences_per_mutant: int = 300, seed: int = DEFAULT_SEED
) -> tuple[MutantResult, ...]:
    """Run every mutant until the checker reports a mismatch or the fixed budget is spent."""
    results: list[MutantResult] = []
    for name in MUTANT_NAMES:
        factory = mutant_factory(name)
        killed, run, first = False, 0, None
        for i in range(sequences_per_mutant):
            run += 1
            outcome = run_scenario(generate_scenario(scenario_rng(seed, i)), factory)
            if outcome.mismatch is not None:
                killed, first = True, outcome.mismatch
                break
        results.append(
            MutantResult(name=name, killed=killed, sequences_run=run, first_mismatch=first)
        )
    return tuple(results)


# --------------------------------------------------------------------------------------------
# The report
# --------------------------------------------------------------------------------------------

CAVEAT: Final = (
    "Random sequences, not exhaustive, and not a proof. The reference model and the service were written "
    "by the same author, so a shared misreading of a rule would pass both; the textual leak scan and the "
    "mutant-kill result are the independent checks. Everything is synthetic."
)


class DisclosurePropertyReport(Frozen):
    seed: int
    sequences: int
    ops: int
    decisions: int
    allowed: int
    denied: int
    withheld: int
    leak_scans: int
    escalations: int
    abnormal_sequences: int
    mismatches: int  # sequences whose behaviour differed from the reference model
    mismatch_examples: tuple[str, ...]
    mutants: tuple[MutantResult, ...]
    mutants_total: int
    mutants_killed: int
    mutant_sequences_budget: int
    runtime_seconds: float
    generator: str = (
        "random.Random, one seed per sequence (the same generator drives the hypothesis tests)"
    )
    reference_model: str = "bayan.governance.reference_model (imports no policy code)"
    caveat: str = CAVEAT


def run_disclosure_property_evaluation(
    n_sequences: int = 2000, seed: int = DEFAULT_SEED, *, mutant_sequences: int = 300
) -> DisclosurePropertyReport:
    """Run `n_sequences` randomised sequences against the reference model, then the mutant check.

    Default budget finishes in well under a minute on a laptop. `mutant_sequences=0` skips the
    mutants. Deterministic for a given seed."""
    start = time.perf_counter()
    total = EvalCounts()
    mismatches = 0
    examples: list[str] = []
    for i in range(n_sequences):
        outcome = run_scenario(generate_scenario(scenario_rng(seed, i)))
        total.add(outcome.counts)
        if outcome.mismatch is not None:
            mismatches += 1
            if len(examples) < 5:
                examples.append(f"sequence {i}: {outcome.mismatch}")
    mutants = evaluate_mutants(mutant_sequences, seed) if mutant_sequences > 0 else ()
    return DisclosurePropertyReport(
        seed=seed,
        sequences=total.sequences,
        ops=total.ops,
        decisions=total.decisions,
        allowed=total.allowed,
        denied=total.denied,
        withheld=total.withheld,
        leak_scans=total.leak_scans,
        escalations=total.escalations,
        abnormal_sequences=total.abnormal_sequences,
        mismatches=mismatches,
        mismatch_examples=tuple(examples),
        mutants=mutants,
        mutants_total=len(mutants),
        mutants_killed=sum(m.killed for m in mutants),
        mutant_sequences_budget=mutant_sequences,
        runtime_seconds=round(time.perf_counter() - start, 3),
    )
