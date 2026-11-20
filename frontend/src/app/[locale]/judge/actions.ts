"use server";

import { serverApi } from "@/lib/api/server";
import { ApiError } from "@/lib/api/transport";
import { isProbeId, ProbeError, runProbe, type ProbeInput, type ProbeRun } from "@/lib/public-probes";
import { buildProbeDeps } from "@/lib/public-probe-server";
import { readSession } from "@/lib/session";

export type ProbeActionResult =
  | { ok: true; run: ProbeRun }
  | { ok: false; status: number; message: string; correlationId: string | null };

/**
 * Runs one Evidence probe. It acts as the stated synthetic persona on the server (the persona tokens come from
 * GET /v1/demo/personas and never leave it). Only the judge lens (and the programme lens that may read this page) can call it.
 */
export async function runProbeAction(probeId: string, input: ProbeInput): Promise<ProbeActionResult> {
  const session = await readSession();
  if (!session || (session.role !== "judge" && session.role !== "programme")) {
    return { ok: false, status: 403, message: "Choose the judge lens to run probes.", correlationId: null };
  }
  if (!isProbeId(probeId)) return { ok: false, status: 400, message: "Unknown probe.", correlationId: null };

  try {
    const personas = await serverApi().personas();
    const run = await runProbe(buildProbeDeps(personas), probeId, { text: input.text, locale: input.locale });
    return { ok: true, run };
  } catch (error) {
    if (error instanceof ProbeError) {
      return { ok: false, status: error.code === "bad_input" ? 422 : 409, message: error.message, correlationId: null };
    }
    if (error instanceof ApiError) {
      return { ok: false, status: error.status, message: error.problem.detail ?? error.problem.title, correlationId: error.correlationId };
    }
    return { ok: false, status: 500, message: error instanceof Error ? error.message : "The probe failed.", correlationId: null };
  }
}
