"""The deterministic checker: numeric fidelity, polarity, withheld leaks and the banned-word guard.

It is independent of the renderer in the way that matters: it never trusts the numbers or template
ids that the document carries. It re-derives the allowed numbers from the DisclosedResult
(engine truth) and from ``data/templates.constants.yaml`` (declared constants), then compares the
digits that are actually printed in the text with the numbers the document declares, and the
declared numbers with the truth. A flipped digit, a flipped sentence or a banned word is caught
whichever of the three layers (text, declared numbers, template ids) was altered.

Research 05 section 3B: "every number in the output must equal the numbers in the facts
(normalise Western, Arabic-Indic and extended Arabic-Indic digits first); negator tokens per
language must match the fact's polarity". This module is that, applied to reviewed templates.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from bayan.core.contracts import (
    Block,
    BlockKind,
    DisclosedResult,
    ExplainerDoc,
    NumberRef,
    ResultCategory,
)
from bayan.core.errors import RuleViolation
from bayan.explain.banned import find_banned
from bayan.explain.loader import load_constants
from bayan.explain.models import CheckReport, LocaleBundle, Violation
from bayan.explain.render import GROUPS, LABELS, outcome_key, related_caveat_applies, shared_groups
from bayan.explain.text_tools import (
    detection_rate_numbers,
    identifier_tokens,
    mask_entities,
    normalise_for_matching,
    number_tokens,
)

_NUMERIC_CODES = frozenset(
    {
        "numeric_mismatch",
        "numeric_unknown_key",
        "numeric_engine_value",
        "numeric_constant_value",
        "icon_array",
        "unknown_identifier",
    }
)
_POLARITY_CODES = frozenset(
    {
        "unknown_template",
        "polarity_template",
        "polarity_required",
        "polarity_marker",
        "withheld_leak",
    }
)
_CATEGORY_POLARITY = {
    ResultCategory.SHARED_RESULT_FOUND: "shared",
    ResultCategory.NO_SHARED_CHANGE_FOUND: "no_shared",
    ResultCategory.MORE_INFORMATION_NEEDED: "more_info",
}
_RESULT_POLARITIES = ("shared", "no_shared", "more_info")


def _pieces(doc: ExplainerDoc) -> Iterator[tuple[int, str]]:
    for index, block in enumerate(doc.blocks):
        if block.text:
            yield index, block.text
        for item in block.items:
            yield index, item


def _entities(disclosed: DisclosedResult | None) -> set[str]:
    """Identifiers the engine supplied for this viewer: gene symbols and variant labels."""
    if disclosed is None:
        return set()
    found: set[str] = set()
    for shared in disclosed.shared:
        found.add(shared.gene)
    for finding in (*disclosed.own_findings, *disclosed.partner_findings):
        found.add(finding.gene)
        if finding.variant_label:
            found.add(finding.variant_label)
    extra: Any = getattr(disclosed, "partner_gene_names", ())
    if isinstance(extra, tuple):
        found.update(n for n in extra if isinstance(n, str))
    return found


def derive_engine_numbers(disclosed: DisclosedResult | None) -> dict[str, int | str]:
    """The only engine numbers a document for this viewer may declare, keyed as the renderer keys them."""
    truth: dict[str, int | str] = {}
    if disclosed is None or disclosed.category is None:
        return truth
    for index, shared in enumerate(disclosed.shared):
        for group, counts in shared_groups(shared).items():
            for label in LABELS:
                truth[outcome_key(index, group, label)] = counts.get(label, 0)
    for index, statement in enumerate(disclosed.detection):
        truth[f"detection.{index}.label"] = statement.detection_rate_label
        numbers = detection_rate_numbers(statement.detection_rate_label)
        if numbers is not None:
            truth[f"detection.{index}.rate_num"] = numbers[0]
            truth[f"detection.{index}.rate_den"] = numbers[1]
    return truth


def _expected_icon_arrays(disclosed: DisclosedResult | None) -> list[dict[str, int]]:
    if disclosed is None or disclosed.category is None:
        return []
    expected: list[dict[str, int]] = []
    for shared in disclosed.shared:
        grouped = shared_groups(shared)
        expected.extend(
            {label: grouped[group].get(label, 0) for label in LABELS}
            for group in GROUPS
            if group in grouped
        )
    return expected


class _Collector:
    def __init__(self) -> None:
        self.violations: list[Violation] = []

    def add(self, code: Any, message: str, block_index: int | None = None) -> None:
        self.violations.append(Violation(code=code, message=message, block_index=block_index))


def _ref_tokens(refs: tuple[NumberRef, ...]) -> list[str]:
    return [token for ref in refs for token in number_tokens(str(ref.value))]


def _check_block_numbers(out: _Collector, block: Block, index: int, entities: set[str]) -> None:
    printed: list[str] = []
    for text in ([block.text] if block.text else []) + list(block.items):
        printed.extend(number_tokens(mask_entities(text, entities)))
        for token in identifier_tokens(mask_entities(text, entities)):
            out.add(
                "unknown_identifier", f"identifier {token!r} was not supplied by the engine", index
            )
    declared = _ref_tokens(block.numbers)
    if printed != declared:
        out.add(
            "numeric_mismatch",
            f"printed numbers {printed} differ from the declared numbers {declared}",
            index,
        )


def _check_refs(
    out: _Collector,
    refs: list[tuple[int | None, NumberRef]],
    truth: dict[str, int | str],
) -> None:
    constants = load_constants()
    for index, ref in refs:
        if ref.origin == "template_constant":
            name = ref.key.removeprefix("const.")
            if name not in constants or constants[name] != ref.value:
                out.add("numeric_constant_value", f"constant {ref.key} is {ref.value!r}", index)
        elif ref.key not in truth:
            out.add("numeric_unknown_key", f"engine number {ref.key!r} is not in the result", index)
        elif truth[ref.key] != ref.value:
            out.add(
                "numeric_engine_value",
                f"{ref.key} is {ref.value!r} but the engine says {truth[ref.key]!r}",
                index,
            )


def _check_icon_arrays(
    out: _Collector, doc: ExplainerDoc, disclosed: DisclosedResult | None
) -> None:
    denominator = load_constants()["denominator"]
    found = [(i, b) for i, b in enumerate(doc.blocks) if b.kind is BlockKind.ICON_ARRAY]
    expected = _expected_icon_arrays(disclosed)
    if len(found) != len(expected):
        out.add("icon_array", f"{len(found)} icon arrays shown, {len(expected)} expected")
        return
    for (index, block), want in zip(found, expected, strict=True):
        spec = block.icon_array
        if spec is None:
            out.add("icon_array", "icon array block has no spec", index)
            continue
        if spec.total != denominator or spec.affected + spec.carrier + spec.neither != spec.total:
            out.add("icon_array", f"icon array is not out of the fixed {denominator}", index)
        if (spec.affected, spec.carrier, spec.neither) != (
            want["affected"],
            want["carrier"],
            want["neither"],
        ):
            out.add("icon_array", "icon array counts differ from the engine outcome lines", index)
        if spec.caption != block.text:
            out.add("icon_array", "icon array caption differs from the block text", index)


def check_numbers(doc: ExplainerDoc, disclosed: DisclosedResult | None, out: _Collector) -> None:
    entities = _entities(disclosed)
    truth = derive_engine_numbers(disclosed)
    refs: list[tuple[int | None, NumberRef]] = []
    for index, block in enumerate(doc.blocks):
        _check_block_numbers(out, block, index, entities)
        refs.extend((index, ref) for ref in block.numbers)
    refs.extend((None, ref) for ref in doc.numbers_used)
    _check_refs(out, refs, truth)
    declared = {(r.key, str(r.value)) for idx, r in refs if idx is not None}
    listed = {(r.key, str(r.value)) for r in doc.numbers_used}
    if declared != listed:
        out.add("numeric_mismatch", "numbers_used differs from the numbers declared in the blocks")
    _check_icon_arrays(out, doc, disclosed)


def _marker_hits(text: str, bundle: LocaleBundle, category: str) -> bool:
    markers = list(bundle.polarity_markers.get(category, ()))
    markers.extend(
        spec.text.split("{")[0]
        for tid, spec in bundle.templates.items()
        if tid == f"result.{category}.heading"
    )
    return any(normalise_for_matching(m) in text for m in markers if m.strip())


def _required_templates(disclosed: DisclosedResult | None, expected: str) -> list[str]:
    if expected == "neutral":
        return ["options.heading"]
    if expected == "withheld":
        return ["withheld.heading"]
    required = [f"result.{expected}.heading"]
    if expected == "no_shared":
        required.append("limits.panel_not_complete")
        if disclosed is not None and related_caveat_applies(disclosed):
            required.append("limits.related_couple")
    return required


def check_polarity(
    doc: ExplainerDoc, disclosed: DisclosedResult | None, bundle: LocaleBundle, out: _Collector
) -> None:
    if disclosed is None:
        expected = "neutral"
    elif disclosed.category is None:
        expected = "withheld"
    else:
        expected = _CATEGORY_POLARITY[disclosed.category]
    for tid in doc.template_ids:
        spec = bundle.templates.get(tid)
        if spec is None:
            out.add("unknown_template", f"template {tid!r} does not exist in {bundle.locale.value}")
        elif spec.polarity not in (expected, "neutral"):
            out.add(
                "polarity_template",
                f"template {tid} has polarity {spec.polarity}, expected {expected}",
            )
    _check_required(doc, disclosed, expected, out)
    _check_markers(doc, bundle, expected, out)


def _check_required(
    doc: ExplainerDoc, disclosed: DisclosedResult | None, expected: str, out: _Collector
) -> None:
    for tid in _required_templates(disclosed, expected):
        if tid not in doc.template_ids:
            out.add("polarity_required", f"required template {tid} is missing")
    if (
        expected == "no_shared"
        and disclosed is not None
        and disclosed.detection
        and not any(t.startswith("limits.detection.") for t in doc.template_ids)
    ):
        out.add(
            "polarity_required",
            "a limits.detection template is required when detection statements exist",
        )
    if expected == "more_info" and not any(t.startswith("reason.") for t in doc.template_ids):
        out.add("polarity_required", "a reason template is required for more_information_needed")


def _check_markers(doc: ExplainerDoc, bundle: LocaleBundle, expected: str, out: _Collector) -> None:
    text = " ".join(normalise_for_matching(t) for _, t in _pieces(doc))
    for category in _RESULT_POLARITIES:
        present = _marker_hits(text, bundle, category)
        if category != expected and present:
            out.add(
                "polarity_marker",
                f"wording of the {category} result appears in a {expected} document",
            )
        if category == expected and not present:
            out.add("polarity_marker", f"wording of the {category} result is missing")


def check_withheld(doc: ExplainerDoc, disclosed: DisclosedResult | None, out: _Collector) -> None:
    """A withheld or neutral document must not reveal the category, a number or a gene."""
    if disclosed is not None and disclosed.category is not None:
        return
    if any(b.kind is BlockKind.ICON_ARRAY for b in doc.blocks):
        out.add("withheld_leak", "an icon array is shown in a document that must not show a result")
    if any(ref.origin == "engine" for b in doc.blocks for ref in b.numbers):
        out.add(
            "withheld_leak", "an engine number is shown in a document that must not show a result"
        )
    entities = {e for e in _entities(disclosed) if e}
    for index, text in _pieces(doc):
        for entity in entities:
            if entity in text:
                out.add("withheld_leak", f"identifier {entity!r} leaked", index)


def check_banned(doc: ExplainerDoc, out: _Collector) -> None:
    for index, text in _pieces(doc):
        for term in find_banned(text, doc.locale):
            out.add("banned_word", f"banned term {term!r}", index)


def check_structure(doc: ExplainerDoc, bundle: LocaleBundle, out: _Collector) -> None:
    if doc.locale is not bundle.locale:
        out.add("structure", "document locale differs from the template bundle")
    if doc.language_status != bundle.language_status:
        out.add(
            "structure",
            f"document claims {doc.language_status}, the templates are {bundle.language_status}",
        )
    if bundle.language_status == "draft" and (
        not doc.template_ids or doc.template_ids[0] != "status.draft_notice"
    ):
        out.add("structure", "a draft document must start with the draft notice")


def check_document(
    doc: ExplainerDoc, disclosed: DisclosedResult | None, bundle: LocaleBundle
) -> CheckReport:
    """Run every check. ``disclosed`` is None only for result-free documents such as the options pane."""
    out = _Collector()
    try:
        check_numbers(doc, disclosed, out)
    except RuleViolation as exc:
        out.add("numeric_mismatch", f"engine outcome lines are inconsistent: {exc.detail}")
    check_polarity(doc, disclosed, bundle, out)
    check_withheld(doc, disclosed, out)
    check_banned(doc, out)
    check_structure(doc, bundle, out)
    codes = {v.code for v in out.violations}
    return CheckReport(
        ok=not out.violations,
        numeric_fidelity=not (codes & _NUMERIC_CODES),
        polarity=not (codes & _POLARITY_CODES),
        banned_words_absent="banned_word" not in codes,
        violations=tuple(out.violations),
    )
