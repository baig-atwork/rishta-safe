---
version: alpha
name: Rishta Safe, Lineage Folio
description: "Lineage Folio: an editorial-civic direction (discreet, assured, humane) for a couple-result companion; a printed clinic-letter feel with one signature element, the pedigree line."
colors:
  # Light theme. OKLCH primitives; neutrals are tinted warm (paper) and cool (ink), never pure gray.
  surface: "oklch(0.972 0.010 85)"
  surface-raised: "oklch(0.992 0.005 85)"
  surface-sunken: "oklch(0.945 0.014 85)"
  border: "oklch(0.86 0.014 85)"
  border-strong: "oklch(0.60 0.020 85)"
  ink: "oklch(0.22 0.020 255)"
  ink-2: "oklch(0.38 0.020 255)"
  ink-3: "oklch(0.48 0.020 255)"
  brand: "oklch(0.42 0.075 205)"
  brand-strong: "oklch(0.35 0.070 205)"
  brand-soft: "oklch(0.93 0.030 205)"
  on-brand: "oklch(0.985 0.006 85)"
  focus: "oklch(0.48 0.140 250)"
  cat-shared-fg: "oklch(0.38 0.100 330)"
  cat-shared-bg: "oklch(0.95 0.025 330)"
  cat-shared-mark: "oklch(0.48 0.110 330)"
  cat-none-fg: "oklch(0.36 0.040 250)"
  cat-none-bg: "oklch(0.95 0.015 250)"
  cat-none-mark: "oklch(0.45 0.050 250)"
  cat-info-fg: "oklch(0.40 0.075 70)"
  cat-info-bg: "oklch(0.95 0.040 85)"
  cat-info-mark: "oklch(0.52 0.100 70)"
  attention-fg: "oklch(0.42 0.120 35)"
  attention-bg: "oklch(0.95 0.025 40)"
  ok-fg: "oklch(0.38 0.070 165)"
  ok-bg: "oklch(0.95 0.025 165)"
typography:
  display: { fontFamily: "Newsreader", fontSize: "clamp(2.5rem, 1.9rem + 3vw, 4rem)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.02em" }
  h1: { fontFamily: "Newsreader", fontSize: "clamp(2.125rem, 1.7rem + 2vw, 3rem)", fontWeight: 500, lineHeight: 1.12, letterSpacing: "-0.015em" }
  h2: { fontFamily: "Newsreader", fontSize: "clamp(1.75rem, 1.55rem + 1vw, 2.25rem)", fontWeight: 500, lineHeight: 1.18 }
  h3: { fontFamily: "Source Sans 3", fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }
  body: { fontFamily: "Source Sans 3", fontSize: "1rem", fontWeight: 400, lineHeight: 1.6 }
  reading: { fontFamily: "Newsreader", fontSize: "1.1875rem", fontWeight: 400, lineHeight: 1.65 }
  small: { fontFamily: "Source Sans 3", fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.5 }
  stamp: { fontFamily: "Source Sans 3", fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.3, letterSpacing: "0.08em" }
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
  lg: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
  4xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.md}"
  stamp:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
---

> **Superseded (2026-11-20) by `docs/design/v2/DESIGN.md` (Registry Grid), see ADR 0007. Kept for history; do not build from this file.**

# Rishta Safe, Lineage Folio

## Overview

**Direction: Lineage Folio**, an editorial-civic hybrid. The page is treated like a well-set clinic letter or a civil-register folio: bone paper, blue-black ink, hairline rules instead of card shadows, a serif for the voice and a humanist sans for the working parts. Three behavioural adjectives: **discreet** (nothing shouts; private by default), **assured** (plain statements, no hedging that frightens, no reassurance that misleads) and **humane** (warm paper, generous leading, full care for Arabic and Urdu).

The topic is intimate: a couple, their families, inherited risk. The domain codes we honour are the health and civic ones: legibility, calm, plain language, visible status, one clear next action. The codes we break are the clinical-SaaS ones: cyan-and-white clinical sterility, traffic-light red/green, smiling stock people, gradients and mascots.

**Signature element: the pedigree line.** A restrained line-art motif borrowed from pedigree-chart notation (a descent line, a couple line, a sibship bracket, abstract open symbols; no sex encoding, no clinical semantics). It appears in exactly three places: the landing hero, empty states, and the pathway tracker (the tracker *is* a descent line with a node per state). Nowhere else. It is never animated except for the tracker line drawing to the current state once.

**Clone-distance gate (passed).** Accent is verdigris-petrol, not indigo. Display face is Newsreader, body is Source Sans 3, neither is Inter or Geist. Radius is a deliberate 2/4/6px scale (editorial, not the friendly 8-16px default). Depth fork is chosen: borders and rules, one shadow reserved for dialogs. No gradients. Fewer than 3 tokens coincide with any Linear/Stripe/Vercel template.

**References studied** (principles taken, nothing copied):
- GOV.UK task list pattern (real UX): status shown as a tag plus text, one obvious next action per step; informed the pathway tracker. Read via the Design System and Design Notes search results, 2026-11-20.
- NHS service manual, warning callout (real UX, fetched 2026-11-20): at most two callouts per page; a short specific heading matters more than colour or an icon. Informed the boundary notice and the "no colour alone" rule.
- Icon-array literature (Zikmund-Fisher and colleagues; the JDM and Cambridge Core papers in the search results, 2026-11-20): grouped, static, 10 by 10 part-to-whole arrays read best; animation did not help and often hurt. Informed the 100-icon array: grouped, static, labelled total.
- Pedigree notation (NSGC standardized human pedigree nomenclature) for the idea of line plus node only.
- Cultural context (not UI reference): the DoH Abu Dhabi and DHA Dubai premarital standards read in research note 02; their documents are letter-like and Arabic-first, which is why the folio metaphor fits. I did not inspect the TAMM, DubaiNow or EHS apps, so no claim is made about them.

## Colors

One domain-derived hue: **verdigris-petrol (OKLCH hue 205)**, the colour of aged copper and Gulf water in shade; deep and low-chroma so it reads as ink, not as "healthcare cyan". It is reserved for actions, links and the current step (60-30-10: ~60% paper, ~30% ink and rules, ~10% brand). There is no separate accent; scarcity of brand is what makes the next action findable.

**Colour is reserved for meaning, and the three result categories are not a scale.** They are three different information states, each on its own hue family, none red or green, each always paired with a glyph and a text label (never colour alone):
- `shared_result_found`: plum (hue 330). Glyph: two linked symbols, both half-marked.
- `no_shared_change_found`: slate (hue 250). Glyph: two linked open symbols.
- `more_information_needed`: ochre (hue 70). Glyph: two linked symbols, one dashed.
Plum is not "bad", slate is not "good": no category is lighter, darker or louder than another by design.

Staff-only review priority is an ordered scale and is shown by weight, label and icon first; only `urgent` borrows the clay `attention` family, which is also the error family. `ok` (muted green) exists only for system confirmations such as "chain verified". It is never used on a result.

Persistent honesty chips ("Synthetic data", "Draft translation", "Clinical rules pending sign-off") are **stamps**: neutral ink, dashed 1px outline, small caps in Latin. They are not coloured because their job is to be always true, not to alert.

Both themes are token swaps of the same names (`:root` light, `[data-theme=dark]` and the system preference). All text pairs meet 4.5:1 and UI boundaries 3:1 in both themes (axe-checked on every page in light, spot-checked in dark).

## Typography

Latin: **Newsreader** (variable weight, a text serif drawn for screens) for headings and long-form reading blocks; **Source Sans 3** (variable, humanist, excellent numerals and a tall x-height) for interface, forms and tables. Contrast by classification (serif voice, sans instrument), kinship by humanist skeletons.

Arabic: **Noto Naskh Arabic** (variable weight, naskh proportions suited to continuous text, wide glyph coverage including the Urdu letters ٹ ڈ ڑ ں ھ ے). Urdu: **Noto Nastaliq Urdu** for headings and reading prose (Nastaliq is the script Urdu readers expect for text) and Naskh for interface labels, tables and numerals where Nastaliq's diagonal baseline and tall ascenders hurt scanning. Nastaliq is 239 KB, so it is loaded only on `/ur` pages, with `font-display: swap`, no preload and a leading that already accommodates it so the swap does not move the layout.

Rules that matter for the scripts: no letter-spacing on Arabic or Urdu (it breaks joining), no uppercase transform, no italics; Western (Latin) digits in all three locales so a number in a result means the same everywhere; larger default size for Arabic (+6%) and Urdu Nastaliq (+10%) because the x-height of both is smaller; line-height 1.6 (Latin), 1.95 (Arabic), 2.4 (Urdu Nastaliq). Measure capped at 66ch (Latin) and 58ch (Arabic, Urdu). Scale: ratio 1.2 for interface steps, with `clamp()` display steps (rem plus vw, zoom-safe). Fallback faces are metric-matched via `size-adjust` so webfont swap does not shift layout.

## Layout

A 12-column grid, 4px base unit, content width 72rem, reading width 66ch. Pages are *folios*: a narrow header band, a title block (eyebrow in small caps, serif H1, one-sentence standfirst), then ruled sections separated by hairlines. One focal point per view: on the couple home it is the next-action panel; on the result view it is the one-sentence result.

Everything uses logical properties (`margin-inline`, `padding-block`, `inset-inline-start`, `border-inline-start`, `text-align: start`). RTL is **designed, not flipped**: the pathway tracker keeps its descent line on the reading-start edge in both directions, directional icons mirror (arrows, chevrons), non-directional ones do not (check, lock, clock, the pedigree symbols), numerals and codes stay LTR inside RTL runs (`<bdi>` and `dir="ltr"` on hashes, IDs and lab values), and tables right-align by `text-align: end`.

## Elevation & Depth

Borders and rules, not shadows. Surfaces are separated by `border` hairlines and by the three paper tones (`surface`, `surface-raised`, `surface-sunken`). The single shadow token belongs to dialogs. No glass, no blur, no gradients, no grain.

## Shapes

Radius scale 0, 2, 4, 6px: chips and stamps 2px, buttons and inputs 4px, panels 6px. Nested radii are concentric (child never exceeds parent). Iconography: 1.5px stroke, round caps, drawn on a 24px grid; the pedigree symbols are the only custom illustration. No emoji.

## Motion

Motion communicates; it never decorates. Four uses only:
1. **Continuity**: the tracker's descent line draws from the previous node to the current node once on mount (320ms ease-out).
2. **Feedback**: a changed consent row gets a 200ms background settle; buttons give a 120ms press.
3. **Process**: "verify chain" ticks each audit row in sequence (40ms stagger, capped at 12 rows), so verification is seen to happen.
4. **Attention**: the live-region status messages fade in (120ms).
Easing is `cubic-bezier(0.2, 0.8, 0.2, 1)` out, `cubic-bezier(0.4, 0, 1, 1)` in; durations 120/200/320ms. Only `transform` and `opacity`. Animations are CSS keyframes and transitions (no animation library: Motion cost about 34 KB gzip and pushed three routes over the 170 KB budget, ADR 0166); a global `prefers-reduced-motion: reduce` rule removes every animation and transition, so the end state is what renders, and the verify-chain stagger is skipped in script when reduced motion is on. The icon array is static on purpose (see references).

## Components

- **Stamp** (status chip): neutral, dashed outline, small caps; persistent in the header band, never dismissible.
- **Boundary strip**: a ruled block with the heading "Education and decision support, never clinical advice"; on every result screen; counted as one of the two callouts allowed per page.
- **Pathway tracker**: vertical descent line with a node per state (open = upcoming, solid = done, ringed = current, dashed = blocked), time and SLA text beside each node, one primary "next action" panel above it.
- **Result card**: category glyph + label chip, then the single-sentence result in the serif, then the 100-icon array and the "what this means / does not mean" columns, then the options pane in neutral order.
- **Icon array**: 10 by 10, grouped (affected, then carrier, then neither), static; solid / half-marked / open circles so it reads without colour; a labelled legend with counts and the total.
- **Consent ledger**: a real `<table>` (person, recipient, scope, purpose, expiry, status, action) collapsing to labelled definition rows below 40rem; revoke through a confirm dialog.
- **Four states** on every data surface: skeleton that mirrors the final layout (no CLS), empty state as onboarding with the pedigree motif and a CTA, error with message, retry and correlation id, partial with what loaded and what did not.

## Do's and Don'ts

- Do: use only the result vocabulary the API returns; show status stamps on every screen; give every colour a second channel (glyph, label, pattern); keep Arabic and Urdu as first-class layouts.
- Do: state "synthetic", "draft translation" and "pending sign-off" wherever they apply, and never name an individual.
- Don't: use red/green for any result; show a residual-risk number, a score, a points total, or a marriage-decision question; animate the icon array; add a gradient, a mascot or an emoji; copy a Linear, Stripe or Vercel template.
- Don't: hard-code result or clinical wording in components; it comes from the API response.
