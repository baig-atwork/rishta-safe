# 0163: Visual direction "Lineage Folio" and result categories that are not a scale

Status: superseded for look and interaction model by ADR 0007 (Registry Grid, 2026-11-20); the rule that the three result categories are not a scale still stands. Originally accepted 2026-11-20. Lane D (frontend). Full rationale and tokens: `docs/design/DESIGN.md`.

## Context

The product is intimate (a couple, their families, inherited risk) and must never look childish, clinical-sterile or like a pass/fail test. Hard rule 4 limits a couple to three result labels; the brief forbids traffic-light semantics.

## Decision

Direction: editorial-civic, adjectives discreet, assured, humane; bone paper, blue-black ink, hairline rules, Newsreader plus Source Sans 3 (Noto Naskh and Nastaliq for Arabic and Urdu), verdigris-petrol brand colour used only for actions and the current step. One signature element: the pedigree line, used only in the landing hero, empty states and the pathway tracker. The three result categories are three different information states on three hue families (plum, slate, ochre), never red or green, never lighter or louder than each other, each with a distinct glyph and a text label so colour is never the only channel. Persistent honesty chips are neutral dashed "stamps". Clone-distance gate passed (not indigo, not Inter, 2/4/6px radii, borders not shadows, no gradients).

## Consequences

No category can read as pass or fail. Colour in the product means: action (brand), result category (three hues), staff urgency and errors (clay), system confirmation (muted green, never on a result). A future visual change must update `DESIGN.md` first.
