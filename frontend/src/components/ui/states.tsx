import { useTranslations } from "next-intl";
import { Cell, type CellFill } from "@/components/grid/Cell";
import { Link } from "@/i18n/navigation";
import { RetryButton } from "./RetryButton";
import type { ProblemDetails } from "@/lib/api/types";

export function PageHeader({
  eyebrow,
  title,
  standfirst,
  children,
}: {
  eyebrow?: string;
  title: string;
  standfirst?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-line pb-5">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h1 className="max-w-[30ch] sm:max-w-none">{title}</h1>
      {standfirst ? <p className="standfirst mt-3">{standfirst}</p> : null}
      {children}
    </header>
  );
}

/** The empty-state motif: a few cells, one still to come. Decorative; the words carry the meaning. */
const EMPTY_MOTIF: { fill: CellFill; dashed?: boolean }[] = [
  { fill: "open" },
  { fill: "hatch" },
  { fill: "open" },
  { fill: "open" },
  { fill: "open", dashed: true },
  { fill: "open" },
];

/** Empty state as onboarding: what is missing, why it matters, the next step. Never a dead end. */
export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="panel-sunken flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8" aria-labelledby="empty-title">
      <div className="tally shrink-0" style={{ "--tally-cols": 3, "--cell-size": "18px" } as React.CSSProperties} aria-hidden="true">
        {EMPTY_MOTIF.map((cell, index) => (
          <Cell key={index} fill={cell.fill} dashed={cell.dashed} />
        ))}
      </div>
      <div className="max-w-xl">
        <h2 id="empty-title">{title}</h2>
        <p className="measure mt-2 text-fg-2">{body}</p>
        {(actionHref && actionLabel) || (secondaryHref && secondaryLabel) ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {actionHref && actionLabel ? (
              <Link href={actionHref} className="btn btn-primary">
                {actionLabel}
              </Link>
            ) : null}
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="btn btn-quiet">
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Error state: plain message, retry, and the correlation id support can look up. */
export function ErrorState({ problem }: { problem: ProblemDetails }) {
  const t = useTranslations("states");
  return (
    <section role="alert" className="panel panel-attention">
      <h2>{t("errorTitle")}</h2>
      <p className="measure mt-2 text-fg-2">{t("errorBody")}</p>
      <dl className="mt-3 grid gap-1 text-sm text-fg-3">
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">{t("errorWhat")}</dt>
          <dd>
            <bdi>{problem.title}</bdi>
            {problem.status ? (
              <>
                {" "}
                (<span className="ltr-run">{problem.status}</span>)
              </>
            ) : null}
          </dd>
        </div>
        {problem.correlation_id ? (
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">{t("correlationId")}</dt>
            <dd>
              <code className="ltr-run">{problem.correlation_id}</code>
            </dd>
          </div>
        ) : null}
      </dl>
      <RetryButton label={t("retry")} />
    </section>
  );
}

/** Partial state: the surface works with part of its data; say which part is missing. */
export function PartialNotice({ children }: { children: React.ReactNode }) {
  const t = useTranslations("states");
  return (
    <p role="status" className="tag tag-info mb-4 px-3 py-1 text-sm font-normal">
      <strong className="font-semibold">{t("partialLabel")}</strong> <span>{children}</span>
    </p>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className ?? ""}`} />;
}

/** Skeleton table rows of fixed height (36 px, the instrument row height) so a list does not shift when data arrives. */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  const t = useTranslations("states");
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="grid gap-px">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBlock key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

/** A skeleton that mirrors a page (header band, then a focal block and a side block) so nothing shifts when data arrives. */
export function PageSkeleton() {
  const t = useTranslations("states");
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-8 border-b border-line pb-5">
        <SkeletonBlock className="mb-3 h-3 w-28" />
        <SkeletonBlock className="mb-3 h-8 w-3/4 max-w-xl" />
        <SkeletonBlock className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  );
}
