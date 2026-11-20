# Parking lot

An index of things deferred or cut, one line each, never deleted. Format: `- WHAT | WHY PARKED | REVISIT WHEN`. Each cut also has its own ADR.

- Pakistan-variant adapter (national ID, home sample collection) | the UAE pathway is licensed-facility-only (ADR 0002) | a pilot partner outside the UAE exists
- Postgres adapter behind the repository interfaces | the demo keeps resettable in-memory state on synthetic data | any real or persisted data
- Native-speaker clinical review of Arabic and Urdu text | no reviewer in the build window | before any user-facing pilot
- Storybook 9 portable stories and Chromatic for the frontend | phase 1 is 80 minutes; component tests (LTR and RTL) and Playwright screenshots stand in (ADR 0165) | a second frontend developer joins or visual regressions start to slip
- Strict nonce-based Content-Security-Policy for the frontend | one inline theme-bootstrap script and a time box; baseline security headers are set (ADR 0165) | before any hosted pilot with real users
- Lighthouse CI budget gate (route JS 170 KB, LCP 2.5 s, CLS 0.1) wired in CI | measured locally only in phase 1 (ADR 0165) | the CI lane adds lhci against `pnpm start`
- Metric-matched fallback font overrides and `next/font` migration for the frontend | self-hosted `@font-face` chosen for offline builds and per-locale preload (ADR 0160) | `next/font/local` supports per-route unicode-range, or CLS regresses
- Zustand and nuqs in the frontend | no global client state or URL filter state exists yet (ADR 0165) | a filterable list or cross-page client state appears
- Configurable MCV cut-off, borderline HbA2, iron-first and transfusion-window parameters in the haematology rules | values are written into the rule conditions; the clinical lead has not chosen them (ADR 0104) | the clinical lead signs off the rules or a second laboratory needs different values
- Sex-aware X-linked pedigrees and endogamy (clan, village) in the synthetic generator | X-linked loci are dropped independently and founders are outbred (ADR 0103) | a statistician or clinician asks for them, or a real frequency table replaces the illustrative values
- Specialist-read haemoglobin pairings (Hb D-Punjab, Hb E, Hb Lepore, HbH) as automated rules | pairings range from benign to serious and need a specialist read (ADR 0100) | the clinical lead supplies a signed pairing table
- Statistician review of the correlated-miss closed form | residual.py is internal analysis only and unreviewed (ADR 0101) | before the form is quoted outside the evaluation report
- Strict reading of panel mismatch (any difference gives more information needed) | the engine compares covered loci and flags only unknown ones (ADR 0102) | the clinical lead chooses the stricter reading
- Real per-gene detection rates and carrier frequencies from the reporting laboratory | every panel rate is assumed and several frequencies illustrative (conditions.yaml, panels.yaml) | a laboratory supplies its panel content and detection rates
- Dedicated Container Apps environment for Rishta Safe, not shared with another project's environment | the Free Trial allows one environment and Rishta Safe joins the existing one (ADR 0181) | a second environment can be created (try UAE North first) or the other project on the subscription is torn down
- Key Vault references and managed-identity access for secrets | the session secret is a Container Apps secret and the data is synthetic (ADR 0184) | any real credential or non-synthetic data
- Private networking, WAF and rate limiting in front of bayan-web | public synthetic demo on a shared environment with no virtual network (ADR 0184) | any pilot with real users
- Image vulnerability scan, SBOM and provenance in CI | no scanner wired in the build window (ADR 0184) | the GitHub repository exists
- Playwright end-to-end job in CI | needs both processes and a browser and the suite is not final (ADR 0184) | the e2e suite is complete
- Coverage floor in CI | no measured baseline to derive a number from (ADR 0184) | after the first green CI run on GitHub
- pip-audit and pnpm audit in CI | pip-audit is not a dev dependency and the infra lane does not edit pyproject.toml (ADR 0184) | the controller adds it to the dev group
- Verify deploy.yml against GitHub and Azure (OIDC identity, join/action on the shared environment) | no repository or identity exists (ADR 0183) | the GitHub repository exists and the owner decides on the join grant
- uv 0.13.9 and commitizen v4.19.4 bumps | parity with the installed uv 0.13.7 and release age under two weeks (ADR 0184) | the next dependency sweep
- Care-team assignment removal, expiry and review | the prototype only adds assignments (ADR 0124) | a real staff directory exists
- Family cascade invitation and consent-based sharing with relatives | needs a delivery channel, a recipient identity and a legal read (ADR 0128) | the legal read of what an invitation discloses
- Durable consent and audit storage with an external head-hash anchor | in-memory by spec; tail truncation is undetectable alone (ADR 0125, 0129) | the Postgres adapter or any real deployment
- Art. 8 withdrawal data-deletion workflow | no stored data or samples in the prototype (ADR 0130) | any voluntary-screening or secondary-use feature with stored data
- Production auth (UAE PASS, SSO), token revocation, MFA, per-IP rate limits | simulated demo auth only (ADR 0120, 0131) | any non-demo deployment
- Native-speaker review and a semantic or transliteration-aware refusal classifier | keyword matching reached 61 percent held-out recall (ADR 0126, 0132) | a native reviewer and an evaluated self-hosted classifier
- Escalation queue resolution workflow (acknowledge, close, reassign) | the queue only lists open items | a counsellor console is built
- Pakistan-variant adapter (CNIC, nikah registrar, partner labs, home collection) | UAE screening is licensed-facility-only and home collection has no basis in either standard (ADR 0141) | a Pakistan-scale pilot with a cited source for the local flow
- Voice proforma and dictation | Gulf Arabic and Urdu-English speech error rates and no usable audio (ADR 0142) | consented native-dialect audio and a spike that passes key-term recall
- Standard patient instruments (DCS, DRS, GCOS-24) and validated Arabic or Urdu versions | licences and no translations found (ADR 0145) | written terms from the owners and a proper translation
- Human teach-back comprehension test | no ethics determination and no volunteers (ADR 0146) | a written ethics determination and recruited volunteers
- Structured detection rate and reasons in the contract so Arabic and Urdu need no English phrase | the contract has only a free-text label and no reasons field (ADR 0147) | the controller extends core/contracts.py
- Postgres adapter for the case store | the in-memory repository is enough for a resettable demo | any non-synthetic data
- Native clinical review of Arabic and Urdu explainer, glossary, closure and pathway text | no native clinical reviewer in the build window (ADR 0140) | a reviewer is found
- A hosting target for Rishta Safe that is not the existing shared environment | the Free Trial subscription is limited to one Container Apps environment in total and it is taken; uaenorth and germanywestcentral refused, westeurope not accepting new customers (ADR 0186) | the owner upgrades or adds a subscription, or picks App Service for Containers
- Private api behind the web app (virtual network integration, private endpoint or access restrictions to the plan outbound addresses) | App Service Basic has no private networking, so bayan-api is public, token-guarded and synthetic-only (ADR 0187) | any non-synthetic data or a Standard-tier plan
- Key Vault references for the api session secret on App Service | the secret is an encrypted app setting passed as a secure parameter (ADR 0184, 0187) | any real credential
- Lazy-load the form libraries (react-hook-form, zod/mini, resolver, TanStack Query) to bring sharing (173.8 KB), closure (188.3 KB) and clinician (190.7 KB) route JS under the 170 KB gzip budget | measured 2026-11-20 on the redesigned build; closure and clinician were already over before the redesign; Motion and Base UI are already removed (ADR 0166) | before the demo is judged on a throttled mobile profile, or when a lighter form stack is chosen
- Ask the pathway API for the page locale instead of mapping event codes in the frontend | the frontend maps pathway event codes to Arabic and Urdu messages and falls back to the API's English label, because the pathway call lives outside the frontend lane (ADR 0168) | the pathway call takes the locale, or the code mapping drifts from the backend
- A token-free demo persona list endpoint | `GET /v1/demo/personas` carries demo tokens, so the case bench and the Evidence page read it on the server and strip them (ADR 0174, 0176) | the backend adds a persona listing without tokens
- Native review of the Arabic and Urdu interface copy of the screens added on 2026-11-20 (threshold, read together, who-sees-what matrix, case bench, Evidence labels) | no native clinical reviewer in the build window (ADR 0007, 0140) | a reviewer is found, before any user-facing pilot
- Translated evidence figures and staff rule text | the scoreboard and the staff brief's rule text are API data that exist only in English, marked as English on the Arabic and Urdu pages (ADR 0169) | the scoreboard and rule text get reviewed translations
- Record the "read now", "counsellor first" and "not yet" threshold choices on the server | only "I prefer not to know" is recorded (it is the right Art. 9(2) names); the others are browser-only by design (ADR 0170) | a product decision that the choices should follow a person across devices, with the consent and audit design that implies
- Point `design:lint` in `frontend/package.json` at `docs/design/v2/DESIGN.md` | the script still lints the superseded `docs/design/DESIGN.md`, and documents may not edit `package.json` | the next frontend change
- Deploy Rishta Safe anywhere | nothing is deployed; every create attempt was refused (ADR 0185 to 0187, `docs/deployment-status.md`) | the owner chooses one of the routes in `docs/deployment-status.md`

## Rename of internal identifiers (ADR 0227)

- **What:** the Python package `bayan` and its imports, the `BAYAN_*` environment variables, cookie and local-storage keys, Azure and container resource names, image tags, the repository folder name.
- **Why parked:** none is visible to a user, the deck or the video, and a wide rename two hours before the deadline risks the build.
- **When to revisit:** right after submission, in one reviewed change with the full suite and the end-to-end run.
