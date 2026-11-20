# ADR 0180: The demo runs in Azure France Central; the design target is UAE North

- **Status:** **Superseded by [ADR 0186](0186-region-attempts-for-bayans-own-environment.md) on the region claim (2026-11-20).** The decision below assumed Rishta Safe would join the existing France Central environment; the controller rejected that ([ADR 0185](0185-bayan-gets-its-own-container-apps-environment.md)) and every region tried for an own environment was refused (0186). The sentence in decision 3 is **withdrawn until a deployment exists**; the rule behind it (name only a region read back from a live Rishta Safe resource, never claim in-UAE hosting unverified) stands. Original status: Accepted (infra lane, on the controller's brief of 2026-11-20). The region choice followed from [ADR 0181](0181-join-the-existing-container-apps-environment.md).
- **Date:** 2026-11-20
- **Deciders:** the infra lane; the controller (brief)
- **Supersedes / superseded by:** superseded by [ADR 0186](0186-region-attempts-for-bayans-own-environment.md) (region claim withdrawn) and [0185](0185-bayan-gets-its-own-container-apps-environment.md)
- **Evidence:** `az containerapp env list` and `az containerapp list-usages --location francecentral` on 2026-11-20 (one environment, in France Central, 1 of 1 used); Microsoft.App is registered and offers Container Apps and managed environments in France Central and UAE North (`az provider show -n Microsoft.App`); the sibling project reached the same region for the same reason (its ADR 0086).

## Context
Rishta Safe targets the UAE premarital screening pathway, so a UAE region is where a pilot would run. The demo is a synthetic-data prototype for a judged competition, on a Free Trial subscription whose single Container Apps environment is already in France Central.

## Decision
1. **The demo runs in France Central** (resource group `rg-bayan-demo-francecentral`, one new Basic registry, two Container Apps).
2. **The design target stays UAE North.** The Bicep takes the region as a parameter; nothing in the product depends on France Central.
3. **Never claim in-UAE hosting for the demo.** The only allowed wording is: **"Hosted in France Central for the demo; designed for UAE North."** This applies to the deck, the form text, the landing page, the declarations and every document. Residency is stated as a design property, not as a property of the demo. The demo holds made-up data only.

## Consequences
- A reader of any document that says "UAE North" for the running demo is reading a wrong document.
- Round-trip time from the UAE to France was not measured.
- Prices in `docs/runbook.md` are France Central list prices of 2026-11-20.
- **Cost of being wrong:** a judge assumes in-country hosting from a loose sentence. Mitigation: the one allowed sentence above, and a grep for "UAE North" next to "hosted" before submission.

## Revisit trigger
A second Container Apps environment can be created in UAE North (the usage API shows 0 of 1 there, but enforcement across regions is unverified, see ADR 0181); a paid subscription; any real data.

## Links
[ADR 0181](0181-join-the-existing-container-apps-environment.md) · [0182](0182-in-memory-state-for-the-demo-single-replica.md) · [0183](0183-deploy-from-the-laptop-github-workflow-unverified.md)
