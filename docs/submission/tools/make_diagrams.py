"""Generate the five submission diagrams as SVG (source) into docs/diagrams.

    python make_diagrams.py            # writes ../../diagrams/*.svg ; render_svgs.cjs then writes the 2x PNGs

House style is the product's own "Registry Grid": ink panels, a cool white ground, one lapis accent, hairlines instead of
shadows, square corners and a tally-cell motif (solid, hatched, open, dashed). Every canvas is 1200 units wide and every
label is at least 20 units, so that a diagram shown at the width of a 960 px slide keeps its labels at 11 pt or more.
Every claim drawn here is taken from the code or the docs named in the comment above each diagram.
"""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).resolve().parents[2] / "diagrams"
INK, PANEL, GROUND = "#0f1217", "#151a22", "#f8f9fb"
LAPIS, HAIR, MUTED, WHITE = "#1a51bd", "#b9c0cb", "#4a5361", "#ffffff"
FONT = "Outfit, Archivo, Arial, sans-serif"


class Svg:
    def __init__(self, w: int, h: int, title: str, desc: str) -> None:
        self.w, self.h, self.title, self.desc = w, h, title, desc
        self.parts: list[str] = []

    def add(self, s: str) -> None:
        self.parts.append(s)

    def rect(self, x, y, w, h, fill="none", stroke=HAIR, sw=1.5, dash=None, r=0) -> None:
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=20, weight=400, fill=INK, anchor="start", spacing=0) -> None:
        sp = f' letter-spacing="{spacing}"' if spacing else ""
        self.add(f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{sp}>{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, stroke=INK, sw=1.5, dash=None, arrow=False) -> None:
        d = f' stroke-dasharray="{dash}"' if dash else ""
        m = ' marker-end="url(#arr)"' if arrow else ""
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}{m}/>')

    def poly(self, pts, stroke=INK, sw=1.8) -> None:
        d = " ".join(f"{x},{y}" for x, y in pts)
        self.add(f'<polyline points="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}" marker-end="url(#arr)"/>')

    def cell(self, x, y, kind, size=22, ink=INK) -> None:
        """The tally cell: solid, hatched, open or dashed."""
        if kind == "solid":
            self.add(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{ink}" stroke="{ink}" stroke-width="1.5"/>')
        elif kind == "hatched":
            self.add(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="url(#hatch)" stroke="{ink}" stroke-width="1.5"/>')
        elif kind == "open":
            self.add(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{WHITE}" stroke="{ink}" stroke-width="1.5"/>')
        else:
            self.add(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="none" stroke="{ink}" stroke-width="1.5" stroke-dasharray="4 3"/>')

    def box(self, x, y, w, h, title, lines, dark=False, dash=None, mark=None, tsize=22) -> None:
        fill, fg, st = (PANEL, WHITE, PANEL) if dark else (WHITE, INK, HAIR)
        sub = "#c9d1dc" if dark else MUTED
        self.rect(x, y, w, h, fill, st, 1.5, dash)
        ox = 14
        if mark:
            self.cell(x + 12, y + 10, mark, 18, "#ffffff" if dark else INK)
            ox = 40
        self.text(x + ox, y + 27, title, tsize, 600, fg)
        for i, ln in enumerate(lines):
            self.text(x + 14, y + 52 + i * 23, ln, 20, 400, sub)

    def done(self) -> str:
        head = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" role="img" aria-labelledby="t d">'
            f'<title id="t">{escape(self.title)}</title><desc id="d">{escape(self.desc)}</desc>'
            f'<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            f'<rect width="7" height="7" fill="{WHITE}"/><line x1="0" y1="0" x2="0" y2="7" stroke="{INK}" stroke-width="2.6"/></pattern>'
            f'<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>'
            f'<rect width="{self.w}" height="{self.h}" fill="{GROUND}"/>'
        )
        return head + "".join(self.parts) + "</svg>\n"


def legend(s: Svg, y: int, items: list[tuple[str, str]], x: int = 16) -> None:
    for kind, label in items:
        s.cell(x, y, kind, 18)
        s.text(x + 28, y + 16, label, 20, 400, MUTED)
        x += 28 + int(len(label) * 10.2) + 36


# ------------------------------------------------------------------------------------------------------------------
# 1. System architecture. Components exist in the backend source folder (genetics, explain, governance, journey, haem, evalkit,
#    demo, api, compose.py) and frontend/src (case bench, threshold, read together, who sees what, evidence, staff).
def architecture() -> str:
    s = Svg(1200, 446, "System architecture", "Web app, API, composition layer, seven domain packages, data files, one server trust boundary, no runtime language model.")
    # web app
    s.rect(16, 52, 226, 330, PANEL, PANEL)
    s.text(30, 82, "Web app", 22, 600, WHITE)
    s.text(30, 108, "English, Arabic, Urdu", 20, 400, "#c9d1dc")
    for i, name in enumerate(["Case bench", "Threshold", "Read together", "Who sees what", "Evidence probes", "Staff instrument"]):
        yy = 134 + i * 36
        s.cell(30, yy, "solid", 18, WHITE)
        s.text(60, yy + 16, name, 20, 400, WHITE)
    s.text(30, 362, "one API adapter", 20, 400, "#c9d1dc")
    s.line(242, 95, 290, 95, INK, 1.8, arrow=True)
    # trust boundary
    s.rect(262, 10, 928, 384, "none", LAPIS, 2, "9 6")
    s.text(290, 40, "SERVER TRUST BOUNDARY", 20, 600, LAPIS, spacing=1.2)
    s.rect(900, 16, 280, 34, WHITE, INK, 1.5)
    s.text(1040, 40, "No runtime language model", 20, 600, INK, "middle")
    # api column
    s.box(290, 62, 270, 86, "API", ["FastAPI, 44 operations", "roles checked each call"], mark="solid")
    s.box(290, 158, 270, 90, "Composition layer", ["only code that calls", "across the packages"], dark=True, mark="solid")
    s.box(290, 258, 270, 84, "Outside systems", ["simulated and labelled"], dash="5 4", mark="dashed")
    s.line(425, 148, 425, 158, INK, 1.8, arrow=True)
    s.line(560, 203, 600, 203, INK, 1.8, arrow=True)
    # domain packages
    cols = [600, 898]
    pk = [
        ("Result engine", ["three closed categories", "independent oracle"]),
        ("Explainer", ["reviewed templates,", "deterministic checker"]),
        ("Governance", ["consent, audit hash chain", "refusals, escalation"]),
        ("Pathway", ["15 states, referral tasks", "closure proforma"]),
        ("Haemoglobin aid", ["clinician-facing rules,", "trace shown as a table"]),
        ("Evaluation kit", ["scoreboard M1 to M9,", "mutation tests, probes"]),
    ]
    for i, (t, ls) in enumerate(pk):
        s.box(cols[i % 2], 62 + (i // 2) * 96, 282, 86, t, ls, mark="solid")
    # data band
    s.rect(290, 350, 892, 34, WHITE, HAIR)
    s.cell(300, 358, "solid", 18)
    s.text(328, 374, "Data files: templates, glossary, rules, pathway, panels, policies, scoreboard.json", 20, 400, INK)
    legend(s, 414, [("solid", "built and run in the prototype"), ("dashed", "simulated and labelled")])
    return s.done()


# ------------------------------------------------------------------------------------------------------------------
# 2. Data flow of one result. compose.result_view: compute (genetics, no audit row) -> governance.disclose (writes the
#    "disclose" audit row) -> explain.render (checker, no audit row). The threshold is in the browser: ADR 0170 (the result
#    text is not fetched before a choice; only "prefer not to know" is written to the server as rntk_declared).
def dataflow() -> str:
    s = Svg(1200, 440, "Data flow of one result", "A reported result goes to the rules engine, one of three closed categories, the threshold, the disclosure filter, the explainer and checker, then read together, with the audit row each step writes.")
    bw, bh = 330, 118
    xs = [10, 420, 830]
    rows = [14, 214]
    steps = [
        ("1  Reported result", ["a lab result a licensed", "programme already reported", "(synthetic here)"], "No audit row: input only"),
        ("2  Rules engine", ["fixed rules, no model;", "one of three closed", "categories (not a scale)"], "No audit row: computing only"),
        ("3  Threshold", ["four options, none preselected;", "no result text is fetched", "before a choice"], "Prefer not to know: 1 row"),
        ("4  Disclosure filter", ["each person sees only what", "they chose to share;", "counselling-first rule"], "Disclose row per request"),
        ("5  Explainer and checker", ["reviewed templates; checker", "re-derives every number;", "refuses on a mismatch"], "No audit row of its own"),
        ("6  Read together", ["the same text in two", "languages side by side", "(Arabic, Urdu: drafts)"], "Disclose row per fetch"),
    ]
    order = [(0, 0), (0, 1), (0, 2), (1, 2), (1, 1), (1, 0)]  # snake: row 1 left to right, row 2 right to left
    for i, (t, ls, audit) in enumerate(steps):
        r, c = order[i]
        x, y = xs[c], rows[r]
        s.box(x, y, bw, bh, t, ls, dark=(i == 3), tsize=22)
        none = audit.startswith("No")
        s.rect(x, y + bh + 6, bw, 40, WHITE, LAPIS, 1.5, "5 4" if none else None)
        s.cell(x + 10, y + bh + 17, "open" if none else "solid", 18, LAPIS)
        s.text(x + 38, y + bh + 33, audit, 20, 400, INK)
    s.line(340, 73, 420, 73, INK, 1.8, arrow=True)
    s.line(750, 73, 830, 73, INK, 1.8, arrow=True)
    s.poly([(1160, 73), (1180, 73), (1180, 273), (1160, 273)])  # threshold -> disclosure filter, outside the strips
    s.line(830, 273, 750, 273, INK, 1.8, arrow=True)
    s.line(420, 273, 340, 273, INK, 1.8, arrow=True)
    cy = 394
    s.text(10, cy + 20, "Closed vocabulary:", 20, 600, INK)
    x = 190
    for lab in ["shared_result_found", "no_shared_change_found", "more_information_needed"]:
        w = int(len(lab) * 10.6) + 24
        s.rect(x, cy, w, 30, WHITE, INK, 1.5)
        s.text(x + 12, cy + 21, lab, 20, 400, INK)
        x += w + 14
    return s.done()


# ------------------------------------------------------------------------------------------------------------------
# 3. Who sees what. backend governance (ADR 0122 to 0125, 0172), technical report section 6; refusal text in
#    governance/third_party.py (Art. 19 to 21, HTTP 403, logged); Art. 26(2) statutory recipient.
def whosees() -> str:
    s = Svg(1200, 458, "Who sees what", "Couple member, partner, care team, programme operator, national genomic database, employer or insurer (refused), and the audit ledger that records every decision.")
    s.text(20, 28, "WHO", 20, 600, MUTED, spacing=1.2)
    s.text(390, 28, "WHAT THEY SEE", 20, 600, MUTED, spacing=1.2)
    rows = [
        ("You, the couple member", "solid", ["Your own result, unless you", "chose not to know"]),
        ("Your partner", "dashed", ["Only what you share: result only,", "gene names or detail; none by default"]),
        ("Counsellor or clinician", "solid", ["Assigned couples only; every", "access is written to the audit log"]),
        ("Programme operator", "open", ["Aggregates only,", "no couple result"]),
        ("National genomic database", "hatched", ["Receives it by law, Art. 26(2);", "we do not hide it from the state"]),
        ("Employer or insurer", "open", ["REFUSED: HTTP 403, Art. 19 to 21,", "refusal logged"]),
    ]
    y0, rh = 40, 58
    for i, (who, kind, ls) in enumerate(rows):
        y = y0 + i * (rh + 6)
        refused = who.startswith("Employer")
        s.rect(10, y, 800, rh, PANEL if refused else WHITE, PANEL if refused else HAIR, 1.5)
        fg = WHITE if refused else INK
        s.cell(24, y + 18, kind, 22, WHITE if refused else INK)
        s.text(62, y + 36, who, 22, 600, fg)
        for k, ln in enumerate(ls):
            s.text(390, y + 25 + k * 24, ln, 20, 400, "#c9d1dc" if refused else MUTED)
    # ledger
    s.rect(836, 40, 354, 6 * (rh + 6) - 6, PANEL, PANEL)
    s.text(856, 74, "Audit ledger", 24, 600, WHITE)
    for k, ln in enumerate(["Every disclosure decision,", "consent change, refusal", "and escalation, with", "pseudonymous ids"]):
        s.text(856, 106 + k * 24, ln, 20, 400, "#c9d1dc")
    # hash chain of cells
    cx = 856
    for k in range(5):
        s.cell(cx, 232, "solid", 30, WHITE)
        if k < 4:
            s.line(cx + 30, 247, cx + 62, 247, WHITE, 1.8)
        cx += 62
    s.text(856, 300, "each row holds the SHA-256 of", 20, 400, "#c9d1dc")
    s.text(856, 324, "its content and the row before", 20, 400, "#c9d1dc")
    s.text(856, 356, "Limit: no external anchor yet", 20, 600, WHITE)
    # connector from rows to ledger
    s.line(810, 69, 836, 69, INK, 1.5)
    legend(s, 428, [("solid", "sees it"), ("dashed", "only if you share"), ("hatched", "receives it by law"), ("open", "no couple result")], x=10)
    return s.done()


# ------------------------------------------------------------------------------------------------------------------
# 4. Evidence map. Values copied from the backend scoreboard file (ADR 0221). M6 first, as the Evidence page does.
def evidence() -> str:
    s = Svg(1200, 466, "Evidence map", "The eleven scoreboard measures as tally cells, weakest figure first; two are not run and are hatched.")
    cols = {"id": 56, "m": 128, "v": 540, "l": 870}
    for k, lab in (("id", "ID"), ("m", "MEASURE"), ("v", "VALUE"), ("l", "DOES NOT SHOW")):
        s.text(cols[k], 24, lab, 20, 600, MUTED, spacing=1.2)
    rows = [
        ("M6", "Refusal, held-out first run", "36 of 59 refused (61%)", "Keywords, not meaning", "solid", "first"),
        ("M7", "Referral within the standard", "4 of 7 flagged cases (57%)", "Simulated pathway", "solid", ""),
        ("M1", "Engine against oracle", "20,000 of 20,000 agree", "Same team wrote both", "solid", "gate"),
        ("M2", "Explanations, 3 languages", "768 documents: numbers 100%", "Clarity; Arabic and Urdu", "solid", "gate"),
        ("M2b", "Checker on injected faults", "5,760 of 5,760 caught", "Only the listed faults", "solid", "gate"),
        ("M4", "Escalation recall", "400 of 400 cases", "Cases from the same rules", "solid", "gate"),
        ("M5", "Disclosure vs reference model", "30,527 decisions, 0 mismatches", "Legal completeness", "solid", "gate"),
        ("M1b", "Random-mating at-risk rate", "2.28% against closed form 2.33%", "Not a validation", "solid", ""),
        ("M3", "English readability", "Grade 5.3 mean, 6.5 at most", "Understanding", "solid", ""),
        ("M8", "Human comprehension study", "NOT RUN", "Any comprehension claim", "hatched", ""),
        ("M9", "Clinical review", "NOT RUN", "Any clinical validity", "hatched", ""),
    ]
    y0, rh = 34, 32
    for i, (mid, meas, val, lim, kind, tag) in enumerate(rows):
        y = y0 + i * (rh + 2)
        s.rect(10, y, 1180, rh, WHITE, LAPIS if tag == "first" else HAIR, 2.2 if tag == "first" else 1.2)
        s.cell(20, y + 6, kind, 20)
        s.text(cols["id"], y + 23, mid, 20, 600, INK)
        s.text(cols["m"], y + 23, meas, 20, 400, INK)
        s.text(cols["v"], y + 23, val, 20, 600 if kind == "hatched" else 400, INK)
        s.text(cols["l"], y + 23, lim, 20, 400, MUTED)
    ytag = y0 + 11 * (rh + 2) + 4
    s.cell(10, ytag, "solid", 18)
    s.text(38, ytag + 16, "measured", 20, 400, MUTED)
    s.cell(150, ytag, "hatched", 18)
    s.text(178, ytag + 16, "not run", 20, 400, MUTED)
    s.rect(272, ytag - 2, 36, 22, "none", LAPIS, 2.2)
    s.text(316, ytag + 16, "weakest figure, shown first", 20, 400, MUTED)
    s.text(10, ytag + 46, "M1, M2, M2b, M4 and M5 at 100% are a regression gate, not safety evidence: the same team wrote both sides.", 20, 600, INK)
    return s.done()


# ------------------------------------------------------------------------------------------------------------------
# 5. One-pathway pilot path. docs/submission/commercial-and-pilot.md: gates, shadow pilot, measures, stop rule. No price,
#    no duration (set with the facility).
def pilot() -> str:
    s = Svg(1200, 466, "One-pathway pilot path", "Five gates, none yet done, then a shadow pilot beside a licensed facility in which no result reaches a couple through Rishta Safe.")
    xs = [100, 300, 500, 700, 900, 1100]
    s.line(40, 220, 1180, 220, INK, 2)
    s.line(1160, 220, 1190, 220, INK, 2, arrow=True)
    labels = [
        ("1  Ethics determination", ["the ethics committee", "decides the review", "level"]),
        ("2  Clinical lead sign-off", ["rules, detection rates,", "banned words, triggers,", "proforma"]),
        ("3  Native clinical review", ["every Arabic and", "Urdu string"]),
        ("4  Legal reads", ["open readings of", "Federal Decree-Law", "49/2023"]),
        ("5  Privacy and risk", ["independent privacy audit;", "the facility's AI risk", "assessment"]),
        ("6  Shadow pilot", ["beside a licensed", "facility; staff compare;", "no result reaches a couple"]),
    ]
    for i, (x, (t, ls)) in enumerate(zip(xs, labels)):
        kind = "hatched" if i == 5 else "dashed"
        s.cell(x - 18, 202, kind, 36)
        above = i % 2 == 0
        top = 28 if above else 252
        w = 330
        lx = min(max(x - w // 2, 8), 1200 - w - 8)
        anchor = "middle" if (lx == x - w // 2) else ("start" if lx == 8 else "end")
        tx = x if anchor == "middle" else (8 if anchor == "start" else 1192)
        s.text(tx, top + 22, t, 22, 600, INK, anchor)
        for k, ln in enumerate(ls):
            s.text(tx, top + 50 + k * 24, ln, 20, 400, MUTED, anchor)
        if above:
            s.line(x, top + 50 + len(ls) * 24 - 8, x, 202, HAIR, 1.2)
        else:
            s.line(x, 238, x, top - 6, HAIR, 1.2)
    # bottom notes
    s.rect(10, 372, 1180, 86, WHITE, HAIR, 1.2)
    s.text(24, 398, "Measures: time to counsellor brief, referral within the 90% target, teach-back with intervals, escalation recall.", 20, 400, INK)
    s.text(24, 424, "Never a measure: cancelled marriages. Stop rule: a number that differs from the engine, or a banned word, stops it.", 20, 400, INK)
    s.text(24, 449, "Durations are set with the facility; none is stated here.", 20, 600, MUTED)
    return s.done()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (
        ("01-system-architecture", architecture),
        ("02-data-flow-one-result", dataflow),
        ("03-who-sees-what", whosees),
        ("04-evidence-map", evidence),
        ("05-pilot-path", pilot),
    ):
        (OUT / f"{name}.svg").write_text(fn(), encoding="utf-8")
        print("wrote", name)


if __name__ == "__main__":
    main()
