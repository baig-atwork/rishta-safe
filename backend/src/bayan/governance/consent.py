"""Consent ledger and right-not-to-know ledger: append-only, with pure read functions.

Two kinds of basis, kept apart on purpose (see `ConsentBasis`):

* `STATUTORY_OBLIGATION`: the mandatory couple screening (Federal Decree-Law 49/2023 Art. 4(2)(a)
  and Art. 15). Not consent-based, confers no sharing scope, cannot be revoked.
* `EXPLICIT_CONSENT`: voluntary and secondary uses and the SHARING of one person's findings with
  a partner or a professional. Revocable at any time. Revocation never deletes: it appends a
  `revoke` line, and the folded `ConsentRecord` shows `revoked_at`. (Art. 8 withdrawal from a
  voluntary screening also requires data deletion; that workflow is a parked cut, ADR 0130.)

The reads are pure functions of the records and a point in time, so the disclosure engine and its
reference model can be tested against the same inputs without any mutable state.
"""

from __future__ import annotations

import threading
from collections.abc import Collection, Iterable
from datetime import datetime

from bayan.core.clock import Clock
from bayan.core.errors import Conflict, Forbidden, NotFound, RuleViolation
from bayan.governance.models import (
    SCOPE_RANK,
    ConsentBasis,
    ConsentRecord,
    ConsentScope,
    LedgerEntry,
    RecipientKind,
    RntkEntry,
)


def _is_active(record: ConsentRecord, at: datetime) -> bool:
    if record.basis is not ConsentBasis.EXPLICIT_CONSENT or record.scope is None:
        return False
    if at < record.granted_at:
        return False
    if record.expires_at is not None and at >= record.expires_at:
        return False
    return record.revoked_at is None or at < record.revoked_at


def effective_scope(
    records: Iterable[ConsentRecord],
    couple_id: str,
    subject_person_id: str,
    recipients: Collection[str],
    at: datetime,
) -> ConsentScope | None:
    """The widest scope under which `subject_person_id` shares their findings with a recipient.

    `recipients` is every identifier the viewer answers to (their person id and their role value).
    Returns None when no active explicit consent covers the pair. A grant to oneself is ignored.
    Pure: the same records and `at` always give the same answer.
    """
    best: ConsentScope | None = None
    for rec in records:
        if rec.couple_id != couple_id or rec.subject_person_id != subject_person_id:
            continue
        if rec.recipient not in recipients or rec.recipient == subject_person_id:
            continue
        if not _is_active(rec, at) or rec.scope is None:
            continue
        if best is None or SCOPE_RANK[rec.scope] > SCOPE_RANK[best]:
            best = rec.scope
    return best


def rntk_active(entries: Iterable[RntkEntry], couple_id: str, person_id: str, at: datetime) -> bool:
    """True when the person's latest declaration at or before `at` is 'declared' (Art. 9(2))."""
    state = False
    for e in entries:
        if e.couple_id == couple_id and e.person_id == person_id and e.at <= at:
            state = e.kind == "declared"
    return state


class ConsentLedger:
    """Append-only. Reads return folded records; `entries()` returns the raw lines."""

    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._entries: list[LedgerEntry] = []
        self._lock = threading.Lock()

    def entries(self) -> tuple[LedgerEntry, ...]:
        with self._lock:
            return tuple(self._entries)

    def records(self, couple_id: str | None = None) -> tuple[ConsentRecord, ...]:
        with self._lock:
            lines = tuple(self._entries)
        return self._fold(lines, couple_id)

    @staticmethod
    def _fold(lines: tuple[LedgerEntry, ...], couple_id: str | None) -> tuple[ConsentRecord, ...]:
        revoked_at: dict[str, datetime] = {}
        for line in lines:
            if line.kind == "revoke":
                revoked_at.setdefault(line.consent_id, line.at)
        out: list[ConsentRecord] = []
        for line in lines:
            if line.kind == "grant" and line.record is not None:
                if couple_id is not None and line.record.couple_id != couple_id:
                    continue
                out.append(
                    line.record.model_copy(update={"revoked_at": revoked_at.get(line.consent_id)})
                )
        return tuple(out)

    def get(self, consent_id: str) -> ConsentRecord:
        for rec in self.records():
            if rec.consent_id == consent_id:
                return rec
        raise NotFound("consent record not found", consent_id=consent_id)

    def append_grant(
        self,
        *,
        couple_id: str,
        subject_person_id: str,
        recipient: str,
        recipient_kind: RecipientKind,
        scope: ConsentScope | None,
        purpose: str,
        basis: ConsentBasis,
        expires_at: datetime | None,
        by_subject_id: str,
    ) -> ConsentRecord:
        with self._lock:
            seq = len(self._entries)
            consent_id = f"consent-{seq + 1:05d}"
            now = self._clock.now()
            record = ConsentRecord(
                consent_id=consent_id,
                couple_id=couple_id,
                subject_person_id=subject_person_id,
                recipient=recipient,
                recipient_kind=recipient_kind,
                scope=scope,
                purpose=purpose,
                basis=basis,
                granted_at=now,
                expires_at=expires_at,
            )
            self._entries.append(
                LedgerEntry(
                    seq=seq,
                    kind="grant",
                    at=now,
                    consent_id=consent_id,
                    by_subject_id=by_subject_id,
                    record=record,
                )
            )
            return record

    def append_revocation(self, consent_id: str, *, by_subject_id: str) -> ConsentRecord:
        """Append a revoke line. Only the subject may revoke; a statutory record cannot be revoked."""
        with self._lock:
            grant = next(
                (
                    e.record
                    for e in self._entries
                    if e.kind == "grant" and e.consent_id == consent_id and e.record
                ),
                None,
            )
            if grant is None:
                raise NotFound("consent record not found", consent_id=consent_id)
            if grant.basis is ConsentBasis.STATUTORY_OBLIGATION:
                raise RuleViolation(
                    "This record documents the mandatory couple screening (Decree-Law 49/2023 Art. 4(2)(a) and 15). "
                    "It is not consent-based, so there is nothing to revoke.",
                    consent_id=consent_id,
                )
            if by_subject_id != grant.subject_person_id:
                raise Forbidden(
                    "only the person whose findings are shared may revoke", consent_id=consent_id
                )
            if any(e.kind == "revoke" and e.consent_id == consent_id for e in self._entries):
                raise Conflict("consent already revoked", consent_id=consent_id)
            now = self._clock.now()
            self._entries.append(
                LedgerEntry(
                    seq=len(self._entries),
                    kind="revoke",
                    at=now,
                    consent_id=consent_id,
                    by_subject_id=by_subject_id,
                )
            )
            return grant.model_copy(update={"revoked_at": now})


class RightNotToKnowLedger:
    """Append-only declarations and withdrawals of the right not to know (Art. 9(2))."""

    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._entries: list[RntkEntry] = []
        self._lock = threading.Lock()

    def entries(self) -> tuple[RntkEntry, ...]:
        with self._lock:
            return tuple(self._entries)

    def append(self, kind: str, couple_id: str, person_id: str) -> RntkEntry:
        if kind not in ("declared", "withdrawn"):
            raise RuleViolation("unknown right-not-to-know change")
        with self._lock:
            entry = RntkEntry(
                seq=len(self._entries),
                kind="declared" if kind == "declared" else "withdrawn",
                at=self._clock.now(),
                couple_id=couple_id,
                person_id=person_id,
            )
            self._entries.append(entry)
            return entry

    def active(self, couple_id: str, person_id: str, at: datetime) -> bool:
        return rntk_active(self.entries(), couple_id, person_id, at)
