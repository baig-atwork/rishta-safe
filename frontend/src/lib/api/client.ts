"use client";

import { ApiError, buildQuery, problemFromUnknown, type ApiRequest, type Transport } from "./transport";
import { createApi } from "./endpoints";

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Browser transport: always the same-origin proxy, which attaches the session token server-side. */
const clientTransport: Transport = async <T,>(req: ApiRequest): Promise<T> => {
  const init: RequestInit = {
    method: req.method,
    headers: {
      Accept: "application/json, application/problem+json",
      ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "same-origin",
  };
  if (req.body !== undefined) init.body = JSON.stringify(req.body);
  let response: Response;
  try {
    response = await fetch(`/api${req.path}${buildQuery(req.query)}`, init);
  } catch {
    throw new ApiError({ type: "about:blank", title: "No connection", status: 0, detail: "The request did not reach the server." });
  }
  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;
  if (!response.ok) throw new ApiError(problemFromUnknown(response.status, payload, "The request failed"));
  return payload as T;
};

export const clientApi = createApi(clientTransport);
