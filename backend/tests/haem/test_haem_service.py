"""Haematology aid: the 20 draft fixtures, the closed vocabulary, the rule evaluator and the boundary cases.

READ THIS FIRST. The 20 fixtures in `data/haem_rules.yaml` were written by the same author as the rules (a research
agent working from the cited guidelines). Passing them shows the engine reproduces the rule table as written, that is
internal consistency only. It is not clinical validation, not a sensitivity or specificity, and not evidence the rules
are right. Every rule still needs the clinical lead's sign-off (pending).
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from pydantic import ValidationError

from bayan.haem.models import (
    CBC_ONLY_LABELS,
    HPLC_LABELS,
    CbcInput,
    HaemFixture,
    HplcInput,
)
from bayan.haem.rules import RuleError, evaluate, load_haem_ruleset, parse_condition
from bayan.haem.service import HaemService, build_haem_service

SERVICE = build_haem_service()
RULESET = load_haem_ruleset()
FIXTURES = RULESET.ruleset.fixtures

_CBC_FIELDS = set(CbcInput.model_fields)
_HPLC_FIELDS = set(HplcInput.model_fields)


def _split(raw: dict[str, object]) -> tuple[CbcInput, HplcInput | None]:
    cbc = CbcInput(**{k: v for k, v in raw.items() if k in _CBC_FIELDS})  # type: ignore[arg-type]
    hplc_values = {k: v for k, v in raw.items() if k in _HPLC_FIELDS}
    return cbc, (HplcInput(**hplc_values) if hplc_values else None)  # type: ignore[arg-type]


def cbc(**kw: object) -> CbcInput:
    base: dict[str, object] = {
        "age_years": 28,
        "sex": "F",
        "pregnant": False,
        "transfused_last_4_months": False,
        "hb_g_per_l": 125,
        "mcv_fl": 85,
        "mch_pg": 29,
    }
    base.update(kw)
    return CbcInput(**base)  # type: ignore[arg-type]


def hplc(**kw: object) -> HplcInput:
    base: dict[str, object] = {
        "hba2_pct": 2.8,
        "hba2_is_total": True,
        "hbf_pct": 0.6,
        "variant_detected": "none",
        "single_hba_band_only": True,
    }
    base.update(kw)
    return HplcInput(**base)  # type: ignore[arg-type]


# ---------------------------------------------------------------- the 20 draft fixtures


def test_there_are_twenty_fixtures_and_all_are_synthetic() -> None:
    assert len(FIXTURES) == 20
    assert all(f.synthetic for f in FIXTURES)
    assert RULESET.ruleset.meta.all_fixtures_synthetic
    assert "same author" in RULESET.ruleset.meta.fixture_authorship_note


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f.id for f in FIXTURES])
def test_fixture(fixture: HaemFixture) -> None:
    cbc_in, hplc_in = _split(dict(fixture.input))
    out = SERVICE.interpret(cbc_in, hplc_in)
    assert out.label == fixture.expect_label, fixture.why
    assert out.draft_output == fixture.expect_draft_output
    assert set(fixture.expect_flags) <= set(out.flags)
    assert out.needs_clinician_signoff is True
    assert out.stage == ("cbc_only" if hplc_in is None else "cbc_plus_hplc")


# ---------------------------------------------------------------- closed vocabulary


def test_vocabulary_is_three_plus_eight() -> None:
    assert len(CBC_ONLY_LABELS) == 3
    assert len(HPLC_LABELS) == 8
    assert not CBC_ONLY_LABELS & HPLC_LABELS
    assert set(RULESET.ruleset.label_descriptions) == CBC_ONLY_LABELS | HPLC_LABELS


@settings(max_examples=300, deadline=None)
@given(
    age=st.one_of(st.none(), st.floats(0, 120)),
    hb=st.one_of(st.none(), st.floats(20, 250)),
    mcv=st.one_of(st.none(), st.floats(40, 140)),
    mch=st.one_of(st.none(), st.floats(10, 50)),
    pregnant=st.sampled_from([True, False, "unknown"]),
    transfused=st.sampled_from([True, False, "unknown"]),
    ferritin=st.sampled_from(["low", "not_low", "not_measured"]),
)
def test_a_cbc_alone_can_only_produce_the_three_cbc_labels(
    age: float | None,
    hb: float | None,
    mcv: float | None,
    mch: float | None,
    pregnant: bool | str,
    transfused: bool | str,
    ferritin: str,
) -> None:
    out = SERVICE.interpret(
        CbcInput(
            age_years=age,
            hb_g_per_l=hb,
            mcv_fl=mcv,
            mch_pg=mch,
            pregnant=pregnant,  # type: ignore[arg-type]
            transfused_last_4_months=transfused,  # type: ignore[arg-type]
            ferritin_status=ferritin,  # type: ignore[arg-type]
        ),
        None,
    )
    assert out.label in CBC_ONLY_LABELS
    for forbidden in (
        "carrier",
        "not_a_carrier",
        "normal",
        "negative",
        "disease",
        "affected",
        "trait",
        "diagnos",
    ):
        assert forbidden not in out.label.replace("_not_flagged", "")
    assert out.stage == "cbc_only"


@settings(max_examples=300, deadline=None)
@given(
    mch=st.floats(10, 50),
    mcv=st.floats(40, 140),
    hb=st.floats(20, 250),
    hba2=st.one_of(st.none(), st.floats(0, 40)),
    hbf=st.one_of(st.none(), st.floats(0, 100)),
    variant=st.sampled_from(
        ["none", "S", "C", "D", "E", "OArab", "Lepore", "other_or_unknown", None]
    ),
    band=st.one_of(st.none(), st.booleans()),
    total=st.one_of(st.none(), st.booleans()),
    alpha0=st.one_of(st.none(), st.booleans()),
    ferritin=st.sampled_from(["low", "not_low", "not_measured"]),
)
def test_with_an_hplc_only_the_eight_hplc_labels_are_possible_and_the_rule_trace_is_never_empty(
    mch: float,
    mcv: float,
    hb: float,
    hba2: float | None,
    hbf: float | None,
    variant: str | None,
    band: bool | None,
    total: bool | None,
    alpha0: bool | None,
    ferritin: str,
) -> None:
    out = SERVICE.interpret(
        cbc(
            mch_pg=mch,
            mcv_fl=mcv,
            hb_g_per_l=hb,
            ferritin_status=ferritin,
            alpha0_origin_both_high_or_unknown=alpha0,
        ),
        HplcInput(
            hba2_pct=hba2,
            hbf_pct=hbf,
            variant_detected=variant,  # type: ignore[arg-type]
            single_hba_band_only=band,
            hba2_is_total=total,
        ),
    )
    assert out.label in HPLC_LABELS
    assert out.trace
    assert out.trace[-1].kind in {"terminal", "annotate"}
    assert any(t.kind == "terminal" and t.rule_id == out.matched_rule_id for t in out.trace)
    assert (
        out.label != "pattern_suggests_possible_compound_or_affected"
    )  # reserved, no rule produces it


def test_the_reserved_compound_label_has_no_rule() -> None:
    for rule in RULESET.ruleset.rules:
        assert "pattern_suggests_possible_compound_or_affected" not in RULESET.labels_for(rule)


def test_discriminant_indices_are_not_rules() -> None:
    for rule in RULESET.ruleset.rules:
        text = (rule.id + rule.condition).lower()
        for name in ("mentzer", "shine", "england", "srivastava", "green", "rdw"):
            assert name not in text
    left_out = " ".join(x.rule for x in RULESET.ruleset.rules_deliberately_left_out)
    assert "Mentzer" in left_out
    assert "ferritin" in left_out.lower()


def test_no_numeric_ferritin_threshold_exists() -> None:
    for rule in RULESET.ruleset.rules:
        assert "ferritin" not in rule.condition or "ferritin_status ==" in rule.condition
        assert "ug" not in rule.condition


def test_every_rule_is_gated_on_clinician_signoff_and_cites_a_source() -> None:
    assert len(RULESET.ruleset.rules) == 24
    for rule in RULESET.ruleset.rules:
        assert rule.needs_clinician_signoff is True
        assert rule.source.id in RULESET.ruleset.sources
        assert rule.source.locator


def test_the_table_ends_in_a_catch_all() -> None:
    terminals = [r for r in RULESET.ruleset.rules if r.type == "terminal"]
    assert terminals[-1].id == "S2-DEFAULT"
    assert terminals[-1].condition == "True"


# ---------------------------------------------------------------- boundary cases (the draft report asked for these)


@pytest.mark.parametrize(
    ("mch", "mcv", "label"),
    [
        (26.9, 90, "indices_reduced"),
        (27.0, 90, "indices_not_flagged"),
        (29, 79.9, "indices_reduced"),
        (29, 80.0, "indices_not_flagged"),
    ],
)
def test_cbc_cut_offs_at_the_boundary(mch: float, mcv: float, label: str) -> None:
    assert SERVICE.interpret(cbc(mch_pg=mch, mcv_fl=mcv), None).label == label


@pytest.mark.parametrize(
    ("mch", "hba2", "draft"),
    [
        (26, 3.49, "S2_ALPHA_THAL_OR_IRON_DEFICIENCY_POSSIBLE__NO_BETA_PATTERN"),
        (26, 3.50, "S2_PATTERN_BETA_THAL_RISK__PARTNER_TESTING_AND_COUNSELLING"),
        (28, 3.99, "S2_BORDERLINE_HBA2__CLINICIAN_REVIEW"),
        (28, 4.00, "S2_PATTERN_BETA_THAL_RISK__PARTNER_TESTING_AND_COUNSELLING"),
        (28, 3.49, "S2_NO_SIGNIFICANT_PATTERN_AT_ACTION_VALUES__DOES_NOT_EXCLUDE_SILENT_CARRIER"),
        (28, 7.99, "S2_PATTERN_BETA_THAL_RISK__PARTNER_TESTING_AND_COUNSELLING"),
        (28, 8.00, "S2_HBA2_VERY_HIGH__ALTERNATE_TECHNIQUE_REQUIRED"),
    ],
)
def test_hba2_action_values_at_the_boundary(mch: float, hba2: float, draft: str) -> None:
    out = SERVICE.interpret(cbc(mch_pg=mch, mcv_fl=80), hplc(hba2_pct=hba2))
    assert out.draft_output == draft


def test_stage_follows_whether_an_hplc_was_supplied() -> None:
    assert SERVICE.interpret(cbc(), None).stage == "cbc_only"
    assert SERVICE.interpret(cbc(), hplc()).stage == "cbc_plus_hplc"


# ---------------------------------------------------------------- safety behaviours


def test_a_normal_looking_cbc_is_never_clearance() -> None:
    out = SERVICE.interpret(cbc(mch_pg=30, mcv_fl=90), None)
    assert out.label == "indices_not_flagged"
    assert any("do not exclude a carrier state" in s for s in out.mandatory_statements)
    assert (
        "does not exclude" in out.label_description.lower()
        or "not exclude" in out.label_description.lower()
    )


def test_a_normal_looking_work_up_still_carries_the_not_excluded_statement() -> None:
    out = SERVICE.interpret(cbc(mch_pg=30, mcv_fl=90), hplc())
    assert out.label == "no_pattern_flagged_on_this_work_up"
    assert any("not excluded" in s for s in out.mandatory_statements)


def test_low_ferritin_makes_the_alpha_or_iron_pattern_say_iron_first() -> None:
    kw = {"mch_pg": 23.5, "mcv_fl": 74, "hb_g_per_l": 120}
    plain = SERVICE.interpret(cbc(**kw), hplc(hba2_pct=2.6, hbf_pct=0.5))
    low = SERVICE.interpret(cbc(ferritin_status="low", **kw), hplc(hba2_pct=2.6, hbf_pct=0.5))
    assert plain.label == "pattern_suggests_alpha_thal_trait"
    assert low.label == "pattern_suggests_iron_deficiency_first"
    assert (
        low.draft_output == plain.draft_output
    )  # the label split changes nothing about the underlying rule


def test_out_of_scope_records_carry_no_clinical_flags() -> None:
    child = SERVICE.interpret(cbc(age_years=12, mch_pg=20), None)
    assert child.label == "cbc_incomplete"
    assert child.flags == ()
    assert [t.rule_id for t in child.trace] == ["V02"]
    transfused = SERVICE.interpret(cbc(transfused_last_4_months=True, mch_pg=20), hplc())
    assert transfused.label == "work_up_incomplete"
    assert transfused.flags == ()


def test_transfusion_history_unknown_is_treated_as_not_interpretable() -> None:
    out = SERVICE.interpret(CbcInput(age_years=30, hb_g_per_l=130, mcv_fl=80, mch_pg=26), None)
    assert out.label == "cbc_incomplete"
    assert out.matched_rule_id == "V03"


def test_missing_values_are_never_imputed() -> None:
    assert SERVICE.interpret(cbc(mch_pg=None), None).label == "cbc_incomplete"
    assert SERVICE.interpret(cbc(), HplcInput()).label == "work_up_incomplete"
    assert SERVICE.interpret(cbc(), hplc(hba2_is_total=False)).label == "work_up_incomplete"


def test_low_haemoglobin_at_the_cbc_stage_is_case_by_case() -> None:
    out = SERVICE.interpret(cbc(hb_g_per_l=76, mch_pg=20), None)
    assert out.label == "cbc_incomplete"
    assert out.matched_rule_id == "V04"


def test_output_always_says_it_is_not_a_diagnosis_and_names_the_prior_art() -> None:
    out = SERVICE.interpret(cbc(), None)
    assert "not a diagnosis" in out.not_a_diagnosis.lower()
    assert "not claimed as new" in out.prior_art_note
    assert "extrapolation" in out.population_caveat
    assert out.needs_clinician_signoff is True


def test_sources_and_disagreements_travel_with_the_answer() -> None:
    out = SERVICE.interpret(cbc(mch_pg=28, mcv_fl=84), hplc(hba2_pct=3.8))
    assert out.draft_output == "S2_BORDERLINE_HBA2__CLINICIAN_REVIEW"
    assert out.sources_disagree
    assert {s.id for s in out.sources} >= {"NHS-ANTE"}
    assert all(s.title for s in out.sources)


def test_ruleset_version_carries_a_content_hash() -> None:
    base, _, digest = SERVICE.ruleset_version.partition("+")
    assert base == "bayan-haem-0.1-draft"
    assert len(digest) == 12
    assert SERVICE.interpret(cbc(), None).ruleset_version == SERVICE.ruleset_version


def test_the_rule_table_view_is_complete() -> None:
    view = SERVICE.rules_view()
    assert view.needs_clinician_signoff is True
    assert len(view.rules) == 24
    assert set(view.cbc_only_labels) == CBC_ONLY_LABELS
    assert set(view.cbc_plus_hplc_labels) == HPLC_LABELS
    assert view.rules_deliberately_left_out
    assert all(r.needs_clinician_signoff for r in view.rules)
    assert "carrier" in view.forbidden_outputs_unless_a_cited_guideline_allows


# ---------------------------------------------------------------- input validation


@pytest.mark.parametrize(
    "bad",
    [
        {"hb_g_per_l": 5000},
        {"hb_g_per_l": -3},
        {"mcv_fl": 5},
        {"mch_pg": 900},
        {"age_years": 200},
        {"age_years": -1},
        {"pregnant": "maybe"},
        {"ferritin_status": "high"},
        {"sex": "X"},
    ],
)
def test_physiologically_impossible_input_is_rejected(bad: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        cbc(**bad)


@pytest.mark.parametrize(
    "bad",
    [{"hba2_pct": 250}, {"hba2_pct": -1}, {"hbf_pct": 101}, {"variant_detected": "Q"}],
)
def test_impossible_hplc_input_is_rejected(bad: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        hplc(**bad)


def test_unknown_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        CbcInput(**{"mch_pg": 27, "diagnosis": "thalassaemia"})  # type: ignore[arg-type]


# ---------------------------------------------------------------- the safe rule evaluator


NAMES = frozenset({"a", "b"})


@pytest.mark.parametrize(
    "text",
    [
        "__import__('os').system('x')",
        "a.real > 1",
        "(lambda: 1)()",
        "[1, 2]",
        "a + b",
        "a if b else 1",
        "open('f')",
        "undeclared > 1",
        "-a < 1",
        "a < f(1)",
        "a ==",
    ],
)
def test_the_evaluator_refuses_anything_but_comparisons_and_booleans(text: str) -> None:
    with pytest.raises(RuleError):
        parse_condition(text, NAMES)


def test_unknown_never_satisfies_a_threshold() -> None:
    tree = parse_condition("a < 27 or b >= 3", NAMES)
    assert evaluate(tree, {"a": None, "b": None}) is False
    assert evaluate(tree, {"a": 26.9, "b": None}) is True
    assert evaluate(parse_condition("a is None", NAMES), {"a": None, "b": 1}) is True
    assert evaluate(parse_condition("4.0 <= a < 8.0", NAMES), {"a": 4.0, "b": 0}) is True
    assert evaluate(parse_condition("4.0 <= a < 8.0", NAMES), {"a": 8.0, "b": 0}) is False
    assert evaluate(parse_condition("a is not True", NAMES), {"a": "unknown", "b": 0}) is True


def test_a_service_can_be_rebuilt_from_the_loaded_rules() -> None:
    assert isinstance(HaemService(RULESET), HaemService)
