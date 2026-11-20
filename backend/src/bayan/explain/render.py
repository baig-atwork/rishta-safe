"""The deterministic renderer: DisclosedResult + locale -> ExplainerDoc.

No string a user can read is written here. Every sentence is a template from ``data/templates.<locale>.yaml``;
this module only chooses which templates apply and fills their typed slots. Numbers enter only
through slots: engine integers (from the DisclosedResult) and declared template constants.
"""

from __future__ import annotations

import string
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

from bayan.core.contracts import (
    Block,
    BlockKind,
    DisclosedResult,
    ExplainerDoc,
    Finding,
    IconArraySpec,
    NumberRef,
    OutcomeLine,
    ResultCategory,
    SharedCondition,
    Zygosity,
)
from bayan.core.errors import RuleViolation
from bayan.core.types import Emirate, Relationship, Role
from bayan.explain.loader import load_aliases, load_constants, template_slots
from bayan.explain.models import LocaleBundle
from bayan.explain.text_tools import detection_rate_numbers, format_int, isolate, number_tokens

GROUPS: tuple[Literal["any_child", "son", "daughter"], ...] = ("any_child", "son", "daughter")
LABELS: tuple[Literal["affected", "carrier", "neither"], ...] = ("affected", "carrier", "neither")
_STAFF_VIEWS = frozenset({Role.COUNSELLOR, Role.CLINICIAN})
_KIND_TO_BLOCK = {
    "heading": BlockKind.HEADING,
    "paragraph": BlockKind.PARAGRAPH,
    "callout": BlockKind.CALLOUT,
    "disclaimer": BlockKind.DISCLAIMER,
}


@dataclass(frozen=True)
class EngineInt:
    """An integer that came from the engine, with the key the checker will re-derive."""

    key: str
    value: int


@dataclass(frozen=True)
class EngineText:
    """Engine-supplied text. If it contains digits it must carry a key so they are declared."""

    value: str
    number_key: str | None = None


@dataclass(frozen=True)
class Entity:
    """A Latin identifier supplied by the engine (gene symbol, variant label). Not a number."""

    value: str


SlotValue = EngineInt | EngineText | Entity


def outcome_key(index: int, group: str, label: str) -> str:
    return f"shared.{index}.{group}.{label}"


def shared_groups(shared: SharedCondition) -> dict[str, dict[str, int]]:
    """Group a condition's outcome lines by who they apply to and validate the fixed 100."""
    grouped: dict[str, dict[str, int]] = {}
    for line in shared.outcomes:
        counts = grouped.setdefault(line.applies_to, {})
        if line.label in counts:
            raise RuleViolation(
                f"Duplicate outcome line {line.label}/{line.applies_to} for {shared.condition_id}."
            )
        counts[line.label] = line.per_100
    denominator = load_constants()["denominator"]
    for group, counts in grouped.items():
        if sum(counts.values()) != denominator:
            raise RuleViolation(
                f"Outcome lines of {shared.condition_id} ({group}) sum to {sum(counts.values())}, "
                f"not the fixed {denominator}."
            )
    return grouped


class _Builder:
    def __init__(self, bundle: LocaleBundle) -> None:
        self.bundle = bundle
        self.constants = load_constants()
        self.blocks: list[Block] = []
        self.template_ids: list[str] = []
        self.glossary_keys: list[str] = []

    # ---- low level ------------------------------------------------------------------------
    def use(self, tid: str) -> None:
        spec = self.bundle.templates[tid]
        self.template_ids.append(tid)
        self.glossary_keys.extend(spec.glossary)

    def _wrap(self, value: str) -> str:
        return isolate(value) if self.bundle.direction == "rtl" else value

    def fmt(
        self, tid: str, values: Mapping[str, SlotValue] | None = None
    ) -> tuple[str, list[NumberRef]]:
        """Fill one template. Strict: a missing slot is an error, never an empty string."""
        spec = self.bundle.templates[tid]
        supplied = values or {}
        mapping: dict[str, str] = {}
        refs: list[NumberRef] = []
        for _, field, _, _ in string.Formatter().parse(spec.text):
            if not field:
                continue
            if field in self.constants:
                number = self.constants[field]
                mapping[field] = format_int(number, self.bundle.digit_system)
                refs.append(
                    NumberRef(key=f"const.{field}", value=number, origin="template_constant")
                )
            elif field in supplied:
                text, ref = self._slot(field, supplied[field])
                mapping[field] = text
                if ref is not None:
                    refs.append(ref)
            else:
                raise RuleViolation(f"Template {tid} needs slot {field!r}, which was not supplied.")
        return spec.text.format(**mapping), refs

    def _slot(self, name: str, value: SlotValue) -> tuple[str, NumberRef | None]:
        if isinstance(value, EngineInt):
            ref = NumberRef(key=value.key, value=value.value, origin="engine")
            return format_int(value.value, self.bundle.digit_system), ref
        if isinstance(value, EngineText):
            if number_tokens(value.value):
                if value.number_key is None:
                    raise RuleViolation(
                        f"Engine text for slot {name!r} has digits but no number key."
                    )
                return self._wrap(value.value), NumberRef(
                    key=value.number_key, value=value.value, origin="engine"
                )
            return self._wrap(value.value), None
        if not any(ch.isalpha() for ch in value.value):
            raise RuleViolation(f"Identifier for slot {name!r} has no letters: {value.value!r}.")
        return self._wrap(value.value), None

    # ---- blocks ---------------------------------------------------------------------------
    def add(self, tid: str, values: Mapping[str, SlotValue] | None = None) -> None:
        spec = self.bundle.templates[tid]
        text, refs = self.fmt(tid, values)
        self.use(tid)
        self.blocks.append(
            Block(kind=_KIND_TO_BLOCK[spec.kind], text=text, tone=spec.tone, numbers=tuple(refs))
        )

    def add_list(self, entries: Sequence[tuple[str, Mapping[str, SlotValue]]]) -> None:
        items: list[str] = []
        refs: list[NumberRef] = []
        for tid, values in entries:
            text, item_refs = self.fmt(tid, values)
            self.use(tid)
            items.append(text)
            refs.extend(item_refs)
        self.blocks.append(Block(kind=BlockKind.LIST, items=tuple(items), numbers=tuple(refs)))

    def add_icon_array(self, index: int, group: str, counts: Mapping[str, int]) -> None:
        tid = f"icon_array.caption.{group}"
        values: dict[str, SlotValue] = {
            label: EngineInt(outcome_key(index, group, label), counts.get(label, 0))
            for label in LABELS
        }
        caption, refs = self.fmt(tid, values)
        self.use(tid)
        spec = IconArraySpec(
            total=self.constants["denominator"],
            affected=counts.get("affected", 0),
            carrier=counts.get("carrier", 0),
            neither=counts.get("neither", 0),
            caption=caption,
        )
        self.blocks.append(
            Block(kind=BlockKind.ICON_ARRAY, text=caption, icon_array=spec, numbers=tuple(refs))
        )

    # ---- keyed lookups --------------------------------------------------------------------
    def resolve(self, group: str, key: str, alias_group: str, fallback: str) -> str:
        """Template id for a key emitted by another lane: exact, namespaced, alias, then generic."""
        templates = self.bundle.templates
        namespaced = f"{group}.{key}"
        if key in templates:
            return key
        if namespaced in templates:
            return namespaced
        aliased = load_aliases().get(alias_group, {}).get(key)
        if aliased is not None and f"{group}.{aliased}" in templates:
            return f"{group}.{aliased}"
        return fallback


def _zygosity_template(prefix: str, finding: Finding) -> str:
    return f"{prefix}.{finding.zygosity.value}"


def _own_section(b: _Builder, disclosed: DisclosedResult) -> None:
    if not disclosed.own_findings:
        return
    b.add("own.heading")
    b.add_list(
        [
            (_zygosity_template("own.finding", f), {"gene": Entity(f.gene)})
            for f in disclosed.own_findings
        ]
    )


def _partner_gene_names(disclosed: DisclosedResult) -> tuple[str, ...]:
    """Gene names released at the gene_names_only scope.

    Governance's subclass carries them in ``partner_gene_names`` because ``partner_findings`` would
    reveal the zygosity. Duck-typed on purpose: explain does not import governance.
    """
    extra = getattr(disclosed, "partner_gene_names", ())
    names = [n for n in extra if isinstance(n, str)] if isinstance(extra, tuple) else []
    return tuple(names) or tuple(dict.fromkeys(f.gene for f in disclosed.partner_findings))


def _partner_section(b: _Builder, disclosed: DisclosedResult) -> None:
    if disclosed.viewer_role in _STAFF_VIEWS:
        return
    scope = disclosed.partner_finding_scope
    if scope == "full_variant_detail" and disclosed.partner_findings:
        b.add("partner.heading")
        unknown = b.fmt("partner.variant_unknown")[0]
        b.use("partner.variant_unknown")
        b.add_list(
            [
                (
                    _zygosity_template("partner.full", f),
                    {
                        "gene": Entity(f.gene),
                        "variant": Entity(f.variant_label)
                        if f.variant_label
                        else EngineText(unknown),
                    },
                )
                for f in disclosed.partner_findings
            ]
        )
    elif scope in ("gene_names_only", "full_variant_detail") and _partner_gene_names(disclosed):
        b.add("partner.heading")
        b.add_list(
            [("partner.gene_only", {"gene": Entity(g)}) for g in _partner_gene_names(disclosed)]
        )
    else:
        b.add("partner.heading")
        b.add("partner.none")


def _shared_section(b: _Builder, disclosed: DisclosedResult) -> None:
    b.add("result.shared.heading")
    b.add("result.shared.summary")
    for index, shared in enumerate(disclosed.shared):
        grouped = shared_groups(shared)
        b.add(f"shared.basis.{shared.basis}", {"gene": Entity(shared.gene)})
        b.add("shared.outcomes.intro")
        for group in GROUPS:
            counts = grouped.get(group)
            if counts is None:
                continue
            b.add_icon_array(index, group, counts)
            lines: list[OutcomeLine] = [o for o in shared.outcomes if o.applies_to == group]
            b.add_list(
                [
                    (
                        f"outcome.{o.label}.{group}",
                        {
                            "per_100": EngineInt(outcome_key(index, group, o.label), o.per_100),
                        },
                    )
                    for o in lines
                ]
            )
        b.add("shared.outcomes.each_pregnancy")
    b.add("shared.next")


def _reason_ids(b: _Builder, disclosed: DisclosedResult, reasons: Sequence[str]) -> list[str]:
    keys = list(reasons)
    if any(f.zygosity is Zygosity.VUS for f in disclosed.own_findings):
        keys.append("vus_present")
    ids = [b.resolve("reason", k, "reason", "reason.generic") for k in dict.fromkeys(keys)]
    return list(dict.fromkeys(ids)) or ["reason.generic"]


def _more_info_section(b: _Builder, disclosed: DisclosedResult, reasons: Sequence[str]) -> None:
    b.add("result.more_info.heading")
    b.add("result.more_info.summary")
    b.add_list([(tid, {}) for tid in _reason_ids(b, disclosed, reasons)])
    b.add("more_info.next")


def _no_shared_section(b: _Builder) -> None:
    b.add("result.no_shared.heading")
    b.add("result.no_shared.summary")
    b.add("no_shared.next")


def _withheld_section(b: _Builder, disclosed: DisclosedResult) -> None:
    b.add("withheld.heading")
    key = disclosed.withheld_reason_key
    tid = f"withheld.{key}" if key else "withheld.generic"
    b.add(tid if tid in b.bundle.templates else "withheld.generic")
    b.add("withheld.next")


def _meaning_section(b: _Builder, category: ResultCategory) -> None:
    b.add("meaning.heading")
    b.add("meaning.risk_not_diagnosis")
    if category is not ResultCategory.MORE_INFORMATION_NEEDED:
        b.add("meaning.carrier_not_illness")
        b.add("meaning.most_people_carry")


def related_caveat_applies(disclosed: DisclosedResult) -> bool:
    return disclosed.relationship is not Relationship.UNRELATED or any(
        d.related_couple_caveat for d in disclosed.detection
    )


def _limits_section(b: _Builder, disclosed: DisclosedResult, category: ResultCategory) -> None:
    b.add("limits.heading")
    b.add("limits.panel_not_complete")
    for index, statement in enumerate(disclosed.detection):
        tid = b.resolve(
            "limits.detection",
            statement.statement_key,
            "limits_detection",
            "limits.detection.generic",
        )
        numbers = detection_rate_numbers(statement.detection_rate_label)
        slots = template_slots(b.bundle.templates[tid].text)
        values: dict[str, SlotValue] = {}
        if "rate_num" in slots and numbers is None:
            tid, slots = (
                "limits.detection.generic",
                template_slots(b.bundle.templates["limits.detection.generic"].text),
            )
        if "rate_num" in slots and numbers is not None:
            values["rate_num"] = EngineInt(f"detection.{index}.rate_num", numbers[0])
            values["rate_den"] = EngineInt(f"detection.{index}.rate_den", numbers[1])
        if "detection_rate_label" in slots:
            values["detection_rate_label"] = EngineText(
                statement.detection_rate_label, number_key=f"detection.{index}.label"
            )
        b.add(tid, values)
    if any(d.assumed for d in disclosed.detection):
        b.add("limits.detection.assumed_note")
    if category is ResultCategory.NO_SHARED_CHANGE_FOUND and related_caveat_applies(disclosed):
        b.add("limits.related_couple")


def _privacy_section(b: _Builder, disclosed: DisclosedResult) -> None:
    b.add("privacy.heading")
    b.add("privacy.who_can_see")
    b.add("policy.dubai" if disclosed.policy is Emirate.DUBAI else "policy.abu_dhabi")
    b.add("privacy.state_recipient")
    if disclosed.certificate_note_key:
        tid = b.resolve(
            "certificate", disclosed.certificate_note_key, "certificate", "certificate.generic"
        )
        b.add(tid)


def render_result(
    bundle: LocaleBundle, disclosed: DisclosedResult, reasons: Sequence[str] = ()
) -> ExplainerDoc:
    """Build the explainer document for one viewer. Does not run the checker."""
    b = _Builder(bundle)
    category = disclosed.category
    b.add("status.draft_notice")
    if category is None:
        _withheld_section(b, disclosed)
        _privacy_section(b, disclosed)
    else:
        if category is ResultCategory.SHARED_RESULT_FOUND:
            if not disclosed.shared:
                raise RuleViolation("shared_result_found needs at least one shared condition.")
            _shared_section(b, disclosed)
        elif category is ResultCategory.NO_SHARED_CHANGE_FOUND:
            if disclosed.shared:
                raise RuleViolation("no_shared_change_found cannot carry shared conditions.")
            _no_shared_section(b)
        else:
            if disclosed.shared:
                raise RuleViolation("more_information_needed cannot carry shared conditions.")
            _more_info_section(b, disclosed, reasons)
        _own_section(b, disclosed)
        _partner_section(b, disclosed)
        _meaning_section(b, category)
        if category is not ResultCategory.MORE_INFORMATION_NEEDED:
            _limits_section(b, disclosed, category)
        _privacy_section(b, disclosed)
        b.add("options.pointer")
    boundary = b.resolve(
        "boundary", disclosed.boundary_notice_key, "boundary", "boundary.education_decision_support"
    )
    b.add(boundary)
    b.add("status.synthetic_notice")
    return _finish(b)


def render_options(bundle: LocaleBundle) -> ExplainerDoc:
    """The options pane: neutral, fixed order, no ranking, articles cited as the dossier states them."""
    b = _Builder(bundle)
    b.add("status.draft_notice")
    b.add("options.heading")
    b.add("options.intro")
    b.add_list(
        [
            ("options.item.preimplantation", {}),
            ("options.item.prenatal_diagnosis", {}),
            ("options.item.specialist_discussion", {}),
        ]
    )
    b.add("options.rights")
    b.add("options.closing")
    b.add("boundary.education_decision_support")
    b.add("status.synthetic_notice")
    return _finish(b)


def _finish(b: _Builder) -> ExplainerDoc:
    numbers: dict[str, NumberRef] = {}
    for block in b.blocks:
        for ref in block.numbers:
            numbers.setdefault(ref.key, ref)
    return ExplainerDoc(
        locale=b.bundle.locale,
        language_status=b.bundle.language_status,
        blocks=tuple(b.blocks),
        glossary_keys=tuple(dict.fromkeys(b.glossary_keys)),
        numbers_used=tuple(numbers.values()),
        template_ids=tuple(dict.fromkeys(b.template_ids)),
    )
