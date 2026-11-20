# 0164: The pathway diagram is an ordered list with SVG nodes, not one monolithic SVG

Status: accepted (2026-11-20). Lane D (frontend).

## Context

The brief asked for the "How it works" pathway diagram in SVG using the real state names and times. A single SVG with text inside it cannot reflow for 390 px screens, cannot hold Arabic or Urdu text with correct bidirectional shaping and wrapping without hand-tuning each label, and is read badly by screen readers.

## Decision

One component (`PathwayTracker`) draws the pedigree-style descent line and one SVG node per state (done, current, upcoming, waiting as distinct shapes), and renders each state as a list item with real text. It is used both on "How it works" (static reference) and on the couple home (live states, times, SLA tags). The line sits on the reading-start edge in both directions via logical properties. State names come from message files; times come from `src/lib/pathway-reference.ts` (research note 02) until `backend/src/bayan/data/pathway.yaml` exists.

## Consequences

The diagram is accessible, translatable, responsive and mirrored by design. It is less of a poster than a single illustration; the pedigree motif carries the identity instead. Phase 2: bind the static reference to the API's pathway definition.
