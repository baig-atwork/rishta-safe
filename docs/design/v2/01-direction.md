# 01. Visual direction: "Registry Grid" (committed 2026-11-20)

Status: committed direction for the v2 rebuild. It supersedes `docs/design/DESIGN.md` ("Lineage Folio"). Keep the old file for history and do not delete it. The prototypes in `prototype/` are the approved comps. The renders are in `prototype/shots/` and the side-by-side with the rivals is `prototype/shots/contact-sheet-vs-rivals.png`.

## 1. Domain codes

- **Honour.** Plain statements, visible status, one clear next action, and Arabic as a first-class reading language. The UAE Design System sets Noto Kufi Arabic as its Arabic body face (designsystem.gov.ae/guidelines/typography, opened 2026-11-20). Rishta Safe honours the civic register of the UAE, not the consumer-health register.
- **Break.** The challenge's own visual code. All four rivals are light, warm or pastel and friendly-consumer: cream (Two Keys), pale grey-green with star tiles (KinSight), lavender glass with phone frames (Silah) and peach-orange with a helix (GeneBridge). Rishta Safe is **cool, ink-and-mineral, instrument-like**. It uses no ornament, motif, phone frame, mascot or helix.

## 2. Three behavioural adjectives

These describe how the interface behaves, not how it should look.
1. **Asks before it shows.** No result appears until the person has chosen how to meet it, and the choice can be undone.
2. **Shows its working.** Every number, refusal and staff line carries its source: the endpoint, the rule id, the article of law, or "does not show".
3. **Answers in both tongues at once.** Each partner's language appears side by side, not behind a toggle.

## 3. Movement

**Swiss registry instrument.** This is the International Typographic Style applied to a civil register and a measuring instrument: a strict grid, hairline rules, one grotesque in several widths, a monospace for identifiers and figures, flat surfaces, and colour reserved for meaning. The lineage is Otl Aicher's public-information systems and the crisp set in the ch7 corpus (Palantir, Observable, Climate TRACE). It is not editorial and not a clinic letter, which is a deliberate change from "Lineage Folio".

## 4. Signature element: the tally grid

A crisp grid of **square cells** with exactly three fills: **solid**, **diagonal hatch** and **open**, plus a dashed edge for "pending or not yet". It is true to the product because Rishta Safe's real data primitives are cells:

| Where it appears | What a cell means | Data source |
|---|---|---|
| Result tally (10x10) | one pregnancy in 100: solid = would have the condition, hatch = carrier, open = neither | `document.blocks[kind=icon_array]` |
| Category chip | two cells = two partners: hatched pair (shared), open pair (none), one dashed (more information) | `disclosed.category` |
| Visibility matrix | one layer x one recipient: solid = sees, hatch = receives by law, open = never, dashed = only if you agree | consents + policy |
| Threshold options | the four ways to meet the result use the same four fills | RNTK endpoints |
| Evidence | one measure: plain cell = measured, hatched cell = NOT RUN | `/v1/eval/scoreboard` |
| Case bench | one case x one lens: solid = enter, hatch = staff view, open = not permitted | `/v1/demo/cases`, personas |
| Audit tape, honesty rail | one event / one honesty fact | `/v1/couples/{id}/audit` |
| Wordmark | three cells: solid, hatch, open | brand |

Why no rival has this: Two Keys uses an Al Sadu woven band of **diamonds** with a red diamond, KinSight uses 3D **star tiles** and **spheres**, Silah uses woven **diamonds** and a diamond stepper, and GeneBridge uses a **helix** and capsules. None uses square cells, and none uses hatching as an information channel. Hatching also gives every state a second channel without colour, which the hard rule requires.

**Override of the owner's earlier icon-array choice.** The 100-circle array with half-filled carriers is retired. Half-marks echo Two Keys' half diamonds, and circles echo KinSight's spheres (rival map, §3 item 3).

## 5. Tokens per axis

These are summarised here. The full set is in `tokens.css` and the YAML of `DESIGN.md`.

- **Colour.**
  - Mineral white ground `oklch(0.982 0.003 250)` (#f8f9fb), raised surface `oklch(0.997 0.001 250)`, ink `oklch(0.18 0.014 262)` (#0e1218).
  - One accent: **lapis** `oklch(0.47 0.18 262)` (#1a51bd), used only for actions, links, focus and the user's own controls. Keep it to 3% or less of pixels.
  - The dark hero and evidence console use ink `oklch(0.18 0.014 262)` with lapis-300 `oklch(0.74 0.12 262)` for actions.
  - Categories, each always paired with its cell glyph and label: aubergine (hue 345), graphite (hue 240, low chroma) and olive-ochre (hue 95). They have equal lightness by design. None is red or green.
- **Type.** Archivo, a variable grotesque with a width axis of 62-125, is the only Latin family:
  - display at `wdth 112`, weight 560, tracking -0.025em;
  - interface at `wdth 100`;
  - dense staff tables at `wdth 88`.

  The other families:
  - Red Hat Mono for ids, hashes, figures, endpoints and labels.
  - Noto Kufi Arabic for Arabic interface text and headings. It matches the UAE government system, and Kufi's geometry is kin to the grid.
  - Noto Naskh Arabic for Arabic reading prose.
  - Noto Nastaliq Urdu for Urdu reading prose, with Naskh for the Urdu interface.

  All are OFL and on Google Fonts. The woff2 files are in `prototype/fonts/` for implementers to copy to `frontend/public/fonts/`. Sizes: 11, 12, 14, 16, 20, 28 and a 40-56 display (landing only).
- **Shape.** Radius 0 for cells, tables and charts; 2 for stamps and chips; 4 for buttons and inputs; 6 for panels, which is the maximum.
- **Depth.** Hairlines (`--line`), with one dialog shadow. No blur, glow or gradient. The only "gradient" is the hatch pattern, which is a data channel.
- **Density.** Couple screens are calm, with one focal object per view. Staff screens run at 36 px table rows, `wdth 88` and three panes.
- **Motion.** CSS only, in 100, 180 and 320 ms steps. A switch writes its audit row with a 180 ms background settle. The probe console reveals the response, then the audit row 120 ms later. The tally is static (see the icon-array literature cited in the old DESIGN.md). Everything is removed under `prefers-reduced-motion`.

## 6. Clone-distance gate against the four rivals (measured)

Rival grounds and accents were measured from the 1440 fold screenshots: the mode colour of the page and the top saturated bins, converted to OKLCH (`D:\dev\_research\ch03-ui\scripts\color.py`). ΔE is the OKLab distance. 0.02 is roughly a just-noticeable difference and 0.10 is clearly different.

| Axis | Two Keys | KinSight | Silah | GeneBridge | Rishta Safe v2 | Distinct? |
|---|---|---|---|---|---|---|
| Ground | cream #f1eee8, oklch(0.95 0.009 85) | grey-green / cream tiles #e6dfc8 (0.90 0.032 93) | lavender-grey #eceef5 (0.95 0.010 273) | peach #fff7f0 (0.98 0.013 64) | dark ink hero (0.18 0.014 262) then mineral #f8f9fb (0.98 0.003 250) | yes: the only dark fold and the only neutral-cool ground |
| Accent | navy (0.32 0.088 268) + crimson (0.47 0.17 20) | teal (0.45 0.071 195) | navy (0.32 0.088 268) + amber (0.72 0.074 77) | orange (0.65 0.206 38) | lapis (0.47 0.18 262) | min ΔE 0.16 (to the rival navies); vs teal 0.19; vs crimson 0.33 |
| Saturated pixels, fold | 0.2% | 0.5% | 0.7% | 2.2% | about 1-3% (lapis CTA + category chip) | similar restraint |
| Latin face | Alexandria-like heavy geometric | Bricolage Grotesque + Plus Jakarta Sans | IBM Plex Sans | serif display + Plus Jakarta | Archivo (width axis) + Red Hat Mono | yes |
| Arabic face | Alexandria | n/a seen | n/a seen | Alexandria headings | Noto Kufi + Naskh, Nastaliq for Urdu | yes; only Rishta Safe shows Urdu Nastaliq |
| Motif | pedigree + Al Sadu diamond band | 3D star tiles, spheres | woven diamonds, phone bezel | helix, capsules | tally grid of square cells (solid / hatch / open) | yes |
| Hero composition | text left, diagram right, 3 stat tiles | giant headline over tile relief | the demo is the page (phone + clinic) | centred Arabic headline, tilted cards | statement row, then a full-width real product sheet in two languages | yes |
| Demo entry | pick a couple, two phones | sign-in case card, "Viewing as" | person pills + 13-step story | sign-in, one-click personas | case x lens matrix (Case bench); compact "Lens" control | yes |
| Result | Simple/Standard/Detailed tabs, half diamonds | gated by both-agree strip, 100 spheres | headline + four-person strip, 100 dots | 25/50/25 card | threshold (RNTK), then side-by-side two languages + square-cell tally | yes |
| Consent | static "Who learns what" table | consent centre | per-finding toggle | landing copy | live matrix, cells cite law, switch writes audit row | partly: table form shared with Two Keys, behaviour is not |
| Radius | ~0-2 (square buttons) | pill buttons, rounded cards | glass panels, pills | pills, 16+ cards | 0 / 2 / 4 / 6 | close to Two Keys only on radius |
| Staff | (gated) | tiles + table | queue + brief + agenda | (gated) | 3-pane instrument with trace pane | partly: queue + brief exists at Silah |

**Result: passes.** Two residual overlaps are accepted on purpose and named:
1. A consent view drawn as a table (Two Keys). Ours is the live control, not an explainer.
2. Queue + brief (Silah). The challenge brief asks for exactly this. Ours adds the trace pane and removes the generated agenda.

The ch7 siblings (Arish Signal: warm sand, falaj teal, condensed numerals, signage pictograms) share no axis except "dark-to-light arc" and "hairlines over shadows". Those two are corpus rules, not a look.

## 7. Overrides of the brief's hypotheses (one line each)

- **Lapis kept.** Measured ΔE ≥ 0.16 from both rival navies, because those navies are dark and desaturated (L 0.32, C 0.09) and lapis is mid and saturated (L 0.47, C 0.18). Lapis also never appears next to the rivals' second colours.
- **Pedigree dropped everywhere.** The old DESIGN.md kept it in the tracker. Two Keys owns the pedigree visually.
- **"Viewing as" renamed "Lens".** KinSight uses the exact words "Viewing as".
- **Hero is not text-left / object-right.** That is Two Keys' fold. The hero is a statement row with the object full width under it.
- **U3 visibility matrix kept, but as a live control.** Two Keys has the same table shape on its landing, as a static explainer.
- **U4 adopted.** KinSight has "Verify chain" and "Run tamper test". Ours probes from the outside (employer, insurer, verdict question, distress, cross-couple, CBC only) and shows the audit row each probe wrote.

## 8. References actually opened

- UAE Design System typography and colour: https://designsystem.gov.ae/guidelines/typography and https://designsystem.gov.ae/guidelines/colour-system. Noto Kufi Arabic body, Alexandria headings, a 16 px minimum, no Arabic letter-spacing, and a separate darker "component" token for the brand colour. Taken: Kufi for Arabic UI, no tracking on Arabic, and a darker action token. Alexandria is not used because Two Keys and GeneBridge both use it.
- Dubai Design System typography: https://designsystem.dubai.ae/foundations/typography. Body 16/24, never below 14, a 4 px baseline. Taken: the 4 px rhythm and a 14 px floor for reading text. 11-12 px is used only for mono labels.
- NHS warning callout: https://service-manual.nhs.uk/design-system/components/warning-callout. At most 2 per page, and not for transactional journeys. Taken: the result is **not** styled as a warning. The boundary text is one quiet block.
- NHS care cards: https://service-manual.nhs.uk/design-system/components/care-cards. The heading states the action and does not rely on colour alone. Taken: the "Next step" panel heading is the action itself ("Talk with a genetic counsellor").
- Myriad positive-carrier sample report (outline only): https://myriad.com/womens-health/wp-content/uploads/sites/10/2022/06/PositiveCarrierSampleReport.pdf. Order: result label, then summary, then next steps; limitations and risk maths last. Taken: the progressive disclosure order.
- GOV.UK summary list: https://design-system.service.gov.uk/components/summary-list/. Keep row borders, use real tables for tabular data, and give actions row-scoped hidden labels. Taken: the brief's key/value block plus a real `<table>` for the queue.
- Linear triage changelog: https://linear.app/changelog/2021-06-29-linear-release-and-issue-triage. Explicit disposition verbs, and declining needs a reason. Taken: staff actions are verbs, and "decline" or "hold" requires a reason (a frontend form over the existing pathway events).
- ch7 measured corpus: `D:\dev\_research\design-agents\03-reference-corpus.md`. The 25-rule look brief is applied whole, except the "pill primary button": we use 4 px radius.
- Not opened (fetch failed or budget ran out): TAMM, Wio, Tabby, Careem, Natera, Invitae, Color, Apple Health, Bloomberg Terminal. No claim is made about them.
