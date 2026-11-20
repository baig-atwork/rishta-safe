#!/usr/bin/env bash
# Build the filled PPTX from the rendered deck text, export it to PDF with the portable LibreOffice, and check the PDF.
# Usage: bash render_deck.sh [TEMPLATE.pptx]   (default: a copy of the organisers' template kept outside the repository)
set -euo pipefail
cd "$(dirname "$0")"
TEMPLATE="${1:-/d/tools/deck-work/template.pptx}"
OUT=../deck
mkdir -p "$OUT"
uv run --quiet --with python-pptx python -I build_deck.py --template "$TEMPLATE" --content ../deck/deck-content.md --out "$OUT/rishta-safe-deck.pptx" --assets "$OUT/assets"
# Outfit (SIL OFL) is the template's font; the portable copy reads fonts from its own share/fonts folder, nothing is installed system-wide
FONTDIR=/d/tools/libreoffice/share/fonts/truetype
mkdir -p "$FONTDIR"
cp -n /d/tools/fonts/Outfit*.ttf "$FONTDIR"/ 2>/dev/null || true
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$PWD/convert_pdf.ps1")" -In "$(cygpath -w "$PWD/$OUT/rishta-safe-deck.pptx")" -OutDir "$(cygpath -w "$PWD/$OUT")"
rm -rf "$OUT/preview"
uv run --quiet --with pypdfium2 --with pillow python -I check_deck.py "$OUT/rishta-safe-deck.pdf" --png "$OUT/preview"
