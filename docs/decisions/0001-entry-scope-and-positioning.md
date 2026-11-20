# ADR 0001: Entry scope and positioning

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), under the owner's standing instruction to decide on best practice

## Context
Challenge 03 is the most crowded of the ten: at least 14 public repositories on 2026-11-15, four polished, four using private set intersection (research 06). The organisers provide no data. Five days of research (2026-11-15) recommended a pathway-faithful companion, not a risk-score product, and the build window on 2026-11-20 is five hours.

## Decision
Build a couple-result companion for the UAE premarital genetic screening pathway: it explains a reported result in plain, non-stigmatising language (English, Arabic draft, Urdu draft), enforces who may see what under each emirate's published rule, escalates by deterministic rule to a qualified human, follows the real pathway states and times, and closes the loop with a clinician proforma. Differentiate on (A) fidelity to the two primary standards (DoH Abu Dhabi V3, DHA Dubai V1), (B) traceable haematology-first interpretation as a clinician-facing aid with every rule gated on clinical sign-off, (C) measured safety on synthetic couples (oracle agreement, escalation recall, disclosure property tests, numeric fidelity of explanations).

## Consequences
We compete on honesty and measurement rather than on polish or on a cryptographic showpiece. We claim no clinical review, no field validation and no real data. Honest odds are low to medium; the aim is a complete, defensible, differentiated entry.

## Revisit trigger
A rival ships a clinician-signed pathway with measured escalation recall before the deadline; or the clinical lead rejects the haematology rule set.
