"""Case record, pathway state machine, SLA, referral tasks, KPIs, closure, teach-back."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from bayan.core.clock import FixedClock
from bayan.core.contracts import ResultCategory, Sex
from bayan.core.errors import Conflict, Forbidden, Invalid, NotFound
from bayan.core.types import Emirate, Locale, Principal, Relationship, Role
from bayan.journey.models import (
    ClinicianProforma,
    ClosureAnswers,
    CoupleCase,
    EncounterInput,
    FamilyHistoryItem,
    IdType,
    InformationGiven,
    IntakeInput,
    MemberInput,
    NextStepStatus,
    PathwayEvent,
    PathwayEventKind,
    PlanAction,
    PlanActionKind,
    PreliminaryRisk,
    ResultReference,
    ServiceInterest,
    ServiceInterestValue,
    SlaStatus,
    StepStatus,
    TaskStatus,
    TeachBackRating,
    TeachBackSubmission,
)
from bayan.journey.service import JourneyService, build_journey_service

pytestmark = pytest.mark.unit

START = datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
CLINICIAN = Principal(role=Role.CLINICIAN, subject_id="staff-1")
COUNSELLOR = Principal(role=Role.COUNSELLOR, subject_id="staff-2")


def intake(**overrides: object) -> IntakeInput:
    data: dict[str, object] = {
        "couple_id": "syn-1",
        "members": (
            MemberInput(display_name="Test Person A", sex=Sex.FEMALE, age=27, language=Locale.AR),
            MemberInput(display_name="Test Person B", sex=Sex.MALE, age=30, language=Locale.UR),
        ),
    }
    data.update(overrides)
    return IntakeInput.model_validate(data)


def make() -> tuple[JourneyService, FixedClock]:
    clock = FixedClock(START)
    return build_journey_service(clock), clock


def fire(
    svc: JourneyService,
    couple: str,
    kind: PathwayEventKind,
    actor: Principal = CLINICIAN,
    **kw: object,
):
    return svc.advance(couple, PathwayEvent.model_validate({"kind": kind, **kw}), actor)


def to_result(
    svc: JourneyService,
    clock: FixedClock,
    couple: str,
    category: ResultCategory,
    per_100: int | None = 25,
) -> None:
    fire(svc, couple, PathwayEventKind.CONSULT_COMPLETED)
    clock.advance(minutes=15)
    fire(svc, couple, PathwayEventKind.SAMPLE_COLLECTED)
    clock.advance(hours=3)
    fire(svc, couple, PathwayEventKind.LAB_STARTED)
    clock.advance(days=12)
    fire(svc, couple, PathwayEventKind.JOINT_REPORT_READY)
    clock.advance(days=1)
    fire(
        svc,
        couple,
        PathwayEventKind.RESULT_COMMUNICATED,
        result=ResultReference(category=category, affected_per_100=per_100),
    )


# ------------------------------------------------------------------------------ intake
def test_create_case_stores_settings_not_identifiers() -> None:
    svc, _ = make()
    case = svc.create_case(
        intake(
            id_type=IdType.CNIC,
            relationship=Relationship.FIRST_COUSIN,
            emirate_policy=Emirate.DUBAI,
        )
    )
    assert case.id_type is IdType.CNIC
    assert case.synthetic is True
    assert case.state == "registered"
    assert case.relationship is Relationship.FIRST_COUSIN
    assert [m.person_id for m in case.members] == ["syn-1-p1", "syn-1-p2"]
    assert not any("number" in name for name in CoupleCase.model_fields)
    with pytest.raises(ValidationError):
        IntakeInput.model_validate(
            {**intake().model_dump(), "emirates_id_number": "784-0000-0000000-0"}
        )
    with pytest.raises(ValidationError):
        intake(synthetic=False)


def test_family_history_is_a_controlled_list() -> None:
    with pytest.raises(ValidationError):
        MemberInput.model_validate(
            {
                "display_name": "Test Person",
                "sex": "female",
                "age": 30,
                "family_history": ["my uncle had x"],
            }
        )
    with pytest.raises(ValidationError):
        MemberInput(
            display_name="T",
            sex=Sex.MALE,
            age=30,
            family_history=(FamilyHistoryItem.NONE_DECLARED, FamilyHistoryItem.THALASSAEMIA),
        )
    ok = MemberInput(
        display_name="T", sex=Sex.MALE, age=30, family_history=(FamilyHistoryItem.THALASSAEMIA,) * 2
    )
    assert ok.family_history == (FamilyHistoryItem.THALASSAEMIA,)


def test_duplicate_and_missing_cases() -> None:
    svc, _ = make()
    svc.create_case(intake())
    with pytest.raises(Conflict):
        svc.create_case(intake())
    with pytest.raises(NotFound):
        svc.get_case("nope")
    assert len(svc.list_cases()) == 1


def test_preliminary_risk_is_off_by_default_and_returns_nothing() -> None:
    svc, _ = make()
    svc.create_case(intake())
    assert svc.preliminary_risk("syn-1") is None
    svc.create_case(intake(couple_id="syn-2", preliminary_risk_opt_in=True))
    assert svc.preliminary_risk("syn-2") == PreliminaryRisk(available=False)


def test_preliminary_risk_provider_is_only_called_on_opt_in() -> None:
    calls: list[str] = []

    def provider(case: CoupleCase) -> PreliminaryRisk:
        calls.append(case.couple_id)
        return PreliminaryRisk(available=True, per_100=5, illustrative=True, source="test provider")

    svc = JourneyService(FixedClock(START), preliminary_risk_provider=provider)
    svc.create_case(intake())
    svc.create_case(intake(couple_id="syn-2", preliminary_risk_opt_in=True))
    assert svc.preliminary_risk("syn-1") is None
    assert calls == []
    risk = svc.preliminary_risk("syn-2")
    assert risk is not None
    assert risk.per_100 == 5
    assert calls == ["syn-2"]


def test_store_reports_rejects_strangers() -> None:
    from bayan.core.contracts import PersonReport

    svc, _ = make()
    svc.create_case(intake())
    svc.store_reports("syn-1", [PersonReport(person_id="syn-1-p1", sex=Sex.FEMALE, panel_id="x")])
    assert len(svc.reports("syn-1")) == 1
    with pytest.raises(Invalid):
        svc.store_reports("syn-1", [PersonReport(person_id="stranger", sex=Sex.MALE, panel_id="x")])


# ------------------------------------------------------------------------------ pathway
def test_happy_path_for_a_shared_result_with_referral_and_closure() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND)
    case = svc.get_case("syn-1")
    assert case.state == "counselling_pending"
    assert case.flagged is True
    tasks = svc.referral_tasks("syn-1")
    assert len(tasks) == 1
    assert tasks[0].status is TaskStatus.REQUESTED
    assert tasks[0].simulated is True
    assert tasks[0].resource_type == "Task"
    assert tasks[0].for_reference == "Couple/syn-1"
    clock.advance(days=3)
    fire(svc, "syn-1", PathwayEventKind.BRIEF_GENERATED, COUNSELLOR)
    fire(svc, "syn-1", PathwayEventKind.COUNSELLING_BOOKED, COUNSELLOR)
    clock.advance(days=2)
    fire(svc, "syn-1", PathwayEventKind.COUNSELLING_COMPLETED, COUNSELLOR)
    fire(svc, "syn-1", PathwayEventKind.DECLARATION_SIGNED)
    fire(svc, "syn-1", PathwayEventKind.CERTIFICATE_ISSUED)
    fire(svc, "syn-1", PathwayEventKind.JUDICIAL_HANDOFF_SENT)
    with pytest.raises(Conflict):  # flagged: needs the proforma first
        fire(svc, "syn-1", PathwayEventKind.CASE_CLOSED)
    svc.submit_clinician_proforma("syn-1", proforma(), CLINICIAN)
    view = fire(svc, "syn-1", PathwayEventKind.CASE_CLOSED)
    assert view.state == "closed"
    assert view.next_actions == ()
    task = svc.referral_tasks("syn-1")[0]
    assert task.status is TaskStatus.COMPLETED
    m = task.milestones
    assert m.t2_brief_generated
    assert m.t3_booked
    assert m.t5_completed
    assert m.t0_risk_signal == m.t1_authored
    assert svc.invariant_problems("syn-1") == []


def test_unflagged_result_creates_no_task_and_skips_counselling_steps() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.NO_SHARED_CHANGE_FOUND, None)
    view = svc.pathway("syn-1")
    assert view.state == "result_clear"
    assert svc.referral_tasks("syn-1") == ()
    by_id = {s.id: s for s in view.steps}
    assert by_id["counselling_booked"].status is StepStatus.NOT_APPLICABLE
    assert by_id["declaration_signed"].status is StepStatus.CURRENT
    assert view.kpi.counselling == "not_indicated"


def test_every_external_system_is_labelled_simulated_in_every_language() -> None:
    svc, _ = make()
    svc.create_case(intake())
    words = {Locale.EN: "simulated", Locale.AR: "محاكاة", Locale.UR: "سمولیٹڈ"}
    for locale in Locale:
        view = svc.pathway("syn-1", locale)
        systems = [s.external_system for s in view.steps if s.external_system]
        assert systems
        assert all(s.simulated for s in view.steps if s.external_system)
        assert all(words[locale] in (s or "").lower() for s in systems), locale
        assert view.simulated
        assert view.synthetic
        assert view.language_status == "draft"


def test_illegal_transitions_and_roles_are_refused_without_side_effects() -> None:
    svc, clock = make()
    svc.create_case(intake())
    with pytest.raises(Conflict):
        fire(svc, "syn-1", PathwayEventKind.SAMPLE_COLLECTED)  # before the consult
    for role in (Role.JUDGE, Role.EXTERNAL):
        with pytest.raises(Forbidden):
            fire(
                svc,
                "syn-1",
                PathwayEventKind.CONSULT_COMPLETED,
                Principal(role=role, subject_id="x"),
            )
    stranger = Principal(role=Role.COUPLE_MEMBER, subject_id="x", couple_id="other")
    with pytest.raises(Forbidden):
        fire(svc, "syn-1", PathwayEventKind.COUNSELLING_BOOKED, stranger)
    with pytest.raises(ValidationError):
        PathwayEvent(kind=PathwayEventKind.RESULT_COMMUNICATED)
    clock.advance(minutes=1)
    assert svc.get_case("syn-1").state == "registered"


def test_failed_event_rolls_back_task_changes() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.MORE_INFORMATION_NEEDED, None)
    fire(svc, "syn-1", PathwayEventKind.COUNSELLING_BOOKED, COUNSELLOR)
    fire(svc, "syn-1", PathwayEventKind.COUNSELLING_COMPLETED, COUNSELLOR)
    before = svc.referral_tasks("syn-1")
    with pytest.raises(Conflict):
        fire(
            svc, "syn-1", PathwayEventKind.CONFIRMATORY_TEST_RESULTED, COUNSELLOR
        )  # nothing ordered
    assert svc.referral_tasks("syn-1") == before


def test_missed_rejected_and_declined_referrals_are_never_lost() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND)
    fire(svc, "syn-1", PathwayEventKind.COUNSELLING_BOOKED, COUNSELLOR)
    fire(svc, "syn-1", PathwayEventKind.COUNSELLING_MISSED, COUNSELLOR)
    first = svc.referral_tasks("syn-1")[0]
    assert first.status is TaskStatus.ON_HOLD
    assert first.status_reason is not None
    fire(svc, "syn-1", PathwayEventKind.REFERRAL_REJECTED, COUNSELLOR)
    tasks = svc.referral_tasks("syn-1")
    assert [t.status for t in tasks] == [
        TaskStatus.FAILED,
        TaskStatus.REQUESTED,
    ]  # on hold means attempted
    assert tasks[1].replaces == tasks[0].id
    assert tasks[0].status_reason is not None
    member = Principal(role=Role.COUPLE_MEMBER, subject_id="syn-1-p1", couple_id="syn-1")
    view = fire(svc, "syn-1", PathwayEventKind.COUNSELLING_DECLINED, member)
    assert view.state == "counselling_declined"
    assert view.open_referral_tasks == 0
    declined = svc.referral_tasks("syn-1")[1]
    assert declined.status is TaskStatus.CANCELLED
    assert declined.status_reason is not None
    assert svc.invariant_problems("syn-1") == []


def test_rejection_before_any_action_is_rejected_and_replaced() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND)
    fire(
        svc,
        "syn-1",
        PathwayEventKind.REFERRAL_REJECTED,
        COUNSELLOR,
        status_reason="wrong_destination",
    )
    tasks = svc.referral_tasks("syn-1")
    assert [t.status for t in tasks] == [TaskStatus.REJECTED, TaskStatus.REQUESTED]
    assert tasks[0].status_reason is not None
    assert tasks[0].status_reason.value == "wrong_destination"
    assert (
        tasks[1].milestones.t0_risk_signal == tasks[0].milestones.t0_risk_signal
    )  # the clock keeps running
    assert svc.invariant_problems("syn-1") == []


def test_certificate_withheld_branch_is_a_labelled_tension_not_a_dead_end() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.NO_SHARED_CHANGE_FOUND, None)
    member = Principal(role=Role.COUPLE_MEMBER, subject_id="syn-1-p1", couple_id="syn-1")
    view = fire(svc, "syn-1", PathwayEventKind.PARTNER_DECLINED_TO_SHARE, member)
    assert view.state == "certificate_withheld"
    assert {s.id: s.status for s in view.steps}["certificate_issued"] is StepStatus.BLOCKED
    assert fire(svc, "syn-1", PathwayEventKind.DECLARATION_SIGNED).state == "declaration_signed"


def test_certificate_is_valid_three_calendar_months_then_expires() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.NO_SHARED_CHANGE_FOUND, None)
    fire(svc, "syn-1", PathwayEventKind.DECLARATION_SIGNED)
    fire(svc, "syn-1", PathwayEventKind.CERTIFICATE_ISSUED)
    cert = svc.pathway("syn-1").certificate
    assert cert is not None
    assert cert.valid_until.month == (cert.issued_at.month + 3 - 1) % 12 + 1
    assert not cert.expired
    clock.advance(days=100)
    view = svc.pathway("syn-1")
    assert view.certificate is not None
    assert view.certificate.expired
    by_id = {s.id: s for s in view.steps}
    assert by_id["certificate_issued"].timer is not None
    assert by_id["certificate_issued"].timer.sla is SlaStatus.BREACHED  # type: ignore[union-attr]


@pytest.mark.parametrize(
    ("policy", "days", "expected"),
    [
        (Emirate.ABU_DHABI, 5, SlaStatus.ON_TIME),
        (Emirate.ABU_DHABI, 17, SlaStatus.AT_RISK),
        (Emirate.ABU_DHABI, 22, SlaStatus.BREACHED),
        (Emirate.DUBAI, 22, SlaStatus.AT_RISK),  # the standards differ: 21 days versus 4 weeks
        (Emirate.DUBAI, 29, SlaStatus.BREACHED),
    ],
)
def test_genetic_result_sla_follows_the_emirate_standard(
    policy: Emirate, days: int, expected: SlaStatus
) -> None:
    svc, clock = make()
    svc.create_case(intake(emirate_policy=policy))
    fire(svc, "syn-1", PathwayEventKind.CONSULT_COMPLETED)
    fire(svc, "syn-1", PathwayEventKind.SAMPLE_COLLECTED)
    fire(svc, "syn-1", PathwayEventKind.LAB_STARTED)
    clock.advance(days=days)
    step = {s.id: s for s in svc.pathway("syn-1").steps}["joint_report_ready"]
    assert step.timer is not None
    assert step.timer.sla is expected
    assert not step.timer.illustrative


def test_lab_start_standard_is_24_hours_and_finished_timers_are_on_time_or_breached() -> None:
    svc, clock = make()
    svc.create_case(intake())
    fire(svc, "syn-1", PathwayEventKind.CONSULT_COMPLETED)
    fire(svc, "syn-1", PathwayEventKind.SAMPLE_COLLECTED)
    clock.advance(hours=20)
    timer = {s.id: s for s in svc.pathway("syn-1").steps}["lab_started"].timer
    assert timer is not None
    assert timer.standard_hours == 24
    assert timer.sla is SlaStatus.AT_RISK
    clock.advance(hours=5)
    fire(svc, "syn-1", PathwayEventKind.LAB_STARTED)
    done = {s.id: s for s in svc.pathway("syn-1").steps}["lab_started"].timer
    assert done is not None
    assert done.sla is SlaStatus.BREACHED


def test_referral_timer_is_labelled_illustrative() -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND)
    timer = {s.id: s for s in svc.pathway("syn-1").steps}["counselling_booked"].timer
    assert timer is not None
    assert timer.illustrative
    assert timer.illustrative_notice
    assert svc.kpis().referral_standard_is_illustrative is True


# ------------------------------------------------------------------------------ KPIs
def test_kpis_are_computed_from_cases_and_empty_is_none() -> None:
    svc, clock = make()
    empty = svc.kpis()
    assert empty.n_cases == 0
    assert empty.share_referred is None
    assert empty.meets_referral_target is None
    assert empty.time_to_result.median_hours is None
    assert empty.time_to_referral.n == 0
    for i, book in enumerate((True, True, False)):
        cid = f"k{i}"
        svc.create_case(intake(couple_id=cid))
        to_result(svc, clock, cid, ResultCategory.SHARED_RESULT_FOUND)
        if book:
            clock.advance(days=2 + i * 20)
            fire(svc, cid, PathwayEventKind.COUNSELLING_BOOKED, COUNSELLOR)
    svc.create_case(intake(couple_id="clear"))
    to_result(svc, clock, "clear", ResultCategory.NO_SHARED_CHANGE_FOUND, None)
    kpi = svc.kpis()
    assert (kpi.n_cases, kpi.n_flagged, kpi.counselling_booked) == (4, 3, 2)
    assert kpi.share_referred == pytest.approx(2 / 3, abs=1e-3)
    assert kpi.meets_referral_target is False
    assert kpi.share_referred_within_standard == pytest.approx(1 / 3, abs=1e-3)
    assert kpi.time_to_result.n == 4
    assert kpi.time_to_result.median_hours == pytest.approx(12 * 24 + 3, abs=0.01)
    assert kpi.time_to_referral.n == 2
    assert kpi.time_to_referral.median_hours is not None
    assert kpi.open_tasks == 3
    assert kpi.stale_tasks == 1
    assert kpi.referral_target_share == 0.9
    clock.advance(days=45)
    assert svc.kpis().stale_tasks == 3


# ------------------------------------------------------------------------------ closure
def proforma(**overrides: object) -> ClinicianProforma:
    data: dict[str, object] = {
        "encounter": EncounterInput(
            mode="virtual", duration_minutes=30, session_language=Locale.UR, interpreter_used=False
        ),
        "information_given": InformationGiven(carrier_vs_disease=True, test_limits=True),
        "next_step_status": NextStepStatus.STILL_DECIDING,
        "teach_back_done": True,
        "teach_back_result": TeachBackRating.ACCURATE,
        "patient_questions_invited": True,
        "patient_questions_answered": True,
        "plan": (
            PlanAction(
                action=PlanActionKind.RECONTACT,
                owner_role=Role.COUNSELLOR,
                due_date=date(2026, 12, 1),
            ),
        ),
    }
    data.update(overrides)
    return ClinicianProforma.model_validate(data)


def test_clinician_proforma_has_no_marriage_field_and_validates_types() -> None:
    assert not any("marri" in name or "proceed" in name for name in ClinicianProforma.model_fields)
    with pytest.raises(ValidationError):
        proforma(marriage_decision="proceed")
    with pytest.raises(ValidationError):
        proforma(teach_back_result=None)  # done, but no result recorded
    with pytest.raises(ValidationError):
        proforma(patient_questions_answered=None)
    with pytest.raises(ValidationError):
        proforma(plan=({"action": "recontact", "owner_role": "counsellor"},))


def test_proforma_is_assembled_with_system_fields_and_needs_a_clinical_role() -> None:
    svc, clock = make()
    svc.create_case(intake())
    with pytest.raises(Conflict):
        svc.submit_clinician_proforma("syn-1", proforma(), CLINICIAN)  # result not explained yet
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND)
    with pytest.raises(Forbidden):
        svc.submit_clinician_proforma(
            "syn-1", proforma(), Principal(role=Role.JUDGE, subject_id="j")
        )
    record = svc.submit_clinician_proforma("syn-1", proforma(), COUNSELLOR)
    assert record.clinician is not None
    assert record.kind == "clinician"
    assert record.clinician.risk_signal_at is not None
    assert record.clinician.completed_by_role == "counsellor"
    assert record.clinician.referral_task_ids == (svc.referral_tasks("syn-1")[0].id,)


def test_closure_schema_has_12_fields_8_items_and_no_marriage_item() -> None:
    svc, _ = make()
    for locale in Locale:
        schema = svc.closure_schema(locale)
        assert [f.no for f in schema.clinician_fields] == list(range(1, 13))
        assert len(schema.patient_items) == 8
        assert schema.marriage_decision_field is False
        assert schema.human_comprehension_test_run is False
        assert schema.language_status == "draft"
        assert "marri" not in " ".join(i.id for i in schema.patient_items)
        assert {f.id for f in schema.clinician_fields} >= {
            "encounter",
            "plan",
            "referral_task",
            "service_preference",
        }
    assert "{denominator}" not in svc.closure_schema(Locale.EN).patient_items[1].prompt
    assert "100" in svc.closure_schema(Locale.EN).patient_items[1].prompt


def test_patient_items_are_scored_item_level_only() -> None:
    svc, clock = make()
    svc.create_case(intake())
    with pytest.raises(Conflict):
        svc.submit_patient_closure("syn-1", "syn-1-p1", ClosureAnswers())
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND, per_100=25)
    answers = ClosureAnswers.model_validate(
        {
            "out_of_100": 28,
            "carrier_is_disease": "false",
            "negative_means_none": "not_sure",
            "values_clarity": 4,
            "own_words": "synthetic words",
            "sils": "often",
        }
    )
    record = svc.submit_patient_closure("syn-1", "syn-1-p1", answers)
    assert record.patient is not None
    outcomes = {i.item_id: i.outcome for i in record.patient.items}
    assert outcomes["out_of_100"] == "correct"
    assert outcomes["carrier_is_disease"] == "correct"
    assert outcomes["negative_means_none"] == "not_sure"
    assert outcomes["felt_free"] == "not_answered"
    assert outcomes["own_words"] == "not_scored"
    assert record.patient.sils_positive_screen is True
    wrong = svc.submit_patient_closure(
        "syn-1", "syn-1-p2", ClosureAnswers(out_of_100=60, carrier_is_disease="true")
    )  # type: ignore[arg-type]
    assert {i.item_id: i.outcome for i in wrong.patient.items}["out_of_100"] == "incorrect"  # type: ignore[union-attr]
    assert not any("score" in f or "total" in f for f in type(record.patient).model_fields)
    with pytest.raises(NotFound):
        svc.submit_patient_closure("syn-1", "someone-else", answers)
    with pytest.raises(ValidationError):
        ClosureAnswers(out_of_100=101)
    with pytest.raises(ValidationError):
        ClosureAnswers(values_clarity=6)


def test_service_interest_is_opt_in_validated_and_private() -> None:
    with pytest.raises(ValidationError):
        ServiceInterest(value=ServiceInterestValue.YES_NOW)  # consent text not acknowledged
    with pytest.raises(ValidationError):
        ServiceInterest(
            value=ServiceInterestValue.YES_LATER, consent_acknowledged=True
        )  # needs a reminder
    with pytest.raises(ValidationError):
        ServiceInterest(value=ServiceInterestValue.NO_THANKS, topics=("preconception_counselling",))  # type: ignore[arg-type]
    ServiceInterest(
        value=ServiceInterestValue.YES_LATER, consent_acknowledged=True, reminder_months=6
    )
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", ResultCategory.NO_SHARED_CHANGE_FOUND, None)
    svc.submit_patient_closure(
        "syn-1",
        "syn-1-p1",
        ClosureAnswers(
            service_interest=ServiceInterest(
                value=ServiceInterestValue.YES_NOW, consent_acknowledged=True
            )
        ),
    )
    record = svc.submit_clinician_proforma("syn-1", proforma(), CLINICIAN)
    assert record.clinician is not None
    assert record.clinician.service_preference_answered_by == (
        "syn-1-p1",
    )  # who answered, never what
    text = record.model_dump_json()
    assert "yes_now" not in text


# ------------------------------------------------------------------------------ teach-back
def test_teachback_is_five_items_per_result_type_locale_aware_and_deterministic() -> None:
    svc, clock = make()
    svc.create_case(intake())
    with pytest.raises(Conflict):
        svc.teachback("syn-1")
    to_result(svc, clock, "syn-1", ResultCategory.SHARED_RESULT_FOUND)
    for locale in Locale:
        quiz = svc.teachback("syn-1", locale)
        assert len(quiz.items) == 5
        assert quiz.language_status == "draft"
        assert quiz.human_comprehension_test_run is False
        assert "within-subject" in quiz.design_note
        assert "correct" not in quiz.model_dump_json()
    quiz_en = svc.teachback("syn-1", Locale.EN)
    assert quiz_en.items[0].prompt != svc.teachback("syn-1", Locale.AR).items[0].prompt
    key = {"sr1": "a", "sr2": "false", "sr3": "a", "sr4": "b", "sr5": "a"}
    full = svc.submit_teachback("syn-1", TeachBackSubmission(locale=Locale.EN, answers=key))
    assert full.correct_count == 5
    assert all(i.explanation for i in full.items)
    half = svc.submit_teachback(
        "syn-1", TeachBackSubmission(locale=Locale.UR, answers={"sr1": "a", "sr2": "true"})
    )
    assert half.correct_count == 1
    assert half.item_count == 5
    assert half == svc.submit_teachback(
        "syn-1", TeachBackSubmission(locale=Locale.UR, answers={"sr1": "a", "sr2": "true"})
    )
    with pytest.raises(Invalid):
        svc.submit_teachback("syn-1", TeachBackSubmission(locale=Locale.EN, answers={"ns1": "a"}))
    with pytest.raises(Invalid):
        svc.submit_teachback("syn-1", TeachBackSubmission(locale=Locale.EN, answers={"sr1": "z"}))


@pytest.mark.parametrize(
    ("category", "ids"),
    [
        (ResultCategory.NO_SHARED_CHANGE_FOUND, ["ns1", "ns2", "ns3", "ns4", "ns5"]),
        (ResultCategory.MORE_INFORMATION_NEEDED, ["mi1", "mi2", "mi3", "mi4", "mi5"]),
    ],
)
def test_teachback_other_result_types(category: ResultCategory, ids: list[str]) -> None:
    svc, clock = make()
    svc.create_case(intake())
    to_result(svc, clock, "syn-1", category, None)
    assert [i.id for i in svc.teachback("syn-1").items] == ids
