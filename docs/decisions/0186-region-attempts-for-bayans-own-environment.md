# ADR 0186: Region attempts for Rishta Safe's own environment: all three refused; no Rishta Safe hosting exists

- **Status:** Accepted as a record of what happened. The open question (how Rishta Safe is hosted) needs the owner's decision.
- **Date:** 2026-11-20
- **Deciders:** the infra lane (attempts); the controller (order of regions and the clean-up rule)
- **Supersedes / superseded by:** amends [ADR 0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) (the region claim) and corrects [ADR 0181](0181-join-the-existing-container-apps-environment.md) (its reading of the usage API)
- **Evidence:** `infra/scripts/deploy.ps1 -Action Infra` (real creation attempts, 2026-11-20); read-only `az deployment sub what-if` of phase 1 per region; `az group exists` and `az containerapp env list` after the attempts.

## The attempts (controller's order: uaenorth, then germanywestcentral, then westeurope)
Each attempt ran phase 1 (`infra/bicep/main.bicep`, `deployApps=false`). The subscription id in the messages is shown as `<subscription-id>`; everything else is as Azure printed it.

| # | Region | Outcome | Exact error |
|---|---|---|---|
| 1 | `uaenorth` | **Refused** at the environment's preflight. The group, workspace, registry and identity were created first and then deleted with the group (clean-up of this attempt's own new group only). | `MaxNumberOfGlobalEnvironmentsInSubExceeded - The subscription '<subscription-id>' cannot have more than 1 Container App Environments. For more information, visit: https://go.microsoft.com/fwlink/?linkid=2208872` (inside deployment `environment`, resource provider `Microsoft.App/managedEnvironments (2026-07-01)`, `ValidationForResourceFailed`) |
| 2 | `germanywestcentral` | **Refused**, same error, same clean-up. | `MaxNumberOfGlobalEnvironmentsInSubExceeded - The subscription '<subscription-id>' cannot have more than 1 Container App Environments. For more information, visit: https://go.microsoft.com/fwlink/?linkid=2208872` |
| 3 | `westeurope` | **Refused before anything was created** (no group exists to clean up). | `RequestDisallowedByAzure - Resource 'id-bayan-apps' was disallowed by Azure: The selected region is currently not accepting new customers: https://aka.ms/locationineligible.` The same code and text for the registry `acrbayan...` and the workspace `log-bayan-demo` (and, in the read-only what-if, for `cae-bayan-demo`). |

After the attempts (`az`, read-only): `rg-bayan-demo-uaenorth`, `-germanywestcentral` and `-westeurope` do not exist; the only environment in the subscription is `cae-stellarblaze-demo`; the only resource groups are the two Stellar Blaze ones, which were not touched. Failed deployment records `bayan-p1-*` remain at subscription scope (metadata, no resources).

## What this corrects
- **The limit is subscription-wide, not per region.** The usage API shows `ManagedEnvironmentCount` 0 of 1 in uaenorth, germanywestcentral, westeurope, northeurope and uaecentral, which ADR 0181 and the controller read as free capacity. ARM's own preflight says otherwise: a global limit of 1 per subscription (Free Trial). The Stellar Blaze project's ADR 0086 was right.
- A read-only probe of an **Express** environment (`environmentMode: 'Express'` in a scratch template, what-if only) was refused too: uaenorth `MaxNumberOfGlobalEnvironmentsInSubExceeded`, francecentral `MaxNumberOfRegionalEnvironmentsInSubExceeded - ... cannot have more than 1 Container App Environments in France Central`. Whether the preflight honoured the Express mode is unknown, so Express is not shown to be available or unavailable; the usual form of the same limit applies at least to the property as written.
- A read-only what-if of an **App Service** Basic (B1) Linux plan in uaenorth and germanywestcentral passes preflight. That does not prove quota; Free Trial quota for Basic plans is checked at creation and was not tested.

## Hosting wording (honesty rule)
**No Rishta Safe hosting exists.** Nothing may be said about where the demo runs. ADR 0180's sentence ("Hosted in France Central for the demo; designed for UAE North") is **withdrawn until a deployment exists**: it described the shared environment, which the controller rejected. The rule that remains: name only a region that `az` has read back from a live Rishta Safe resource (`deploy.ps1` does this and prints `live location`); say "demo hosted in Azure UAE North on made-up data" only after that.

## Options for the owner (none is done)
1. **Lift the limit.** Upgrade the subscription from Free Trial to pay-as-you-go (the owner's decision, needs a card). That the upgrade removes this limit is the expected Microsoft behaviour for trial limits but was **not verified**. The existing Bicep then deploys unchanged in `uaenorth`.
2. **A second subscription** (another account or tenant). The same Bicep deploys unchanged.
3. **App Service for Containers**, one Basic Linux plan with two web apps: a separate `azurewebsites.net` domain, always on, a fixed plan fee, different Bicep and logs. Preflight passes; quota and price were not checked.
4. **Share the other entry's environment** (ADR 0181's design). Rejected by the controller; the cross-group join was never proven. The Bicep for it is no longer in the working tree; it can be rebuilt in minutes.
5. **Hide the shared suffix** with a custom domain on `bayan-web`: needs a domain and DNS the project does not have, and does not separate the log workspace or the delete fate.

## Amendment 2026-11-20 (App Service attempted)
The controller chose App Service for Containers as the way out ([ADR 0187](0187-app-service-for-containers-and-its-quota-refusal.md)). Option 3 above was tried in `uaenorth` and `germanywestcentral` and **refused for quota**: every App Service SKU has a limit of 0 on this subscription (exact errors in 0187). Azure Container Instances also show 0 standard cores. Options 1, 2 and 4 are unchanged; the controller has ruled out 1, 2 and 4 for now.

## Consequences
- The own-environment Bicep, `deploy.ps1`, the runbook and the smoke test are ready; the first real deployment waits on the owner's choice above.
- **Cost of being wrong:** a document says Rishta Safe is hosted somewhere when it is not. Mitigation: the withdrawn sentence above, and `Status` printing the live location.

## Revisit trigger
The owner's decision; any change to the subscription.

## Links
[ADR 0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) · [0181](0181-join-the-existing-container-apps-environment.md) · [0185](0185-bayan-gets-its-own-container-apps-environment.md)
