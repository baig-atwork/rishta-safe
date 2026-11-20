"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { AuditEvent, AuditVerification, Locale } from "@/lib/api/types";
import { AUDIT_VISIBLE_ROWS, AUDIT_VISIBLE_ROWS_NARROW, type AuditRun, groupAuditRuns, windowAuditRuns } from "@/lib/couple-audit";
import { useNarrow } from "@/lib/couple-narrow";
import { formatDateTime, shortHash } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { CAPTION, TABLE, TABLE_WRAP, TBODY, TD, THEAD, TR } from "./table-classes";

export interface AuditTrailProps {
  initialEvents: AuditEvent[];
  coupleId: string;
  locale: Locale;
}

/** Rows tick one by one while the chain is checked; 40ms apart, and only the first dozen so a long log stays quick. */
const TICK_MS = 40;
const TICK_CAP = 12;

type RowMark = "none" | "ticking" | "checked" | "mismatch";

function HashCell({ value, none }: { value: string; none: string }) {
  if (!value) return <span className="text-fg-3">{none}</span>;
  return (
    <code className="ltr-run font-mono text-xs" title={value}>
      {shortHash(value)}
    </code>
  );
}

/**
 * The couple's audit events, each with its hash and the previous event's hash, and a button that asks the API to
 * verify the whole chain. The status shows exactly what the API returned: ok with length and head hash, or the
 * first index that does not match. Nothing more is claimed.
 *
 * However long the log gets, the page stays short: Verify sits above the list, consecutive identical events fold
 * into one row ("token_issued x 12"), the newest 20 rows are open, and the next 100 are behind a disclosure.
 */
export function AuditTrail({ initialEvents, coupleId, locale }: AuditTrailProps) {
  const t = useTranslations("sharing.audit");

  const query = useQuery<AuditEvent[], ApiError>({
    queryKey: ["audit", coupleId],
    queryFn: () => clientApi.audit(coupleId),
    initialData: initialEvents,
    staleTime: 60_000,
  });
  // Newest first: what just happened is at the top. Rows added after the first render settle into view (180 ms).
  const events = [...query.data].sort((a, b) => b.index - a.index);
  const [baseline] = useState(() => initialEvents.reduce((max, e) => Math.max(max, e.index), -1));

  const verify = useMutation<AuditVerification, ApiError>({ mutationFn: () => clientApi.verifyAudit() });
  const [ticks, setTicks] = useState(0);
  const [animating, setAnimating] = useState(false);
  /** The log length the result was obtained for; a longer log means the result is out of date and is not shown. */
  const [verifiedFor, setVerifiedFor] = useState<number | null>(null);

  const mismatchIndex = verify.data && !verify.data.ok ? verify.data.first_bad_index : null;
  const narrow = useNarrow();
  const windowed = windowAuditRuns(groupAuditRuns(events, new Set(mismatchIndex === null ? [] : [mismatchIndex])), narrow ? AUDIT_VISIBLE_ROWS_NARROW : AUDIT_VISIBLE_ROWS);
  const tickTarget = Math.min(windowed.visible.length, TICK_CAP);

  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(() => {
      if (ticks >= tickTarget) setAnimating(false);
      else setTicks(ticks + 1);
    }, TICK_MS);
    return () => clearTimeout(timer);
  }, [animating, ticks, tickTarget]);

  function start() {
    setTicks(0);
    setAnimating(!prefersReducedMotion() && events.length > 0);
    setVerifiedFor(events.length);
    verify.mutate();
  }

  const result = verify.data;
  const current = verifiedFor === events.length;
  const busy = verify.isPending || animating;
  const showResult = !busy && current && result !== undefined;

  function markFor(run: AuditRun, position: number, ticking: boolean): RowMark {
    const index = run.newest.index;
    if (busy) return ticking && position < ticks && position < tickTarget ? "ticking" : "none";
    if (!showResult || result === undefined) return "none";
    if (result.ok) return "checked";
    if (result.first_bad_index === null) return "none";
    if (index < result.first_bad_index) return "checked";
    return index === result.first_bad_index ? "mismatch" : "none";
  }

  function renderTable(runs: readonly AuditRun[], caption: string, ticking: boolean) {
    return (
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <caption className={CAPTION}>{caption}</caption>
          <thead className={THEAD}>
            <tr>
              {(["index", "time", "actor", "action", "detail", "prevHash", "hash"] as const).map((column) => (
                <th key={column} scope="col" className={column === "index" ? "whitespace-nowrap" : undefined}>
                  {t(`columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={TBODY}>
            {runs.map((run, position) => {
              const event = run.newest;
              const mark = markFor(run, position, ticking);
              return (
                <tr key={event.event_id} className={event.index > baseline ? `${TR} row-settle` : TR} data-mark={mark}>
                  <td className={TD} data-label={t("columns.index")}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="ltr-run whitespace-nowrap font-mono">{run.count > 1 ? `${run.oldest.index}-${event.index}` : event.index}</span>
                      {mark === "ticking" || mark === "checked" ? (
                        <span aria-hidden="true" className={mark === "ticking" ? "verify-tick text-ok-fg" : "text-ok-fg"}>
                          <Check size={16} strokeWidth={2.25} />
                        </span>
                      ) : null}
                      {mark === "mismatch" ? <span className="tag tag-attention">{t("firstMismatch")}</span> : null}
                    </span>
                  </td>
                  <td className={TD} data-label={t("columns.time")}>
                    <span>{formatDateTime(locale, event.at)}</span>
                  </td>
                  <td className={TD} data-label={t("columns.actor")}>
                    <span>{t.has(`role.${event.actor_role}`) ? t(`role.${event.actor_role}`) : <bdi>{event.actor_role}</bdi>}</span>
                  </td>
                  <td className={TD} data-label={t("columns.action")}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <code className="ltr-run whitespace-nowrap font-mono text-xs">{event.action}</code>
                      {run.count > 1 ? <bdi dir="ltr" className="tag whitespace-nowrap">
                          {t("runCount", { count: run.count })}
                        </bdi> : null}
                    </span>
                  </td>
                  <td className={TD} data-label={t("columns.detail")}>
                    <span>
                      <bdi>{event.detail}</bdi>
                    </span>
                  </td>
                  <td className={TD} data-label={t("columns.prevHash")}>
                    <HashCell value={run.oldest.prev_hash} none={t("none")} />
                  </td>
                  <td className={TD} data-label={t("columns.hash")}>
                    <HashCell value={event.hash} none={t("none")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section id="audit" aria-labelledby="audit-title" className="grid scroll-mt-24 gap-4">
      <div>
        <h2 id="audit-title" className="mb-1 text-xl">
          {t("title")}
        </h2>
        <p className="measure m-0 text-fg-2">{t("intro")}</p>
      </div>

      {query.isRefetchError ? (
        <div role="alert" className="panel-sunken panel-attention">
          <p className="m-0 font-semibold">{t("refreshError")}</p>
          <p className="m-0 mt-1 text-sm text-fg-2">
            <bdi>{query.error.problem.title}</bdi>
            {query.error.correlationId ? (
              <>
                {" "}
                <code className="ltr-run font-mono">{query.error.correlationId}</code>
              </>
            ) : null}
          </p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => void query.refetch()}>
            {t("refreshRetry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-secondary" aria-busy={busy} disabled={busy} onClick={start}>
          <ShieldCheck size={18} aria-hidden="true" />
          {t("verify")}
        </button>
        <div role="status" aria-live="polite" className="min-h-6 text-sm">
          {busy ? <span className="text-fg-2">{t("verifying")}</span> : null}
          {showResult && result !== undefined && result.ok ? (
            <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="tag tag-ok">{t("okTag")}</span>
              <span className="text-fg-2">
                {result.length !== null && result.head_hash !== null ? (
                  <>
                    {t("okDetail", { length: result.length })} <code className="ltr-run font-mono text-xs">{shortHash(result.head_hash)}</code>
                  </>
                ) : (
                  t("okOwn", { count: result.own_events ?? 0 })
                )}
              </span>
            </p>
          ) : null}
          {showResult && result !== undefined && !result.ok ? (
            <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="tag tag-attention">{t("brokenTag")}</span>
              <span className="text-fg-2">
                {result.first_bad_index !== null ? t("brokenDetail", { index: result.first_bad_index }) : t("brokenNoIndex")}
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <p className="m-0 text-sm text-fg-3">{t("scopeNote")}</p>

      {verify.error && !busy ? (
        <p role="alert" className="field-error m-0">
          {verify.error.problem.title}
          {verify.error.correlationId ? (
            <>
              {" "}
              <code className="ltr-run font-mono">{verify.error.correlationId}</code>
            </>
          ) : null}
        </p>
      ) : null}

      {events.length === 0 ? (
        <p className="panel-sunken m-0 text-fg-2">{t("empty")}</p>
      ) : (
        <>
          {renderTable(windowed.visible, t("caption"), true)}
          {windowed.earlier.length > 0 ? (
            <details className="audit-earlier">
              <summary className="btn btn-link cursor-pointer">{t("earlier", { count: windowed.earlierEvents })}</summary>
              <div className="mt-3 grid gap-3">
                {renderTable(windowed.earlier, t("earlierCaption"), false)}
                {windowed.unlistedEvents > 0 ? (
                  <p className="m-0 text-sm text-fg-3">
                    {t("earlierCapped", { listed: windowed.earlierEvents - windowed.unlistedEvents, unlisted: windowed.unlistedEvents })}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
