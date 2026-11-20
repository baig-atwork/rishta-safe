"""Engine evaluation on synthetic couples (for the scoreboard).

ALL NUMBERS ARE ON SYNTHETIC COUPLES. They show that the engine implements the written rules (agreement with an
independent oracle) and how large the panel-miss exposure is under STATED, partly illustrative assumptions. They say
nothing about real couples, real laboratories or the real programme (spec rules 1 and 6; Decree-Law 49/2023 Art. 25(3):
no programme statistics are generated or shown).

Published figures appear only as context brackets, never as validation: the demonstration panel has ten loci, the
published 4 percent figures are for hundreds of genes, so the demo figure is expected to be lower.
"""

from __future__ import annotations

import math
import time
from collections import Counter
from collections.abc import Mapping, Sequence

from bayan.core.contracts import CoupleResult, Frozen
from bayan.core.types import Relationship
from bayan.genetics.oracle import OracleVerdict, oracle_classify
from bayan.genetics.service import GeneticsService, build_genetics_service
from bayan.genetics.synthetic import (
    DEFAULT_PANEL_ID,
    LocusSpec,
    SyntheticCouple,
    default_loci,
    generate_couples,
    reports_for,
)

_NOTICE = (
    "Synthetic couples only. Agreement shows the engine matches an independent derivation of the same Mendelian rules; "
    "it is not clinical validation. Detection rates and several carrier frequencies are assumed or illustrative."
)

Signature = tuple[str, frozenset[tuple[str, str, tuple[tuple[str, int, str], ...]]]]


class PublishedFigure(Frozen):
    label: str
    value_pct: float
    source: str
    note: str


class RelationshipEval(Frozen):
    """Per-relationship results. `categories` covers all loci, including the common X-linked G6PD locus, so it is
    dominated by X-linked carrier-female pairs; the `ar_*` fields isolate the autosomal recessive screen."""

    relationship: str
    couples: int
    agree: int
    categories: dict[str, int]
    ar_truly_shared: int  # truth: both partners carry a pathogenic allele at some autosomal locus
    ar_found: int  # truly shared and the engine reported an autosomal shared result
    ar_missed: int  # truly shared but the engine reported none (panel misses)
    ar_false_shared: (
        int  # the engine reported an autosomal shared result that is not true (should be zero)
    )
    ar_missed_per_10000: float
    xl_engine_shared: int  # couples with an X-linked line (son and daughter outcomes)


class RandomMatingCheck(Frozen):
    couples: int
    loci: tuple[str, ...]
    observed_autosomal_at_risk_rate: float
    closed_form_autosomal_at_risk_rate: float
    published_context: tuple[PublishedFigure, ...]
    note: str


class EngineEvalReport(Frozen):
    synthetic: bool = True
    notice: str = _NOTICE
    n: int
    seed: int
    ruleset_version: str
    panel_id: str
    runtime_seconds: float
    agreement_total: int
    agreement_agree: int
    agreement_rate: float
    disagreement_couple_ids: tuple[str, ...]
    loci: tuple[str, ...]
    by_relationship: tuple[RelationshipEval, ...]
    categories_overall: dict[str, int]
    random_mating: RandomMatingCheck
    assumptions: tuple[str, ...]


def engine_signature(result: CoupleResult) -> Signature:
    return (
        result.category.value,
        frozenset(
            (s.condition_id, s.basis, tuple((o.label, o.per_100, o.applies_to) for o in s.outcomes))
            for s in result.shared
        ),
    )


def oracle_signature(verdict: OracleVerdict) -> Signature:
    return (
        verdict.category,
        frozenset((s.condition_id, s.basis, s.outcomes) for s in verdict.shared),
    )


def _closed_form_autosomal(loci: Sequence[LocusSpec]) -> float:
    """P(at least one autosomal locus where both partners carry a pathogenic allele), unrelated, independent loci."""
    prob_none = 1.0
    for spec in loci:
        if spec.inheritance.value != "AR":
            continue
        q_total = sum(spec.q)
        has_allele = 1.0 - (1.0 - q_total) ** 2
        prob_none *= 1.0 - has_allele**2
    return 1.0 - prob_none


def _published_context() -> tuple[PublishedFigure, ...]:
    return (
        PublishedFigure(
            label="AVDB-style sum of squared carrier frequencies, about 425 genes, random mating",
            value_pct=4.0,
            source="Rishta Safe authoring note, pending clinical sign-off (computed from the public AVDB download; matches the 4 percent in Jain et al., Genet Med Open 2025)",
            note="Context bracket only: a hundreds-of-genes panel, a clinical-referral cohort; not a validation of this demo panel.",
        ),
        PublishedFigure(
            label="UAE federal programme couples labelled incompatible",
            value_pct=4.0,
            source="Gulf News, 1 Nov 2026, EHS data to end-Sep 2026: 282 couples, approximately 4 percent",
            note="Different definition and panel; context only.",
        ),
    )


def run_engine_evaluation(
    n: int,
    seed: int,
    *,
    mix: Mapping[Relationship, float] | None = None,
    freq_scale: float = 1.0,
    service: GeneticsService | None = None,
) -> EngineEvalReport:
    """Run the engine against the oracle on `n` synthetic couples and summarise (deterministic except runtime).

    `freq_scale` multiplies every carrier frequency (a stress setting that makes rarer states such as affected partners
    far more common); the default 1.0 uses the catalogue as written.
    """
    started = time.perf_counter()
    svc = service or build_genetics_service()
    loci = default_loci(freq_scale)
    couples = generate_couples(n, seed, mix, loci=loci)

    agree = Counter[str]()
    total = Counter[str]()
    categories: dict[str, Counter[str]] = {}
    tallies: dict[str, Counter[str]] = {}
    disagreements: list[str] = []
    for couple in couples:
        rel = couple.relationship.value
        total[rel] += 1
        reports = reports_for(couple, loci, observed=True)
        result = svc.compute_couple_result(couple.couple_id, reports, couple.relationship)
        verdict = oracle_classify(couple, loci, observed=True)
        truth = oracle_classify(couple, loci, observed=False)
        if engine_signature(result) == oracle_signature(verdict):
            agree[rel] += 1
        elif len(disagreements) < 10:
            disagreements.append(couple.couple_id)
        categories.setdefault(rel, Counter())[result.category.value] += 1
        t = tallies.setdefault(rel, Counter())
        ar_engine = any(sc.inheritance.value == "AR" for sc in result.shared)
        ar_truth = any(sc.inheritance == "AR" for sc in truth.shared)
        t["ar_truly_shared"] += int(ar_truth)
        t["ar_found"] += int(ar_truth and ar_engine)
        t["ar_missed"] += int(ar_truth and not ar_engine)
        t["ar_false_shared"] += int(ar_engine and not ar_truth)
        t["xl_engine_shared"] += int(any(sc.inheritance.value == "XL" for sc in result.shared))

    by_rel: list[RelationshipEval] = []
    overall: Counter[str] = Counter()
    for rel in total:
        t = tallies[rel]
        overall.update(categories[rel])
        by_rel.append(
            RelationshipEval(
                relationship=rel,
                couples=total[rel],
                agree=agree[rel],
                categories=dict(categories[rel]),
                ar_truly_shared=t["ar_truly_shared"],
                ar_found=t["ar_found"],
                ar_missed=t["ar_missed"],
                ar_false_shared=t["ar_false_shared"],
                ar_missed_per_10000=round(1e4 * t["ar_missed"] / total[rel], 2),
                xl_engine_shared=t["xl_engine_shared"],
            )
        )
    n_agree = sum(agree.values())
    n_total = sum(total.values())
    runtime = time.perf_counter() - started
    return EngineEvalReport(
        n=n,
        seed=seed,
        ruleset_version=svc.ruleset_info().version,
        panel_id=DEFAULT_PANEL_ID,
        runtime_seconds=round(runtime, 3),
        agreement_total=n_total,
        agreement_agree=n_agree,
        agreement_rate=(n_agree / n_total) if n_total else math.nan,
        disagreement_couple_ids=tuple(disagreements),
        loci=tuple(spec.key for spec in loci),
        by_relationship=tuple(by_rel),
        categories_overall=dict(overall),
        random_mating=_random_mating(n, seed, loci),
        assumptions=(
            "One detection probability per allele lineage, shared by descent (see residual.py; no statistician has reviewed it).",
            "Detection rates are assumed and illustrative; several carrier frequencies are illustrative (see conditions.yaml).",
            "X-linked loci are dropped independently in the two partners; specialist-read conditions are not generated.",
            "Pedigree founders are outbred; stated relationships are taken as true.",
        ),
    )


def _random_mating(n: int, seed: int, loci: Sequence[LocusSpec]) -> RandomMatingCheck:
    couples: list[SyntheticCouple] = generate_couples(
        n, seed + 1, {Relationship.UNRELATED: 1.0}, loci=loci
    )
    hits = 0
    for couple in couples:
        verdict = oracle_classify(couple, loci, observed=False)
        hits += int(any(s.inheritance == "AR" for s in verdict.shared))
    return RandomMatingCheck(
        couples=len(couples),
        loci=tuple(s.key for s in loci if s.inheritance.value == "AR"),
        observed_autosomal_at_risk_rate=(hits / len(couples)) if couples else math.nan,
        closed_form_autosomal_at_risk_rate=_closed_form_autosomal(loci),
        published_context=_published_context(),
        note=(
            "Autosomal loci only, true genotypes, unrelated partners. Reported as a bracket against published figures, not "
            "as validation: this panel has about ten loci and several illustrative frequencies, so it is expected to sit "
            "below the hundreds-of-genes figures."
        ),
    )


__all__ = [
    "EngineEvalReport",
    "PublishedFigure",
    "RandomMatingCheck",
    "RelationshipEval",
    "engine_signature",
    "oracle_signature",
    "run_engine_evaluation",
]
