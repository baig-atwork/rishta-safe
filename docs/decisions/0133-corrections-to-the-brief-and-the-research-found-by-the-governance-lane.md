# ADR 0133: Corrections to the brief and the research, and additive contract notes

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Where the brief or the research was wrong or ambiguous, and what was done
1. **The two emirates differ less than the brief implies.** Research 02's own table gives near-identical disclosure rules. The policies differ where the clauses differ (where the consent gate sits); see ADR 0122.
2. **"Judge sees synthetic cases only" has no data to test.** `DisclosedResult` and `CoupleResult` carry no provenance flag. Every case is synthetic by hard rule 1, so the service defaults to synthetic in demo mode and requires an explicit mark outside it.
3. **The statute compels disclosure in the life-threat case; it does not say an app must deliver it.** ADR 0123.
4. **"Revocation never deletes" and "withdrawal deletes" (dossier, Art. 8) conflict.** Resolved by separating sharing revocation from withdrawal deletion (ADR 0130).
5. **Consent recipient roles.** The spec signature accepts any `Role`; programme, judge and external are refused as recipients so a grant cannot widen what those roles may see (ADR 0121).
6. **The brief lists five refusal categories.** Treatment advice and another person's result are added (dossier refusal list, Art. 9).
7. **Assignment authority** was open-ended in the first cut; tightened after the controller's review (ADR 0124).

## Additive contract notes (no edit to `core/`)
- `GovernedDisclosure` subclasses `DisclosedResult` in `governance/models.py` and adds `partner_gene_names` (the contract's `partner_findings` holds whole findings, which would include the zygosity, so it stays empty at the gene-names scope), `member_findings` (staff views) and `synthetic`. For staff and judge views `partner_findings` holds both members' findings (attributed in `member_findings`).
- `disclose` has two keyword-only parameters after the spec's five: `counselling_completed` (default False, fail closed) and `pregnancy_in_progress`.
- `grant` takes an optional keyword `by`; other additive service methods: `register_identity`, `register_staff`, `assign_staff`, `record_right_not_to_know`, `withdraw_right_not_to_know`, `mark_case_synthetic`, `record_statutory_basis`, `classify_request`, `escalation_queue`, `consents_for`, `audit_events_for`, `get_consent`, `record_access_denied`.
- Explain-lane keys to template: `withheld_reason_key` values `counselling_first`, `awaiting_partner_consent`, `right_not_to_know`; `certificate_note.abu_dhabi`, `certificate_note.dubai`; escalation `reason_keys` `escalation.<trigger id>`.
- Extra routes beyond the spec table: `PUT/DELETE /v1/couples/{id}/right-not-to-know`, `POST /v1/couples/{id}/assignments`, `POST /v1/refusals/classify`.
