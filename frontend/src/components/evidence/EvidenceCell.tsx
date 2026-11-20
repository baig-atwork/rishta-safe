import clsx from "clsx";
import { useTranslations } from "next-intl";
import { Cell } from "@/components/grid/Cell";
import type { Locale } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";

export interface EvidenceCellProps {
  /** The scoreboard's metric id (M1, M5 and so on): shown in mono so a judge can match it to the API. */
  id: string;
  title: string;
  /** The API's own value sentence, verbatim (the scoreboard is English only, so it is marked lang="en" on any page). */
  value: string;
  n: number | null;
  measured: boolean;
  /** How it was measured. The landing leaves it out; the Evidence page shows it. */
  method?: string | undefined;
  /** What the figure cannot tell you. Always visible, never in a tooltip. */
  doesNotShow: string;
  locale: Locale;
  headingLevel?: 2 | 3;
  /** `gate`: a 100% regression gate, not safety evidence. `weakest`: the figure shown first because it is the weakest. */
  tag?: "gate" | "weakest" | undefined;
  /** Grid placement (column spans) from the page that lays the cells out. */
  className?: string | undefined;
}

/** A hatched strip: the "not run" channel. Pattern, not colour, says nothing was measured. */
function HatchStrip() {
  return (
    <div aria-hidden="true" className="flex h-3 w-full min-w-0 overflow-hidden text-fg-3">
      {Array.from({ length: 64 }, (_, index) => (
        <Cell key={index} fill="hatch" size={12} />
      ))}
    </div>
  );
}

/**
 * One measure of the scoreboard as a registry cell. Measured cells are plain (a solid cell); NOT RUN cells are hatched
 * with a dashed edge. Every cell says what it does not show, in the open.
 */
export function EvidenceCell({ id, title, value, n, measured, method, doesNotShow, locale, headingLevel = 3, tag, className }: EvidenceCellProps) {
  const t = useTranslations("judge");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article
      aria-labelledby={`ev-${id}-name`}
      data-status={measured ? "measured" : "not_run"}
      className={clsx("flex min-w-0 flex-col content-start gap-3 p-4", !measured && "border border-dashed border-line-strong", className)}
    >
      {measured ? null : <HatchStrip />}
      <header className="flex items-center gap-2">
        <Cell fill={measured ? "solid" : "hatch"} size={12} />
        <span className="label">{measured ? t("metric.measured") : t("metric.notRun")}</span>
        <span className="label ltr ms-auto">{id}</span>
      </header>
      {tag ? <span className="stamp w-fit">{tag === "gate" ? t("metric.gate") : t("metric.weakest")}</span> : null}
      <Heading id={`ev-${id}-name`} lang="en" dir="ltr" className="m-0 text-sm font-semibold leading-snug">
        {title}
      </Heading>
      <p lang="en" dir="ltr" className={clsx("mono m-0 text-sm leading-snug", measured ? "text-fg" : "text-fg-2")}>
        {value}
      </p>
      {n === null ? null : (
        <p className="label m-0 ltr">
          {t("metric.n")} = {formatNumber(locale, n)}
        </p>
      )}
      {method ? (
        <p className="m-0 text-sm text-fg-2">
          <span className="label mb-1 block">{t("metric.method")}</span>
          <span lang="en" dir="ltr" className="block text-start">
            {method}
          </span>
        </p>
      ) : null}
      <p className="m-0 border-t border-dashed border-line-strong pt-3 text-sm text-fg-2">
        <span className="label mb-1 block">{t("metric.doesNotShow")}</span>
        <span lang="en" dir="ltr" className="block text-start">
          {doesNotShow}
        </span>
      </p>
    </article>
  );
}
