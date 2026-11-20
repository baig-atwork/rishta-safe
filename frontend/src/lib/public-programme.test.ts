import { describe, expect, it } from "vitest";
import type { ProgrammeKpis } from "@/lib/api/types";
import { heroFigures, toDuration } from "./public-programme";

const duration = (n: number, median: number | null, p90: number | null) => ({ n, median_hours: median, p90_hours: p90 });

const base: ProgrammeKpis = {
  generated_at: "2026-11-20T00:00:00Z",
  synthetic: true,
  cases_total: 10,
  referral_target: 0.9,
  referral_completed: 4,
  referral_eligible: 7,
  by_state: [
    { key: "counselling", count: 3, median_hours: 20, sla_breaches: 2 },
    { key: "certificate", count: 1, median_hours: null, sla_breaches: 1 },
  ],
};

describe("toDuration", () => {
  it("keeps hours up to three days and converts longer spans to days, always with a unit", () => {
    expect(toDuration(48)).toEqual({ value: 48, unit: "hours" });
    expect(toDuration(72)).toEqual({ value: 72, unit: "hours" });
    expect(toDuration(267)).toEqual({ value: 11.125, unit: "days" });
  });
});

describe("heroFigures", () => {
  it("uses the real detail when present: referred, median time to result, counselling completed", () => {
    const figures = heroFigures({
      ...base,
      detail: {
        n_closed: 0,
        n_flagged: 7,
        time_to_result: duration(10, 267, 269.4),
        time_to_referral: duration(4, 48, 48),
        counselling_booked: 4,
        counselling_completed: 3,
        counselling_declined: 0,
        counselling_uptake_booked_share: 4 / 7,
        counselling_uptake_completed_share: 3 / 7,
        share_referred: 4 / 7,
        share_referred_within_standard: 4 / 7,
        meets_referral_target: false,
        referral_standard_days: 14,
        referral_standard_is_illustrative: true,
        open_tasks: 4,
        stale_tasks: 0,
        basis: "x",
      },
    });
    expect(figures.map((f) => f.id)).toEqual(["referred", "result", "counselling"]);
    expect(figures[1]).toMatchObject({ kind: "duration", hours: 267, n: 10, p90Hours: 269.4 });
    expect(figures[2]).toMatchObject({ count: 3, total: 7 });
  });

  it("falls back to referral completion, cases counted and breaches when there is no detail", () => {
    const figures = heroFigures(base);
    expect(figures.map((f) => f.id)).toEqual(["referred", "cases", "breaches"]);
    expect(figures[0]).toMatchObject({ value: 4 / 7, target: 0.9 });
    expect(figures[1]).toMatchObject({ value: 10 });
    expect(figures[2]).toMatchObject({ value: 3 });
  });

  it("gives a null share when nothing is eligible instead of dividing by zero", () => {
    expect(heroFigures({ ...base, referral_eligible: 0 })[0]).toMatchObject({ value: null });
  });
});
