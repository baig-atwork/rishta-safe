"""English readability, computed. A scoreboard figure, not a clinical claim.

Flesch-Kincaid grade level (Kincaid, Fishburne, Rogers and Chissom, 1975):
    0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
Syllables are counted with a vowel-group heuristic, so scores are approximate (about one grade).

No validated Arabic or Urdu readability standard exists, so none is computed for them (research
05 section 3B: "reading-level checks only with human lay readers, because I found no validated
Arabic or Urdu readability formula"). Do not read the English figure as evidence about the
Arabic or Urdu drafts.
"""

from __future__ import annotations

import re

from bayan.core.contracts import BlockKind, ExplainerDoc
from bayan.explain.text_tools import mask_entities

_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_SENTENCE_END = re.compile(r"[.!?]+(?:\s|$)")
_VOWEL_GROUP = re.compile(r"[aeiouy]+")


def count_syllables(word: str) -> int:
    """Heuristic syllable count: vowel groups, minus a silent final e or ed."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    count = len(_VOWEL_GROUP.findall(w))
    if (
        (w.endswith("e") and not w.endswith(("le", "ee", "ie")) and count > 1)
        or (w.endswith("ed") and not w.endswith(("ted", "ded")) and count > 1)
        or (w.endswith("es") and not w.endswith(("ses", "xes", "zes", "ces", "ges")) and count > 1)
    ):
        count -= 1
    return max(count, 1)


def flesch_kincaid_grade(text: str) -> float:
    """Flesch-Kincaid grade of English prose. Returns 0.0 for text with no words."""
    words = _WORD.findall(text)
    sentences = max(len(_SENTENCE_END.findall(text + " ")), 1)
    if not words:
        return 0.0
    syllables = sum(count_syllables(w) for w in words)
    return 0.39 * (len(words) / sentences) + 11.8 * (syllables / len(words)) - 15.59


def prose_of(doc: ExplainerDoc, entities: set[str] | None = None) -> str:
    """The sentences of a document (headings excluded, gene symbols masked), one per line."""
    lines: list[str] = []
    for block in doc.blocks:
        if block.kind is BlockKind.HEADING:
            continue
        for piece in ([block.text] if block.text else []) + list(block.items):
            text = mask_entities(piece, entities or set()).replace("\u0000", "gene")
            text = re.sub(r"[\u2068\u2069]", "", text)
            lines.append(text if text.rstrip().endswith((".", "!", "?")) else text + ".")
    return " ".join(lines)


def document_grade(doc: ExplainerDoc, entities: set[str] | None = None) -> float:
    return flesch_kincaid_grade(prose_of(doc, entities))
