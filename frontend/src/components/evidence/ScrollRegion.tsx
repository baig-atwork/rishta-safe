import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * A horizontally scrollable region that a keyboard can reach: a named, focusable region (WCAG 2.1.1, and axe's
 * scrollable-region-focusable rule). Used where a table cannot be restacked without losing its meaning (the case bench,
 * the audit rows). On a narrow screen the page itself never scrolls sideways, only this region, and a visible line under
 * it says so (the table's own clipped edge is the second cue).
 */
export function ScrollRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const t = useTranslations("judge");
  return (
    <>
      {/* jsx-a11y/no-noninteractive-tabindex: a scroll container must be focusable for keyboard users; it is a labelled region. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div role="region" aria-label={label} tabIndex={0} className={`overflow-x-auto ${className ?? ""}`.trim()}>
        {children}
      </div>
      <p className="m-0 mt-1.5 text-xs text-fg-3 sm:hidden">{t("scrollHint")}</p>
    </>
  );
}
