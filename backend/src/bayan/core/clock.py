"""An injectable clock so pathway timing and audit stamps are testable and replayable."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class FixedClock:
    """Deterministic clock for tests and for the seeded demo timeline."""

    def __init__(self, start: datetime) -> None:
        if start.tzinfo is None:
            raise ValueError("FixedClock needs a timezone-aware datetime")
        self._now = start

    def now(self) -> datetime:
        return self._now

    def advance(self, **kwargs: float) -> datetime:
        self._now = self._now + timedelta(**kwargs)
        return self._now


class PinnableClock:
    """System time that can be pinned for a block, so a seeded timeline can be backdated.

    One instance is shared by every service in the app. Outside a `pinned(...)` block it is the
    real clock; inside, `now()` returns the pinned time (and `tick(...)` moves it forward).
    """

    def __init__(self) -> None:
        self._pinned: datetime | None = None

    def now(self) -> datetime:
        return self._pinned if self._pinned is not None else datetime.now(UTC)

    def tick(self, **kwargs: float) -> datetime:
        if self._pinned is None:
            raise RuntimeError("tick() is only valid inside pinned()")
        self._pinned = self._pinned + timedelta(**kwargs)
        return self._pinned

    @contextmanager
    def pinned(self, at: datetime) -> Iterator[PinnableClock]:
        if at.tzinfo is None:
            raise ValueError("pinned() needs a timezone-aware datetime")
        previous = self._pinned
        self._pinned = at
        try:
            yield self
        finally:
            self._pinned = previous
