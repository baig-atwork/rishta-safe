"""Text helpers shared by the renderer and the checker.

Digit handling is the heart of numeric fidelity: a number may be printed with Western digits,
Arabic-Indic digits (U+0660 to U+0669) or extended Arabic-Indic digits used for Urdu
(U+06F0 to U+06F9). Everything is normalised to ASCII before comparison.
"""

from __future__ import annotations

import re
import unicodedata
from functools import cache

ARABIC_INDIC = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"
EXTENDED_ARABIC_INDIC = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"
_ASCII = "0123456789"
_TO_ASCII = str.maketrans(ARABIC_INDIC + EXTENDED_ARABIC_INDIC, _ASCII + _ASCII)

# Arabic diacritics (harakat), superscript alef and tatweel: removed before word matching.
_DIACRITICS = re.compile("[\u064b-\u0652\u0670\u0640]")
# A standalone number: digits not glued to a letter or underscore on either side. Digits that
# sit inside an identifier such as HBA1 or c.123A>G belong to that identifier, not to a number.
_NUMBER = re.compile(r"(?<!\w)\d+(?!\w)")
_IDENTIFIER_WITH_DIGIT = re.compile(r"\b[A-Za-z][A-Za-z0-9_]*\d[A-Za-z0-9_]*\b")

# First-strong isolate and pop directional isolate: keep Latin text (gene symbols, labels) from
# reordering the surrounding right-to-left sentence.
FSI = "\u2068"
PDI = "\u2069"


def to_ascii_digits(text: str) -> str:
    """Map Arabic-Indic and extended Arabic-Indic digits to ASCII digits."""
    return text.translate(_TO_ASCII)


def format_int(value: int, digit_system: str) -> str:
    """Format a non-negative integer with the digit system of the locale."""
    digits = str(value)
    if digit_system == "arabic_indic":
        return digits.translate(str.maketrans(_ASCII, ARABIC_INDIC))
    if digit_system == "extended_arabic_indic":
        return digits.translate(str.maketrans(_ASCII, EXTENDED_ARABIC_INDIC))
    return digits


def number_tokens(text: str) -> list[str]:
    """Standalone digit sequences of ``text`` in order, normalised to ASCII digits."""
    return _NUMBER.findall(to_ascii_digits(text))


def identifier_tokens(text: str) -> list[str]:
    """Latin identifiers that contain a digit (gene symbols such as HBA1)."""
    return _IDENTIFIER_WITH_DIGIT.findall(text)


def mask_entities(text: str, entities: set[str]) -> str:
    """Replace known engine-supplied identifiers (genes, variant labels) by a neutral mark."""
    masked = text
    for entity in sorted(entities, key=len, reverse=True):
        if entity:
            masked = masked.replace(entity, "\u0000")
    return masked


@cache
def _normalise_cached(text: str) -> str:
    stripped = _DIACRITICS.sub("", text).replace(FSI, "").replace(PDI, "")
    folded = unicodedata.normalize("NFC", stripped).casefold()
    return re.sub(r"\s+", " ", folded)


def normalise_for_matching(text: str) -> str:
    """Case-fold, strip Arabic diacritics and tatweel, drop bidi isolates, collapse spaces."""
    return _normalise_cached(text)


def isolate(value: str) -> str:
    """Wrap engine-supplied Latin text in a bidi isolate."""
    return f"{FSI}{value}{PDI}"


def detection_rate_numbers(label: str) -> tuple[int, int] | None:
    """The two numerals of an engine detection label such as "about 9 in 10 ...", or None.

    The label is English text produced by the genetics lane. Only a label with exactly two
    numerals, a numerator smaller than a denominator of 10 or 100, is localised; anything else
    keeps the safe generic template that shows the label as supplied.
    """
    tokens = number_tokens(label)
    if len(tokens) != 2:
        return None
    numerator, denominator = int(tokens[0]), int(tokens[1])
    if denominator not in (10, 100) or not 0 < numerator < denominator:
        return None
    return numerator, denominator
