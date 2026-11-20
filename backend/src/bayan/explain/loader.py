"""Load the explainer's YAML data files into typed, validated bundles.

Loading is strict: an unknown slot, a typed digit, a missing locale or a template id that differs
between languages is an error at start-up, never a silent gap at render time.
"""

from __future__ import annotations

import string
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

import yaml

from bayan.core.errors import Invalid
from bayan.core.types import Locale
from bayan.explain.models import (
    BannedList,
    DigitSystem,
    Direction,
    GlossaryEntry,
    LanguageStatus,
    LocaleBundle,
    TemplateSpec,
)
from bayan.explain.text_tools import number_tokens

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
ALL_LOCALES: tuple[Locale, ...] = (Locale.EN, Locale.AR, Locale.UR)


def read_yaml(name: str) -> dict[str, Any]:
    """Read one YAML file from ``bayan/data`` as a dict."""
    raw = yaml.safe_load((DATA_DIR / name).read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise Invalid(f"{name}: top level must be a mapping")
    return cast("dict[str, Any]", raw)


def template_slots(text: str) -> set[str]:
    """Names of the ``{slot}`` placeholders in a template string."""
    return {field for _, field, _, _ in string.Formatter().parse(text) if field}


@lru_cache(maxsize=1)
def load_constants() -> Mapping[str, int]:
    """Locale-neutral constants (the only digits a template may print besides engine numbers)."""
    raw = read_yaml("templates.constants.yaml")["constants"]
    return {name: int(entry["value"]) for name, entry in raw.items()}


@lru_cache(maxsize=1)
def load_aliases() -> Mapping[str, Mapping[str, str]]:
    """Map keys emitted by other lanes (reason, certificate, detection) to template ids."""
    raw = read_yaml("templates.aliases.yaml")
    return {
        group: {str(k): str(v) for k, v in entries.items()}
        for group, entries in raw.items()
        if group != "meta"
    }


@lru_cache(maxsize=1)
def load_banned() -> Mapping[Locale, BannedList]:
    raw = read_yaml("templates.banned.yaml")
    out: dict[Locale, BannedList] = {}
    for locale in ALL_LOCALES:
        spec = raw[locale.value]
        out[locale] = BannedList(match=spec["match"], terms=tuple(str(t) for t in spec["terms"]))
    return out


def _load_glossary(locale: Locale, status: LanguageStatus) -> tuple[GlossaryEntry, ...]:
    raw = read_yaml(f"glossary.{locale.value}.yaml")
    default_source = str(raw["meta"]["default_source"]) if "default_source" in raw["meta"] else ""
    entries: list[GlossaryEntry] = []
    for key, entry in raw["terms"].items():
        definition = str(entry["definition"])
        if number_tokens(definition) or number_tokens(str(entry["term"])):
            raise Invalid(f"glossary.{locale.value}.yaml: term {key!r} contains a typed number")
        entries.append(
            GlossaryEntry(
                key=key,
                term=str(entry["term"]),
                definition=definition,
                language_status=status,
                needs_clinician_signoff=bool(raw["meta"]["needs_clinician_signoff"]),
                source=str(entry.get("source", default_source)),
            )
        )
    return tuple(entries)


def _load_templates(raw: dict[str, Any]) -> dict[str, TemplateSpec]:
    templates: dict[str, TemplateSpec] = {}
    for tid, entry in raw["templates"].items():
        templates[tid] = TemplateSpec(
            id=tid,
            kind=entry["kind"],
            polarity=entry["polarity"],
            tone=entry.get("tone", "neutral"),
            text=str(entry["text"]),
            glossary=tuple(entry.get("glossary", ())),
            source=entry.get("source"),
        )
    return templates


def _validate_bundle(bundle: LocaleBundle, constants: Mapping[str, int]) -> None:
    allowed = set(constants) | set(bundle.engine_slots)
    glossary_keys = {g.key for g in bundle.glossary}
    for tid, spec in bundle.templates.items():
        unknown = template_slots(spec.text) - allowed
        if unknown:
            raise Invalid(f"templates.{bundle.locale.value}: {tid} uses unknown slots {unknown}")
        if number_tokens(spec.text):
            raise Invalid(f"templates.{bundle.locale.value}: {tid} contains a typed number")
        missing = set(spec.glossary) - glossary_keys
        if missing:
            raise Invalid(
                f"templates.{bundle.locale.value}: {tid} cites unknown glossary {missing}"
            )


def _check_locale_parity(bundles: Mapping[Locale, LocaleBundle]) -> None:
    reference = bundles[Locale.EN]
    for locale, bundle in bundles.items():
        if set(bundle.templates) != set(reference.templates):
            diff = set(bundle.templates) ^ set(reference.templates)
            raise Invalid(f"templates.{locale.value}: template ids differ from English: {diff}")
        for tid, spec in bundle.templates.items():
            ref = reference.templates[tid]
            if template_slots(spec.text) != template_slots(ref.text):
                raise Invalid(f"templates.{locale.value}: {tid} slots differ from English")
            if (spec.kind, spec.polarity) != (ref.kind, ref.polarity):
                raise Invalid(f"templates.{locale.value}: {tid} kind or polarity differs")
        if {g.key for g in bundle.glossary} != {g.key for g in reference.glossary}:
            raise Invalid(f"glossary.{locale.value}: keys differ from English")


@lru_cache(maxsize=1)
def load_bundles() -> Mapping[Locale, LocaleBundle]:
    """Load and cross-validate the template and glossary files of all three languages."""
    constants = load_constants()
    bundles: dict[Locale, LocaleBundle] = {}
    for locale in ALL_LOCALES:
        raw = read_yaml(f"templates.{locale.value}.yaml")
        meta = raw["meta"]
        status: LanguageStatus = meta["language_status"]
        direction: Direction = meta["direction"]
        digit_system: DigitSystem = meta["digit_system"]
        if locale is not Locale.EN and status != "draft":
            raise Invalid(f"templates.{locale.value}: Arabic and Urdu must stay draft")
        bundle = LocaleBundle(
            locale=locale,
            direction=direction,
            digit_system=digit_system,
            language_status=status,
            needs_clinician_signoff=bool(meta["needs_clinician_signoff"]),
            templates=_load_templates(raw),
            polarity_markers={
                cat: tuple(str(m) for m in markers)
                for cat, markers in raw["polarity_markers"].items()
            },
            engine_slots=frozenset(raw["engine_slots"]),
            glossary=_load_glossary(locale, status),
        )
        _validate_bundle(bundle, constants)
        bundles[locale] = bundle
    _check_locale_parity(bundles)
    return bundles
