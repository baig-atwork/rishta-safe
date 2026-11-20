"""ExplainService: reviewed templates, glossary and the checker behind one small interface."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from bayan.core.contracts import DisclosedResult, ExplainerDoc
from bayan.core.errors import RuleViolation
from bayan.core.types import Locale
from bayan.explain.checker import check_document
from bayan.explain.loader import load_bundles
from bayan.explain.models import CheckReport, GlossaryEntry, LocaleBundle
from bayan.explain.render import render_options, render_result


class ExplainService:
    """Renders the couple-facing explanation. There is no runtime LLM (ADR 0003)."""

    def __init__(self, bundles: Mapping[Locale, LocaleBundle]) -> None:
        self._bundles = bundles

    def bundle(self, locale: Locale) -> LocaleBundle:
        return self._bundles[locale]

    def render(
        self,
        disclosed: DisclosedResult,
        locale: Locale,
        *,
        reasons: Sequence[str] = (),
    ) -> ExplainerDoc:
        """Render and check one document; raises RuleViolation if the checker fails.

        ``reasons`` are the reason keys of a more_information_needed result
        (``CoupleResult.needs_more_information_reasons``). ``DisclosedResult`` has no field for
        them, so the caller passes them here; unknown keys fall back to a safe generic template.
        """
        bundle = self._bundles[locale]
        doc = render_result(bundle, disclosed, reasons)
        report = check_document(doc, disclosed, bundle)
        if not report.ok:
            raise RuleViolation(
                "The explanation failed its own checks and was not released.",
                violations=report.messages,
            )
        return doc.model_copy(update={"check": report.summary()})

    def check(self, doc: ExplainerDoc, disclosed: DisclosedResult | None) -> CheckReport:
        """Numeric fidelity, polarity and banned words, re-derived from the disclosed result."""
        return check_document(doc, disclosed, self._bundles[doc.locale])

    def glossary(self, locale: Locale) -> tuple[GlossaryEntry, ...]:
        return self._bundles[locale].glossary

    def options_pane(self, locale: Locale) -> ExplainerDoc:
        """Neutral order, no ranking; statute articles cited as the dossier states them."""
        bundle = self._bundles[locale]
        doc = render_options(bundle)
        report = check_document(doc, None, bundle)
        if not report.ok:
            raise RuleViolation(
                "The options pane failed its own checks.", violations=report.messages
            )
        return doc.model_copy(update={"check": report.summary()})


def build_explain_service() -> ExplainService:
    return ExplainService(load_bundles())
