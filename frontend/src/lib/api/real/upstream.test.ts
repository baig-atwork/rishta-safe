import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import brief from "./__fixtures__/brief_09.json";
import communicate from "./__fixtures__/communicate_response.json";
import pathway05 from "./__fixtures__/pathway_05.json";
import problemForbidden from "./__fixtures__/problem_forbidden.json";
import referrals from "./__fixtures__/referrals_05.json";
import { callBackend } from "../upstream";
import type { CounsellorBrief, PathwayView, ProblemDetails } from "../types";

/** callBackend's real branch with fetch stubbed: the wiring (request translated out, answer translated back). */

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json", ...headers } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("BAYAN_MOCK", "");
  vi.stubEnv("NEXT_PUBLIC_BAYAN_MOCK", "");
  vi.stubEnv("BAYAN_API_URL", "http://backend.test/");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function calls(): { url: string; method: string | undefined; body: unknown; auth: string | undefined }[] {
  return fetchMock.mock.calls.map(([url, init]) => {
    const headers = new Headers(init?.headers);
    return {
      url: String(url),
      method: init?.method,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
      auth: headers.get("authorization") ?? undefined,
    };
  });
}

describe("callBackend (real branch)", () => {
  it("sends the translated request with the bearer token and returns the UI shape", async () => {
    fetchMock.mockResolvedValueOnce(json(pathway05, 200, { "x-correlation-id": "corr-1" }));
    const result = await callBackend({ method: "GET", path: "/v1/couples/cpl-demo-05/pathway" }, "tok-1");
    expect(calls()).toEqual([{ url: "http://backend.test/v1/couples/cpl-demo-05/pathway", method: "GET", body: undefined, auth: "Bearer tok-1" }]);
    expect(result.status).toBe(200);
    expect(result.correlationId).toBe("corr-1");
    expect((result.body as PathwayView).states.map((s) => s.key)).toContain("counselling");
  });

  it("posts the UI's result_communicated event to the real communicate endpoint", async () => {
    fetchMock.mockResolvedValueOnce(json(communicate));
    const result = await callBackend({ method: "POST", path: "/v1/couples/cpl-fixture-01/pathway/events", body: { event: "result_communicated" } }, "tok");
    expect(calls()).toEqual([{ url: "http://backend.test/v1/couples/cpl-fixture-01/result/communicate", method: "POST", body: {}, auth: "Bearer tok" }]);
    expect((result.body as PathwayView).couple_id).toBe("cpl-fixture-01");
  });

  it("fetches the referral tasks alongside a brief and merges them", async () => {
    fetchMock.mockImplementation((input) => Promise.resolve(String(input).endsWith("/referrals") ? json(referrals) : json(brief)));
    const result = await callBackend({ method: "GET", path: "/v1/couples/cpl-demo-09/brief" }, "tok");
    expect(calls().map((c) => c.url).sort()).toEqual(["http://backend.test/v1/couples/cpl-demo-09/brief", "http://backend.test/v1/couples/cpl-demo-09/referrals"]);
    expect((result.body as CounsellorBrief).referral_tasks).toHaveLength(1);
  });

  it("still answers a brief when the referral companion request fails", async () => {
    fetchMock.mockImplementation((input) => Promise.resolve(String(input).endsWith("/referrals") ? json(problemForbidden, 403) : json(brief)));
    const result = await callBackend({ method: "GET", path: "/v1/couples/cpl-demo-09/brief" }, "tok");
    expect(result.status).toBe(200);
    expect((result.body as CounsellorBrief).referral_tasks).toEqual([]);
  });

  it("passes a problem+json through as UI ProblemDetails, keeping status and correlation id", async () => {
    fetchMock.mockResolvedValueOnce(json(problemForbidden, 403));
    const result = await callBackend({ method: "GET", path: "/v1/couples/cpl-demo-03/result", query: { locale: "en" } }, "tok");
    expect(calls()[0]?.url).toBe("http://backend.test/v1/couples/cpl-demo-03/result?locale=en");
    expect(result.status).toBe(403);
    expect(result.correlationId).toBe(problemForbidden.correlation_id);
    expect(result.body as ProblemDetails).toMatchObject({ title: "Forbidden", status: 403, detail: "This record belongs to another couple.", correlation_id: problemForbidden.correlation_id });
  });

  it("turns a backend that changed shape into one 502 problem instead of throwing", async () => {
    fetchMock.mockResolvedValueOnce(json({ couple_id: "cpl-demo-05" }));
    const result = await callBackend({ method: "GET", path: "/v1/couples/cpl-demo-05/pathway" }, "tok");
    expect(result.status).toBe(502);
    expect(result.body as ProblemDetails).toMatchObject({ status: 502, title: "The service answered in a shape this app does not understand" });
    expect((result.body as ProblemDetails).detail).toContain("pathway");
  });

  it("keeps the unreachable-backend problem", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const result = await callBackend({ method: "GET", path: "/v1/couples/cpl-demo-05/pathway" }, null);
    expect(result.status).toBe(502);
    expect(result.body as ProblemDetails).toMatchObject({ title: "The service could not be reached" });
  });

  it("does not touch the network or the adapter in mock mode", async () => {
    vi.stubEnv("BAYAN_MOCK", "1");
    const result = await callBackend({ method: "GET", path: "/v1/demo/personas" }, null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body) || (typeof result.body === "object" && result.body !== null)).toBe(true);
  });
});
