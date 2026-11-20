import { serverApi, settle } from "@/lib/api/server";
import { ApiError, problemFromUnknown } from "@/lib/api/transport";
import { callBackend } from "@/lib/api/upstream";
import { toBenchPersona, type BenchPersona, type DemoCase } from "@/lib/public-bench";

export interface BenchData {
  cases: DemoCase[] | null;
  casesError: ApiError | null;
  /** Token-free. `null` when the persona list could not be read (the lenses are then unavailable). */
  personas: BenchPersona[] | null;
}

/** GET /v1/demo/cases (open) and GET /v1/demo/personas. The persona tokens are dropped before anything is returned. */
export async function loadBench(): Promise<BenchData> {
  const [cases, personas] = await Promise.all([
    settle(async () => {
      const result = await callBackend({ method: "GET", path: "/v1/demo/cases" }, null);
      if (result.status < 200 || result.status >= 300 || !Array.isArray(result.body)) {
        throw new ApiError(problemFromUnknown(result.status, result.body, "The cases could not be loaded"));
      }
      return result.body as DemoCase[];
    }),
    settle(() => serverApi().personas()),
  ]);
  return {
    cases: cases.data,
    casesError: cases.error,
    personas: personas.data ? personas.data.map(toBenchPersona) : null,
  };
}
