# 0179: The haematology aid is a two-pane instrument, and its rule trace is a table

Status: accepted (2026-11-20). Lane D (frontend v2).

## Context

The aid was a form card beside a reading card, with the rule trace as a numbered list. The v2 spec asks for inputs on the reading start side and the label, rule trace, sources and sign-off on the reading end side, in the same instrument language as the staff queue.

## Decision

1. Layout and presentation only. `schema.ts`, the field handling, the closed vocabulary and the rule that a CBC alone never gives a carrier statement are untouched; the not-a-diagnosis block stays at the top and the statement and sign-off stamp stay inside the reading.
2. The rule trace is a real table (rule id, what it found, source with its link), because a trace is rows with three attributes. The text in it is the API's; the component adds no clinical wording.
3. The empty reading area uses the cell motif (CBC, HPLC, reading to come) instead of the pedigree drawing, which v2 retired.

## Consequences

The clinician route stays above 170 KB gzip because of react-hook-form, zod/mini, the resolver and TanStack Query (ADR 0166); nothing here adds a dependency. The two-pane layout stacks below 1100 px with the inputs first.
