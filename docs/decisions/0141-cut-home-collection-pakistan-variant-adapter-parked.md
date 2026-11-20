# ADR 0141: Cut: home blood collection and partner-lab ordering; the screening visit is a simulated booking hand-off

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
Research 02 section 2.6: premarital screening is performed only at licensed facilities (DoH V3 4.1.9, DHA V1 6.1); neither standard mentions home collection; an outside lab result has no route into the certificate.

## Decision
The pathway starts with `registered`, a simulated booking at a licensed centre, then consent and consultation, sample at the same visit, laboratory, joint report. There is no home-collection step, no partner-lab ordering and no CBC-to-carrier step in the UAE variant. Every outside system is labelled simulated in all three languages.

## Consequences
The Pakistan variant (CNIC, nikah registrar, private labs, home phlebotomy) is parked as an adapter behind the `id_type` setting; `cnic` is accepted as a setting only.

## Revisit trigger
A Pakistan-scale pilot, and a cited source for where CBC and electrophoresis happen there.
