# ADR 0121: The consent ledger is append-only, and mandatory screening is not consent-based

- **Status:** Accepted (statute reading from the project dossier; legal read pending)
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Context
The brief and the dossier (section 3.3, audit correction) agree: Federal Decree-Law 49/2023 Art. 4(2)(a) exempts the obligatory screening "mentioned in this Law" from the consent requirement and Art. 15 makes couple screening obligatory. Consent governs voluntary and secondary uses and the sharing of one person's findings. A product that described the statutory flow as "consented" would misstate the law.

## Decision
- `ConsentBasis` has two values. `explicit_consent` records carry a scope (`couple_result_only`, `gene_names_only`, `full_variant_detail`), a purpose from a closed list, an optional expiry, and are revocable. `statutory_obligation` records document the legal basis for the mandatory screening, carry no scope, grant nothing to anyone and cannot be revoked (revoking raises `RuleViolation` citing Art. 4(2)(a) and 15).
- The ledger only appends: a grant is one line, a revocation is a second line. `consents()` returns the folded view with `revoked_at`. `effective_scope(records, couple, subject, recipients, at)` is a pure function of records and a time, so history can be replayed (a revoked grant was active before its revocation).
- Only the subject may grant or revoke. A grant names a role (counsellor, clinician, couple_member) or a pseudonymous person id. `programme`, `judge` and `external` cannot be named as recipients (refused and audited), because those roles never receive individual results; staff visibility comes from care-team assignment (ADR 0124), not from a grant.
- Purposes are a closed list in `consent_policies.yaml`, so no free text (and no personal data) enters the ledger.

## Consequences
Revocation never deletes. The deletion duty that Art. 8 attaches to withdrawal from a voluntary screening is a separate workflow and a parked cut (ADR 0130).

## Revisit trigger
Legal read of Art. 4, 6, 8; a persistence layer.
