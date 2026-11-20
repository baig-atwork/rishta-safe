"""Disclosure policy engine: worked cases for both emirates, every role, and the legal edge cases."""

# ruff: noqa: PT018
# Compound assertions keep status-code and body checks on one line each.

from __future__ import annotations

import pytest
from gov_helpers import (
    COUPLE,
    P1,
    P2,
    STAFF_A,
    STAFF_B,
    both_carriers_case,
    finding,
    make_service,
    member,
    report,
    result,
    seed_staff,
    shared_condition,
    staff,
)

from bayan.core.contracts import ResultCategory, ReviewPriority, Sex, Zygosity
from bayan.core.errors import Forbidden, Invalid
from bayan.core.types import Emirate, Principal, Relationship, Role
from bayan.governance.models import ConsentScope

ALICE, BOB = member(P1), member(P2)
AD, DXB = Emirate.ABU_DHABI, Emirate.DUBAI


def disclose(svc, who, policy=AD, case=None, **kw):
    reports, res = case or both_carriers_case()
    return svc.disclose(who, COUPLE, res, reports, policy, **kw)


@pytest.mark.unit
def test_counselling_first_is_the_fail_closed_default_for_a_shared_result() -> None:
    svc, _ = make_service()
    out = disclose(svc, ALICE)
    assert out.category is None
    assert out.withheld_reason_key == "counselling_first"
    assert out.shared == ()
    assert [f.gene for f in out.own_findings] == ["SH_1"]  # her own findings: Art. 9(1)
    assert out.partner_findings == () and out.partner_finding_scope == "none"


@pytest.mark.unit
def test_abu_dhabi_joint_report_releases_the_category_to_both_after_counselling() -> None:
    svc, _ = make_service()
    for who in (ALICE, BOB):
        out = disclose(svc, who, AD, counselling_completed=True)
        assert out.category is ResultCategory.SHARED_RESULT_FOUND
        assert [s.gene for s in out.shared] == ["SH_1"]
        assert out.partner_findings == () and out.partner_gene_names == ()  # minimal joint report
        assert out.review_priority is None and out.staff_trace == ()  # staff-only fields
        assert (
            out.certificate_note_key == "certificate_note.abu_dhabi"
        )  # nobody has agreed to share


@pytest.mark.unit
def test_dubai_withholds_the_category_until_the_other_affected_partner_consents() -> None:
    svc, _ = make_service()
    out = disclose(svc, ALICE, DXB, counselling_completed=True)
    assert (out.category, out.withheld_reason_key) == (None, "awaiting_partner_consent")
    assert out.shared == ()
    assert [f.gene for f in out.own_findings] == ["SH_1"]
    svc.grant(COUPLE, P2, P1, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=BOB)
    assert (
        disclose(svc, ALICE, DXB, counselling_completed=True).category
        is ResultCategory.SHARED_RESULT_FOUND
    )
    # Bob is still waiting for Alice: consent is per person and directional.
    assert (
        disclose(svc, BOB, DXB, counselling_completed=True).withheld_reason_key
        == "awaiting_partner_consent"
    )
    assert (
        disclose(svc, BOB, DXB, counselling_completed=True).certificate_note_key
        == "certificate_note.dubai"
    )


@pytest.mark.unit
def test_partner_findings_follow_exactly_the_scope_the_partner_granted() -> None:
    svc, _ = make_service()
    reports, _res = both_carriers_case()
    g = svc.grant(
        COUPLE, P2, P1, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=BOB
    )
    out = disclose(svc, ALICE, AD, counselling_completed=True)
    assert out.partner_finding_scope == "couple_result_only"
    assert out.partner_findings == () and out.partner_gene_names == ()
    svc.grant(COUPLE, P2, P1, ConsentScope.GENE_NAMES_ONLY, "partner_disclosure", None, by=BOB)
    out = disclose(svc, ALICE, AD, counselling_completed=True)
    assert (out.partner_finding_scope, out.partner_gene_names, out.partner_findings) == (
        "gene_names_only",
        ("SH_1",),
        (),
    )
    assert "VAR-P2-0" not in out.model_dump_json()
    svc.grant(COUPLE, P2, P1, ConsentScope.FULL_VARIANT_DETAIL, "partner_disclosure", None, by=BOB)
    out = disclose(svc, ALICE, AD, counselling_completed=True)
    assert out.partner_findings == reports[1].findings
    svc.revoke(g.consent_id, BOB)  # revoking the narrow grant does not remove the wider ones
    assert (
        disclose(svc, ALICE, AD, counselling_completed=True).partner_finding_scope
        == "full_variant_detail"
    )
    for rec in svc.consents(COUPLE):
        if rec.revoked_at is None:
            svc.revoke(rec.consent_id, BOB)
    out = disclose(svc, ALICE, AD, counselling_completed=True)
    assert out.partner_finding_scope == "none" and out.partner_findings == ()


@pytest.mark.unit
def test_a_grant_to_the_partner_never_reveals_the_granters_own_view_of_the_partner() -> None:
    svc, _ = make_service()
    svc.grant(
        COUPLE, P1, P2, ConsentScope.FULL_VARIANT_DETAIL, "partner_disclosure", None, by=ALICE
    )
    out = disclose(
        svc, ALICE, AD, counselling_completed=True
    )  # Alice shared with Bob, not vice versa
    assert out.partner_findings == () and out.partner_finding_scope == "none"
    assert (
        disclose(svc, BOB, AD, counselling_completed=True).partner_finding_scope
        == "full_variant_detail"
    )


@pytest.mark.unit
def test_right_not_to_know_withholds_everything_and_withdrawal_restores_it() -> None:
    svc, _ = make_service()
    svc.record_right_not_to_know(COUPLE, P1, ALICE)
    out = disclose(svc, ALICE, AD, counselling_completed=True)
    assert (out.category, out.withheld_reason_key) == (None, "right_not_to_know")
    assert out.own_findings == () and out.shared == () and out.partner_findings == ()
    assert out.detection == () and out.certificate_note_key is None
    assert "SH_1" not in out.model_dump_json() and "VAR-P1-0" not in out.model_dump_json()
    assert (
        disclose(svc, BOB, AD, counselling_completed=True).category
        is ResultCategory.SHARED_RESULT_FOUND
    )
    svc.withdraw_right_not_to_know(COUPLE, P1, ALICE)
    assert (
        disclose(svc, ALICE, AD, counselling_completed=True).category
        is ResultCategory.SHARED_RESULT_FOUND
    )


@pytest.mark.unit
def test_right_not_to_know_with_a_threat_stays_withheld_but_escalates_and_flags_a_legal_read() -> (
    None
):
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A)
    reports, res = both_carriers_case()
    urgent = res.model_copy(update={"review_priority": ReviewPriority.URGENT})
    svc.record_right_not_to_know(COUPLE, P1, ALICE)
    out = svc.disclose(ALICE, COUPLE, urgent, reports, AD, counselling_completed=True)
    assert (out.category, out.withheld_reason_key) == (None, "right_not_to_know")
    assert (
        "rntk_life_threat_override" not in out.model_dump_json()
    )  # she is not told that one was raised
    (record,) = svc.escalation_queue(staff(Role.COUNSELLOR, STAFF_A))
    (decision,) = record.decisions
    assert decision.trigger_id == "rntk_life_threat_override"
    assert decision.needs_legal_read is True and decision.needs_clinician_signoff is True
    assert decision.tier.value == "accredited_geneticist"
    # Pregnancy in progress with a shared result is the other proxy; a routine non-pregnant case is not.
    svc.disclose(ALICE, COUPLE, res, reports, AD, pregnancy_in_progress=False)
    assert len(svc.escalation_queue(staff(Role.COUNSELLOR, STAFF_A))) == 1
    svc.disclose(ALICE, COUPLE, res, reports, AD, pregnancy_in_progress=True)
    assert len(svc.escalation_queue(staff(Role.COUNSELLOR, STAFF_A))) == 2


@pytest.mark.unit
def test_x_linked_shared_condition_needs_the_owners_consent_under_both_policies() -> None:
    svc, _ = make_service()
    reports = (
        report(P1, Sex.FEMALE, (finding("XG", Zygosity.CARRIER, label="VAR-P1-0"),)),
        report(P2, Sex.MALE, ()),
    )
    res = result(
        category=ResultCategory.SHARED_RESULT_FOUND,
        shared=(shared_condition("XG", "x_linked_carrier_female"),),
    )
    # Bob (no findings) is the partner of the owner: he waits for her consent even under Abu Dhabi.
    out = disclose(svc, BOB, AD, (reports, res), counselling_completed=True)
    assert out.withheld_reason_key == "awaiting_partner_consent"
    # The owner herself is not gated by Bob (he has no finding to own).
    assert disclose(svc, ALICE, AD, (reports, res), counselling_completed=True).category is not None
    svc.grant(COUPLE, P1, P2, ConsentScope.COUPLE_RESULT_ONLY, "partner_disclosure", None, by=ALICE)
    assert disclose(svc, BOB, AD, (reports, res), counselling_completed=True).category is not None


@pytest.mark.unit
def test_no_shared_change_found_is_released_without_counselling_under_both_policies() -> None:
    svc, _ = make_service()
    reports = (report(P1, Sex.FEMALE, (finding("A1"),)), report(P2, Sex.MALE, ()))
    for policy in (AD, DXB):
        out = disclose(svc, BOB, policy, (reports, result()))
        assert out.category is ResultCategory.NO_SHARED_CHANGE_FOUND
        assert out.own_findings == ()  # he has none
        assert out.partner_findings == ()  # her carrier finding is hers to share


@pytest.mark.unit
def test_vus_is_not_an_abnormal_finding_for_the_consent_gate() -> None:
    svc, _ = make_service()
    reports = (
        report(P1, Sex.FEMALE, (finding("V1", Zygosity.VUS, classification="vus"),)),
        report(P2, Sex.MALE, (finding("SH_1"),)),
    )
    res = result(category=ResultCategory.SHARED_RESULT_FOUND, shared=(shared_condition("SH_1"),))
    # Under dubai Bob's own carrier finding owns nothing for Alice's VUS; Alice waits only for Bob.
    out = disclose(svc, ALICE, DXB, (reports, res), counselling_completed=True)
    assert out.withheld_reason_key == "awaiting_partner_consent"
    assert svc.audit_events()[-1].action == "disclose"


@pytest.mark.unit
def test_staff_see_everything_for_assigned_couples_and_denial_is_audited_otherwise() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A)
    a = staff(Role.COUNSELLOR, STAFF_A)
    out = disclose(svc, a, DXB)
    assert out.category is ResultCategory.SHARED_RESULT_FOUND and out.withheld_reason_key is None
    assert out.review_priority is ReviewPriority.PRIORITY
    assert out.staff_trace == ("TRACE_SENTINEL",)
    assert {m.person_id for m in out.member_findings} == {P1, P2}
    assert len(out.partner_findings) == 2  # staff see both members' findings
    with pytest.raises(Forbidden):
        disclose(svc, staff(Role.COUNSELLOR, STAFF_B))
    last = svc.audit_events()[-1]
    assert (last.action, last.outcome, last.reason, last.actor_role) == (
        "disclose",
        "denied",
        "staff_not_assigned",
        "counsellor",
    )


@pytest.mark.unit
def test_programme_sees_no_individual_result_even_with_a_grant_attempt() -> None:
    svc, _ = make_service()
    programme = Principal(role=Role.PROGRAMME, subject_id="synthetic-programme-1")
    with pytest.raises(Forbidden) as info:
        disclose(svc, programme)
    assert info.value.extra["reason"] == "programme_aggregates_only"
    from bayan.core.errors import RuleViolation

    with pytest.raises(RuleViolation):  # a consent cannot name the programme role as a recipient
        svc.grant(
            COUPLE,
            P1,
            Role.PROGRAMME,
            ConsentScope.FULL_VARIANT_DETAIL,
            "partner_disclosure",
            None,
            by=ALICE,
        )


@pytest.mark.unit
def test_judge_sees_the_staff_view_of_synthetic_cases_only() -> None:
    svc, _ = make_service()
    judge = Principal(role=Role.JUDGE, subject_id="synthetic-judge-1")
    out = disclose(svc, judge)
    assert out.viewer_role is Role.JUDGE and out.synthetic is True and out.staff_trace
    svc.mark_case_synthetic(COUPLE, False)
    with pytest.raises(Forbidden) as info:
        disclose(svc, judge)
    assert info.value.extra["reason"] == "judge_synthetic_only"
    prod_like, _ = make_service(
        demo_mode=False
    )  # outside demo mode nothing is synthetic unless marked
    with pytest.raises(Forbidden):
        disclose(prod_like, judge)
    prod_like.mark_case_synthetic(COUPLE)
    assert disclose(prod_like, judge).synthetic is True


@pytest.mark.unit
def test_external_and_foreign_members_see_nothing() -> None:
    svc, _ = make_service()
    for who in (
        Principal(role=Role.EXTERNAL, subject_id="anonymous"),
        member("synthetic-other-1", "other-couple"),
        member("synthetic-person-9", COUPLE),  # right couple id, not on the report
        Principal(role=Role.COUPLE_MEMBER, subject_id=P1, couple_id=None),
    ):
        with pytest.raises(Forbidden):
            disclose(svc, who, counselling_completed=True)
    assert all(e.outcome == "denied" for e in svc.audit_events())
    assert len(svc.audit_events()) == 4


@pytest.mark.unit
def test_relationship_is_passed_through_and_no_lineage_field_exists() -> None:
    svc, _ = make_service()
    reports, res = both_carriers_case()
    res = res.model_copy(update={"relationship": Relationship.FIRST_COUSIN})
    out = svc.disclose(ALICE, COUPLE, res, reports, AD, counselling_completed=True)
    assert out.relationship is Relationship.FIRST_COUSIN  # as declared at intake, never inferred
    banned_fields = {"ancestry", "lineage", "ethnicity", "paternity", "relatedness"}
    assert not banned_fields & set(type(out).model_fields)


@pytest.mark.unit
def test_mismatched_result_is_a_caller_error_and_every_decision_is_audited() -> None:
    svc, _ = make_service()
    reports, res = both_carriers_case()
    with pytest.raises(Invalid):
        svc.disclose(ALICE, "another-couple-id", res, reports, AD)
    disclose(svc, ALICE, AD, counselling_completed=True)
    disclose(svc, BOB, DXB, counselling_completed=True)
    events = [e for e in svc.audit_events() if e.action == "disclose"]
    assert [e.reason for e in events] == ["released", "withheld:awaiting_partner_consent"]
    assert dict(events[0].detail) == {"category_released": "true", "policy": "abu_dhabi"}
    assert svc.verify_audit_chain().ok
