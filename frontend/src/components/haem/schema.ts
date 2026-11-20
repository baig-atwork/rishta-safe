import * as z from "zod/mini";
import type { CbcInput, HplcInput } from "@/lib/api/types";

/**
 * Client-side checks for the haematology aid are deliberately minimal: "a number greater than 0". The backend owns
 * every clinical bound and answers with RFC 9457 `errors`, which the form shows inline. No reference range or
 * threshold lives in this file.
 *
 * The questions the aid asks that are not lab numbers (age, pregnancy, transfusion, the laboratory's ferritin flag,
 * and two HPLC attestations) are closed choices. A question left unanswered stays "" in the form and is left out of
 * the request: the form never fills in an answer, and the backend reads an absent answer as unknown.
 */

export const CBC_FIELDS = [
  "sex",
  "age_years",
  "pregnant",
  "transfused_last_4_months",
  "hb_g_dl",
  "mcv_fl",
  "mch_pg",
  "rbc_10e12_l",
  "ferritin_ug_l",
  "ferritin_status",
] as const;
export const HPLC_FIELDS = [
  "hba2_percent",
  "hba2_is_total",
  "hbf_percent",
  "variant_hb_percent",
  "variant_hb_name",
  "single_hba_band_only",
] as const;
export const ALL_FIELDS = [...CBC_FIELDS, ...HPLC_FIELDS] as const;

export type CbcFieldName = (typeof CBC_FIELDS)[number];
export type HplcFieldName = (typeof HPLC_FIELDS)[number];
export type HaemFieldName = CbcFieldName | HplcFieldName;
export type HaemFormValues = Record<HaemFieldName, string>;
export type HaemStep = "cbc" | "hplc";
export type HaemScope = "cbc" | "both";

export const EMPTY_VALUES: HaemFormValues = {
  sex: "",
  age_years: "",
  pregnant: "",
  transfused_last_4_months: "",
  hb_g_dl: "",
  mcv_fl: "",
  mch_pg: "",
  rbc_10e12_l: "",
  ferritin_ug_l: "",
  ferritin_status: "",
  hba2_percent: "",
  hba2_is_total: "",
  hbf_percent: "",
  variant_hb_percent: "",
  variant_hb_name: "",
  single_hba_band_only: "",
};

/** The closed choices of each choice field. "" is "not answered" and is always allowed. */
export const TRI_STATE_CHOICES = ["yes", "no", "unknown"] as const;
export const YES_NO_CHOICES = ["yes", "no"] as const;
export const FERRITIN_STATUS_CHOICES = ["low", "not_low", "not_measured"] as const;

export const CHOICE_OPTIONS = {
  pregnant: TRI_STATE_CHOICES,
  transfused_last_4_months: TRI_STATE_CHOICES,
  ferritin_status: FERRITIN_STATUS_CHOICES,
  hba2_is_total: YES_NO_CHOICES,
  single_hba_band_only: YES_NO_CHOICES,
} as const satisfies Partial<Record<HaemFieldName, readonly string[]>>;

export type ChoiceFieldName = keyof typeof CHOICE_OPTIONS;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";
const DECIMAL = /^(?:\d+\.?\d*|\.\d+)$/;

/** Accepts Latin, Arabic-Indic and Urdu digits and `,` or the Arabic decimal separator as the point. */
export function normaliseNumberText(raw: string): string {
  let out = "";
  for (const ch of raw.trim()) {
    const arabic = ARABIC_INDIC.indexOf(ch);
    const extended = EXTENDED_ARABIC_INDIC.indexOf(ch);
    if (arabic >= 0) out += String(arabic);
    else if (extended >= 0) out += String(extended);
    else if (ch === "," || ch === "٫") out += ".";
    else out += ch;
  }
  return out;
}

/** The one client rule: a finite number greater than 0, otherwise null. */
export function parseDecimal(raw: string): number | null {
  const text = normaliseNumberText(raw);
  if (!DECIMAL.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface HaemValidationMessages {
  positive: string;
  choose: string;
}

/** `cbc` validates the CBC step only; `full` validates the CBC and the HPLC step. Same value shape for both. */
export function buildHaemSchemas(messages: HaemValidationMessages) {
  const required = z.string().check(z.refine((value) => parseDecimal(value) !== null, { error: messages.positive }));
  const optional = z.string().check(z.refine((value) => value.trim() === "" || parseDecimal(value) !== null, { error: messages.positive }));
  const sex = z.string().check(z.refine((value) => value === "female" || value === "male", { error: messages.choose }));
  const free = z.string();
  const oneOf = (allowed: readonly string[]) =>
    z.string().check(z.refine((value) => value === "" || allowed.includes(value), { error: messages.choose }));

  const cbc = z.object({
    sex,
    age_years: optional,
    pregnant: oneOf(CHOICE_OPTIONS.pregnant),
    transfused_last_4_months: oneOf(CHOICE_OPTIONS.transfused_last_4_months),
    hb_g_dl: required,
    mcv_fl: required,
    mch_pg: required,
    rbc_10e12_l: optional,
    ferritin_ug_l: optional,
    ferritin_status: oneOf(CHOICE_OPTIONS.ferritin_status),
    hba2_percent: free,
    hba2_is_total: free,
    hbf_percent: free,
    variant_hb_percent: free,
    variant_hb_name: free,
    single_hba_band_only: free,
  });
  const full = z.object({
    ...cbc.shape,
    hba2_percent: required,
    hba2_is_total: oneOf(CHOICE_OPTIONS.hba2_is_total),
    hbf_percent: required,
    variant_hb_percent: optional,
    single_hba_band_only: oneOf(CHOICE_OPTIONS.single_hba_band_only),
  });
  return { cbc, full };
}

function numberOrNull(text: string): number | null {
  return text.trim() === "" ? null : parseDecimal(text);
}

/** yes / no / unknown to the request's tri-state; "" (not answered) is undefined, so the key is left out. */
function triState(value: string): boolean | "unknown" | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  if (value === "unknown") return "unknown";
  return undefined;
}

function yesNo(value: string): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

/** An unanswered question is not sent at all (never null, never a default), so the backend reads it as unknown. */
export function toCbcInput(values: HaemFormValues): CbcInput | null {
  const hb = parseDecimal(values.hb_g_dl);
  const mcv = parseDecimal(values.mcv_fl);
  const mch = parseDecimal(values.mch_pg);
  if ((values.sex !== "female" && values.sex !== "male") || hb === null || mcv === null || mch === null) return null;
  const input: CbcInput = {
    sex: values.sex,
    hb_g_dl: hb,
    mcv_fl: mcv,
    mch_pg: mch,
    rbc_10e12_l: numberOrNull(values.rbc_10e12_l),
    ferritin_ug_l: numberOrNull(values.ferritin_ug_l),
  };
  const age = numberOrNull(values.age_years);
  if (age !== null) input.age_years = age;
  const pregnant = triState(values.pregnant);
  if (pregnant !== undefined) input.pregnant = pregnant;
  const transfused = triState(values.transfused_last_4_months);
  if (transfused !== undefined) input.transfused_last_4_months = transfused;
  if (values.ferritin_status === "low" || values.ferritin_status === "not_low" || values.ferritin_status === "not_measured") {
    input.ferritin_status = values.ferritin_status;
  }
  return input;
}

export function toHplcInput(values: HaemFormValues): HplcInput | null {
  const hba2 = parseDecimal(values.hba2_percent);
  const hbf = parseDecimal(values.hbf_percent);
  if (hba2 === null || hbf === null) return null;
  const name = values.variant_hb_name.trim();
  const input: HplcInput = {
    hba2_percent: hba2,
    hbf_percent: hbf,
    variant_hb_percent: numberOrNull(values.variant_hb_percent),
    variant_hb_name: name === "" ? null : name,
  };
  const total = yesNo(values.hba2_is_total);
  if (total !== undefined) input.hba2_is_total = total;
  const single = yesNo(values.single_hba_band_only);
  if (single !== undefined) input.single_hba_band_only = single;
  return input;
}

/** The values a reading was made from; compared with the live form to tell when a reading has gone stale. */
export function snapshotOf(values: Partial<HaemFormValues>, scope: HaemScope): string {
  const names: readonly HaemFieldName[] = scope === "cbc" ? CBC_FIELDS : ALL_FIELDS;
  return JSON.stringify(names.map((name) => (values[name] ?? "").trim()));
}

/** Maps an RFC 9457 error path such as `cbc.hb_g_dl` or `body.hplc.hbf_percent` to a form field. */
export function fieldFromServerPath(path: string): HaemFieldName | null {
  const last = path
    .split(/[.[\]]+/)
    .filter((part) => part !== "")
    .at(-1);
  return ALL_FIELDS.find((name) => name === last) ?? null;
}

export function stepOfField(name: HaemFieldName): HaemStep {
  return (CBC_FIELDS as readonly string[]).includes(name) ? "cbc" : "hplc";
}
