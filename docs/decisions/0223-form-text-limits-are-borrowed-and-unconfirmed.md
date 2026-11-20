# ADR 0223: The form-text character limits are the sibling entry's, not confirmed for this challenge

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the submission-drafts lane (G2)

## Context
The brief gives limits of 256, 2,000 and 1,500 characters for the short description, the solution summary and "what has been built". They are the limits used for another entry on the same platform. This lane cannot see the submission dashboard, so it cannot confirm them for Challenge 03.

## Decision
Write each text under its limit, count characters with Python `len()` (line breaks count as 1), print the count under each text, and say in the file that the limits must be confirmed on the dashboard. Leave a margin of at least a few characters under each limit so a small change in how the platform counts a line break does not push a text over. State the synthetic-data limit and the draft status of Arabic and Urdu inside the texts, not only in the report. Make no hosting claim and no clinical claim in them.

## Consequences
If a limit on the dashboard is smaller, the owner must cut; the texts are written so the last sentence of each can be dropped first without breaking the meaning. The form fields the dashboard shows beyond these three are not known to this lane and are listed as unknown in the checklist.

## Revisit trigger
The owner reads the dashboard.
