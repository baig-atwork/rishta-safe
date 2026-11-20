"""Property tests: no orphan referral, whatever sequence of events, roles and delays occurs."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
import yaml
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from bayan.core.clock import FixedClock
from bayan.core.contracts import ResultCategory, Sex
from bayan.core.errors import BayanError, Forbidden
from bayan.core.types import Locale, Principal, Role
from bayan.explain.loader import DATA_DIR
from bayan.journey.config import load_pathway
from bayan.journey.models import (
    IntakeInput,
    MemberInput,
    PathwayEvent,
    PathwayEventKind,
    ResultReference,
    StatusReason,
    TaskStatus,
)
from bayan.journey.service import build_journey_service

pytestmark = pytest.mark.property

START = datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
ACTORS = {
    "clinician": Principal(role=Role.CLINICIAN, subject_id="c"),
    "counsellor": Principal(role=Role.COUNSELLOR, subject_id="n"),
    "member": Principal(role=Role.COUPLE_MEMBER, subject_id="syn-p1", couple_id="syn"),
    "stranger": Principal(role=Role.COUPLE_MEMBER, subject_id="s", couple_id="other"),
    "judge": Principal(role=Role.JUDGE, subject_id="j"),
    "programme": Principal(role=Role.PROGRAMME, subject_id="p"),
}
KINDS = list(PathwayEventKind)


def _event(
    kind: PathwayEventKind, category: ResultCategory, indicated: bool | None, reason: StatusReason
) -> PathwayEvent:
    if kind is PathwayEventKind.RESULT_COMMUNICATED:
        return PathwayEvent(
            kind=kind,
            result=ResultReference(category=category, affected_per_100=25),
            counselling_indicated=indicated,
        )
    return PathwayEvent(kind=kind, status_reason=reason)


steps = st.lists(
    st.tuples(
        st.sampled_from(KINDS),
        st.sampled_from(list(ACTORS)),
        st.sampled_from(list(ResultCategory)),
        st.sampled_from([None, True, False]),
        st.sampled_from(list(StatusReason)),
        st.integers(min_value=0, max_value=40 * 24),
        st.booleans(),
    ),
    min_size=1,
    max_size=40,
)


def _fresh():  # type: ignore[no-untyped-def]
    clock = FixedClock(START)
    svc = build_journey_service(clock)
    svc.create_case(
        IntakeInput(
            couple_id="syn",
            members=(
                MemberInput(person_id="syn-p1", display_name="Test A", sex=Sex.FEMALE, age=30),
                MemberInput(person_id="syn-p2", display_name="Test B", sex=Sex.MALE, age=30),
            ),
        )
    )
    return svc, clock


@settings(max_examples=300, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(steps)
def test_no_orphan_referral_under_random_event_sequences(sequence) -> None:  # type: ignore[no-untyped-def]
    svc, clock = _fresh()
    for drawn_kind, drawn_actor, category, indicated, reason, delay_hours, guided in sequence:
        clock.advance(hours=delay_hours)
        view = svc.pathway("syn")
        kind, actor = drawn_kind, drawn_actor
        if (
            guided and view.next_actions
        ):  # half the time follow the machine so deep states are reached
            kind = view.next_actions[delay_hours % len(view.next_actions)].event
            actor = "clinician"
        refusal: BayanError | None = None
        try:
            svc.advance("syn", _event(kind, category, indicated, reason), ACTORS[actor])
        except BayanError as exc:
            refusal = exc
        if refusal is not None:
            assert refusal.status in (403, 409, 422)  # refusals only; never a 500 invariant failure
        assert svc.invariant_problems("syn") == []
        case = svc.get_case("syn")
        tasks = svc.referral_tasks("syn")
        if case.flagged:
            assert any(
                t.code.value == "counselling" for t in tasks
            )  # flagged implies a task exists
        if case.closed:
            assert all(
                t.status
                in (
                    TaskStatus.COMPLETED,
                    TaskStatus.CANCELLED,
                    TaskStatus.REJECTED,
                    TaskStatus.FAILED,
                )
                for t in tasks
            )
        for t in tasks:
            assert t.for_reference == "Couple/syn"
            assert t.simulated is True
            assert t.milestones.t0_risk_signal <= t.milestones.t1_authored
            if t.status in (
                TaskStatus.REJECTED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
                TaskStatus.ON_HOLD,
            ):
                assert t.status_reason is not None
    kpi = svc.kpis()
    assert kpi.n_cases == 1
    assert kpi.stale_tasks <= kpi.open_tasks


@settings(max_examples=100, deadline=None)
@given(st.lists(st.sampled_from(KINDS), min_size=1, max_size=25))
def test_a_stranger_can_never_change_a_case(kinds) -> None:  # type: ignore[no-untyped-def]
    svc, _ = _fresh()
    for kind in kinds:
        with pytest.raises(Forbidden):
            svc.advance(
                "syn",
                _event(kind, ResultCategory.SHARED_RESULT_FOUND, None, StatusReason.NO_SHOW),
                ACTORS["stranger"],
            )
    assert svc.get_case("syn").state == "registered"


def test_a_couple_member_may_record_only_three_events_and_judges_and_externals_none() -> None:
    config = load_pathway()
    member_events = {e for e, roles in config.permissions.items() if Role.COUPLE_MEMBER in roles}
    assert member_events == {
        "counselling_booked",
        "counselling_declined",
        "partner_declined_to_share",
    }
    for roles in config.permissions.values():
        assert Role.JUDGE not in roles
        assert Role.EXTERNAL not in roles
    svc, _ = _fresh()
    for kind in PathwayEventKind:
        if kind.value in member_events:
            continue
        with pytest.raises(Forbidden):
            svc.advance(
                "syn",
                _event(kind, ResultCategory.SHARED_RESULT_FOUND, None, StatusReason.NO_SHOW),
                ACTORS["member"],
            )


def test_pathway_texts_have_identical_keys_in_all_languages() -> None:
    def flat(node: object, prefix: str = "") -> set[str]:
        if isinstance(node, dict):
            return {k for key, v in node.items() for k in flat(v, f"{prefix}{key}.")}
        return {prefix}

    for kind in ("pathway", "closure"):
        reference = flat(yaml.safe_load((DATA_DIR / f"{kind}.en.yaml").read_text(encoding="utf-8")))
        for locale in (Locale.AR, Locale.UR):
            other = flat(
                yaml.safe_load(
                    (DATA_DIR / f"{kind}.{locale.value}.yaml").read_text(encoding="utf-8")
                )
            )
            assert other == reference, (kind, locale, reference ^ other)
    config = load_pathway()
    texts = yaml.safe_load((DATA_DIR / "pathway.en.yaml").read_text(encoding="utf-8"))
    assert {s.id for s in config.steps} == set(texts["steps"])
    assert set(config.permissions) == set(texts["events"])
    assert set(texts["family_history"]) == set(config.family_history_items)
