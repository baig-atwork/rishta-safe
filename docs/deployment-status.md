# Deployment status and the decision it needs (2026-11-20)

**State: nothing is deployed to Azure. Nothing of Rishta Safe exists in Azure.** Every create attempt was refused and cleaned up; the two resource groups of another project on the subscription were only listed, never written. The backend and frontend images build and run locally (`docker compose up`), and the api-only smoke test passes against the local container.

## What blocked it (exact findings, ADRs 0185 to 0187)

| Attempt | Result |
|---|---|
| New Container Apps environment in uaenorth | refused: the subscription cannot have more than 1 Container Apps environment (the limit is per subscription, not per region) |
| The same in germanywestcentral | same error |
| The same in westeurope | region not accepting new customers |
| App Service plan B1 Linux in uaenorth | refused: current limit for B1 instances is 0 |
| App Service plan in germanywestcentral | refused at preflight, quota 0 |
| Any App Service SKU (67 of them, including F1) in uaenorth, germanywestcentral, francecentral, northeurope, eastus | limit 0 |
| Azure Container Instances in uaenorth, germanywestcentral | StandardCores limit 0 |

The Free Trial subscription therefore allows exactly one Container Apps environment, and another project on the subscription already uses it.

## Options (the owner decides)

1. **Upgrade the subscription to pay-as-you-go, then deploy Rishta Safe into its own environment in UAE North.** Cleanest: Rishta Safe gets its own domain, workspace and lifecycle, and the design-target region becomes the real region (the in-UAE hosting claim could then be true for the demo, once verified with `az`). The Bicep for this exists (`environmentMode=own`). Cost on paper about USD 23 to 64 a month (ADR 0185, prices dated 2026-11-20, one meter unconfirmed). The upgrade is a billing action only the owner can take.
2. **Place Rishta Safe's two apps inside the existing Container Apps environment** (apps in their own new resource group `rg-bayan-demo-francecentral`, referencing the environment). It works within the Free Trial and takes about 15 minutes, and it is reversible (delete the new group). The costs: both entries then share one default domain suffix (visible to anyone who sees both URLs), one log workspace (0.15 GB a day cap) and the environment's delete fate. Because the two entries are meant to stay separate, I did not do this without your say.
3. **Request a quota increase** (App Service or Container Instances). Free Trial subscriptions usually cannot get one; support would have to say.
4. **Host outside Azure** (compose on a laptop with a tunnel, or another provider). Not what was asked; named for completeness.

Recommendation: option 1 if you are willing to upgrade (it also makes the UAE North design target the real region for the demo); otherwise option 2, knowing what it shares.

## Update, later on 2026-11-20: a non-Azure route is prepared (ADR 0226). Nothing is deployed.

A second Azure account has no free credits, so a route that needs no Azure was prepared:

- `infra/docker/combined.Dockerfile` builds one image that runs the API (on loopback, never published) and the web server together. Checked locally under a 512 MB cap: healthy in about 9 seconds, 147 MiB in use, no out-of-memory kill, the employer-refusal probe works through it.
- `render.yaml` describes one free Render web service in Frankfurt (the nearest region Render offers to the UAE) and validates against Render's published schema.
- Render's free tier sleeps after 15 minutes idle (about a minute to wake), has 512 MB and 750 hours a month, and its own tutorial says it needs no payment. Koyeb and Cloud Run need a card, Fly has no free tier, Railway's free plan is too small (ADR 0226 has the table).
- A demo there is **not** in the UAE and the documents must say Frankfurt, once it exists. Build time on Render's free build machines is not measured.
- It still needs the owner: a Render account, and a way to get the code there (a private Git repository the host can read, after the history rewrite; or a pushed image).

## What is ready for either path

`infra/bicep`, `infra/scripts/deploy.ps1` (actions Infra, Deploy, Warm, Smoke, Status, Teardown; teardown refuses any group not named `rg-bayan-demo-*`), `infra/scripts/smoke.ps1`, `docs/runbook.md`, the two Dockerfiles in `infra/docker`.
