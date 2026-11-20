---
version: alpha
name: Rishta Safe, Registry Grid
description: "Registry Grid: a Swiss registry-instrument direction for a premarital screening result companion. Cool ink and mineral white, one lapis accent, and one signature element: the tally grid of square cells (solid, hatch, open)."
colors:
  surface: "#f8f9fb"
  surface-raised: "#fefeff"
  surface-sunken: "#eceff1"
  surface-inverse: "#0e1218"
  line: "#dde0e4"
  line-strong: "#82868e"
  fg: "#0e1218"
  fg-2: "#434851"
  fg-3: "#5f636b"
  fg-inverse: "#eff0f3"
  fg-inverse-2: "#b4b7be"
  primary: "#1a51bd"
  accent: "#1a51bd"
  accent-hover: "#0d40a4"
  accent-soft: "#e5efff"
  on-accent: "#fafcff"
  accent-on-dark: "#81aaf7"
  cat-shared-fg: "#75305b"
  cat-shared-bg: "#fbebf3"
  cat-none-fg: "#3e505c"
  cat-none-bg: "#ecf1f5"
  cat-info-fg: "#5b4c0d"
  cat-info-bg: "#f4f1da"
  attention-fg: "#8f331c"
  attention-bg: "#ffebe5"
  ok-fg: "#135b42"
  ok-bg: "#e5f5ed"
typography:
  display: { fontFamily: "Archivo", fontSize: "3.25rem", fontWeight: 560, lineHeight: 1.06, letterSpacing: "-0.025em" }
  h1: { fontFamily: "Archivo", fontSize: "1.75rem", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.015em" }
  h2: { fontFamily: "Archivo", fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }
  body: { fontFamily: "Archivo", fontSize: "1rem", fontWeight: 400, lineHeight: 1.6 }
  small: { fontFamily: "Archivo", fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.45 }
  label: { fontFamily: "Red Hat Mono", fontSize: "0.75rem", fontWeight: 500, lineHeight: 1.3, letterSpacing: "0.06em" }
  mono: { fontFamily: "Red Hat Mono", fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.45 }
  arabic-ui: { fontFamily: "Noto Kufi Arabic", fontSize: "1rem", fontWeight: 400, lineHeight: 1.7 }
  arabic-read: { fontFamily: "Noto Naskh Arabic", fontSize: "1rem", fontWeight: 400, lineHeight: 1.9 }
  urdu-read: { fontFamily: "Noto Nastaliq Urdu", fontSize: "1rem", fontWeight: 400, lineHeight: 2.4 }
rounded:
  none: "0px"
  xs: "2px"
  sm: "4px"
  md: "6px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
  8: "64px"
  9: "96px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
  button-primary-on-dark:
    backgroundColor: "{colors.accent-on-dark}"
    textColor: "{colors.surface-inverse}"
    rounded: "{rounded.sm}"
  stamp:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.xs}"
  panel:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
  hero:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.fg-inverse}"
  chip-shared:
    backgroundColor: "{colors.cat-shared-bg}"
    textColor: "{colors.cat-shared-fg}"
    rounded: "{rounded.xs}"
  chip-none:
    backgroundColor: "{colors.cat-none-bg}"
    textColor: "{colors.cat-none-fg}"
    rounded: "{rounded.xs}"
  chip-info:
    backgroundColor: "{colors.cat-info-bg}"
    textColor: "{colors.cat-info-fg}"
    rounded: "{rounded.xs}"
  rail:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.fg-2}"
  error:
    backgroundColor: "{colors.attention-bg}"
    textColor: "{colors.attention-fg}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
  row-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.fg}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
  input-border:
    backgroundColor: "{colors.line-strong}"
  divider:
    backgroundColor: "{colors.line}"
  caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg-3}"
  hero-secondary:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.fg-inverse-2}"
  status-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-fg}"
  link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
---

# Rishta Safe, Registry Grid

## Overview

**Direction: Registry Grid.** This is a Swiss registry instrument. The page reads like a well-kept civil register and a measuring instrument at the same time: a strict grid, hairline rules, one grotesque in several widths, a monospace for identifiers and figures, and colour only where it means something. It replaces "Lineage Folio" (`docs/design/DESIGN.md`, kept for history), whose cream paper, serif and pedigree hero coincided with the rival Two Keys.

The three behavioural adjectives:
- **asks before it shows**: the threshold before any result;
- **shows its working**: every figure, refusal and staff line carries its source;
- **answers in both tongues at once**: partners' languages side by side.

The full rationale, references and the clone gate against the four rivals are in `01-direction.md`.

**Signature element: the tally grid.** Square cells in exactly three fills (solid, diagonal hatch, open) plus a dashed edge for "pending". The same vocabulary is used for:
- the 10x10 result tally;
- the two-cell category glyph;
- the visibility matrix;
- the threshold options;
- the evidence cells (hatched = NOT RUN);
- the case bench;
- the audit tape;
- the wordmark.

Hatching is the second channel that colour never carries alone.

## Colors

The ground is cool mineral white, not paper. Ink is a blue-black. The landing hero and the evidence console are dark ink (`surface-inverse`). App screens are light, which makes the "dark statement, light product" arc. **One accent, lapis (`accent`, oklch 0.47 0.18 262)**, is used only for actions, links, focus and the person's own controls (the partner switches in the visibility matrix). Its budget is 3% of pixels or less. On dark surfaces the action colour is `accent-on-dark`.

**Result categories are three information states, not a scale, and never red or green.** Each has equal lightness:
- `shared_result_found`: aubergine;
- `no_shared_change_found`: graphite;
- `more_information_needed`: olive-ochre.

Each always ships with its two-cell glyph (hatched pair, open pair, one dashed) and its API label. `attention` (clay) is for errors and the staff "urgent" priority only. `ok` (green) is for "chain verified" only. Neither ever appears on a result.

Contrast was computed from the OKLCH tokens (`D:\dev\_research\ch03-ui\scripts\contrast.py`):

| Pair | Light | Dark |
|---|---|---|
| fg on surface | 17.82 | 16.48 |
| fg-2 on surface | 8.73 | 10.06 |
| fg-3 on surface | 5.72 | 7.05 |
| fg-3 on surface-sunken | 5.22 | 7.35 |
| link / accent on surface | 6.74 | 8.07 |
| on-accent on accent | 6.91 | 8.07 |
| fg-inverse on surface-inverse | 16.48 | n/a |
| fg-inverse-2 on surface-inverse | 9.35 | n/a |
| cat-shared fg on bg | 7.84 | 7.98 |
| cat-none fg on bg | 7.37 | 8.15 |
| cat-info fg on bg | 7.42 | 8.34 |
| category marks on surface (shared / none / info) | 6.92 / 6.42 / 6.44 | 8.34 / 8.79 / 9.09 |
| attention fg on bg | 6.87 | 7.38 |
| ok fg on bg | 7.15 | 8.03 |
| line-strong on surface (UI boundary, needs 3:1) | 3.47 | 4.06 |
| cell edge (fg-3) on surface (graphic, needs 3:1) | 5.72 | 7.05 |

`line` (1.3:1) and `grid` (1.55:1) are decorative separators only. Nothing a person must perceive depends on them.

## Typography

- **Archivo** (variable, width axis 62-125, weight 100-900) is the only Latin family:
  - display at `wdth 112`, weight 560, tracking -0.025em, landing only;
  - interface at `wdth 100`;
  - staff tables at `wdth 88`.
- **Red Hat Mono** is for ids, hashes, endpoints, figures and uppercase labels.
- **Noto Kufi Arabic** is for the Arabic interface and headings. It is the UAE Design System's Arabic body face, and its geometry is kin to the grid.
- **Noto Naskh Arabic** is for Arabic reading prose.
- **Urdu** uses **Noto Nastaliq Urdu** for reading prose and Naskh for its interface. Nastaliq is loaded on `/ur` only.

Sizes are 11, 12, 14, 16, 20 and 28, plus the 40-56 display.

Arabic and Urdu rules:
- no letter-spacing, no uppercase, no italics;
- line-height 1.7 in the interface, 1.9 for Arabic prose and 2.4 for Nastaliq;
- Western digits in every locale;
- ids, hashes and endpoints are wrapped in `dir="ltr"` / `<bdi>`.

## Layout

- A 12-column grid in a 1280 px container with 24 px gutters (16 px at 390).
- 4 px rhythm.
- One focal object per couple view.
- Staff screens are full-bleed three-pane instruments.
- Logical properties only.
- RTL is designed, not flipped:
  - the side-by-side reading puts the page locale first, at the reading start;
  - the tally fills from the reading start;
  - directional arrows mirror and cells do not.
- Header 52 px, honesty rail 28 px, audit tape 36 px. The old 70 px stamp band is gone.

## Elevation & Depth

Use hairlines and surface steps. One dialog shadow is allowed. No blur, glow, glass or gradients. The hatch pattern is the only repeating fill, and it always carries data.

## Shapes

Radius is 0 for cells, tables and charts; 2 for stamps and chips; 4 for buttons and inputs; 6 for panels, which is the maximum. Cells are always square, never rounded, never circles. Icons are Lucide (already a dependency) at a 1.5 px stroke, used sparingly. The custom glyphs are cells only.

## Components

The props are in `02-ux-concept.md` §6.
- **Cell**: a solid, hatch, open or dashed square.
- **TallyGrid**: the 10x10 grid with a legend.
- **CategoryChip**.
- **LensControl**: replaces the PersonaSwitcher.
- **HonestyRail**: replaces StatusStamps.
- **AuditTape**.
- **Threshold**.
- **ReadTogether**.
- **VisibilityMatrix**.
- **CaseBench**.
- **ProbeConsole**.
- **EvidenceCell**.
- **InstrumentPanes**: the queue, brief and trace panes.
- **TraceChip**.
- **PathwayCells**.

Every data surface has four states: a skeleton, an actionable empty state, an error with retry and correlation id, and a partial state.

## Do's and Don'ts

- Do: take every result and clinical sentence from the API; give every colour a cell glyph or a label; and put sources, rule ids and the "does not show" line beside every number.
- Do: keep the honesty rail on every screen and the boundary text on every result screen; and say "synthetic", "draft translation" and "pending sign-off" where they apply.
- Don't use any of these:
  - cream or warm paper, serif display, pedigree drawings, diamonds, stars, helixes or phone frames;
  - circles or half-marks in the tally;
  - red or green on a result, a severity scale, a residual-risk number or a marriage-decision question;
  - an em dash in user-facing copy;
  - an animation library, blur, glow, a gradient, or a radius above 6 px.
- Don't name any individual.
