import type { AuditEvent } from "@/lib/api/types";

/** One visible row of the audit table: a run of consecutive events with the same action and actor, newest first. */
export interface AuditRun {
  /** The newest event of the run; its number, time, detail and hash stand for the row. */
  newest: AuditEvent;
  /** The oldest event of the run; its previous hash is where the run starts in the chain. */
  oldest: AuditEvent;
  count: number;
}

/** Rows shown in the open table, then the capped list behind the disclosure. */
export const AUDIT_VISIBLE_ROWS = 20;
/** On a phone each row is a tall card, so fewer are open. */
export const AUDIT_VISIBLE_ROWS_NARROW = 8;
export const AUDIT_EARLIER_ROWS = 100;

/**
 * Collapse consecutive events with the same action and actor into one run ("token_issued x 12"). `events` must be
 * newest first. An event listed in `keepApart` (the first mismatch a verification found) is never merged, so it stays
 * visible on its own row.
 */
export function groupAuditRuns(events: readonly AuditEvent[], keepApart: ReadonlySet<number> = new Set()): AuditRun[] {
  const runs: AuditRun[] = [];
  for (const event of events) {
    const last = runs[runs.length - 1];
    const mergeable =
      last !== undefined &&
      !keepApart.has(event.index) &&
      !keepApart.has(last.oldest.index) &&
      last.oldest.action === event.action &&
      last.oldest.actor_role === event.actor_role;
    if (mergeable) {
      last.oldest = event;
      last.count += 1;
    } else {
      runs.push({ newest: event, oldest: event, count: 1 });
    }
  }
  return runs;
}

export interface AuditWindow {
  /** The rows that are always on screen. */
  visible: AuditRun[];
  /** The next rows, behind the collapsed disclosure; capped. */
  earlier: AuditRun[];
  /** Events in all earlier rows, listed or not (the number in "Show earlier events (N)"). */
  earlierEvents: number;
  /** Events that are in the log but not listed at all because of the cap. */
  unlistedEvents: number;
}

export function windowAuditRuns(runs: readonly AuditRun[], visibleRows: number = AUDIT_VISIBLE_ROWS): AuditWindow {
  const visible = runs.slice(0, visibleRows);
  const rest = runs.slice(visibleRows);
  const earlier = rest.slice(0, AUDIT_EARLIER_ROWS);
  const sum = (list: readonly AuditRun[]) => list.reduce((total, run) => total + run.count, 0);
  return { visible, earlier, earlierEvents: sum(rest), unlistedEvents: sum(rest.slice(AUDIT_EARLIER_ROWS)) };
}
