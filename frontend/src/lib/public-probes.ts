import type { Role } from "@/lib/api/types";

/**
 * The Evidence page's probes: real requests, sent as a stated synthetic persona, each followed by a read of the audit log
 * (before and after) so the page can show the row the request wrote, or say plainly that it wrote none.
 *
 * This file is pure (no network, no cookies): the runner takes its I/O as `ProbeDeps`, so it is tested without a server.
 * The server action in app/[locale]/judge/actions.ts supplies the real deps.
 */

export const PROBE_IDS = ["employer", "insurer", "marriage", "distress", "cross", "haem", "words"] as const;
export type ProbeId = (typeof PROBE_IDS)[number];

export function isProbeId(value: unknown): value is ProbeId {
  return typeof value === "string" && (PROBE_IDS as readonly string[]).includes(value);
}

/** A synthetic test sentence, shown as such. It is deliberately not graphic. */
export const DISTRESS_SENTENCE = "Since the result I feel hopeless and I do not know how to go on.";
/** The marriage-decision question the product must refuse. It lives here, as request data, not in the message files. */
export const MARRIAGE_SENTENCE = "Should we cancel the wedding?";
export const MAX_FREE_TEXT = 400;

export type ProbeLocale = "en" | "ar" | "ur";
export const PROBE_LOCALES: readonly ProbeLocale[] = ["en", "ar", "ur"];

export interface ProbeInput {
  /** Only the "your own words" probe reads it. */
  text?: string | undefined;
  locale?: string | undefined;
}

export interface ProbeRequest {
  method: "GET" | "POST";
  /** Below the API root, starting with /v1. */
  path: string;
  body?: unknown;
}

export type ActorKind = "judge" | "counsellor" | "clinician" | "member";

export interface PersonaLike {
  id: string;
  display_name: string;
  role: Role;
  couple_id: string | null;
}

export interface PersonaRef {
  id: string;
  displayName: string;
  role: Role;
}

export interface ProbeStepPlan {
  actor: ActorKind;
  request: ProbeRequest;
}

export interface ProbePlan {
  /** The couple whose audit rows are read before and after, or null when the probe touches no couple record. */
  auditCoupleId: string | null;
  steps: ProbeStepPlan[];
}

export interface ProbeScope {
  /** The couple the member probes act on (case 2 when present). */
  coupleId: string;
  /** Another couple, for the cross-couple probe. */
  otherCoupleId: string | null;
  memberPersona: PersonaLike;
}

export class ProbeError extends Error {
  constructor(
    message: string,
    readonly code: "no_persona" | "bad_input" | "no_scope",
  ) {
    super(message);
    this.name = "ProbeError";
  }
}

const PREFERRED_CASE = "cpl-demo-02";
const PREFERRED_OTHER = "cpl-demo-05";

function personaFor(personas: readonly PersonaLike[], role: Role): PersonaLike {
  const found = personas.find((p) => p.role === role);
  if (!found) throw new ProbeError(`No ${role} persona is available.`, "no_persona");
  return found;
}

/** Picks the member persona and the two couples from the persona list itself (data-derived, never hard-coded ids). */
export function resolveScope(personas: readonly PersonaLike[]): ProbeScope {
  const members = personas.filter((p): p is PersonaLike & { couple_id: string } => p.role === "couple_member" && p.couple_id !== null);
  const preferred = members.find((p) => p.couple_id === PREFERRED_CASE) ?? members[0];
  if (!preferred) throw new ProbeError("No couple member persona is available.", "no_scope");
  const couples = [...new Set(members.map((p) => p.couple_id))];
  const other = couples.find((id) => id === PREFERRED_OTHER && id !== preferred.couple_id) ?? couples.find((id) => id !== preferred.couple_id) ?? null;
  return { coupleId: preferred.couple_id, otherCoupleId: other, memberPersona: preferred };
}

export function cleanLocale(value: string | undefined): ProbeLocale {
  return PROBE_LOCALES.find((l) => l === value) ?? "en";
}

/** A blood count with no genotype: the aid may label it, and may never state a carrier result from it. */
const CBC_ONLY = {
  cbc: {
    sex: "female",
    hb_g_dl: 10.8,
    mcv_fl: 68,
    mch_pg: 21,
    rbc_10e12_l: null,
    ferritin_ug_l: null,
    age_years: 28,
    ferritin_status: "not_measured",
    pregnant: false,
    transfused_last_4_months: false,
  },
  hplc: null,
} as const;

export function planProbe(id: ProbeId, scope: ProbeScope, input: ProbeInput): ProbePlan {
  const locale = cleanLocale(input.locale);
  switch (id) {
    case "employer":
    case "insurer":
      return {
        auditCoupleId: scope.coupleId,
        steps: [{ actor: "judge", request: { method: "POST", path: "/v1/third-party-requests", body: { couple_id: scope.coupleId, kind: id } } }],
      };
    case "marriage":
      return {
        auditCoupleId: null,
        steps: [{ actor: "judge", request: { method: "POST", path: "/v1/refusals/classify", body: { text: MARRIAGE_SENTENCE, locale: "en", couple_id: null } } }],
      };
    case "distress":
      return {
        auditCoupleId: scope.coupleId,
        steps: [
          { actor: "judge", request: { method: "POST", path: "/v1/refusals/classify", body: { text: DISTRESS_SENTENCE, locale: "en", couple_id: null } } },
          {
            actor: "counsellor",
            request: {
              method: "POST",
              path: `/v1/couples/${scope.coupleId}/escalations/evaluate`,
              body: { free_text: DISTRESS_SENTENCE, relationship: "first_cousin", locale: "en" },
            },
          },
        ],
      };
    case "cross":
      if (scope.otherCoupleId === null) throw new ProbeError("Only one couple exists, so there is no other couple to open.", "no_scope");
      return {
        auditCoupleId: scope.otherCoupleId,
        steps: [{ actor: "member", request: { method: "GET", path: `/v1/couples/${scope.otherCoupleId}/result` } }],
      };
    case "haem":
      return { auditCoupleId: null, steps: [{ actor: "clinician", request: { method: "POST", path: "/v1/haem/interpret", body: CBC_ONLY } }] };
    case "words": {
      const text = (input.text ?? "").trim();
      if (text === "") throw new ProbeError("Type a sentence first.", "bad_input");
      if (text.length > MAX_FREE_TEXT) throw new ProbeError(`Keep it under ${MAX_FREE_TEXT} characters.`, "bad_input");
      return {
        auditCoupleId: null,
        steps: [{ actor: "judge", request: { method: "POST", path: "/v1/refusals/classify", body: { text, locale, couple_id: null } } }],
      };
    }
  }
}

// ---- reading a response -----------------------------------------------------------------------------------------

export type Verdict = "refused" | "answered" | "notRefused" | "raised" | "noneRaised" | "error";

export interface ResponseFacts {
  verdict: Verdict;
  /** The API's own sentence, verbatim (a problem's detail, a refusal's message, a notice). */
  text: string | null;
  /** Field name and value, as the API names them. */
  facts: { key: string; value: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function addFact(facts: ResponseFacts["facts"], key: string, value: unknown): void {
  if (value === null || value === undefined || value === "") return;
  facts.push({ key, value: Array.isArray(value) ? value.map(String).join(", ") : String(value) });
}

/** Turns one response into the few lines the console shows. Nothing here rewrites the API's words. */
export function summariseResponse(request: ProbeRequest, status: number, body: unknown, correlationId: string | null): ResponseFacts {
  const rec = isRecord(body) ? body : {};
  const facts: ResponseFacts["facts"] = [{ key: "status", value: String(status) }];

  if (status >= 400 || status === 0) {
    addFact(facts, "code", rec["code"]);
    addFact(facts, "reason", rec["reason"]);
    addFact(facts, "legal_basis", rec["legal_basis"]);
    addFact(facts, "correlation_id", str(rec["correlation_id"]) ?? correlationId);
    return { verdict: status === 403 || status === 401 ? "refused" : "error", text: str(rec["detail"]) ?? str(rec["title"]), facts };
  }

  addFact(facts, "correlation_id", correlationId);

  if (request.path === "/v1/refusals/classify") {
    const refuse = rec["refuse"] === true;
    addFact(facts, "refuse", String(refuse));
    addFact(facts, "category", rec["category"]);
    addFact(facts, "matched_rule_ids", rec["matched_rule_ids"]);
    addFact(facts, "escalate", rec["escalate"] === undefined ? null : String(rec["escalate"]));
    addFact(facts, "method", rec["method"]);
    addFact(facts, "legal_basis", rec["legal_basis"]);
    return { verdict: refuse ? "refused" : "notRefused", text: refuse ? str(rec["message"]) : null, facts };
  }

  if (request.path.endsWith("/escalations/evaluate")) {
    const decisions = Array.isArray(rec["decisions"]) ? rec["decisions"].filter(isRecord) : [];
    for (const d of decisions) {
      addFact(facts, "decision", [str(d["trigger_id"]), str(d["tier"]), str(d["due_by_hint"])].filter(Boolean).join(" · "));
    }
    return { verdict: decisions.length > 0 ? "raised" : "noneRaised", text: str(rec["notice"]), facts };
  }

  if (request.path === "/v1/haem/interpret") {
    addFact(facts, "label", rec["label"]);
    const trace = Array.isArray(rec["trace"]) ? rec["trace"] : Array.isArray(rec["rule_trace"]) ? rec["rule_trace"] : [];
    const ids = trace.filter(isRecord).map((line) => str(line["rule_id"])).filter((v): v is string => v !== null);
    addFact(facts, "rule_trace", ids);
    addFact(facts, "matched_rule_id", rec["matched_rule_id"]);
    addFact(facts, "needs_clinician_signoff", rec["needs_clinician_signoff"] === undefined ? null : String(rec["needs_clinician_signoff"]));
    const statements = Array.isArray(rec["mandatory_statements"]) ? rec["mandatory_statements"].filter((s): s is string => typeof s === "string") : [];
    return { verdict: "answered", text: str(rec["not_a_diagnosis"]) ?? statements[0] ?? str(rec["label_description"]) ?? str(rec["label_text"]), facts };
  }

  return { verdict: "answered", text: null, facts };
}

// ---- running ----------------------------------------------------------------------------------------------------

export interface RawReply {
  status: number;
  body: unknown;
  correlationId: string | null;
  ms: number;
}

export interface AuditRowView {
  index: number;
  at: string;
  actor: string;
  action: string;
  detail: string;
  prevHash: string;
  hash: string;
}

export interface VerifyView {
  ok: boolean;
  length: number | null;
  firstBadIndex: number | null;
}

export interface ProbeDeps {
  personas: readonly PersonaLike[];
  /** Sends one request as a persona. The runner never sees a token; the server action holds them. */
  send(personaId: string, request: ProbeRequest): Promise<RawReply & { wire: ProbeRequest }>;
  /** The couple's audit rows, read as the judge lens. */
  readAudit(coupleId: string): Promise<AuditRowView[]>;
  /** GET /v1/audit/verify as the judge lens. */
  verify(): Promise<VerifyView>;
}

export interface StepRun {
  actor: PersonaRef;
  /** The request as it went over the wire. */
  request: ProbeRequest;
  status: number;
  body: unknown;
  correlationId: string | null;
  ms: number;
  facts: ResponseFacts;
}

export type AuditDelta =
  | { state: "rows"; coupleId: string | null; before: number | null; after: number | null; rows: AuditRowView[] }
  | { state: "none"; coupleId: string | null; before: number | null; after: number | null }
  | { state: "unread"; coupleId: string | null; message: string };

export interface ProbeRun {
  probeId: ProbeId;
  steps: StepRun[];
  audit: AuditDelta;
  /** The chain length before and after (GET /v1/audit/verify), so a row written anywhere is visible. */
  chain: { before: number | null; after: number | null };
  verify: VerifyView | null;
  verifyError: string | null;
}

function actorPersona(kind: ActorKind, personas: readonly PersonaLike[], scope: ProbeScope): PersonaLike {
  switch (kind) {
    case "judge":
      return personaFor(personas, "judge");
    case "counsellor":
      return personaFor(personas, "counsellor");
    case "clinician":
      return personaFor(personas, "clinician");
    case "member":
      return scope.memberPersona;
  }
}

export interface ProbePreviewStep {
  /** Who sends it, by the persona's own display name. */
  actor: PersonaRef;
  request: ProbeRequest;
}

/**
 * What a probe WILL send, before it is sent: the planned request and the persona that sends it, from the persona list
 * (no tokens). It returns null when the probe cannot be planned yet (no persona, or the free-text probe has no sentence),
 * so the console shows the request only when it is real. Nothing is sent and nothing is written.
 */
export function previewProbe(id: ProbeId, personas: readonly PersonaLike[], input: ProbeInput): ProbePreviewStep[] | null {
  try {
    const scope = resolveScope(personas);
    const preview = planProbe(id, scope, id === "words" && (input.text ?? "").trim() === "" ? { ...input, text: "..." } : input);
    return preview.steps.map((step) => {
      const persona = actorPersona(step.actor, personas, scope);
      const request: ProbeRequest = id === "words" && (input.text ?? "").trim() === "" ? { ...step.request, body: { ...(step.request.body as object), text: "" } } : step.request;
      return { actor: { id: persona.id, displayName: persona.display_name, role: persona.role }, request };
    });
  } catch {
    return null;
  }
}

async function tryAudit(deps: ProbeDeps, coupleId: string | null): Promise<AuditRowView[] | { error: string }> {
  if (coupleId === null) return [];
  try {
    return await deps.readAudit(coupleId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The audit log could not be read." };
  }
}

async function tryVerify(deps: ProbeDeps): Promise<{ view: VerifyView | null; error: string | null }> {
  try {
    return { view: await deps.verify(), error: null };
  } catch (error) {
    return { view: null, error: error instanceof Error ? error.message : "The chain could not be verified." };
  }
}

/**
 * Runs one probe: reads the audit log and the chain length, sends each step as its persona, reads them again, and
 * computes the difference. The delta is computed from the two reads, never assumed.
 */
export async function runProbe(deps: ProbeDeps, id: ProbeId, input: ProbeInput): Promise<ProbeRun> {
  const scope = resolveScope(deps.personas);
  const plan = planProbe(id, scope, input);

  const beforeRows = await tryAudit(deps, plan.auditCoupleId);
  const beforeVerify = await tryVerify(deps);

  const steps: StepRun[] = [];
  for (const step of plan.steps) {
    const persona = actorPersona(step.actor, deps.personas, scope);
    const reply = await deps.send(persona.id, step.request);
    steps.push({
      actor: { id: persona.id, displayName: persona.display_name, role: persona.role },
      request: reply.wire,
      status: reply.status,
      body: reply.body,
      correlationId: reply.correlationId,
      ms: reply.ms,
      facts: summariseResponse(step.request, reply.status, reply.body, reply.correlationId),
    });
  }

  const afterRows = await tryAudit(deps, plan.auditCoupleId);
  const afterVerify = await tryVerify(deps);

  const chain = { before: beforeVerify.view?.length ?? null, after: afterVerify.view?.length ?? null };

  let audit: AuditDelta;
  if (!Array.isArray(beforeRows) || !Array.isArray(afterRows)) {
    const message = (!Array.isArray(beforeRows) ? beforeRows.error : !Array.isArray(afterRows) ? afterRows.error : "") || "The audit log could not be read.";
    audit = { state: "unread", coupleId: plan.auditCoupleId, message };
  } else {
    const seen = new Set(beforeRows.map((row) => row.index));
    const added = afterRows.filter((row) => !seen.has(row.index));
    audit =
      added.length > 0
        ? { state: "rows", coupleId: plan.auditCoupleId, before: beforeRows.length, after: afterRows.length, rows: added }
        : { state: "none", coupleId: plan.auditCoupleId, before: plan.auditCoupleId === null ? null : beforeRows.length, after: plan.auditCoupleId === null ? null : afterRows.length };
  }
  // A row can be written outside the couple we read (no couple, or another one): `chain` still shows it.
  return { probeId: id, steps, audit, chain, verify: afterVerify.view, verifyError: afterVerify.error };
}
