import { describe, expect, it } from "vitest";
import arClosure from "@/messages/ar/closure.json";
import arConsent from "@/messages/ar/consent.json";
import enClosure from "@/messages/en/closure.json";
import enConsent from "@/messages/en/consent.json";
import urClosure from "@/messages/ur/closure.json";
import urConsent from "@/messages/ur/consent.json";

/**
 * Guards the message files for the sharing, closure and teach-back screens: same keys in every locale, same
 * placeholders, Western digits, no kashida, the closed vocabulary (hard rule 4) and no marriage wording (rule 6).
 * The banned lists mirror backend/src/bayan/data/templates.banned.yaml.
 */
type Json = { [key: string]: Json | string };

function flatten(node: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [childPath, text] of flatten(value, path)) out.set(childPath, text);
  }
  return out;
}

const FILES = {
  consent: { en: flatten(enConsent), ar: flatten(arConsent), ur: flatten(urConsent) },
  closure: { en: flatten(enClosure), ar: flatten(arClosure), ur: flatten(urClosure) },
} as const;

const EN_BANNED = [
  "compatible", "incompatible", "compatibility", "pass", "passed", "passes", "fail", "failed", "fails", "failure",
  "no risk", "zero risk", "risk free", "safe", "unsafe", "high risk", "moderate risk", "low risk", "should", "shouldn't",
  "must not", "mustn't", "you must", "cannot marry", "proceed with the marriage", "proceed with marriage", "cancel",
  "cancelled", "canceled", "cancellation", "fit for marriage", "unfit", "healthy couple", "bad genes", "defective",
];
const AR_BANNED = [
  "متوافق", "توافق", "عدم توافق", "اجتاز", "اجتياز", "ناجح", "نجح", "راسب", "رسب", "فشل", "لا خطر", "بلا خطر", "لا يوجد خطر",
  "خطر مرتفع", "خطر عال", "خطورة عالية", "خطر متوسط", "خطر منخفض", "آمن", "غير آمن", "يجب", "ينبغي", "لا يجوز", "لا يجب",
  "المضي في الزواج", "إتمام الزواج", "مواصلة الزواج", "إلغاء", "الغاء", "غير لائق", "جينات سيئة",
];
const UR_BANNED = [
  "ہم آہنگ", "موافق", "غیر موافق", "مطابقت", "کامیاب", "ناکام", "پاس ہو", "پاس ہونا", "فیل", "کوئی خطرہ نہیں", "خطرہ نہیں",
  "بے خطر", "محفوظ", "غیر محفوظ", "زیادہ خطرہ", "کم خطرہ", "چاہیے", "چاہئے", "ضروری ہے", "ہرگز نہ کریں", "شادی کریں",
  "شادی کے ساتھ آگے بڑھیں", "شادی جاری رکھیں", "منسوخ", "منسوخی", "ناموزوں",
];

function normaliseArabic(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
}

/** Which arguments and rich-text tags a message uses; how many times a tag wraps something may differ by language. */
function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}|<(\/?\w+)>/g)].map((match) => match[1] ?? match[2] ?? ""))].sort();
}

function bannedEnglish(text: string): string[] {
  return EN_BANNED.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]+");
    return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "iu").test(text.replaceAll("Rishta Safe", ""));
  });
}
function bannedArabic(text: string): string[] {
  const plain = normaliseArabic(text);
  return AR_BANNED.filter((term) => plain.includes(normaliseArabic(term)));
}
function bannedUrdu(text: string): string[] {
  const words = ` ${text.replace(/[۔،؟!:;()"«»]/g, " ").replace(/\s+/g, " ")} `;
  return UR_BANNED.filter((term) => words.includes(` ${term} `));
}

describe("the banned-word detectors", () => {
  it("are not vacuous: each one flags a known-bad sentence and clears a clean one", () => {
    expect(bannedEnglish("You should wait. It is a pass mark.")).toEqual(expect.arrayContaining(["should", "pass"]));
    expect(bannedEnglish("Compatible couples")).toContain("compatible");
    expect(bannedEnglish("Keep sharing. Revoke sharing.")).toEqual([]);
    expect(bannedArabic("يَجِبُ أن تنتظر")).toContain("يجب");
    expect(bannedArabic("سحب المشاركة")).toEqual([]);
    expect(bannedUrdu("آپ کو انتظار کرنا چاہیے")).toContain("چاہیے");
    expect(bannedUrdu("شیئرنگ واپس لیں")).toEqual([]);
  });
});

describe.each(Object.entries(FILES))("%s messages", (_name, locales) => {
  it("has the same keys in en, ar and ur, with no empty value", () => {
    const keys = [...locales.en.keys()].sort();
    expect(keys.length).toBeGreaterThan(20);
    expect([...locales.ar.keys()].sort()).toEqual(keys);
    expect([...locales.ur.keys()].sort()).toEqual(keys);
    for (const locale of [locales.en, locales.ar, locales.ur]) for (const value of locale.values()) expect(value.trim()).not.toBe("");
  });

  it("uses the same placeholders and rich-text tags in every locale", () => {
    for (const [key, english] of locales.en) {
      expect(placeholders(locales.ar.get(key) ?? ""), `ar ${key}`).toEqual(placeholders(english));
      expect(placeholders(locales.ur.get(key) ?? ""), `ur ${key}`).toEqual(placeholders(english));
    }
  });

  it("uses Western digits and no kashida in Arabic or Urdu", () => {
    for (const locale of [locales.ar, locales.ur]) {
      for (const [key, value] of locale) {
        expect(value, key).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
        expect(value, key).not.toMatch(/\u0640/);
      }
    }
  });

  it("avoids every banned word in all three languages", () => {
    for (const [key, value] of locales.en) expect(bannedEnglish(value), `en ${key}`).toEqual([]);
    for (const [key, value] of locales.ar) expect(bannedArabic(value), `ar ${key}`).toEqual([]);
    for (const [key, value] of locales.ur) expect(bannedUrdu(value), `ur ${key}`).toEqual([]);
  });

  it("never mentions marriage: there is no marriage-decision field or wording (rule 6)", () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, value] of messages) {
        expect(value, `${locale} ${key}`).not.toMatch(/marry|marriage|married|زواج|الزواج|شادی/i);
      }
    }
  });
});
