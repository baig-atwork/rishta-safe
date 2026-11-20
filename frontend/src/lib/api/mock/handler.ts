/**
 * In-process MOCK backend for the Rishta Safe prototype (synthetic data only, simulated adapters, not a medical device).
 *
 * `handleMock` answers every endpoint in ../endpoints.ts with the exact shapes in ../types.ts. State lives on
 * `globalThis` under one typed key, so route handlers and server components share a single store in dev and in
 * production; `resetMock` drops it and the next call rebuilds it from the factories in ./fixtures.
 *
 * Rules enforced here (spec section 2): closed result vocabulary, disclosure by consent ledger and emirate policy,
 * a REAL SHA-256 hash chain for the audit log, third-party requests always refused and logged, RFC 9457 problem
 * details for every error. Server-only: it uses node:crypto.
 *
 * Audit canonical form (documented so verification is reproducible): the JSON text of an object whose keys are, in
 * this order and with no whitespace, index, event_id, at, actor_role, actor_id, action, couple_id, detail,
 * prev_hash. The event hash is the lower-case hex SHA-256 of that text encoded as UTF-8; the first event's
 * prev_hash is 64 zeros.
 */

import { createHash, randomBytes } from "node:crypto";

import type {
  AuditEvent,
  AuditVerification,
  ClinicianProformaInput,
  ClosureRecord,
  ConsentRecord,
  ConsentScope,
  CoupleCase,
  CounsellorBrief,
  DisclosedResult,
  EscalationItem,
  Finding,
  HaemInterpretation,
  HaemLabel,
  HaemRuleStep,
  HaemSource,
  Locale,
  PathwayView,
  Persona,
  ProblemDetails,
  ProgrammeKpis,
  ReferralTask,
  ResultEnvelope,
  ReviewPriority,
  Role,
  TeachBackResult,
} from "@/lib/api/types";

import {
  COUNSELLING_TASK_SUFFIX,
  FIXTURE_NOW,
  GENESIS_HASH,
  ILLUSTRATIVE_SOURCE_TITLE,
  PATHWAY_EVENT_BY_STATE,
  PATHWAY_STATE_KEYS,
  TIMED_STATES,
  isoFromMs,
  makeAuditSeeds,
  makeClosureSchema,
  makeConsentSeeds,
  makeCoupleModels,
  makeEscalationDecision,
  makeEscalationSeeds,
  makeGlossary,
  makeOptionsDoc,
  makePathwayViews,
  makePersonas,
  makeReferralTasks,
  makeResultDoc,
  makeScoreboard,
  makeTeachBackQuiz,
  maxPriority,
  nextActionFor,
  teachBackExplanations,
  teachBackKey,
  type AuditSeed,
  type CoupleModel,
  type EscalationSeed,
} from "./fixtures";

// ---------------------------------------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------------------------------------

export interface MockRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  token: string | null;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

// ---------------------------------------------------------------------------------------------------------
// Store (one per process, on globalThis)
// ---------------------------------------------------------------------------------------------------------

interface MockStore {
  now_ms: number;
  personas: Persona[];
  models: CoupleModel[];
  pathways: PathwayView[];
  referrals: Record<string, ReferralTask[]>;
  consents: ConsentRecord[];
  audit: AuditEvent[];
  escalations: EscalationSeed[];
  closures: ClosureRecord[];
  teachback_locale: Record<string, Locale>;
  /** Declared rights not to know, as `${couple_id}:${person_id}` (additive; PUT and DELETE /right-not-to-know). */
  rntk: string[];
  seq: { consent: number; closure: number };
}

const STORE_KEY = "__bayanMockStore" as const;
type StoreHolder = typeof globalThis & { [STORE_KEY]?: MockStore };

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function canonicalAuditJson(event: Omit<AuditEvent, "hash">): string {
  return JSON.stringify({
    index: event.index,
    event_id: event.event_id,
    at: event.at,
    actor_role: event.actor_role,
    actor_id: event.actor_id,
    action: event.action,
    couple_id: event.couple_id,
    detail: event.detail,
    prev_hash: event.prev_hash,
  });
}

/** Appends one correctly chained event to `chain` and returns it. */
function appendAudit(chain: AuditEvent[], seed: AuditSeed): AuditEvent {
  const previous = chain[chain.length - 1];
  const index = chain.length;
  const unhashed: Omit<AuditEvent, "hash"> = {
    index,
    event_id: `evt-${String(index + 1).padStart(4, "0")}`,
    at: seed.at,
    actor_role: seed.actor_role,
    actor_id: seed.actor_id,
    action: seed.action,
    couple_id: seed.couple_id,
    detail: seed.detail,
    prev_hash: previous === undefined ? GENESIS_HASH : previous.hash,
  };
  const event: AuditEvent = { ...unhashed, hash: sha256Hex(canonicalAuditJson(unhashed)) };
  chain.push(event);
  return event;
}

function verifyChain(chain: readonly AuditEvent[]): AuditVerification {
  let expectedPrev = GENESIS_HASH;
  let firstBad: number | null = null;
  for (let i = 0; i < chain.length; i += 1) {
    const event = chain[i];
    if (event === undefined) continue;
    const { hash, ...unhashed } = event;
    const intact =
      event.index === i && event.prev_hash === expectedPrev && hash === sha256Hex(canonicalAuditJson(unhashed));
    if (!intact && firstBad === null) firstBad = i;
    expectedPrev = hash;
  }
  const last = chain[chain.length - 1];
  return {
    ok: firstBad === null,
    length: chain.length,
    head_hash: last === undefined ? GENESIS_HASH : last.hash,
    first_bad_index: firstBad,
  };
}

function buildStore(): MockStore {
  const pathways = makePathwayViews();
  const store: MockStore = {
    now_ms: Date.parse(FIXTURE_NOW),
    personas: makePersonas(),
    models: makeCoupleModels(),
    pathways,
    referrals: makeReferralTasks(pathways),
    consents: makeConsentSeeds(),
    audit: [],
    escalations: makeEscalationSeeds(),
    closures: [],
    teachback_locale: {},
    rntk: [],
    seq: { consent: 3, closure: 0 },
  };
  for (const seed of makeAuditSeeds()) appendAudit(store.audit, seed);
  return store;
}

function getStore(): MockStore {
  const holder = globalThis as StoreHolder;
  const existing = holder[STORE_KEY];
  if (existing !== undefined) return existing;
  const fresh = buildStore();
  holder[STORE_KEY] = fresh;
  return fresh;
}

/** Drops the store. The next request rebuilds it from the seed factories. */
export function resetMock(): void {
  delete (globalThis as StoreHolder)[STORE_KEY];
}

/** The mock clock moves forward one minute per mutation, so audit timestamps are deterministic and ordered. */
function tick(store: MockStore): string {
  store.now_ms += 60_000;
  return isoFromMs(store.now_ms);
}

function modelOf(store: MockStore, coupleId: string): CoupleModel | undefined {
  return store.models.find((m) => m.case.couple_id === coupleId);
}

function pathwayOf(store: MockStore, coupleId: string): PathwayView | undefined {
  return store.pathways.find((p) => p.couple_id === coupleId);
}

// ---------------------------------------------------------------------------------------------------------
// Request context, replies and problem details (RFC 9457)
// ---------------------------------------------------------------------------------------------------------

interface Ctx<P extends Persona | null> {
  req: MockRequest;
  store: MockStore;
  persona: P;
  params: string[];
  query: Record<string, string>;
}

type Reply = MockResponse;

interface FieldError {
  field: string;
  message: string;
}

const ok = (body: unknown, status = 200): Reply => ({ status, body });

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function problem(
  req: MockRequest,
  status: number,
  title: string,
  detail?: string,
  errors?: readonly FieldError[],
): Reply {
  const body: ProblemDetails = {
    type: `https://bayan.invalid/problems/${slugOf(title)}`,
    title,
    status,
    instance: req.path,
    correlation_id: `mock-${randomBytes(4).toString("hex")}`,
  };
  if (detail !== undefined) body.detail = detail;
  if (errors !== undefined && errors.length > 0) body.errors = errors.map((e) => ({ ...e }));
  return { status, body };
}

const notFound = (req: MockRequest, detail: string): Reply => problem(req, 404, "Not found", detail);
const forbidden = (req: MockRequest, detail: string): Reply => problem(req, 403, "Not permitted", detail);
const conflict = (req: MockRequest, detail: string): Reply => problem(req, 409, "Conflict", detail);
const invalid = (req: MockRequest, errors: readonly FieldError[]): Reply =>
  problem(req, 422, "Invalid request", "One or more fields are missing or not valid.", errors);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFinitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isString = (value: unknown): value is string => typeof value === "string";

function parseLocale(raw: string | undefined): Locale | null {
  if (raw === undefined || raw === "") return "en";
  return raw === "en" || raw === "ar" || raw === "ur" ? raw : null;
}

const badLocale: FieldError = { field: "locale", message: "The locale must be one of en, ar or ur." };

function actorOf(persona: Persona): { actor_role: Role; actor_id: string } {
  return { actor_role: persona.role, actor_id: persona.person_id ?? persona.id };
}

// ---------------------------------------------------------------------------------------------------------
// Disclosure (consent ledger plus emirate policy)
// ---------------------------------------------------------------------------------------------------------

const SCOPE_RANK: Readonly<Record<ConsentScope, number>> = {
  couple_result_only: 1,
  gene_names_only: 2,
  full_variant_detail: 3,
};

/** The highest live scope the subject has granted to any of `recipients` (a person id or a role name). */
function effectiveScope(
  store: MockStore,
  coupleId: string,
  subjectPersonId: string,
  recipients: readonly string[],
): ConsentScope | null {
  let best: ConsentScope | null = null;
  for (const consent of store.consents) {
    if (consent.couple_id !== coupleId || consent.subject_person_id !== subjectPersonId) continue;
    if (consent.revoked_at !== null) continue;
    if (consent.expires_at !== null && Date.parse(consent.expires_at) <= store.now_ms) continue;
    if (!recipients.includes(consent.recipient)) continue;
    if (best === null || SCOPE_RANK[consent.scope] > SCOPE_RANK[best]) best = consent.scope;
  }
  return best;
}

/** A pathogenic or likely pathogenic carrier or affected finding. A variant of uncertain significance is not abnormal. */
function hasAbnormalFinding(person: CoupleModel["people"][number]): boolean {
  return person.findings.some(
    (f) => (f.zygosity === "carrier" || f.zygosity === "affected") && f.classification !== "vus",
  );
}

/**
 * Is the couple-level shared result held back from this viewer? Under the Dubai policy (affected individual first)
 * a shared result is withheld until every OTHER member with an abnormal finding has granted at least
 * couple_result_only. Under both policies the same gate applies when the condition belongs to one person (X-linked).
 *
 * Not modelled in this mock: the backend's "counselling_first" gate (release only after counselling is complete).
 * The seeded personas are meant to see their result at their current pathway step.
 */
function awaitingPartnerConsent(store: MockStore, model: CoupleModel, viewerPersonId: string): boolean {
  if (model.category !== "shared_result_found") return false;
  const ownedByOnePerson = model.shared.some(
    (s) => s.basis === "x_linked_carrier_female" || s.basis === "x_linked_affected_male",
  );
  if (model.case.policy !== "dubai" && !ownedByOnePerson) return false;
  const recipients = [viewerPersonId, "couple_member"];
  return model.people
    .filter((p) => p.person_id !== viewerPersonId && hasAbnormalFinding(p))
    .some((owner) => effectiveScope(store, model.case.couple_id, owner.person_id, recipients) === null);
}

/** The certificate-refusal tension: shown when a partner with an abnormal finding has not agreed to share it. */
function certificateNoteKey(store: MockStore, model: CoupleModel): string | null {
  for (const owner of model.people) {
    if (!hasAbnormalFinding(owner)) continue;
    for (const other of model.people) {
      if (other.person_id === owner.person_id) continue;
      if (effectiveScope(store, model.case.couple_id, owner.person_id, [other.person_id, "couple_member"]) === null) {
        return `certificate_note.${model.case.policy}`;
      }
    }
  }
  return null;
}

function reviewPriorityOf(model: CoupleModel): ReviewPriority {
  return maxPriority(model.escalation_rule_ids.map((id) => makeEscalationDecision(id).priority));
}

function disclose(store: MockStore, model: CoupleModel, persona: Persona): DisclosedResult {
  const coupleId = model.case.couple_id;
  const common = {
    couple_id: coupleId,
    viewer_role: persona.role,
    viewer_person_id: persona.person_id,
    policy: model.case.policy,
    detection: structuredClone(model.detection),
    relationship: model.case.relationship,
    boundary_notice_key: "boundary.education_decision_support",
    certificate_note_key: certificateNoteKey(store, model),
    ruleset_version: model.ruleset_version,
  };

  if (persona.role !== "couple_member") {
    const allFindings: Finding[] = model.people.flatMap((p) => structuredClone(p.findings));
    return {
      ...common,
      category: model.category,
      withheld_reason_key: null,
      shared: structuredClone(model.shared),
      own_findings: [],
      partner_finding_scope: "full_variant_detail",
      partner_findings: allFindings,
      review_priority: reviewPriorityOf(model),
      staff_trace: [...model.trace],
    };
  }

  const me = model.people.find((p) => p.person_id === persona.person_id);
  const partner = model.people.find((p) => p.person_id !== persona.person_id);
  const myId = me?.person_id ?? "";
  const declined = store.rntk.includes(`${coupleId}:${myId}`);
  const awaiting = !declined && awaitingPartnerConsent(store, model, myId);
  const scope =
    partner === undefined ? null : effectiveScope(store, coupleId, partner.person_id, [myId, "couple_member"]);
  return {
    ...common,
    category: awaiting || declined ? null : model.category,
    withheld_reason_key: declined ? "right_not_to_know" : awaiting ? "awaiting_partner_consent" : null,
    shared: awaiting || declined ? [] : structuredClone(model.shared),
    own_findings: me === undefined ? [] : structuredClone(me.findings),
    partner_finding_scope: scope ?? "none",
    // DisclosedResult has no field for gene names alone, so gene_names_only adds nothing here beyond the scope
    // label; only full_variant_detail adds the partner's findings.
    partner_findings: scope === "full_variant_detail" && partner !== undefined ? structuredClone(partner.findings) : [],
    review_priority: null,
    staff_trace: [],
  };
}

function resultEnvelope(store: MockStore, model: CoupleModel, persona: Persona, locale: Locale): ResultEnvelope {
  const disclosed = disclose(store, model, persona);
  const explainer =
    disclosed.category === null
      ? null
      : makeResultDoc(locale, {
          category: disclosed.category,
          related: model.case.relationship !== "unrelated",
          shared: disclosed.shared,
          reasons: model.reasons,
        });
  return { disclosed, explainer };
}

// ---------------------------------------------------------------------------------------------------------
// Pathway and referrals
// ---------------------------------------------------------------------------------------------------------

/**
 * A case counts toward the referral target once a shared result exists AND has been communicated, that is, once the
 * joint_report step is done. A shared result still held back (for example while a partner's agreement is pending)
 * is not yet eligible.
 */
function isReferralEligible(store: MockStore, model: CoupleModel): boolean {
  if (model.category !== "shared_result_found") return false;
  const joint = pathwayOf(store, model.case.couple_id)?.states.find((s) => s.key === "joint_report");
  return joint?.status === "done";
}

function referralMet(store: MockStore, model: CoupleModel): boolean | null {
  if (!isReferralEligible(store, model)) return null;
  const tasks = store.referrals[model.case.couple_id] ?? [];
  return tasks.some((t) => t.task_id.endsWith(COUNSELLING_TASK_SUFFIX) && t.status === "completed");
}

function pathwayResponse(store: MockStore, model: CoupleModel): PathwayView | undefined {
  const view = pathwayOf(store, model.case.couple_id);
  if (view === undefined) return undefined;
  const copy = structuredClone(view);
  copy.referral_target_met = referralMet(store, model);
  return copy;
}

/**
 * When the other partner's agreement is recorded in the consent ledger, a pathway step that was blocked on it
 * continues. The step's timer was paused while it waited, so it restarts as on_track at release.
 */
function releaseBlockedPathway(store: MockStore, model: CoupleModel): void {
  const view = pathwayOf(store, model.case.couple_id);
  if (view === undefined) return;
  const index = view.states.findIndex((s) => s.status === "blocked");
  const state = index >= 0 ? view.states[index] : undefined;
  if (state === undefined) return;
  if (model.people.some((p) => awaitingPartnerConsent(store, model, p.person_id))) return;
  state.status = "current";
  state.sla_status = TIMED_STATES.has(state.key) ? "on_track" : "not_applicable";
  view.next_action = nextActionFor(state.key, false);
}

// ---------------------------------------------------------------------------------------------------------
// Haematology aid: closed vocabulary, placeholder selection (NOT clinical logic)
// ---------------------------------------------------------------------------------------------------------

const CBC_ONLY_LABELS = ["indices_reduced", "indices_not_flagged"] as const satisfies readonly HaemLabel[];
const HPLC_LABELS = [
  "pattern_suggests_beta_thal_trait",
  "pattern_suggests_iron_deficiency_first",
  "pattern_unclear_refer_for_molecular",
  "no_pattern_flagged_on_this_work_up",
] as const satisfies readonly HaemLabel[];

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const illustrativeSource = (): HaemSource => ({
  title: ILLUSTRATIVE_SOURCE_TITLE,
  year: null,
  url: null,
  illustrative: true,
});

const ruleStep = (ruleId: string, description: string): HaemRuleStep => ({
  rule_id: ruleId,
  description,
  source: illustrativeSource(),
});

/**
 * The label is chosen DETERMINISTICALLY FROM A HASH OF THE INPUTS among the labels of the closed vocabulary that
 * apply to the work-up (CBC only, or CBC plus HPLC). No clinical cut-off is encoded anywhere in this mock: the
 * same inputs always give the same label, and different inputs may give a different one. The real rules, their
 * sources and the clinical lead's sign-off come from the backend in production.
 */
function interpretHaem(cbc: Record<string, unknown>, hplc: Record<string, unknown> | null): HaemInterpretation {
  const cbcIncomplete = cbc["rbc_10e12_l"] == null || cbc["ferritin_ug_l"] == null;
  const digest = fnv1a(JSON.stringify({ cbc, hplc }));
  let label: HaemLabel;
  let second: HaemRuleStep;
  if (hplc === null && cbcIncomplete) {
    label = "cbc_incomplete";
    second = ruleStep(
      "HAEM-R02",
      "With a blood-count field missing and no haemoglobin analysis, the only label that applies is the incomplete one.",
    );
  } else if (hplc === null) {
    label = CBC_ONLY_LABELS[digest % CBC_ONLY_LABELS.length] ?? "indices_not_flagged";
    second = ruleStep(
      "HAEM-R03",
      "A blood count on its own never states a carrier status; the label comes from the closed blood-count-only vocabulary.",
    );
  } else {
    label = HPLC_LABELS[digest % HPLC_LABELS.length] ?? "pattern_unclear_refer_for_molecular";
    second = ruleStep(
      "HAEM-R07",
      "With a haemoglobin analysis supplied, the label comes from the closed work-up vocabulary and names a pattern to review, never a diagnosis.",
    );
  }
  return {
    label,
    label_text: null,
    rule_trace: [ruleStep("HAEM-R01", "Check which blood-count fields were supplied and that each reads as a number."), second],
    flags: [],
    needs_clinician_signoff: true,
    sources: [illustrativeSource()],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Programme figures
// ---------------------------------------------------------------------------------------------------------

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Math.round(value * 10) / 10;
}

/**
 * count: couples whose current (or blocked) step is this state. median_hours: median time spent in the state by
 * couples that have completed it, leaving out steps that took no time because they did not apply.
 * sla_breaches: couples whose state reports a breached timer.
 */
function computeKpis(store: MockStore): ProgrammeKpis {
  const eligible = store.models.filter((m) => isReferralEligible(store, m));
  return {
    generated_at: isoFromMs(store.now_ms),
    synthetic: true,
    cases_total: store.models.length,
    referral_target: 0.9,
    referral_completed: eligible.filter((m) => referralMet(store, m) === true).length,
    referral_eligible: eligible.length,
    by_state: PATHWAY_STATE_KEYS.map((key) => {
      let count = 0;
      let breaches = 0;
      const hours: number[] = [];
      for (const view of store.pathways) {
        const state = view.states.find((s) => s.key === key);
        if (state === undefined) continue;
        if (state.status === "current" || state.status === "blocked") count += 1;
        if (state.sla_status === "breached") breaches += 1;
        if (state.status === "done" && state.entered_at !== null && state.completed_at !== null) {
          const elapsed = (Date.parse(state.completed_at) - Date.parse(state.entered_at)) / 3_600_000;
          if (elapsed > 0) hours.push(elapsed);
        }
      }
      return { key, count, median_hours: median(hours), sla_breaches: breaches };
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------------------------------------

type PublicHandler = (ctx: Ctx<Persona | null>) => Reply;
type ProtectedHandler = (ctx: Ctx<Persona>) => Reply;

const coupleIdOf = (ctx: Ctx<Persona | null>): string => ctx.params[0] ?? "";

function requireModel(ctx: Ctx<Persona | null>): CoupleModel | Reply {
  const model = modelOf(ctx.store, coupleIdOf(ctx));
  return model ?? notFound(ctx.req, "No couple with this id.");
}

const isReply = (value: CoupleModel | Reply): value is Reply => "status" in value && "body" in value;

// ---- demo, auth, cases ----

const getPersonas: PublicHandler = (ctx) => ok(structuredClone(ctx.store.personas));

const postReset: PublicHandler = () => {
  resetMock();
  getStore();
  return ok({ ok: true });
};

const getMe: ProtectedHandler = (ctx) => ok(structuredClone(ctx.persona));

const listCouples: ProtectedHandler = (ctx) => ok(ctx.store.models.map((m): CoupleCase => structuredClone(m.case)));

const getCouple: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  return isReply(model) ? model : ok(structuredClone(model.case));
};

// ---- pathway ----

const getPathway: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const view = pathwayResponse(ctx.store, model);
  return view === undefined ? notFound(ctx.req, "No pathway for this couple.") : ok(view);
};

const postPathwayEvent: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const body = ctx.req.body;
  const known = Object.values(PATHWAY_EVENT_BY_STATE);
  if (!isRecord(body) || !isString(body["event"]) || body["event"] === "") {
    return invalid(ctx.req, [{ field: "event", message: "An event name is required." }]);
  }
  const event = body["event"];
  if (!known.includes(event)) {
    return invalid(ctx.req, [{ field: "event", message: `Unknown pathway event. Known events: ${known.join(", ")}.` }]);
  }
  const store = ctx.store;
  const view = pathwayOf(store, model.case.couple_id);
  if (view === undefined) return notFound(ctx.req, "No pathway for this couple.");
  const index = view.states.findIndex((s) => s.status === "current" || s.status === "blocked");
  const state = index >= 0 ? view.states[index] : undefined;
  if (state === undefined) return conflict(ctx.req, "The pathway is already complete.");
  if (state.status === "blocked") {
    return conflict(
      ctx.req,
      "This step is waiting for the other partner's agreement. It continues once the consent ledger shows that agreement.",
    );
  }
  const expected = PATHWAY_EVENT_BY_STATE[state.key];
  if (expected !== event) {
    return conflict(
      ctx.req,
      `The event ${event} does not apply to the current step (${state.key}). The event for this step is ${expected}.`,
    );
  }

  const at = tick(store);
  state.status = "done";
  state.completed_at = at;
  state.sla_status = TIMED_STATES.has(state.key)
    ? state.sla_status === "breached"
      ? "breached"
      : "on_track"
    : "not_applicable";
  const next = view.states[index + 1];
  if (next === undefined) {
    view.next_action = null;
  } else {
    next.status = "current";
    next.entered_at = at;
    next.sla_status = TIMED_STATES.has(next.key) ? "on_track" : "not_applicable";
    view.next_action = nextActionFor(next.key, false);
  }
  if (event === PATHWAY_EVENT_BY_STATE.counselling) {
    for (const task of store.referrals[model.case.couple_id] ?? []) {
      if (task.task_id.endsWith(COUNSELLING_TASK_SUFFIX)) {
        task.status = "completed";
        task.last_modified = at;
      }
    }
  }
  appendAudit(store.audit, {
    at,
    ...actorOf(ctx.persona),
    action: "pathway_event",
    couple_id: model.case.couple_id,
    detail: `Event ${event}: ${state.key} done, ${next === undefined ? "pathway complete" : `${next.key} current`} (simulated).`,
  });
  const response = pathwayResponse(store, model);
  return response === undefined ? notFound(ctx.req, "No pathway for this couple.") : ok(response);
};

const getReferrals: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  return isReply(model) ? model : ok(structuredClone(ctx.store.referrals[model.case.couple_id] ?? []));
};

// ---- result, explainer ----

const getResult: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const locale = parseLocale(ctx.query["locale"]);
  if (locale === null) return invalid(ctx.req, [badLocale]);
  return ok(resultEnvelope(ctx.store, model, ctx.persona, locale));
};

const getOptions: ProtectedHandler = (ctx) => {
  const locale = parseLocale(ctx.query["locale"]);
  return locale === null ? invalid(ctx.req, [badLocale]) : ok(makeOptionsDoc(locale));
};

const getGlossary: ProtectedHandler = (ctx) => {
  const locale = parseLocale(ctx.query["locale"]);
  return locale === null ? invalid(ctx.req, [badLocale]) : ok(makeGlossary(locale));
};

// ---- consent ledger ----

const SCOPES: readonly ConsentScope[] = ["couple_result_only", "gene_names_only", "full_variant_detail"];
const ROLES_NEVER_RECIPIENTS: readonly string[] = ["programme", "judge", "external"];

const getConsents: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  return ok(structuredClone(ctx.store.consents.filter((c) => c.couple_id === model.case.couple_id)));
};

const postConsent: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const store = ctx.store;
  const body = ctx.req.body;
  if (!isRecord(body)) return invalid(ctx.req, [{ field: "body", message: "A JSON object is required." }]);
  const errors: FieldError[] = [];

  const subject = body["subject_person_id"];
  const personIds = model.people.map((p) => p.person_id);
  if (!isString(subject) || subject === "") {
    errors.push({ field: "subject_person_id", message: "The person the consent belongs to is required." });
  } else if (!personIds.includes(subject)) {
    errors.push({ field: "subject_person_id", message: "This person is not a member of the couple." });
  }
  const recipient = body["recipient_role"];
  if (!isString(recipient) || recipient === "") {
    errors.push({ field: "recipient_role", message: "A recipient is required." });
  } else if (ROLES_NEVER_RECIPIENTS.includes(recipient)) {
    errors.push({
      field: "recipient_role",
      message: "This role never receives an individual result, so a consent cannot name it.",
    });
  } else if (!["couple_member", "counsellor", "clinician"].includes(recipient) && !personIds.includes(recipient)) {
    errors.push({
      field: "recipient_role",
      message: "The recipient must be couple_member, counsellor, clinician or a person in this couple.",
    });
  }
  const scope = body["scope"];
  if (!isString(scope) || !(SCOPES as readonly string[]).includes(scope)) {
    errors.push({ field: "scope", message: `The scope must be one of ${SCOPES.join(", ")}.` });
  }
  const purpose = body["purpose"];
  if (!isString(purpose) || purpose.trim() === "") {
    errors.push({ field: "purpose", message: "A purpose is required." });
  } else if (purpose.length > 200) {
    errors.push({ field: "purpose", message: "The purpose must be 200 characters or fewer." });
  }
  const expires = body["expires_at"];
  if (expires !== null && expires !== undefined) {
    if (!isString(expires) || Number.isNaN(Date.parse(expires))) {
      errors.push({ field: "expires_at", message: "The expiry must be null or a valid ISO 8601 date and time." });
    } else if (Date.parse(expires) <= store.now_ms) {
      errors.push({ field: "expires_at", message: "The expiry must be in the future." });
    }
  }
  if (errors.length > 0) return invalid(ctx.req, errors);
  if (!isString(subject) || !isString(recipient) || !isString(purpose) || !isString(scope)) {
    return invalid(ctx.req, [{ field: "body", message: "The request is not valid." }]);
  }
  if (ctx.persona.person_id !== subject) {
    return forbidden(ctx.req, "A consent can only be granted by the person it belongs to.");
  }

  const at = tick(store);
  store.seq.consent += 1;
  const record: ConsentRecord = {
    consent_id: `cons-${String(store.seq.consent).padStart(4, "0")}`,
    couple_id: model.case.couple_id,
    subject_person_id: subject,
    recipient,
    scope: scope as ConsentScope,
    purpose: purpose.trim(),
    granted_at: at,
    expires_at: isString(expires) ? isoFromMs(Date.parse(expires)) : null,
    revoked_at: null,
  };
  store.consents.push(record);
  appendAudit(store.audit, {
    at,
    ...actorOf(ctx.persona),
    action: "consent_granted",
    couple_id: model.case.couple_id,
    detail: `Consent ${record.consent_id} granted: ${record.scope} to ${record.recipient} for ${record.purpose}.`,
  });
  releaseBlockedPathway(store, model);
  return ok(structuredClone(record), 201);
};

const postRevoke: ProtectedHandler = (ctx) => {
  const store = ctx.store;
  const consentId = ctx.params[0] ?? "";
  const record = store.consents.find((c) => c.consent_id === consentId);
  if (record === undefined) return notFound(ctx.req, "No consent with this id.");
  if (ctx.persona.person_id !== record.subject_person_id) {
    return forbidden(ctx.req, "A consent can only be revoked by the person it belongs to.");
  }
  if (record.revoked_at === null) {
    const at = tick(store);
    record.revoked_at = at;
    appendAudit(store.audit, {
      at,
      ...actorOf(ctx.persona),
      action: "consent_revoked",
      couple_id: record.couple_id,
      detail: `Consent ${record.consent_id} revoked: ${record.scope} to ${record.recipient}.`,
    });
  }
  return ok(structuredClone(record));
};

// ---- right not to know ----

/** PUT declares, DELETE withdraws; both append one audit row and are idempotent per person (as the real backend). */
function setRntk(ctx: Ctx<Persona>, active: boolean): Reply {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const store = ctx.store;
  const coupleId = model.case.couple_id;
  const personId = ctx.persona.person_id ?? "";
  const key = `${coupleId}:${personId}`;
  if (active !== store.rntk.includes(key)) {
    store.rntk = active ? [...store.rntk, key] : store.rntk.filter((k) => k !== key);
  }
  appendAudit(store.audit, {
    at: tick(store),
    ...actorOf(ctx.persona),
    action: active ? "rntk_declared" : "rntk_withdrawn",
    couple_id: coupleId,
    detail: `Right not to know ${active ? "declared" : "withdrawn"} (Decree-Law 49/2023 Art. 9(2)).`,
  });
  return ok({
    couple_id: coupleId,
    person_id: personId,
    active,
    note: "A recorded right not to know (Decree-Law 49/2023 Art. 9(2)) withholds results in this app.",
  });
}

const putRntk: ProtectedHandler = (ctx) => setRntk(ctx, true);
const deleteRntk: ProtectedHandler = (ctx) => setRntk(ctx, false);

// ---- audit ----

const getCoupleAudit: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  return ok(structuredClone(ctx.store.audit.filter((e) => e.couple_id === model.case.couple_id)));
};

/** A couple member gets the reduced form (own events only); everyone else gets the full chain. */
const getAuditVerify: ProtectedHandler = (ctx) => {
  const full = verifyChain(ctx.store.audit);
  if (ctx.persona.role === "couple_member") {
    const own = ctx.store.audit.filter((e) => e.couple_id === ctx.persona.couple_id).length;
    return ok({ ok: full.ok, scope: "own_couple", own_events: own, length: null, head_hash: null, first_bad_index: null, problem: null });
  }
  return ok({ ...full, scope: "chain", own_events: null, problem: null });
};

/** Always refused (Decree-Law 49/2023 Art. 19 to 21) and always logged. A caller needs no token: nobody gets in. */
const postThirdParty: PublicHandler = (ctx) => {
  const store = ctx.store;
  const body = ctx.req.body;
  let coupleId: string | null = null;
  let kind = "unspecified";
  if (isRecord(body)) {
    const candidate = body["couple_id"];
    if (isString(candidate) && modelOf(store, candidate) !== undefined) coupleId = candidate;
    const rawKind = body["kind"];
    if (isString(rawKind) && /^[a-z_]{1,32}$/.test(rawKind.toLowerCase())) kind = rawKind.toLowerCase();
  }
  appendAudit(store.audit, {
    at: tick(store),
    actor_role: "external",
    actor_id: `third-party:${kind}`,
    action: "third_party_request_refused",
    couple_id: coupleId,
    detail: `A ${kind} request for results was refused. Employers, insurers and relatives cannot request or receive results (Decree-Law 49/2023, Art. 19 to 21).`,
  });
  return problem(
    ctx.req,
    403,
    "Request refused",
    "Employers, insurers and relatives cannot request or receive a person's results. Federal Decree-Law 49/2023 Art. 19 to 21 and the consent ledger decide who can see a result. This request has been recorded in the audit log.",
  );
};

// ---- escalation and brief ----

const PRIORITY_ORDER: Readonly<Record<ReviewPriority, number>> = { urgent: 0, priority: 1, routine: 2 };

const getEscalations: ProtectedHandler = (ctx) => {
  const items: EscalationItem[] = [];
  for (const seed of ctx.store.escalations) {
    const model = modelOf(ctx.store, seed.couple_id);
    if (model === undefined) continue;
    items.push({
      couple_id: seed.couple_id,
      couple_label: model.label,
      review_priority: reviewPriorityOf(model),
      decisions: model.escalation_rule_ids.map(makeEscalationDecision),
      raised_at: seed.raised_at,
    });
  }
  items.sort(
    (a, b) =>
      PRIORITY_ORDER[a.review_priority] - PRIORITY_ORDER[b.review_priority] || a.raised_at.localeCompare(b.raised_at),
  );
  return ok(items);
};

const getBrief: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const decisions = model.escalation_rule_ids.map(makeEscalationDecision);
  const brief: CounsellorBrief = {
    couple_id: model.case.couple_id,
    generated_at: isoFromMs(ctx.store.now_ms),
    review_priority: reviewPriorityOf(model),
    category: model.category,
    relationship: model.case.relationship,
    shared: structuredClone(model.shared),
    detection: structuredClone(model.detection),
    trace: [...model.trace],
    escalations: decisions,
    referral_tasks: structuredClone(ctx.store.referrals[model.case.couple_id] ?? []),
    grounded_in: [...decisions.map((d) => d.rule_id), ILLUSTRATIVE_SOURCE_TITLE, model.ruleset_version],
    // Additive, for the staff instrument. Fixture text only; the real backend composes these on the server.
    members: model.people.map((p) => ({ display_name: p.display_name, sex: p.sex, age: null, language: ctx.req.query?.["locale"] ?? "en", family_history: [] })),
    emirate_policy: model.case.policy,
    pathway_state: pathwayOf(ctx.store, model.case.couple_id)?.states.find((s) => s.status === "current" || s.status === "blocked")?.key ?? "complete",
    sections: [
      {
        key: "result",
        title: "Result on file",
        lines: [
          `Category: ${model.category}`,
          `Ruleset: ${model.ruleset_version}`,
          ...model.shared.map((c) => `${c.condition_id} (${c.gene}, ${c.inheritance}): ${c.outcomes.map((o) => `${o.per_100} of 100 ${o.label}`).join(", ")}`),
        ],
      },
      { key: "why", title: "Why a human is asked to look", lines: decisions.map((d) => `${d.rule_id}: ${d.reason}`) },
      {
        key: "sharing",
        title: "Who may see what",
        lines: [ctx.store.consents.some((c) => c.couple_id === model.case.couple_id) ? "Sharing consent recorded." : "No sharing consent recorded."],
      },
      {
        key: "open",
        title: "Open items",
        lines: [`${(ctx.store.referrals[model.case.couple_id] ?? []).length} referral task(s) listed.`],
      },
    ],
    consent_count: ctx.store.consents.filter((c) => c.couple_id === model.case.couple_id).length,
    closure_record_count: 0,
  };
  return ok(brief);
};

// ---- haematology aid ----

const postHaem: ProtectedHandler = (ctx) => {
  const body = ctx.req.body;
  const errors: FieldError[] = [];
  const optionalPositive = (value: unknown, field: string): void => {
    if (value !== null && value !== undefined && !isFinitePositive(value)) {
      errors.push({ field, message: "Must be a finite positive number, or left empty." });
    }
  };
  const requiredPositive = (value: unknown, field: string): void => {
    if (!isFinitePositive(value)) errors.push({ field, message: "Must be a finite positive number." });
  };

  if (!isRecord(body) || !isRecord(body["cbc"])) {
    return invalid(ctx.req, [{ field: "cbc", message: "The blood-count object is required." }]);
  }
  const cbc = body["cbc"];
  if (cbc["sex"] !== "female" && cbc["sex"] !== "male") {
    errors.push({ field: "cbc.sex", message: "Must be female or male." });
  }
  requiredPositive(cbc["hb_g_dl"], "cbc.hb_g_dl");
  requiredPositive(cbc["mcv_fl"], "cbc.mcv_fl");
  requiredPositive(cbc["mch_pg"], "cbc.mch_pg");
  optionalPositive(cbc["rbc_10e12_l"], "cbc.rbc_10e12_l");
  optionalPositive(cbc["ferritin_ug_l"], "cbc.ferritin_ug_l");

  const rawHplc = body["hplc"];
  let hplc: Record<string, unknown> | null = null;
  if (rawHplc !== null && rawHplc !== undefined) {
    if (!isRecord(rawHplc)) {
      errors.push({ field: "hplc", message: "Must be an object or null." });
    } else {
      hplc = rawHplc;
      requiredPositive(rawHplc["hba2_percent"], "hplc.hba2_percent");
      requiredPositive(rawHplc["hbf_percent"], "hplc.hbf_percent");
      optionalPositive(rawHplc["variant_hb_percent"], "hplc.variant_hb_percent");
      const name = rawHplc["variant_hb_name"];
      if (name !== null && name !== undefined && !isString(name)) {
        errors.push({ field: "hplc.variant_hb_name", message: "Must be text or null." });
      }
    }
  }
  if (errors.length > 0) return invalid(ctx.req, errors);
  return ok(interpretHaem(cbc, hplc));
};

// ---- closure and teach-back ----

const patientSchema = makeClosureSchema("en");

function checkChoice(value: unknown, choiceIds: readonly string[]): value is string {
  return isString(value) && choiceIds.includes(value);
}

function memberOwnsPerson(ctx: Ctx<Persona>, personId: string): boolean {
  return ctx.persona.person_id === personId;
}

const postPatientClosure: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const body = ctx.req.body;
  if (!isRecord(body)) return invalid(ctx.req, [{ field: "body", message: "A JSON object is required." }]);
  const errors: FieldError[] = [];

  const personId = body["person_id"];
  if (!isString(personId) || !model.people.some((p) => p.person_id === personId)) {
    errors.push({ field: "person_id", message: "The person must be a member of this couple." });
  }

  const answers = body["answers"];
  if (!isRecord(answers)) {
    errors.push({ field: "answers", message: "An object of answers keyed by item id is required." });
  } else {
    const itemIds = patientSchema.patient_items.map((i) => i.id);
    for (const key of Object.keys(answers)) {
      if (!itemIds.includes(key)) errors.push({ field: `answers.${key}`, message: "Unknown item." });
    }
    for (const item of patientSchema.patient_items) {
      const field = `answers.${item.id}`;
      const value = answers[item.id];
      if (item.kind === "free_text") {
        if (value !== undefined && (!isString(value) || value.length > 2000)) {
          errors.push({ field, message: "Must be text of 2000 characters or fewer." });
        }
        continue;
      }
      if (!isString(value) || value === "") {
        errors.push({ field, message: "An answer is required." });
        continue;
      }
      if (item.kind === "integer_0_100") {
        if (!/^(0|[1-9]\d{0,2})$/.test(value) || Number(value) > 100) {
          errors.push({ field, message: "Must be a whole number from 0 to 100." });
        }
      } else if (!checkChoice(value, item.choices.map((c) => c.id))) {
        errors.push({ field, message: "Must be one of the offered choices." });
      }
    }
  }

  const interest = body["service_interest"];
  if (!checkChoice(interest, patientSchema.service_interest.options.map((o) => o.id))) {
    errors.push({ field: "service_interest", message: "Must be one of the offered choices." });
  }
  const topics = body["topics"];
  const topicIds = patientSchema.service_interest.topics.map((t) => t.id);
  if (topics !== undefined) {
    if (!Array.isArray(topics) || !topics.every((t) => checkChoice(t, topicIds))) {
      errors.push({ field: "topics", message: "Must be a list of the offered topics." });
    } else if (topics.length > 0 && (interest === "no_thanks" || interest === "prefer_not_to_say")) {
      errors.push({ field: "topics", message: "Topics apply only when the answer is yes." });
    }
  }
  if (errors.length > 0) return invalid(ctx.req, errors);
  if (!isString(personId)) return invalid(ctx.req, [{ field: "person_id", message: "A person is required." }]);
  if (!memberOwnsPerson(ctx, personId)) {
    return forbidden(ctx.req, "Each person submits their own answers.");
  }

  const store = ctx.store;
  const at = tick(store);
  store.seq.closure += 1;
  const record: ClosureRecord = {
    record_id: `clo-${String(store.seq.closure).padStart(4, "0")}`,
    couple_id: model.case.couple_id,
    kind: "patient",
    submitted_at: at,
    simulated: true,
  };
  store.closures.push(record);
  appendAudit(store.audit, {
    at,
    ...actorOf(ctx.persona),
    action: "closure_submitted",
    couple_id: model.case.couple_id,
    detail: `Patient closure items ${record.record_id} submitted by ${personId} (simulated). Answers are not copied into the audit log.`,
  });
  return ok(structuredClone(record), 201);
};

const postClinicianProforma: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const body: unknown = ctx.req.body;
  if (!isRecord(body) || !isRecord(body["answers"])) {
    return invalid(ctx.req, [{ field: "answers", message: "An object of answers keyed by field id is required." }]);
  }
  const input = body as unknown as ClinicianProformaInput;
  const answers: Record<string, unknown> = input.answers;
  const errors: FieldError[] = [];
  const fields = patientSchema.proforma_fields;
  for (const key of Object.keys(answers)) {
    const field = fields.find((f) => f.id === key);
    if (field === undefined) {
      errors.push({ field: `answers.${key}`, message: "Unknown field." });
    } else if (field.filled_by !== "clinician") {
      errors.push({ field: `answers.${key}`, message: `This field is filled in by the ${field.filled_by}, not the clinician.` });
    }
  }
  for (const field of fields.filter((f) => f.filled_by === "clinician")) {
    const name = `answers.${field.id}`;
    const value = answers[field.id];
    const choiceIds = field.choices.map((c) => c.id);
    if (field.kind === "action_list") {
      // Plan rows are free-form (action, owner, due date) serialised by the form; any list of strings is accepted.
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && v.length > 0)) {
        errors.push({ field: name, message: "Must be a list of plan rows." });
      }
    } else if (field.kind === "checklist") {
      if (!Array.isArray(value) || !value.every((v) => checkChoice(v, choiceIds))) {
        errors.push({ field: name, message: "Must be a list of the offered choices." });
      } else if (value.length === 0) {
        errors.push({ field: name, message: "Tick at least one item." });
      }
    } else if (!checkChoice(value, choiceIds)) {
      errors.push({ field: name, message: "Must be one of the offered choices." });
    }
  }
  if (errors.length > 0) return invalid(ctx.req, errors);

  const store = ctx.store;
  const at = tick(store);
  store.seq.closure += 1;
  const record: ClosureRecord = {
    record_id: `clo-${String(store.seq.closure).padStart(4, "0")}`,
    couple_id: model.case.couple_id,
    kind: "clinician",
    submitted_at: at,
    simulated: true,
  };
  store.closures.push(record);
  appendAudit(store.audit, {
    at,
    ...actorOf(ctx.persona),
    action: "closure_submitted",
    couple_id: model.case.couple_id,
    detail: `Clinician proforma ${record.record_id} submitted (simulated).`,
  });
  return ok(structuredClone(record), 201);
};

const getClosureSchema: ProtectedHandler = (ctx) => {
  const locale = parseLocale(ctx.query["locale"]);
  return locale === null ? invalid(ctx.req, [badLocale]) : ok(makeClosureSchema(locale));
};

const getTeachBack: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const locale = parseLocale(ctx.query["locale"]);
  if (locale === null) return invalid(ctx.req, [badLocale]);
  ctx.store.teachback_locale[model.case.couple_id] = locale;
  return ok(makeTeachBackQuiz(model.case.couple_id, locale));
};

/**
 * The submit path in endpoints.ts sends no locale, so the explanations use, in order: ?locale=, a locale in the
 * body, the locale of the last quiz fetched for this couple, then English.
 */
const postTeachBack: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const body = ctx.req.body;
  if (!isRecord(body) || !isRecord(body["answers"])) {
    return invalid(ctx.req, [{ field: "answers", message: "An object of answers keyed by question id is required." }]);
  }
  const answers = body["answers"];
  const key = teachBackKey();
  const errors: FieldError[] = [];
  for (const name of Object.keys(answers)) {
    if (!key.some((q) => q.id === name)) errors.push({ field: `answers.${name}`, message: "Unknown question." });
  }
  for (const question of key) {
    if (!checkChoice(answers[question.id], question.choice_ids)) {
      errors.push({ field: `answers.${question.id}`, message: "Choose one of the offered answers." });
    }
  }
  const requested = ctx.query["locale"] ?? (isString(body["locale"]) ? body["locale"] : undefined);
  const locale = requested === undefined ? (ctx.store.teachback_locale[model.case.couple_id] ?? "en") : parseLocale(requested);
  if (locale === null) errors.push(badLocale);
  if (errors.length > 0 || locale === null) return invalid(ctx.req, errors);

  const explanations = teachBackExplanations(locale);
  const items = key.map((q) => ({
    id: q.id,
    correct: answers[q.id] === q.correct,
    explanation: explanations[q.id] ?? "",
  }));
  const result: TeachBackResult = {
    couple_id: model.case.couple_id,
    correct: items.filter((i) => i.correct).length,
    total: items.length,
    items,
  };
  return ok(result);
};


// ---- evidence probes (additive, Lane C): demo cases, refusal classifier, escalation evaluation ----

/** GET /v1/demo/cases: one entry per seeded couple, built from the fixtures (fixture wording, not the real summaries). */
const getDemoCases: PublicHandler = (ctx) =>
  ok(
    ctx.store.models
      .map((model) => ({
        couple_id: model.case.couple_id,
        n: model.case_number,
        title: model.label,
        summary: `Fixture case ${model.case_number}: ${model.category.replace(/_/g, " ")}, ${model.case.relationship.replace(/_/g, " ")}.`,
        relationship: model.case.relationship,
        emirate_policy: model.case.policy,
        pathway_target: "fixture",
        partner_persona_ids: ctx.store.personas.filter((p) => p.couple_id === model.case.couple_id).map((p) => p.id),
        synthetic: true,
      }))
      .sort((a, b) => a.n - b.n),
  );

const MARRIAGE_PATTERN = /\b(cancel|call off|marry|marriage|wedding|break (it )?off)\b/i;
const DISTRESS_PATTERN = /\b(hopeless|no way out|cannot go on|do not know how to go on)\b/i;

/** POST /v1/refusals/classify: a tiny keyword stand-in for the real classifier, labelled as such in `method`. */
const postClassify: ProtectedHandler = (ctx) => {
  const body = ctx.req.body;
  const text = isRecord(body) && isString(body["text"]) ? body["text"] : "";
  if (text.trim() === "") return invalid(ctx.req, [{ field: "text", message: "Type a sentence to classify." }]);
  const refuse = MARRIAGE_PATTERN.test(text);
  return ok({
    refuse,
    category: refuse ? "marriage_decision" : null,
    categories: refuse ? ["marriage_decision"] : [],
    matched_rule_ids: refuse ? ["mock.mar.1"] : [],
    escalate: refuse,
    message: refuse ? "Rishta Safe does not advise on whether to marry or to change plans. That decision is yours, and a counsellor can talk through the information with you." : null,
    legal_basis: refuse ? "The decision to marry is for the couple and the judicial authorities (fixture)." : null,
    locale: "en",
    method: "fixture_keyword_matching_not_language_understanding",
  });
};

/** POST /v1/couples/:id/escalations/evaluate: deterministic stand-in; a distress phrase raises the distress trigger. */
const postEvaluateEscalations: ProtectedHandler = (ctx) => {
  const model = requireModel(ctx);
  if (isReply(model)) return model;
  const body = ctx.req.body;
  const text = isRecord(body) && isString(body["free_text"]) ? body["free_text"] : "";
  const decisions: unknown[] = model.escalation_rule_ids.slice(0, 1).map(makeEscalationDecision);
  if (DISTRESS_PATTERN.test(text)) {
    decisions.push({
      rule_id: "user_distress",
      priority: "priority",
      due_by_hint: "same_session",
      reason: "user distress (fixture)",
      source: "Fixture rule list.",
    });
  }
  return ok({
    couple_id: model.case.couple_id,
    decisions: decisions.map((d) => (isRecord(d) ? { couple_id: model.case.couple_id, trigger_id: d["rule_id"], tier: "counsellor", reason_keys: [], due_by_hint: d["due_by_hint"], needs_clinician_signoff: true, needs_legal_read: false, source: d["source"] } : d)),
    notice: "Fixture mode: deterministic triggers with sources. A human decides what happens next.",
  });
};


/** GET /v1/governance/declarations: the five declaration documents (titles as the real backend lists them). */
const getDeclarations: PublicHandler = () =>
  ok([
    { id: "data_declaration", title: "Data declaration", file: "data_declaration.md", summary: "Every data source and licence used, every source deliberately not used and why, and the synthetic-data statement." },
    { id: "limitations", title: "Limitations", file: "limitations.md", summary: "A plain list of what this prototype does not do or cannot prove." },
    { id: "regulatory_posture", title: "Regulatory posture", file: "regulatory_posture.md", summary: "How the federal law and the emirate premarital screening standards shape what the product does." },
    { id: "prior_art", title: "Prior art and positioning", file: "prior_art.md", summary: "What Rishta Safe does and does not claim to be first at, why private set intersection was cut, and our three differentiators." },
    { id: "open_risks", title: "Open risks", file: "open_risks.md", summary: "Open risks to read before submitting." },
  ]);

// ---- programme figures and scoreboard ----

const getKpis: ProtectedHandler = (ctx) => ok(computeKpis(ctx.store));

const getScoreboard: ProtectedHandler = (ctx) => ok(makeScoreboard(isoFromMs(ctx.store.now_ms)));

// ---------------------------------------------------------------------------------------------------------
// Routes and access rules
// ---------------------------------------------------------------------------------------------------------

interface PublicRoute {
  method: string;
  pattern: RegExp;
  access: "public";
  handle: PublicHandler;
}

interface ProtectedRoute {
  method: string;
  pattern: RegExp;
  access: readonly Role[];
  /** The first path parameter is a couple id: members only reach their own couple. */
  scoped: boolean;
  handle: ProtectedHandler;
}

type Route = PublicRoute | ProtectedRoute;

const isPublicRoute = (route: Route): route is PublicRoute => route.access === "public";

const patternOf = (path: string): RegExp => new RegExp(`^${path.replace(/:[a-z]+/g, "([^/]+)")}$`);

const open = (method: string, path: string, handle: PublicHandler): PublicRoute => ({
  method,
  pattern: patternOf(path),
  access: "public",
  handle,
});

const guarded = (
  method: string,
  path: string,
  access: readonly Role[],
  handle: ProtectedHandler,
  scoped = false,
): ProtectedRoute => ({ method, pattern: patternOf(path), access, scoped, handle });

const MEMBER: readonly Role[] = ["couple_member"];
const STAFF: readonly Role[] = ["counsellor", "clinician"];
const MEMBER_OR_STAFF: readonly Role[] = ["couple_member", "counsellor", "clinician"];
const READERS: readonly Role[] = ["couple_member", "counsellor", "clinician", "judge"];
const FIGURES: readonly Role[] = ["programme", "judge", "counsellor", "clinician"];
const ALL_ROLES: readonly Role[] = ["couple_member", "counsellor", "clinician", "programme", "judge", "external"];

const ROUTES: readonly Route[] = [
  open("GET", "/v1/demo/personas", getPersonas),
  open("GET", "/v1/demo/cases", getDemoCases),
  open("GET", "/v1/governance/declarations", getDeclarations),
  open("POST", "/v1/demo/reset", postReset),
  open("POST", "/v1/third-party-requests", postThirdParty),
  guarded("GET", "/v1/auth/me", ALL_ROLES, getMe),

  guarded("GET", "/v1/couples", STAFF, listCouples),
  guarded("GET", "/v1/couples/:id", MEMBER_OR_STAFF, getCouple, true),
  guarded("GET", "/v1/couples/:id/pathway", MEMBER_OR_STAFF, getPathway, true),
  guarded("POST", "/v1/couples/:id/pathway/events", MEMBER_OR_STAFF, postPathwayEvent, true),
  guarded("GET", "/v1/couples/:id/referrals", MEMBER_OR_STAFF, getReferrals, true),
  guarded("GET", "/v1/couples/:id/result", MEMBER_OR_STAFF, getResult, true),

  guarded("GET", "/v1/explain/options", READERS, getOptions),
  guarded("GET", "/v1/explain/glossary", READERS, getGlossary),

  guarded("GET", "/v1/couples/:id/consents", MEMBER_OR_STAFF, getConsents, true),
  guarded("POST", "/v1/couples/:id/consents", MEMBER, postConsent, true),
  guarded("POST", "/v1/consents/:id/revoke", MEMBER, postRevoke),
  guarded("PUT", "/v1/couples/:id/right-not-to-know", MEMBER, putRntk, true),
  guarded("DELETE", "/v1/couples/:id/right-not-to-know", MEMBER, deleteRntk, true),
  guarded("GET", "/v1/couples/:id/audit", [...MEMBER_OR_STAFF, "judge"], getCoupleAudit, true),
  guarded("GET", "/v1/audit/verify", READERS, getAuditVerify),

  guarded("GET", "/v1/escalations", ["counsellor", "clinician"], getEscalations),
  guarded("GET", "/v1/couples/:id/brief", STAFF, getBrief, true),

  guarded("POST", "/v1/haem/interpret", STAFF, postHaem),
  guarded("POST", "/v1/refusals/classify", ALL_ROLES, postClassify),
  guarded("POST", "/v1/couples/:id/escalations/evaluate", STAFF, postEvaluateEscalations, true),

  guarded("GET", "/v1/closure/schema", MEMBER_OR_STAFF, getClosureSchema),
  guarded("POST", "/v1/couples/:id/closure/patient", MEMBER, postPatientClosure, true),
  guarded("POST", "/v1/couples/:id/closure/clinician", STAFF, postClinicianProforma, true),
  guarded("GET", "/v1/couples/:id/teachback", MEMBER_OR_STAFF, getTeachBack, true),
  guarded("POST", "/v1/couples/:id/teachback", MEMBER_OR_STAFF, postTeachBack, true),

  guarded("GET", "/v1/programme/kpis", FIGURES, getKpis),
  guarded("GET", "/v1/eval/scoreboard", ["judge", "programme", "counsellor", "clinician"], getScoreboard),
];

function normalisePath(raw: string): string {
  const withoutQuery = raw.split("?")[0] ?? "";
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
  return trimmed === "" ? "/" : trimmed;
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function personaFor(store: MockStore, token: string | null): Persona | null {
  if (token === null) return null;
  const bare = token.replace(/^Bearer\s+/i, "").trim();
  if (bare === "") return null;
  return store.personas.find((p) => p.token === bare) ?? null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function dispatch(req: MockRequest, store: MockStore): Reply {
  const path = normalisePath(req.path);
  const method = req.method.toUpperCase();
  const normalised: MockRequest = { ...req, path, method };
  const matches = ROUTES.flatMap((route) => {
    const found = route.pattern.exec(path);
    return found === null ? [] : [{ route, params: found.slice(1).map(decodeParam) }];
  });
  if (matches.length === 0) return notFound(normalised, `No endpoint at ${path}.`);
  const hit = matches.find((m) => m.route.method === method);
  if (hit === undefined) {
    const allowed = [...new Set(matches.map((m) => m.route.method))].join(", ");
    const reply = problem(normalised, 405, "Method not allowed", `This path accepts ${allowed}.`);
    return reply;
  }

  const { route, params } = hit;
  const persona = personaFor(store, req.token);
  if (isPublicRoute(route)) {
    return route.handle({ req: normalised, store, persona, params, query: req.query });
  }
  if (persona === null) {
    return problem(normalised, 401, "Authentication required", "A valid demo token is required for this endpoint.");
  }
  if (!route.access.includes(persona.role)) {
    return forbidden(normalised, `The ${persona.role} role cannot call this endpoint.`);
  }
  if (route.scoped) {
    const coupleId = params[0] ?? "";
    if (persona.role === "couple_member" && persona.couple_id !== coupleId) {
      return forbidden(normalised, "Couple members can only reach their own couple.");
    }
  }
  return route.handle({ req: normalised, store, persona, params, query: req.query });
}

/**
 * Answers one request. Never throws: an unexpected fault becomes a 500 problem-details object so the UI shows an
 * error state instead of a crash.
 */
export async function handleMock(req: MockRequest): Promise<MockResponse> {
  if (process.env.BAYAN_MOCK_LATENCY === "1") {
    await sleep(40 + Math.floor(Math.random() * 81));
  }
  try {
    return dispatch(req, getStore());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown fault in the mock backend.";
    return problem(req, 500, "Mock backend error", message);
  }
}
