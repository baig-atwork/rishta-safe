"""The system architecture diagram, redrawn as a layered system with a numbered request path.

    python make_architecture.py     # writes ../../diagrams/01-system-architecture.svg (full, for the report)
                                    #        and ../../diagrams/01b-system-architecture-slide.svg (landscape, for the deck)
    node render_svgs.cjs            # then writes the 2x PNGs

Every component drawn exists in the repository: the web app's screens (frontend/src), the API routers (44 operations), the
composition layer (compose.py, the only code that calls across the packages), the six domain packages (genetics, explain,
governance, haem, journey, evalkit), the versioned data files, the in-memory state and the scoreboard artefact. Outside systems
are simulated and labelled; nothing is drawn as deployed.
"""

from __future__ import annotations

from pathlib import Path

from make_diagrams import GROUND, HAIR, INK, LAPIS, MUTED, OUT, PANEL, WHITE, Svg

SOFT = "#c9d1dc"


def badge(s: Svg, x: float, y: float, n: str) -> None:
    s.add(f'<circle cx="{x}" cy="{y}" r="13" fill="{LAPIS}"/>')
    s.text(x, y + 6, n, 17, 700, WHITE, "middle")


def two_way(s: Svg, x: float, y1: float, y2: float) -> None:
    s.add(
        f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="{INK}" stroke-width="2" '
        f'marker-start="url(#arr)" marker-end="url(#arr)"/>'
    )


def chip(s: Svg, x, y, w, h, label, sub=None, kind="open", size=19, dark=False) -> None:
    fill = PANEL if dark else (WHITE if kind != "hatched" else "url(#hatch)")
    st = PANEL if dark else INK if kind in ("hatched", "dashed") else HAIR
    dash = "6 4" if kind == "dashed" else None
    s.rect(x, y, w, h, fill, st, 1.5, dash)
    if kind == "hatched":
        s.rect(x + 8, y + 7, w - 16, h - 14, WHITE, WHITE, 0)
    fg = WHITE if dark else INK
    if sub:
        s.text(x + 12, y + 24, label, size, 600, fg)
        s.text(x + 12, y + 24 + 22, sub, 17, 400, SOFT if dark else MUTED)
    else:
        s.text(x + 12, y + h / 2 + 7, label, size, 600, fg)


def pkg(s: Svg, x, y, w, h, title, lines, dark=False, tsize=22, lsize=19, step=23) -> None:
    fill, fg, sub, st = (PANEL, WHITE, SOFT, PANEL) if dark else (WHITE, INK, MUTED, HAIR)
    s.rect(x, y, w, h, fill, st, 1.5)
    s.text(x + 14, y + 29, title, tsize, 600, fg)
    for i, ln in enumerate(lines):
        s.text(x + 14, y + 29 + 26 + i * step, ln, lsize, 400, sub)


def legend_row(s: Svg, y: int, items: list[tuple[str, str]], x: int = 16) -> None:
    for kind, label in items:
        s.cell(x, y, kind, 18)
        s.text(x + 28, y + 16, label, 19, 400, MUTED)
        x += 28 + int(len(label) * 9.6) + 40


# ----------------------------------------------------------------------------------------------------------------------
def full() -> str:
    s = Svg(
        1200,
        1046,
        "System architecture of Rishta Safe",
        "Six kinds of people reach a web app; every call goes to one API inside a server trust boundary, then a composition layer, "
        "six domain packages and versioned data. Employers and insurers are refused. No language model runs at run time.",
    )
    # --- people -------------------------------------------------------------------------------------------------------
    roles = [("Couple member", "three languages"), ("Counsellor", "assigned couples"), ("Clinician", "assigned couples"), ("Programme", "aggregates only"), ("Evaluator", "read-only probes")]
    for i, (t, sub) in enumerate(roles):
        chip(s, 16 + i * 186, 16, 170, 64, t, sub)
    chip(s, 946, 16, 238, 64, "Employer or insurer", "no entitlement", "hatched")
    for i in range(5):
        s.line(101 + i * 186, 80, 101 + i * 186, 128, INK, 2, None, True)
    # --- web app ------------------------------------------------------------------------------------------------------
    s.rect(16, 128, 1030, 90, PANEL, PANEL)
    s.text(32, 160, "Web app", 24, 600, WHITE)
    s.text(32, 186, "Next.js 16, TypeScript, right to left", 19, 400, SOFT)
    screens = ["Case bench", "Threshold", "Read together", "Who sees what", "Staff instrument", "Haem aid", "Evidence probes", "Programme"]
    for i, name in enumerate(screens):
        cx, cy = 372 + (i % 4) * 166, 140 + (i // 4) * 38
        s.rect(cx, cy, 156, 32, WHITE, WHITE)
        s.text(cx + 78, cy + 22, name, 17, 500, INK, "middle")
    # employer path: straight to the API, refused
    s.line(1065, 80, 1065, 300, INK, 2.2, "7 4")
    s.text(1054, 238, "refused, HTTP 403", 18, 600, INK, "end")
    # --- trust boundary -----------------------------------------------------------------------------------------------
    s.rect(16, 244, 1168, 658, "none", LAPIS, 2.2, "10 6")
    s.text(32, 886, "SERVER TRUST BOUNDARY", 19, 700, LAPIS, "start", 1.5)
    s.rect(884, 868, 284, 28, WHITE, INK, 1.5)
    s.text(1026, 888, "No runtime language model", 18, 600, INK, "middle")
    # web <-> API
    two_way(s, 553, 218, 300)
    badge(s, 590, 262, "1")
    s.text(612, 268, "request with a role token", 19, 500, INK)
    badge(s, 516, 262, "5")
    s.text(494, 268, "only released text and numbers return", 19, 500, INK, "end")
    # --- API ----------------------------------------------------------------------------------------------------------
    s.rect(32, 300, 1136, 120, WHITE, INK, 1.8)
    s.text(48, 332, "API", 24, 700, INK)
    s.text(106, 332, "FastAPI, 44 operations, errors as problem+json", 20, 400, MUTED)
    badge(s, 56, 362, "2")
    s.text(76, 368, "role check, disclosure policy and correlation id on every call", 19, 500, INK)
    areas = ["Result", "Explain", "Consent", "Audit", "Pathway", "Closure", "Haem aid", "Escalation", "Third party"]
    for i, name in enumerate(areas):
        kind = "hatched" if name == "Third party" else "open"
        x = 46 + i * 124
        if kind == "hatched":
            s.rect(x, 384, 116, 26, "url(#hatch)", INK, 1.5)
            s.rect(x + 6, 389, 104, 16, WHITE, WHITE)
        else:
            s.rect(x, 384, 116, 26, WHITE, HAIR, 1.5)
        s.text(x + 58, 403, name, 16, 600, INK, "middle")
    s.line(1065, 300, 1065, 382, INK, 2.2, "7 4", True)  # drawn after the API box: the refused call lands on the third-party gate
    # --- composition --------------------------------------------------------------------------------------------------
    s.line(600, 420, 600, 436, INK, 2, None, True)
    s.rect(32, 436, 1136, 50, PANEL, PANEL)
    badge(s, 56, 461, "3")
    s.text(80, 468, "Composition layer: the only code that calls across the packages", 21, 600, WHITE)
    # --- packages -----------------------------------------------------------------------------------------------------
    for cx in (207, 600, 993):
        s.line(cx, 486, cx, 508, INK, 2, None, True)
    xs = [32, 425, 818]
    pkg(s, xs[0], 508, 350, 108, "Genetics", ["Mendelian result engine", "three closed categories", "independent oracle"])
    pkg(s, xs[1], 508, 350, 108, "Explain", ["reviewed templates, 3 languages", "glossary, banned-word guard", "deterministic number checker"])
    pkg(s, xs[2], 508, 350, 108, "Governance", ["consent, two disclosure policies", "refusals, 21 escalation triggers", "hash-chained, a row per decision"], dark=True)
    for i in range(5):
        s.rect(982 + i * 26, 524, 16, 16, WHITE, WHITE)
        if i:
            s.line(982 + i * 26 - 10, 532, 982 + i * 26, 532, WHITE, 2)
    badge(s, 1146, 532, "4")
    pkg(s, xs[0], 630, 350, 108, "Haem aid", ["CBC then HPLC, clinician-facing", "24 rules, each with a source", "trace shown as a table"])
    pkg(s, xs[1], 630, 350, 108, "Journey", ["pathway state machine, 15 states", "referral tasks, closure proforma", "teach-back"])
    pkg(s, xs[2], 630, 350, 108, "Evaluation kit", ["scoreboard of 11 measures", "mutation tests on the rules", "seven live probes"])
    # --- data ---------------------------------------------------------------------------------------------------------
    for cx in (207, 600, 993):
        s.line(cx, 738, cx, 764, INK, 2, None, True)
    dx = [32, 416, 800]
    pkg(s, dx[0], 764, 368, 96, "Versioned data files", ["YAML rules, templates, glossary", "content hash = rule-set version"], tsize=21, lsize=19, step=22)
    pkg(s, dx[1], 764, 368, 96, "State in memory", ["one replica, resettable", "ten seeded synthetic cases"], tsize=21, lsize=19, step=22)
    pkg(s, dx[2], 764, 368, 96, "Scoreboard artefact", ["scoreboard.json, 11 measures", "regenerated by a script"], tsize=21, lsize=19, step=22)
    # --- outside systems ----------------------------------------------------------------------------------------------
    s.line(600, 902, 600, 930, INK, 2, "7 4", True)
    s.text(616, 922, "simulated adapters only, no real integration", 18, 500, MUTED)
    s.rect(16, 930, 1168, 66, "none", INK, 1.5, "6 4")
    s.cell(30, 944, "dashed", 22)
    s.text(64, 960, "Outside systems, simulated and labelled: Emirates Health Services, Malaffi, Emirati Genome Programme,", 20, 600, INK)
    s.text(64, 984, "DoH and DHA forms, the national genomic database (a statutory recipient, Federal Decree-Law 49/2023 Art. 26(2)).", 20, 400, MUTED)
    legend_row(s, 1012, [("solid", "built and run in the prototype"), ("dashed", "simulated and labelled"), ("hatched", "refused by law")])
    return s.done()


# ----------------------------------------------------------------------------------------------------------------------
def slide() -> str:
    s = Svg(
        1200,
        516,
        "System architecture of Rishta Safe (slide version)",
        "People reach a web app, then one API and a composition layer inside a server trust boundary, then six domain packages and "
        "versioned data. Employers and insurers are refused. No language model runs at run time.",
    )
    # people column
    chip(s, 16, 70, 160, 50, "Employer or insurer", None, "hatched", 15)
    roles = ["Couple member", "Counsellor", "Clinician", "Programme", "Evaluator"]
    for i, name in enumerate(roles):
        chip(s, 16, 132 + i * 52, 160, 44, name, None, "open", 18)
    for yy in (154, 206, 258, 310, 362):  # every role reaches the web app
        s.line(176, yy, 192, yy, INK, 2)
    s.line(192, 154, 192, 362, INK, 2)
    s.line(192, 258, 214, 258, INK, 2, None, True)
    # web app
    s.rect(216, 70, 164, 340, PANEL, PANEL)
    s.text(230, 100, "Web app", 22, 600, WHITE)
    s.text(230, 124, "Next.js 16", 17, 400, SOFT)
    for i, name in enumerate(["Case bench", "Threshold", "Read together", "Who sees what", "Staff instrument", "Haem aid", "Evidence"]):
        s.rect(228, 142 + i * 38, 140, 31, WHITE, WHITE)
        s.text(298, 142 + i * 38 + 21, name, 17, 500, INK, "middle")
    # boundary
    s.rect(410, 36, 774, 440, "none", LAPIS, 2.2, "10 6")
    s.text(428, 462, "SERVER TRUST BOUNDARY", 17, 700, LAPIS, "start", 1.5)
    s.rect(900, 446, 268, 26, WHITE, INK, 1.5)
    s.text(1034, 465, "No runtime language model", 17, 600, INK, "middle")
    # web <-> api
    s.add(f'<line x1="380" y1="150" x2="428" y2="150" stroke="{INK}" stroke-width="2" marker-start="url(#arr)" marker-end="url(#arr)"/>')
    badge(s, 404, 118, "1")
    badge(s, 404, 184, "5")
    # employer path over the top, refused at the API
    s.add(f'<polyline points="96,70 96,54 523,54 523,70" fill="none" stroke="{INK}" stroke-width="2.2" stroke-dasharray="7 4" marker-end="url(#arr)"/>')
    s.text(300, 46, "refused, HTTP 403", 18, 600, INK, "middle")
    # api + composition
    s.rect(428, 70, 190, 168, WHITE, INK, 1.8)
    s.text(442, 100, "API", 22, 700, INK)
    s.text(442, 124, "FastAPI", 17, 400, MUTED)
    s.text(442, 146, "44 operations", 17, 400, MUTED)
    badge(s, 450, 182, "2")
    s.text(470, 188, "role check,", 17, 500, INK)
    s.text(442, 210, "disclosure policy", 17, 500, INK)
    s.line(523, 238, 523, 256, INK, 2, None, True)
    s.rect(428, 256, 190, 154, PANEL, PANEL)
    badge(s, 450, 284, "3")
    s.text(470, 290, "Composition", 20, 600, WHITE)
    s.text(442, 322, "the only code", 17, 400, SOFT)
    s.text(442, 344, "that calls across", 17, 400, SOFT)
    s.text(442, 366, "the packages", 17, 400, SOFT)
    # to packages
    s.line(618, 262, 634, 262, INK, 2)
    s.line(634, 122, 634, 350, INK, 2)
    for yy in (122, 236, 350):
        s.line(634, yy, 650, yy, INK, 2, None, True)
    pk = [
        ("Genetics", ["result engine", "3 categories"], False),
        ("Explain", ["templates x3", "number checker"], False),
        ("Governance", ["consent, audit", "refusals"], True),
        ("Haem aid", ["CBC then HPLC", "24 rules"], False),
        ("Journey", ["15-state path", "closure forms"], False),
        ("Evaluation", ["11 measures", "mutation tests"], False),
    ]
    for i, (t, ls, dk) in enumerate(pk):
        x = 650 + (i % 2) * 184
        y = 70 + (i // 2) * 114
        pkg(s, x, y, 176, 104, t, ls, dark=dk, tsize=21, lsize=17, step=22)
    badge(s, 804, 199, "4")
    badge(s, 664, 428, "4")
    s.text(684, 434, "audit row for every decision", 17, 500, MUTED)
    # to data
    for yy in (122, 236, 350):
        s.line(1010, yy, 1025, yy, INK, 2)
    s.line(1025, 122, 1025, 350, INK, 2)
    for yy in (122, 236, 350):
        s.line(1025, yy, 1040, yy, INK, 2, None, True)
    dt = [("Data files", ["YAML, hashed"]), ("State", ["in memory"]), ("Scoreboard", ["json artefact"])]
    for i, (t, ls) in enumerate(dt):
        pkg(s, 1040, 70 + i * 114, 132, 104, t, ls, tsize=20, lsize=17, step=22)
    legend_row(s, 486, [("solid", "built and run"), ("dashed", "simulated"), ("hatched", "refused by law")])
    return s.done()


def main() -> None:
    (OUT / "01-system-architecture.svg").write_text(full(), encoding="utf-8")
    (OUT / "01b-system-architecture-slide.svg").write_text(slide(), encoding="utf-8")
    print("wrote", OUT / "01-system-architecture.svg", "and 01b-system-architecture-slide.svg")


if __name__ == "__main__":
    main()
