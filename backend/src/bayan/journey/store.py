"""In-memory case store behind a small repository class (a Postgres adapter is a parked ADR)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from bayan.core.contracts import PersonReport, ResultCategory
from bayan.core.errors import NotFound
from bayan.core.types import Emirate, Relationship
from bayan.journey.models import (
    ClosureRecord,
    IdType,
    Member,
    PathwayEvent,
    ResultReference,
    StatusReason,
    TaskCode,
    TaskStatus,
    TaskTransition,
    TeachBackResult,
)


@dataclass
class EventRecord:
    kind: str  # a PathwayEventKind value, or "registered" for the implicit first event
    at: datetime
    role: str
    actor_id: str
    payload: PathwayEvent | None = None


@dataclass
class TaskRecord:
    id: str
    code: TaskCode
    status: TaskStatus
    status_reason: StatusReason | None
    priority: str
    requester_role: str
    owner_role: str
    authored_on: datetime
    last_modified: datetime
    t0: datetime
    t1: datetime
    t2: datetime | None = None
    t3: datetime | None = None
    t4: datetime | None = None
    t5: datetime | None = None
    replaces: str | None = None
    history: list[TaskTransition] = field(default_factory=list)


@dataclass
class CaseRecord:
    couple_id: str
    created_at: datetime
    members: tuple[Member, Member]
    relationship: Relationship
    emirate_policy: Emirate
    id_type: IdType
    preliminary_risk_opt_in: bool
    state: str
    events: list[EventRecord] = field(default_factory=list)
    tasks: list[TaskRecord] = field(default_factory=list)
    result: ResultReference | None = None
    flagged: bool | None = None
    reports: tuple[PersonReport, ...] = ()
    patient_closures: dict[str, ClosureRecord] = field(default_factory=dict)
    clinician_records: list[ClosureRecord] = field(default_factory=list)
    teachbacks: list[TeachBackResult] = field(default_factory=list)
    counters: dict[str, int] = field(default_factory=dict)

    @property
    def closed(self) -> bool:
        return self.state == "closed"

    @property
    def result_category(self) -> ResultCategory | None:
        return self.result.category if self.result else None

    def first_at(self, kind: str) -> datetime | None:
        return next((e.at for e in self.events if e.kind == kind), None)

    def next_id(self, prefix: str) -> str:
        n = self.counters.get(prefix, 0) + 1
        self.counters[prefix] = n
        return f"{prefix}-{self.couple_id}-{n:03d}"


class CaseRepository:
    """Dict-backed repository. Deliberately tiny so an adapter can replace it."""

    def __init__(self) -> None:
        self._cases: dict[str, CaseRecord] = {}

    def add(self, case: CaseRecord) -> None:
        self._cases[case.couple_id] = case

    def get(self, couple_id: str) -> CaseRecord:
        case = self._cases.get(couple_id)
        if case is None:
            raise NotFound(f"No case {couple_id!r}.", couple_id=couple_id)
        return case

    def exists(self, couple_id: str) -> bool:
        return couple_id in self._cases

    def all(self) -> tuple[CaseRecord, ...]:
        return tuple(self._cases.values())
