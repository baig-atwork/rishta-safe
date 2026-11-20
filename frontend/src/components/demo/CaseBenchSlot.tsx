import { loadBench } from "@/lib/public-bench-server";
import { CaseBench } from "./CaseBench";

/**
 * Drop-in for Lane A's LensControl slot: `<SiteHeader ... lensSlot={<CaseBenchSlot />} />`. It loads the cases and the
 * (token-free) personas itself and renders the compact bench. If the cases cannot be read it renders nothing, and the
 * dialog keeps its own fallback list of lenses.
 */
export async function CaseBenchSlot() {
  const { cases, personas } = await loadBench();
  if (cases === null || cases.length === 0) return null;
  return <CaseBench compact cases={cases} personas={personas ?? []} personasFailed={personas === null} />;
}
