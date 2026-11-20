"""Demo auth (tokens, simulated OTP) and the hash-chained audit log."""

# ruff: noqa: PT018
# Compound assertions keep status-code and body checks on one line each.

from __future__ import annotations

import hashlib
import json
import threading
from datetime import UTC

import pytest
from gov_helpers import COUPLE, P1, make_service, member, staff

from bayan.core.errors import Forbidden, Invalid, Unauthenticated
from bayan.core.types import Principal, Role
from bayan.governance.audit import GENESIS_HASH, canonical_payload, event_hash
from bayan.governance.errors import (
    AuditFormatError,
    GovernanceConfigError,
    NotConfigured,
    TooManyAttempts,
)

ALICE = member(P1)


# ------------------------------------------------------------------ tokens ---------------------


@pytest.mark.unit
def test_token_round_trip_carries_the_principal_and_is_labelled_simulated() -> None:
    svc, _ = make_service()
    token = svc.issue_demo_token(ALICE)
    assert token.simulated is True
    assert token.auth_mode == "demo_simulated"
    assert "UAE PASS" in token.notice
    assert svc.authenticate(token.access_token) == ALICE


@pytest.mark.unit
def test_tampered_swapped_and_malformed_tokens_are_rejected() -> None:
    svc, _ = make_service()
    other, _ = make_service(secret="a-different-secret-for-another-deployment")
    good = svc.issue_demo_token(ALICE).access_token
    body, mac = good.split(".")
    forged_body = body[:-2] + ("AA" if not body.endswith("AA") else "BB")
    for bad in (
        f"{forged_body}.{mac}",
        f"{body}.{mac[:-2]}xx",
        "x.y",
        "nodot",
        "",
        "a.b.c",
        "." * 3,
    ):
        with pytest.raises(Unauthenticated):
            svc.authenticate(bad)
    with pytest.raises(Unauthenticated):  # signed with another secret
        svc.authenticate(other.issue_demo_token(ALICE).access_token)
    with pytest.raises(Unauthenticated):
        svc.authenticate("z" * 5000)


@pytest.mark.unit
def test_role_cannot_be_escalated_by_editing_the_payload() -> None:
    import base64

    svc, _ = make_service()
    body, mac = svc.issue_demo_token(ALICE).access_token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    claims["role"] = "counsellor"
    forged = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    with pytest.raises(Unauthenticated) as info:
        svc.authenticate(f"{forged}.{mac}")
    assert info.value.extra["reason"] == "bad_signature"


@pytest.mark.unit
def test_token_expires_with_the_clock() -> None:
    svc, clock = make_service(ttl_minutes=10)
    token = svc.issue_demo_token(ALICE)
    clock.advance(minutes=9)
    assert svc.authenticate(token.access_token) == ALICE
    clock.advance(minutes=1)
    with pytest.raises(Unauthenticated) as info:
        svc.authenticate(token.access_token)
    assert info.value.extra["reason"] == "expired"


@pytest.mark.unit
def test_demo_token_refused_outside_demo_mode_and_audited() -> None:
    svc, _ = make_service(demo_mode=False)
    with pytest.raises(Forbidden):
        svc.issue_demo_token(ALICE)
    assert svc.audit_events()[-1].outcome == "denied"


@pytest.mark.unit
def test_prod_refuses_the_development_secret() -> None:
    with pytest.raises(GovernanceConfigError):
        make_service(env="prod", secret="dev-only-not-a-secret")
    make_service(env="prod", secret="a-real-deployment-secret")  # does not raise


# ------------------------------------------------------------------ simulated OTP --------------


@pytest.mark.unit
def test_otp_flow_returns_the_code_in_demo_mode_and_issues_a_token() -> None:
    svc, _ = make_service()
    svc.register_identity("email", "Alice@Example.test", ALICE)
    challenge = svc.request_otp("email", "alice@example.test")
    assert challenge.simulated is True
    assert challenge.demo_code is not None
    assert len(challenge.demo_code) == 6
    assert "alice" not in challenge.target_masked.lower().replace("a***", "")
    token = svc.verify_otp(challenge.challenge_id, challenge.demo_code)
    assert svc.authenticate(token.access_token) == ALICE
    with pytest.raises(Unauthenticated):  # single use
        svc.verify_otp(challenge.challenge_id, challenge.demo_code)
    assert any(
        e.action == "token_issued" and e.reason == "otp_simulated" for e in svc.audit_events()
    )


@pytest.mark.unit
def test_otp_wrong_code_attempts_are_limited_then_locked() -> None:
    svc, _ = make_service()
    svc.register_identity("mobile", "+971 50 000 0000", ALICE)
    ch = svc.request_otp("mobile", "+971500000000")
    wrong = "000000" if ch.demo_code != "000000" else "111111"
    for _ in range(4):
        with pytest.raises(Unauthenticated):
            svc.verify_otp(ch.challenge_id, wrong)
    with pytest.raises(TooManyAttempts):
        svc.verify_otp(ch.challenge_id, wrong)
    assert ch.demo_code is not None
    with pytest.raises(TooManyAttempts):  # even the right code is refused once locked
        svc.verify_otp(ch.challenge_id, ch.demo_code)


@pytest.mark.unit
def test_otp_expires_and_unknown_target_looks_like_a_wrong_code() -> None:
    svc, clock = make_service()
    svc.register_identity("email", "a@b.test", ALICE)
    ch = svc.request_otp("email", "a@b.test")
    assert ch.demo_code is not None
    clock.advance(minutes=5)
    with pytest.raises(Unauthenticated) as info:
        svc.verify_otp(ch.challenge_id, ch.demo_code)
    assert info.value.extra["reason"] == "otp_expired"
    ghost = svc.request_otp("email", "nobody@nowhere.test")
    assert ghost.demo_code is not None
    with pytest.raises(Unauthenticated) as info2:
        svc.verify_otp(ghost.challenge_id, ghost.demo_code)
    assert info2.value.extra["reason"] == "otp_invalid"  # same as a wrong code: no enumeration


@pytest.mark.unit
def test_otp_request_rate_limit_and_validation_and_non_demo_mode() -> None:
    svc, _ = make_service()
    for _ in range(5):
        svc.request_otp("email", "a@b.test")
    with pytest.raises(TooManyAttempts):
        svc.request_otp("email", "a@b.test")
    with pytest.raises(Invalid):
        svc.request_otp("email", "not-an-email")
    with pytest.raises(Invalid):
        svc.request_otp("mobile", "12")
    prod_like, _ = make_service(demo_mode=False)
    with pytest.raises(NotConfigured):
        prod_like.request_otp("email", "a@b.test")


@pytest.mark.unit
def test_the_code_is_not_stored_in_clear_and_not_logged() -> None:
    svc, _ = make_service()
    ch = svc.request_otp("email", "a@b.test")
    assert ch.demo_code is not None
    state = svc._auth._state
    assert all(ch.demo_code not in st.code_mac for st in state.otp.values())
    assert ch.demo_code not in json.dumps([e.model_dump(mode="json") for e in svc.audit_events()])


# ------------------------------------------------------------------ audit chain ----------------


def _seed_events(svc) -> None:
    svc.issue_demo_token(ALICE)
    svc.grant(
        COUPLE,
        P1,
        "partner-person-2",
        __import__("bayan.governance.models", fromlist=["x"]).ConsentScope.GENE_NAMES_ONLY,
        "partner_disclosure",
        None,
        by=ALICE,
    )
    svc.record_right_not_to_know(COUPLE, P1, ALICE)
    svc.withdraw_right_not_to_know(COUPLE, P1, ALICE)
    with pytest.raises(Forbidden):
        svc.third_party_request(
            Principal(role=Role.EXTERNAL, subject_id="anonymous"), COUPLE, "insurer"
        )


@pytest.mark.unit
def test_chain_verifies_and_every_governance_action_is_an_event() -> None:
    svc, _ = make_service()
    _seed_events(svc)
    v = svc.verify_audit_chain()
    assert v.ok
    assert v.length == len(svc.audit_events()) == 5
    assert v.head_hash == svc.audit_events()[-1].hash
    assert [e.action for e in svc.audit_events()] == [
        "token_issued",
        "consent_granted",
        "rntk_declared",
        "rntk_withdrawn",
        "third_party_request",
    ]
    assert svc.audit_events()[0].prev_hash == GENESIS_HASH


@pytest.mark.unit
def test_hash_follows_the_documented_canonical_form_recomputed_independently() -> None:
    svc, _ = make_service()
    svc.issue_demo_token(ALICE)
    ev = svc.audit_events()[0]
    payload = json.dumps(
        {
            "v": 1,
            "index": 0,
            "timestamp": ev.timestamp.astimezone(UTC).isoformat(timespec="microseconds"),
            "actor_role": ev.actor_role,
            "actor_id": ev.actor_id,
            "action": ev.action,
            "couple_id": ev.couple_id,
            "subject_id": ev.subject_id,
            "outcome": ev.outcome,
            "reason": ev.reason,
            "detail": dict(ev.detail),
            "prev_hash": GENESIS_HASH,
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("ascii")
    assert hashlib.sha256(payload).hexdigest() == ev.hash == event_hash(ev)
    assert canonical_payload(ev) == payload


@pytest.mark.unit
def test_editing_an_event_is_detected_with_and_without_rehashing() -> None:
    svc, _ = make_service()
    _seed_events(svc)
    events = svc._audit._events
    original = events[2]
    events[2] = original.model_copy(update={"outcome": "denied"})
    bad = svc.verify_audit_chain()
    assert (bad.ok, bad.first_bad_index, bad.problem) == (False, 2, "hash_does_not_match_content")
    # A careful tamperer re-computes that event's hash: the NEXT link now breaks.
    forged = events[2]
    events[2] = forged.model_copy(update={"hash": event_hash(forged)})
    bad = svc.verify_audit_chain()
    assert (bad.ok, bad.first_bad_index) == (False, 3)
    assert bad.problem == "prev_hash_does_not_match_previous_event"


@pytest.mark.unit
def test_reordering_removing_and_inserting_events_are_detected() -> None:
    svc, _ = make_service()
    _seed_events(svc)
    events = svc._audit._events
    saved = list(events)
    events[1], events[3] = events[3], events[1]
    assert not svc.verify_audit_chain().ok
    assert svc.verify_audit_chain().first_bad_index == 1
    events[:] = saved
    assert svc.verify_audit_chain().ok
    del events[2]
    assert svc.verify_audit_chain().first_bad_index == 2
    events[:] = saved
    events.insert(2, saved[1])
    assert svc.verify_audit_chain().first_bad_index == 2


@pytest.mark.unit
def test_truncating_the_tail_is_not_detected_by_the_chain_alone() -> None:
    """The documented limit: anchor the head hash elsewhere to catch this (ADR 0125)."""
    svc, _ = make_service()
    _seed_events(svc)
    head_before = svc.verify_audit_chain().head_hash
    del svc._audit._events[-1]
    after = svc.verify_audit_chain()
    assert after.ok
    assert after.head_hash != head_before  # an external anchor of the old head would notice


@pytest.mark.unit
def test_no_personal_data_in_audit_payloads() -> None:
    svc, _ = make_service()
    email_like = Principal(
        role=Role.COUPLE_MEMBER, subject_id="alice@example.test", couple_id=COUPLE
    )
    svc.issue_demo_token(email_like)
    dump = json.dumps([e.model_dump(mode="json") for e in svc.audit_events()])
    assert "alice" not in dump
    assert "@" not in dump
    assert svc.audit_events()[0].actor_id.startswith("redacted:")
    with pytest.raises(AuditFormatError):
        svc._audit.record(
            actor_role="system",
            actor_id="system",
            action="x",
            outcome="recorded",
            reason="ok",
            detail={"note": "Jane Doe, 70 kg"},
        )
    with pytest.raises(AuditFormatError):
        svc._audit.record(
            actor_role="system",
            actor_id="system",
            action="Bad Action!",
            outcome="recorded",
            reason="ok",
        )


@pytest.mark.unit
def test_concurrent_appends_keep_the_chain_valid() -> None:
    svc, _ = make_service()

    def work() -> None:
        for _ in range(100):
            svc._log(None, "load_test", "recorded", "ok")

    threads = [threading.Thread(target=work) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    v = svc.verify_audit_chain()
    assert v.ok
    assert v.length == 600


@pytest.mark.unit
def test_audit_views_are_scoped_and_denials_are_logged() -> None:
    svc, _ = make_service()
    svc.register_staff(staff())
    svc.assign_staff(COUPLE, "synthetic-staff-a")
    _seed_events(svc)
    assert len(svc.audit_events_for(staff(), COUPLE)) >= 5
    mine = svc.audit_events_for(ALICE, COUPLE)
    assert mine and all(P1 in (e.subject_id, e.actor_id) for e in mine)
    with pytest.raises(Forbidden):
        svc.audit_events_for(Principal(role=Role.PROGRAMME, subject_id="p"), COUPLE)
    with pytest.raises(Forbidden):
        svc.audit_events_for(member("synthetic-other", "other-couple"), COUPLE)
    assert svc.audit_events()[-1].action == "audit_read"
    assert svc.audit_events()[-1].outcome == "denied"
