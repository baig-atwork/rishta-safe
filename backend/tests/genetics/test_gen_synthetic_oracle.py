"""Synthetic couples, the independent oracle, and engine-versus-oracle agreement.

Marker `oracle`: these compare the engine with an independent derivation (the allele-level oracle) and the correlated-miss
closed form with gene-dropping simulation. Agreement shows consistency of two derivations of the same rules; it is not
clinical validation, and the published 4 percent bracket is context, not validation.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from bayan.core.contracts import Inheritance, Sex
from bayan.core.types import Relationship
from bayan.genetics import residual
from bayan.genetics.evaluation import engine_signature, oracle_signature, run_engine_evaluation
from bayan.genetics.oracle import oracle_classify
from bayan.genetics.service import GeneticsService
from bayan.genetics.synthetic import (
    DEFAULT_MIX,
    LocusSpec,
    SyntheticCouple,
    SyntheticPerson,
    _pick,
    build_locus_specs,
    default_loci,
    drop_partners,
    founder_sampler,
    generate_couples,
    reports_for,
)

# ---------------------------------------------------------------- generator (unit)


@pytest.mark.unit
def test_generation_is_deterministic_in_the_seed() -> None:
    a = generate_couples(300, 5)
    b = generate_couples(300, 5)
    c = generate_couples(300, 6)
    assert a == b
    assert a != c
    assert len(a) == 300
    assert len({x.couple_id for x in a}) == 300


@pytest.mark.unit
def test_every_synthetic_person_is_labelled_synthetic_by_id() -> None:
    couples = generate_couples(20, 1)
    assert all(c.couple_id.startswith("SYN-") for c in couples)
    assert all(c.female.sex is Sex.FEMALE and c.male.sex is Sex.MALE for c in couples)


@pytest.mark.unit
def test_loci_come_from_the_catalogue_and_skip_specialist_and_dominant_rows() -> None:
    loci = default_loci()
    keys = [s.key for s in loci]
    assert "HBB" in keys
    assert "g6pd_deficiency" in keys
    assert "hb_variant_other" not in keys
    assert "hb_h_disease" not in keys
    assert "neurofibromatosis_type_1" not in keys
    hbb = next(s for s in loci if s.key == "HBB")
    assert hbb.k == 2
    assert hbb.compound_condition_id == "hbb_compound_haemoglobin_disorder"
    assert next(s for s in loci if s.key == "g6pd_deficiency").inheritance is Inheritance.X_LINKED


@pytest.mark.unit
def test_mix_must_be_valid() -> None:
    with pytest.raises(ValueError, match="cannot be generated"):
        generate_couples(5, 1, {Relationship.OTHER_CLOSE: 1.0})
    with pytest.raises(ValueError, match="must not all be zero"):
        generate_couples(5, 1, {Relationship.UNRELATED: 0.0})
    with pytest.raises(ValueError, match="non-negative"):
        generate_couples(5, 1, {Relationship.UNRELATED: -1.0})


@pytest.mark.unit
def test_relationship_mix_follows_the_weights() -> None:
    couples = generate_couples(4000, 3)
    counts = {r: sum(1 for c in couples if c.relationship is r) for r in DEFAULT_MIX}
    for rel, weight in DEFAULT_MIX.items():
        assert counts[rel] / 4000 == pytest.approx(weight, abs=0.03)


@pytest.mark.unit
def test_observed_reports_never_include_undetectable_alleles() -> None:
    loci = default_loci()
    spec = next(s for s in loci if s.key == "cystic_fibrosis")
    undetectable = spec.k + 1  # a pathogenic allele the panel misses
    person = SyntheticPerson(
        "p1",
        Sex.FEMALE,
        {s.key: ((undetectable, 0) if s.key == spec.key else (0, 0)) for s in loci},
    )
    couple = SyntheticCouple(
        "c",
        Relationship.UNRELATED,
        person,
        SyntheticPerson(
            "p2",
            Sex.MALE,
            {s.key: (0, 0) if s.inheritance is not Inheritance.X_LINKED else (0,) for s in loci},
        ),
    )
    observed, _ = reports_for(couple, loci, observed=True)
    truth, _ = reports_for(couple, loci, observed=False)
    assert observed.findings == ()
    assert [f.condition_id for f in truth.findings] == ["cystic_fibrosis"]


# ---------------------------------------------------------------- the oracle on hand-built couples (unit)

LOCI = default_loci()


def _couple(
    female_alleles: dict[str, tuple[int, ...]], male_alleles: dict[str, tuple[int, ...]]
) -> SyntheticCouple:
    def full(partial: dict[str, tuple[int, ...]], sex: Sex) -> dict[str, tuple[int, ...]]:
        base = {
            s.key: ((0,) if (s.inheritance is Inheritance.X_LINKED and sex is Sex.MALE) else (0, 0))
            for s in LOCI
        }
        base.update(partial)
        return base

    return SyntheticCouple(
        "hand",
        Relationship.UNRELATED,
        SyntheticPerson("f", Sex.FEMALE, full(female_alleles, Sex.FEMALE)),
        SyntheticPerson("m", Sex.MALE, full(male_alleles, Sex.MALE)),
    )


@pytest.mark.unit
def test_oracle_both_carriers_autosomal() -> None:
    v = oracle_classify(
        _couple({"cystic_fibrosis": (1, 0)}, {"cystic_fibrosis": (0, 1)}), LOCI, observed=True
    )
    assert v.category == "shared_result_found"
    (s,) = v.shared
    assert s.condition_id == "cystic_fibrosis"
    assert s.basis == "both_carriers"
    assert s.outcomes == (
        ("affected", 25, "any_child"),
        ("carrier", 50, "any_child"),
        ("neither", 25, "any_child"),
    )


@pytest.mark.unit
def test_oracle_hbb_two_classes_pair_into_the_compound() -> None:
    v = oracle_classify(_couple({"HBB": (1, 0)}, {"HBB": (0, 2)}), LOCI, observed=True)
    (s,) = v.shared
    assert s.condition_id == "hbb_compound_haemoglobin_disorder"


@pytest.mark.unit
def test_oracle_observed_ignores_undetectable_alleles_but_truth_does_not() -> None:
    undetectable_cf = next(s for s in LOCI if s.key == "cystic_fibrosis").k + 1
    c = _couple({"cystic_fibrosis": (1, 0)}, {"cystic_fibrosis": (undetectable_cf, 0)})
    assert oracle_classify(c, LOCI, observed=True).category == "no_shared_change_found"
    assert oracle_classify(c, LOCI, observed=False).category == "shared_result_found"


@pytest.mark.unit
def test_oracle_x_linked_cases() -> None:
    carrier_female = oracle_classify(_couple({"g6pd_deficiency": (1, 0)}, {}), LOCI, observed=True)
    assert carrier_female.shared[0].basis == "x_linked_carrier_female"
    affected_male = oracle_classify(_couple({}, {"g6pd_deficiency": (1,)}), LOCI, observed=True)
    assert affected_male.shared[0].basis == "x_linked_affected_male"
    open_question = oracle_classify(_couple({"g6pd_deficiency": (1, 1)}, {}), LOCI, observed=True)
    assert open_question.category == "more_information_needed"
    assert open_question.unresolved == ("g6pd_deficiency",)


@pytest.mark.unit
def test_oracle_and_engine_agree_on_the_hand_built_couples(svc: GeneticsService) -> None:
    cases = [
        _couple({"cystic_fibrosis": (1, 0)}, {"cystic_fibrosis": (0, 1)}),
        _couple({"HBB": (1, 2)}, {"HBB": (1, 0)}),  # compound affected with a carrier
        _couple({"HBB": (2, 2)}, {"HBB": (2, 0)}),  # sickle affected with a sickle carrier
        _couple({"stargardt_disease": (1, 1)}, {"stargardt_disease": (1, 1)}),
        _couple({"g6pd_deficiency": (1, 1)}, {"g6pd_deficiency": (1,)}),
        _couple({"g6pd_deficiency": (1, 0)}, {"g6pd_deficiency": (1,)}),
        _couple({"cystic_fibrosis": (1, 1)}, {}),
        _couple({}, {}),
    ]
    for couple in cases:
        reports = reports_for(couple, LOCI, observed=True)
        result = svc.compute_couple_result(couple.couple_id, reports, couple.relationship)
        verdict = oracle_classify(couple, LOCI, observed=True)
        assert engine_signature(result) == oracle_signature(verdict)


# ---------------------------------------------------------------- engine versus oracle on synthetic couples


@pytest.mark.oracle
@pytest.mark.slow
def test_engine_agrees_with_the_oracle_on_20000_synthetic_couples() -> None:
    report = run_engine_evaluation(20_000, seed=20261120)
    assert report.agreement_total == 20_000
    assert report.agreement_agree == 20_000, report.disagreement_couple_ids
    assert report.runtime_seconds < 60
    # Every relationship stratum was exercised and every category (including the engine gates) appeared.
    assert {r.relationship for r in report.by_relationship} == {r.value for r in DEFAULT_MIX}
    assert set(report.categories_overall) == {
        "shared_result_found",
        "no_shared_change_found",
        "more_information_needed",
    }
    # The engine can only report what the panel detected, so it never invents a shared result.
    assert all(r.ar_false_shared == 0 for r in report.by_relationship)


@pytest.mark.oracle
@pytest.mark.slow
def test_engine_agrees_with_the_oracle_under_a_rare_state_stress_setting() -> None:
    """Triple carrier frequencies: affected partners, compound HBB pairs and X-linked pairs become common."""
    report = run_engine_evaluation(20_000, seed=99, freq_scale=3.0)
    assert report.agreement_agree == report.agreement_total == 20_000, (
        report.disagreement_couple_ids
    )


@pytest.mark.oracle
@pytest.mark.slow
def test_related_couples_are_missed_more_often_than_unrelated_ones() -> None:
    report = run_engine_evaluation(
        30_000, seed=7, mix={Relationship.UNRELATED: 0.5, Relationship.FIRST_COUSIN: 0.5}
    )
    by = {r.relationship: r for r in report.by_relationship}
    unrelated, cousins = by["unrelated"], by["first_cousin"]
    # More truly shared results among cousins, and a higher miss rate per 10,000 screened (the shared-miss effect).
    assert (
        cousins.ar_truly_shared / cousins.couples
        > 1.5 * unrelated.ar_truly_shared / unrelated.couples
    )
    assert cousins.ar_missed_per_10000 > unrelated.ar_missed_per_10000


@pytest.mark.oracle
@pytest.mark.slow
def test_random_mating_at_risk_rate_sits_inside_the_published_bracket() -> None:
    """Reported as a bracket, not as validation (see the evaluation module docstring)."""
    report = run_engine_evaluation(40_000, seed=3, mix={Relationship.UNRELATED: 1.0})
    rm = report.random_mating
    se = math.sqrt(
        rm.closed_form_autosomal_at_risk_rate
        * (1 - rm.closed_form_autosomal_at_risk_rate)
        / rm.couples
    )
    assert abs(rm.observed_autosomal_at_risk_rate - rm.closed_form_autosomal_at_risk_rate) < 5 * se
    published_all_gene_figure = max(f.value_pct for f in rm.published_context) / 100
    # A ten-locus demonstration panel must sit below the hundreds-of-genes figure.
    assert 0.005 < rm.observed_autosomal_at_risk_rate < published_all_gene_figure
    assert "not " in rm.note
    assert "validation" in rm.note


# ---------------------------------------------------------------- gene dropping reproduces the inbreeding coefficients

_F = {
    Relationship.UNRELATED: 0.0,
    Relationship.SECOND_COUSIN: 1 / 64,
    Relationship.FIRST_COUSIN_ONCE_REMOVED: 1 / 32,
    Relationship.FIRST_COUSIN: 1 / 16,
    Relationship.DOUBLE_FIRST_COUSIN: 1 / 8,
}


def _single_locus(q: float, d: float) -> LocusSpec:
    return LocusSpec(
        key="x",
        gene="X",
        inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
        class_conditions=("x",),
        q=(q,),
        d=(d,),
    )


@pytest.mark.oracle
@pytest.mark.slow
@pytest.mark.parametrize("rel", list(_F))
def test_gene_dropping_reproduces_the_inbreeding_coefficient(rel: Relationship) -> None:
    """P(child homozygous) = (1 - F) q^2 + F q, which fixes F for each pedigree (research report 03, 2.3)."""
    q, n = 0.2, 1_000_000
    rng = np.random.default_rng(1234)
    a, b = drop_partners(rng, rel, n, founder_sampler(rng, _single_locus(q, 1.0)))
    child_affected = (_pick(rng, a) > 0) & (_pick(rng, b) > 0)
    expected = residual.prior_affected_child(q, _F[rel])
    se = math.sqrt(expected * (1 - expected) / n)
    assert abs(child_affected.mean() - expected) < 5 * se


# ---------------------------------------------------------------- the correlated-miss closed form versus simulation


def _simulate_negative_pair(
    q: float, d: float, rel: Relationship, n: int, seed: int
) -> tuple[int, int]:
    """Return (couples where both partners are unaffected and test negative, of those both carry a pathogenic allele)."""
    rng = np.random.default_rng(seed)
    a, b = drop_partners(rng, rel, n, founder_sampler(rng, _single_locus(q, d)))
    n_a, n_b = (a > 0).sum(axis=1), (b > 0).sum(axis=1)
    unaffected = (n_a < 2) & (n_b < 2)
    negative = unaffected & ((a == 1).sum(axis=1) == 0) & ((b == 1).sum(axis=1) == 0)
    both_carry = (n_a == 1) & (n_b == 1)
    return int(negative.sum()), int((negative & both_carry).sum())


@pytest.mark.oracle
@pytest.mark.slow
def test_correlated_miss_form_matches_gene_dropping_for_first_cousins() -> None:
    q, d, f = 0.02, 0.80, 1 / 16
    n_neg, n_hit = _simulate_negative_pair(q, d, Relationship.FIRST_COUSIN, 4_000_000, seed=11)
    simulated = n_hit / n_neg
    correlated = residual.residual_couple_correlated(q, d, f)
    naive = residual.residual_couple_naive(q, d)
    # Poisson noise on n_hit plus the first-order approximation in the closed form: within 10 percent.
    assert simulated == pytest.approx(correlated, rel=0.10)
    # The naive independent update understates by more than 10x, as in the research (about 16x).
    assert simulated > 10 * naive


@pytest.mark.oracle
@pytest.mark.slow
def test_correlated_and_naive_forms_coincide_for_unrelated_partners() -> None:
    q, d = 0.02, 0.80
    n_neg, n_hit = _simulate_negative_pair(q, d, Relationship.UNRELATED, 6_000_000, seed=12)
    simulated = n_hit / n_neg
    expected = residual.residual_couple_correlated(q, d, 0.0)
    tolerance = 4 / math.sqrt(max(n_hit, 1))  # four Poisson standard deviations, relative
    assert abs(simulated - expected) / expected < tolerance + 0.03


@pytest.mark.oracle
def test_build_locus_specs_scales_frequencies(svc: GeneticsService) -> None:
    panel = svc.panel("uae_demo_panel_v1")
    base = {s.key: s for s in build_locus_specs(svc.catalogue(), panel)}
    tripled = {s.key: s for s in build_locus_specs(svc.catalogue(), panel, freq_scale=3.0)}
    assert (
        tripled["congenital_adrenal_hyperplasia"].q[0] > base["congenital_adrenal_hyperplasia"].q[0]
    )
    with pytest.raises(ValueError, match="positive"):
        build_locus_specs(svc.catalogue(), panel, freq_scale=0)


@pytest.mark.oracle
def test_the_comparison_is_not_vacuous_a_corrupted_table_is_caught(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from bayan.genetics import engine

    monkeypatch.setitem(engine._AR_TABLE, ("carrier", "carrier"), (24, 50, 26))
    report = run_engine_evaluation(2_000, seed=5)
    assert report.agreement_agree < report.agreement_total

    monkeypatch.undo()
    monkeypatch.setitem(
        engine._XL_TABLE, (0, 1), ((0, 0, 100), (0, 50, 50), "x_linked_affected_male", "E21")
    )
    report = run_engine_evaluation(2_000, seed=5)
    assert report.agreement_agree < report.agreement_total
