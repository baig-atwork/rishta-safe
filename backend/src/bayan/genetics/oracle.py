"""An independent oracle: classify a synthetic couple from its alleles.

The engine (`engine.py`) reasons about person-level findings with explicit decision tables. This oracle reasons about
ALLELES: it lists the gametes each partner can pass on, enumerates every child genotype (four equally likely
combinations for an autosomal locus; sons and daughters separately for an X-linked locus), and reads the outcome lines
off that enumeration. It imports nothing from `engine.py` and shares no helper function with it, so agreement between the
two is evidence that two different derivations of the same Mendelian arithmetic coincide, not that one copied the other.

It can classify what a laboratory OBSERVED (detectable alleles only: the answer the engine should give from the
reports) or the TRUTH (all pathogenic alleles: the answer a perfect test would give). The gap between the two is the
panel's miss rate, which the evaluation reports.

Allele code convention (see `synthetic.py`): 0 normal; for K allele classes 1..K detectable, K+1..2K undetectable.

Scope: this covers the simple couple table only. Pending reports, VUS, panel mismatch and specialist-read conditions
are engine gates tested on their own in `tests/genetics/test_gen_engine.py`.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from bayan.genetics.synthetic import LocusSpec, SyntheticCouple

_OutLine = tuple[str, int, str]  # (label, per_100, applies_to)


@dataclass(frozen=True, slots=True)
class OracleShared:
    locus: str
    inheritance: str  # "AR" or "XL"
    condition_id: str
    basis: str
    outcomes: tuple[_OutLine, ...]


@dataclass(frozen=True, slots=True)
class OracleVerdict:
    category: str  # one of the three result labels, as strings
    shared: tuple[OracleShared, ...]
    unresolved: tuple[str, ...]


def _gametes(alleles: Sequence[int], k: int, *, observed: bool) -> list[int]:
    """Class number (0 for normal) carried by each of the person's alleles, as a gamete would carry it."""
    out: list[int] = []
    for code in alleles:
        if code == 0 or (observed and code > k):
            out.append(0)
        else:
            out.append((code - 1) % k + 1)
    return out


def _autosomal(
    spec: LocusSpec, female: Sequence[int], male: Sequence[int], *, observed: bool
) -> OracleShared | None:
    ga = _gametes(female, spec.k, observed=observed)
    gb = _gametes(male, spec.k, observed=observed)
    children = [(x, y) for x in ga for y in gb]  # four equally likely children, 25 per 100 each
    affected = [(x, y) for x, y in children if x > 0 and y > 0]
    if not affected:
        return None
    carriers = [(x, y) for x, y in children if (x > 0) != (y > 0)]
    n_aff, n_car = 25 * len(affected), 25 * len(carriers)
    n_nei = 100 - n_aff - n_car
    homozygous_classes = {x for x, y in affected if x == y}
    if len(homozygous_classes) == 1 and all(x == y for x, y in affected):
        (cls,) = homozygous_classes
        condition = spec.class_conditions[cls - 1]
    else:
        assert spec.compound_condition_id is not None
        condition = spec.compound_condition_id
    path_a = sum(1 for g in ga if g > 0)
    path_b = sum(1 for g in gb if g > 0)
    basis = {
        (1, 1): "both_carriers",
        (2, 1): "affected_partner_and_carrier",
        (1, 2): "affected_partner_and_carrier",
        (2, 2): "both_affected",
    }[(path_a, path_b)]
    lines = tuple(
        (label, n, "any_child")
        for label, n in (("affected", n_aff), ("carrier", n_car), ("neither", n_nei))
        if n > 0
    )
    return OracleShared(spec.key, "AR", condition, basis, lines)


def _xlinked(
    spec: LocusSpec, female: Sequence[int], male: Sequence[int], *, observed: bool
) -> tuple[OracleShared | None, bool]:
    """Return (shared result or None, unresolved flag)."""
    ga = [g > 0 for g in _gametes(female, spec.k, observed=observed)]
    y = _gametes(male, spec.k, observed=observed)[0] > 0
    k_copies = sum(ga)
    if k_copies == 2 and not y:
        return None, True  # an affected female with an unaffected male needs a clinical read
    if k_copies == 0 and not y:
        return None, False
    sons_aff = 50 * sum(1 for g in ga if g)  # a son takes the mother's gamete and the father's Y
    daughters = [
        int(g) + int(y) for g in ga
    ]  # a daughter takes the mother's gamete and the father's X
    d_aff = 50 * sum(1 for c in daughters if c == 2)
    d_car = 50 * sum(1 for c in daughters if c == 1)
    lines: list[_OutLine] = []
    for label, n in (("affected", sons_aff), ("carrier", 0), ("neither", 100 - sons_aff)):
        if n > 0:
            lines.append((label, n, "son"))
    for label, n in (("affected", d_aff), ("carrier", d_car), ("neither", 100 - d_aff - d_car)):
        if n > 0:
            lines.append((label, n, "daughter"))
    basis = {
        (1, False): "x_linked_carrier_female",
        (0, True): "x_linked_affected_male",
        (1, True): "affected_partner_and_carrier",
        (2, True): "both_affected",
    }[(k_copies, y)]
    return OracleShared(spec.key, "XL", spec.class_conditions[0], basis, tuple(lines)), False


def oracle_classify(
    couple: SyntheticCouple, loci: Sequence[LocusSpec], *, observed: bool
) -> OracleVerdict:
    """Classify the couple from alleles. `observed`: detectable alleles only; otherwise the true genotypes."""
    shared: list[OracleShared] = []
    unresolved: list[str] = []
    for spec in loci:
        female = couple.female.alleles[spec.key]
        male = couple.male.alleles[spec.key]
        if spec.inheritance.value == "XL":
            hit, open_question = _xlinked(spec, female, male, observed=observed)
            if open_question:
                unresolved.append(spec.key)
        else:
            hit = _autosomal(spec, female, male, observed=observed)
        if hit is not None:
            shared.append(hit)
    if shared:
        category = "shared_result_found"
    elif unresolved:
        category = "more_information_needed"
    else:
        category = "no_shared_change_found"
    return OracleVerdict(category=category, shared=tuple(shared), unresolved=tuple(unresolved))
