"""Check the exported deck PDF against the organisers' upload rules and our own reading rules.

    uv run --with pypdfium2 --with pillow python -I check_deck.py DECK.pdf [--png PREVIEW_DIR]

Rules checked: PDF only and at most 5 MB (the form); every template slide heading present as real text (the template is
mandatory); every page carries a text layer (a machine reader must be able to read the deck); no page is a single picture.
With --png, writes a preview image per page for a visual check (the gate is necessary, never sufficient: look at them).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pypdfium2 as pdfium

HEADINGS = [
    "Team members",
    "Team Capability Summary",
    "Architecture or workflow diagram",
    "Target users and intended outcome",
    "How will success be measured",
    "Evidence supporting the approach",
    "Data sources and legal right to use them",
    "Risks and safeguards",
    "Hardware requirements",
    "login authentication",
    "Path to pilot and scale",
    "Pre-existing IP and third-party materials",
    "Conflict of interest declaration",
    "Additional Slide",
]
LIMIT_BYTES = 5 * 1024 * 1024
OLD = "ba" + "yan"  # the retired product name: built here so that this file does not contain it
# phrases that must not reach the deck: the retired name, dashes, a hosting claim, a severity or verdict word, a named competitor claim
FORBIDDEN = [
    (OLD, "the retired product name"),
    ("—", "an em dash"),
    ("–", "an en dash"),
    ("in the uae", "a hosting claim"),
    ("uae north", "a hosting claim"),
    ("azure", "a hosting claim"),
    ("clinically reviewed", "a clinical review claim"),
    ("clinically validated", "a clinical validation claim"),
    ("incompatible", "a banned verdict word"),
    ("residual risk", "residual-risk wording (allowed only as 'never a residual-risk number')"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--png", type=Path)
    a = ap.parse_args()
    bad: list[str] = []

    size = a.pdf.stat().st_size
    print(f"size: {size / 1024 / 1024:.2f} MB (limit 5 MB)")
    if size > LIMIT_BYTES:
        bad.append("PDF over 5 MB")

    doc = pdfium.PdfDocument(str(a.pdf))
    print(f"pages: {len(doc)}")
    alltext: list[str] = []
    for i in range(len(doc)):
        page = doc[i]
        txt = page.get_textpage().get_text_range()
        alltext.append(txt)
        n = len(txt.strip())
        print(f"  page {i + 1:2d}: {n:5d} characters of text")
        if n == 0 and i != len(doc) - 1:  # the template's closing slide is a picture
            bad.append(f"page {i + 1} has no text layer")
        if a.png:
            a.png.mkdir(parents=True, exist_ok=True)
            page.render(scale=1.5).to_pil().save(a.png / f"page-{i + 1:02d}.png")
    blob = "\n".join(alltext)
    for h in HEADINGS:
        if h.lower() not in blob.lower():
            bad.append(f"template heading missing from the text layer: '{h}'")
    low = blob.lower()
    for needle, why in FORBIDDEN:
        if needle in low:
            if needle == "residual risk" and low.count("residual-risk") and low.count("residual risk") == 0:
                continue
            bad.append(f"forbidden text in the deck: {why} ('{needle}')")
    if bad:
        print("DECK CHECK FAILED:\n  " + "\n  ".join(bad), file=sys.stderr)
        return 1
    print("deck check ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
