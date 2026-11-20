import { describe, expect, it } from "vitest";
import type { Block, Partner } from "./api/types";
import { pairBlocks, secondLocale } from "./couple-pairing";

const partner = (person_id: string, language?: Partner["language"]): Partner => ({
  person_id,
  display_name: person_id,
  sex: "female",
  ...(language === undefined ? {} : { language }),
});
const block = (kind: Block["kind"], text: string): Block => ({ kind, text, items: [], icon_array: null, tone: "neutral", numbers: [] });

describe("secondLocale", () => {
  it("case 2, Layla (en) reads with her partner's Arabic", () => {
    const partners = [partner("a", "en"), partner("b", "ar")];
    expect(secondLocale({ pageLocale: "en", partners, viewerPersonId: "a" })).toBe("ar");
  });
  it("case 6, Hind (ur page) reads Urdu with her partner's English", () => {
    const partners = [partner("a", "ur"), partner("b", "en")];
    expect(secondLocale({ pageLocale: "ur", partners, viewerPersonId: "a" })).toBe("en");
  });
  it("case 4, Dalia (ar page) reads Arabic with her partner's English", () => {
    const partners = [partner("a", "ar"), partner("b", "en")];
    expect(secondLocale({ pageLocale: "ar", partners, viewerPersonId: "a" })).toBe("en");
  });
  it("falls back to the viewer's own language when the other member's equals the page locale", () => {
    const partners = [partner("a", "ar"), partner("b", "en")];
    expect(secondLocale({ pageLocale: "en", partners, viewerPersonId: "a" })).toBe("ar");
  });
  it("is null when both members use the page locale, or when languages are not published (never guessed)", () => {
    expect(secondLocale({ pageLocale: "en", partners: [partner("a", "en"), partner("b", "en")], viewerPersonId: "a" })).toBeNull();
    expect(secondLocale({ pageLocale: "en", partners: [partner("a"), partner("b")], viewerPersonId: "a" })).toBeNull();
  });
});

describe("pairBlocks", () => {
  const en = [block("heading", "H"), block("paragraph", "P"), block("icon_array", "C"), block("list", "L")];
  const ar = [block("heading", "ه"), block("paragraph", "ف"), block("icon_array", "ت"), block("list", "ق")];

  it("pairs block by block when both documents have the same shape", () => {
    const paired = pairBlocks(en, ar);
    expect(paired.aligned).toBe(true);
    expect(paired.pairs).toHaveLength(4);
    expect(paired.pairs[1]?.primary.text).toBe("P");
    expect(paired.pairs[1]?.secondary.text).toBe("ف");
    expect(paired.restPrimary).toEqual([]);
  });

  it("stops at the first kind mismatch and returns each remainder whole (fallback, no guessing)", () => {
    const odd = [block("heading", "ه"), block("paragraph", "ف"), block("callout", "؟"), block("icon_array", "ت"), block("list", "ق")];
    const paired = pairBlocks(en, odd);
    expect(paired.aligned).toBe(false);
    expect(paired.pairs).toHaveLength(2);
    expect(paired.restPrimary.map((b) => b.kind)).toEqual(["icon_array", "list"]);
    expect(paired.restSecondary.map((b) => b.kind)).toEqual(["callout", "icon_array", "list"]);
  });

  it("stops when the lists differ in length", () => {
    const paired = pairBlocks(en, ar.slice(0, 2));
    expect(paired.aligned).toBe(false);
    expect(paired.pairs).toHaveLength(2);
    expect(paired.restPrimary).toHaveLength(2);
    expect(paired.restSecondary).toHaveLength(0);
  });

  it("two empty lists are aligned and empty", () => {
    expect(pairBlocks([], [])).toEqual({ pairs: [], aligned: true, restPrimary: [], restSecondary: [] });
  });
});
