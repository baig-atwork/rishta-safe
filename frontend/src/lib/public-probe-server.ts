import { toBackendRequest } from "@/lib/api/real/adapter";
import { serverApi, settle } from "@/lib/api/server";
import { callBackend, isMockMode } from "@/lib/api/upstream";
import type { AuditEvent, AuditVerification, Persona } from "@/lib/api/types";
import { PROBE_IDS, previewProbe } from "@/lib/public-probes";
import type { AuditRowView, PersonaLike, ProbeDeps, ProbeId, ProbePreviewStep, ProbeRequest, RawReply, VerifyView } from "@/lib/public-probes";

/**
 * Server-only I/O for the Evidence probes. Persona tokens are read here and used here; they never go in a return value,
 * so they never reach the browser. In mock mode the request goes to the in-process mock; otherwise it goes to the real
 * backend as a plain HTTP request and the response body is returned exactly as the backend wrote it (no mapping), so the
 * page can show the wire response, including fields the app's own types drop (reason, legal_basis).
 */

function timeoutMs(): number {
  const parsed = Number(process.env["BAYAN_API_TIMEOUT_MS"] ?? "8000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

async function sendReal(token: string, wire: ProbeRequest): Promise<RawReply> {
  const base = (process.env["BAYAN_API_URL"] ?? "http://localhost:8000").replace(/[/]+$/, "");
  const headers: Record<string, string> = { Accept: "application/json, application/problem+json", Authorization: `Bearer ${token}` };
  let body: string | undefined;
  if (wire.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(wire.body);
  }
  const started = Date.now();
  try {
    const init: RequestInit = { method: wire.method, headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs()) };
    if (body !== undefined) init.body = body;
    const response = await fetch(`${base}${wire.path}`, init);
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { title: "Unreadable response", detail: text.slice(0, 200) };
      }
    }
    return { status: response.status, body: parsed, correlationId: response.headers.get("x-correlation-id") ?? response.headers.get("x-request-id"), ms: Date.now() - started };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      status: 0,
      body: { title: timedOut ? "The service took too long to respond" : "The service could not be reached", detail: "No response came back. Try again." },
      correlationId: null,
      ms: Date.now() - started,
    };
  }
}

async function sendMock(token: string, wire: ProbeRequest): Promise<RawReply> {
  const started = Date.now();
  const result = await callBackend({ method: wire.method, path: wire.path, ...(wire.body === undefined ? {} : { body: wire.body }) }, token);
  return { status: result.status, body: result.body, correlationId: result.correlationId, ms: Date.now() - started };
}

function auditRow(event: AuditEvent): AuditRowView {
  return { index: event.index, at: event.at, actor: event.actor_role, action: event.action, detail: event.detail, prevHash: event.prev_hash, hash: event.hash };
}

/** Builds the runner's I/O from the persona list. `personas` carry tokens: keep them inside this closure. */
export function buildProbeDeps(personas: readonly Persona[]): ProbeDeps {
  const byId = new Map(personas.map((p) => [p.id, p] as const));
  const judge = personas.find((p) => p.role === "judge");
  const like: PersonaLike[] = personas.map((p) => ({ id: p.id, display_name: p.display_name, role: p.role, couple_id: p.couple_id }));

  return {
    personas: like,
    async send(personaId, request) {
      const persona = byId.get(personaId);
      if (!persona) throw new Error(`Unknown persona ${personaId}.`);
      // The real branch sends what the backend expects (the adapter's request mapping); the wire request is shown as sent.
      const wire = isMockMode() ? request : (toBackendRequest({ method: request.method, path: request.path, body: request.body }) as ProbeRequest);
      const reply = isMockMode() ? await sendMock(persona.token, wire) : await sendReal(persona.token, wire);
      return { ...reply, wire };
    },
    async readAudit(coupleId) {
      if (!judge) throw new Error("No judge persona is available to read the audit log.");
      const result = await callBackend({ method: "GET", path: `/v1/couples/${coupleId}/audit` }, judge.token);
      if (result.status < 200 || result.status >= 300 || !Array.isArray(result.body)) {
        throw new Error(`The audit log answered ${result.status}.`);
      }
      return (result.body as AuditEvent[]).map(auditRow);
    },
    async verify(): Promise<VerifyView> {
      if (!judge) throw new Error("No judge persona is available to verify the chain.");
      const result = await callBackend({ method: "GET", path: "/v1/audit/verify" }, judge.token);
      if (result.status < 200 || result.status >= 300 || typeof result.body !== "object" || result.body === null) {
        throw new Error(`The chain check answered ${result.status}.`);
      }
      const body = result.body as AuditVerification;
      return { ok: body.ok, length: body.length ?? null, firstBadIndex: body.first_bad_index ?? null };
    },
  };
}

/**
 * Every probe's planned request and the persona that would send it, planned here so the console ships no planning code.
 * Token-free. `null` when the persona list cannot be read (the console then shows no preview and still works).
 */
export async function loadProbePreviews(): Promise<Partial<Record<ProbeId, ProbePreviewStep[]>> | null> {
  const result = await settle(() => serverApi().personas());
  if (!result.data) return null;
  const personas: PersonaLike[] = result.data.map((p) => ({ id: p.id, display_name: p.display_name, role: p.role, couple_id: p.couple_id }));
  const out: Partial<Record<ProbeId, ProbePreviewStep[]>> = {};
  for (const id of PROBE_IDS) {
    const steps = previewProbe(id, personas, { text: "", locale: "en" });
    if (steps !== null) out[id] = steps;
  }
  return out;
}
