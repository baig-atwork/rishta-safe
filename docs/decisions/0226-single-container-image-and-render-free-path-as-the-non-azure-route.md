# ADR 0226: A single-container image and a Render free-tier blueprint are the non-Azure route to a public demo

- **Status:** Accepted as a prepared option. **Nothing is deployed.** Using it needs the owner's own hosting account and a decision on how the code reaches the host.
- **Date:** 2026-11-20
- **Deciders:** the controller, after the owner reported that a second Azure account has no free credits
- **Supersedes / superseded by:** adds to [0185](0185-bayan-gets-its-own-container-apps-environment.md) to [0187](0187-app-service-for-containers-and-its-quota-refusal.md); does not replace the Azure Bicep, which stays as it is.

## Context
Every Azure route was refused on the Free Trial subscription (ADRs 0186 and 0187), and a second account has no free credits. The submission's weakest point is that there is no public URL (`docs/submission/judging-map.md`). Free container hosts give one sleeping service, not a two-service stack with a private network. Primary-source checks on 2026-11-20 (vendor documentation; the Render pages were unreachable from the fetcher, so Render rests on its own tutorial text and its published blueprint schema, both read from this machine):

| Host | Finding | Fit |
|---|---|---|
| Render free web service | sleeps after 15 minutes idle; about one minute to wake; 512 MB; 750 instance hours a workspace a month; Render's tutorial says free resources need no payment; regions oregon, ohio, frankfurt, singapore, virginia | fits one service; no card expected (to be seen in the signup flow) |
| Koyeb free instance | one service, 0.1 vCPU, 512 MB; its documentation says a card is required; free instances are excluded from the private network; Frankfurt or Washington only | does not fit two services; card |
| Google Cloud Run | a billing account (card) is required for the free tier; Doha, Dammam and Tel Aviv exist, no UAE region | card |
| Fly.io | no free tier (a seven-day trial credit, then a card) | no |
| Railway free plan | about USD 1 of usage a month, regions chosen by Railway | too small |
| Vercel-style serverless | the demo keeps its state in memory (ADR 0182), so a serverless host loses it between calls | no |

## Decision
1. Build one image that runs both halves (`infra/docker/combined.Dockerfile`, entrypoint `infra/docker/combined.entrypoint.py`). The API listens on 127.0.0.1 inside the container and is never published; the web server listens on `$PORT`. The entrypoint starts the web server only after the API reports healthy, and stops both if either dies. It uses the same pinned bases and build steps as the two existing Dockerfiles, which stay unchanged for compose and Azure.
2. Add `render.yaml`: one free web service in `frankfurt`, the nearest region Render offers to the UAE, built from that Dockerfile with the repository root as context, no automatic deploys, a generated session secret. It validates against Render's published schema.
3. Wording: a demo on this route is **not** described as hosted in the UAE. Its region is stated as Frankfurt, once it exists and the Render dashboard shows it. ADR 0220 still governs: no hosting sentence until a real URL has printed a real region.
4. The Azure Bicep, `deploy.ps1` and the runbook's Azure sections are unchanged and remain the design target for a UAE North deployment.

## Consequences
- One service means one cold start of about a minute after 15 minutes without traffic, and in-memory state (consent choices, audit rows made during a visit) resets on every sleep or restart. The demo reseeds itself, so this loses nothing that matters, but a judge's first load can be slow. Warm it before a review and say so on the demo link.
- Measured locally on 2026-11-20 with the container capped at 512 MB: healthy in about 9 seconds, 147 MiB in use after loading pages and running the employer-refusal probe, no out-of-memory kill, API not reachable from the host, image 578 MB.
- **Not measured:** the build time and build memory on Render's free build machines (a Next.js 16 build plus the Python install). If the free build fails, the fallback is to build the image locally and let Render pull it from a registry.
- Delivering the code to Render needs either a Git repository the host can read (private is enough) or a pushed image. Both publish code outside this machine, so they wait for the owner. A repository push must follow the history rewrite, because two old commits still contain real-name test strings (they are scrubbed at HEAD).
- `render.com` itself reset connections intermittently from this network, while the dashboard and API hosts answered; judges' networks are not ours.

## Revisit trigger
The owner secures a pay-as-you-go Azure subscription (then ADR 0185's own-environment path in UAE North is the better route, and the in-UAE claim can be made after verification), or Render's free tier changes.
