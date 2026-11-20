import { describe, expect, it } from "vitest";
import { givenName } from "./names";

describe("givenName", () => {
  it("drops the family-name placeholder and the synthetic suffix", () => {
    expect(givenName("Layla Demo (synthetic)")).toBe("Layla");
    expect(givenName("Counsellor (synthetic persona)")).toBe("Counsellor");
  });

  it("leaves a plain given name alone", () => {
    expect(givenName("Amal")).toBe("Amal");
  });

  it("falls back to the whole label when nothing precedes the bracket", () => {
    expect(givenName("(synthetic)")).toBe("(synthetic)");
  });

  it("keeps non-Latin names", () => {
    expect(givenName("نورة تجريبي (اصطناعي)")).toBe("نورة");
  });
});
