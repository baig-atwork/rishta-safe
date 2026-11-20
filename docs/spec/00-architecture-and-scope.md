# Rishta Safe: architecture, scope and rules of the build (2026-11-20)

Read this whole file before writing anything. It is the contract between the lanes. Written by the controller.

## 1. What Rishta Safe is

A **couple-result companion for the UAE premarital genetic screening pathway** (Hack2skill / Abu Dhabi Future Health Challenge, Challenge 03, "Understanding and Reducing Inherited Disease Risk"). It explains a *reported* screening result in plain, non-stigmatising language (English, Arabic draft, Urdu draft), shows who can see what under each emirate's disclosure rule, escalates by deterministic rule to a qualified human, follows the real pathway states and times, and closes the loop with a clinician proforma. Every number is measured on synthetic couples. It is a prototype on made-up data. It is **not** a medical device, not a diagnosis, not clinical advice.

Positioning against 14 rival repos (four use private set intersection, so PSI is out): we win on (A) a pathway-faithful design taken from the two primary standards, (B) traceable haematology-first interpretation as a clinician-facing aid with every rule gated on clinical sign-off, (C) measured safety: oracle agreement, escalation recall, disclosure property tests, numeric fidelity. We do not claim clinical review, field validation or real patient data. Ever.

Research (read the parts for your lane; paths are absolute):
- `D:\dev\future-health-challenge\research\ch03\99-synthesis-and-scope.md` (read first, all lanes)
- `...\01-hemoglobinopathy-screening-logic.md` and `01-rules-draft.yaml` (haem rules, 24 rules, 20 fixtures)
- `...\02-uae-premarital-pathway.md` (DoH Abu Dhabi V3, DHA Dubai V1: forms, states, times, disclosure rules, wording)
- `...\03-risk-stratification-method.md`, `03-calc-gene-dropping-checks.py`, `03-calc-inbreeding-and-panel-demo.py` (result categories, correlated miss, escalation triggers)
- `...\04-closure-instruments-and-evaluation.md` (12-field proforma, eight original items, evaluation design)
- `...\05-local-models-voice-and-explainer.md` (templates + glossary + numeric/polarity checker; no runtime LLM)
- `...\06-rivals-deep-read.md` (what rivals do)
- The research dossier "03 Understanding and Reducing Inherited Disease Risk" (kept outside the repository) (dossier: law mapping Decree-Law 49/2023 in section 3.3, requirements in section 2, privacy options)

## 2. Hard rules (non-negotiable; a violation is a defect)

1. **Synthetic data only.** No real names, IDs, results, hospital data. Demo people have made-up names. Say "synthetic" where data is shown.
2. **No clinical claims.** Every clinical rule, cut-off, detection rate and Arabic/Urdu string carries a status: `needs_clinician_signoff: true` and (for text) `language_status: draft`. The UI shows this status. Never write "clinically reviewed", "validated", "approved by" anyone. Never name any individual (developer, clinician, consultant) anywhere in code, data, docs or UI. The clinical owner is called "the clinical lead (sign-off pending)".
3. **Clinical content only from cited published text.** Every threshold, frequency or rate has a `source:` (title, year, URL or DOI) and the exact table or wording it came from, or it is flagged `illustrative: true` and shown as "illustrative" in the UI. Never write a clinical number from memory. If you cannot source it, mark it illustrative and say so.
4. **Closed result vocabulary.** The only result labels shown to a couple are `shared_result_found`, `no_shared_change_found`, `more_information_needed` (see `core/contracts.py`). Banned in any user-facing string: compatible, incompatible, pass, fail, no risk, safe, high risk, moderate risk, low risk, "you should", "you must not", "proceed with the marriage", "cancel". The explainer's checker enforces a banned-word list in all three languages.
5. **No runtime LLM.** Text comes from reviewed templates and a glossary. A cloud LLM may have helped draft static template text at authoring time (declared in the data declaration); no personal or realistic couple data ever went to it.
6. **No marriage-decision field**, no points score, no pre-test numeric risk by default (config flag off), no residual-risk number: show *detection rate and its limits*. For related couples a negative test does not shrink the chance the way independent partners would (misses are shared by descent; research 03 shows a 16x to 60x understatement for the naive update); the product says so and does not display a residual figure.
7. **Never claim integration** with Emirates Health Services, Malaffi, the Emirati Genome Programme, DoH or DHA. All adapters are simulated and labelled "simulated".
8. **Never ship third-party content that is not commercially usable.** AVDB (all rights reserved), Jain et al. supplement (CC BY-NC-ND), GeneReviews, OMIM, DCS/DRS/GCOS-24/MMIC/NVS instruments are NOT shipped. Facts (numbers with a citation) may be quoted; tables may not be copied. The panel table in `data/panels.yaml` is small, hand-written, every row cited or illustrative.
9. **Statutory fidelity.** Decree-Law 49/2023: the state is a statutory recipient (Art. 26(2)); each person may request their own results (Art. 9(1)); right not to know (Art. 9(2)); employers and insurers may not require or use results (Art. 19 to 21); no ancestry or lineage inference (Art. 9); no publishing programme statistics (Art. 25(3)): never generate or show "national statistics". The product never claims to hide data from the state. Mandatory couple screening is not consent-based (Art. 4(2)(a), 15); voluntary and secondary uses and sharing are consent-based.
10. **Boundary label.** Every result screen states the boundary: education, decision support, never clinical advice; complex or high-impact findings go to an accredited professional.
11. **Production-team standard.** Python 3.13, mypy strict, ruff, pytest, structlog, typed Pydantic v2, no `Any` leaks, no bare `except`, errors as RFC 9457 problem details. TypeScript strict. WCAG 2.2 AA. i18n from line 1 (en, ar RTL, ur RTL). No hex in JSX; tokens only.
12. **Git: you do not run git.** The controller commits. Do not stash, reset, rebase, checkout. Do not edit files outside your lane (section 5). Do not edit `pyproject.toml` or `uv.lock` (no new dependencies; ask in your report). Do not run `uv add`, `pnpm add` outside the frontend lane. The frontend lane owns `frontend/`.
13. **Every cut gets an ADR.** If you cut or defer something, add `docs/decisions/NNNN-title.md` using your assigned number block (section 5) and one line to `docs/parking-lot.md` (append only, one line, format: `- WHAT | WHY PARKED | REVISIT WHEN`). Never delete.
14. **Be corrected, not obeyed.** If anything in this brief is wrong or contradicts a source, say so in your report and do the sourced thing.
15. **Report format:** at most 250 words: files written, tests run with exact pass counts, what you could not do, anything you changed in the contract. Do not paste code in the report.

## 3. Architecture

Monorepo `D:\dev\bayan`: `backend/` (FastAPI, `src/bayan/...`), `frontend/` (Next.js 16), `infra/` (Bicep, scripts), `docs/`.

The backend is pure-domain packages plus a thin HTTP layer. State is in memory behind small repository classes (adapter pattern: a Postgres adapter is a parked ADR); the demo is resettable and seeded.

```
bayan/core        shared types and contracts (controller-owned): types.py, contracts.py, errors.py, clock.py, config.py
bayan/genetics    engine: panels/conditions catalogue, couple result (Mendelian states), detection statements, synthetic generator, oracle checks
bayan/haem        haematology aid: CBC then HPLC, closed vocabulary, rules loaded from data/haem_rules.yaml with sources
bayan/governance  principals and demo auth, consent ledger, disclosure policies (abu_dhabi, dubai), hash-chained audit, third-party refusals, escalation library
bayan/journey     couple case record, pathway state machine and KPIs, referral tasks (FHIR-Task-shaped), closure (clinician proforma, patient items, service-interest), teach-back
bayan/explain     reviewed templates and glossary in en/ar/ur, renderer, numeric and polarity checker, banned-word guard
bayan/evalkit     evaluation harness and scoreboard (phase 2)
bayan/demo        seeded synthetic cases (phase 2)
bayan/api         app factory, deps, routers (each lane owns its routers)
bayan/data        YAML data files (each lane owns its files)
```

### 3.1 Public functions each lane must expose (exact names, so lanes compose)

**genetics** (`bayan/genetics/service.py`)
```python
class GeneticsService:
    def compute_couple_result(self, couple_id: str, reports: Sequence[PersonReport], relationship: Relationship) -> CoupleResult
    def catalogue(self) -> ConditionCatalogue            # conditions: id, gene, name_en, inheritance, severity_tier, source
    def panel(self, panel_id: str) -> PanelInfo           # genes covered, assumed detection rate with source or illustrative flag
    def detection_statements(self, panel_id: str, relationship: Relationship) -> tuple[DetectionStatement, ...]
def build_genetics_service() -> GeneticsService
```
Plus `bayan/genetics/synthetic.py`: `generate_couples(n, seed, mix) -> list[SyntheticCouple]` (gene dropping through defined pedigrees with ground truth) and `bayan/genetics/oracle.py` (independent closed-form couple classification used by tests). `bayan/haem/service.py`: `HaemService.interpret(cbc: CbcInput, hplc: HplcInput | None) -> HaemInterpretation` (label from `HaemLabel`, rule trace, flags, `needs_clinician_signoff`, sources); `def build_haem_service() -> HaemService`.

**governance** (`bayan/governance/service.py`)
```python
class GovernanceService:
    # auth (simulated OTP; demo tokens) 
    def request_otp(self, channel: Literal["email","mobile"], target: str) -> OtpChallenge       # demo returns the code in the response, flagged simulated
    def verify_otp(self, challenge_id: str, code: str) -> SessionToken
    def issue_demo_token(self, principal: Principal) -> SessionToken
    def authenticate(self, token: str) -> Principal
    # consent ledger
    def grant(self, couple_id: str, subject_person_id: str, recipient_role: Role | str, scope: ConsentScope, purpose: str, expires_at: datetime | None) -> ConsentRecord
    def revoke(self, consent_id: str, by: Principal) -> ConsentRecord
    def consents(self, couple_id: str) -> tuple[ConsentRecord, ...]
    # disclosure
    def disclose(self, principal: Principal, couple_id: str, result: CoupleResult, reports: Sequence[PersonReport], policy: Emirate) -> DisclosedResult
    # audit
    def audit_events(self, couple_id: str | None = None) -> tuple[AuditEvent, ...]
    def verify_audit_chain(self) -> AuditVerification     # ok, length, head_hash, first_bad_index
    # third-party requests (employer, insurer, relative): refused and logged
    def third_party_request(self, requester: Principal, couple_id: str, kind: str) -> NoReturn   # raises Forbidden after logging
    # escalation
    def evaluate_escalation(self, ctx: EscalationContext, result: CoupleResult) -> tuple[EscalationDecision, ...]
def build_governance_service(clock: Clock, settings: Settings) -> GovernanceService
```
`ConsentScope` (enum): `couple_result_only`, `gene_names_only`, `full_variant_detail`. Audit events are append-only and SHA-256 hash-chained (each event stores `prev_hash`, `hash`; the canonical JSON serialisation is documented). `DisclosedResult` is defined in `core/contracts.py` (see 3.2).

**journey** (`bayan/journey/service.py`)
```python
class JourneyService:
    def create_case(self, intake: IntakeInput) -> CoupleCase
    def get_case(self, couple_id: str) -> CoupleCase
    def store_reports(self, couple_id: str, reports: Sequence[PersonReport]) -> None
    def reports(self, couple_id: str) -> tuple[PersonReport, ...]
    def pathway(self, couple_id: str) -> PathwayView          # states with timestamps, SLA status, next actions, KPI
    def advance(self, couple_id: str, event: PathwayEvent, actor: Principal) -> PathwayView
    def referral_tasks(self, couple_id: str) -> tuple[ReferralTask, ...]    # FHIR Task shaped, simulated
    def closure_schema(self) -> ClosureSchema
    def submit_patient_closure(self, couple_id: str, person_id: str, answers: ClosureAnswers) -> ClosureRecord
    def submit_clinician_proforma(self, couple_id: str, proforma: ClinicianProforma, actor: Principal) -> ClosureRecord
    def teachback(self, couple_id: str, locale: Locale) -> TeachBackQuiz; def submit_teachback(...) -> TeachBackResult
    def kpis(self) -> ProgrammeKpis
def build_journey_service(clock: Clock) -> JourneyService
```
**explain** (`bayan/explain/service.py`)
```python
class ExplainService:
    def render(self, disclosed: DisclosedResult, locale: Locale) -> ExplainerDoc    # raises RuleViolation if the checker fails
    def check(self, doc: ExplainerDoc, disclosed: DisclosedResult) -> CheckReport    # numeric fidelity, polarity, banned words
    def glossary(self, locale: Locale) -> tuple[GlossaryEntry, ...]
    def options_pane(self, locale: Locale) -> ExplainerDoc       # neutral order, article citations (Art. 11, 12), right-not-to-know
def build_explain_service() -> ExplainService
```

### 3.2 Contracts owned by the controller (`core/contracts.py`, `core/types.py`)
`Finding, PersonReport, ResultCategory, ReviewPriority, OutcomeLine, SharedCondition, DetectionStatement, CoupleResult, HaemLabel` exist. Two more are added to `core/contracts.py` by the controller **before you start**: `DisclosedResult` (what a given viewer may see, produced by governance) and `ExplainerDoc` (blocks plus the numbers it used, produced by explain). Read them in the file. Do not redefine them.

### 3.3 API surface (`/v1`, JSON, RFC 9457 errors; each lane writes its own routers)

Auth is a bearer token (demo). `GET /v1/demo/personas` lists seeded personas with ready tokens (demo mode only).

| Area | Endpoints | Lane |
|---|---|---|
| auth | `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify`, `GET /v1/auth/me` | governance |
| demo | `GET /v1/demo/personas`, `POST /v1/demo/reset`, `GET /v1/demo/cases` | composition (phase 2) |
| cases | `POST /v1/couples`, `GET /v1/couples/{id}`, `GET /v1/couples` (staff) | journey |
| pathway | `GET /v1/couples/{id}/pathway`, `POST /v1/couples/{id}/pathway/events`, `GET /v1/couples/{id}/referrals`, `GET /v1/programme/kpis` | journey |
| haem aid | `POST /v1/haem/interpret`, `GET /v1/haem/rules` | genetics |
| reports/result | `PUT /v1/couples/{id}/reports`, `GET /v1/couples/{id}/result?locale=` (disclosure-filtered, rendered), `GET /v1/couples/{id}/result/raw` (staff) | composition (phase 2) |
| catalogue | `GET /v1/catalogue/conditions`, `GET /v1/catalogue/panels` | genetics |
| consent | `GET/POST /v1/couples/{id}/consents`, `POST /v1/consents/{id}/revoke` | governance |
| audit | `GET /v1/couples/{id}/audit`, `GET /v1/audit/verify` | governance |
| third party | `POST /v1/third-party-requests` (always 403 + logged) | governance |
| escalation | `POST /v1/couples/{id}/escalations/evaluate`, `GET /v1/escalations` (counsellor queue), `GET /v1/couples/{id}/brief` | governance + composition |
| explain | `GET /v1/explain/glossary?locale=`, `GET /v1/explain/options?locale=` | explain |
| closure | `GET /v1/closure/schema`, `POST /v1/couples/{id}/closure/patient`, `POST /v1/couples/{id}/closure/clinician`, `GET/POST /v1/couples/{id}/teachback` | journey |
| judge | `GET /v1/eval/scoreboard`, `GET /v1/governance/declarations` (data declaration, limits, prior art, ADR list) | composition (phase 2) |
| health | `GET /healthz`, `GET /readyz`, `GET /version` | composition |

Routers are modules `bayan/api/routers/<name>.py` exposing `router: APIRouter` and importing the service from `request.app.state.<lane>` (`genetics`, `governance`, `journey`, `explain`). Response models are Pydantic classes in the lane's own package (so OpenAPI is complete). The controller's `api/app.py` mounts every router it finds.

## 4. Seed demo cases (phase 2 builds them; lanes should keep them in mind for fixtures)

Synthetic couples that must exist and that each exercise a different branch: (1) unrelated, no shared change found; (2) related (first cousins), both carriers of one recessive condition: shared result found; (3) related, nothing found on this panel, with the related-couple caveat shown; (4) alpha-thalassaemia carrier pair; (5) one partner affected (compound), other a carrier: urgent review; (6) X-linked carrier female; (7) variant of uncertain significance: more information needed, never a result; (8) one partner declines to share (the certificate-refusal tension, Abu Dhabi and Dubai policies differ); (9) pregnancy in progress with a shared result: escalation; (10) a CBC-only work-up, never a carrier statement.

## 5. Lanes, ownership and ADR number blocks (do not cross)

| Lane | You own | ADR numbers |
|---|---|---|
| A genetics+haem | `backend/src/bayan/genetics/**`, `backend/src/bayan/haem/**`, `backend/src/bayan/data/{panels,conditions,haem_rules}.yaml`, `backend/src/bayan/api/routers/{catalogue,haem}.py`, `backend/tests/genetics/**`, `backend/tests/haem/**` | 0100 to 0119 |
| B governance | `backend/src/bayan/governance/**`, `backend/src/bayan/data/{consent_policies,escalation_rules}.yaml`, `backend/src/bayan/api/routers/{auth,consent,audit,third_party,escalation}.py`, `backend/tests/governance/**` | 0120 to 0139 |
| C journey+explain | `backend/src/bayan/journey/**`, `backend/src/bayan/explain/**`, `backend/src/bayan/data/{pathway,closure,templates,glossary}*.yaml`, `backend/src/bayan/api/routers/{couples,pathway,closure,explain}.py`, `backend/tests/journey/**`, `backend/tests/explain/**` | 0140 to 0159 |
| D frontend | `frontend/**`, `docs/design/**` | 0160 to 0179 |
| E infra | `infra/**` (including `infra/docker/backend.Dockerfile` and `infra/docker/frontend.Dockerfile`, built with the repo subfolder as context), `.github/**`, `.pre-commit-config.yaml`, `docker-compose.yml`, `docs/runbook.md` | 0180 to 0199 |
| controller | `core/**`, `api/app.py`, `api/deps.py`, `pyproject.toml`, `docs/spec/**`, `docs/decisions/README.md`, `README.md`, `docs/parking-lot.md` (others append one line only) | 0001 to 0099 |

Tests: each lane runs `cd D:\dev\bayan\backend && uv run pytest tests/<lane> -q`, `uv run ruff check src tests`, `uv run mypy` (whole package; if another lane's file breaks mypy, report it, do not fix it). Hypothesis is available for property tests. Data files are loaded by `importlib.resources`/relative `Path(__file__)` lookups from `bayan/data/`.

## 6. Quality bar for "done" per lane

Typed, tested (unit plus at least one oracle or property test where the lane has logic), every rule and datum sourced or flagged illustrative, no placeholder or TODO code, no hard-coded strings in the explain lane outside the YAML templates, errors as typed exceptions. Include a short `README.md` at the root of your package (what, how to run its tests, data sources and licences, known limits).

## 7. As built (2026-11-20, controller note)

The table in section 3.3 is the plan. The built surface is `backend/openapi.json` (40 paths). Differences worth knowing: composition routes (`result`, `demo`, `judge`) were added by the controller (`PUT /v1/couples/{id}/reports`, `GET /v1/couples/{id}/result`, `GET /v1/couples/{id}/result/raw`, `POST /v1/couples/{id}/result/communicate`, `GET /v1/couples/{id}/brief`, `/v1/demo/*`, `/v1/eval/scoreboard`, `/v1/governance/declarations`); governance added assignment, right-not-to-know and refusal-classifier routes (ADR 0133); `GET /v1/audit/verify` returns a reduced answer to a couple member; reading a brief is audited but never enqueues an escalation. Couple-scoped routes use `assert_couple_access` (member: own couple; counsellor and clinician: assigned couples; judge: read only; programme and outside parties: none).

**Frontend v2 (2026-11-20).** The interface was rebuilt on the branch `v2-registry-grid` (ADR 0007; `docs/design/v2/`) on existing endpoints, with no new backend route. The look is Registry Grid (a dark ink hero, cool mineral-white pages, one lapis accent, a tally grid of square cells as the signature element); the old "Lineage Folio" look is retired. The UX model replaces the persona picker: a case bench of the ten seeded cases crossed with role lenses; a threshold in which each person chooses how to meet a result before it is rendered, with "prefer not to know" recorded on the server through `PUT` and `DELETE /v1/couples/{id}/right-not-to-know` (Art. 9(2)) and the other choices kept in the browser (ADR 0170); the result read together in both partners' languages from two `?locale=` calls (ADR 0171); who sees what as a visibility matrix whose fixed columns are set by law and whose changes each write an audit row (ADR 0172); an Evidence page of seven live probes and the scoreboard (ADR 0174); and a staff instrument of queue, brief and trace (ADR 0178). The hard rules in section 2 are unchanged. Demo data changed with it: the ten seeded couples were renamed and case 2's shared gene is USH2A, not CYP21A2 (ADR 0008); user-visible citation strings cite public sources only (ADR 0009); listing the demo personas writes no audit rows. Arabic and Urdu text of the new screens is draft, and the evidence figures and staff rule text are English only and marked so (ADR 0169).
