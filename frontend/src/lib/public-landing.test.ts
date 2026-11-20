import { describe, expect, it } from "vitest";
import { buildLandingSheet, evidenceSpan, isRegressionGate, landingMetrics, landingQueue, recordedScoreboard, sheetLocales, weakestFirst } from "./public-landing";

describe("landing sheet (recorded response)", () => {
  it("pairs the page's own language with the other end of the pair, and uses the API's own sentences", () => {
    expect(sheetLocales("en")).toEqual(["en", "ar"]);
    expect(sheetLocales("ar")).toEqual(["ar", "en"]);
    expect(sheetLocales("ur")).toEqual(["ur", "en"]);

    const sheet = buildLandingSheet("en");
    expect(sheet.coupleId).toBe("cpl-demo-02");
    expect(sheet.category).toBe("shared_result_found");
    expect(sheet.columns.map((c) => [c.locale, c.dir])).toEqual([["en", "ltr"], ["ar", "rtl"]]);
    expect(sheet.columns[0]?.heading).toBe("A shared result was found");
    expect(sheet.columns[0]?.caption).toMatch(/out of 100 pregnancies/);
    expect(sheet.columns[1]?.caption).toMatch(/100/);
    expect(sheet.tally).toMatchObject({ total: 100, affected: 25, carrier: 50, neither: 25 });
    expect(sheet.endpoints).toContain("/v1/couples/cpl-demo-02/result?locale=en");
  });

  it("is available in Arabic and Urdu as the lead column (Urdu in Nastaliq script, not a copy of English)", () => {
    const ar = buildLandingSheet("ar");
    const ur = buildLandingSheet("ur");
    expect(ar.columns[0]?.locale).toBe("ar");
    expect(ur.columns[0]?.locale).toBe("ur");
    expect(ar.columns[0]?.heading).toMatch(/[؀-ۿ]/);
    expect(ur.columns[0]?.heading).not.toBe(ar.columns[0]?.heading);
    expect(ur.columns[1]?.locale).toBe("en");
  });
});

describe("landing evidence (the scoreboard's own numbers)", () => {
  it("takes the weak number and the not-run measures along with the strong ones", () => {
    const metrics = landingMetrics();
    expect(metrics.map((m) => m.id)).toEqual(["M6", "M1", "M5", "M2b", "M4", "M8", "M9"]);
    expect(metrics.find((m) => m.id === "M1")?.value).toMatch(/20,000 of 20,000/);
    expect(metrics.find((m) => m.id === "M6")?.value).toMatch(/36 of 59 refused \(61%\)/);
    expect(metrics.filter((m) => !m.measured).map((m) => m.id)).toEqual(["M8", "M9"]);
  });

  it("leads with the weakest measured figure and tags only the 100% regression gates", () => {
    const metrics = landingMetrics();
    expect(metrics[0]?.id).toBe("M6");
    expect(metrics.filter((m) => m.gate).map((m) => m.id)).toEqual(["M1", "M5", "M2b", "M4"]);
    expect(isRegressionGate("M2b")).toBe(true);
    expect(isRegressionGate("M6")).toBe(false);
    expect(weakestFirst([{ id: "M1" }, { id: "M6" }, { id: "M7" }]).map((m) => m.id)).toEqual(["M6", "M1", "M7"]);
  });

  it("fills the evidence grid without an empty cell", () => {
    // Landing: seven cards, the lead double width, four columns: 2+1+1 then 4.
    expect(evidenceSpan(7, 0, { leadWide: true, wideColumns: 4 })).toContain("lg:col-span-2");
    expect(evidenceSpan(7, 6, { leadWide: true, wideColumns: 4 })).toBe("");
    // Evidence page: eleven plain cards in three columns leave two in the last row, so the last card takes two.
    expect(evidenceSpan(11, 10, { leadWide: false, wideColumns: 3 })).toBe("sm:col-span-2 lg:col-span-2");
    expect(evidenceSpan(11, 3, { leadWide: false, wideColumns: 3 })).toBe("");
  });

  it("gives every cell a 'does not show' sentence and never an empty value", () => {
    for (const metric of landingMetrics()) {
      expect(metric.doesNotShow.length).toBeGreaterThan(10);
      expect(metric.value.length).toBeGreaterThan(0);
    }
  });

  it("the full recorded scoreboard keeps every metric and its caveats", () => {
    const board = recordedScoreboard();
    expect(board.metrics.length).toBeGreaterThanOrEqual(10);
    expect(board.metrics.filter((m) => m.status === "not_run").length).toBe(2);
    expect(board.caveats?.length).toBeGreaterThan(0);
  });
});

describe("landing queue", () => {
  it("lists one row per couple, most urgent first", () => {
    const rows = landingQueue(10);
    expect(new Set(rows.map((r) => r.coupleId)).size).toBe(rows.length);
    const rank = { immediate: 3, same_session: 2, fast_track: 1, routine: 0 } as const;
    for (let i = 1; i < rows.length; i += 1) {
      expect(rank[rows[i - 1]!.due]).toBeGreaterThanOrEqual(rank[rows[i]!.due]);
    }
    expect(landingQueue(2)).toHaveLength(2);
  });
});
