"""The pathway state machine, the referral-task state machine and the invariants that tie them.

Rules enforced here (all property-tested in tests/journey):
  * only an allowed event from the current state moves a case (YAML transitions);
  * only a permitted role may fire an event; a couple member only on their own case;
  * a flagged result creates a referral task in the SAME step, so no flagged couple is ever left
    without a task (no orphan referral);
  * a task that ends rejected, failed, cancelled or on hold carries a reason;
  * a rejected referral spawns a replacement task, so nothing is silently lost;
  * a case cannot close while a task is open, nor (if flagged) without a clinician proforma.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from bayan.core.contracts import ResultCategory
from bayan.core.errors import BayanError, Conflict, Forbidden, Invalid
from bayan.core.types import Principal, Role
from bayan.journey.config import PathwayConfig, Transition
from bayan.journey.models import (
    PathwayEvent,
    PathwayEventKind,
    ResultReference,
    StatusReason,
    TaskCode,
    TaskStatus,
    TaskTransition,
)
from bayan.journey.store import CaseRecord, EventRecord, TaskRecord


class InvariantViolation(BayanError):
    """A bug, never a user error: a journey invariant did not hold after a transition."""

    status = 500
    code = "invariant_violation"


_ALLOWED_TASK_MOVES: dict[TaskStatus, frozenset[TaskStatus]] = {
    TaskStatus.REQUESTED: frozenset(
        {
            TaskStatus.ACCEPTED,
            TaskStatus.REJECTED,
            TaskStatus.CANCELLED,
            TaskStatus.FAILED,
            TaskStatus.COMPLETED,
            TaskStatus.IN_PROGRESS,
            TaskStatus.ON_HOLD,
        }
    ),
    TaskStatus.ACCEPTED: frozenset(
        {
            TaskStatus.IN_PROGRESS,
            TaskStatus.ON_HOLD,
            TaskStatus.COMPLETED,
            TaskStatus.CANCELLED,
            TaskStatus.FAILED,
            TaskStatus.REJECTED,
        }
    ),
    TaskStatus.IN_PROGRESS: frozenset(
        {TaskStatus.COMPLETED, TaskStatus.ON_HOLD, TaskStatus.FAILED, TaskStatus.CANCELLED}
    ),
    TaskStatus.ON_HOLD: frozenset(
        {
            TaskStatus.ACCEPTED,
            TaskStatus.IN_PROGRESS,
            TaskStatus.CANCELLED,
            TaskStatus.FAILED,
            TaskStatus.COMPLETED,
        }
    ),
}
_REJECTION_REASONS = frozenset(
    {StatusReason.PROVIDER_UNAVAILABLE, StatusReason.WRONG_DESTINATION, StatusReason.TIMEOUT}
)
_COUNSELLING_OPEN = (
    TaskStatus.REQUESTED,
    TaskStatus.ON_HOLD,
    TaskStatus.ACCEPTED,
    TaskStatus.IN_PROGRESS,
)


# ------------------------------------------------------------------------------ referral tasks
def is_open(config: PathwayConfig, task: TaskRecord) -> bool:
    return task.status.value not in config.task_terminal


def open_tasks(
    config: PathwayConfig, case: CaseRecord, code: TaskCode | None = None
) -> list[TaskRecord]:
    return [t for t in case.tasks if is_open(config, t) and (code is None or t.code is code)]


def new_task(
    config: PathwayConfig,
    case: CaseRecord,
    code: TaskCode,
    now: datetime,
    *,
    requester_role: str,
    t0: datetime | None = None,
    replaces: str | None = None,
) -> TaskRecord:
    task = TaskRecord(
        id=case.next_id("task"),
        code=code,
        status=TaskStatus.REQUESTED,
        status_reason=None,
        priority="routine",
        requester_role=requester_role,
        owner_role=config.default_owner_role[code.value],
        authored_on=now,
        last_modified=now,
        t0=t0 or now,
        t1=now,
        replaces=replaces,
    )
    task.history.append(TaskTransition(status=TaskStatus.REQUESTED, at=now, by_role=requester_role))
    case.tasks.append(task)
    return task


def move_task(
    config: PathwayConfig,
    task: TaskRecord,
    status: TaskStatus,
    now: datetime,
    *,
    by_role: str,
    reason: StatusReason | None = None,
) -> None:
    if status not in _ALLOWED_TASK_MOVES.get(task.status, frozenset()):
        raise Conflict(f"A task that is {task.status.value} cannot become {status.value}.")
    if status.value in config.task_reason_required and reason is None:
        raise Invalid(f"A task that becomes {status.value} needs a reason.")
    task.status = status
    task.status_reason = reason if status.value in config.task_reason_required else None
    task.last_modified = now
    task.history.append(
        TaskTransition(status=status, at=now, reason=task.status_reason, by_role=by_role)
    )
    if status is TaskStatus.COMPLETED:
        task.t5 = now


def _open_one(config: PathwayConfig, case: CaseRecord, code: TaskCode, what: str) -> TaskRecord:
    candidates = open_tasks(config, case, code)
    if not candidates:
        raise Conflict(f"There is no open {code.value} task for {what}.")
    return candidates[0]


# ------------------------------------------------------------------------------ transitions
def _flagged_by(event: PathwayEvent) -> bool:
    if event.counselling_indicated is not None:
        return event.counselling_indicated
    assert event.result is not None
    return event.result.category is not ResultCategory.NO_SHARED_CHANGE_FOUND


def closable(config: PathwayConfig, case: CaseRecord) -> str | None:
    """None when the case can close, otherwise why it cannot."""
    if open_tasks(config, case):
        return "open referral tasks must be finished or declined before the case closes"
    if case.flagged and not case.clinician_records:
        return "a flagged case needs the clinician proforma before it closes"
    return None


def find_transition(
    config: PathwayConfig, case: CaseRecord, event: PathwayEvent
) -> Transition | None:
    for transition in config.transitions:
        if transition.event != event.kind.value or case.state not in transition.from_states:
            continue
        if transition.guard == "flagged" and not _flagged_by(event):
            continue
        if transition.guard == "not_flagged" and _flagged_by(event):
            continue
        return transition
    return None


def authorise(
    config: PathwayConfig, case: CaseRecord, event: PathwayEvent, actor: Principal
) -> None:
    allowed = config.permissions[event.kind.value]
    if actor.role not in allowed:
        raise Forbidden(f"Role {actor.role.value} may not record {event.kind.value}.")
    if actor.role is Role.COUPLE_MEMBER and actor.couple_id != case.couple_id:
        raise Forbidden("A couple member can only act on their own case.")


def _apply_task_effects(
    config: PathwayConfig, case: CaseRecord, event: PathwayEvent, now: datetime, role: str
) -> None:
    kind = event.kind
    reason = event.status_reason
    if kind is PathwayEventKind.RESULT_COMMUNICATED:
        case.result = event.result
        case.flagged = _flagged_by(event)
        if case.flagged:
            new_task(config, case, TaskCode.COUNSELLING, now, requester_role=role)
    elif kind is PathwayEventKind.BRIEF_GENERATED:
        task = _open_one(config, case, TaskCode.COUNSELLING, "this brief")
        task.t2 = task.t2 or now
        task.last_modified = now
    elif kind is PathwayEventKind.COUNSELLING_BOOKED:
        task = _open_one(config, case, TaskCode.COUNSELLING, "this booking")
        move_task(config, task, TaskStatus.ACCEPTED, now, by_role=role)
        task.t3 = now
    elif kind is PathwayEventKind.COUNSELLING_MISSED:
        task = _open_one(config, case, TaskCode.COUNSELLING, "this missed visit")
        move_task(
            config,
            task,
            TaskStatus.ON_HOLD,
            now,
            by_role=role,
            reason=reason or StatusReason.NO_SHOW,
        )
    elif kind is PathwayEventKind.COUNSELLING_COMPLETED:
        task = _open_one(config, case, TaskCode.COUNSELLING, "this visit")
        task.t4 = now
        move_task(config, task, TaskStatus.COMPLETED, now, by_role=role)
    elif kind is PathwayEventKind.COUNSELLING_DECLINED:
        task = _open_one(config, case, TaskCode.COUNSELLING, "this decision")
        move_task(
            config,
            task,
            TaskStatus.CANCELLED,
            now,
            by_role=role,
            reason=StatusReason.PATIENT_DECLINED,
        )
    elif kind is PathwayEventKind.REFERRAL_REJECTED:
        task = _open_one(config, case, TaskCode.COUNSELLING, "this rejection")
        why = reason if reason in _REJECTION_REASONS else StatusReason.PROVIDER_UNAVAILABLE
        # Rejected means "declined before any action"; a task already on hold was attempted.
        target = (
            TaskStatus.REJECTED
            if task.status in (TaskStatus.REQUESTED, TaskStatus.ACCEPTED)
            else TaskStatus.FAILED
        )
        move_task(config, task, target, now, by_role=role, reason=why)
        new_task(
            config,
            case,
            TaskCode.COUNSELLING,
            now,
            requester_role=role,
            t0=task.t0,
            replaces=task.id,
        )
    elif kind is PathwayEventKind.CONFIRMATORY_TEST_ORDERED:
        new_task(config, case, TaskCode.CONFIRMATORY_TESTING, now, requester_role=role)
    elif kind is PathwayEventKind.CONFIRMATORY_TEST_RESULTED:
        task = _open_one(config, case, TaskCode.CONFIRMATORY_TESTING, "this result")
        move_task(config, task, TaskStatus.COMPLETED, now, by_role=role)
    elif kind is PathwayEventKind.SPECIALIST_REFERRAL_REQUESTED:
        new_task(config, case, TaskCode.SPECIALIST_REFERRAL, now, requester_role=role)
    elif kind is PathwayEventKind.SPECIALIST_REFERRAL_COMPLETED:
        task = _open_one(config, case, TaskCode.SPECIALIST_REFERRAL, "this visit")
        move_task(config, task, TaskStatus.COMPLETED, now, by_role=role)


def apply_event(
    config: PathwayConfig, case: CaseRecord, event: PathwayEvent, actor: Principal, now: datetime
) -> None:
    """Validate and apply one event. Atomic: on any error the case is left exactly as it was."""
    authorise(config, case, event, actor)
    transition = find_transition(config, case, event)
    side = config.side_events.get(event.kind.value)
    if transition is None and (side is None or case.state not in side):
        raise Conflict(
            f"{event.kind.value} is not allowed while the case is {case.state}.",
            state=case.state,
        )
    if transition is not None and transition.guard == "closable":
        why = closable(config, case)
        if why is not None:
            raise Conflict(why)
    snapshot_tasks: list[_TaskSnapshot] = [
        (t, t.status, t.status_reason, t.last_modified, t.t2, t.t3, t.t4, t.t5, len(t.history))
        for t in case.tasks
    ]
    count_before = len(case.tasks)
    before = (case.state, case.result, case.flagged)
    try:
        _apply_task_effects(config, case, event, now, actor.role.value)
    except BayanError:
        _rollback(case, snapshot_tasks, count_before, before)
        raise
    if transition is not None:
        case.state = transition.to
    case.events.append(
        EventRecord(event.kind.value, now, actor.role.value, actor.subject_id, event)
    )
    problems = invariant_problems(config, case, now)
    if problems:
        raise InvariantViolation("; ".join(problems))


_TaskSnapshot = tuple[
    TaskRecord,
    TaskStatus,
    StatusReason | None,
    datetime,
    datetime | None,
    datetime | None,
    datetime | None,
    datetime | None,
    int,
]


def _rollback(
    case: CaseRecord,
    snapshot: list[_TaskSnapshot],
    count_before: int,
    before: tuple[str, ResultReference | None, bool | None],
) -> None:
    del case.tasks[count_before:]
    for task, status, reason, modified, t2, t3, t4, t5, history_len in snapshot:
        task.status, task.status_reason, task.last_modified = status, reason, modified
        task.t2, task.t3, task.t4, task.t5 = t2, t3, t4, t5
        del task.history[history_len:]
    case.state = before[0]
    case.result = before[1]
    case.flagged = before[2]


# ------------------------------------------------------------------------------ invariants
def _task_problems(config: PathwayConfig, case: CaseRecord) -> list[str]:
    problems: list[str] = []
    by_id = {t.id: t for t in case.tasks}
    if len(by_id) != len(case.tasks):
        problems.append("duplicate task ids")
    for task in case.tasks:
        if task.status.value in config.task_reason_required and task.status_reason is None:
            problems.append(f"{task.id} is {task.status.value} without a reason")
        if task.last_modified < task.authored_on:
            problems.append(f"{task.id} modified before it was authored")
        if not task.history or task.history[-1].status is not task.status:
            problems.append(f"{task.id} history does not end in its status")
        if task.t0 > task.t1:
            problems.append(f"{task.id} has t0 after t1")
        if task.replaces is not None:
            old = by_id.get(task.replaces)
            if old is None or old.status not in (TaskStatus.REJECTED, TaskStatus.FAILED):
                problems.append(f"{task.id} replaces a task that was not rejected or failed")
        unreplaced = not any(t.replaces == task.id for t in case.tasks)
        ended_badly = task.status in (TaskStatus.REJECTED, TaskStatus.FAILED)
        if ended_badly and task.code is TaskCode.COUNSELLING and unreplaced:
            problems.append(f"{task.id} ended {task.status.value} and nothing replaced it")
    return problems


def _case_problems(config: PathwayConfig, case: CaseRecord, now: datetime) -> list[str]:
    problems: list[str] = []
    counselling = [t for t in case.tasks if t.code is TaskCode.COUNSELLING]
    if case.flagged and not counselling:
        problems.append("flagged case has no counselling task (orphan result)")
    waiting = case.state in ("counselling_pending", "counselling_booked")
    if waiting and not open_tasks(config, case, TaskCode.COUNSELLING):
        problems.append(f"state {case.state} but no open counselling task")
    if case.state in config.terminal_states:
        why = closable(config, case)
        if why is not None:
            problems.append(f"closed case: {why}")
    times = [e.at for e in case.events]
    if times != sorted(times):
        problems.append("event times go backwards")
    if times and times[-1] > now:
        problems.append("an event is dated in the future")
    return problems


def invariant_problems(config: PathwayConfig, case: CaseRecord, now: datetime) -> list[str]:
    """Every journey invariant. Empty list means all hold. Used after each event and by tests."""
    return [*_case_problems(config, case, now), *_task_problems(config, case)]


def is_stale(config: PathwayConfig, task: TaskRecord, now: datetime) -> bool:
    return is_open(config, task) and now - task.last_modified > timedelta(
        days=config.stale_after_days
    )
