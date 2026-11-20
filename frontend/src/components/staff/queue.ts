import type { DueByHint, EscalationItem, ReviewPriority } from "@/lib/api/types";

const PRIORITY_ORDER: Record<ReviewPriority, number> = { urgent: 0, priority: 1, routine: 2 };
const DUE_ORDER: Record<DueByHint, number> = { immediate: 0, same_session: 1, fast_track: 2, routine: 3 };

function raisedAtMs(item: EscalationItem): number {
  const ms = Date.parse(item.raised_at);
  return Number.isNaN(ms) ? 0 : ms;
}

/** The most urgent due-by hint among a row's rules; rows without hints (fixture mode) rank last within a priority. */
function topDue(item: EscalationItem): number {
  const ranks = item.decisions.flatMap((d) => (d.due_by_hint === undefined ? [] : [DUE_ORDER[d.due_by_hint]]));
  return ranks.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...ranks);
}

/**
 * Urgent first, then priority, then routine; inside a level the row with the most urgent due-by hint first, then the
 * longest-waiting case.
 */
export function sortEscalations(items: readonly EscalationItem[]): EscalationItem[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_ORDER[a.review_priority] - PRIORITY_ORDER[b.review_priority] || topDue(a) - topDue(b) || raisedAtMs(a) - raisedAtMs(b),
  );
}
