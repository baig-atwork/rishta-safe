import type { IconArraySpec } from "./api/types";

export type IconKind = "affected" | "carrier" | "neither";

export interface IconArray {
  /** Exactly `total` icons, grouped in the order affected, carrier, neither. */
  icons: IconKind[];
  total: number;
  counts: Record<IconKind, number>;
  /** False when the parts do not add up to the whole; callers must show an error, never repair silently. */
  valid: boolean;
  problem: "none" | "negative_or_fractional" | "sum_mismatch" | "total_not_positive";
}

/**
 * Builds the part-to-whole icon array. The engine supplies the numbers; this only lays them out. A spec whose
 * parts do not sum to the total is reported invalid rather than padded, so a wrong number is never drawn.
 */
export function buildIconArray(spec: IconArraySpec): IconArray {
  const counts: Record<IconKind, number> = { affected: spec.affected, carrier: spec.carrier, neither: spec.neither };
  const values = [spec.total, spec.affected, spec.carrier, spec.neither];
  if (!(spec.total > 0)) {
    return { icons: [], total: spec.total, counts, valid: false, problem: "total_not_positive" };
  }
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    return { icons: [], total: spec.total, counts, valid: false, problem: "negative_or_fractional" };
  }
  if (spec.affected + spec.carrier + spec.neither !== spec.total) {
    return { icons: [], total: spec.total, counts, valid: false, problem: "sum_mismatch" };
  }
  const icons: IconKind[] = [
    ...Array<IconKind>(spec.affected).fill("affected"),
    ...Array<IconKind>(spec.carrier).fill("carrier"),
    ...Array<IconKind>(spec.neither).fill("neither"),
  ];
  return { icons, total: spec.total, counts, valid: true, problem: "none" };
}

/** Columns for the grid: 10 by 10 for the fixed 100 array; a single square-ish grid otherwise. */
export function iconColumns(total: number): number {
  return total === 100 ? 10 : Math.max(1, Math.ceil(Math.sqrt(total)));
}
