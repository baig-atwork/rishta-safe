"""Typed models of the explainer's data files and of its check report.

The contract types (ExplainerDoc, Block, NumberRef, IconArraySpec, CheckSummary) live in
``bayan.core.contracts`` and are not redefined here. This module adds what only the explain lane
needs: the loaded template and glossary bundles, and the detailed check report.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Literal

from pydantic import BaseModel, ConfigDict

from bayan.core.contracts import CheckSummary, Frozen
from bayan.core.types import Locale

TemplateKind = Literal["heading", "paragraph", "list", "callout", "disclaimer", "item"]
Polarity = Literal["shared", "no_shared", "more_info", "withheld", "neutral"]
DigitSystem = Literal["western", "arabic_indic", "extended_arabic_indic"]
Direction = Literal["ltr", "rtl"]
LanguageStatus = Literal["reviewed", "draft"]


class TemplateSpec(Frozen):
    """One reviewed static template. ``text`` holds ``{slot}`` placeholders and no digits."""

    id: str
    kind: TemplateKind
    polarity: Polarity
    tone: Literal["neutral", "info", "care"] = "neutral"
    text: str
    glossary: tuple[str, ...] = ()
    source: str | None = None


class GlossaryEntry(Frozen):
    """A plain-language definition. Arabic and Urdu entries are drafts pending native review."""

    key: str
    term: str
    definition: str
    language_status: LanguageStatus
    needs_clinician_signoff: bool = True
    source: str


class LocaleBundle(Frozen):
    """Everything the explainer knows for one language."""

    locale: Locale
    direction: Direction
    digit_system: DigitSystem
    language_status: LanguageStatus
    needs_clinician_signoff: bool
    templates: Mapping[str, TemplateSpec]
    polarity_markers: Mapping[str, tuple[str, ...]]
    engine_slots: frozenset[str]
    glossary: tuple[GlossaryEntry, ...]


class BannedList(Frozen):
    match: Literal["word", "substring"]
    terms: tuple[str, ...]


class Violation(Frozen):
    """One failed check. ``code`` is a stable slug; ``message`` is for developers and logs."""

    code: Literal[
        "numeric_mismatch",
        "numeric_unknown_key",
        "numeric_engine_value",
        "numeric_constant_value",
        "icon_array",
        "unknown_identifier",
        "unknown_template",
        "polarity_template",
        "polarity_required",
        "polarity_marker",
        "withheld_leak",
        "banned_word",
        "structure",
    ]
    message: str
    block_index: int | None = None


class CheckReport(BaseModel):
    """Result of the deterministic checker: numeric fidelity, polarity and banned words."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    ok: bool
    numeric_fidelity: bool
    polarity: bool
    banned_words_absent: bool
    violations: tuple[Violation, ...] = ()

    @property
    def messages(self) -> tuple[str, ...]:
        return tuple(f"{v.code}: {v.message}" for v in self.violations)

    def summary(self) -> CheckSummary:
        return CheckSummary(
            ok=self.ok,
            numeric_fidelity=self.numeric_fidelity,
            polarity=self.polarity,
            banned_words_absent=self.banned_words_absent,
            messages=self.messages,
        )
