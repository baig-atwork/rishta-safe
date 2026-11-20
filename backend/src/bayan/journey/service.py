"""JourneyService: case record, pathway, referral tasks, closure and teach-back (spec section 3.1)."""

from __future__ import annotations

import uuid
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Protocol

from bayan.core.clock import Clock
from bayan.core.contracts import PersonReport, ResultCategory
from bayan.core.errors import Conflict, Forbidden, Invalid, NotFound
from bayan.core.types import Locale, Principal, Role
from bayan.journey.closure import build_quiz, build_schema, grade_quiz, score_patient
from bayan.journey.config import PathwayConfig, load_pathway
from bayan.journey.kpis import compute_kpis
from bayan.journey.machine import apply_event, invariant_problems, is_stale
from bayan.journey.models import (
    ClinicianProforma,
    ClinicianRecord,
    ClosureAnswers,
    ClosureRecord,
    ClosureSchema,
    CoupleCase,
    IntakeInput,
    Member,
    PathwayEvent,
    PathwayView,
    PreliminaryRisk,
    ProgrammeKpis,
    ReferralTask,
    TaskMilestones,
    TeachBackQuiz,
    TeachBackResult,
    TeachBackSubmission,
)
from bayan.journey.store import CaseRecord, CaseRepository, EventRecord, TaskRecord
from bayan.journey.view import build_view

_CLINICAL_ROLES = frozenset({Role.CLINICIAN, Role.COUNSELLOR})
_EARLY_STATES = frozenset(
    {"registered", "consult_done", "sample_collected", "lab_in_progress", "report_ready"}
)


class PreliminaryRiskProvider(Protocol):
    """Source of an opt-in pre-test estimate (composition may wire the genetics engine in).

    Off by default (spec section 2 rule 6). Without a provider the opt-in returns "not available".
    """

    def __call__(self, case: CoupleCase) -> PreliminaryRisk: ...


class JourneyService:
    def __init__(
        self,
        clock: Clock,
        config: PathwayConfig | None = None,
        *,
        preliminary_risk_provider: PreliminaryRiskProvider | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._clock = clock
        self._config = config or load_pathway()
        self._repo = CaseRepository()
        self._provider = preliminary_risk_provider
        self._new_id = id_factory or (lambda: f"cpl-{uuid.uuid4().hex[:10]}")

    # ------------------------------------------------------------------------------ cases
    def create_case(self, intake: IntakeInput) -> CoupleCase:
        couple_id = intake.couple_id or self._new_id()
        if self._repo.exists(couple_id):
            raise Conflict(f"Case {couple_id!r} already exists.", couple_id=couple_id)
        now = self._clock.now()
        members = tuple(
            Member(
                person_id=m.person_id or f"{couple_id}-p{i + 1}",
                display_name=m.display_name,
                sex=m.sex,
                age=m.age,
                language=m.language,
                family_history=m.family_history,
            )
            for i, m in enumerate(intake.members)
        )
        case = CaseRecord(
            couple_id=couple_id,
            created_at=now,
            members=(members[0], members[1]),
            relationship=intake.relationship,
            emirate_policy=intake.emirate_policy,
            id_type=intake.id_type,
            preliminary_risk_opt_in=intake.preliminary_risk_opt_in,
            state=self._config.initial_state,
        )
        case.events.append(EventRecord("registered", now, Role.COUPLE_MEMBER.value, couple_id))
        self._repo.add(case)
        return self._snapshot(case)

    def get_case(self, couple_id: str) -> CoupleCase:
        return self._snapshot(self._repo.get(couple_id))

    def list_cases(self) -> tuple[CoupleCase, ...]:
        return tuple(self._snapshot(c) for c in self._repo.all())

    def preliminary_risk(self, couple_id: str) -> PreliminaryRisk | None:
        """None when the couple did not opt in (nothing is computed). Otherwise provider output or 'not available'."""
        case = self.get_case(couple_id)
        if not case.preliminary_risk_opt_in:
            return None
        if self._provider is None:
            return PreliminaryRisk(available=False)
        return self._provider(case)

    def _snapshot(self, case: CaseRecord) -> CoupleCase:
        return CoupleCase(
            couple_id=case.couple_id,
            created_at=case.created_at,
            members=case.members,
            relationship=case.relationship,
            emirate_policy=case.emirate_policy,
            id_type=case.id_type,
            preliminary_risk_opt_in=case.preliminary_risk_opt_in,
            state=case.state,
            result_category=case.result_category,
            flagged=case.flagged,
            closed=case.closed,
        )

    # ------------------------------------------------------------------------------ reports
    def store_reports(self, couple_id: str, reports: Sequence[PersonReport]) -> None:
        case = self._repo.get(couple_id)
        member_ids = {m.person_id for m in case.members}
        by_person: dict[str, PersonReport] = {}
        for report in reports:
            if report.person_id not in member_ids:
                raise Invalid(
                    f"Report for {report.person_id!r}, who is not a member of this couple."
                )
            by_person[report.person_id] = report
        case.reports = tuple(by_person.values())

    def reports(self, couple_id: str) -> tuple[PersonReport, ...]:
        return self._repo.get(couple_id).reports

    # ------------------------------------------------------------------------------ pathway
    def pathway(self, couple_id: str, locale: Locale = Locale.EN) -> PathwayView:
        case = self._repo.get(couple_id)
        return build_view(self._config, case, self._clock.now(), locale)

    def advance(
        self, couple_id: str, event: PathwayEvent, actor: Principal, locale: Locale = Locale.EN
    ) -> PathwayView:
        case = self._repo.get(couple_id)
        apply_event(self._config, case, event, actor, self._clock.now())
        return build_view(self._config, case, self._clock.now(), locale)

    def referral_tasks(self, couple_id: str) -> tuple[ReferralTask, ...]:
        case = self._repo.get(couple_id)
        now = self._clock.now()
        return tuple(self._task_view(case, t, now) for t in case.tasks)

    def _task_view(self, case: CaseRecord, task: TaskRecord, now: datetime) -> ReferralTask:
        return ReferralTask(
            id=task.id,
            status=task.status,
            status_reason=task.status_reason,
            priority="urgent" if task.priority == "urgent" else "routine",
            code=task.code,
            for_reference=f"Couple/{case.couple_id}",
            authored_on=task.authored_on,
            last_modified=task.last_modified,
            requester_role=task.requester_role,
            owner_role=task.owner_role,
            milestones=TaskMilestones(
                t0_risk_signal=task.t0,
                t1_authored=task.t1,
                t2_brief_generated=task.t2,
                t3_booked=task.t3,
                t4_attended=task.t4,
                t5_completed=task.t5,
            ),
            replaces=task.replaces,
            stale=is_stale(self._config, task, now),
            history=tuple(task.history),
        )

    def invariant_problems(self, couple_id: str) -> list[str]:
        """Every journey invariant for one case (empty list means all hold). Used by the property tests."""
        return invariant_problems(self._config, self._repo.get(couple_id), self._clock.now())

    # ------------------------------------------------------------------------------ closure
    def closure_schema(self, locale: Locale = Locale.EN) -> ClosureSchema:
        return build_schema(locale)

    def _require_result(self, case: CaseRecord) -> None:
        if case.state in _EARLY_STATES:
            raise Conflict("Closure opens after the result has been explained.", state=case.state)

    @staticmethod
    def _own_case_only(
        case: CaseRecord, actor: Principal | None, person_id: str | None = None
    ) -> None:
        """Defence in depth: a couple member acts only on their own case, and answers only for themselves."""
        if actor is None or actor.role is not Role.COUPLE_MEMBER:
            return
        if actor.couple_id != case.couple_id:
            raise Forbidden("A couple member can only act on their own case.")
        if person_id is not None and actor.subject_id != person_id:
            raise Forbidden("A person answers only for themselves.")

    def submit_patient_closure(
        self,
        couple_id: str,
        person_id: str,
        answers: ClosureAnswers,
        actor: Principal | None = None,
    ) -> ClosureRecord:
        case = self._repo.get(couple_id)
        self._own_case_only(case, actor, person_id)
        if person_id not in {m.person_id for m in case.members}:
            raise NotFound(f"{person_id!r} is not a member of this couple.")
        self._require_result(case)
        expected = case.result.affected_per_100 if case.result else None
        patient = score_patient(person_id, answers, expected)
        record = ClosureRecord(
            record_id=case.next_id("closure"),
            couple_id=couple_id,
            kind="patient",
            submitted_at=self._clock.now(),
            patient=patient,
        )
        case.patient_closures[person_id] = record
        return record

    def submit_clinician_proforma(
        self, couple_id: str, proforma: ClinicianProforma, actor: Principal
    ) -> ClosureRecord:
        case = self._repo.get(couple_id)
        self._own_case_only(case, actor)
        if actor.role not in _CLINICAL_ROLES:
            raise Forbidden(f"Role {actor.role.value} may not submit the clinician proforma.")
        self._require_result(case)
        now = self._clock.now()
        record = ClosureRecord(
            record_id=case.next_id("closure"),
            couple_id=couple_id,
            kind="clinician",
            submitted_at=now,
            clinician=ClinicianRecord(
                proforma=proforma,
                risk_signal_at=case.first_at("result_communicated"),
                referral_task_ids=tuple(t.id for t in case.tasks),
                service_preference_answered_by=tuple(
                    pid
                    for pid, r in case.patient_closures.items()
                    if r.patient and r.patient.service_interest
                ),
                completed_by_role=actor.role.value,
                completed_by_id=actor.subject_id,
            ),
        )
        case.clinician_records.append(record)
        return record

    def closure_records(self, couple_id: str) -> tuple[ClosureRecord, ...]:
        case = self._repo.get(couple_id)
        return (*case.patient_closures.values(), *case.clinician_records)

    # ------------------------------------------------------------------------------ teach-back
    def _category(self, case: CaseRecord) -> ResultCategory:
        if case.result_category is None:
            raise Conflict(
                "The teach-back quiz opens after the result has been explained.", state=case.state
            )
        return case.result_category

    def teachback(
        self, couple_id: str, locale: Locale = Locale.EN, actor: Principal | None = None
    ) -> TeachBackQuiz:
        case = self._repo.get(couple_id)
        self._own_case_only(case, actor)
        return build_quiz(couple_id, self._category(case), locale)

    def submit_teachback(
        self, couple_id: str, submission: TeachBackSubmission, actor: Principal | None = None
    ) -> TeachBackResult:
        case = self._repo.get(couple_id)
        self._own_case_only(case, actor)
        result = grade_quiz(couple_id, self._category(case), submission)
        case.teachbacks.append(result)
        return result

    # ------------------------------------------------------------------------------ KPIs
    def kpis(self) -> ProgrammeKpis:
        return compute_kpis(self._config, self._repo.all(), self._clock.now())


def build_journey_service(
    clock: Clock,
    *,
    preliminary_risk_provider: PreliminaryRiskProvider | None = None,
    id_factory: Callable[[], str] | None = None,
) -> JourneyService:
    return JourneyService(
        clock, preliminary_risk_provider=preliminary_risk_provider, id_factory=id_factory
    )
