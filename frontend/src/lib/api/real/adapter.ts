import { CONSENT_PURPOSES } from "../types";
import type {
  AuditEvent,
  AuditVerification,
  ConsentRecord,
  CounsellorBrief,
  CoupleCase,
  DisclosedResult,
  EscalationDecision,
  EscalationItem,
  ExplainerDoc,
  GlossaryEntry,
  Persona,
  ProblemDetails,
  ProgrammeKpis,
  ResultEnvelope,
  ReviewPriority,
  Role,
  Scoreboard,
} from "../types";
import type { ApiRequest } from "../transport";
import { mapClosureRecord, mapClosureSchema, mapTeachbackQuiz, mapTeachbackResult, localeFrom, proformaFieldPath, toRealPatientClosure, toRealProforma, toRealTeachback } from "./closure";
import { AdapterError, isRecord, parseReal } from "./errors";
import { mapHaemInterpretation, toRealHaemRequest } from "./haem";
import { mapCommunicateBody, mapPathwayBody, mapReferrals } from "./pathway";
import {
  auditSchema,
  auditVerificationSchema,
  briefSchema,
  consentListSchema,
  consentRecordSchema,
  coupleSchema,
  escalationDecisionSchema,
  escalationQueueSchema,
  explainerDocSchema,
  glossarySchema,
  kpisSchema,
  personasSchema,
  resetSchema,
  resultViewSchema,
  roleSchema,
  scoreboardSchema,
} from "./schemas";
import type { z } from "zod";

/**
 * Anti-corruption layer between the UI's types (src/lib/api/types.ts) and the REAL FastAPI backend.
 *
 * The UI sends the shapes in endpoints.ts. `toBackendRequest` turns each into the real request (path, body, query);
 * `fromBackendResponse` turns the real JSON into the UI type for that endpoint; `normalizeProblem` turns the real
 * application/problem+json into the UI's ProblemDetails. Components and endpoints.ts stay unchanged.
 *
 * Wherever the real shape cannot satisfy a UI field the adapter picks a safe default and marks it `// GAP:` so the
 * list can be reviewed (`grep -rn "GAP:" src/lib/api/real`). It never invents clinical content or numbers.
 */

// ---- routing ---------------------------------------------------------------------------------------------

type RouteName =
  | "personas"
  | "reset"
  | "couple"
  | "pathway"
  | "advance"
  | "referrals"
  | "result"
  | "options"
  | "glossary"
  | "consents"
  | "grantConsent"
  | "revokeConsent"
  | "audit"
  | "verifyAudit"
  | "thirdParty"
  | "escalations"
  | "brief"
  | "haem"
  | "closureSchema"
  | "patientClosure"
  | "clinicianProforma"
  | "teachback"
  | "submitTeachback"
  | "kpis"
  | "scoreboard";

interface Matched {
  name: RouteName;
  coupleId: string | null;
}

const ROUTES: readonly { method: ApiRequest["method"]; pattern: RegExp; name: RouteName }[] = [
  { method: "GET", pattern: /^\/v1\/demo\/personas$/, name: "personas" },
  { method: "POST", pattern: /^\/v1\/demo\/reset$/, name: "reset" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)$/, name: "couple" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/pathway$/, name: "pathway" },
  { method: "POST", pattern: /^\/v1\/couples\/([^/]+)\/pathway\/events$/, name: "advance" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/referrals$/, name: "referrals" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/result$/, name: "result" },
  { method: "GET", pattern: /^\/v1\/explain\/options$/, name: "options" },
  { method: "GET", pattern: /^\/v1\/explain\/glossary$/, name: "glossary" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/consents$/, name: "consents" },
  { method: "POST", pattern: /^\/v1\/couples\/([^/]+)\/consents$/, name: "grantConsent" },
  { method: "POST", pattern: /^\/v1\/consents\/[^/]+\/revoke$/, name: "revokeConsent" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/audit$/, name: "audit" },
  { method: "GET", pattern: /^\/v1\/audit\/verify$/, name: "verifyAudit" },
  { method: "POST", pattern: /^\/v1\/third-party-requests$/, name: "thirdParty" },
  { method: "GET", pattern: /^\/v1\/escalations$/, name: "escalations" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/brief$/, name: "brief" },
  { method: "POST", pattern: /^\/v1\/haem\/interpret$/, name: "haem" },
  { method: "GET", pattern: /^\/v1\/closure\/schema$/, name: "closureSchema" },
  { method: "POST", pattern: /^\/v1\/couples\/([^/]+)\/closure\/patient$/, name: "patientClosure" },
  { method: "POST", pattern: /^\/v1\/couples\/([^/]+)\/closure\/clinician$/, name: "clinicianProforma" },
  { method: "GET", pattern: /^\/v1\/couples\/([^/]+)\/teachback$/, name: "teachback" },
  { method: "POST", pattern: /^\/v1\/couples\/([^/]+)\/teachback$/, name: "submitTeachback" },
  { method: "GET", pattern: /^\/v1\/programme\/kpis$/, name: "kpis" },
  { method: "GET", pattern: /^\/v1\/eval\/scoreboard$/, name: "scoreboard" },
];

function matchRoute(req: ApiRequest): Matched | null {
  for (const route of ROUTES) {
    if (route.method !== req.method) continue;
    const found = route.pattern.exec(req.path);
    if (found) return { name: route.name, coupleId: found[1] ?? null };
  }
  return null;
}

// ---- request side ----------------------------------------------------------------------------------------

/** The backend's closed list of consent purposes (see CONSENT_PURPOSES in ../types). */
const KNOWN_PURPOSES: ReadonlySet<string> = new Set(CONSENT_PURPOSES);
const COUNSELLING_RECIPIENTS: ReadonlySet<string> = new Set(["counsellor", "clinician"]);

/**
 * UI `ConsentGrantInput` to the real `GrantBody`. The subject is always the caller on the real side, so it is dropped.
 * The backend accepts only its closed list of purposes (the grant form offers it as a select). A purpose that is one of
 * the listed ids is sent as is. GAP: anything else (free text from an older client) is replaced by the purpose the
 * recipient implies (a partner is partner_disclosure, the counsellor or clinician is couple_counselling) and the
 * typed text is not sent.
 */
function toRealGrant(body: unknown): unknown {
  if (!isRecord(body)) return body;
  const recipient = body["recipient_role"];
  const typed = typeof body["purpose"] === "string" ? body["purpose"].trim() : "";
  const implied = typeof recipient === "string" && COUNSELLING_RECIPIENTS.has(recipient) ? "couple_counselling" : "partner_disclosure";
  return {
    recipient,
    scope: body["scope"],
    purpose: KNOWN_PURPOSES.has(typed) ? typed : implied,
    expires_at: body["expires_at"] ?? null,
  };
}

/**
 * UI pathway body `{event}` to the real `{kind}`. `result_communicated` is rewritten to the real communicate endpoint:
 * the plain event route needs a result reference the UI does not hold, while communicate computes it and also runs
 * the escalation triggers. GAP: the UI does not ask whether a pregnancy is in progress, so the backend default (false)
 * applies and the pregnancy escalation trigger will not fire from this button.
 */
function toRealEvent(req: ApiRequest, coupleId: string): ApiRequest {
  const event = isRecord(req.body) ? req.body["event"] : undefined;
  if (event === "result_communicated") {
    return { method: "POST", path: `/v1/couples/${coupleId}/result/communicate`, body: {} };
  }
  return { ...req, body: { kind: event } };
}

export function toBackendRequest(req: ApiRequest): ApiRequest {
  const route = matchRoute(req);
  if (route === null) return req;
  switch (route.name) {
    case "advance":
      return route.coupleId === null ? req : toRealEvent(req, route.coupleId);
    case "grantConsent":
      return { ...req, body: toRealGrant(req.body) };
    case "haem":
      return { ...req, body: toRealHaemRequest(req.body) };
    case "patientClosure":
      return { ...req, body: toRealPatientClosure(req.body) };
    case "clinicianProforma":
      return { ...req, body: toRealProforma(req.body) };
    case "submitTeachback":
      return { ...req, body: toRealTeachback(req.body, req.query?.["locale"]) };
    default:
      return req;
  }
}

/**
 * Extra GET requests a mapping needs because the real endpoint splits what the UI type holds in one object. Only the
 * counsellor brief needs one: the real brief has no referral tasks. A companion that fails is left out of the result.
 */
export function companionRequests(req: ApiRequest): Record<string, ApiRequest> {
  const route = matchRoute(req);
  if (route?.name === "brief" && route.coupleId !== null) {
    return { referrals: { method: "GET", path: `/v1/couples/${route.coupleId}/referrals` } };
  }
  return {};
}

// ---- response side ---------------------------------------------------------------------------------------

export interface FromBackendOptions {
  /** Parsed JSON of the companion requests (see companionRequests), by key. */
  companions?: Record<string, unknown>;
  /** Clock for fields the real API does not carry (brief and KPI generation time). */
  now?: () => Date;
}

function mapPersonas(body: unknown): Persona[] {
  return parseReal(personasSchema, body, "demo/personas").map((p) => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    couple_id: p.couple_id,
    // A couple member's person id is the principal's subject id (prs-02a); staff personas have no person record.
    person_id: p.role === "couple_member" ? p.token.principal.subject_id : null,
    description: p.description,
    // The persona token IS the real bearer; the session cookie stores it and the proxy forwards it.
    token: p.token.access_token,
    simulated: true,
  }));
}

function mapCouple(body: unknown): CoupleCase {
  const real = parseReal(coupleSchema, body, "couple");
  return {
    couple_id: real.couple_id,
    partners: real.members.map((m) => ({
      person_id: m.person_id,
      display_name: m.display_name,
      sex: m.sex,
      ...(m.language === undefined ? {} : { language: m.language }),
    })),
    relationship: real.relationship,
    policy: real.emirate_policy,
    // GAP: the real case record does not name its panel; "default" until the backend exposes one.
    panel_id: "default",
    synthetic: true,
    created_at: real.created_at,
  };
}

function mapResult(body: unknown): ResultEnvelope {
  const real = parseReal(resultViewSchema, body, "result");
  const d = real.disclosed;
  const withheld = d.withheld_reason_key !== null;
  const disclosed: DisclosedResult = {
    couple_id: d.couple_id,
    viewer_role: d.viewer_role,
    viewer_person_id: d.viewer_person_id,
    policy: d.policy,
    // A withheld result carries no category, whatever else the backend sent.
    category: withheld ? null : d.category,
    withheld_reason_key: d.withheld_reason_key,
    shared: d.shared,
    own_findings: d.own_findings,
    partner_finding_scope: d.partner_finding_scope,
    partner_findings: d.partner_findings,
    partner_gene_names: d.partner_gene_names,
    detection: d.detection,
    relationship: d.relationship,
    review_priority: d.review_priority,
    staff_trace: d.staff_trace,
    boundary_notice_key: d.boundary_notice_key,
    certificate_note_key: d.certificate_note_key,
    ruleset_version: d.ruleset_version,
  };
  return { disclosed, explainer: real.document };
}

function mapExplainerDoc(body: unknown, where: string): ExplainerDoc {
  return parseReal(explainerDocSchema, body, where);
}

function mapGlossary(body: unknown): GlossaryEntry[] {
  return parseReal(glossarySchema, body, "explain/glossary");
}

type RealConsent = z.output<typeof consentRecordSchema>;

function mapConsent(real: RealConsent): ConsentRecord {
  if (real.scope === null) {
    throw new AdapterError("consent", `Consent ${real.consent_id} has no scope (a statutory record), so it is not a sharing consent.`);
  }
  return {
    consent_id: real.consent_id,
    couple_id: real.couple_id,
    subject_person_id: real.subject_person_id,
    recipient: real.recipient,
    scope: real.scope,
    purpose: real.purpose,
    granted_at: real.granted_at,
    expires_at: real.expires_at,
    revoked_at: real.revoked_at,
  };
}

function mapConsents(body: unknown): ConsentRecord[] {
  const real = parseReal(consentListSchema, body, "consents");
  const records: ConsentRecord[] = [];
  for (const record of real.records) {
    // GAP: a statutory_obligation record documents the legal basis of the mandatory screening, confers no sharing
    // scope and cannot be revoked. The UI lists sharing consents (every row has a scope), so those are not listed.
    if (record.basis === "statutory_obligation" || record.scope === null) continue;
    records.push(mapConsent(record));
  }
  return records;
}

function mapOneConsent(body: unknown): ConsentRecord {
  return mapConsent(parseReal(consentRecordSchema, body, "consent"));
}

function auditActor(value: string): Role | "system" {
  if (value === "system") return "system";
  const parsed = roleSchema.safeParse(value);
  // GAP: a role this app does not know is shown as external rather than dropped; the backend list is closed today.
  return parsed.success ? parsed.data : "external";
}

function mapAudit(body: unknown): AuditEvent[] {
  return parseReal(auditSchema, body, "audit").events.map((e) => {
    const pairs = e.detail.map(([key, value]) => `${key}=${value}`).join(", ");
    return {
      index: e.index,
      // The chain has no event id; the index is unique per chain and stable.
      event_id: `audit-${e.index}`,
      at: e.timestamp,
      actor_role: auditActor(e.actor_role),
      actor_id: e.actor_id,
      action: e.action,
      couple_id: e.couple_id,
      detail: pairs === "" ? `${e.outcome}: ${e.reason}` : `${e.outcome}: ${e.reason} (${pairs})`,
      prev_hash: e.prev_hash,
      hash: e.hash,
    };
  });
}

function mapAuditVerification(body: unknown): AuditVerification {
  const real = parseReal(auditVerificationSchema, body, "audit/verify");
  return {
    ok: real.ok,
    ...(real.scope !== undefined ? { scope: real.scope } : {}),
    own_events: real.own_events ?? null,
    length: real.length ?? null,
    head_hash: real.head_hash ?? null,
    first_bad_index: real.first_bad_index ?? null,
    problem: real.problem ?? null,
  };
}

// escalation -------------------------------------------------------------------------------------------------

type RealDecision = z.output<typeof escalationDecisionSchema>;

/**
 * MAPPING TABLE: the backend states how soon a human should act (`due_by_hint`); the UI shows a review priority.
 * immediate and same_session are urgent, fast_track is priority, routine is routine.
 */
const PRIORITY_BY_DUE: Readonly<Record<RealDecision["due_by_hint"], ReviewPriority>> = {
  immediate: "urgent",
  same_session: "priority",
  fast_track: "priority",
  routine: "routine",
};
const PRIORITY_RANK: Readonly<Record<ReviewPriority, number>> = { routine: 0, priority: 1, urgent: 2 };

function highest(priorities: readonly ReviewPriority[]): ReviewPriority {
  return priorities.reduce<ReviewPriority>((top, next) => (PRIORITY_RANK[next] > PRIORITY_RANK[top] ? next : top), "routine");
}

function words(key: string): string {
  return key.replace(/^escalation\./, "").replace(/_/g, " ");
}

function mapDecision(d: RealDecision): EscalationDecision {
  return {
    rule_id: d.trigger_id,
    priority: PRIORITY_BY_DUE[d.due_by_hint],
    due_by_hint: d.due_by_hint,
    // GAP: the backend publishes reason KEYS, not sentences, so this is the keys as words plus the tier and due hint,
    // in English only.
    reason: `${d.reason_keys.map(words).join("; ")} (tier: ${words(d.tier)}; due: ${words(d.due_by_hint)})`,
    source: d.source,
    tier: d.tier,
    ...(d.needs_clinician_signoff !== undefined ? { needs_clinician_signoff: d.needs_clinician_signoff } : {}),
    ...(d.needs_legal_read !== undefined ? { needs_legal_read: d.needs_legal_read } : {}),
  };
}

const DUE_RANK: Readonly<Record<RealDecision["due_by_hint"], number>> = { immediate: 3, same_session: 2, fast_track: 1, routine: 0 };

/** Most urgent first by the rule's due-by hint; equal hints keep the backend's order (a stable sort). */
function byUrgency(decisions: readonly RealDecision[]): RealDecision[] {
  return [...decisions].sort((a, b) => DUE_RANK[b.due_by_hint] - DUE_RANK[a.due_by_hint]);
}

type RealQueueRecord = z.output<typeof escalationQueueSchema>["records"][number];

/**
 * One row per couple. The backend can hold several queue records for one couple (reading a brief appends one), so the
 * records are merged: the earliest raise time, and each rule once.
 */
export function oneRecordPerCouple(records: readonly RealQueueRecord[]): RealQueueRecord[] {
  const byCouple = new Map<string, RealQueueRecord>();
  for (const record of records) {
    const current = byCouple.get(record.couple_id);
    if (current === undefined) {
      byCouple.set(record.couple_id, { ...record, decisions: [...record.decisions] });
      continue;
    }
    if (record.created_at < current.created_at) current.created_at = record.created_at;
    for (const decision of record.decisions) {
      if (!current.decisions.some((d) => d.trigger_id === decision.trigger_id)) current.decisions.push(decision);
    }
  }
  return [...byCouple.values()];
}

function mapEscalations(body: unknown): EscalationItem[] {
  return oneRecordPerCouple(parseReal(escalationQueueSchema, body, "escalations").records).map((record) => {
    const decisions = byUrgency(record.decisions).map(mapDecision);
    return {
      couple_id: record.couple_id,
      // GAP: the queue carries the couple id only; there is no display label.
      couple_label: record.couple_id,
      review_priority: highest(decisions.map((d) => d.priority)),
      decisions,
      raised_at: record.created_at,
    };
  });
}

function mapBrief(body: unknown, options: FromBackendOptions): CounsellorBrief {
  const real = parseReal(briefSchema, body, "brief");
  const escalations = byUrgency(real.escalations).map(mapDecision);
  const now = (options.now ?? (() => new Date()))();
  const traceIds = real.trace.map((line) => /^[A-Z]\d+/.exec(line)?.[0]).filter((id): id is string => id !== undefined);
  const grounded = [...new Set([...traceIds, ...real.escalations.map((d) => d.source)])];
  const referrals = options.companions?.["referrals"];
  return {
    couple_id: real.couple_id,
    // GAP: the real brief carries no timestamp; it is built on each request, so the request time is its generation time.
    generated_at: now.toISOString(),
    // GAP: a null priority (nothing to review) is shown as routine.
    review_priority: real.review_priority ?? "routine",
    // GAP: a null category (withheld) is shown as more_information_needed, the one label that claims no result.
    category: real.category ?? "more_information_needed",
    relationship: real.relationship,
    shared: real.shared,
    detection: real.detection,
    trace: real.trace,
    escalations,
    // GAP: when the referrals companion request fails this is empty, which reads as "no referral tasks".
    referral_tasks: referrals === undefined ? [] : mapReferrals(referrals),
    grounded_in: grounded,
    members: real.members.map((m) => ({ ...m, age: m.age ?? null })),
    ...(real.emirate_policy !== undefined ? { emirate_policy: real.emirate_policy } : {}),
    ...(real.pathway_state !== undefined ? { pathway_state: real.pathway_state } : {}),
    sections: real.sections,
    consent_count: real.consents.length,
    closure_record_count: real.closure_records.length,
  };
}

// programme and evaluation -------------------------------------------------------------------------------------

function mapKpis(body: unknown, options: FromBackendOptions): ProgrammeKpis {
  const real = parseReal(kpisSchema, body, "programme/kpis");
  const now = (options.now ?? (() => new Date()))();
  return {
    generated_at: now.toISOString(),
    synthetic: true,
    cases_total: real.n_cases,
    referral_target: real.referral_target_share,
    // "Eligible" is the flagged cases; the backend gives the referred SHARE of them, so completed is share x eligible.
    referral_eligible: real.n_flagged,
    referral_completed: real.share_referred === null ? 0 : Math.round(real.share_referred * real.n_flagged),
    // GAP: the backend has no per-state breakdown (and the programme role cannot list couples); the detail below is
    // what it does offer.
    by_state: [],
    detail: {
      n_closed: real.n_closed,
      n_flagged: real.n_flagged,
      time_to_result: real.time_to_result,
      time_to_referral: real.time_to_referral,
      counselling_booked: real.counselling_booked,
      counselling_completed: real.counselling_completed,
      counselling_declined: real.counselling_declined,
      counselling_uptake_booked_share: real.counselling_uptake_booked_share,
      counselling_uptake_completed_share: real.counselling_uptake_completed_share,
      share_referred: real.share_referred,
      share_referred_within_standard: real.share_referred_within_standard,
      meets_referral_target: real.meets_referral_target,
      referral_standard_days: real.referral_standard_days,
      referral_standard_is_illustrative: real.referral_standard_is_illustrative,
      open_tasks: real.open_tasks,
      stale_tasks: real.stale_tasks,
      basis: real.basis,
    },
  };
}

function mapScoreboard(body: unknown): Scoreboard {
  const real = parseReal(scoreboardSchema, body, "eval/scoreboard");
  return {
    generated_at: real.generated_at,
    synthetic: real.data_label === "synthetic",
    metrics: real.metrics.map((m) => ({
      id: m.id,
      name: m.title,
      value: m.value,
      n: m.n,
      // protocol_only (a protocol exists, nothing was run) is not_run: it has no measured value.
      status: m.status === "measured" ? "measured" : "not_run",
      method: m.method,
      does_not_show: m.does_not_show,
    })),
    caveats: real.caveats,
    code_version: real.code_version,
  };
}

export function fromBackendResponse(req: ApiRequest, body: unknown, options: FromBackendOptions = {}): unknown {
  const route = matchRoute(req);
  if (route === null) return body;
  switch (route.name) {
    case "personas":
      return mapPersonas(body);
    case "reset":
      return { ok: parseReal(resetSchema, body, "demo/reset").status === "reset" };
    case "couple":
      return mapCouple(body);
    case "pathway":
      return mapPathwayBody(body);
    case "advance": {
      const event = isRecord(req.body) ? req.body["event"] : undefined;
      return event === "result_communicated" ? mapCommunicateBody(body) : mapPathwayBody(body);
    }
    case "referrals":
      return mapReferrals(body);
    case "result":
      return mapResult(body);
    case "options":
      return mapExplainerDoc(body, "explain/options");
    case "glossary":
      return mapGlossary(body);
    case "consents":
      return mapConsents(body);
    case "grantConsent":
    case "revokeConsent":
      return mapOneConsent(body);
    case "audit":
      return mapAudit(body);
    case "verifyAudit":
      return mapAuditVerification(body);
    case "thirdParty":
      return body;
    case "escalations":
      return mapEscalations(body);
    case "brief":
      return mapBrief(body, options);
    case "haem":
      return mapHaemInterpretation(body);
    case "closureSchema":
      return mapClosureSchema(body, localeFrom(req.query?.["locale"]));
    case "patientClosure":
    case "clinicianProforma":
      return mapClosureRecord(body);
    case "teachback":
      return mapTeachbackQuiz(body);
    case "submitTeachback":
      return mapTeachbackResult(body);
    case "kpis":
      return mapKpis(body, options);
    case "scoreboard":
      return mapScoreboard(body);
  }
}

// ---- errors ----------------------------------------------------------------------------------------------

const DEFAULT_TITLE: Readonly<Record<number, string>> = {
  400: "Bad request",
  401: "Unauthenticated",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  422: "Validation failed",
  429: "Too many requests",
};

/** Real aid field names to the UI form's field names, so a server error lands on the input the clinician typed in. */
const HAEM_FIELD_NAMES: Readonly<Record<string, string>> = {
  hb_g_per_l: "hb_g_dl",
  hba2_pct: "hba2_percent",
  hbf_pct: "hbf_percent",
  variant_detected: "variant_hb_name",
};

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function formatLoc(loc: readonly (string | number)[]): string {
  return loc.map((part, index) => (typeof part === "number" ? `[${part}]` : index === 0 ? part : `.${part}`)).join("");
}

function locOf(value: unknown): (string | number)[] {
  return Array.isArray(value) ? value.filter((part): part is string | number => typeof part === "string" || typeof part === "number") : [];
}

function fieldFor(loc: (string | number)[], route: RouteName | null): string {
  if (route === "clinicianProforma") {
    const path = proformaFieldPath(loc);
    if (path !== null) return path;
  }
  if (route === "haem") {
    const mapped = loc.map((part) => (typeof part === "string" ? (HAEM_FIELD_NAMES[part] ?? part) : part));
    return formatLoc(mapped);
  }
  return formatLoc(loc);
}

/**
 * Real application/problem+json (code, detail, correlation_id, errors[{loc, msg, type}]) to the UI's ProblemDetails.
 * The status passed in wins over the body, so a refused request keeps its real status.
 */
export function normalizeProblem(status: number, body: unknown, req?: ApiRequest): ProblemDetails {
  const rec = isRecord(body) ? body : {};
  const route = req === undefined ? null : (matchRoute(req)?.name ?? null);
  const problem: ProblemDetails = {
    type: stringOf(rec["type"]) ?? "about:blank",
    title: stringOf(rec["title"]) ?? DEFAULT_TITLE[status] ?? "The request failed",
    status,
  };

  // FastAPI's own validation shape puts the list in `detail`; the app's problem+json puts it in `errors`.
  const rawErrors = Array.isArray(rec["errors"]) ? rec["errors"] : Array.isArray(rec["detail"]) ? rec["detail"] : [];
  const errors: { field: string; message: string }[] = [];
  for (const item of rawErrors) {
    if (!isRecord(item)) continue;
    const message = stringOf(item["msg"]) ?? stringOf(item["message"]);
    if (message === undefined) continue;
    const field = stringOf(item["field"]) ?? fieldFor(locOf(item["loc"]), route);
    errors.push({ field, message });
  }
  if (errors.length > 0) problem.errors = errors;

  const detail = stringOf(rec["detail"]);
  if (detail !== undefined) problem.detail = detail;
  const instance = stringOf(rec["instance"]);
  if (instance !== undefined) problem.instance = instance;
  const correlation = stringOf(rec["correlation_id"]);
  if (correlation !== undefined) problem.correlation_id = correlation;
  const code = stringOf(rec["code"]);
  if (code !== undefined) problem.code = code;
  const legal = stringOf(rec["legal_basis"]);
  if (legal !== undefined) problem.legal_basis = legal;
  return problem;
}
