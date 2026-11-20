import type { ProblemDetails } from "./types";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequest {
  method: HttpMethod;
  /** Path below the API root, always starting with /v1, e.g. /v1/couples/c-01/pathway. */
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/** One function moves a request to wherever the data lives (fixtures, the proxy, or the backend). */
export type Transport = <T>(req: ApiRequest) => Promise<T>;

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.name = "ApiError";
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }

  get correlationId(): string | null {
    return this.problem.correlation_id ?? null;
  }
}

export function problemFromUnknown(status: number, payload: unknown, fallbackTitle: string): ProblemDetails {
  if (typeof payload === "object" && payload !== null && "title" in payload && "status" in payload) {
    return payload as ProblemDetails;
  }
  return { type: "about:blank", title: fallbackTitle, status };
}

export function buildQuery(query: ApiRequest["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
