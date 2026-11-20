# ADR 0140: English explainer text carries language_status draft, not reviewed

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
The contract allows `language_status` to be `reviewed` and only says Arabic and Urdu stay draft. Hard rule 2 forbids claiming a review that did not happen, and nobody has reviewed the English clinical wording either.

## Decision
All three template files, all three glossaries and every closure and pathway text carry `language_status: draft` and `needs_clinician_signoff: true`. Every rendered document starts with a draft notice block, and the checker refuses a document that claims `reviewed` while its templates are draft. The clinical lead (sign-off pending) flips the field per file once a sign-off exists.

## Consequences
The UI shows a draft banner on English too. That is honest and costs nothing.

## Revisit trigger
A named clinical sign-off of the English file, or a native clinical review of the Arabic and Urdu files.
