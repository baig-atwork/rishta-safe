# ADR 0220: The submission drafts say nothing about where the demo is hosted until a deployment is read back

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the submission-drafts lane (G2), following ADR 0186 and the runbook

## Context
ADR 0180 allowed one sentence about hosting ("Hosted in France Central for the demo; designed for UAE North"). ADR 0186 withdrew it: the controller rejected the shared environment (ADR 0185), Azure refused a second Container Apps environment in `uaenorth` and `germanywestcentral`, and `westeurope` was not accepting new customers. The runbook (section 0) and `docs/deployment-status.md` say that no Rishta Safe resource exists in Azure and that nothing may be said about where the demo runs; ADR 0187 adds that App Service plans and container instances have a quota of 0 on this subscription. Five other documents still say the demo runs in France Central: `docs/open-risks.md`, its packaged copy `backend/src/bayan/data/declarations/open_risks.md`, `declarations/limitations.md`, `declarations/regulatory_posture.md` and `docs/submission/commercial-and-pilot.md`. They were written before ADR 0186. None of them is in this lane.

## Decision
The submission drafts follow ADR 0186 and the runbook, not the older text. They state the design target (Azure UAE North), state what was verified at the time of writing (no Rishta Safe resource exists in Azure), and contain one marked placeholder, `[HOSTING LINE]`, that the owner replaces with one sentence only after `deploy.ps1 -Action Status` prints a live location for a Rishta Safe resource. The form text and the deck outline make no hosting claim at all. The video script says the demo is shown running locally unless the placeholder has been filled.

## Consequences
A judge cannot read a hosting claim that is not true. The submission looks weaker on deployment readiness than a hosted demo would, and the judging map says so. The five stale documents contradict the drafts until the controller reconciles them; the checklist lists them by path.

## Revisit trigger
`deploy.ps1 -Action Status` prints a live location for a Rishta Safe resource (then the placeholder is replaced and the five documents are corrected), or the owner chooses a hosting route from `docs/deployment-status.md`.

## Parking-lot line (controller to append)
- Reconcile the France Central sentences in open-risks, declarations and the commercial plan with ADR 0186 | the infra lane's ADR 0186 withdrew the claim after those files were written (ADR 0220) | before submission, or when a deployment is read back
