import { describe, expect, it } from "vitest";
import { durationParts, formatDateTime, formatDuration, formatNumber, formatPercent, shortHash } from "./format";

const ARABIC_INDIC = /[٠-٩۰-۹]/;

describe("numbers and dates use Western digits in every locale", () => {
  it.each(["en", "ar", "ur"] as const)("formatNumber in %s has no Arabic-Indic digits", (locale) => {
    expect(formatNumber(locale, 1234.5)).not.toMatch(ARABIC_INDIC);
    expect(formatPercent(locale, 0.9)).not.toMatch(ARABIC_INDIC);
    expect(formatDateTime(locale, "2026-11-20T08:30:00Z")).not.toMatch(ARABIC_INDIC);
  });

  it("formats an ISO instant in UTC by default and returns an empty string for bad input", () => {
    expect(formatDateTime("en", "2026-11-20T08:30:00Z")).toContain("2026");
    expect(formatDateTime("en", null)).toBe("");
    expect(formatDateTime("en", "not a date")).toBe("");
  });
});

describe("durationParts", () => {
  it("chooses a natural unit", () => {
    expect(durationParts(0.25)).toEqual({ unit: "minute", value: 15 });
    expect(durationParts(24)).toEqual({ unit: "hour", value: 24 });
    expect(durationParts(72)).toEqual({ unit: "day", value: 3 });
    expect(durationParts(336)).toEqual({ unit: "week", value: 2 });
  });

  it("formats in the locale", () => {
    expect(formatDuration("en", 0.25)).toMatch(/15/);
    expect(formatDuration("en", 336)).toMatch(/2/);
  });
});

describe("shortHash", () => {
  it("keeps both ends of a long hash and leaves short ones alone", () => {
    const hash = "a".repeat(20) + "b".repeat(20) + "c".repeat(24);
    const short = shortHash(hash);
    expect(short.startsWith("aaaaaaaa")).toBe(true);
    expect(short.endsWith("cccccc")).toBe(true);
    expect(short.length).toBeLessThan(hash.length);
    expect(shortHash("abc123")).toBe("abc123");
  });
});
