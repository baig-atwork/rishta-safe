"""Escalation library: each trigger, the legal-read flags, tiers, and the evaluation harness."""

# ruff: noqa: PT018
# Compound assertions keep status-code and body checks on one line each.

from __future__ import annotations

import pytest
from gov_helpers import (
    COUPLE,
    EVAL_REPORT,
    P1,
    P2,
    STAFF_A,
    both_carriers_case,
    finding,
    make_service,
    report,
    result,
    seed_staff,
    shared_condition,
)

import bayan.governance.escalation as escalation_mod
from bayan.core.contracts import Inheritance, ResultCategory, Sex, Zygosity
from bayan.core.errors import Invalid
from bayan.core.types import Locale, Principal, Role
from bayan.governance.escalation import (
    DueBy,
    EscalationContext,
    EscalationTier,
    context_from_reports,
    evaluate,
    load_rules,
)
from bayan.governance.escalation_eval import MIN_POSITIVE_CASES, run_escalation_evaluation
from bayan.governance.policies import load_policy_file


def fired(ctx: EscalationContext, res=None) -> dict[str, object]:
    return {d.trigger_id: d for d in evaluate(ctx, res or result())}


@pytest.mark.unit
def test_every_trigger_has_source_signoff_flag_tier_and_hint() -> None:
    rules = load_rules()
    assert len(rules.triggers) >= 20
    for t in rules.triggers:
        assert len(t.source) > 20
        assert t.needs_clinician_signoff is True
        assert t.tier in set(EscalationTier)
        assert t.due_by_hint in set(DueBy)
        assert not any(
            ch.isdigit() for ch in t.due_by_hint.value
        )  # a hint key, never a number of days


@pytest.mark.unit
def test_two_tiers_both_used() -> None:
    assert {t.tier for t in load_rules().triggers} == {
        EscalationTier.COUNSELLOR,
        EscalationTier.ACCREDITED_GENETICIST,
    }


@pytest.mark.unit
def test_brief_list_of_triggers_is_present() -> None:
    ids = {t.id for t in load_rules().triggers}
    assert {
        "affected_partner",
        "shared_severity_a",
        "variant_of_uncertain_significance",
        "copy_number_or_non_snv",
        "x_linked_finding",
        "pregnancy_in_progress",
        "variable_penetrance_gene",
        "user_distress",
        "crisis_language",
        "genotype_inferred_relatedness",
        "non_targeted_finding",
        "shared_result",
    } <= ids


@pytest.mark.unit
def test_shared_result_and_affected_partner_from_the_result() -> None:
    res = result(
        category=ResultCategory.SHARED_RESULT_FOUND,
        shared=(shared_condition("SH_1", "affected_partner_and_carrier"),),
    )
    out = fired(EscalationContext(couple_id=COUPLE), res)
    assert out["shared_result"].tier is EscalationTier.ACCREDITED_GENETICIST  # type: ignore[attr-defined]
    assert out["affected_partner"].needs_legal_read is True  # type: ignore[attr-defined]


@pytest.mark.unit
def test_no_flags_no_trigger_for_a_clean_negative() -> None:
    assert evaluate(EscalationContext(couple_id=COUPLE), result()) == ()


@pytest.mark.unit
@pytest.mark.parametrize(
    ("flag", "trigger", "legal"),
    [
        ("has_vus", "variant_of_uncertain_significance", False),
        ("copy_number_or_non_snv", "copy_number_or_non_snv", False),
        ("x_linked_finding", "x_linked_finding", True),
        ("pregnancy_in_progress", "pregnancy_in_progress", False),
        ("variable_penetrance_gene", "variable_penetrance_gene", False),
        ("shared_severity_a", "shared_severity_a", False),
        ("family_history_recessive", "family_history_recessive", False),
        ("lab_unconfirmed", "lab_unconfirmed_carrier", False),
        ("genotype_inferred_relatedness", "genotype_inferred_relatedness", True),
        ("non_targeted_finding", "non_targeted_finding", True),
        ("rntk_with_life_threat", "rntk_life_threat_override", True),
    ],
)
def test_each_flag_fires_its_trigger_with_the_documented_legal_flag(
    flag: str, trigger: str, legal: bool
) -> None:
    out = fired(EscalationContext(couple_id=COUPLE, **{flag: True}))
    assert trigger in out
    assert out[trigger].needs_legal_read is legal  # type: ignore[attr-defined]
    assert out[trigger].needs_clinician_signoff is True  # type: ignore[attr-defined]


@pytest.mark.unit
def test_conditional_legal_read_follows_the_non_targeted_flag() -> None:
    plain = fired(EscalationContext(couple_id=COUPLE, has_vus=True))[
        "variant_of_uncertain_significance"
    ]
    non_targeted = fired(
        EscalationContext(couple_id=COUPLE, has_vus=True, non_targeted_finding=True)
    )["variant_of_uncertain_significance"]
    assert plain.needs_legal_read is False  # type: ignore[attr-defined]
    assert non_targeted.needs_legal_read is True  # type: ignore[attr-defined]


@pytest.mark.unit
@pytest.mark.parametrize(
    ("text", "trigger"),
    [
        ("I just can't cope with this", "user_distress"),
        ("this is hopeless, I am devastated", "user_distress"),
        ("I want to die", "crisis_language"),
        ("لا استطيع التحمل", "user_distress"),
        ("انتحر", "crisis_language"),
        ("مجھے بہت ڈر لگ رہا ہے", "user_distress"),
        ("میں خودکشی کا سوچ رہا ہوں", "crisis_language"),
    ],
)
def test_distress_phrases_in_three_languages(text: str, trigger: str) -> None:
    assert trigger in fired(EscalationContext(couple_id=COUPLE, free_text=text))


@pytest.mark.unit
def test_crisis_is_immediate_and_counsellor_tier() -> None:
    d = fired(EscalationContext(couple_id=COUPLE, free_text="I want to end my life"))[
        "crisis_language"
    ]
    assert d.due_by_hint is DueBy.IMMEDIATE  # type: ignore[attr-defined]
    assert d.tier is EscalationTier.COUNSELLOR  # type: ignore[attr-defined]


@pytest.mark.unit
def test_unanswerable_and_lineage_requests_escalate_through_the_classifier() -> None:
    out = fired(EscalationContext(couple_id=COUPLE, free_text="should we call off the wedding"))
    assert "unanswerable_request" in out
    out = fired(EscalationContext(couple_id=COUPLE, free_text="who is the biological father"))
    assert out["lineage_or_other_result_request"].needs_legal_read is True  # type: ignore[attr-defined]


@pytest.mark.unit
def test_context_must_belong_to_the_same_couple() -> None:
    with pytest.raises(Invalid):
        evaluate(EscalationContext(couple_id="someone-else"), result())


@pytest.mark.unit
def test_context_from_reports_derives_flags_deterministically() -> None:
    reports = (
        report(
            P1, Sex.FEMALE, (finding("XG", Zygosity.CARRIER, inheritance=Inheritance.X_LINKED),)
        ),
        report(
            P2,
            Sex.MALE,
            (finding("AG", Zygosity.AFFECTED), finding("VG", Zygosity.VUS, classification="vus")),
            status="pending_confirmation",
        ),
    )
    ctx = context_from_reports(
        COUPLE,
        reports,
        result(shared=(shared_condition("AG"),)),
        severity_a_condition_ids={"cond-ag"},
        penetrance_gene_symbols={"AG"},
    )
    assert ctx.affected_partner and ctx.x_linked_finding and ctx.has_vus
    assert ctx.lab_unconfirmed and ctx.partner_results_unavailable
    assert ctx.shared_severity_a and ctx.variable_penetrance_gene
    only_one = context_from_reports(COUPLE, reports[:1], result())
    assert only_one.partner_results_unavailable
    assert not context_from_reports(COUPLE, (report(P1, Sex.FEMALE),) * 2, result()).has_vus


@pytest.mark.unit
def test_service_records_queue_and_audit_and_staff_see_only_their_couples() -> None:
    svc, _ = make_service()
    seed_staff(svc)
    svc.assign_staff(COUPLE, STAFF_A)
    reports, res = both_carriers_case()
    ctx = context_from_reports(COUPLE, reports, res, free_text="PRIVATE WORDS I can't cope")
    decisions = svc.evaluate_escalation(ctx, res)
    assert {d.trigger_id for d in decisions} >= {"shared_result", "user_distress"}
    mine = svc.escalation_queue(Principal(role=Role.COUNSELLOR, subject_id=STAFF_A))
    assert len(mine) == 1
    assert "PRIVATE WORDS" not in mine[0].model_dump_json()
    assert (
        svc.escalation_queue(Principal(role=Role.COUNSELLOR, subject_id="synthetic-staff-b")) == ()
    )
    raised = [e for e in svc.audit_events(COUPLE) if e.action == "escalation_raised"]
    assert len(raised) == 1
    assert "PRIVATE WORDS" not in str([e.model_dump() for e in svc.audit_events()])


@pytest.mark.unit
def test_every_request_example_is_refused_for_its_category() -> None:
    from bayan.governance.third_party import classify_request

    examples = load_rules().file.request_examples
    assert set(examples) <= set(load_policy_file().refusal.categories)
    for cat, by_locale in examples.items():
        for loc, texts in by_locale.items():
            for text in texts:
                d = classify_request(text, Locale(loc))
                assert d.refuse
                assert cat in d.categories, (cat, loc, text)


# ------------------------------------------------------------------ evaluation ---------------


@pytest.mark.oracle
def test_escalation_evaluation_recall_and_precision_and_determinism() -> None:
    ev = run_escalation_evaluation(n=400, seed=7)
    assert ev.n_positive >= MIN_POSITIVE_CASES
    assert ev == run_escalation_evaluation(n=400, seed=7)  # deterministic
    assert ev.recall == 1.0, ev.missed_case_ids
    assert ev.easy_false_positive == 0
    assert ev.precision_easy == 1.0
    assert all(s.cases >= 10 and s.recall == 1.0 for s in ev.per_trigger.values())
    # Hard negatives (negation, third person) DO fire: a phrase list cannot tell. Reported, not hidden.
    assert ev.hard_false_positive >= 1
    EVAL_REPORT["escalation.eval (generated from the same rules)"] = (
        f"{ev.n_positive} must-escalate cases over {len(ev.per_trigger)} triggers: recall {ev.recall:.1%} "
        f"({ev.true_positive}/{ev.n_positive}); {ev.n_easy_negative} easy negatives: false positives "
        f"{ev.easy_false_positive}, precision {ev.precision_easy:.1%}; {ev.n_hard_negative} hard negatives "
        f"(negated or third-person distress): fired {ev.hard_false_positive}, precision with them "
        f"{ev.precision_with_hard:.1%}. Recall measures implementation consistency, not clinical sensitivity."
    )


@pytest.mark.oracle
def test_escalation_evaluation_detects_a_broken_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """Non-vacuity: if the engine ignored one clause kind the evaluation must show it."""
    original = escalation_mod._clause_true

    def broken(clause, ctx, res, rules, text_norm):
        return False if clause.kind == "flag" else original(clause, ctx, res, rules, text_norm)

    monkeypatch.setattr(escalation_mod, "_clause_true", broken)
    ev = run_escalation_evaluation(n=400, seed=7)
    assert ev.recall < 0.6
    assert ev.false_negative > 100


@pytest.mark.unit
def test_evaluation_refuses_a_set_smaller_than_200() -> None:
    with pytest.raises(Invalid):
        run_escalation_evaluation(n=199, seed=1)
