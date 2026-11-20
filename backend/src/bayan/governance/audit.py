"""Append-only, SHA-256 hash-chained audit log.

Canonical serialisation (version 1), documented so that anyone can re-verify a chain:

    payload = json.dumps(
        {
            "v": 1, "index": <int>, "timestamp": <UTC ISO-8601, microseconds, "+00:00">,
            "actor_role": <str>, "actor_id": <str>, "action": <str>,
            "couple_id": <str|null>, "subject_id": <str|null>, "outcome": <str>,
            "reason": <str>, "detail": {<key>: <value>, ...}, "prev_hash": <64 hex>,
        },
        sort_keys=True, separators=(",", ":"), ensure_ascii=True,
    ).encode("ascii")
    hash = sha256(payload).hexdigest()

The first event has `prev_hash = "0" * 64`. `verify` recomputes every hash, every link and every
index. What the chain detects: an edited event, a removed or inserted event, a reordering.
What it does NOT detect: truncation of the tail (the head hash must be anchored somewhere the
operator cannot rewrite, for example printed on the judge scoreboard or written to WORM storage;
see docs/decisions/0125). The log is in memory in this prototype.

Minimisation: ids are pseudonymous tokens (anything else is replaced by a keyed pseudonym), and
`detail` accepts only short closed-vocabulary tokens. Free text, names, phrases a person typed and
raw results never enter the log.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import threading
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Final

from bayan.core.clock import Clock
from bayan.governance.errors import AuditFormatError
from bayan.governance.models import AuditEvent, AuditOutcome, AuditVerification

GENESIS_HASH: Final = "0" * 64
CANONICAL_VERSION: Final = 1

_ID_RE: Final = re.compile(r"^[A-Za-z0-9_.:\-]{1,80}$")
_VALUE_RE: Final = re.compile(r"^[A-Za-z0-9_.:|,\-]{0,600}$")
_KEY_RE: Final = re.compile(r"^[a-z][a-z0-9_]{0,39}$")
_ACTION_RE: Final = re.compile(r"^[a-z][a-z0-9_.]{0,59}$")
_REASON_RE: Final = re.compile(r"^[a-z0-9_.:\-]{1,80}$")


def _iso(ts: datetime) -> str:
    return ts.astimezone(UTC).isoformat(timespec="microseconds")


def canonical_payload(event: AuditEvent) -> bytes:
    """The exact bytes that are hashed (everything except the hash itself)."""
    obj = {
        "v": CANONICAL_VERSION,
        "index": event.index,
        "timestamp": _iso(event.timestamp),
        "actor_role": event.actor_role,
        "actor_id": event.actor_id,
        "action": event.action,
        "couple_id": event.couple_id,
        "subject_id": event.subject_id,
        "outcome": event.outcome,
        "reason": event.reason,
        "detail": dict(event.detail),
        "prev_hash": event.prev_hash,
    }
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def event_hash(event: AuditEvent) -> str:
    return hashlib.sha256(canonical_payload(event)).hexdigest()


class AuditLog:
    """Single-process, thread-safe, append-only."""

    def __init__(self, clock: Clock, pseudonym_key: bytes) -> None:
        self._clock = clock
        self._key = pseudonym_key
        self._events: list[AuditEvent] = []
        self._lock = threading.Lock()

    def pseudonym(self, value: str) -> str:
        """Pass an id that already looks pseudonymous; otherwise replace it with a keyed digest."""
        if _ID_RE.fullmatch(value):
            return value
        digest = hmac.new(self._key, value.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"redacted:{digest[:16]}"

    def record(
        self,
        *,
        actor_role: str,
        actor_id: str,
        action: str,
        outcome: AuditOutcome,
        reason: str,
        couple_id: str | None = None,
        subject_id: str | None = None,
        detail: Mapping[str, str] | None = None,
    ) -> AuditEvent:
        if not _ACTION_RE.fullmatch(action):
            raise AuditFormatError("audit action is not a closed-vocabulary token")
        if not _REASON_RE.fullmatch(reason):
            raise AuditFormatError("audit reason is not a closed-vocabulary token")
        clean_detail: list[tuple[str, str]] = []
        for key, value in (detail or {}).items():
            if not _KEY_RE.fullmatch(key) or not _VALUE_RE.fullmatch(value):
                raise AuditFormatError("audit detail must be short closed-vocabulary tokens")
            clean_detail.append((key, value))
        clean_detail.sort()
        with self._lock:
            prev = self._events[-1].hash if self._events else GENESIS_HASH
            draft = AuditEvent(
                index=len(self._events),
                timestamp=self._clock.now(),
                actor_role=actor_role,
                actor_id=self.pseudonym(actor_id),
                action=action,
                couple_id=None if couple_id is None else self.pseudonym(couple_id),
                subject_id=None if subject_id is None else self.pseudonym(subject_id),
                outcome=outcome,
                reason=reason,
                detail=tuple(clean_detail),
                prev_hash=prev,
                hash="",
            )
            sealed = draft.model_copy(update={"hash": event_hash(draft)})
            self._events.append(sealed)
            return sealed

    def events(self, couple_id: str | None = None) -> tuple[AuditEvent, ...]:
        with self._lock:
            snapshot = tuple(self._events)
        if couple_id is None:
            return snapshot
        wanted = self.pseudonym(couple_id)
        return tuple(e for e in snapshot if e.couple_id == wanted)

    def verify(self) -> AuditVerification:
        with self._lock:
            snapshot = tuple(self._events)
        prev = GENESIS_HASH
        for i, ev in enumerate(snapshot):
            problem = None
            if ev.index != i:
                problem = "index_out_of_sequence"
            elif ev.prev_hash != prev:
                problem = "prev_hash_does_not_match_previous_event"
            elif event_hash(ev) != ev.hash:
                problem = "hash_does_not_match_content"
            if problem is not None:
                return AuditVerification(
                    ok=False,
                    length=len(snapshot),
                    head_hash=snapshot[-1].hash,
                    first_bad_index=i,
                    problem=problem,
                )
            prev = ev.hash
        return AuditVerification(ok=True, length=len(snapshot), head_hash=prev)
