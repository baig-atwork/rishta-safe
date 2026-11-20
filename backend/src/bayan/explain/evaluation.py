"""Explainer evaluation for the scoreboard: fidelity, polarity, mutation catch rate, readability.

Everything here is measured on SYNTHETIC disclosed results built below (made-up genes' outcome
lines are the textbook Mendelian splits supplied as test inputs, not clinical claims). The
mutation test is the honest part: it injects a flipped number, a flipped polarity, a banned word,
a leaked category and a wrong digit system into rendered documents and counts how many of those
the checker catches. A rate below 100 percent would list the uncaught mutants.
"""

from __future__ import annotations

import re
import statistics
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass, field
from itertools import product
from pathlib import Path
from typing import Literal

import yaml

from bayan.core.contracts import (
    Block,
    DetectionStatement,
    DisclosedResult,
    ExplainerDoc,
    Finding,
    Frozen,
    IconArraySpec,
    Inheritance,
    NumberRef,
    OutcomeLine,
    ResultCategory,
    SharedCondition,
    Zygosity,
)
from bayan.core.errors import RuleViolation
from bayan.core.types import Emirate, Locale, Relationship, Role
from bayan.explain.checker import check_document
from bayan.explain.loader import DATA_DIR, load_banned
from bayan.explain.models import CheckReport, LocaleBundle
from bayan.explain.readability import document_grade
from bayan.explain.render import render_result
from bayan.explain.service import ExplainService, build_explain_service
from bayan.explain.text_tools import number_tokens

_ARABIC_INDIC_FLIP = str.maketrans(
    "0123456789", "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"
)


# ------------------------------------------------------------------------------ synthetic inputs
def _line(
    label: Literal["affected", "carrier", "neither"],
    n: int,
    who: Literal["any_child", "son", "daughter"] = "any_child",
) -> OutcomeLine:
    return OutcomeLine(label=label, per_100=n, applies_to=who)


def _shared_cases() -> dict[str, SharedCondition]:
    """One synthetic shared condition per basis. The splits are textbook Mendelian test inputs."""
    return {
        "both_carriers": SharedCondition(
            condition_id="syn_ar_1",
            gene="HBB",
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
            basis="both_carriers",
            outcomes=(_line("affected", 25), _line("carrier", 50), _line("neither", 25)),
        ),
        "affected_partner_and_carrier": SharedCondition(
            condition_id="syn_ar_2",
            gene="HBA1",
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
            basis="affected_partner_and_carrier",
            outcomes=(_line("affected", 50), _line("carrier", 50), _line("neither", 0)),
        ),
        "both_affected": SharedCondition(
            condition_id="syn_ar_3",
            gene="CFTR",
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
            basis="both_affected",
            outcomes=(_line("affected", 100), _line("carrier", 0), _line("neither", 0)),
        ),
        "x_linked_carrier_female": SharedCondition(
            condition_id="syn_xl_1",
            gene="G6PD",
            inheritance=Inheritance.X_LINKED,
            basis="x_linked_carrier_female",
            outcomes=(
                _line("affected", 50, "son"),
                _line("carrier", 0, "son"),
                _line("neither", 50, "son"),
                _line("affected", 0, "daughter"),
                _line("carrier", 50, "daughter"),
                _line("neither", 50, "daughter"),
            ),
        ),
        "x_linked_affected_male": SharedCondition(
            condition_id="syn_xl_2",
            gene="DMD",
            inheritance=Inheritance.X_LINKED,
            basis="x_linked_affected_male",
            outcomes=(
                _line("affected", 0, "son"),
                _line("carrier", 0, "son"),
                _line("neither", 100, "son"),
                _line("affected", 0, "daughter"),
                _line("carrier", 100, "daughter"),
                _line("neither", 0, "daughter"),
            ),
        ),
    }


def _detection(related: bool) -> tuple[DetectionStatement, ...]:
    statements = [
        DetectionStatement(
            panel_id="syn_panel",
            statement_key="detection.panel_rate_assumed",
            detection_rate_label="about 9 in 10 of the known changes in these genes (assumed, see limits)",
            assumed=True,
            related_couple_caveat=related,
        )
    ]
    if related:
        statements.append(
            DetectionStatement(
                panel_id="syn_panel",
                statement_key="detection.related_couple_shared_misses",
                detection_rate_label="about 9 in 10 (assumed); related partners can share a missed change",
                assumed=True,
                related_couple_caveat=True,
            )
        )
    return tuple(statements)


@dataclass(frozen=True)
class Scenario:
    name: str
    disclosed: DisclosedResult
    reasons: tuple[str, ...] = ()


def _own() -> tuple[Finding, ...]:
    return (
        Finding(
            gene="HBB",
            condition_id="syn_ar_1",
            zygosity=Zygosity.CARRIER,
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
            variant_label="c.20A>T",
        ),
        Finding(
            gene="CFTR",
            condition_id="syn_ar_3",
            zygosity=Zygosity.VUS,
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
        ),
        Finding(
            gene="HBA1",
            condition_id="syn_ar_2",
            zygosity=Zygosity.NOT_DETECTED,
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
        ),
    )


def _partner() -> tuple[Finding, ...]:
    return (
        Finding(
            gene="HBB",
            condition_id="syn_ar_1",
            zygosity=Zygosity.CARRIER,
            inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
            variant_label="p.Gln39*",
        ),
        Finding(
            gene="G6PD",
            condition_id="syn_xl_1",
            zygosity=Zygosity.AFFECTED,
            inheritance=Inheritance.X_LINKED,
        ),
    )


def build_scenarios() -> list[Scenario]:
    """Every result category x viewer x policy x relationship, plus every withheld reason."""
    viewers: list[tuple[str, dict[str, object]]] = [
        (
            "member_couple_only",
            {
                "viewer_role": Role.COUPLE_MEMBER,
                "viewer_person_id": "p1",
                "own_findings": _own(),
                "partner_finding_scope": "none",
            },
        ),
        (
            "member_gene_names",
            {
                "viewer_role": Role.COUPLE_MEMBER,
                "viewer_person_id": "p1",
                "own_findings": _own(),
                "partner_finding_scope": "gene_names_only",
                "partner_findings": _partner(),
            },
        ),
        (
            "member_full_detail",
            {
                "viewer_role": Role.COUPLE_MEMBER,
                "viewer_person_id": "p1",
                "own_findings": _own(),
                "partner_finding_scope": "full_variant_detail",
                "partner_findings": _partner(),
            },
        ),
        ("counsellor", {"viewer_role": Role.COUNSELLOR}),
    ]
    results: list[tuple[str, dict[str, object], tuple[str, ...]]] = []
    for basis, shared in _shared_cases().items():
        results.append(
            (
                f"shared_{basis}",
                {"category": ResultCategory.SHARED_RESULT_FOUND, "shared": (shared,)},
                (),
            )
        )
    results.append(("no_shared", {"category": ResultCategory.NO_SHARED_CHANGE_FOUND}, ()))
    more_info_reasons = (
        "vus_present",
        "result_pending_confirmation",
        "haem_work_up_cbc_only",
        "panel_mismatch",
        "specialist_read_needed",
        "some_new_unknown_key",
    )
    results.extend(
        (f"more_info_{r}", {"category": ResultCategory.MORE_INFORMATION_NEEDED}, (r,))
        for r in more_info_reasons
    )
    withheld_reasons = ("counselling_first", "awaiting_partner_consent", "right_not_to_know", None)
    results.extend(
        (f"withheld_{r}", {"category": None, "withheld_reason_key": r}, ())
        for r in withheld_reasons
    )

    scenarios: list[Scenario] = []
    for (rname, rkw, reasons), (vname, vkw), policy, relationship in product(
        results,
        viewers,
        (Emirate.ABU_DHABI, Emirate.DUBAI),
        (Relationship.UNRELATED, Relationship.FIRST_COUSIN),
    ):
        related = relationship is not Relationship.UNRELATED
        withheld = rkw.get("category") is None
        disclosed = DisclosedResult.model_validate(
            {
                "couple_id": "syn-couple",
                "policy": policy,
                "relationship": relationship,
                "detection": () if withheld else _detection(related),
                "certificate_note_key": "certificate_note.dubai"
                if policy is Emirate.DUBAI and related
                else None,
                **vkw,
                **rkw,
            }
        )
        scenarios.append(
            Scenario(f"{rname}|{vname}|{policy.value}|{relationship.value}", disclosed, reasons)
        )
    return scenarios


# ------------------------------------------------------------------------------ mutation operators
@dataclass(frozen=True)
class Mutant:
    operator: str
    scenario: str
    locale: Locale
    doc: ExplainerDoc


def _replace_block(doc: ExplainerDoc, index: int, block: Block) -> ExplainerDoc:
    blocks = list(doc.blocks)
    blocks[index] = block
    return doc.model_copy(update={"blocks": tuple(blocks)})


def _flip_token(text: str, to_arabic_indic: bool = False) -> str | None:
    match = re.search(r"(?<!\w)\d+(?!\w)", text)
    if match is None:
        return None
    old = match.group(0)
    new = str((int(old) + 7) % 101)
    if new == old:
        new = str((int(old) + 8) % 101)
    if to_arabic_indic:
        new = new.translate(_ARABIC_INDIC_FLIP)
    return text[: match.start()] + new + text[match.end() :]


def _first_index(doc: ExplainerDoc, predicate: Callable[[Block], bool]) -> int | None:
    return next((i for i, b in enumerate(doc.blocks) if predicate(b)), None)


def _mut_number_text(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    index = _first_index(
        doc, lambda b: any(r.origin == "engine" and isinstance(r.value, int) for r in b.numbers)
    )
    if index is None:
        return None
    block = doc.blocks[index]
    if block.items:
        flipped = _flip_token(block.items[0])
        return (
            None
            if flipped is None
            else _replace_block(
                doc, index, block.model_copy(update={"items": (flipped, *block.items[1:])})
            )
        )
    flipped = _flip_token(block.text)
    return (
        None
        if flipped is None
        else _replace_block(doc, index, block.model_copy(update={"text": flipped}))
    )


def _mut_number_digit_system(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    index = _first_index(
        doc, lambda b: any(r.origin == "engine" and isinstance(r.value, int) for r in b.numbers)
    )
    if index is None:
        return None
    block = doc.blocks[index]
    if block.items:
        flipped = _flip_token(block.items[0], to_arabic_indic=True)
        return (
            None
            if flipped is None
            else _replace_block(
                doc, index, block.model_copy(update={"items": (flipped, *block.items[1:])})
            )
        )
    flipped = _flip_token(block.text, to_arabic_indic=True)
    return (
        None
        if flipped is None
        else _replace_block(doc, index, block.model_copy(update={"text": flipped}))
    )


def _mut_number_ref(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    index = _first_index(
        doc, lambda b: any(r.origin == "engine" and isinstance(r.value, int) for r in b.numbers)
    )
    if index is None:
        return None
    block = doc.blocks[index]
    refs: list[NumberRef] = []
    done = False
    for ref in block.numbers:
        if not done and ref.origin == "engine" and isinstance(ref.value, int):
            refs.append(ref.model_copy(update={"value": ref.value + 1}))
            done = True
        else:
            refs.append(ref)
    return _replace_block(doc, index, block.model_copy(update={"numbers": tuple(refs)}))


def _mut_icon_array(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    index = _first_index(doc, lambda b: b.icon_array is not None)
    if index is None:
        return None
    block = doc.blocks[index]
    spec = block.icon_array
    assert spec is not None
    flipped = IconArraySpec(
        total=spec.total,
        affected=spec.neither,
        carrier=spec.carrier,
        neither=spec.affected,
        caption=spec.caption,
    )
    if flipped == spec:
        flipped = IconArraySpec(
            total=spec.total,
            affected=spec.affected + 1,
            carrier=spec.carrier,
            neither=spec.neither,
            caption=spec.caption,
        )
    return _replace_block(doc, index, block.model_copy(update={"icon_array": flipped}))


_HEADINGS = {
    "shared": "result.shared.heading",
    "no_shared": "result.no_shared.heading",
    "more_info": "result.more_info.heading",
}


def _other_category(disclosed: DisclosedResult) -> str | None:
    if disclosed.category is None:
        return "shared"
    mine = {
        ResultCategory.SHARED_RESULT_FOUND: "shared",
        ResultCategory.NO_SHARED_CHANGE_FOUND: "no_shared",
        ResultCategory.MORE_INFORMATION_NEEDED: "more_info",
    }[disclosed.category]
    return "no_shared" if mine != "no_shared" else "shared"


def _mut_polarity_text(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    """Replace the result heading wording (or add it to a withheld document) with another category's."""
    other = _other_category(disclosed)
    if other is None:
        return None
    wrong = bundle.templates[_HEADINGS[other]].text
    own_heading = next(
        (bundle.templates[t].text for t in doc.template_ids if t in _HEADINGS.values()), None
    )
    if own_heading is not None:
        index = _first_index(doc, lambda b: b.text == own_heading)
        if index is not None:
            return _replace_block(doc, index, doc.blocks[index].model_copy(update={"text": wrong}))
    index = _first_index(doc, lambda b: b.kind.value == "paragraph")
    if index is None:
        return None
    block = doc.blocks[index]
    return _replace_block(doc, index, block.model_copy(update={"text": f"{block.text} {wrong}"}))


def _mut_polarity_ids(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    other = _other_category(disclosed)
    if other is None:
        return None
    ids = list(doc.template_ids)
    wrong_id = _HEADINGS[other]
    own = next((t for t in ids if t in _HEADINGS.values()), None)
    if own is not None:
        ids[ids.index(own)] = wrong_id
    else:
        ids.append(wrong_id)
    del bundle
    return doc.model_copy(update={"template_ids": tuple(ids)})


def _mut_banned(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del disclosed
    term = load_banned()[bundle.locale].terms[0]
    index = _first_index(doc, lambda b: b.kind.value == "paragraph")
    if index is None:
        return None
    block = doc.blocks[index]
    return _replace_block(doc, index, block.model_copy(update={"text": f"{block.text} {term}"}))


def _mut_banned_english(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    index = _first_index(doc, lambda b: b.kind.value == "paragraph")
    if index is None:
        return None
    block = doc.blocks[index]
    return _replace_block(
        doc, index, block.model_copy(update={"text": f"{block.text} This couple is compatible."})
    )


def _mut_identifier(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    index = _first_index(doc, lambda b: b.kind.value == "paragraph")
    if index is None:
        return None
    block = doc.blocks[index]
    return _replace_block(doc, index, block.model_copy(update={"text": f"{block.text} ZZQ9"}))


def _mut_claims_reviewed(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    del bundle, disclosed
    return doc.model_copy(update={"language_status": "reviewed"})


def _mut_drop_limits(
    doc: ExplainerDoc, bundle: LocaleBundle, disclosed: DisclosedResult
) -> ExplainerDoc | None:
    """Remove the limits statement from a no-shared-change document."""
    del bundle
    if disclosed.category is not ResultCategory.NO_SHARED_CHANGE_FOUND:
        return None
    ids = tuple(t for t in doc.template_ids if t != "limits.panel_not_complete")
    return doc.model_copy(update={"template_ids": ids})


OPERATORS: dict[
    str, Callable[[ExplainerDoc, LocaleBundle, DisclosedResult], ExplainerDoc | None]
] = {
    "number_flipped_in_text": _mut_number_text,
    "number_in_wrong_digit_system": _mut_number_digit_system,
    "declared_number_flipped": _mut_number_ref,
    "icon_array_flipped": _mut_icon_array,
    "polarity_flipped_in_text": _mut_polarity_text,
    "polarity_flipped_in_template_ids": _mut_polarity_ids,
    "banned_word_injected_in_locale": _mut_banned,
    "banned_word_injected_english": _mut_banned_english,
    "unknown_identifier_injected": _mut_identifier,
    "false_review_claim": _mut_claims_reviewed,
    "limits_statement_dropped": _mut_drop_limits,
}


def generate_mutants(
    service: ExplainService, scenario: Scenario, locale: Locale
) -> Iterator[tuple[Mutant, CheckReport]]:
    """Mutants of one rendered document, each with the checker's verdict."""
    bundle = service.bundle(locale)
    doc = render_result(bundle, scenario.disclosed, scenario.reasons)
    for name, operator in OPERATORS.items():
        mutated = operator(doc, bundle, scenario.disclosed)
        if mutated is None or mutated == doc:
            continue
        yield (
            Mutant(name, scenario.name, locale, mutated),
            check_document(mutated, scenario.disclosed, bundle),
        )


# ------------------------------------------------------------------------------ the report
class ExplainEvalReport(Frozen):
    documents_checked: int
    locales: tuple[str, ...]
    scenarios: int
    numeric_fidelity_pct: float
    polarity_pct: float
    banned_words_absent_pct: float
    render_refusals: int
    mutants_generated: int
    mutants_caught: int
    mutation_catch_rate_pct: float
    mutation_by_operator: dict[str, tuple[int, int]]
    uncaught_mutants: tuple[str, ...]
    english_fk_grade_mean: float
    english_fk_grade_max: float
    english_fk_grade_by_category: dict[str, float]
    arabic_urdu_readability: str
    template_count: int
    glossary_terms: dict[str, int]
    language_status: dict[str, str]
    needs_clinician_signoff: bool
    synthetic_inputs_only: bool
    note: str


@dataclass
class _Tally:
    documents: int = 0
    numeric_ok: int = 0
    polarity_ok: int = 0
    banned_ok: int = 0
    refusals: int = 0
    mutants: int = 0
    caught: int = 0
    by_operator: dict[str, list[int]] = field(default_factory=dict)
    uncaught: list[str] = field(default_factory=list)
    grades: list[float] = field(default_factory=list)
    grades_by_category: dict[str, list[float]] = field(default_factory=dict)


def _pct(part: int, whole: int) -> float:
    return round(100.0 * part / whole, 2) if whole else 0.0


def _eval_notes() -> dict[str, str]:
    raw = yaml.safe_load(Path(DATA_DIR / "templates.eval.yaml").read_text(encoding="utf-8"))
    return {k: str(v) for k, v in raw["notes"].items()}


def _category_name(scenario: Scenario) -> str:
    return scenario.name.split("|", maxsplit=1)[0].split("_", maxsplit=1)[0]


def run_explain_evaluation(
    service: ExplainService | None = None,
    scenarios: Sequence[Scenario] | None = None,
) -> ExplainEvalReport:
    """Render every scenario in every language, check it, mutate it, and score the checker."""
    svc = service or build_explain_service()
    cases = list(scenarios) if scenarios is not None else build_scenarios()
    tally = _Tally()
    locales = (Locale.EN, Locale.AR, Locale.UR)
    for scenario, locale in product(cases, locales):
        bundle = svc.bundle(locale)
        try:
            doc = render_result(bundle, scenario.disclosed, scenario.reasons)
        except RuleViolation:
            tally.refusals += 1
            continue
        report = svc.check(doc, scenario.disclosed)
        tally.documents += 1
        tally.numeric_ok += report.numeric_fidelity
        tally.polarity_ok += report.polarity
        tally.banned_ok += report.banned_words_absent
        if locale is Locale.EN:
            grade = document_grade(doc, {"HBB", "HBA1", "CFTR", "G6PD", "DMD"})
            tally.grades.append(grade)
            tally.grades_by_category.setdefault(_category_name(scenario), []).append(grade)
        for mutant, verdict in generate_mutants(svc, scenario, locale):
            tally.mutants += 1
            counts = tally.by_operator.setdefault(mutant.operator, [0, 0])
            counts[0] += 1
            if not verdict.ok:
                tally.caught += 1
                counts[1] += 1
            else:
                tally.uncaught.append(
                    f"{mutant.operator} | {mutant.scenario} | {mutant.locale.value}"
                )
    notes = _eval_notes()
    return ExplainEvalReport(
        documents_checked=tally.documents,
        locales=tuple(loc.value for loc in locales),
        scenarios=len(cases),
        numeric_fidelity_pct=_pct(tally.numeric_ok, tally.documents),
        polarity_pct=_pct(tally.polarity_ok, tally.documents),
        banned_words_absent_pct=_pct(tally.banned_ok, tally.documents),
        render_refusals=tally.refusals,
        mutants_generated=tally.mutants,
        mutants_caught=tally.caught,
        mutation_catch_rate_pct=_pct(tally.caught, tally.mutants),
        mutation_by_operator={k: (v[0], v[1]) for k, v in sorted(tally.by_operator.items())},
        uncaught_mutants=tuple(tally.uncaught[:20]),
        english_fk_grade_mean=round(statistics.fmean(tally.grades), 2) if tally.grades else 0.0,
        english_fk_grade_max=round(max(tally.grades), 2) if tally.grades else 0.0,
        english_fk_grade_by_category={
            k: round(statistics.fmean(v), 2) for k, v in sorted(tally.grades_by_category.items())
        },
        arabic_urdu_readability=notes["arabic_urdu_readability"],
        template_count=len(svc.bundle(Locale.EN).templates),
        glossary_terms={loc.value: len(svc.glossary(loc)) for loc in locales},
        language_status={loc.value: svc.bundle(loc).language_status for loc in locales},
        needs_clinician_signoff=True,
        synthetic_inputs_only=True,
        note=notes["scope"],
    )


__all__ = [
    "ExplainEvalReport",
    "Scenario",
    "build_scenarios",
    "number_tokens",
    "run_explain_evaluation",
]
