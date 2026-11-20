# ADR 0181: Rishta Safe's apps join the existing Container Apps environment from their own resource group

- **Status:** **Superseded by [ADR 0185](0185-bayan-gets-its-own-container-apps-environment.md) (controller decision, 2026-11-20): sharing the other entry's environment is rejected.** [ADR 0186](0186-region-attempts-for-bayans-own-environment.md) records that the own-environment alternative was refused in all three regions and **corrects this record: the usage API's 0 of 1 per region is not the real limit, which is 1 per subscription (fallback 1 below is therefore not available on this subscription).** Kept unchanged below for the analysis. Original status: Proposed. Rishta Safe's own group, registry and identity are validated (ARM validate and what-if, read-only, 2026-11-20). **That an app in one resource group can join an environment in another is not proven**: nothing short of creating the app shows it. The first deployment decides; the fallbacks below are ready.
- **Date:** 2026-11-20
- **Deciders:** the infra lane; the controller (brief)
- **Supersedes / superseded by:** none
- **Evidence (all read-only, 2026-11-20):**
  - `az containerapp list-usages --location francecentral`: `ManagedEnvironmentCount` 1 of 1. The same call for `uaenorth`, `westeurope`, `northeurope`, `germanywestcentral` and `uaecentral`: 0 of 1 each. The subscription is `FreeTrial_2014-09-01` with the spending limit on.
  - The one environment is `cae-stellarblaze-demo` in `rg-stellarblaze-demo-francecentral`, Consumption profile only, Succeeded, no virtual network; it runs the apps `api` (internal, minimum 0), `web` (public) and `alerts`. It belongs to a different project's live entry.
  - `az containerapp env list-usages` on it: `ManagedEnvironmentConsumptionCores` 0.5 of 100 (a cap, not the Free Trial's usual 10).
  - Its Log Analytics workspace `log-stellarblaze-demo`: daily cap 0.15 GB, retention 30 days, ingestion 2.0 to 2.3 MB a day on 2026-11-18 and 2026-11-19 (about 1.5 percent of the cap).
  - `Microsoft.App/managedEnvironments/join/action` exists as an operation; the built-in roles that carry it are Container Apps Operator and Container Apps Contributor. The signed-in user is Owner of the subscription.
  - `az deployment sub validate` and `what-if` of `infra/bicep/main.bicep` pass for both phases, and what-if lists changes only inside `rg-bayan-demo-francecentral`. **A negative control (an environment name that does not exist) also passes validate: validate does not check the environment link.**
  - Microsoft Learn (quotas page, express pages, Q&A, fetched 2026-11-20) has no statement on a cross-resource-group environment reference. A Q&A thread asks exactly this and has no accepted answer; two community reports show `LinkedAuthorizationFailed` on `join/action` for a caller who lacked it.

## Context
The Free Trial subscription cannot hold a second environment (the sibling project's ADR 0086 found it; the usage API above agrees for France Central and is silent on cross-region enforcement). The sibling's environment already exists and is paid for. The controller's brief: new resource group, new registry, new identity, two apps that reference the existing environment's resource id.

## Decision
1. `infra/bicep/main.bicep` (subscription scope) creates `rg-bayan-demo-francecentral` and, inside it, the registry, the identity and the two apps. It creates no environment. It **reads** the existing environment (`existing`, Reader) and puts its resource id in each app's `environmentId`. It writes nothing into the other project's groups; `deploy.ps1` refuses any other group name and checks that what-if lists no change outside Rishta Safe's group.
2. App names carry the prefix `bayan-` (`bayan-api`, `bayan-web`) so they cannot collide in the shared environment's DNS and service names with `api`, `web`, `alerts`.
3. Both apps run exactly one replica ([ADR 0182](0182-in-memory-state-for-the-demo-single-replica.md)).

## What sharing costs (blast radius, stated)
- **Shared fate.** The environment lives in the other project's group. If that group is deleted after GITEX (their plan: 11 December), Rishta Safe's apps lose their environment. Whether ARM blocks the deletion because apps from another group joined it, or removes them, is unverified. The owner of both projects must decide the order before any teardown.
- **No network isolation.** Environment-internal ingress is reachable by every app in it. Rishta Safe's api is internal to the environment, so the other project's apps could call it, and the reverse. Nothing sensitive is in either (synthetic data).
- **Shared domain and log workspace.** Rishta Safe's FQDNs are `bayan-web.<their default domain>`. Rishta Safe's console logs go into their workspace and count against its 0.15 GB daily cap; at these volumes that is small, but a chatty Rishta Safe log could hide their logs. Rishta Safe logs JSON, one line per request.
- **Shared free grant.** The Container Apps monthly free grant is per subscription. The other project's always-on worker alone exceeds the 180,000 vCPU-second grant, so Rishta Safe's cost is estimated with no grant.
- **Deploy rights.** A deployer other than the subscription Owner needs `join/action` on that environment. Granting it is a role assignment on the other project's resource, which this lane does not do (ADR 0183).

## Fallbacks, in the order to try
1. **A standard environment in another region.** The usage API shows 0 of 1 in UAE North, West Europe, North Europe, Germany West Central and UAE Central. If creating one works, Rishta Safe is fully isolated (and in UAE North the hosting claim of [ADR 0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) could change, only after the region is read back from the deployment). Cost to try: one empty Consumption environment, deleted at once on failure. Unverified whether the Free Trial refuses it across regions: the sibling needed a cleanup before retrying in France Central, which suggests enforcement is subscription-wide.
2. **A Container Apps Express environment** (separate quota: `ExpressEnvironmentCount` 0 of 10; available in France Central and UAE North per Microsoft Learn). Trade-offs: no internal service discovery (apps call each other on public URLs, so `bayan-api` would need external ingress, which weakens the web-only access model); a private registry needs a username and password secret or a user-assigned identity; Microsoft says Express needs an Entra-backed account and not a personal Microsoft account, and the signed-in account here is a personal one; some portal windows do not work. Newer, less proven.
3. **Azure App Service for Containers**, one Basic (B1) Linux plan holding two web apps. Isolated from the other project, always on, a fixed monthly plan fee, no scale to zero, a different Bicep and different logs. The Free Trial quota for B1 in France Central was **not checked**, and the price was **not looked up**.
4. **Apps inside the other project's resource group** with `bayan-` names. **Rejected**: it writes into a group this build must never touch, and it is the same shared environment with none of the separation.

## Consequences
- A failure at the first deploy is cheap to diagnose: ARM names the missing link or the missing permission. The fallbacks need no change to the images.
- **Cost of being wrong:** the other project's live entry is disturbed. Mitigations: nothing here writes to their groups (what-if checked, the script refuses), and the first real step that touches their environment is the app join itself, which only the controller authorises.

## Revisit trigger
The first deploy result; the other project's teardown date; a paid subscription.

## Links
[ADR 0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) · [0182](0182-in-memory-state-for-the-demo-single-replica.md) · [0183](0183-deploy-from-the-laptop-github-workflow-unverified.md)
