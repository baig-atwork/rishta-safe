# 0167: An anti-corruption layer between the real backend and the UI types

Status: accepted (2026-11-20). Lane D (frontend, phase 2).

## Context

Phase 1 built every screen against typed fixtures (`src/lib/api/types.ts`). The real backend published a different but richer contract (`backend/openapi.json`, 35 paths): persona tokens nested under `token.access_token`, a pathway with `steps` and `next_actions`, a result envelope `{couple_id, locale, disclosed, document}`, consent records with a closed list of purposes, audit events with `outcome` and tuple details, a reduced chain verification for couple members, a haematology aid that needs age, transfusion and laboratory flags, a different closure schema and a teach-back with `items`.

## Decision

Translate at one boundary, on the server, in the real-mode branch of `callBackend()` (`src/lib/api/upstream.ts`): `src/lib/api/real/adapter.ts` (`toBackendRequest`, `fromBackendResponse`, `normalizeProblem`, `companionRequests`) with per-area modules (`pathway`, `closure`, `haem`), response validation against the generated OpenAPI types (`schema.d.ts`, `pnpm gen:api`) and runtime schemas (`schemas.ts`), and an `AdapterError` turned into a 502 problem when the backend answers in a shape the app does not understand. Components keep depending on the UI types; the mock branch is untouched. Where the real data cannot fill a UI field the adapter takes a documented, safe default marked `// GAP:` (`grep -rn "GAP:" src/lib/api/real`); it never invents clinical content or numbers.

The UI changed only where the real contract demands input the fixtures did not: the haematology aid asks the closed questions the aid needs (every choice list starts at "Not answered" and an unanswered question is not sent), the consent form offers the five purposes the backend accepts, the plan owner in the proforma is a select, teach-back sends its locale, the programme page shows the real KPI detail.

## Known gaps (all visible in code)

Panel id is "default"; statutory-obligation consent rows are hidden from the ledger; escalation reasons are the backend's reason keys as words and the couple label is the couple id; the brief has no timestamp (request time is used); a null brief priority shows as routine and a null category as "more information needed"; the programme KPI has no per-state breakdown; the optional literacy stratifier is not offered; "yes, later" defaults to the shortest reminder interval the server offers; the pregnancy flag is not sent when a result is communicated; numeric ferritin and RBC are not sent to the haematology aid (it takes the laboratory's flag).

## Consequences

Phase 2 is verified live: 11 live tests against the running backend, and the Playwright suite (axe, three locales) passes against it with `pnpm test:e2e:real`. A backend contract change surfaces as a failing adapter test or a 502 problem with a correlation id, not as a broken screen. Fixture mode (`BAYAN_MOCK=1`) stays for offline demos and must not be enabled in a deployed image: neither `BAYAN_MOCK` nor `NEXT_PUBLIC_BAYAN_MOCK` may be set there.

## Addendum (2026-11-20, review fixes)

- The result page prints only what the document says: the localised detection sentences are in `document.blocks`, so the limits box built from `disclosed.detection[].detection_rate_label` (English) was removed; a test fails if an English label sentence appears on the ar or ur page. Draft status is one chip, the boundary notice once at the top, closing statements once at the end, and the glossary lists only `document.glossary_keys`.
- The couple home headline is the next main-path step; events that record a different turn (partner declined, counselling declined or missed, referral rejected) sit in a collapsed demo list and are offered only to roles the API lists for them; when the role may record nothing, the card says whose turn it is.
- Queue: rules inside a row are ordered by `due_by_hint` (immediate, same_session, fast_track, routine), the chip is Urgent only for `immediate`, rows sort by priority, top hint, then age. Backend findings, not fixed here: reading `GET /v1/couples/{id}/brief` appends an escalation record, so the queue grows with every brief view (one row per couple is therefore merged in the adapter; an earlier design that read eight briefs per queue view grew the queue to about 14,000 records and was removed); and `pregnancy_in_progress` has the same hint (`fast_track`) as `shared_result` in `escalation_rules.yaml`, so no data ranks it first.
