# ADR 0204: Prior-art statement: what we name, what we claim

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the declarations lane (G1), under the architecture contract (rules 2 and 14)

## Context
Research R06 recommended three differentiators: a clinician-signed pathway, traceable haematology-first interpretation, and measured rather than claimed safety (a clinician-labelled escalation set plus a small teach-back run). ADR 0001 and the contract chose pathway fidelity, traceable haematology-first aid with sign-off pending, and measured safety on synthetic couples. No clinician sign-off exists, no clinician-labelled set exists and no comprehension test has been run. R06 also found a laboratory-value rival (DaNA), four private-set-intersection entries, and headline rival numbers that are regression gates on author-written sets. Its count of the field is "at least 14", and by our count the note names 13 plus one adjacent repository.

## Decision
Name only DaNA (laboratory-value prior art) and the four private-set-intersection repositories R06 lists. Describe them factually, without criticism of their authors, and cite no rival by individual name. Describe rival headline numbers without naming the repositories. State that our own numbers are of the same kind and show implementation consistency only. Keep the three differentiators from ADR 0001, and say plainly that the clinician-signed advantage and the human evidence R06 proposed are not ours. List what we do not claim to be first at. Date the snapshot (2026-11-15) and state its limits.

## Consequences
The statement claims less than R06's strongest differentiator, and it is true. It will age as rivals push changes after the snapshot.

## Revisit trigger
A clinical lead signs rules, a clinician-labelled escalation set exists, or a teach-back run is completed.
