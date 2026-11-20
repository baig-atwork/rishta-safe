"""Detection statements (no residual number) and the internal residual closed forms.

The residual module is INTERNAL analysis: these tests pin its algebra to the hand-checked numbers in research report 03
section 2.3 (q = 0.02, d = 0.80). They do not validate the modelling assumption (one detection probability per allele,
shared by descent); a statistician has not reviewed it.
"""

from __future__ import annotations

import re

import pytest

from bayan.core.types import Relationship
from bayan.genetics import residual
from bayan.genetics.detection import (
    KEY_ALPHA_LOCUS,
    KEY_PANEL_RATE,
    KEY_RELATED_MISSES,
    build_detection_statements,
    is_related,
    rate_label,
)
from bayan.genetics.service import GeneticsService

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------- detection statements


def test_rate_labels_use_natural_frequencies() -> None:
    assert rate_label(0.90) == "about 9 in 10"
    assert rate_label(0.80) == "about 8 in 10"
    assert rate_label(0.95) == "about 95 in 100"


def test_unrelated_statements_have_no_caveat(svc: GeneticsService) -> None:
    statements = svc.detection_statements("uae_demo_panel_v1", Relationship.UNRELATED)
    keys = [s.statement_key for s in statements]
    assert keys == [KEY_PANEL_RATE, KEY_ALPHA_LOCUS]
    assert all(s.assumed and not s.related_couple_caveat for s in statements)


@pytest.mark.parametrize("rel", [r for r in Relationship if r is not Relationship.UNRELATED])
def test_related_statements_set_the_caveat(svc: GeneticsService, rel: Relationship) -> None:
    statements = svc.detection_statements("uae_demo_panel_v1", rel)
    assert KEY_RELATED_MISSES in [s.statement_key for s in statements]
    assert all(s.related_couple_caveat for s in statements)
    assert is_related(rel)


def test_statements_never_show_a_residual_number(svc: GeneticsService) -> None:
    for rel in Relationship:
        for panel in svc.panels().panels:
            for s in svc.detection_statements(panel.id, rel):
                text = s.detection_rate_label.lower()
                assert "residual" not in text
                assert "%" not in text
                assert "chance of" not in text
                # Only natural-frequency fragments "N in 10" or "N in 100" appear as numbers.
                numbers = re.findall(r"\d+", text)
                assert all(
                    n in {"10", "100", "8", "9", "95", "1"} or int(n) <= 100 for n in numbers
                )
                assert "assumed" in text


def test_haemoglobin_only_panel_reports_the_alpha_locus_limit(svc: GeneticsService) -> None:
    panel = svc.panel("haemoglobinopathy_demo_panel_v1")
    statements = build_detection_statements(panel, Relationship.UNRELATED)
    assert statements[1].statement_key == KEY_ALPHA_LOCUS
    assert "technically complex" in statements[1].detection_rate_label


# ---------------------------------------------------------------- residual closed forms (research report 03, 2.3)

Q, D = 0.02, 0.80


def test_carrier_frequency_and_its_inverse() -> None:
    c = residual.carrier_frequency(Q)
    assert c == pytest.approx(0.0392)
    assert residual.allele_frequency(c) == pytest.approx(Q)
    assert residual.allele_frequency(residual.carrier_frequency(0.2)) == pytest.approx(0.2)


@pytest.mark.parametrize(
    ("f", "one_in"),
    [(0.0, 651), (1 / 16, 160), (1 / 8, 91)],
)
def test_prior_both_carriers_matches_worked_example_one(f: float, one_in: int) -> None:
    c = residual.carrier_frequency(Q)
    assert 1 / residual.prior_both_carriers(c, f) == pytest.approx(one_in, rel=0.01)


@pytest.mark.parametrize(
    ("f", "one_in"),
    [(0.0, 2500), (1 / 16, 615), (1 / 8, 351)],
)
def test_prior_affected_child_matches_worked_example_one(f: float, one_in: int) -> None:
    assert 1 / residual.prior_affected_child(Q, f) == pytest.approx(one_in, rel=0.01)


def test_single_partner_residuals() -> None:
    c = residual.carrier_frequency(Q)
    assert residual.residual_single_acmg(c, D) == pytest.approx(0.00784)
    assert residual.residual_single_exact(c, D) == pytest.approx(0.00809, abs=2e-5)


def test_correlated_miss_form_matches_worked_example_two() -> None:
    first_cousin = residual.residual_couple_correlated(Q, D, 1 / 16)
    unrelated = residual.residual_couple_correlated(Q, D, 0.0)
    assert first_cousin == pytest.approx(0.00110, rel=0.02)
    assert unrelated == pytest.approx(0.000066, rel=0.03)
    assert residual.residual_couple_naive(Q, D) == pytest.approx(0.000066, rel=0.03)


def test_the_naive_update_understates_for_related_couples() -> None:
    assert residual.understatement_factor(Q, D, 1 / 16) == pytest.approx(16.7, rel=0.05)
    assert residual.understatement_factor(0.005, D, 1 / 16) > 50  # about 60x at the rarer gene
    assert residual.understatement_factor(Q, D, 0.0) == pytest.approx(1.0)


def test_known_variant_posterior_matches_worked_example_three() -> None:
    f = 1 / 16
    assert residual.posterior_partner_carrier_known_variant(Q, D, f, 1.0) == pytest.approx(
        0.0081, abs=1e-4
    )
    assert residual.posterior_partner_carrier_known_variant(Q, D, f, 0.99) == pytest.approx(
        0.0095, abs=1e-4
    )
    # With the known variant tested directly, relatedness drops out.
    c = residual.carrier_frequency(Q)
    assert residual.posterior_partner_carrier_known_variant(Q, D, f, 1.0) == pytest.approx(
        residual.residual_single_exact(c, D), rel=1e-9
    )


def test_inputs_are_range_checked() -> None:
    with pytest.raises(ValueError, match="q must lie"):
        residual.carrier_frequency(1.5)
    with pytest.raises(ValueError, match="d must lie"):
        residual.residual_single_acmg(0.1, -0.1)
    with pytest.raises(ValueError, match="carrier frequency must lie"):
        residual.allele_frequency(0.9)


def test_module_states_its_status() -> None:
    doc = residual.__doc__ or ""
    assert "INTERNAL" in doc
    assert "NOT reviewed" in doc or "has NOT reviewed" in doc
    assert "one detection probability" in doc.lower()
