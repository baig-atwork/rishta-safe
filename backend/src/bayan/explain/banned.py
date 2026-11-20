"""Banned-word guard (hard rule 4). The lists live in ``data/templates.banned.yaml``."""

from __future__ import annotations

import re
from collections.abc import Iterable
from functools import cache

from bayan.core.types import Locale
from bayan.explain.loader import load_banned
from bayan.explain.models import BannedList
from bayan.explain.text_tools import normalise_for_matching

# The product name contains a banned word ("safe"). Masked before matching so the name itself is allowed while the word
# still fails everywhere else (ADR 0227).
_BRAND = re.compile(r"rishta[\s\-]+safe", re.IGNORECASE)


@cache
def _word_pattern(term: str) -> re.Pattern[str]:
    words = normalise_for_matching(term).split(" ")
    body = r"[\s\-]+".join(re.escape(w) for w in words)
    return re.compile(rf"(?<!\w){body}(?!\w)")


def _hits(text: str, spec: BannedList) -> list[str]:
    normalised = normalise_for_matching(_BRAND.sub(" ", text))
    found: list[str] = []
    for term in spec.terms:
        if spec.match == "substring":
            if normalise_for_matching(term) in normalised:
                found.append(term)
        elif _word_pattern(term).search(normalised):
            found.append(term)
    return found


def find_banned(text: str, locale: Locale, *, extra: Iterable[Locale] = ()) -> list[str]:
    """Banned terms found in ``text``: the English list always, plus the list of ``locale``.

    English is always scanned because engine-supplied labels and Latin-script terms can appear
    inside Arabic and Urdu text. Other locales are scanned only when named in ``extra``.
    """
    banned = load_banned()
    scanned: list[Locale] = [Locale.EN]
    for candidate in (locale, *extra):
        if candidate not in scanned:
            scanned.append(candidate)
    found: list[str] = []
    for loc in scanned:
        found.extend(_hits(text, banned[loc]))
    return found
