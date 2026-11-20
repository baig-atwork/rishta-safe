"""Fill the organisers' reference PPT with the rendered deck text.

    uv run --with python-pptx python -I build_deck.py --template TEMPLATE.pptx --content ../2026-11-16-deck.md \
        --out ../deck/stellar-blaze-deck.pptx [--assets ../deck/assets]

The template's slides keep their own headings, banners and positions (the rules say the template is mandatory); this
script adds the body below each heading, and adds a few continuation slides cloned from a template slide. All text
stays real text (tables, captions and the architecture diagram are native shapes), so the exported PDF has a text layer.
Exits 1 when a slide's content overflows its page, naming the slide, so nothing is silently clipped.
"""

from __future__ import annotations

import argparse
import copy
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.util import Emu, Pt

PX = 9525  # EMU per pixel at 96 dpi; the template is 960 x 540 px
FONT = "Outfit"
MONO = "Consolas"
INK = RGBColor(0x26, 0x26, 0x26)
GREY = RGBColor(0x59, 0x59, 0x59)
HEAD_FILL = RGBColor(0x21, 0x21, 0x21)
BAND = RGBColor(0xF3, 0xF4, 0xF6)
RULE = "D0D3D8"
ACCENT = RGBColor(0x1A, 0x51, 0xBD)
X0, Y0, W, Y_MAX = 27, 140, 906, 524  # body region, px (the template's prompt lines are removed, so the body starts under the heading)
Y_CLONE = 136  # continuation slides have a heading and no prompt line under it, so the body starts higher
COLS_PRESETS = {"picture-right": 48.0, "picture-left": 71.0}  # "picture-left": a wide picture column on the left, a short text column on the right
_UNUSED = {"picture-right": 48.0}  # "@cols picture-right": the table column takes 48 percent, the picture column the rest
S04_LEFT = 548  # width of the architecture picture's column on S04


@dataclass
class Block:
    kind: str  # para | bullets | table | sub | small | diagram | img
    data: object
    aligns: list[str] | None = None  # tables only: "l", "r" or "c" per column (markdown :---, ---:, :---:)


@dataclass
class Spec:
    sid: str
    title: str | None
    cols: list[list[Block]] = field(default_factory=lambda: [[]])
    first_col_pct: float | None = None  # "@cols 48": the first of two columns takes 48 percent of the width


def parse(md: str) -> list[Spec]:
    specs: list[Spec] = []
    cur: Spec | None = None
    lines = md.splitlines()
    i = 0
    buf: list[str] = []

    def flush_para() -> None:
        nonlocal buf
        if buf and cur is not None:
            cur.cols[-1].append(Block("para", " ".join(s.strip() for s in buf)))
        buf = []

    while i < len(lines):
        ln = lines[i]
        m = re.match(r"^## (S\d+\w*)(?:\s*\|\s*(.*)|\s+(.*))?$", ln)
        if m:
            flush_para()
            title = m.group(2) or m.group(3)
            cur = Spec(m.group(1), title.strip() if title else None)
            specs.append(cur)
            i += 1
            continue
        if cur is None:
            i += 1
            continue
        s = ln.strip()
        if not s:
            flush_para()
        elif s == "@cols" or s.startswith("@cols "):
            flush_para()
            if s != "@cols":
                cur.first_col_pct = COLS_PRESETS[s.split()[1]]
        elif s.startswith("@small "):
            flush_para()
            cur.cols[-1].append(Block("small", s[7:]))
        elif s == "@col":
            flush_para()
            cur.cols.append([])
        elif s.startswith("@sub "):
            flush_para()
            cur.cols[-1].append(Block("sub", s[5:]))
        elif s.startswith("@diagram "):
            flush_para()
            cur.cols[-1].append(Block("diagram", s[9:].strip()))
        elif s.startswith("@img "):
            flush_para()
            cap, _, path = s[5:].partition("|")
            cur.cols[-1].append(Block("img", (cap.strip(), path.strip())))
        elif s.startswith("|"):
            flush_para()
            rows = []
            aligns = None
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                    rows.append(cells)
                else:
                    aligns = ["c" if c.startswith(":") and c.endswith(":") else "r" if c.endswith(":") else "l" for c in cells]
                i += 1
            cur.cols[-1].append(Block("table", rows, aligns))
            continue
        elif s.startswith("- "):
            flush_para()
            items = []
            while i < len(lines) and lines[i].strip().startswith("- "):
                items.append(lines[i].strip()[2:])
                i += 1
            cur.cols[-1].append(Block("bullets", items))
            continue
        elif s.startswith("# "):
            pass
        else:
            buf.append(s)
        i += 1
    flush_para()
    return [sp for sp in specs if sp.cols and any(sp.cols)]


# ---- text helpers ---------------------------------------------------------------------------------------------
TOKEN = re.compile(r"(\*\*.+?\*\*|`[^`]+`)")


def add_runs(p, text: str, size: float, color: RGBColor = INK, bold: bool = False) -> None:
    for part in TOKEN.split(text):
        if not part:
            continue
        r = p.add_run()
        if part.startswith("**"):
            r.text, r.font.bold = part[2:-2], True
        elif part.startswith("`"):
            r.text, r.font.name, r.font.size = part[1:-1], MONO, Pt(max(size - 1.5, 6))
            r.font.color.rgb = color
            continue
        else:
            r.text, r.font.bold = part, bold
        r.font.name, r.font.size = FONT, Pt(size)
        r.font.color.rgb = color


def est_lines(text: str, width_px: float, size: float) -> int:
    plain = re.sub(r"\*\*|`", "", text)
    cpl = max(int(width_px / (size * 96 / 72 * 0.50)), 8)
    return sum(max(1, -(-len(seg) // cpl)) for seg in plain.split("\n"))


def line_px(size: float) -> float:
    return size * 96 / 72 * 1.22


# ---- block renderers (return the new y) -------------------------------------------------------------------------
def r_para(slide, text: str, x: float, y: float, w: float, size: float = 9.5, color: RGBColor = INK) -> float:
    n = est_lines(text, w - 8, size)
    h = n * line_px(size) + 8
    tb = slide.shapes.add_textbox(Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(4 * PX)
    tf.margin_top = tf.margin_bottom = Emu(2 * PX)
    add_runs(tf.paragraphs[0], text, size, color)
    return y + h + 3


def r_bullets(slide, items: list[str], x: float, y: float, w: float, size: float = 9.5) -> float:
    total = sum(est_lines(t, w - 22, size) * line_px(size) + 3 for t in items) + 6
    tb = slide.shapes.add_textbox(Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(total * PX)))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(4 * PX)
    tf.margin_top = tf.margin_bottom = Emu(2 * PX)
    for k, t in enumerate(items):
        p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
        p.space_after = Pt(2)
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(int(12 * PX)))
        pPr.set("indent", str(int(-12 * PX)))
        bu = pPr.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}buChar", {"char": "•"})
        pPr.append(bu)
        add_runs(p, t, size)
    return y + total + 2


def set_border(cell, color: str = RULE) -> None:
    """Thin grey cell borders, inserted before the fill so the element order matches the schema (lnL lnR lnT lnB, then fill)."""
    ns = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    tcPr = cell._tc.get_or_add_tcPr()
    for k, tag in enumerate(("lnL", "lnR", "lnT", "lnB")):
        ln = tcPr.makeelement(ns + tag, {"w": "6350"})
        sf = ln.makeelement(ns + "solidFill", {})
        sf.append(sf.makeelement(ns + "srgbClr", {"val": color}))
        ln.append(sf)
        tcPr.insert(k, ln)


def _align(p, aligns, c_i) -> None:
    if aligns and c_i < len(aligns) and aligns[c_i] != "l":
        p.alignment = PP_ALIGN.RIGHT if aligns[c_i] == "r" else PP_ALIGN.CENTER


def r_table(slide, rows: list[list[str]], x: float, y: float, w: float, size: float = 8, aligns: list[str] | None = None) -> float:
    ncol = len(rows[0])
    weights = [max(sum(len(r[c]) for r in rows) / len(rows), 6) ** 0.8 for c in range(ncol)]
    tot = sum(weights)
    widths = [w * wt / tot for wt in weights]
    mins = [max((len(re.sub(r"\*\*|`", "", word)) for r in rows for word in r[c].split()), default=4) * size * 96 / 72 * 0.56 + 14 for c in range(ncol)]
    for _ in range(4):  # lift narrow columns to their longest word, take the width from the widest columns
        short = [c for c in range(ncol) if widths[c] < mins[c]]
        if not short:
            break
        need = sum(mins[c] - widths[c] for c in short)
        wide = [c for c in range(ncol) if c not in short and widths[c] > mins[c] + 20]
        if not wide:
            break
        take = need / len(wide)
        for c in short:
            widths[c] = mins[c]
        for c in wide:
            widths[c] -= take
    heights = []
    for r_i, r in enumerate(rows):
        n = max(est_lines(r[c], widths[c] - 10, size) for c in range(ncol))
        heights.append(n * line_px(size) + 7)
    shape = slide.shapes.add_table(len(rows), ncol, Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(sum(heights) * PX)))
    tbl = shape.table
    tblPr = tbl._tbl.tblPr
    tblPr.set("firstRow", "1")
    tblPr.set("bandRow", "0")
    sid = tblPr.find("{http://schemas.openxmlformats.org/drawingml/2006/main}tableStyleId")
    if sid is not None:
        sid.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"  # No Style, No Grid
    for c in range(ncol):
        tbl.columns[c].width = Emu(int(widths[c] * PX))
    for r_i, r in enumerate(rows):
        tbl.rows[r_i].height = Emu(int(heights[r_i] * PX))
        for c_i, txt in enumerate(r):
            cell = tbl.cell(r_i, c_i)
            cell.margin_left = cell.margin_right = Emu(5 * PX)
            cell.margin_top = cell.margin_bottom = Emu(2 * PX)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            tf = cell.text_frame
            tf.word_wrap = True
            if r_i == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = HEAD_FILL
                add_runs(tf.paragraphs[0], txt, size, RGBColor(0xFF, 0xFF, 0xFF), bold=True)
                _align(tf.paragraphs[0], aligns, c_i)
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = BAND if r_i % 2 == 0 else RGBColor(0xFF, 0xFF, 0xFF)
                add_runs(tf.paragraphs[0], txt, size, INK, bold=(c_i == 0))
                _align(tf.paragraphs[0], aligns, c_i)
            set_border(cell)
    return y + sum(heights) + 12


def r_diagram(slide, x: float, y: float, w: float) -> float:
    """The architecture picture as native shapes with real text, so the PDF text layer carries it."""
    from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE

    def box(bx, by, bw, bh, title, body, fill, fg=INK):
        s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(int((x + bx) * PX)), Emu(int((y + by) * PX)), Emu(int(bw * PX)), Emu(int(bh * PX)))
        s.adjustments[0] = 0.08
        s.fill.solid()
        s.fill.fore_color.rgb = fill
        s.line.color.rgb = RGBColor(0xB8, 0xBE, 0xC8)
        s.line.width = Pt(0.75)
        s.shadow.inherit = False
        tf = s.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = Emu(5 * PX)
        tf.margin_top = tf.margin_bottom = Emu(3 * PX)
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        add_runs(p, title, 8.5, fg, bold=True)
        if body:
            p2 = tf.add_paragraph()
            p2.alignment = PP_ALIGN.CENTER
            add_runs(p2, body, 7.5, fg)

    def arrow(x1, y1, x2, y2):
        c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Emu(int((x + x1) * PX)), Emu(int((y + y1) * PX)), Emu(int((x + x2) * PX)), Emu(int((y + y2) * PX)))
        c.line.color.rgb = GREY
        c.line.width = Pt(1.1)
        ln = c.line._get_or_add_ln()
        ln.append(ln.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}tailEnd", {"type": "triangle", "w": "med", "len": "med"}))

    BL, GR, AM, WH = RGBColor(0xE3, 0xEE, 0xFB), RGBColor(0xE8, 0xF3, 0xEA), RGBColor(0xFD, 0xF1, 0xDC), RGBColor(0xF3, 0xF4, 0xF6)
    bw = (w - 20) / 2
    cy = 0.0

    def row(h, items):
        """Place boxes side by side on one row at the cursor; returns the row's top."""
        nonlocal cy
        top = cy
        for bx, bwid, title, body, fill in items:
            box(bx, top, bwid, h, title, body, fill)
        cy += h
        return top

    def gap(n=14):
        nonlocal cy
        cy += n

    row(36, [(0, bw, "Forecast archives", "ECMWF IFS and AIFS, NOAA GFS", BL), (bw + 20, bw, "Station observations", "IEM METAR, NOAA GHCNh", BL)])
    arrow(w / 2, cy, w / 2, cy + 14)
    gap()
    row(36, [(0, w, "Corrector", "LightGBM quantile model, conformal intervals: an honest range per hour", GR)])
    arrow(w / 2, cy, w / 2, cy + 12)
    gap(12)
    row(36, [(0, w, "Zone engine", "WBGT and Thermal Work Limit zones, aligned with ADOSH-SF CoP 11.0", GR)])
    arrow(w / 2, cy, w / 2, cy + 12)
    gap(12)
    top = row(44, [(0, bw, "Warning policy", "P(High zone) at or above the employer's operating point", AM), (bw + 20, bw, "Planner", "Work-rest cycles, midday ban, working-hours limits", AM)])
    arrow(bw, top + 22, bw + 20, top + 22)
    arrow(bw + 20 + bw / 2, cy, bw + 20 + bw / 2, cy + 12)
    gap(12)
    row(44, [(0, bw, "Governance", "Role checks; health-data request: 403 and a hash-chained audit", WH), (bw + 20, bw, "Independent validator", "No shared code; cites the clause it breaks", AM)])
    arrow(w / 2, cy, w / 2, cy + 12)
    gap(12)
    row(38, [(0, w, "API and installable offline-first app", "FastAPI, PostgreSQL; worker, supervisor, regulator, judge; six languages; Web Push", WH)])
    t = slide.shapes.add_textbox(Emu(int(x * PX)), Emu(int((y + cy + 2) * PX)), Emu(int(w * PX)), Emu(int(16 * PX)))
    add_runs(t.text_frame.paragraphs[0], "Designed for Azure UAE North; the demo runs in France Central. Replay mode serves the recorded 2026 summer.", 7.5, GREY)
    return y + cy + 20


def r_img(slide, cap: str, path: Path, x: float, y: float, w: float, hmax: float) -> float:
    from PIL import Image

    with Image.open(path) as im:
        ratio = im.height / im.width
    h = min(w * ratio, hmax)
    wi = h / ratio
    slide.shapes.add_picture(str(path), Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(wi * PX)), Emu(int(h * PX)))
    return r_para(slide, cap, x, y + h + 2, w, 9, GREY) if cap else y + h + 6


# ---- slide assembly -----------------------------------------------------------------------------------------------
def clone_slide(prs: Presentation, src, keep_ids: set[int] | None = None):
    """Clone the template slide's own shapes; keep_ids limits the copy to the shapes the template had, so that text
    boxes added to the source slide by the layout pass (S02's 'One entrant.') do not leak into the clones."""
    new = prs.slides.add_slide(src.slide_layout)
    for shp in list(new.shapes):
        shp._element.getparent().remove(shp._element)
    for shp in src.shapes:
        if keep_ids is not None and shp.shape_id not in keep_ids:
            continue
        if shp._element.tag.endswith("}graphicFrame"):
            continue  # the template's own table belongs to its slide only
        el = copy.deepcopy(shp._element)
        new.shapes._spTree.append(el)
        if shp.shape_type is not None and el.tag.endswith("}pic"):
            blip = el.xpath(".//a:blip")[0]
            old = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            part = src.part.related_part(old)
            rid = new.part.relate_to(part, RT.IMAGE)
            blip.set("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed", rid)
    return new


def set_title(slide, title: str) -> None:
    for shp in slide.shapes:
        if shp.has_text_frame and shp.text_frame.text.strip():
            tf = shp.text_frame
            while len(tf.paragraphs) > 1:
                tf._txBody.remove(tf.paragraphs[-1]._p)
            runs = tf.paragraphs[0].runs
            runs[0].text = title
            for r in runs[1:]:
                r._r.getparent().remove(r._r)
            return


def fill_title_slide(slide, blocks: list[Block]) -> None:
    box = next(s for s in slide.shapes if s.has_text_frame and "Team Name" in s.text_frame.text)
    joined = " ".join(str(b.data) for b in blocks if b.kind == "para")
    values = {m.group(1): m.group(2).strip() for m in re.finditer(r"(Team Name|Team Size|Problem Statement):\s*(.*?)(?=(?:Team Name|Team Size|Problem Statement):|$)", joined)}
    for p in box.text_frame.paragraphs:
        label = "".join(r.text for r in p.runs).strip().rstrip(":")
        if label in values:
            base = p.runs[0]
            new = copy.deepcopy(base._r)
            p._p.insert(list(p._p).index(base._r) + 1, new)
            for t in new.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}t"):
                t.text = values[label]
            rPr = new.find("{http://schemas.openxmlformats.org/drawingml/2006/main}rPr")
            if rPr is not None:
                rPr.set("b", "1")
    for b in blocks:
        if b.kind == "sub":
            p = box.text_frame.add_paragraph()
            p.space_before = Pt(10)
            add_runs(p, str(b.data), 14, GREY)


def fill_member_table(slide, rows: list[list[str]]) -> None:
    gf = next(sh for sh in slide.shapes if sh.has_table)
    tbl = gf.table
    for r_i, r in enumerate(rows[1:], start=1):
        for c_i, txt in enumerate(r):
            tf = tbl.cell(r_i, c_i).text_frame
            p = tf.paragraphs[0]
            for run in list(p.runs):
                run._r.getparent().remove(run._r)
            add_runs(p, txt, 9.5)
    keep = len(rows)
    trs = tbl._tbl.tr_lst
    for tr in trs[keep:]:
        tbl._tbl.remove(tr)


BIG_TEXT = {"S03": 14.0, "S10": 15.0, "S14": 14.0}  # single-paragraph pages: one size step up
TABLE_SIZE = {"S01b": 10.5, "S06": 10.5, "S07b": 10, "S08": 10, "S09": 10, "S12": 10, "S13": 10}  # dense tables: one step down from 11 pt
EDGE = 4  # tables and pictures start where the text inside the text boxes starts (the text boxes have a 4 px margin)
Y_START = {"S04": 136, "S05": 140, "S06": 140, "S15": 140, "S01b": 136}  # template slides with a heading and no prompt line under it


def layout(slide, spec: Spec, assets: Path | None, y_start: float | None = None) -> list[str]:
    warns: list[str] = []
    ncols = len(spec.cols)
    gap = 16
    if y_start is None:
        y_start = Y_START.get(spec.sid, Y0)
    cw = (W - gap * (ncols - 1)) / ncols
    body = BIG_TEXT.get(spec.sid, 12.0)
    for ci, blocks in enumerate(spec.cols):
        x, y = X0 + ci * (cw + gap), float(y_start)
        if spec.sid == "S04" and ncols == 2:  # a two-column S04 keeps the picture left and the legend right
            cw_c = S04_LEFT if ci == 0 else W - S04_LEFT - gap
            x = X0 if ci == 0 else X0 + S04_LEFT + gap
        elif ncols == 2 and spec.first_col_pct:
            cw_c = (W - gap) * (spec.first_col_pct if ci == 0 else 100 - spec.first_col_pct) / 100
            x = X0 if ci == 0 else X0 + (W - gap) * spec.first_col_pct / 100 + gap
        else:
            cw_c = cw
        size_b = 10 if spec.sid == "S04" else body
        for bi, b in enumerate(blocks):
            if b.kind == "para":
                y = r_para(slide, str(b.data), x, y, cw_c, size_b)
            elif b.kind == "sub":
                y = r_para(slide, str(b.data), x, y, cw_c, 11, GREY)
            elif b.kind == "small":
                y = r_para(slide, str(b.data), x, y, cw_c, 9)
            elif b.kind == "bullets":
                y = r_bullets(slide, list(b.data), x, y, cw_c, size_b)
            elif b.kind == "table":
                y = r_table(slide, list(b.data), x + EDGE, y, cw_c - EDGE, 9.5 if ncols == 2 else TABLE_SIZE.get(spec.sid, 11), b.aligns)
            elif b.kind == "diagram":
                y = r_diagram(slide, x, y, cw_c)
            elif b.kind == "img" and assets is not None:
                cap, path = b.data
                cap_h = (est_lines(cap, cw_c - 8, 9) * line_px(9) + 11) if cap else 6  # the caption sits under the picture: reserve its height
                after = sum(  # and the height of the blocks that follow the picture in the same column
                    est_lines(str(o.data), cw_c - 8, size_b) * line_px(size_b) + 11 if o.kind in ("para", "sub", "small")
                    else sum(est_lines(s, cw_c - 22, size_b) * line_px(size_b) + 3 for s in o.data) + 8 if o.kind == "bullets"
                    else 0
                    for o in blocks[bi + 1:]
                )
                margin = 4 if spec.sid in ("S04", "S04b", "S05b", "S07", "S12b") else 14
                y = r_img(slide, cap, assets / path, x + EDGE, y, cw_c - EDGE, Y_MAX - y - margin - cap_h - after)
        if y > Y_MAX + 1:
            warns.append(f"{spec.sid} column {ci + 1}: content ends at {y:.0f}px, page limit {Y_MAX}px")
    return warns


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True, type=Path)
    ap.add_argument("--content", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--assets", type=Path)
    a = ap.parse_args()

    specs = parse(a.content.read_text(encoding="utf-8"))
    pages = {sp.sid: str(i + 1) for i, sp in enumerate(specs)}

    def subst(o):
        if isinstance(o, str):
            return re.sub(r"\[\[(S\d+\w*)\]\]", lambda m: pages[m.group(1)], o)
        if isinstance(o, list):
            return [subst(x) for x in o]
        if isinstance(o, tuple):
            return tuple(subst(x) for x in o)
        return o

    for sp in specs:
        for col in sp.cols:
            for bl in col:
                bl.data = subst(bl.data)
    prs = Presentation(str(a.template))
    base = list(prs.slides)  # 16 template slides; the last is the closing picture
    by_id = {f"S{i + 1:02d}": base[i] for i in range(15)}
    order: list = []
    warns: list[str] = []
    cont_src = base[1]
    cont_ids = {shp.shape_id for shp in cont_src.shapes}
    for spec in specs:
        if spec.sid in by_id:
            slide = by_id[spec.sid]
            if spec.sid == "S01":
                fill_title_slide(slide, spec.cols[0])
            else:
                if spec.sid != "S15" and spec.title:
                    set_title(slide, spec.title)  # keeps the template heading, drops its bracketed prompt line
                if spec.sid == "S02":
                    tables =[bl for col in spec.cols for bl in col if bl.kind == "table"]
                    fill_member_table(slide, list(tables[0].data))
                    for col in spec.cols:
                        col[:] = [bl for bl in col if bl.kind != "table"]
                    warns += layout(slide, spec, a.assets, y_start=292)
                    order.append(slide)
                    continue
                if spec.sid == "S15":
                    # the template puts "Additional Slide" at the bottom of the page; move it to the heading position
                    box = next(sh for sh in slide.shapes if sh.has_text_frame and "Additional Slide" in sh.text_frame.text)
                    box.left, box.top = Emu(259650), Emu(861225)
                    if spec.title:
                        set_title(slide, spec.title)  # the organisers' "Additional Slide" label is replaced by a real heading
                warns += layout(slide, spec, a.assets)
            order.append(slide)
        else:
            slide = clone_slide(prs, cont_src, cont_ids)
            set_title(slide, spec.title or spec.sid)
            warns += layout(slide, spec, a.assets, y_start=Y_CLONE)
            order.append(slide)
    # the template slides the content did not mention keep their place; the closing picture stays last
    mentioned = {id(s) for s in order}
    final: list = []
    for spec_slide in order:
        final.append(spec_slide)
    for s in base[:15]:
        if id(s) not in mentioned:
            final.append(s)
    final.append(base[15])
    # put template slides in template order, extras right after the slide they continue
    ids = [sp.sid for sp in specs]
    pos = {}
    for i, sid in enumerate(ids):
        pos[id(order[i])] = (int(re.match(r"S(\d+)", sid).group(1)), 0 if sid in by_id else 1, i)
    final_sorted = sorted([s for s in final if id(s) in pos], key=lambda s: pos[id(s)]) + [s for s in final if id(s) not in pos]
    sld = prs.slides._sldIdLst
    items = {id(prs.slides[i]): el for i, el in enumerate(list(sld))}
    for el in list(sld):
        sld.remove(el)
    for s in final_sorted:
        sld.append(items[id(s)])
    a.out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(a.out))
    print(f"saved {a.out} with {len(prs.slides)} slides")
    for w in warns:
        print("OVERFLOW:", w, file=sys.stderr)
    return 1 if warns else 0


if __name__ == "__main__":
    sys.exit(main())
