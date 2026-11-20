import { buildQuery, type ApiRequest } from "./transport";
import type { ProblemDetails } from "./types";
import { companionRequests, fromBackendResponse, normalizeProblem, toBackendRequest } from "./real/adapter";
import { AdapterError } from "./real/errors";

export interface UpstreamResult {
  status: number;
  body: unknown;
  correlationId: string | null;
}

export function isMockMode(): boolean {
  const env = process.env;
  return env["BAYAN_MOCK"] === "1" || env["NEXT_PUBLIC_BAYAN_MOCK"] === "1";
}

function timeoutMs(): number {
  const parsed = Number(process.env["BAYAN_API_TIMEOUT_MS"] ?? "8000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

function problem(status: number, title: string, detail: string): UpstreamResult {
  const body: ProblemDetails = {
    type: "about:blank",
    title,
    status,
    detail,
    correlation_id: `web-${Math.random().toString(16).slice(2, 10)}`,
  };
  return { status, body, correlationId: body.correlation_id ?? null };
}

/**
 * The single server-side hop to the data: fixtures in mock mode, otherwise the real backend with an explicit
 * timeout, through the anti-corruption layer in ./real/adapter (UI request out, UI type or ProblemDetails back).
 */
export async function callBackend(req: ApiRequest, token: string | null): Promise<UpstreamResult> {
  if (isMockMode()) {
    const { handleMock } = await import("./mock/handler");
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query ?? {})) if (value !== undefined) query[key] = value;
    const res = await handleMock({ method: req.method, path: req.path, query, body: req.body ?? null, token });
    const correlationId =
      typeof res.body === "object" && res.body !== null && "correlation_id" in res.body
        ? String((res.body as { correlation_id: unknown }).correlation_id)
        : null;
    return { status: res.status, body: res.body, correlationId };
  }

  return callReal(req, token);
}

interface RawResponse {
  status: number;
  parsed: unknown;
  correlationId: string | null;
}

/** One HTTP hop to the real backend with an explicit timeout. Network failures come back as a synthetic problem result. */
async function fetchReal(req: ApiRequest, token: string | null): Promise<RawResponse | UpstreamResult> {
  const base = (process.env["BAYAN_API_URL"] ?? "http://localhost:8000").replace(/[/]+$/, "");
  const headers: Record<string, string> = { Accept: "application/json, application/problem+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let body: string | undefined;
  if (req.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.body);
  }
  try {
    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs()),
    };
    if (body !== undefined) init.body = body;
    const response = await fetch(`${base}${req.path}${buildQuery(req.query)}`, init);
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { type: "about:blank", title: "Unreadable response", status: response.status, detail: text.slice(0, 200) };
      }
    }
    return { status: response.status, parsed, correlationId: response.headers.get("x-correlation-id") };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return timedOut
      ? problem(504, "The service took too long to respond", "The request was cancelled after the timeout. You can try again.")
      : problem(502, "The service could not be reached", "The backend did not answer. You can try again.");
  }
}

function isRaw(result: RawResponse | UpstreamResult): result is RawResponse {
  return "parsed" in result;
}

/**
 * The real branch: the UI request is translated to the backend's request, the answer is translated back to the UI's
 * type (success) or to its ProblemDetails (any 4xx/5xx). The anti-corruption layer lives in ./real/adapter.
 */
async function callReal(req: ApiRequest, token: string | null): Promise<UpstreamResult> {
  const first = await fetchReal(toBackendRequest(req), token);
  if (!isRaw(first)) return first;

  if (first.status < 200 || first.status >= 300) {
    const body = normalizeProblem(first.status, first.parsed, req);
    return { status: first.status, body, correlationId: first.correlationId ?? body.correlation_id ?? null };
  }

  try {
    const companions: Record<string, unknown> = {};
    const wanted = companionRequests(req);
    await Promise.all(
      Object.entries(wanted).map(async ([key, companion]) => {
        const result = await fetchReal(companion, token);
        if (isRaw(result) && result.status >= 200 && result.status < 300) companions[key] = result.parsed;
      }),
    );
    const body = fromBackendResponse(req, first.parsed, { companions });
    return { status: first.status, body, correlationId: first.correlationId };
  } catch (error) {
    if (!(error instanceof AdapterError)) throw error;
    const failure = problem(502, "The service answered in a shape this app does not understand", error.message);
    return failure;
  }
}
