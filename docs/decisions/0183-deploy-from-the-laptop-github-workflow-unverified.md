# ADR 0183: Deploy from the laptop with `deploy.ps1`; the GitHub deploy workflow exists but is unverified

- **Status:** Accepted (infra lane, on the controller's brief of 2026-11-20)
- **Date:** 2026-11-20
- **Deciders:** the infra lane; the controller (brief). Follows the sibling project's ADR 0073 (a local PowerShell deploy path is primary) and 0087 (OIDC subject for repositories created after 15 July 2026).
- **Supersedes / superseded by:** none
- **Evidence:** `infra/scripts/deploy.ps1` (Validate ran against the real subscription, read-only, 2026-11-20); `.github/workflows/deploy.yml`; `az role definition list` (the built-in roles carrying `Microsoft.App/managedEnvironments/join/action`: Container Apps Operator and Container Apps Contributor).

## Context
No GitHub repository, no GitHub environment and no OIDC identity exist for Rishta Safe yet. The deadline is today. The first deployment also has to prove the cross-group environment join ([ADR 0181](0181-join-the-existing-container-apps-environment.md)), which is easier to read from a local run.

## Decision
1. **`infra/scripts/deploy.ps1` is the way Rishta Safe is deployed** (Validate, Build, Deploy, Warm, Smoke, Status, Teardown), in the signed-in Owner's own session. State and the generated session secret live in `infra/.secrets/` (git-ignored). Teardown deletes only `rg-bayan-demo-francecentral`, after the exact name is typed, and refuses any other name.
2. **`.github/workflows/deploy.yml` ships new images to apps that already exist** (`az containerapp update`), manual dispatch only, OIDC login with no stored Azure secret. It is **unverified**: there is nothing to run it against. Its header says so.
3. **A known gap, not closed here:** the deployer identity is Contributor on Rishta Safe's group only. An app update re-sends the environment id, and ARM checks `join/action` on the environment, which lives in the other project's group. Closing the gap is a role assignment on that project's resource. No script makes it; it needs the owner's explicit decision. Until then the workflow may fail with `LinkedAuthorizationFailed`, and the laptop path is the one that works.
4. **Actions are pinned to commit SHAs** looked up on 2026-11-20; a deploy tag is the 12-character commit.

## Consequences
- The deploy is as repeatable as the laptop session; no CI history is kept.
- **Cost of being wrong:** a reader believes continuous deployment exists. Mitigation: the header of `deploy.yml` and the runbook's "unverified" list say it does not yet.

## Amendment 2026-11-20 (own environment)
Point 3 (the `join/action` gap) no longer applies: Rishta Safe has its own environment in its own group ([ADR 0185](0185-bayan-gets-its-own-container-apps-environment.md)), so the deployer's Contributor role on that group covers it. The group name now depends on the region (`rg-bayan-demo-<region>`), so `deploy.yml` reads it from the variable `AZURE_RESOURCE_GROUP`. Nothing else here changes; no environment can be created yet ([ADR 0186](0186-region-attempts-for-bayans-own-environment.md)).

## Amendment 2026-11-20 (App Service)
The hosting service is now App Service for Containers ([ADR 0187](0187-app-service-for-containers-and-its-quota-refusal.md)): `deploy.yml` updates the apps with `az webapp config set --linux-fx-version` and `az webapp restart`, and reads the app names (`bayan-api-<suffix>`, `bayan-web-<suffix>`) back from the group. Nothing has run on Azure.

## Revisit trigger
The GitHub repository exists; the owner decides on the `join/action` grant; the other project's environment is torn down.

## Links
[ADR 0181](0181-join-the-existing-container-apps-environment.md) · [0182](0182-in-memory-state-for-the-demo-single-replica.md) · [0184](0184-infra-hardening-cuts-for-the-demo.md)
