"""Synthetic couples by gene dropping through defined pedigrees, with ground-truth genotypes.

EVERYTHING HERE IS SYNTHETIC. No real person, family or laboratory result is involved (spec rule 1).

Method. Founder alleles are drawn independently from the catalogue frequencies. Alleles are then dropped down a
defined pedigree (unrelated, second cousin, first cousin once removed, first cousin, double first cousin), one
independent segregation per locus (unlinked loci). The two partners are the two pedigree end members.

Allele codes (numpy int8): 0 is the normal allele; for a locus with K pathogenic allele classes, codes 1..K are
DETECTABLE pathogenic alleles of class 1..K and codes K+1..2K are the same classes but UNDETECTABLE by the panel.
Detectability is decided once per founder allele and travels with every copy by descent (the shared-miss assumption
stated in `residual.py`: one detection probability per allele lineage). A panel report contains only detectable alleles.

Limits (ADR 0103): X-linked loci are dropped independently in the two partners even for related couples (relatedness
changes X-linked pair probabilities only slightly and sex-aware X pedigrees are out of scope here); conditions that need
a specialist read (Hb variants, HbH) are not generated; allele classes within a locus share one allele-frequency model;
pedigree founders are assumed outbred. Frequencies are the catalogue's, many illustrative, so every rate derived from
these couples is a property of the synthetic population, not of the UAE.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from bayan.core.contracts import Finding, Inheritance, PersonReport, Sex, Zygosity
from bayan.core.types import Relationship
from bayan.genetics.catalogue import load_catalogue, load_panels
from bayan.genetics.models import ConditionCatalogue, PanelInfo
from bayan.genetics.residual import allele_frequency

AlleleArray = npt.NDArray[np.int8]

DEFAULT_PANEL_ID = "uae_demo_panel_v1"

# Roughly the Al-Gazali 1997 consanguinity structure in the project dossier (26.2 percent first cousins, 3.5 percent
# double first cousins, 50.5 percent consanguineous overall); the other splits are illustrative.
DEFAULT_MIX: Mapping[Relationship, float] = {
    Relationship.UNRELATED: 0.50,
    Relationship.SECOND_COUSIN: 0.08,
    Relationship.FIRST_COUSIN_ONCE_REMOVED: 0.05,
    Relationship.FIRST_COUSIN: 0.30,
    Relationship.DOUBLE_FIRST_COUSIN: 0.07,
}

GENERATED_RELATIONSHIPS: tuple[Relationship, ...] = tuple(DEFAULT_MIX)


@dataclass(frozen=True, slots=True)
class LocusSpec:
    """One locus: its allele classes, frequencies and per-class detection probability."""

    key: str  # locus group id, or the condition id for a single-condition locus
    gene: str
    inheritance: Inheritance
    class_conditions: tuple[str, ...]  # condition id of allele class 1..K
    q: tuple[float, ...]  # allele frequency of class 1..K
    d: tuple[float, ...]  # detection probability of class 1..K
    compound_condition_id: str | None = None

    @property
    def k(self) -> int:
        return len(self.class_conditions)


@dataclass(frozen=True, slots=True)
class SyntheticPerson:
    person_id: str
    sex: Sex
    alleles: Mapping[
        str, tuple[int, ...]
    ]  # locus key -> allele codes (2; or 1 for an X-linked male)


@dataclass(frozen=True, slots=True)
class SyntheticCouple:
    couple_id: str
    relationship: Relationship
    female: SyntheticPerson
    male: SyntheticPerson


def build_locus_specs(
    catalogue: ConditionCatalogue,
    panel: PanelInfo,
    freq_scale: float = 1.0,
) -> tuple[LocusSpec, ...]:
    """Loci generated from the catalogue rows that are on the panel and use the simple couple table."""
    if freq_scale <= 0:
        msg = "freq_scale must be positive"
        raise ValueError(msg)
    groups = {g.id: g for g in catalogue.locus_groups}
    order: list[str] = []
    rows_by_unit: dict[str, list[int]] = {}
    for i, row in enumerate(catalogue.conditions):
        if (
            row.id not in panel.condition_ids
            or row.couple_matrix != "simple"
            or row.derived
            or row.carrier_frequency is None
            or row.inheritance is Inheritance.AUTOSOMAL_DOMINANT
        ):
            continue
        unit = row.locus_group or row.id
        if unit not in rows_by_unit:
            order.append(unit)
        rows_by_unit.setdefault(unit, []).append(i)
    specs: list[LocusSpec] = []
    for unit in order:
        rows = [catalogue.conditions[i] for i in rows_by_unit[unit]]
        qs: list[float] = []
        for r in rows:
            freq = r.carrier_frequency
            assert freq is not None
            value = min(
                freq.value * freq_scale, 0.5 if freq.kind == "carrier_heterozygote" else 0.95
            )
            qs.append(allele_frequency(value) if freq.kind == "carrier_heterozygote" else value)
        group = groups.get(unit)
        specs.append(
            LocusSpec(
                key=unit,
                gene=rows[0].gene,
                inheritance=rows[0].inheritance,
                class_conditions=tuple(r.id for r in rows),
                q=tuple(qs),
                d=tuple(panel.detection_for(r.id) for r in rows),
                compound_condition_id=group.compound_condition_id if group else None,
            )
        )
    return tuple(specs)


def default_loci(freq_scale: float = 1.0) -> tuple[LocusSpec, ...]:
    """Loci for the default demonstration panel from the shipped catalogue."""
    panel = load_panels().get(DEFAULT_PANEL_ID)
    if panel is None:
        msg = f"panel {DEFAULT_PANEL_ID} is missing from panels.yaml"
        raise ValueError(msg)
    return build_locus_specs(load_catalogue(), panel, freq_scale)


def founder_sampler(rng: np.random.Generator, spec: LocusSpec) -> Callable[[int], AlleleArray]:
    """Return a function drawing m founder alleles (codes as in the module docstring)."""
    k = spec.k
    probs = [1.0 - sum(spec.q)]
    probs += [q * d for q, d in zip(spec.q, spec.d, strict=True)]
    probs += [q * (1.0 - d) for q, d in zip(spec.q, spec.d, strict=True)]
    cumulative = np.cumsum(np.asarray(probs, dtype=np.float64))
    cumulative[-1] = 1.0

    def sample(m: int) -> AlleleArray:
        codes = np.searchsorted(cumulative, rng.random(m), side="right")
        return np.minimum(codes, 2 * k).astype(np.int8)

    return sample


def _pick(rng: np.random.Generator, x: AlleleArray) -> AlleleArray:
    idx = rng.integers(0, 2, x.shape[0])
    picked: AlleleArray = x[np.arange(x.shape[0]), idx]
    return picked


def _pair(a: AlleleArray, b: AlleleArray) -> AlleleArray:
    return np.stack([a, b], axis=1)


def drop_partners(
    rng: np.random.Generator,
    relationship: Relationship,
    m: int,
    founder: Callable[[int], AlleleArray],
) -> tuple[AlleleArray, AlleleArray]:
    """Gene-drop one autosomal locus down the pedigree; return the two partners' (m, 2) genotypes."""

    def fp() -> AlleleArray:
        return _pair(founder(m), founder(m))

    def child(x: AlleleArray, y: AlleleArray) -> AlleleArray:
        return _pair(_pick(rng, x), _pick(rng, y))

    if relationship is Relationship.UNRELATED:
        return fp(), fp()
    if relationship is Relationship.FIRST_COUSIN:
        g1, g2 = fp(), fp()
        p1, p2 = child(g1, g2), child(g1, g2)  # two siblings
        return child(p1, fp()), child(p2, fp())
    if relationship is Relationship.SECOND_COUSIN:
        gg1, gg2 = fp(), fp()
        s1, s2 = child(gg1, gg2), child(gg1, gg2)  # two siblings (the grandparents)
        p1, p2 = child(s1, fp()), child(s2, fp())  # their children (first cousins)
        return child(p1, fp()), child(p2, fp())
    if relationship is Relationship.FIRST_COUSIN_ONCE_REMOVED:
        g1, g2 = fp(), fp()
        p1, p2 = child(g1, g2), child(g1, g2)  # two siblings
        x = child(p1, fp())  # a child of the first sibling
        return child(x, fp()), child(p2, fp())
    if relationship is Relationship.DOUBLE_FIRST_COUSIN:
        g1, g2, g3, g4 = fp(), fp(), fp(), fp()
        brothers = child(g1, g2), child(g1, g2)  # two brothers from family one
        sisters = child(g3, g4), child(g3, g4)  # two sisters from family two
        return child(brothers[0], sisters[0]), child(brothers[1], sisters[1])
    msg = f"no pedigree is defined for {relationship.value}"
    raise ValueError(msg)


def _normalise_mix(mix: Mapping[Relationship, float] | None) -> dict[Relationship, float]:
    chosen = dict(DEFAULT_MIX if mix is None else mix)
    for rel, weight in chosen.items():
        if rel not in GENERATED_RELATIONSHIPS:
            msg = f"relationship {rel.value} cannot be generated"
            raise ValueError(msg)
        if weight < 0:
            msg = "mix weights must be non-negative"
            raise ValueError(msg)
    total = sum(chosen.values())
    if total <= 0:
        msg = "mix weights must not all be zero"
        raise ValueError(msg)
    return {rel: w / total for rel, w in chosen.items()}


def generate_couples(
    n: int,
    seed: int,
    mix: Mapping[Relationship, float] | None = None,
    *,
    loci: Sequence[LocusSpec] | None = None,
) -> list[SyntheticCouple]:
    """Generate `n` synthetic couples (partner one is the female, partner two the male). Deterministic in `seed`."""
    loci = default_loci() if loci is None else loci
    if n < 0:
        msg = "n must be non-negative"
        raise ValueError(msg)
    rng = np.random.default_rng(seed)
    weights = _normalise_mix(mix)
    relationships = list(weights)
    counts = rng.multinomial(n, [weights[r] for r in relationships])
    couples: list[SyntheticCouple] = []
    for relationship, m_raw in zip(relationships, counts, strict=True):
        m = int(m_raw)
        if m == 0:
            continue
        f_alleles: dict[str, list[list[int]]] = {}
        m_alleles: dict[str, list[list[int]]] = {}
        for spec in loci:
            sampler = founder_sampler(rng, spec)
            if spec.inheritance is Inheritance.X_LINKED:
                female = _pair(sampler(m), sampler(m))
                male = sampler(m).reshape(m, 1)
            else:
                female, male = drop_partners(rng, relationship, m, sampler)
            f_alleles[spec.key] = female.tolist()
            m_alleles[spec.key] = male.tolist()
        base = len(couples)
        for i in range(m):
            couple_id = f"SYN-{seed}-{base + i:06d}"
            couples.append(
                SyntheticCouple(
                    couple_id=couple_id,
                    relationship=relationship,
                    female=SyntheticPerson(
                        person_id=f"{couple_id}-F",
                        sex=Sex.FEMALE,
                        alleles={k: tuple(v[i]) for k, v in f_alleles.items()},
                    ),
                    male=SyntheticPerson(
                        person_id=f"{couple_id}-M",
                        sex=Sex.MALE,
                        alleles={k: tuple(v[i]) for k, v in m_alleles.items()},
                    ),
                )
            )
    return couples


def pathogenic_classes(alleles: Sequence[int], k: int, *, observed: bool) -> list[int]:
    """Class numbers (1..K) of the pathogenic alleles; with `observed` only the detectable ones."""
    out: list[int] = []
    for code in alleles:
        if code == 0 or (observed and code > k):
            continue
        out.append((code - 1) % k + 1)
    return out


def _finding(spec: LocusSpec, condition_id: str, zygosity: Zygosity) -> Finding:
    return Finding(
        gene=spec.gene,
        condition_id=condition_id,
        zygosity=zygosity,
        inheritance=spec.inheritance,
        classification="pathogenic",
    )


def findings_for(
    person: SyntheticPerson, loci: Sequence[LocusSpec], *, observed: bool
) -> tuple[Finding, ...]:
    """The person-level findings a laboratory would report (`observed`) or the true state (`not observed`)."""
    findings: list[Finding] = []
    for spec in loci:
        classes = pathogenic_classes(person.alleles[spec.key], spec.k, observed=observed)
        if not classes:
            continue
        if spec.inheritance is Inheritance.X_LINKED:
            if person.sex is Sex.MALE:
                zygosity = Zygosity.AFFECTED
            else:
                zygosity = Zygosity.CARRIER if len(classes) == 1 else Zygosity.AFFECTED
            findings.append(_finding(spec, spec.class_conditions[0], zygosity))
        elif len(classes) == 1:
            findings.append(_finding(spec, spec.class_conditions[classes[0] - 1], Zygosity.CARRIER))
        elif classes[0] == classes[1]:
            findings.append(
                _finding(spec, spec.class_conditions[classes[0] - 1], Zygosity.AFFECTED)
            )
        else:
            compound = spec.compound_condition_id
            if compound is None:
                msg = f"locus {spec.key} has two allele classes but no compound condition"
                raise ValueError(msg)
            findings.append(_finding(spec, compound, Zygosity.AFFECTED))
    return tuple(findings)


def _report(
    person: SyntheticPerson, loci: Sequence[LocusSpec], panel_id: str, *, observed: bool
) -> PersonReport:
    return PersonReport(
        person_id=person.person_id,
        sex=person.sex,
        panel_id=panel_id,
        findings=findings_for(person, loci, observed=observed),
    )


def reports_for(
    couple: SyntheticCouple,
    loci: Sequence[LocusSpec],
    *,
    observed: bool,
    panel_id: str = DEFAULT_PANEL_ID,
) -> tuple[PersonReport, PersonReport]:
    """Person reports for the couple: partner one is the female, partner two the male."""
    return (
        _report(couple.female, loci, panel_id, observed=observed),
        _report(couple.male, loci, panel_id, observed=observed),
    )
