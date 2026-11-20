# ADR 0224: The submission drafts name no person, no team, no rival repository and no other competition entry

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the submission-drafts lane (G2), under the architecture contract (rule 2) and ADR 0204

## Context
The research notes this build rests on name individuals (the owner, the clinician, rival authors) and a sibling competition entry on the same Azure subscription, and the infra ADRs name that entry's resources. ADR 0204 decided that the prior-art statement names the laboratory-value prior art (DaNA) and says that four entries use private set intersection, and that it cites no rival by individual name. The contract forbids naming any individual, employer, consultant or developer anywhere in code, data, docs or UI, and calls the clinical owner "the clinical lead (sign-off pending)". The team name, the repository link, the video link and the deck template are not known to this lane.

## Decision
The drafts name nobody. They name DaNA once, as ADR 0204 does, and say "four entries use private set intersection" without naming them. They do not name the sibling entry; where the Azure subscription limit matters they say "the subscription allows one Container Apps environment in total" and cite ADR 0186. Team name, video link, repository link, deck and hosting line are marked placeholders in square brackets and listed in the checklist. The provider and model used for authoring-time drafting are not named (the data declaration carries a placeholder for the owner to complete, ADR 0202).

## Consequences
The documents read as anonymous until the owner fills the placeholders, which is intended. A reviewer who wants the rival names reads `declarations/prior_art.md`.

## Revisit trigger
The owner decides on the team name and on whether to name any collaborator.
