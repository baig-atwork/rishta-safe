# ADR 0002: UAE-first pathway; the identity type is a setting

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), under the owner's standing instruction to decide on best practice

## Context
The clinical lead's voice note described a Pakistani flow (national ID number, home sample collection). The challenge targets Abu Dhabi, where mandatory couple screening applies to Emirati citizens, is licensed-facility-only and has no home collection (DoH V3, DHA V1).

## Decision
Model the UAE pathway. The identity type is a per-case setting (`emirates_id`, `cnic`, `none`) so another jurisdiction is a configuration change, not a rewrite. Home collection is not modelled; the screening visit is a simulated hand-off to a licensed centre. Pakistan is the scale-out slide, not a built variant.

## Consequences
One pathway to get right instead of two to get half right. The Pakistan variant adapter is parked (docs/parking-lot.md).

## Revisit trigger
A pilot partner outside the UAE exists and confirms the sample-collection and referral steps.
