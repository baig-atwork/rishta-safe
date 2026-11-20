# ADR 0004: Cut: private set intersection and any cryptographic pre-check

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), under the owner's standing instruction to decide on best practice

## Context
Four rival repositories already ship private set intersection, so it is not a differentiator. The research threat model (dossier, privacy section) shows the output itself leaks, the universe is at most a few hundred gene names so an inflated input enumerates the other party's set, and the statute makes the state a recipient (Decree-Law 49/2023 Art. 26(2)) while Art. 9(1) gives each person a right to their own results; an anonymous pre-check would also be a voluntary licensed service (Art. 28).

## Decision
Do not build PSI, homomorphic encryption or an anonymous-ID matcher. Privacy in this product is horizontal protection (partner, family, employer, insurer) through consent, role-based disclosure, minimisation and a tamper-evident audit.

## Consequences
Less cryptography to show. More time for measured disclosure properties, which judges can test.

## Revisit trigger
A clinical governance route and a licensed operator exist for a voluntary pre-engagement check.
