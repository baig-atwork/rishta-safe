"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale, ReviewPriority } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { moveCursor, type WaitingUnit } from "@/lib/staff-brief";
import { PriorityTag } from "./PriorityTag";

export interface QueueRow {
  coupleId: string;
  label: string;
  priority: ReviewPriority;
  ruleId: string | null;
  moreRules: number;
  waiting: { n: number; unit: WaitingUnit };
}

export function caseHref(coupleId: string): string {
  return `/staff/couples/${encodeURIComponent(coupleId)}`;
}

/**
 * The queue pane. J and K move the cursor (aria-selected), Enter opens the case under the cursor; when focus is on a
 * case link, J and K move that focus too and Enter keeps its native meaning (follow the link). The opened case is the
 * initial cursor. Opening a case is a route change, so the brief is a server read and nothing is written.
 */
export function QueuePane({ rows, selectedId }: { rows: readonly QueueRow[]; selectedId: string | null }) {
  const t = useTranslations("staff.queue");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const links = useRef<(HTMLAnchorElement | null)[]>([]);

  const indexOfSelected = selectedId === null ? -1 : rows.findIndex((row) => row.coupleId === selectedId);
  const [cursor, setCursor] = useState(indexOfSelected);
  const [seen, setSeen] = useState(selectedId);
  if (seen !== selectedId) {
    // The route changed to another case: the cursor follows it (adjusting state during render, not in an effect).
    setSeen(selectedId);
    setCursor(indexOfSelected);
  }

  // One document-level handler (the queue has no focusable container, so a role-less region never takes key events).
  // It reads the latest cursor and rows through a ref, and ignores typing in a field and any modified key.
  const latest = useRef({ cursor, rows, router });
  useEffect(() => {
    latest.current = { cursor, rows, router };
  });
  const paneRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target !== null && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName) || target.closest("dialog") !== null)) return;
      const key = event.key.toLowerCase();
      const onLink = target instanceof HTMLAnchorElement;
      const { cursor, rows: list, router: nav } = latest.current;
      // With focus on a case link the move starts from that row, so J never lands on the row already focused.
      const focused = onLink ? links.current.indexOf(target) : -1;
      const at = focused >= 0 ? focused : cursor;
      if (key === "j" || key === "k") {
        event.preventDefault();
        const next = moveCursor(at, key === "j" ? 1 : -1, list.length);
        setCursor(next);
        if (onLink && paneRef.current?.contains(target)) links.current[next]?.focus();
        return;
      }
      // Enter opens the cursor row only when focus is not on something that already handles Enter.
      if (key === "enter" && (target === null || target === document.body || (paneRef.current?.contains(target) === true && !onLink))) {
        const row = list[at];
        if (row !== undefined) {
          event.preventDefault();
          nav.push(caseHref(row.coupleId));
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section ref={paneRef} aria-labelledby="queue-title" aria-describedby="queue-keys" data-testid="queue-pane">
      <div className="inst-h">
        <h1 id="queue-title">{t("title")}</h1>
        <span className="inst-meta">{t("meta", { count: formatNumber(locale, rows.length) })}</span>
      </div>
      <table className="tbl">
        <caption className="sr-only">{t("tableLabel")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("col.case")}</th>
            <th scope="col">{t("col.priority")}</th>
            <th scope="col">{t("col.rule")}</th>
            <th scope="col" className="num">
              {t("col.waiting")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.coupleId} aria-selected={index === cursor ? true : undefined} data-couple-id={row.coupleId}>
              <th scope="row" className="text-start font-normal">
                <Link
                  ref={(node: HTMLAnchorElement | null) => {
                    links.current[index] = node;
                  }}
                  href={caseHref(row.coupleId)}
                  className="inst-case"
                  aria-current={row.coupleId === selectedId ? "true" : undefined}
                >
                  <bdi dir="ltr">{row.label}</bdi>
                </Link>
              </th>
              <td>
                <PriorityTag priority={row.priority} />
              </td>
              <td>
                {row.ruleId !== null ? (
                  <>
                    <bdi dir="ltr" className="inst-rule">
                      {row.ruleId}
                    </bdi>
                    {row.moreRules > 0 ? (
                      <>
                        {" "}
                        <span className="inst-more inst-rule" aria-hidden="true">
                          +{formatNumber(locale, row.moreRules)}
                        </span>
                        <span className="sr-only">{t("moreRules", { count: formatNumber(locale, row.moreRules) })}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="text-fg-3">{t("noReason")}</span>
                )}
              </td>
              <td className="num">
                <bdi dir="ltr">{t(`waiting.${row.waiting.unit}`, { count: formatNumber(locale, row.waiting.n) })}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p id="queue-keys" className="inst-keys font-mono">
        {t("keys")}
      </p>
    </section>
  );
}
