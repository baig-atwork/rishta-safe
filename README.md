# Rishta Safe

A couple-result companion for the UAE premarital genetic screening pathway, built for the Abu Dhabi Future Health Digital Innovation Challenge (Challenge 03, Understanding and Reducing Inherited Disease Risk).

Rishta Safe asks each person how they want to meet a reported screening result before it shows it (read now, with a counsellor first, not yet, or not at all), then explains it in plain, non-stigmatising language, with both partners' languages side by side (English, with Arabic and Urdu drafts). It shows who may see what under each emirate's published disclosure rule, escalates by deterministic rule to a qualified human, follows the real pathway states and times, and closes the loop with a clinician proforma. Every number is measured on synthetic couples and carries its method and its limit.

**This is a prototype on made-up data.** It is not a medical device and not clinical advice. No clinical review, field validation or comprehension study has been done. Arabic and Urdu text is machine-drafted and awaits native clinical review. See `docs/open-risks.md` and `backend/src/bayan/data/declarations/limitations.md`.

## What is in the repository

| Path | What |
|---|---|
| `backend/` | FastAPI service (Python 3.13, uv, mypy strict). Packages: `genetics` (result engine, oracle, synthetic generator), `haem` (haematology aid), `governance` (consent ledger, disclosure policies, audit chain, escalation, refusals), `journey` (pathway state machine, referrals, closure, teach-back), `explain` (reviewed templates, glossary, checker), `evalkit` (scoreboard), `demo` (ten seeded synthetic couples), `api` (routers, wiring) |
| `frontend/` | Next.js 16 app in English, Arabic (right to left) and Urdu (right to left), in the Registry Grid design: a case bench, the threshold, read together, who sees what, a staff instrument and an Evidence page of live probes and the scoreboard (`docs/design/v2/`, ADR 0007). See `frontend/README.md` |
| `infra/` | Dockerfiles, Bicep, deployment scripts |
| `docs/` | Architecture brief, decision records (`docs/decisions`), runbook, design, submission drafts |

## Run it locally

```powershell
# backend (demo mode seeds ten synthetic couples and the personas; nothing is deployed anywhere, this runs locally)
cd backend
uv sync
uv run python -m uvicorn "bayan.api.app:create_app" --factory --port 8000

# frontend
cd frontend
pnpm install --frozen-lockfile
$env:BAYAN_API_URL = "http://127.0.0.1:8000"
pnpm dev

# or, with no backend, serve recorded fixtures
$env:BAYAN_MOCK = "1"
pnpm dev
```

The app opens on `http://localhost:3000` (`/ar` and `/ur` for Arabic and Urdu). Open the case bench at `/en/demo` and press "Open the flagship case".

## Check it

```powershell
cd backend
uv run pytest -q                        # full suite
uv run ruff check src tests scripts
uv run mypy
uv run python scripts/run_evaluation.py # regenerates the scoreboard artefact

cd ../frontend
pnpm typecheck; pnpm lint; pnpm test   # 417 unit tests (11 live tests skipped unless a backend is named)
pnpm build; pnpm test:e2e              # Playwright with axe, fixtures; pnpm test:e2e:real needs the backend running
```

Last run 2026-11-20 on the local machine: backend 516 tests, ruff and mypy strict clean; frontend typecheck and lint clean, 417 unit tests, 62 end-to-end tests passed (3 skipped) in mock mode and 63 passed (2 skipped) against the real backend; the 11 live-backend unit tests also pass. Automated axe checks pass on the routes the end-to-end suite visits; that is not an accessibility audit. Three routes are over the 170 KB route-JS budget (sharing 173.8, closure 188.3, clinician 190.7 KB gzip; `docs/open-risks.md`).

The judge scoreboard is `backend/src/bayan/data/scoreboard.json` (served at `/v1/eval/scoreboard`). The OpenAPI document is `backend/openapi.json` (`uv run python scripts/export_openapi.py`).

## Design rules in one paragraph

Three result labels only (shared result found, no shared change found on this test, more information needed); a detection rate instead of a residual-risk number; a variant of uncertain significance is never a result; a blood count alone never produces a carrier statement; no runtime language model; every clinical rule carries its source or is flagged illustrative and awaits sign-off; third-party content that is not commercially usable is not shipped. The decision records explain each call and each cut.
