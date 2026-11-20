# Deck QA (2026-11-20)

Files: `rishta-safe-deck.pptx` and `rishta-safe-deck.pdf` (23 pages, 1.56 MB, real text layer on pages 1 to 22; page 23 is the organisers' closing picture). Built by `../tools/render_deck.sh` from `deck-content.md` and the organisers' template. `check_deck.py` passes: size under 5 MB, every template heading present as text, every page has a text layer, and none of these appear in the text: the retired product name, an em or en dash, a hosting claim, "clinically reviewed" or "validated", "incompatible".

## 1. Every number in the deck, with its source

Scoreboard rows are in the backend scoreboard file (`data/scoreboard.json`) (generated 2026-11-20, code version 7dca266; each value was checked against the file by a script). "TR" is `../technical-report.md`.

| Figure in the deck | Slides | Source |
|---|---|---|
| 36 of 59 refused, 61%; 0 of 20 benign refused (held-out, first run) | 2, 10, 11, 14 | scoreboard M6 |
| 20,000 of 20,000 agree | 10, 11 | M1 |
| 768 documents, numbers, polarity, banned words 100% | 10, 11 | M2 |
| 5,760 of 5,760 faults caught | 10, 11 | M2b |
| Flesch-Kincaid 5.3 mean, 6.5 at most | 10 | M3 |
| Recall 400 of 400; precision 96% with hard negatives | 9, 10, 11 | M4 |
| 30,527 decisions, 0 mismatches, 10 of 10 broken rule sets caught | 9, 10, 11 | M5 |
| 4 of 7 flagged cases (57%), target 90%; median 11.1 days to result | 9, 10, 11 | M7 |
| 2.28% against closed form 2.33% | 10 | M1b |
| M8 and M9 not run; eleven measures, nine measured | 10, 11, 22 | scoreboard status fields |
| At n=30 an 80% score has a 95% interval of 61 to 92% | 9 | M8 method text |
| 516 backend tests, 417 frontend unit tests, 62 end-to-end tests | 4 | TR section 12 (counts made by command on 2026-11-20) |
| 44 API operations | 5 | TR section 12 |
| 21 escalation triggers in two tiers | 14 | TR sections 7 and 12 |
| 15 pathway states | 5 | TR sections 3 and 12 |
| Ten synthetic cases; five role lenses | 2, 16 | TR section 12; `judging-map.md` section 3 |
| Four threshold options, none preselected | 6, 17 | TR section 4; ADR 0170 |
| Backend: 8 direct runtime dependencies, 26 packages with transitive ones | 20 | TR section 12; row count of the backend table in `THIRD_PARTY_NOTICES.md` |
| Federal Decree-Law 49/2023 Art. 9, 15, 19 to 21, 26(2) | 8, 12, 17 | TR sections 5 and 6; ADR 0121 to 0123 |
| NHS England handbook 5th edition, October 2024; SITE 2022 J Clin Med 11(18):5426; DoH Abu Dhabi V3 September 2024; DHA Dubai V1 effective 27 March 2026 | 12, 13, 20 | `THIRD_PARTY_NOTICES.md`; TR section 3 |

No price, no duration, no revenue figure, no count of other entries or tools appears anywhere.

## 2. Owner-to-fill placeholders (search the PDF for "[")

- Page 1: the team name is "Rishta Safe"; change it if the registered team name differs.
- Page 3 (team members): `[ADD ENTRANT NAME BEFORE UPLOAD]`, and country, organisation and age confirmation, each `[OWNER TO FILL]`. No person is named anywhere in the deck.
- Page 4 (team capability): `[OWNER TO CONFIRM: add the engineering contributor's role if the form allows.]`
- Page 16 (login): demo link, video link and repository link, each `[OWNER TO FILL]`.
- Page 20 (pre-existing IP): `[OWNER TO CONFIRM: the copyright holder]`.
- Page 21 (conflict of interest): the whole declaration. No document in the repository supports "None declared", so the owner must decide.

## 3. Calls that differ from the brief or the outline

- The outline's "Design target: Azure UAE North" is not in the deck (hosting claim; ADR 0220).
- The organisers' heading text is kept on every template slide (the previous entry's shortened headings failed the heading check). The Additional Slide heading is prefixed "Additional Slide:".
- The data-flow diagram puts the threshold before the disclosure filter, because the code does (the result text is not fetched before a choice, ADR 0170). The engine and the checker write no audit row; the disclosure decision does (`compose.result_view`).
- Seven extra slides continue template slides (pages 2, 6, 8, 11, 12, 17, 19); every template slide is kept, in order, and the closing picture stays last. Page 2 is a criteria table; page 22 (the template's Additional Slide) is the not-claimed ledger.
- The deck contains neither a hosting claim nor the phrase "nothing is deployed", so it stays true if the owner hosts the demo before upload.

## 4. Visual check

All 23 pages were rendered to PNG and looked at after the build. Defects found and fixed: a clipped last line on page 1; two overflows (pages 7 and 18) shortened; diagram overlaps (legend and chip rows) fixed and re-rendered; a diagram arrow crossing text fixed. After the final build pages 1, 7, 10, 16, 17 and 21 were looked at again. No page is empty, none shows the retired name, and the diagram labels are 11 pt or larger on the slide. Screenshots (1440 by 900, English, taken from the local stack) are cropped for legibility; their small text is illustrative only, and every claim they show is also in the text layer. Not checked: how PowerPoint (rather than LibreOffice) wraps the tables.

Side effect: the screenshot run sent one employer probe on case 2 (one audit row) and opened result pages (disclose rows). Reset the demo before recording.
