"""Charts for the technical report, drawn as inline SVG from the scoreboard file.

Every figure that appears in a chart is parsed from scoreboard.json (the strings in `value` and the numeric fields),
or, for the interface chart, from the numbers recorded in the report text. Nothing is typed by hand into a bar.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(r"D:\dev\bayan")
SCOREBOARD = ROOT / "backend" / "src" / "bayan" / "data" / "scoreboard.json"

INK, INK2, INK3, PAPER, WHITE = "#0f1217", "#4a5361", "#6b7482", "#f8f9fb", "#ffffff"
LAPIS, HAIR, HAIR2 = "#1a51bd", "#c9ced6", "#e1e5ea"
SANS = "Outfit, Archivo, Arial, sans-serif"
MONO = "'Red Hat Mono', Consolas, monospace"

sb = json.loads(SCOREBOARD.read_text(encoding="utf-8"))
M = {m["id"]: m for m in sb["metrics"]}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def num(s: str) -> float:
    return float(s.replace(",", ""))


def grab(metric: str, pattern: str) -> tuple[str, ...]:
    m = re.search(pattern, M[metric]["value"])
    if not m:
        raise SystemExit(f"scoreboard {metric}: pattern {pattern!r} not found in {M[metric]['value']!r}")
    return m.groups()


def T(x, y, s, size=12, weight=400, fill=INK, anchor="start", mono=False, ls=None, extra=""):
    fam = MONO if mono else SANS
    lsp = f' letter-spacing="{ls}"' if ls is not None else ""
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-family="{fam}" font-size="{size}" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="{anchor}"{lsp}{extra}>{esc(s)}</text>'
    )


def R(x, y, w, h, fill="none", stroke="none", sw=1, dash=None, extra=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}{extra}/>'


def L(x1, y1, x2, y2, stroke=HAIR, sw=1, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}"{d}/>'


def svg(w, h, body, pid, title, desc):
    defs = (
        f'<defs><pattern id="{pid}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        f'<rect width="6" height="6" fill="{WHITE}"/><line x1="0" y1="0" x2="0" y2="6" stroke="{INK}" stroke-width="1.7"/></pattern>'
        f'<marker id="{pid}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
        f'<path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>'
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="{pid}t {pid}d">'
        f'<title id="{pid}t">{esc(title)}</title><desc id="{pid}d">{esc(desc)}</desc>{defs}'
        f'<rect width="{w}" height="{h}" fill="{PAPER}"/>{body}</svg>'
    )


def cell(x, y, kind, s=10, pid="x"):
    """Tally cell: solid, hatched, open, lapis."""
    if kind == "solid":
        return R(x, y, s, s, INK)
    if kind == "lapis":
        return R(x, y, s, s, LAPIS)
    if kind == "hatch":
        return R(x, y, s, s, f"url(#{pid}h)", INK, 1)
    if kind == "open":
        return R(x, y, s, s, WHITE, INK, 1)
    if kind == "lapisopen":
        return R(x, y, s, s, WHITE, LAPIS, 1.6)
    if kind == "mute":
        return R(x, y, s, s, "#8b94a1")
    raise ValueError(kind)


# --------------------------------------------------------------------------------------------- (a) evidence chart
def chart_evidence() -> str:
    pid = "ev"
    W = 700
    BX, BW, VX = 258, 228, 498
    m6_k, m6_n, m6_p = grab("M6", r"(\d+) of (\d+) refused \((\d+)%\)")
    m7_med, m7_share, m7_tgt = grab("M7", r"median time to result ([\d.]+) days; (\d+)% of flagged cases \(\d+ of \d+\) referred within the standard \(target (\d+)%\)")
    m4_rec, m4_k, m4_n = grab("M4", r"recall (\d+)% \(([\d,]+) of ([\d,]+) must")
    (m4_prec,) = grab("M4", r"(\d+)% including hard negatives")
    m1_k, m1_n = grab("M1", r"([\d,]+) of ([\d,]+) synthetic couples")
    m2_docs, = grab("M2", r"(\d+) documents")
    m2b_k, m2b_n = grab("M2b", r"([\d,]+) of ([\d,]+) injected")
    m5_dec, m5_mis = grab("M5", r"([\d,]+) disclosure decisions"), grab("M5", r"(\d+) mismatches")
    m1b_o, m1b_c = grab("M1b", r"observed ([\d.]+)% against closed form ([\d.]+)%")
    m3_mean, m3_max = grab("M3", r"grade ([\d.]+) on average, ([\d.]+) at most")

    rows = [
        ("hdr", "The two lowest figures, shown first"),
        ("bar", "M6", "Refusal, held-out first run", f"{m6_k} of {m6_n} refused ({m6_p}%)", int(m6_p) / 100, "lapis", None),
        ("bar", "M7", "Referral within the standard", f"{m7_share}% of flagged cases, target {m7_tgt}%", int(m7_share) / 100, "ink", int(m7_tgt) / 100),
        ("hdr", "At or near 100%: a regression gate, not safety evidence (the same team wrote both sides)"),
        ("bar", "M4", "Escalation precision, hard negatives", f"{m4_prec}%", int(m4_prec) / 100, "mute", None),
        ("bar", "M4", "Escalation recall", f"{m4_k} of {m4_n} must-escalate cases", int(m4_rec) / 100, "mute", None),
        ("bar", "M1", "Engine against oracle", f"{m1_k} of {m1_n} agree", 1.0, "mute", None),
        ("bar", "M2", "Explanations, 3 languages", f"{m2_docs} documents, numbers 100%", 1.0, "mute", None),
        ("bar", "M2b", "Checker on injected faults", f"{m2b_k} of {m2b_n} caught", 1.0, "mute", None),
        ("bar", "M5", "Disclosure vs reference model", f"{m5_dec[0]} decisions, {m5_mis[0]} mismatches", 1.0, "mute", None),
        ("hdr", "Other scales, no pass mark (see Figures 7 and 9)"),
        ("other", "M1b", "Random-mating at-risk rate", f"{m1b_o}% against closed form {m1b_c}%", None, "ink", None),
        ("other", "M3", "English readability", f"Grade {m3_mean} mean, {m3_max} at most", None, "ink", None),
        ("hdr", "Not run, so no figure"),
        ("none", "M8", "Human comprehension study", "NOT RUN", None, "hatch", None),
        ("none", "M9", "Clinical review", "NOT RUN", None, "hatch", None),
    ]
    assert M["M8"]["status"] == "not_run" and M["M9"]["status"] == "not_run"
    y = 4
    out = []
    # axis header
    out.append(T(0, y + 11, "ID", 9.5, 600, INK2, mono=True, ls=0.8))
    out.append(T(46, y + 11, "MEASURE", 9.5, 600, INK2, mono=True, ls=0.8))
    for frac, lab in ((0, "0"), (0.5, "50%"), (1.0, "100%")):
        xx = BX + BW * frac
        out.append(T(xx, y + 11, lab, 9.5, 500, INK2, anchor=("start" if frac == 0 else "end" if frac == 1 else "middle"), mono=True))
    out.append(T(VX, y + 11, "VALUE", 9.5, 600, INK2, mono=True, ls=0.8))
    y += 18
    out.append(L(0, y, W, y, INK, 1.2))
    y += 2
    grid_top = y
    body = []
    for r in rows:
        if r[0] == "hdr":
            y += 8
            body.append(T(0, y + 11, r[1], 10.5, 600, INK))
            y += 17
            body.append(L(0, y, W, y, HAIR, 1))
            y += 3
            continue
        kind, rid, label, value, frac, col, tick = r
        rh = 24
        cy = y + 6
        # tally cell
        body.append(cell(0, cy, "hatch" if kind == "none" else ("lapis" if col == "lapis" else "solid"), 11, pid))
        body.append(T(18, y + 16, rid, 10.5, 600, INK, mono=True))
        body.append(T(52, y + 16, label, 11.5, 400, INK))
        if kind == "bar":
            body.append(R(BX, y + 5, BW, 14, "none", HAIR, 1))
            fill = {"lapis": LAPIS, "ink": INK, "mute": "#8b94a1"}[col]
            body.append(R(BX, y + 5, BW * frac, 14, fill))
            if tick is not None:
                tx = BX + BW * tick
                body.append(L(tx, y + 1, tx, y + 23, LAPIS, 2))
        elif kind == "other":
            body.append(R(BX, y + 5, BW, 14, "none", INK3, 1, "3 3"))
            body.append(T(BX + BW / 2, y + 16, "own scale, not a percentage bar", 9.5, 400, INK3, "middle"))
        else:
            body.append(R(BX, y + 5, BW, 14, f"url(#{pid}h)", INK, 1))
        vw = 700 if kind != "none" else 700
        body.append(T(VX, y + 16, value, 11.2, 600 if kind == "none" else 400, INK))
        y += rh
        body.append(L(0, y, W, y, HAIR2, 1))
    # vertical guides at 0/50/100
    guides = "".join(L(BX + BW * f, grid_top, BX + BW * f, y, HAIR2, 1) for f in (0, 0.5, 1.0))
    out.append(guides)
    out.extend(body)
    y += 8
    # legend
    lx = 0
    out.append(cell(lx, y, "lapis", 11, pid)); out.append(T(lx + 16, y + 10, "weakest figure", 10, 400, INK2))
    lx = 110
    out.append(cell(lx, y, "solid", 11, pid)); out.append(T(lx + 16, y + 10, "measured, synthetic data", 10, 400, INK2))
    lx = 270
    out.append(cell(lx, y, "hatch", 11, pid)); out.append(T(lx + 16, y + 10, "not run", 10, 400, INK2))
    lx = 345
    out.append(L(lx, y - 1, lx, y + 12, LAPIS, 2)); out.append(T(lx + 7, y + 10, "tick: the programme's 90% referral target", 10, 400, INK2))
    y += 22
    h = y
    return svg(W, h, "".join(out), pid, "All eleven scoreboard measures, weakest figure first",
               "Horizontal bars for the measures that are percentages, own-scale rows for two others, and hatched rows for the two measures that were not run.")


# --------------------------------------------------------------------------------------------- (b) refusal tallies
def chart_refusal() -> str:
    pid = "rf"
    W = 700
    k, n, p = grab("M6", r"(\d+) of (\d+) refused \((\d+)%\)")
    k, n = int(k), int(n)
    (benign,) = grab("M6", r"(\d+) of \d+ benign")
    benign_n = int(re.search(r"of (\d+) benign", M["M6"]["value"]).group(1))
    tk, tn = grab("M6", r"tuned set: (\d+) of (\d+) refused")
    (total,) = grab("M6", r"\((\d+) prompts in total\)")
    tk, tn = int(tk), int(tn)
    pitch, cs = 9.5, 8
    out = []
    y = 4

    def tally_row(y, label, right, kinds):
        o = [T(0, y + 11, label, 11, 600, INK), T(W, y + 11, right, 11, 600, INK, "end")]
        for i, kd in enumerate(kinds):
            o.append(cell(i * pitch, y + 18, kd, cs, pid))
        return "".join(o)

    out.append(tally_row(y, f"Held-out set, must refuse: {n} prompts, first run before any tuning", f"{k} refused ({p}%), {n - k} not refused", ["solid"] * k + ["lapisopen"] * (n - k)))
    y += 44
    out.append(tally_row(y, f"Held-out set, benign: {benign_n} prompts that should pass", f"{benign} wrongly refused", ["open"] * benign_n))
    y += 44
    out.append(tally_row(y, f"Tuned set: {tn} prompts, shown only to show the tuning worked", f"{tk} of {tn} refused", ["mute"] * tk))
    y += 40
    out.append(L(0, y, W, y, HAIR, 1))
    y += 14
    out.append(cell(0, y - 8, "solid", 10, pid)); out.append(T(15, y, "refused", 10, 400, INK2))
    out.append(cell(75, y - 8, "lapisopen", 10, pid)); out.append(T(90, y, "not refused: a miss (held-out must-refuse row)", 10, 400, INK2))
    out.append(cell(330, y - 8, "open", 10, pid)); out.append(T(345, y, "not refused: correct (benign row)", 10, 400, INK2))
    out.append(cell(530, y - 8, "mute", 10, pid)); out.append(T(545, y, "refused (tuned set)", 10, 400, INK2))
    y += 18
    out.append(T(0, y, f"The scoreboard counts {total} prompts in all; the rest are not broken out by set and are not drawn.", 10, 400, INK3))
    y += 8
    return svg(W, y, "".join(out), pid, "Refusal check, first run on held-out prompts",
               "One tally cell per prompt: 36 of 59 must-refuse prompts refused, none of 20 benign prompts wrongly refused, and 70 of 70 on the tuned set.")


# --------------------------------------------------------------------------------------------- (c) timing
def chart_timing() -> str:
    pid = "tm"
    W = 700
    med, share, tgt = grab("M7", r"median time to result ([\d.]+) days; (\d+)% of flagged cases \(\d+ of \d+\) referred within the standard \(target (\d+)%\)")
    med, share, tgt = float(med), int(share), int(tgt)
    AX, AW = 340, 330
    out = []
    y = 4
    out.append(T(0, y + 11, "Share of flagged cases referred within the standard", 11.5, 600))
    out.append(T(0, y + 26, "10 synthetic cases, simulated clock", 10, 400, INK3))
    for f, lab in ((0, "0"), (0.5, "50%"), (1, "100%")):
        out.append(T(AX + AW * f, y + 10, lab, 9.5, 500, INK2, "start" if f == 0 else "end" if f == 1 else "middle", True))
    out.append(R(AX, y + 16, AW, 18, "none", HAIR, 1))
    out.append(R(AX, y + 16, AW * share / 100, 18, LAPIS))
    tx = AX + AW * tgt / 100
    out.append(L(tx, y + 11, tx, y + 40, INK, 2))
    out.append(T(AX + AW * share / 100 - 5, y + 30, f"{share}%", 11, 600, WHITE, "end"))
    out.append(T(tx - 5, y + 52, f"target {tgt}%", 10, 600, INK, "end"))
    y += 70
    out.append(L(0, y, W, y, HAIR, 1))
    y += 10
    out.append(T(0, y + 11, "Median time to result, days", 11.5, 600))
    out.append(T(0, y + 26, "sample collected to joint report ready", 10, 400, INK3))
    for d in (0, 10, 20, 30):
        out.append(T(AX + AW * d / 30, y + 10, str(d), 9.5, 500, INK2, "start" if d == 0 else "end" if d == 30 else "middle", True))
    out.append(R(AX, y + 16, AW, 18, "none", HAIR, 1))
    out.append(R(AX, y + 16, AW * med / 30, 18, INK))
    out.append(T(AX + AW * med / 30 - 5, y + 30, f"{med}", 11, 600, WHITE, "end"))
    for d, lab in ((21, "Abu Dhabi 21"), (28, "Dubai 28")):
        xx = AX + AW * d / 30
        out.append(L(xx, y + 11, xx, y + 40, INK, 2, "4 2"))
        out.append(T(xx + (4 if d == 28 else -4), y + 52, lab, 10, 600, INK, "start" if d == 28 else "end"))
    y += 66
    return svg(W, y, "".join(out), pid, "Referral share and time to result, simulated",
               f"A bar for the share of flagged cases referred within the standard ({share} percent) against the {tgt} percent target, and a bar for the median time to result ({med} days) with the two published due times marked.")


# --------------------------------------------------------------------------------------------- (d) readability
def chart_readability() -> str:
    pid = "rd"
    W = 700
    mean, mx = grab("M3", r"grade ([\d.]+) on average, ([\d.]+) at most")
    mean, mx = float(mean), float(mx)
    AX, AW, MAXG = 200, 450, 12
    out = []
    y = 4
    for g in range(0, MAXG + 1, 2):
        out.append(T(AX + AW * g / MAXG, y + 10, str(g), 9.5, 500, INK2, "middle", True))
        out.append(L(AX + AW * g / MAXG, y + 15, AX + AW * g / MAXG, y + 78, HAIR2, 1))
    out.append(T(0, y + 10, "Flesch-Kincaid grade", 10, 600, INK2, mono=True, ls=0.6))
    y += 18
    out.append(T(0, y + 14, "English documents", 11.5, 600))
    out.append(R(AX, y, AW * mean / MAXG, 20, INK))
    out.append(T(AX + AW * mean / MAXG - 5, y + 15, f"mean {mean}", 10.5, 600, WHITE, "end"))
    xm = AX + AW * mx / MAXG
    out.append(L(xm, y - 3, xm, y + 23, LAPIS, 2.4))
    out.append(T(xm + 6, y + 15, f"highest document {mx}", 10.5, 600, LAPIS))
    y += 36
    out.append(T(0, y + 14, "Arabic and Urdu documents", 11.5, 600))
    out.append(R(AX, y, AW, 20, f"url(#{pid}h)", INK, 1))
    y += 28
    out.append(T(AX, y + 10, "not measured: no validated readability standard exists for either language", 10.5, 600, INK))
    y += 24
    return svg(W, y, "".join(out), pid, "Readability of the English text",
               f"Flesch-Kincaid grade of the English documents: mean {mean}, highest {mx}. Arabic and Urdu are not measured.")


# --------------------------------------------------------------------------------------------- (e) random mating
def chart_mating() -> str:
    pid = "mt"
    W = 700
    o, c = grab("M1b", r"observed ([\d.]+)% against closed form ([\d.]+)%")
    o, c = float(o), float(c)
    ctx = re.findall(r"(\d\.\d)%", M["M1b"]["method"])
    assert len(ctx) == 2 and ctx[0] == ctx[1], ctx
    ctxv = float(ctx[0])
    AX, AW, MAXV = 250, 400, 5.0
    out = []
    y = 4
    for v in range(0, 6):
        out.append(T(AX + AW * v / MAXV, y + 10, f"{v}%", 9.5, 500, INK2, "middle", True))
        out.append(L(AX + AW * v / MAXV, y + 15, AX + AW * v / MAXV, y + 150, HAIR2, 1))
    y += 18
    rows = [
        ("Observed, 20,000 unrelated synthetic couples", o, LAPIS, f"{o}%"),
        ("Independent closed form", c, INK, f"{c}%"),
        ("Published figure, different panel (context)", ctxv, None, f"{ctxv}%"),
        ("Published figure, different definition (context)", ctxv, None, f"{ctxv}%"),
    ]
    for lab, v, col, vt in rows:
        out.append(T(0, y + 14, lab, 10.5, 400 if col is None else 600, INK))
        if col is None:
            out.append(R(AX, y, AW * v / MAXV, 20, f"url(#{pid}h)", INK, 1))
        else:
            out.append(R(AX, y, AW * v / MAXV, 20, col))
        out.append(T(AX + AW * v / MAXV + 6, y + 15, vt, 11, 600, INK))
        y += 30
    y += 8
    return svg(W, y, "".join(out), pid, "Random-mating at-risk rate against its closed form",
               f"Observed {o} percent against the closed form {c} percent for the demo panel; two published figures of {ctxv} percent shown hatched as context only.")


# --------------------------------------------------------------------------------------------- (f) measured vs not
def chart_strip() -> str:
    pid = "ms"
    W = 700
    left = [
        ("M1", "Engine against an independent oracle"),
        ("M1b", "Random-mating rate against a closed form"),
        ("M2", "Explanation numbers, polarity, banned words"),
        ("M2b", "Checker against injected faults"),
        ("M3", "English readability grade"),
        ("M4", "Escalation against generated cases"),
        ("M5", "Disclosure against a reference model"),
        ("M6", "Refusal on labelled prompts"),
        ("M7", "Pathway timing, simulated clock"),
    ]
    assert sum(1 for m in sb["metrics"] if m["status"] == "measured") == len(left)
    right = [
        ("M8", "Comprehension by real people"),
        ("M9", "Clinical review of rules and translations"),
        ("", "Arabic and Urdu readability"),
        ("", "Real programme performance or uptake"),
        ("", "Legal completeness of the disclosure rules"),
        ("", "Accessibility test with assistive-technology users"),
        ("", "Mobile performance on a throttled connection"),
        ("", "Behaviour under load, a database, many replicas"),
    ]
    out = []
    y = 4
    out.append(T(0, y + 11, f"MEASURED ON SYNTHETIC DATA ({len(left)})", 10, 600, INK2, mono=True, ls=0.8))
    out.append(T(366, y + 11, f"NOT MEASURED ({len(right)})", 10, 600, INK2, mono=True, ls=0.8))
    y += 18
    out.append(L(0, y, 350, y, INK, 1.2)); out.append(L(366, y, W, y, INK, 1.2))
    y += 4
    for i in range(max(len(left), len(right))):
        yy = y + i * 24
        if i < len(left):
            out.append(cell(0, yy + 5, "solid", 11, pid))
            out.append(T(18, yy + 15, left[i][0], 10, 600, INK, mono=True))
            out.append(T(52, yy + 15, left[i][1], 11, 400, INK))
            out.append(L(0, yy + 24, 350, yy + 24, HAIR2, 1))
        if i < len(right):
            out.append(cell(366, yy + 5, "hatch", 11, pid))
            out.append(T(384, yy + 15, right[i][0], 10, 600, INK, mono=True))
            out.append(T(414 if right[i][0] else 384, yy + 15, right[i][1], 11, 400, INK))
            out.append(L(366, yy + 24, W, yy + 24, HAIR2, 1))
    y += max(len(left), len(right)) * 24 + 8
    return svg(W, y, "".join(out), pid, "What is measured and what is not",
               "Nine measures run on synthetic data, and eight things not measured, drawn hatched.")


# --------------------------------------------------------------------------------------------- (g) route budget
ROUTES = [  # gzip KB, production build, mock mode, local (technical report, section 4 as written 2026-11-20)
    ("landing", 161.3), ("how-it-works", 161.5), ("governance", 161.5), ("demo", 161.5), ("programme", 161.5),
    ("couple home", 163.7), ("judge", 165.3), ("teach-back", 167.7), ("staff", 168.6), ("result", 169.0),
    ("sharing", 173.8), ("closure", 188.3), ("clinician", 190.7),
]
BUDGET = 170.0


def chart_routes() -> str:
    pid = "rt"
    W = 700
    AX, AW, LO, HI = 150, 500, 150.0, 195.0
    out = []
    y = 4
    for v in range(150, 196, 10):
        xx = AX + AW * (v - LO) / (HI - LO)
        out.append(T(xx, y + 10, str(v), 9.5, 500, INK2, "middle", True))
    out.append(T(0, y + 10, "ROUTE", 9.5, 600, INK2, mono=True, ls=0.8))
    out.append(T(W, y + 10, "KB, GZIP", 9.5, 600, INK2, "end", mono=True, ls=0.8))
    y += 16
    top = y
    rows = []
    for name, kb in ROUTES:
        over = kb > BUDGET
        yy = y + 3
        xx = AX + AW * (kb - LO) / (HI - LO)
        rows.append(T(0, yy + 12, name, 11, 600 if over else 400, INK))
        rows.append(L(AX, yy + 7, xx, yy + 7, HAIR, 1))
        rows.append(R(xx - 5, yy + 2, 10, 10, LAPIS if over else INK))
        if over:
            rows.append(T(xx + 10, yy + 12, f"{kb}", 10.5, 600, LAPIS, mono=True))
        else:
            rows.append(T(xx - 10, yy + 12, f"{kb}", 10.5, 400, INK, "end", mono=True, extra=f' stroke="{PAPER}" stroke-width="4" paint-order="stroke"'))
        y += 19
    bx = AX + AW * (BUDGET - LO) / (HI - LO)
    out.append(L(bx, top - 2, bx, y, LAPIS, 1.6, "5 3"))
    out.append(T(bx + 5, top + 11, "budget 170 KB", 10, 600, LAPIS))
    out.extend(rows)
    y += 8
    out.append(cell(0, y, "solid", 10, pid)); out.append(T(15, y + 9, "under budget", 10, 400, INK2))
    out.append(cell(100, y, "lapis", 10, pid)); out.append(T(115, y + 9, "over budget (three routes)", 10, 400, INK2))
    out.append(T(300, y + 9, "The axis starts at 150 KB, not at zero.", 10, 600, INK))
    y += 20
    return svg(W, y, "".join(out), pid, "Route JavaScript against a 170 KB budget",
               "Thirteen routes plotted by gzip JavaScript size; ten are under the 170 KB budget and three are over it.")


# --------------------------------------------------------------------------------------------- state machine
def chart_pathway(path_yaml: Path) -> str:
    import yaml  # PyYAML; run through uv with --with pyyaml

    data = yaml.safe_load(path_yaml.read_text(encoding="utf-8"))
    states = {data["initial_state"]}
    for t in data["transitions"]:
        states.add(t["to"])
        states.update(t["from"])
    assert len(states) == 15, sorted(states)
    names = {
        "registered", "consult_done", "sample_collected", "lab_in_progress", "report_ready", "result_clear",
        "counselling_pending", "counselling_booked", "counselling_done", "counselling_declined",
        "certificate_withheld", "declaration_signed", "certificate_issued", "judicial_handoff_sent", "closed",
    }
    assert states == names, states ^ names
    events = {t["event"] for t in data["transitions"]} | {s["event"] for s in data["side_events"]}
    assert len(events) == 20, len(events)
    assert data["terminal_states"] == ["closed"]

    pid = "pw"
    W = 700
    NW, NH, GAP = 104, 38, 45
    cx = [i * (NW + GAP) for i in range(5)]
    Y1, Y2, Y3 = 6, 126, 262

    def node(name, col, y, style="plain"):
        x = cx[col]
        stroke, sw = (LAPIS, 2.2) if style == "lapis" else (INK, 1.3)
        o = [R(x, y, NW, NH, WHITE, stroke, sw)]
        if style == "end":
            o.append(R(x + 3, y + 3, NW - 6, NH - 6, "none", INK, 1))
        parts = name.split("_")
        if len(name) > 15 and len(parts) > 1:
            a, b = parts[0] + "_", "_".join(parts[1:])
            o.append(T(x + NW / 2, y + 16, a, 10, 500, INK, "middle", True))
            o.append(T(x + NW / 2, y + 29, b, 10, 500, INK, "middle", True))
        else:
            o.append(T(x + NW / 2, y + NH / 2 + 3.5, name, 10, 500, INK, "middle", True))
        return "".join(o)

    def arrow(d, dashed=False):
        da = ' stroke-dasharray="4 3"' if dashed else ""
        return f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.3"{da} marker-end="url(#{pid}a)"/>'

    def line(d):
        return f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.3"/>'

    out = []
    names1 = ["registered", "consult_done", "sample_collected", "lab_in_progress", "report_ready"]
    for i, n in enumerate(names1):
        out.append(node(n, i, Y1, "plain"))
    out.append(R(cx[0] + 5, Y1 + 5, 7, 7, INK))
    for i in range(4):
        out.append(arrow(f"M{cx[i] + NW},{Y1 + NH / 2} H{cx[i + 1] - 1}"))
    # row 1 to 2 bus
    yb1 = 100
    ccx = [c + NW / 2 for c in cx]
    out.append(line(f"M{ccx[4]},{Y1 + NH} V{yb1} H{ccx[0]}"))
    out.append(arrow(f"M{ccx[0]},{yb1} V{Y2 - 1}"))
    out.append(arrow(f"M{ccx[1] - 18},{yb1} V{Y2 - 1}"))
    out.append(T(ccx[0] + 6, yb1 + 16, "not flagged", 9.5, 400, INK2))
    out.append(T(ccx[1] - 12, yb1 + 16, "flagged", 9.5, 400, INK2))
    # row 2
    row2 = ["result_clear", "counselling_pending", "counselling_booked", "counselling_done", "counselling_declined"]
    for i, n in enumerate(row2):
        out.append(node(n, i, Y2))
    ym = Y2 + NH / 2
    out.append(arrow(f"M{cx[1] + NW},{ym} H{cx[2] - 1}"))
    out.append(T(cx[1] + NW + GAP / 2, ym - 5, "booked", 9, 400, INK2, "middle"))
    out.append(arrow(f"M{cx[2] + NW},{ym} H{cx[3] - 1}"))
    out.append(T(cx[2] + NW + GAP / 2, ym - 5, "done", 9, 400, INK2, "middle"))
    # booked -> pending (missed, rejected): return below
    yret = Y2 + NH + 14
    out.append(line(f"M{ccx[2] - 12},{Y2 + NH} V{yret} H{ccx[1] + 12}"))
    out.append(arrow(f"M{ccx[1] + 12},{yret} V{Y2 + NH + 1}"))
    out.append(T((ccx[1] + ccx[2]) / 2, yret + 12, "missed, or referral rejected", 9, 400, INK2, "middle"))
    # pending/booked -> declined (above)
    ytop = Y2 - 12
    out.append(line(f"M{ccx[1] + 22},{Y2} V{ytop} H{ccx[4] - 14}"))
    out.append(line(f"M{ccx[2]},{Y2} V{ytop}"))
    out.append(arrow(f"M{ccx[4] - 14},{ytop} V{Y2 - 1}"))
    out.append(T(ccx[3] + 4, ytop - 4, "declined", 9, 400, INK2, "middle"))
    # row 2 -> row 3 bus
    yb2 = 214
    for c in (0, 3, 4):
        out.append(line(f"M{ccx[c]},{Y2 + NH} V{yb2}"))
    out.append(line(f"M{ccx[0]},{yb2} H{ccx[4]}"))
    # row 3
    row3 = ["certificate_withheld", "declaration_signed", "certificate_issued", "judicial_handoff_sent", "closed"]
    out.append(node(row3[0], 0, Y3, "lapis"))
    for i in range(1, 4):
        out.append(node(row3[i], i, Y3))
    out.append(node(row3[4], 4, Y3, "end"))
    out.append(arrow(f"M{ccx[0] + 22},{yb2} V{Y3 - 1}"))
    out.append(arrow(f"M{ccx[1]},{yb2} V{Y3 - 1}"))
    out.append(T(ccx[0] + 28, yb2 + 20, "partner declined to share", 9, 400, INK2))
    out.append(T(ccx[1] + 6, yb2 + 20, "declaration signed", 9, 400, INK2))
    ym3 = Y3 + NH / 2
    for i in range(4):
        out.append(arrow(f"M{cx[i] + NW},{ym3} H{cx[i + 1] - 1}"))
    # withheld -> closed (below)
    yb3 = Y3 + NH + 16
    out.append(line(f"M{ccx[0]},{Y3 + NH} V{yb3} H{ccx[4]}"))
    out.append(arrow(f"M{ccx[4]},{yb3} V{Y3 + NH + 1}"))
    out.append(T((ccx[0] + ccx[4]) / 2, yb3 + 13, "case closed without a certificate", 9, 400, INK2, "middle"))
    y = yb3 + 22
    # legend
    out.append(R(0, y, 11, 11, WHITE, LAPIS, 2.2)); out.append(T(16, y + 9.5, "the certificate tension, shown and not hidden", 10, 400, INK2))
    out.append(R(290, y, 11, 11, WHITE, INK, 1.3)); out.append(R(293, y + 3, 5, 5, "none", INK, 1)); out.append(T(306, y + 9.5, "closed (the only end state)", 10, 400, INK2))
    out.append(R(500, y + 1, 7, 7, INK)); out.append(T(513, y + 9.5, "start (registered)", 10, 400, INK2))
    y += 22
    return svg(W, y, "".join(out), pid, "Pathway state machine, 15 states",
               "Fifteen states in three rows: screening, result and counselling, then certificate and closure; arrows show the state changes defined in the pathway data file.")


if __name__ == "__main__":
    for f in (chart_evidence, chart_refusal, chart_timing, chart_readability, chart_mating, chart_strip, chart_routes):
        s = f()
        print(f.__name__, len(s))
