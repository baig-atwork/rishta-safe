"""Text normalisation shared by the refusal classifier and the escalation phrase lists.

Deterministic and dependency free. Normalisation is applied to BOTH the user text and every
pattern in the data files, so a pattern can be written in natural spelling and still match the
variant spellings that Arabic and Urdu keyboards produce.
"""

from __future__ import annotations

import re
import unicodedata

# Arabic diacritics (tashkeel), superscript alef, tatweel, and zero-width / bidi control marks.
_STRIP = re.compile("[\u064b-\u065f\u0670\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]")
_SPACE = re.compile(r"\s+")
_FOLD = str.maketrans(
    {
        # alef forms and hamza seats
        "\u0623": "\u0627",  # alef with hamza above
        "\u0625": "\u0627",  # alef with hamza below
        "\u0622": "\u0627",  # alef with madda
        "\u0671": "\u0627",  # alef wasla
        "\u0624": "\u0648",  # waw with hamza
        "\u0626": "\u064a",  # yeh with hamza
        # yeh / alef maksura / Urdu yeh and yeh barree
        "\u0649": "\u064a",
        "\u06cc": "\u064a",
        "\u06d2": "\u064a",
        "\u06d3": "\u064a",
        # teh marbuta and Urdu heh forms fold to heh
        "\u0629": "\u0647",
        "\u06c1": "\u0647",
        "\u06be": "\u0647",
        "\u06c3": "\u0647",
        # kaf forms
        "\u06a9": "\u0643",
        # noon ghunna
        "\u06ba": "\u0646",
        # Arabic-Indic and extended digits to ASCII
        **{chr(0x0660 + i): str(i) for i in range(10)},
        **{chr(0x06F0 + i): str(i) for i in range(10)},
    }
)


_APOSTROPHES = str.maketrans("", "", "'’ʼ‘`")


def normalize(text: str) -> str:
    """NFKC, case-fold, strip diacritics, control marks and apostrophes, fold letter variants,
    collapse whitespace. Patterns in the data files are written without apostrophes."""
    folded = unicodedata.normalize("NFKC", text).casefold().translate(_APOSTROPHES)
    folded = _STRIP.sub("", folded).translate(_FOLD)
    return _SPACE.sub(" ", folded).strip()


def fold_pattern(pattern: str) -> str:
    """Apply the letter folding to a regular expression WITHOUT case-folding it.

    `casefold` would lower-case the upper-case regex escapes (non-word, non-space, non-boundary),
    which changes their meaning. Patterns are therefore written in lower case and only the Arabic and Urdu letter variants are
    folded, exactly as `normalize` folds the text they are matched against.
    """
    return _STRIP.sub("", pattern).translate(_FOLD)
