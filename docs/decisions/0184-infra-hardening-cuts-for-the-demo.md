# ADR 0184: Infrastructure hardening that the demo does not get (cuts)

- **Status:** Accepted (infra lane). Each cut is also one line in `docs/parking-lot.md`.
- **Date:** 2026-11-20
- **Deciders:** the infra lane
- **Supersedes / superseded by:** none
- **Evidence:** the build window is about an hour of preparation before a same-day deadline; the data is synthetic ([ADR 0182](0182-in-memory-state-for-the-demo-single-replica.md)); the product holds no real or personal data.

## Cuts
1. **Key Vault references and managed-identity access to secrets.** The one secret (the session secret) is a Container Apps secret passed as a secure Bicep parameter, so Azure redacts it from the deployment history (the runbook has a one-line check). Any real credential or real data changes this.
2. **Private networking, a web application firewall and request rate limiting in front of `bayan-web`.** The demo is public by design and holds made-up data. The environment is shared and has no virtual network ([ADR 0181](0181-join-the-existing-container-apps-environment.md)); there is none to add.
3. **Image vulnerability scanning, SBOM and provenance in CI.** No scanner is wired. The images are small (the api image is 76 MB on disk) and built from digest-pinned bases, with no package manager at run time, but nothing proves it. The sibling project's trivy scan found HIGH and CRITICAL findings in comparable images.
4. **A Playwright end-to-end job in CI.** It needs both processes and a browser, and the suite is not final. `ci.yml` builds and starts both images and answers the landing page.
5. **A coverage floor in CI.** No baseline exists to derive a number from, and an invented threshold is worse than none. `ci.yml` reports coverage and keeps the report.
6. **Dependency vulnerability audit (pip-audit, pnpm audit) in CI.** `pip-audit` is not a dev dependency, and the infra lane may not edit `pyproject.toml`.
7. **A staging environment and blue-green or canary deployment.** Single-revision mode keeps the old revision serving until the new one is ready; that is the whole rollout story.
8. **A budget alert.** A subscription budget needs a contact address and a start month; the Free Trial credit and its spending limit already cap the loss. The runbook has Ali check Cost Analysis after 24 to 48 hours.
9. **Tool bumps of one patch level:** uv 0.13.9 (released 2026-11-17) and commitizen v4.19.4 (released 2026-11-19) are not taken; parity with the controller's installed uv 0.13.7 and a two-week release age come first.

## Amendment 2026-11-20 (own environment)
Cut 2 said the environment is shared and has no virtual network. Rishta Safe now has its own environment ([ADR 0185](0185-bayan-gets-its-own-container-apps-environment.md)); it still has no virtual network, WAF or rate limiting, so the cut stands. Cut 8 (budget alert) is unchanged.

## Consequences
Each cut has a revisit trigger in the parking lot. None of them touches the data or the claims the product makes.

## Revisit trigger
The GitHub repository exists; any non-synthetic data; a pilot.

## Links
[ADR 0182](0182-in-memory-state-for-the-demo-single-replica.md) · [0183](0183-deploy-from-the-laptop-github-workflow-unverified.md)
