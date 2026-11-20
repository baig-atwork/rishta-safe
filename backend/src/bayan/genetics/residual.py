"""Residual-chance closed forms. INTERNAL ANALYSIS ONLY.

These functions are used by tests and by the evaluation report to show why the product gives a detection rate and its
limits instead of a residual-risk number. They are NEVER exposed through an API route and NEVER shown in the UI
(spec section 2, rule 6; ADR 0005; ADR 0101).

STATUS: a statistician or genetic epidemiologist has NOT reviewed this derivation. The algebra is checked against
gene-dropping simulation (`tests/genetics/test_gen_oracle.py`, marker `oracle`); that confirms the algebra, not the
modelling assumption.

MODELLING ASSUMPTION (explicit): each pathogenic allele lineage has ONE detection probability d, shared by every copy
descended from the same founder allele. A panel miss is therefore a property of the variant, not of the assay run.
If real misses were mostly random assay error (independent per sample) the correlation, and the understatement below,
would be smaller. Panel genes are treated as independent. Carrier frequency c = 2q(1 - q) uses the total pathogenic
allele frequency q of the gene. F is the inbreeding coefficient of the couple's children; psi = 2F is the chance that
the partner carries, by descent, the specific allele the first partner carries.

Formula numbers refer to research report 03 section 2.3.
"""

from __future__ import annotations

import math

__all__ = [
    "allele_frequency",
    "carrier_frequency",
    "ibd_probability",
    "posterior_partner_carrier_known_variant",
    "prior_affected_child",
    "prior_both_carriers",
    "residual_couple_correlated",
    "residual_couple_naive",
    "residual_single_acmg",
    "residual_single_exact",
    "understatement_factor",
]


def _check_unit(name: str, value: float) -> None:
    if not 0.0 <= value <= 1.0:
        msg = f"{name} must lie in [0, 1], got {value}"
        raise ValueError(msg)


def carrier_frequency(q: float) -> float:
    """Hardy-Weinberg carrier frequency c = 2q(1 - q)."""
    _check_unit("q", q)
    return 2.0 * q * (1.0 - q)


def allele_frequency(c: float) -> float:
    """Inverse of `carrier_frequency` on q <= 1/2: q = (1 - sqrt(1 - 2c)) / 2."""
    if not 0.0 <= c <= 0.5:
        msg = f"carrier frequency must lie in [0, 0.5] for a single allele class, got {c}"
        raise ValueError(msg)
    return (1.0 - math.sqrt(1.0 - 2.0 * c)) / 2.0


def ibd_probability(f: float) -> float:
    """psi = 2F, the chance a partner carries the specific allele by descent."""
    _check_unit("F", f)
    return 2.0 * f


def prior_both_carriers(c: float, f: float) -> float:
    """Formula 1: P(both partners carry a pathogenic allele in the gene) = c [psi + (1 - psi) c]."""
    psi = ibd_probability(f)
    return c * (psi + (1.0 - psi) * c)


def prior_affected_child(q: float, f: float) -> float:
    """Formula 2: (1 - F) q^2 + F q, the chance a child is homozygous at the gene before any test."""
    _check_unit("q", q)
    _check_unit("F", f)
    return (1.0 - f) * q * q + f * q


def residual_single_acmg(c: float, d: float) -> float:
    """Formula 3, first order (ACMG 2021): c (1 - d)."""
    _check_unit("d", d)
    return c * (1.0 - d)


def residual_single_exact(c: float, d: float) -> float:
    """Formula 3, exact Bayes: c (1 - d) / (1 - c d)."""
    _check_unit("d", d)
    return c * (1.0 - d) / (1.0 - c * d)


def residual_couple_correlated(q: float, d: float, f: float) -> float:
    """Formula 4: P(both carry | both partners tested negative), misses shared by descent.

    c_u [psi + (1 - psi) c_u] / (1 - c d)^2 with c_u = c (1 - d): an allele shared by descent has one detectability,
    so the shared component is missed once, not twice. First-order: the denominator treats the two negatives as
    independent; against simulation it agreed within a few percent in the checked settings.
    """
    c = carrier_frequency(q)
    c_u = c * (1.0 - d)
    psi = ibd_probability(f)
    return c_u * (psi + (1.0 - psi) * c_u) / (1.0 - c * d) ** 2


def residual_couple_naive(q: float, d: float) -> float:
    """The textbook independent update, c_u^2 / (1 - c d)^2. Wrong for related partners; kept to show how wrong."""
    c = carrier_frequency(q)
    c_u = c * (1.0 - d)
    return c_u * c_u / (1.0 - c * d) ** 2


def understatement_factor(q: float, d: float, f: float) -> float:
    """How many times the naive update understates the correlated form (about 16x at q=0.02, d=0.8, first cousins)."""
    return residual_couple_correlated(q, d, f) / residual_couple_naive(q, d)


def posterior_partner_carrier_known_variant(q: float, d: float, f: float, s: float) -> float:
    """Formula 5: one partner is a confirmed carrier of variant v; the other tested negative.

    s is the assay sensitivity for the known variant v, d the panel detection rate for any other variant.
    With s = 1 this reduces to c (1 - d) / (1 - c d): relatedness drops out once v is tested directly.
    """
    _check_unit("s", s)
    c = carrier_frequency(q)
    psi = ibd_probability(f)
    p_neither = (1.0 - psi) * (1.0 - c)
    p_by_descent = psi * (1.0 - c)
    p_independent = (1.0 - psi) * c
    miss = p_by_descent * (1.0 - s) + p_independent * (1.0 - d)
    return miss / (p_neither + miss)
