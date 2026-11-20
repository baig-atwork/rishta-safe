# 0162: One typed API adapter, two transports, and a runtime mock switch

Status: accepted (2026-11-20). Lane D (frontend).

## Context

The backend was written in parallel with the UI. The brief asked for typed fixtures behind one adapter and a `NEXT_PUBLIC_BAYAN_MOCK=1` switch, with the adapter calling the real API at `/api/v1/*` through a Next route handler that proxies to `BAYAN_API_URL`.

## Decision

`src/lib/api/endpoints.ts` is the only place that knows paths and shapes (`createApi(transport)`). Two transports: the server transport (server components and server actions) calls the backend or the mock directly with the session token from an httpOnly cookie; the browser transport always calls the same-origin `/api/v1/*` route handler, which attaches the token and forwards with an explicit timeout (`BAYAN_API_TIMEOUT_MS`, default 8 s), passing RFC 9457 problem-details bodies through unchanged and returning 502 or 504 problem details for unreachable or slow upstreams. Mock mode is read at runtime on the server (`BAYAN_MOCK=1` or `NEXT_PUBLIC_BAYAN_MOCK=1`), so a built image can switch without a rebuild; fixtures and their mutable state (`globalThis`, shared by route handlers and server components) live in `src/lib/api/mock/` and are never imported by client code.

Deviation from the brief, on purpose: server components do not make an HTTP hop to their own `/api/v1` route; they call the same upstream function the route handler uses.

## Consequences

One code path to the data for both transports; the session token never reaches the browser; phase 2 replaces hand-written types with the `openapi-typescript` output behind the same `createApi` surface.
