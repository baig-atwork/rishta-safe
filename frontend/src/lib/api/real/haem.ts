import type { HaemInterpretation, HaemSource } from "../types";
import { isRecord, parseReal } from "./errors";
import { haemInterpretationSchema } from "./schemas";

/**
 * Haematology aid. The UI form collects g/dL, a numeric ferritin and a free-text variant name; the real aid takes
 * g/L, the laboratory's own low/not-low ferritin flag, a closed variant list, and two HPLC answers the UI did not
 * collect before. The aid is a screening-support pattern for a clinician, never a diagnosis.
 */

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const FERRITIN_STATUS: ReadonlySet<unknown> = new Set(["low", "not_low", "not_measured"]);

/** UI variant text to the backend's closed list. Unrecognised text is "other_or_unknown", never guessed. */
function variantDetected(name: unknown, percent: number | null): string {
  const text = typeof name === "string" ? name.trim().toLowerCase().replace(/^hb\s*/, "") : "";
  if (text === "" && percent === null) return "none";
  switch (text.replace(/[\s_-]+/g, "")) {
    case "s":
      return "S";
    case "c":
      return "C";
    case "d":
    case "dpunjab":
      return "D";
    case "e":
      return "E";
    case "oarab":
      return "OArab";
    case "lepore":
      return "Lepore";
    default:
      return "other_or_unknown";
  }
}

/** UI `{cbc, hplc}` to the real `HaemInterpretRequest`. */
export function toRealHaemRequest(body: unknown): unknown {
  if (!isRecord(body) || !isRecord(body["cbc"])) return body;
  const cbc = body["cbc"];
  const sex = cbc["sex"] === "female" ? "F" : cbc["sex"] === "male" ? "M" : "unknown";
  const hb = numberOrNull(cbc["hb_g_dl"]);
  const real: Record<string, unknown> = {
    sex,
    // g/dL to g/L, kept to one decimal so 11.2 g/dL is exactly 112 g/L.
    hb_g_per_l: hb === null ? null : Math.round(hb * 100) / 10,
    mcv_fl: numberOrNull(cbc["mcv_fl"]),
    mch_pg: numberOrNull(cbc["mch_pg"]),
    // GAP: the aid takes the laboratory's low/not-low flag and has no numeric ferritin cut-off, so a numeric
    // ferritin_ug_l cannot be classified here; it is not sent. The flag is used when the form supplies one.
    ferritin_status: FERRITIN_STATUS.has(cbc["ferritin_status"]) ? cbc["ferritin_status"] : "not_measured",
    // GAP: rbc_10e12_l has no counterpart in the real aid and is not sent.
  };
  // GAP: the aid needs age_years (V01 makes the CBC "incomplete" without it); it is sent only when the form collects it.
  const age = numberOrNull(cbc["age_years"]);
  if (age !== null) real["age_years"] = age;
  if (typeof cbc["pregnant"] === "boolean" || cbc["pregnant"] === "unknown") real["pregnant"] = cbc["pregnant"];
  // GAP: rule V03 makes the CBC "incomplete" unless the clinician states no transfusion in the last 4 months; the
  // backend default is "unknown", which is sent when the form does not collect it. It is never assumed to be false.
  if (typeof cbc["transfused_last_4_months"] === "boolean" || cbc["transfused_last_4_months"] === "unknown") {
    real["transfused_last_4_months"] = cbc["transfused_last_4_months"];
  }

  const out: Record<string, unknown> = { cbc: real };
  const hplc = body["hplc"];
  if (isRecord(hplc)) {
    const percent = numberOrNull(hplc["variant_hb_percent"]);
    out["hplc"] = {
      hba2_pct: numberOrNull(hplc["hba2_percent"]),
      hbf_pct: numberOrNull(hplc["hbf_percent"]),
      // GAP: both answers are required by the aid (S2-V01) and were not collected by the form; null makes the
      // HPLC stage report "work_up_incomplete" rather than assume HbA2 is the total or that one band was seen.
      hba2_is_total: typeof hplc["hba2_is_total"] === "boolean" ? hplc["hba2_is_total"] : null,
      single_hba_band_only: typeof hplc["single_hba_band_only"] === "boolean" ? hplc["single_hba_band_only"] : null,
      variant_detected: variantDetected(hplc["variant_hb_name"], percent),
      // GAP: variant_hb_percent has no counterpart in the real aid and is not sent.
    };
  }
  return out;
}

function yearOrNull(value: string): number | null {
  return /^\d{4}$/.test(value) ? Number(value) : null;
}

export function mapHaemInterpretation(body: unknown): HaemInterpretation {
  const real = parseReal(haemInterpretationSchema, body, "haem/interpret");
  const sources: HaemSource[] = real.sources.map((source) => ({
    title: source.title,
    year: yearOrNull(source.year),
    url: source.url,
    // tier "none" marks an entry that is not a clinical citation (input validation), shown as illustrative.
    illustrative: source.tier === "none" || source.tier === "",
  }));
  const byId = new Map(real.sources.map((source, index) => [source.id, sources[index]] as const));
  return {
    label: real.label,
    label_text: real.label_description,
    rule_trace: real.trace.map((line) => ({
      rule_id: line.rule_id,
      description: `${line.outcome} (${line.locator})`,
      source: byId.get(line.source_id) ?? null,
    })),
    flags: real.flags,
    // Every real interpretation is gated on clinical sign-off (needs_clinician_signoff is the constant true).
    needs_clinician_signoff: true,
    sources,
    mandatory_statements: real.mandatory_statements,
    not_a_diagnosis: real.not_a_diagnosis,
    population_caveat: real.population_caveat,
    sources_disagree: real.sources_disagree,
    stage: real.stage,
    ruleset_version: real.ruleset_version,
  };
}
