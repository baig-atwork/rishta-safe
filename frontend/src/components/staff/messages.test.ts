import { describe, expect, it } from "vitest";
import arClinical from "@/messages/ar/clinical.json";
import arOversight from "@/messages/ar/oversight.json";
import enClinical from "@/messages/en/clinical.json";
import enOversight from "@/messages/en/oversight.json";
import urClinical from "@/messages/ur/clinical.json";
import urOversight from "@/messages/ur/oversight.json";

/** The message files this lane owns: staff and haem (clinical.json), programme and judge (oversight.json). */
const FILES = {
  clinical: { en: enClinical, ar: arClinical, ur: urClinical },
  oversight: { en: enOversight, ar: arOversight, ur: urOversight },
} as const;

function leaves(node: unknown, prefix = "", out: Map<string, string> = new Map()): Map<string, string> {
  if (typeof node === "string") out.set(prefix, node);
  else if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) leaves(value, prefix === "" ? key : `${prefix}.${key}`, out);
  }
  return out;
}

const EN_BANNED: readonly RegExp[] = [
  /\b(?:in)?compatible\b/i,
  /\bpass(?:es|ed|ing)?\b/i,
  /\bfail(?:s|ed|ure|ures)?\b/i,
  /\bno risk\b/i,
  /\bsafe\b/i,
  /\b(?:high|moderate|low) risk\b/i,
  /\byou should\b/i,
  /\byou must not\b/i,
  /\bproceed with the marriage\b/i,
  /\bcancel(?:s|led|ling|lation)?\b/i,
  /\bclinically reviewed\b/i,
  /\bvalidated\b/i,
  /\bapproved\b/i,
];

const AR_BANNED = ["متوافق", "ينجح", "رسب", "فشل", "آمن", "لا مخاطر", "خطر مرتفع", "خطر عال", "خطر منخفض", "خطر متوسط", "يجب ألا", "إلغاء"];
const UR_BANNED = ["موافق", "کامیاب", "ناکام", "محفوظ", "زیادہ خطرہ", "کم خطرہ", "درمیانہ خطرہ", "خطرہ نہیں", "منسوخ"];

describe.each(Object.entries(FILES))("%s messages", (_name, byLocale) => {
  const en = leaves(byLocale.en);

  it.each(["ar", "ur"] as const)("%s has exactly the English key set", (locale) => {
    const other = leaves(byLocale[locale]);
    expect([...other.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [key, text] of other) expect(text.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
  });

  it("uses no banned or over-claiming wording in English", () => {
    for (const [key, text] of en) for (const pattern of EN_BANNED) expect(text.replaceAll("Rishta Safe", ""), `en:${key}`).not.toMatch(pattern);
  });

  it("uses no banned wording in Arabic or Urdu", () => {
    for (const [key, text] of leaves(byLocale.ar)) for (const word of AR_BANNED) expect(text.includes(word), `ar:${key} contains ${word}`).toBe(false);
    for (const [key, text] of leaves(byLocale.ur)) for (const word of UR_BANNED) expect(text.includes(word), `ur:${key} contains ${word}`).toBe(false);
  });

  it("keeps Western digits", () => {
    for (const locale of ["ar", "ur"] as const) {
      for (const [key, text] of leaves(byLocale[locale])) expect(text, `${locale}:${key}`).not.toMatch(/[٠-٩۰-۹]/);
    }
  });
});

describe("clinical sign-off wording", () => {
  it("names the clinical owner only as the clinical lead (sign-off pending)", () => {
    const text = [...leaves(enClinical).values()].join("\n");
    expect(text).toContain("the clinical lead (sign-off pending)");
    expect(text).not.toMatch(/\b(?:Dr|Prof|Professor)\b\.?/);
  });

  it("states that a reading is not a diagnosis and that sign-off is pending", () => {
    const en = leaves(enClinical);
    expect(en.get("haem.boundary.statement")).toBe("Not a diagnosis. A decision aid for the clinician.");
    expect(en.get("haem.result.statement")).toBe("Not a diagnosis. A decision aid for the clinician.");
    expect(en.get("haem.boundary.signoff")).toBe("Pending clinical sign-off");
    expect(en.get("haem.result.signoff")).toBe("Pending clinical sign-off");
  });
});
