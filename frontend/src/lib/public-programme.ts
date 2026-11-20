import type { ProgrammeKpis } from "@/lib/api/types";

/**
 * The programme page's three lead figures, chosen from what the endpoint reports. Pure: no formatting and no wording
 * here (the page formats numbers and takes every label from the message files), so it is tested without a server.
 */

export type HeroFigure =
  | { id: "referred"; kind: "share"; value: number | null; target: number }
  | { id: "result"; kind: "duration"; hours: number | null; n: number; p90Hours: number | null }
  | { id: "counselling"; kind: "share"; value: number | null; count: number; total: number }
  | { id: "cases"; kind: "count"; value: number }
  | { id: "breaches"; kind: "count"; value: number };

/** Hours past three days read better as days (a median of 267 hours is 11.1 days). The unit is always returned, never dropped. */
export function toDuration(hours: number): { value: number; unit: "days" | "hours" } {
  return hours > 72 ? { value: hours / 24, unit: "days" } : { value: hours, unit: "hours" };
}

/**
 * Real backend (`detail` present): share of flagged cases referred, median time to result, counselling completed.
 * Mock shape (no `detail`): referral completion, cases counted, time limit breaches. Always three, in reading order.
 */
export function heroFigures(kpis: ProgrammeKpis): HeroFigure[] {
  const d = kpis.detail;
  if (d) {
    return [
      { id: "referred", kind: "share", value: d.share_referred, target: kpis.referral_target },
      { id: "result", kind: "duration", hours: d.time_to_result.median_hours, n: d.time_to_result.n, p90Hours: d.time_to_result.p90_hours },
      { id: "counselling", kind: "share", value: d.counselling_uptake_completed_share, count: d.counselling_completed, total: d.n_flagged },
    ];
  }
  const ratio = kpis.referral_eligible > 0 ? kpis.referral_completed / kpis.referral_eligible : null;
  return [
    { id: "referred", kind: "share", value: ratio, target: kpis.referral_target },
    { id: "cases", kind: "count", value: kpis.cases_total },
    { id: "breaches", kind: "count", value: kpis.by_state.reduce((sum, row) => sum + row.sla_breaches, 0) },
  ];
}
