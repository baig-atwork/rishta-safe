"""Typed models of the couple journey: case record, pathway view, referral tasks, closure, KPIs.

Everything is synthetic. There is no field for a marriage decision, for an identifier number or for
free-typed family history anywhere in this module (ADR 0143, spec section 2 rules 1 and 6).
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from bayan.core.contracts import Frozen, ResultCategory, Sex
from bayan.core.types import Emirate, Locale, Relationship, Role

# ------------------------------------------------------------------------------------------ intake


class IdType(StrEnum):
    """A setting, never a number: no identifier is ever stored (ADR 0002)."""

    EMIRATES_ID = "emirates_id"
    CNIC = "cnic"
    NONE = "none"


class FamilyHistoryItem(StrEnum):
    """Controlled list, so nothing free-typed about a family is stored."""

    BLOOD_DISEASE = "blood_disease_in_family"
    THALASSAEMIA = "thalassaemia_in_family"
    SICKLE_CELL = "sickle_cell_disease_in_family"
    CHILDHOOD_DEATH = "childhood_death_in_family"
    PREVIOUS_CHILD = "previous_child_with_inherited_condition"
    KNOWN_CARRIER = "known_carrier_in_family"
    DEVELOPMENTAL = "developmental_or_neurological_condition_in_family"
    HEARING_VISION = "hearing_or_vision_loss_in_family"
    NONE_DECLARED = "none_declared"


class MemberInput(Frozen):
    """One synthetic partner. The name must be made up."""

    person_id: str | None = Field(default=None, max_length=64)
    display_name: str = Field(min_length=1, max_length=60)
    sex: Sex
    age: int = Field(
        ge=16, le=100
    )  # illustrative input bound; the standards allow under-18 with a guardian
    language: Locale = Locale.EN
    family_history: tuple[FamilyHistoryItem, ...] = ()

    @field_validator("family_history")
    @classmethod
    def _none_declared_stands_alone(
        cls, value: tuple[FamilyHistoryItem, ...]
    ) -> tuple[FamilyHistoryItem, ...]:
        if FamilyHistoryItem.NONE_DECLARED in value and len(set(value)) > 1:
            raise ValueError("none_declared cannot be combined with other family-history items")
        return tuple(dict.fromkeys(value))


class IntakeInput(Frozen):
    """Intake for a couple. `synthetic` must be true: the prototype accepts no real people."""

    couple_id: str | None = Field(default=None, max_length=64)
    members: tuple[MemberInput, MemberInput]
    relationship: Relationship = Relationship.UNRELATED
    emirate_policy: Emirate = Emirate.ABU_DHABI
    id_type: IdType = IdType.EMIRATES_ID
    preliminary_risk_opt_in: bool = (
        False  # OFF by default; when off nothing is computed or returned
    )
    synthetic: Literal[True] = True

    @model_validator(mode="after")
    def _distinct_people(self) -> Self:
        ids = [m.person_id for m in self.members if m.person_id]
        if len(ids) != len(set(ids)):
            raise ValueError("the two members need different person ids")
        return self


class Member(Frozen):
    person_id: str
    display_name: str
    sex: Sex
    age: int
    language: Locale
    family_history: tuple[FamilyHistoryItem, ...] = ()


class CoupleCase(Frozen):
    """The case record. `state` is the pathway state; the event log lives in the service."""

    couple_id: str
    created_at: datetime
    members: tuple[Member, Member]
    relationship: Relationship
    emirate_policy: Emirate
    id_type: IdType
    preliminary_risk_opt_in: bool
    state: str
    result_category: ResultCategory | None = None
    flagged: bool | None = None  # True when the result needs counselling; None before the result
    closed: bool = False
    synthetic: Literal[True] = True


class PreliminaryRisk(Frozen):
    """Opt-in pre-test estimate. `available` is False unless a cited source is wired in."""

    available: bool
    per_100: int | None = Field(default=None, ge=0, le=100)
    illustrative: bool = True
    source: str | None = None


# --------------------------------------------------------------------------------------- pathway


class PathwayEventKind(StrEnum):
    CONSULT_COMPLETED = "consult_completed"
    SAMPLE_COLLECTED = "sample_collected"
    LAB_STARTED = "lab_started"
    JOINT_REPORT_READY = "joint_report_ready"
    RESULT_COMMUNICATED = "result_communicated"
    COUNSELLING_BOOKED = "counselling_booked"
    COUNSELLING_MISSED = "counselling_missed"
    COUNSELLING_COMPLETED = "counselling_completed"
    COUNSELLING_DECLINED = "counselling_declined"
    REFERRAL_REJECTED = "referral_rejected"
    PARTNER_DECLINED_TO_SHARE = "partner_declined_to_share"
    DECLARATION_SIGNED = "declaration_signed"
    CERTIFICATE_ISSUED = "certificate_issued"
    JUDICIAL_HANDOFF_SENT = "judicial_handoff_sent"
    CASE_CLOSED = "case_closed"
    BRIEF_GENERATED = "brief_generated"
    CONFIRMATORY_TEST_ORDERED = "confirmatory_test_ordered"
    CONFIRMATORY_TEST_RESULTED = "confirmatory_test_resulted"
    SPECIALIST_REFERRAL_REQUESTED = "specialist_referral_requested"
    SPECIALIST_REFERRAL_COMPLETED = "specialist_referral_completed"


class StatusReason(StrEnum):
    PATIENT_DECLINED = "patient_declined"
    NO_SHOW = "no_show"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    TIMEOUT = "timeout"
    WRONG_DESTINATION = "wrong_destination"


class ResultReference(Frozen):
    """What the journey needs to know about the result: the category and, optionally, the headline number."""

    category: ResultCategory
    affected_per_100: int | None = Field(default=None, ge=0, le=100)


class PathwayEvent(Frozen):
    kind: PathwayEventKind
    result: ResultReference | None = None  # required for result_communicated, forbidden otherwise
    counselling_indicated: bool | None = None  # None: derived from the category
    status_reason: StatusReason | None = None
    note: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def _result_only_with_result_communicated(self) -> Self:
        is_result = self.kind is PathwayEventKind.RESULT_COMMUNICATED
        if is_result and self.result is None:
            raise ValueError("result_communicated needs the result reference")
        if not is_result and (self.result is not None or self.counselling_indicated is not None):
            raise ValueError("result and counselling_indicated belong to result_communicated only")
        return self


class SlaStatus(StrEnum):
    ON_TIME = "on_time"
    AT_RISK = "at_risk"
    BREACHED = "breached"


class StepStatus(StrEnum):
    DONE = "done"
    CURRENT = "current"
    UPCOMING = "upcoming"
    NOT_APPLICABLE = "not_applicable"
    SKIPPED = "skipped"
    BLOCKED = "blocked"


class TimerView(Frozen):
    id: str
    standard_hours: float | None  # None for validity-style timers
    elapsed_hours: float
    sla: SlaStatus
    illustrative: bool
    source: str
    illustrative_notice: str | None = None


class PathwayStepView(Frozen):
    id: str
    label: str
    description: str
    status: StepStatus
    completed_at: datetime | None = None
    external_system: str | None = None  # always carries the word simulated in its label
    simulated: bool = False
    planning_minutes: int | None = None
    timer: TimerView | None = None


class NextAction(Frozen):
    event: PathwayEventKind
    label: str
    roles: tuple[str, ...]


class CertificateView(Frozen):
    issued_at: datetime
    valid_until: datetime
    expired: bool


class CaseKpi(Frozen):
    time_to_result_hours: float | None = None
    time_to_referral_hours: float | None = None
    counselling: Literal["not_indicated", "pending", "booked", "completed", "declined"] | None = (
        None
    )


class PathwayView(Frozen):
    couple_id: str
    state: str
    locale: Locale
    language_status: Literal["reviewed", "draft"]
    steps: tuple[PathwayStepView, ...]
    next_actions: tuple[NextAction, ...]
    open_referral_tasks: int
    certificate: CertificateView | None = None
    kpi: CaseKpi
    notices: tuple[str, ...]
    simulated: Literal[True] = True
    synthetic: Literal[True] = True


# ------------------------------------------------------------------------------- referral tasks


class TaskStatus(StrEnum):
    """Subset of the FHIR R5 Task status value set (5.0.0, fetched 2026-11-20)."""

    REQUESTED = "requested"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in-progress"
    ON_HOLD = "on-hold"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskCode(StrEnum):
    COUNSELLING = "counselling"
    CONFIRMATORY_TESTING = "confirmatory_testing"
    SPECIALIST_REFERRAL = "specialist_referral"


class TaskTransition(Frozen):
    status: TaskStatus
    at: datetime
    reason: StatusReason | None = None
    by_role: str


class TaskMilestones(Frozen):
    """Research 04 section 2.3 timestamps: t0 risk signal to t5 completed."""

    t0_risk_signal: datetime
    t1_authored: datetime
    t2_brief_generated: datetime | None = None
    t3_booked: datetime | None = None
    t4_attended: datetime | None = None
    t5_completed: datetime | None = None


class ReferralTask(Frozen):
    """FHIR R5 Task shaped. Simulated: there is no FHIR server and no integration."""

    resource_type: Literal["Task"] = "Task"
    id: str
    status: TaskStatus
    status_reason: StatusReason | None = None
    intent: Literal["order"] = "order"
    priority: Literal["routine", "urgent"] = "routine"
    code: TaskCode
    for_reference: str  # "Couple/<id>"
    authored_on: datetime
    last_modified: datetime
    requester_role: str
    owner_role: str
    milestones: TaskMilestones
    replaces: str | None = None
    stale: bool = False
    history: tuple[TaskTransition, ...] = ()
    simulated: Literal[True] = True


# ---------------------------------------------------------------------------------------- closure


class TriState(StrEnum):
    TRUE = "true"
    FALSE = "false"
    NOT_SURE = "not_sure"


class NextStepChoice(StrEnum):
    COUNSELLOR_EXPLAINS = "counsellor_explains"
    CENTRE_DECIDES = "centre_decides"
    NOTHING_MORE = "nothing_more"
    FIND_LAB_YOURSELF = "find_lab_yourself"


class WhoCanSeeChoice(StrEnum):
    ONLY_ME = "only_me"
    ME_AND_PARTNER = "me_and_partner"
    FAMILY_I_CHOOSE = "family_i_choose"
    NOBODY_ELSE = "nobody_else"


class SilsChoice(StrEnum):
    NEVER = "never"
    RARELY = "rarely"
    SOMETIMES = "sometimes"
    OFTEN = "often"
    ALWAYS = "always"


class ServiceInterestValue(StrEnum):
    YES_NOW = "yes_now"
    YES_LATER = "yes_later"
    NO_THANKS = "no_thanks"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class ServiceTopic(StrEnum):
    PRECONCEPTION_COUNSELLING = "preconception_counselling"
    PARTNER_OR_RELATIVE_TESTING = "partner_or_relative_testing"
    CONCEPTION_OPTIONS = "conception_options_information"
    PRENATAL_TESTING_INFORMATION = "prenatal_testing_information"
    TALK_TO_COUNSELLOR_AGAIN = "talk_to_counsellor_again"


class ServiceInterest(Frozen):
    """Opt-in "interested in future services". Never a marriage field; never shown to a partner."""

    value: ServiceInterestValue
    consent_acknowledged: bool = False
    consent_version: int = 1
    topics: tuple[ServiceTopic, ...] = ()
    reminder_months: Literal[3, 6, 12] | None = None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        yes = self.value in (ServiceInterestValue.YES_NOW, ServiceInterestValue.YES_LATER)
        if yes and not self.consent_acknowledged:
            raise ValueError("a yes answer needs the consent text to be acknowledged")
        if not yes and (self.topics or self.reminder_months is not None):
            raise ValueError("topics and reminders are only for a yes answer")
        if self.value is ServiceInterestValue.YES_LATER and self.reminder_months is None:
            raise ValueError("yes_later needs reminder_months")
        if self.value is not ServiceInterestValue.YES_LATER and self.reminder_months is not None:
            raise ValueError("reminder_months is only for yes_later")
        return self


class ClosureAnswers(Frozen):
    """The eight original patient items (all optional), the optional SILS stratifier, service interest."""

    own_words: str | None = Field(default=None, max_length=1000)
    out_of_100: int | None = Field(default=None, ge=0, le=100)
    carrier_is_disease: TriState | None = None
    negative_means_none: TriState | None = None
    next_step: NextStepChoice | None = None
    values_clarity: int | None = Field(default=None, ge=1, le=5)
    felt_free: int | None = Field(default=None, ge=1, le=5)
    who_can_see: WhoCanSeeChoice | None = None
    sils: SilsChoice | None = None
    service_interest: ServiceInterest | None = None


ItemOutcome = Literal["correct", "incorrect", "not_sure", "not_scored", "not_answered"]


class ItemResult(Frozen):
    """Item-level only. There is deliberately no total score and no scale score."""

    item_id: str
    outcome: ItemOutcome
    answer: str | int | None = None


class PatientClosure(Frozen):
    person_id: str
    items: tuple[ItemResult, ...]
    sils_positive_screen: bool | None = None
    service_interest: ServiceInterest | None = None
    consent_text_version: int | None = None


class EncounterInput(Frozen):
    mode: Literal["in_person", "virtual"]
    duration_minutes: int = Field(ge=1, le=480)
    session_language: Locale
    interpreter_used: bool


class FindingDiscussed(Frozen):
    finding_ref: str = Field(min_length=1, max_length=80)
    explained_as_chance_not_diagnosis: bool
    flagged_uncertain: bool = False


class InformationGiven(Frozen):
    carrier_vs_disease: bool = False
    couple_numbers: bool = False
    test_limits: bool = False
    options_neutral_order: bool = False
    right_not_to_know: bool = False
    who_can_see_result: bool = False
    how_to_reach_us: bool = False


class ProformaOption(StrEnum):
    PRENATAL_DIAGNOSIS = "prenatal_diagnosis"
    PREIMPLANTATION_TESTING = "preimplantation_testing"
    SPECIALIST_DISCUSSION = "specialist_discussion"


class NextStepStatus(StrEnum):
    """Status of the next CLINICAL step. Not a marriage decision."""

    DECIDED = "decided"
    STILL_DECIDING = "still_deciding"
    DECLINED_TO_DISCUSS = "declined_to_discuss"


class TeachBackRating(StrEnum):
    ACCURATE = "accurate"
    PARTLY = "partly"
    REPEAT_NEEDED = "repeat_needed"


class PlanActionKind(StrEnum):
    CONFIRMATORY_TEST = "confirmatory_test"
    PARTNER_TESTING = "partner_testing"
    REFERRAL = "referral"
    RECONTACT = "recontact"


class PlanAction(Frozen):
    action: PlanActionKind
    owner_role: Role
    due_date: date


class ClinicianProforma(Frozen):
    """The clinician-filled part of the 12-field proforma. The other fields are filled by the system.

    There is no marriage-decision field, and `extra="forbid"` rejects one if a client sends it.
    """

    encounter: EncounterInput
    findings_discussed: tuple[FindingDiscussed, ...] = ()
    information_given: InformationGiven
    options_discussed: tuple[ProformaOption, ...] = ()
    options_presented_in_neutral_order: bool = True
    next_step_status: NextStepStatus
    teach_back_done: bool
    teach_back_result: TeachBackRating | None = None
    patient_questions_invited: bool
    patient_questions_answered: bool | None = None
    plan: tuple[PlanAction, ...] = ()
    patient_copy_given: bool = False
    consent_record_ids: tuple[str, ...] = ()
    free_text_note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.teach_back_done != (self.teach_back_result is not None):
            raise ValueError("teach_back_result is required exactly when teach_back_done is true")
        if self.patient_questions_invited != (self.patient_questions_answered is not None):
            raise ValueError(
                "patient_questions_answered is required exactly when questions were invited"
            )
        return self


class ClinicianRecord(Frozen):
    """The assembled 12 fields: clinician input plus what the system knows (fields 2, 9, 10, 12)."""

    proforma: ClinicianProforma
    risk_signal_at: datetime | None  # field 2: t0
    referral_task_ids: tuple[str, ...]  # field 9
    service_preference_answered_by: tuple[str, ...]  # field 10: who answered, never what
    completed_by_role: str  # field 12
    completed_by_id: str


class ClosureRecord(Frozen):
    record_id: str
    couple_id: str
    kind: Literal["patient", "clinician"]
    submitted_at: datetime
    patient: PatientClosure | None = None
    clinician: ClinicianRecord | None = None
    synthetic: Literal[True] = True


class ProformaFieldDef(Frozen):
    no: int
    id: str
    label: str
    help: str
    filled_by: str
    anchor: str
    challenge_items: tuple[int, ...]
    measure: str


class PatientItemDef(Frozen):
    id: str
    no: int
    format: str
    prompt: str
    options: dict[str, str] = Field(default_factory=dict)
    scoring: str
    measures: str


class ClosureSchema(Frozen):
    locale: Locale
    language_status: Literal["reviewed", "draft"]
    clinician_fields: tuple[ProformaFieldDef, ...]
    information_ticks: dict[str, str]
    patient_items: tuple[PatientItemDef, ...]
    sils_prompt: str
    sils_options: dict[str, str]
    sils_attribution: str
    service_interest_prompt: str
    service_interest_consent_text: str
    service_interest_values: dict[str, str]
    service_interest_topics: dict[str, str]
    reminder_months: tuple[int, ...]
    notices: dict[str, str]
    marriage_decision_field: Literal[False] = False
    human_comprehension_test_run: Literal[False] = False


# --------------------------------------------------------------------------------------- teach-back


class TeachBackOption(Frozen):
    id: str
    label: str


class TeachBackItem(Frozen):
    id: str
    prompt: str
    format: Literal["single_choice", "true_false_not_sure"]
    options: tuple[TeachBackOption, ...]


class TeachBackQuiz(Frozen):
    couple_id: str
    locale: Locale
    language_status: Literal["reviewed", "draft"]
    result_category: ResultCategory
    intro: str
    items: tuple[TeachBackItem, ...]
    design_note: str
    human_comprehension_test_run: Literal[False] = False


class TeachBackSubmission(Frozen):
    locale: Locale
    answers: dict[str, str]  # item id -> option id; missing items count as not answered


class TeachBackItemResult(Frozen):
    item_id: str
    answered: str | None
    correct: bool
    correct_option: str
    explanation: str


class TeachBackResult(Frozen):
    couple_id: str
    locale: Locale
    result_category: ResultCategory
    correct_count: int
    item_count: int
    items: tuple[TeachBackItemResult, ...]
    results_note: str
    scoring_note: str


# ------------------------------------------------------------------------------------------- KPIs


class DurationSummary(Frozen):
    n: int
    median_hours: float | None
    p90_hours: float | None


class ProgrammeKpis(Frozen):
    """Aggregated from the stored cases only. A figure with no data behind it is None, never invented."""

    n_cases: int
    n_closed: int
    n_flagged: int
    time_to_result: DurationSummary
    time_to_referral: DurationSummary
    counselling_booked: int
    counselling_completed: int
    counselling_declined: int
    counselling_uptake_booked_share: float | None
    counselling_uptake_completed_share: float | None
    share_referred: float | None
    referral_target_share: float
    meets_referral_target: bool | None
    share_referred_within_standard: float | None
    referral_standard_days: int
    referral_standard_is_illustrative: bool
    open_tasks: int
    stale_tasks: int
    basis: str
    simulated: Literal[True] = True
    synthetic: Literal[True] = True
