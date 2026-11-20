# Rishta Safe demo runbook

For Ali. Windows 11, one PowerShell window, from the repository root `D:\dev\bayan`. Written 2026-11-20.

## 0. Where things stand (read this first)

**Nothing of Rishta Safe is deployed. No Rishta Safe resource exists in Azure.** The deployment code is ready and was checked locally and as a template, but Azure refused to create the App Service plan, because **this Free Trial subscription has an App Service quota of 0** (ADR 0187):

| Region | Result |
|---|---|
| `uaenorth` | refused when the B1 Linux plan was created: `Operation cannot be completed without additional quota ... Current Limit (B1 App Service instances): 0` |
| `germanywestcentral` | refused at preflight (`SubscriptionIsOverQuotaForSku`): the same text |

It is not only B1: all 67 App Service plan SKUs (including the free F1) have a limit of 0 in `uaenorth`, `germanywestcentral`, `francecentral`, `northeurope` and `eastus`. Azure Container Instances have 0 standard cores. The one Container Apps environment this subscription allows is held by another project, and sharing it was ruled out (ADRs 0185, 0186). The own-group, own-domain design therefore cannot run on this subscription. Until a decision is taken there is nothing to warm, smoke or tear down, and **nothing may be said about where the demo is hosted**.

What **was** verified: the api image builds, starts with `BAYAN_ENV=demo`, and the api-only smoke test passes against it locally (section 3).

**The wording rule (ADRs 0180, 0186, 0187).** Name a region only if `deploy.ps1 -Action Status` has printed it as the live location of a Rishta Safe resource. Then, and only then, say: "hosted for the demo in `<that region>`, on made-up data; design target Azure UAE North". Never say the demo is hosted in the UAE otherwise.

The rest of this file is the procedure for when an App Service plan can be created. Everything in it that touches Azure is **unverified**: it has never run to the end.

## 1. What will be deployed, and its limits

```text
  browser
     |  https, public (*.azurewebsites.net)
     v
  bayan-web-<suffix>   Next.js container, port 3000, B1 plan, always on
     |  server-side proxy: /api/v1/* is forwarded to BAYAN_API_URL
     |  https, PUBLIC address of the api
     v
  bayan-api-<suffix>   FastAPI container, port 8000, same plan, always on, state in memory
```

| Thing | Name |
|---|---|
| Resource group (Rishta Safe's only one) | `rg-bayan-demo-<region>` (`uaenorth`, else `germanywestcentral`) |
| App Service plan | `asp-bayan-demo` (Linux B1, 1 instance) |
| Registry (Basic) | `acrbayan...` (`deploy.ps1 -Action Status` prints it) |
| Identity that pulls images | `id-bayan-apps` (AcrPull; managed-identity pull, no registry password) |
| Apps | `bayan-api-<suffix>`, `bayan-web-<suffix>` (the suffix is 6 characters derived from the subscription id) |

Both apps: HTTPS only, TLS 1.2 minimum, FTP and FTPS disabled, always on. The api has health check `/healthz` and the settings `BAYAN_ENV=demo`, `BAYAN_DEMO_MODE=true`, `BAYAN_SESSION_SECRET` (generated, never printed). Rishta Safe shares nothing with any other project; `deploy.ps1` refuses any resource group other than Rishta Safe's own and any argument that names another project's groups.

**Limit 1: the demo has no database.** All state is in the api process. A restart, a deploy or a platform move resets the demo to its seed (ADR 0182). No backup, none needed: the data is synthetic.

**Limit 2: one instance.** A second instance would be a second, empty demo behind the same address. The plan is fixed at 1; never scale it out.

**Limit 3: the api is public.** App Service Basic has no private networking, so `bayan-api-<suffix>.azurewebsites.net` answers from the internet. It is token-guarded (a demo persona's token is handed out by `GET /v1/demo/personas`, which is how the demo works), simulated, audited, and holds only made-up data (ADR 0187, point 3). Do not put real data behind it.

## 2. Deployment, step by step (when quota exists)

All commands from `D:\dev\bayan`. Nothing here is run for you.

| Step | Command | Costs money? | Expect |
|---|---|---|---|
| 1 | `docker version --format '{{.Server.Version}}'` | no | a version number |
| 2 | `.\infra\scripts\deploy.ps1 -Action Validate` | no | `PASS` lines; creates nothing. It does **not** test the App Service quota: only creating the plan does. |
| 3 | `.\infra\scripts\deploy.ps1 -Action Deploy -Yes` | yes | phase 1 (group, registry, identity, plan; tries `uaenorth`, then `germanywestcentral`; a refused attempt prints its exact error and deletes only its own new group), then builds and pushes the api image, creates the api app, waits for `/healthz`, runs the api-only smoke test |
| 4 | `.\infra\scripts\deploy.ps1 -Action Deploy -Yes -WithWeb` | yes | the same, plus the web image and the web app. Only when the frontend builds from a clean install. |

`-Location <region>` pins a region; `-Action Infra` does phase 1 alone.

- The image push right after phase 1 may fail with `unauthorized`: the AcrPush role takes minutes to apply. Wait 5 minutes and run `-Action Build`, then `-Action Deploy -SkipBuild -Tag <the tag Build printed>`.
- The first start pulls the image with the managed identity. A role that has not propagated makes the first pull fail; the platform retries, and `Deploy` waits up to 10 minutes for `/healthz`.
- A dirty work tree is allowed; the image tag becomes `<commit>-dirty-<timestamp>`.
- The session secret (`BAYAN_SESSION_SECRET`, 64 hex characters) is generated by `RandomNumberGenerator` into `infra\.secrets\bayan.secrets.json` (git-ignored, readable by your Windows account) only when an app is deployed, and reused after that. It is passed to Azure as a secure parameter and never printed.

## 3. Warm, Smoke, Status

```powershell
.\infra\scripts\deploy.ps1 -Action Warm      # both apps are on and always-on, then touched once
.\infra\scripts\deploy.ps1 -Action Smoke     # the checks below, against the deployed address(es)
.\infra\scripts\deploy.ps1 -Action Status    # read-only: group, plan, live location, apps, images, registry tags
```

The plan is always on (`alwaysOn`), so there is no cold start to wait out; `Warm` only checks the setting and primes the first request.

**What Smoke checks** (`infra/scripts/smoke.ps1`, using the calls of `backend/tests/integration/test_demo_flow.py`):

1. `GET /healthz` is `{"status":"ok"}` and `GET /readyz` reports 5 built services.
2. `GET /v1/demo/personas`: 24 personas (4 staff, 20 couple members), all tokens simulated.
3. `GET /v1/demo/cases`: 10 seeded synthetic cases.
4. a couple member reads `cpl-demo-02` in Arabic (`?locale=ar`): category in the closed vocabulary, 31 blocks, checker ok, staff-only fields absent.
5. the judge (staff) view of the same couple carries the category and a review priority.
6. `GET /v1/audit/verify` is ok; then `POST /v1/third-party-requests` with `kind` employer and no token is refused with 403 citing Art. 19 to 21; the audit chain grew by one entry and is still ok.
7. with `-BaseUrl` (the web app exists): `/en`, `/ar`, `/ur` answer 200, the last two with `dir="rtl"`, and the web proxy returns the 10 cases.

**Run locally, verified 2026-11-20:** checks 1 to 6 passed against the api image started with `BAYAN_ENV=demo` (`.\infra\scripts\smoke.ps1 -ApiBaseUrl http://127.0.0.1:8000`). Check 7 passed earlier for the locale pages against the web image built from a patched copy. Neither has run against Azure.

Smoke writes one refused request to the audit log; `POST /v1/demo/reset` gives a clean demo afterwards. Local run of the same images: `docker compose up --build` (web `http://localhost:3000`, api `http://127.0.0.1:8000`).

## 4. Logs

```powershell
az webapp log tail --name bayan-api-<suffix> --resource-group rg-bayan-demo-<region>
az webapp log tail --name bayan-web-<suffix> --resource-group rg-bayan-demo-<region>
```

`Deploy` turns container logging to the file system on for each app. The api logs JSON with a correlation id. There is no Log Analytics workspace in this design (nothing to cap, nothing to pay for), so logs live only on the instance and are lost on restart.

## 5. Roll back

```powershell
.\infra\scripts\deploy.ps1 -Action Status       # shows the newest tags in the registry
az webapp config set --name bayan-api-<suffix> --resource-group rg-bayan-demo-<region> --linux-fx-version "DOCKER|<acr login server>/bayan-api:<older tag>"
az webapp restart  --name bayan-api-<suffix> --resource-group rg-bayan-demo-<region>
```

The same for the web app. The demo state is reset by the restart (limit 1). If the old tag is gone, rebuild it from its commit: `git switch --detach <commit>` then `.\infra\scripts\deploy.ps1 -Action Deploy -Yes`.

## 6. Tear down

```powershell
.\infra\scripts\deploy.ps1 -Action Teardown
```

It finds Rishta Safe's group, lists what it will delete and asks you to **type the exact group name** `rg-bayan-demo-<region>`. Any other name is refused, including another project's groups. It deletes the apps, the plan, the registry and its images, and the identity, and returns at once. Confirm in about 10 minutes: `az group exists --name rg-bayan-demo-<region>` prints `false`. It cannot be undone; the secrets file is not deleted. Teardown is the stop button: the plan bills by the hour until the group is gone.

## 7. What it costs per month

**Prices:** Azure Retail Prices API, looked up **2026-11-20**. List prices, not a quote. A month is 730 hours.

| Item | uaenorth | germanywestcentral |
|---|---|---|
| App Service plan, Basic B1 Linux | 0.022 per hour = **16.06** a month | 0.01802 per hour = **13.15** a month |
| Container Registry Basic | 0.1666 per day = **5.07** a month (10 GiB included) | 0.1666 per day = **5.07** a month |
| **Total** | **about 21.1** | **about 18.2** |

That is about USD 0.70 a day. The cost is **fixed per hour whatever the traffic**: the plan bills while it exists, and both apps share it (an app costs nothing extra on a plan). There is no Log Analytics workspace, no environment meter and no per-request charge in this design. Not priced or not included: outbound data transfer beyond the free allowance (negligible at demo traffic), and the remaining Free Trial credit (not read). The subscription is a Free Trial with a spending limit, so the trial credit is spent first. After the first real deployment check Cost Analysis at 24 to 48 hours (portal, Cost Management, group by meter, resource group `rg-bayan-demo-<region>`). This is **not payable at all today**: the quota is 0.

## 8. Deploying from GitHub (optional, unverified)

`.github/workflows/deploy.yml` ships new images to the existing apps by manual dispatch with OIDC (no stored Azure secret). It has never run: no repository exists, and no apps exist. To set it up: create the repository and the GitHub environment `demo` (deployment branch: main only); run `deploy.ps1 -Action Deploy -WithWeb` once with `-GitHubOwner <owner> -GitHubOwnerId <id> -GitHubRepoId <id>` (`gh api repos/<owner>/bayan --jq '.owner.id, .id'`; a repository created after 15 July 2026 signs in with the immutable subject, which these ids build); set the variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` and `ACR_NAME` on the environment. The deployer identity is Contributor on Rishta Safe's own group, which holds everything.

## 9. What is unverified, in one list

- **That Azure will ever run Rishta Safe on this subscription.** App Service quota is 0 everywhere read (section 0, ADR 0187). Asking for quota on the portal Quotas page was not tried (a request, not a read).
- Everything after the plan exists: the two apps (managed-identity pull through `acrUseManagedIdentityCreds`, the health check, the `*.azurewebsites.net` addresses), AcrPush and AcrPull propagation, container logging, the first Warm and Smoke on Azure. The Bicep passed build, lint, ARM validate and what-if only.
- `az webapp` command shapes in `deploy.ps1` and `deploy.yml` (`webapp config set --linux-fx-version`, `webapp log config`, `webapp list` queries) were not run.
- **The web image does not build from the working tree as it stood earlier on 2026-11-20** (`pnpm install --frozen-lockfile` failed in a clean container on `frontend/pnpm-workspace.yaml`; the frontend lane is fixing it). It built from a patched copy: 98.7 MB, uid 1000, healthy, `/en`, `/ar`, `/ur` answered with `dir="rtl"` on the last two. Not re-tested against the fixed file.
- `deploy.yml` and the OIDC identity (section 8). `ci.yml` has not run on GitHub; its Bicep, compose and PowerShell-parse steps were run locally.
- The cost figures (section 7): list prices, fixed plan fee, remaining trial credit not read.
