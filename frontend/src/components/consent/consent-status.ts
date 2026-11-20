import type { ConsentRecord } from "@/lib/api/types";

export type ConsentStatus = "active" | "revoked" | "expired";

/** Status is derived, never stored: revoked wins, then expiry, otherwise active. `nowMs` is passed in so it stays pure. */
export function consentStatus(record: Pick<ConsentRecord, "revoked_at" | "expires_at">, nowMs: number): ConsentStatus {
  if (record.revoked_at) return "revoked";
  if (record.expires_at) {
    const end = Date.parse(record.expires_at);
    if (!Number.isNaN(end) && end <= nowMs) return "expired";
  }
  return "active";
}

/**
 * Wraps a user-supplied or Latin name in Unicode first-strong isolates so it cannot reorder the surrounding
 * Arabic or Urdu sentence. Used where markup is not possible (select options, interpolated messages).
 */
export function isolate(value: string): string {
  return `⁨${value}⁩`;
}
