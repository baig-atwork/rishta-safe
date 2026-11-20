import { describe, expect, it } from "vitest";
import { buildIconArray, iconColumns } from "./icon-array";

const spec = (affected: number, carrier: number, neither: number, total = 100) => ({
  total,
  affected,
  carrier,
  neither,
  caption: "",
});

describe("buildIconArray", () => {
  it("lays out exactly 100 icons grouped affected, carrier, neither (25/50/25)", () => {
    const arr = buildIconArray(spec(25, 50, 25));
    expect(arr.valid).toBe(true);
    expect(arr.icons).toHaveLength(100);
    expect(arr.icons.slice(0, 25).every((k) => k === "affected")).toBe(true);
    expect(arr.icons.slice(25, 75).every((k) => k === "carrier")).toBe(true);
    expect(arr.icons.slice(75).every((k) => k === "neither")).toBe(true);
    expect(arr.counts).toEqual({ affected: 25, carrier: 50, neither: 25 });
  });

  it("handles the degenerate arrays (all neither, all affected)", () => {
    expect(buildIconArray(spec(0, 0, 100)).icons.every((k) => k === "neither")).toBe(true);
    expect(buildIconArray(spec(100, 0, 0)).icons.every((k) => k === "affected")).toBe(true);
  });

  it("never repairs a wrong sum: it reports the array invalid and draws nothing", () => {
    const arr = buildIconArray(spec(25, 50, 24));
    expect(arr.valid).toBe(false);
    expect(arr.problem).toBe("sum_mismatch");
    expect(arr.icons).toHaveLength(0);
  });

  it("rejects negative, fractional and non-positive totals", () => {
    expect(buildIconArray(spec(-1, 51, 50)).problem).toBe("negative_or_fractional");
    expect(buildIconArray(spec(25.5, 49.5, 25)).problem).toBe("negative_or_fractional");
    expect(buildIconArray(spec(0, 0, 0, 0)).problem).toBe("total_not_positive");
  });
});

describe("iconColumns", () => {
  it("is a 10 by 10 grid for the fixed 100 array", () => {
    expect(iconColumns(100)).toBe(10);
  });
  it("falls back to a near-square grid for other totals", () => {
    expect(iconColumns(50)).toBe(8);
    expect(iconColumns(1)).toBe(1);
  });
});
