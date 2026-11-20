# ADR 0128: Cut: the family cascade invitation and sharing with relatives

- **Status:** Cut for the prototype
- **Date:** 2026-11-20

## Context
The dossier proposes a minimal-leak cascade invitation ("a relative asks you to consider carrier testing" without naming the gene) and consent-based sharing with a family member.

## Decision
Not built. The brief makes the external role see nothing and refuses relatives without a grant. A relative is an `external` principal, a consent cannot name `external` (refused and audited), and the third-party route always answers 403 and logs. A cascade invitation would need a message channel, a recipient identity and a legal read on what an invitation itself reveals.

## Consequences
The "allow individuals to control sharing with a partner or family member" requirement is met for the partner and for staff; family sharing is documented as future work.

## Revisit trigger
A legal read of what a cascade invitation discloses; a recipient identity and delivery channel.
