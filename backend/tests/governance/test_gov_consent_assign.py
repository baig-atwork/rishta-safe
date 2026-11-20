"""Consent ledger (append-only, pure scope function) and staff assignment authority."""

# Compound assertions keep status-code and body checks on one line each.

from __future__ import annotations

import ast
from datetime import timedelta
from pathlib import Path

import pytest
from gov_helpers import (
    COUPLE,
    P1,
    P2,
    STAFF_A,
    STAFF_B,
    STAFF_C,
    T0,
    make_service,
    member,
    seed_staff,
    staff,
)

from bayan.core.errors import Conflict, Forbidden, Invalid, NotFound, RuleViolation
from bayan.core.types import Principal, Role
from bayan.governance.consent import effective_scope, rntk_active
from bayan.governance.models import ConsentBasis, ConsentScope, RntkEntry

ALICE, BOB = member(P1), member(P2)
PROGRAMME = Principal(role=Role.PROGRAMME, subject_id="synthetic-programme-1")


# ------------------------------------------------------------------ ledger ---------------------


@pytest.mark.unit
def test_grant_revoke_appends_and_never_deletes() -> None:
    svc, clock = make_service()
    rec = svc.grant(
        COUPLE, P1, P2, ConsentScope.FULL_VARIANT_DETAIL, "partner_disclosure", None, by=ALICE
    )
    assert rec.basis is ConsentBasis.EXPLICIT_CONSENT
    assert rec.revoked_at is None
    clock.advance(minutes=3)
    revoked = svc.revoke(rec.consent_id, ALICE)
    assert revoked.revoked_at == T0 + timedelta(minutes=3)
    lines = svc._ledger.entries()
    assert [(e.kind, e.consent_id) for e in lines] == [
        ("grant", rec.consent_id),
        ("revoke", rec.consent_id),
    ]
    assert lines[0].record is not None
    assert lines[0].record.revoked_at is None  # the original grant line is untouched
    (folded,) = svc.consents(COUPLE)
    assert folded.revoked_at is not None


@pytest.mark.unit
def test_effective_scope_is_pure_and_respects_expiry_revocation_and_history() -> None:
    svc, clock = make_service()
    exp = T0 + timedelta(minutes=10)
    svc.grant(COUPLE, P1, P2, ConsentScope.GENE_NAMES_ONLY, "partner_disclosure", exp, by=ALICE)
    wider = svc.grant(
        COUPLE,
        P1,
        "couple_member",
        ConsentScope.FULL_VARIANT_DETAIL,
        "partner_disclosure",
        None,
        by=ALICE,
    )
    recs = svc.consents(COUPLE)
    ids = {P2, "couple_member"}
    assert (
        effective_scope(recs, COUPLE, P1, ids, T0) is ConsentScope.FULL_VARIANT_DETAIL
    )  # widest wins
    clock.advance(minutes=1)
    svc.revoke(wider.consent_id, ALICE)
    revoked_at = clock.now()
    recs = svc.consents(COUPLE)
    assert (
        effective_scope(recs, COUPLE, P1, ids, revoked_at - timedelta(seconds=1))
        is ConsentScope.FULL_VARIANT_DETAIL
    )
    assert (
        effective_scope(recs, COUPLE, P1, ids, revoked_at) is ConsentScope.GENE_NAMES_ONLY
    )  # history is replayable
    assert (
        effective_scope(recs, COUPLE, P1, ids, exp - timedelta(microseconds=1))
        is ConsentScope.GENE_NAMES_ONLY
    )
    assert effective_scope(recs, COUPLE, P1, ids, exp) is None  # expiry instant is exclusive
    assert (
        effective_scope(recs, COUPLE, P1, ids, T0 - timedelta(seconds=1)) is None
    )  # before the grant
    assert effective_scope(recs, "other-couple", P1, ids, T0) is None
    assert effective_scope(recs, COUPLE, P2, ids, T0) is None  # P2 shared nothing
    assert effective_scope(recs, COUPLE, P1, {"someone-else"}, T0) is None
    assert effective_scope(recs, COUPLE, P1, {P1}, T0) is None  # you cannot grant yourself


@pytest.mark.unit
def test_mandatory_screening_is_not_consent_based_and_cannot_be_revoked() -> None:
    svc, _ = make_service()
    rec = svc.record_statutory_basis(COUPLE, P1)
    assert rec.basis is ConsentBasis.STATUTORY_OBLIGATION
    assert rec.scope is None
    assert "Art. 4(2)(a)" not in rec.purpose  # a slug, not prose
    with pytest.raises(RuleViolation) as info:
        svc.revoke(rec.consent_id, ALICE)
    assert "not consent-based" in info.value.detail
    assert (
        effective_scope(svc.consents(COUPLE), COUPLE, P1, {P2, "counsellor", "couple_member"}, T0)
        is None
    )


@pytest.mark.unit
def test_grant_validation() -> None:
    svc, _ = make_service()
    with pytest.raises(Forbidden):  # not the subject
        svc.grant(
            COUPLE, P1, P2, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=BOB
        )
    with pytest.raises(Forbidden):  # staff cannot consent on someone's behalf
        svc.grant(
            COUPLE, P1, P2, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=staff()
        )
    with pytest.raises(Invalid):
        svc.grant(
            COUPLE, P1, P2, ConsentScope.COUPLE_RESULT_ONLY, "free text purpose!", None, by=ALICE
        )
    with pytest.raises(Invalid):
        svc.grant(
            COUPLE, P1, P1, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=ALICE
        )
    with pytest.raises(Invalid):
        svc.grant(
            COUPLE,
            P1,
            "bad id with spaces",
            ConsentScope.COUPLE_RESULT_ONLY,
            "partner_disclosure",
            None,
            by=ALICE,
        )
    with pytest.raises(Invalid):
        svc.grant(
            COUPLE,
            P1,
            P2,
            ConsentScope.COUPLE_RESULT_ONLY,
            "partner_disclosure",
            T0 - timedelta(minutes=1),
            by=ALICE,
        )
    for role in ("programme", "judge", "external"):
        with pytest.raises(RuleViolation):
            svc.grant(
                COUPLE,
                P1,
                role,
                ConsentScope.COUPLE_RESULT_ONLY,
                "partner_disclosure",
                None,
                by=ALICE,
            )
    svc.grant(
        COUPLE,
        P1,
        Role.COUNSELLOR,
        ConsentScope.COUPLE_RESULT_ONLY,
        "couple_counselling",
        None,
        by=ALICE,
    )
    assert svc.verify_audit_chain().ok
    denied = [e for e in svc.audit_events() if e.outcome in ("denied", "refused")]
    assert len(denied) >= 5


@pytest.mark.unit
def test_revoke_rules() -> None:
    svc, _ = make_service()
    rec = svc.grant(
        COUPLE, P1, P2, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=ALICE
    )
    with pytest.raises(Forbidden):
        svc.revoke(rec.consent_id, BOB)  # the recipient cannot revoke
    with pytest.raises(NotFound):
        svc.revoke("consent-99999", ALICE)
    svc.revoke(rec.consent_id, ALICE)
    with pytest.raises(Conflict):
        svc.revoke(rec.consent_id, ALICE)


@pytest.mark.unit
def test_consents_for_scopes_the_view() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A)
    svc.grant(COUPLE, P1, P2, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=ALICE)
    svc.grant(COUPLE, P2, P1, ConsentScope.GENE_NAMES_ONLY, "partner_disclosure", None, by=BOB)
    assert len(svc.consents_for(staff(Role.COUNSELLOR, STAFF_A), COUPLE)) == 2
    assert len(svc.consents_for(ALICE, COUPLE)) == 2  # one she granted, one she received
    with pytest.raises(Forbidden):
        svc.consents_for(staff(Role.COUNSELLOR, STAFF_B), COUPLE)  # not assigned
    with pytest.raises(Forbidden):
        svc.consents_for(PROGRAMME, COUPLE)


@pytest.mark.unit
def test_right_not_to_know_ledger_is_append_only_and_time_aware() -> None:
    svc, clock = make_service()
    svc.record_right_not_to_know(COUPLE, P1, ALICE)
    clock.advance(minutes=1)
    svc.withdraw_right_not_to_know(COUPLE, P1, ALICE)
    entries = svc._rntk.entries()
    assert [e.kind for e in entries] == ["declared", "withdrawn"]
    assert rntk_active(entries, COUPLE, P1, T0) is True
    assert rntk_active(entries, COUPLE, P1, T0 + timedelta(minutes=1)) is False
    assert rntk_active(entries, COUPLE, P2, T0) is False
    assert isinstance(entries[0], RntkEntry)
    with pytest.raises(Forbidden):  # only the person decides
        svc.record_right_not_to_know(COUPLE, P1, BOB)


# ------------------------------------------------------------------ staff assignment -----------


def _denials(svc, reason: str) -> int:
    return sum(1 for e in svc.audit_events() if e.action == "staff_assigned" and e.reason == reason)


@pytest.mark.unit
def test_programme_may_assign_registered_staff_and_it_is_audited() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A, PROGRAMME)
    assert svc.assigned_staff(COUPLE) == {STAFF_A}
    ev = svc.audit_events()[-1]
    assert (ev.action, ev.outcome, ev.actor_role) == ("staff_assigned", "recorded", "programme")


@pytest.mark.unit
@pytest.mark.parametrize(
    "caller",
    [
        staff(Role.COUNSELLOR, STAFF_B),  # staff NOT assigned to the couple
        staff(Role.CLINICIAN, STAFF_C),
        member(P1),
        Principal(role=Role.JUDGE, subject_id="synthetic-judge-1"),
        Principal(role=Role.EXTERNAL, subject_id="anonymous"),
    ],
)
def test_unauthorised_callers_cannot_assign_anyone_including_themselves(caller: Principal) -> None:
    svc, _ = make_service()
    seed_staff(svc)
    for target in (caller.subject_id, STAFF_A):
        with pytest.raises(Forbidden) as info:
            svc.assign_staff(COUPLE, target, caller)
        assert info.value.extra["reason"] == "assigner_not_authorised"
    assert svc.assigned_staff(COUPLE) == frozenset()
    assert _denials(svc, "assigner_not_authorised") == 2


@pytest.mark.unit
def test_assigned_staff_may_assign_colleagues_but_never_themselves() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A, PROGRAMME)
    a = staff(Role.COUNSELLOR, STAFF_A)
    with pytest.raises(Forbidden) as info:
        svc.assign_staff(COUPLE, STAFF_A, a)
    assert info.value.extra["reason"] == "self_assignment_forbidden"
    svc.assign_staff(COUPLE, STAFF_C, a)  # a colleague: allowed
    assert svc.assigned_staff(COUPLE) == {STAFF_A, STAFF_C}
    assert _denials(svc, "self_assignment_forbidden") == 1
    # Assignment on one couple confers nothing on another.
    with pytest.raises(Forbidden):
        svc.assign_staff("synthetic-couple-2", STAFF_B, a)


@pytest.mark.unit
def test_unknown_staff_identity_is_rejected_on_every_path_including_the_seeder() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    for by in (PROGRAMME, None):
        with pytest.raises(Invalid) as info:
            svc.assign_staff(COUPLE, "synthetic-staff-ghost", by)
        assert info.value.extra["reason"] == "unknown_staff_identity"
    assert svc.assigned_staff(COUPLE) == frozenset()
    assert _denials(svc, "unknown_staff_identity") == 2
    with pytest.raises(Invalid):
        svc.assign_staff(COUPLE, "bad id!", PROGRAMME)


@pytest.mark.unit
def test_trusted_seeder_path_with_by_none_still_needs_a_registered_staff_identity() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_B)  # by=None: internal seeding only
    assert svc.assigned_staff(COUPLE) == {STAFF_B}
    assert svc.audit_events()[-1].actor_role == "system"


@pytest.mark.unit
def test_staff_identities_are_registered_by_register_staff_otp_directory_and_demo_token() -> None:
    svc, _ = make_service()
    with pytest.raises(Invalid):
        svc.register_staff(member(P1))  # a couple member is not staff
    with pytest.raises(Invalid):
        svc.assign_staff(COUPLE, STAFF_A)
    svc.register_identity("email", "a@clinic.test", staff(Role.COUNSELLOR, STAFF_A))
    svc.assign_staff(COUPLE, STAFF_A)
    svc.issue_demo_token(staff(Role.CLINICIAN, STAFF_C))
    svc.assign_staff(COUPLE, STAFF_C)
    assert svc.assigned_staff(COUPLE) == {STAFF_A, STAFF_C}


@pytest.mark.unit
def test_a_staff_member_without_an_authorised_assignment_never_sees_the_staff_view() -> None:
    from gov_helpers import both_carriers_case

    svc, _ = make_service()
    seed_staff(svc)
    reports, res = both_carriers_case()
    from bayan.core.types import Emirate

    b = staff(Role.COUNSELLOR, STAFF_B)
    for attempt in (b, member(P1)):
        with pytest.raises(Forbidden):
            svc.assign_staff(COUPLE, STAFF_B, attempt)
    with pytest.raises(Forbidden):
        svc.disclose(b, COUPLE, res, reports, Emirate.ABU_DHABI)
    svc.assign_staff(COUPLE, STAFF_B, PROGRAMME)
    assert svc.disclose(b, COUPLE, res, reports, Emirate.ABU_DHABI).staff_trace == res.trace


@pytest.mark.unit
def test_no_router_can_reach_assign_staff_with_by_none() -> None:
    """Every call to `.assign_staff(` under api/routers passes a third positional argument that is
    not the literal None; the internal trusted path is for the seeder only."""
    routers = Path(__file__).resolve().parents[2] / "src" / "bayan" / "api" / "routers"
    calls = 0
    for path in routers.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "assign_staff":
                calls += 1
                by = (
                    node.args[2]
                    if len(node.args) > 2
                    else next((k.value for k in node.keywords if k.arg == "by"), None)
                )
                assert by is not None, (
                    f"{path.name}: assign_staff called without the authenticated principal"
                )
                assert not (isinstance(by, ast.Constant) and by.value is None), path.name
    assert calls >= 1
