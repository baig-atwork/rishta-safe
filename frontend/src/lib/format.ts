import type { Locale } from "./api/types";

/**
 * Western (Latin) digits and the Gregorian calendar in all three locales, so a number or a date in a result
 * means the same thing everywhere (see docs/design/DESIGN.md, Typography).
 */
function tag(locale: Locale): string {
  return `${locale}-u-nu-latn-ca-gregory`;
}

export function formatDateTime(locale: Locale, iso: string | null, timeZone = "UTC"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatDate(locale: Locale, iso: string | null, timeZone = "UTC"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeZone }).format(date);
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(tag(locale), options).format(value);
}

export function formatPercent(locale: Locale, ratio: number): string {
  return new Intl.NumberFormat(tag(locale), { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

export type DurationUnit = "minute" | "hour" | "day" | "week";

export interface DurationParts {
  unit: DurationUnit;
  value: number;
}

/** Picks the most natural unit for an expected duration given in hours. */
export function durationParts(hours: number): DurationParts {
  if (hours < 1) return { unit: "minute", value: Math.round(hours * 60) };
  if (hours < 48) return { unit: "hour", value: Math.round(hours) };
  if (hours < 24 * 14) return { unit: "day", value: Math.round(hours / 24) };
  return { unit: "week", value: Math.round(hours / (24 * 7)) };
}

export function formatDuration(locale: Locale, hours: number): string {
  const { unit, value } = durationParts(hours);
  return new Intl.NumberFormat(tag(locale), { style: "unit", unit, unitDisplay: "long" }).format(value);
}

/** Shortens a hex hash for display, keeping both ends so two hashes remain distinguishable. */
export function shortHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
