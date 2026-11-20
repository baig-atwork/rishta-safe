# ADR 0206: Declarations are packaged static Markdown, with a copy of the open risks

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the declarations lane (G1), under the architecture contract (sections 3.3 and 5)

## Context
The API serves the declaration documents to the judge page (`GET /v1/governance/declarations`). Package data must ship inside the backend package, but `docs/open-risks.md` lives outside it and is the controller's file.

## Decision
Write the data declaration, limitations, regulatory posture and prior-art statement as English Markdown files of at most about 900 words each, one paragraph per line, in `backend/src/bayan/data/declarations/`, indexed by `index.json` (id, title, file, summary). Copy `docs/open-risks.md` byte for byte to `declarations/open_risks.md` and index it as the fifth entry. The source of truth for open risks stays `docs/open-risks.md`. Each document cites its sources by short tags and carries a source-tag line.

## Consequences
The two copies can drift if only one is edited. The controller regenerates the packaged copy whenever `docs/open-risks.md` changes. The documents were written in parallel with the build, so the controller reconciles the data declaration (data files, fonts, dependencies, provider name) against the final repository before submission.

## Revisit trigger
A backend lane adds a test asserting that the two open-risk files are equal, or the API serves `docs/open-risks.md` directly.

## Parking-lot line (controller to append)
- Test asserting `declarations/open_risks.md` equals `docs/open-risks.md` | the declarations lane writes no code | a backend lane can add it
