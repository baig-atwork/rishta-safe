# ADR 0185: Rishta Safe gets its own resource group, own Log Analytics workspace and own Container Apps environment

- **Status:** **Superseded by [ADR 0187](0187-app-service-for-containers-and-its-quota-refusal.md) for the hosting service (controller decision, 2026-11-20): Container Apps is replaced by App Service for Containers.** The separation principle (own group, nothing shared with the other entry) stands. Original status: Decided by the controller (2026-11-20); **implemented in the Bicep and validated as a template, but NOT realizable on this subscription**: ARM refuses a second Container Apps environment (ADR 0186 has the exact errors). Supersedes [ADR 0181](0181-join-the-existing-container-apps-environment.md).
- **Date:** 2026-11-20
- **Deciders:** the controller (decision); the infra lane (implementation)
- **Supersedes / superseded by:** supersedes 0181 (join the existing environment); superseded by 0187 (hosting service). Amends [0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) (region) and [0183](0183-deploy-from-the-laptop-github-workflow-unverified.md) (the `join/action` gap disappears with this design).
- **Evidence:** controller message to the infra lane, 2026-11-20; `infra/bicep/**` (build and lint clean; `az deployment sub validate` passes); ADR 0186 (the creation attempts).

## Context
ADR 0181 had Rishta Safe's apps join the environment of another competition entry on the same subscription. The controller rejected that: it puts two entries that must stay separate under one default-domain suffix (`<random>.<region>.azurecontainerapps.io`, visible in every URL), in one log workspace, with one delete fate.

## Decision
1. **Everything Rishta Safe owns lives in one new resource group `rg-bayan-demo-<region>`** (region is a parameter: `uaenorth`, `germanywestcentral` or `westeurope`, in the order they are tried): its own Log Analytics workspace `log-bayan-demo` (PerGB2018, 30-day retention, daily cap 0.15 GB), its own Container Apps environment `cae-bayan-demo` (Consumption profile only, no virtual network, logs to the workspace through a diagnostic setting), a Basic registry, the identity `id-bayan-apps` with AcrPull, and, in phase 2, `bayan-api` (internal) and `bayan-web` (public).
2. **Nothing refers to another project's resource.** `deploy.ps1` refuses any resource group that is not its own and any argument that names the other project's groups; Teardown deletes only the group named `rg-bayan-demo-<region>` after the exact name is typed.
3. Phase 1 (infrastructure) and phase 2 (apps) stay separate, because the apps need images in the registry.
4. The hosting wording follows the region that `az` reads back from the live environment ([ADR 0186](0186-region-attempts-for-bayans-own-environment.md)); until an environment exists there is nothing to claim.

## Consequences
- The deployer's role on its own group covers the environment, so the `join/action` gap of ADR 0183 no longer exists.
- Cost: a workspace and an environment of its own (runbook section 7), including the open question of the `Environment Management Hour` meter.
- **Cost of being wrong:** the decision rests on a second environment being allowed. It is not on this subscription (ADR 0186). The decision stands as the design; the way to realize it is open.

## Revisit trigger
A subscription that can hold a second Container Apps environment; the owner's decision on the options in ADR 0186.

## Links
[ADR 0181](0181-join-the-existing-container-apps-environment.md) · [0186](0186-region-attempts-for-bayans-own-environment.md) · [0182](0182-in-memory-state-for-the-demo-single-replica.md)
