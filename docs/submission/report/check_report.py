"""Rasterise the report PDF and run text checks. uv run --quiet --with pypdfium2 --with pillow python -I check_report.py PDF PNG_DIR"""
import re, sys
from pathlib import Path
import pypdfium2 as pdfium

pdf, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for f in out.glob("*.png"):
    f.unlink()
doc = pdfium.PdfDocument(str(pdf))
print("pages:", len(doc), "size KB:", pdf.stat().st_size // 1024)
OLD = "ba" + "yan"
bad = []
alltext = []
for i in range(len(doc)):
    pg = doc[i]
    t = pg.get_textpage().get_text_range()
    alltext.append(t)
    print(f"page {i+1:2d}: {len(t.strip()):5d} chars")
    pg.render(scale=1.4).to_pil().save(out / f"p{i+1:02d}.png")
blob = "\n".join(alltext)
low = blob.lower()
low = re.sub(r"not clinically (reviewed|validated)", "", low)
for needle, why in [(OLD, "old name"), ("\u2014", "em dash"), ("\u2013", "en dash"), ("in the uae", "hosting"), ("uae north", "region"), ("azure", "provider"),
                    ("france", "region"), ("germany", "region"), ("westeurope", "region"), ("clinically validated", "claim"),
                    ("incompatible", "banned word"), ("residual risk", "residual risk with space"), ("[team", "placeholder"), ("[hosting", "placeholder")]:
    if needle in low:
        bad.append(f"{why}: {needle!r} x{low.count(needle)}")
print("BAD:" if bad else "text checks ok", *bad, sep="\n  ")
