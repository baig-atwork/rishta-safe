import { NextResponse, type NextRequest } from "next/server";
import type { ApiRequest, HttpMethod } from "@/lib/api/transport";
import { callBackend } from "@/lib/api/upstream";
import { SESSION_COOKIE, parseSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await context.params;
  const session = parseSession(request.cookies.get(SESSION_COOKIE)?.value);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const token = session?.token ?? bearer;

  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: unknown;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { type: "about:blank", title: "Invalid JSON body", status: 400, correlation_id: `web-${Date.now().toString(16)}` },
          { status: 400, headers: { "content-type": "application/problem+json" } },
        );
      }
    }
  }

  const apiRequest: ApiRequest = { method: request.method as HttpMethod, path: `/v1/${path.join("/")}`, query };
  if (body !== undefined) apiRequest.body = body;
  const result = await callBackend(apiRequest, token);

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.correlationId) headers["x-correlation-id"] = result.correlationId;
  if (result.status >= 400) headers["content-type"] = "application/problem+json";
  return NextResponse.json(result.body ?? null, { status: result.status, headers });
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
