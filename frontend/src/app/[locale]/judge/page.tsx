import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { EvidenceCell } from "@/components/evidence/EvidenceCell";
import { ProbeConsole } from "@/components/evidence/ProbeConsole";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { Link } from "@/i18n/navigation";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale, Scoreboard } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { evidenceSpan, isRegressionGate, recordedScoreboard, weakestFirst } from "@/lib/public-landing";
import { loadProbePreviews } from "@/lib/public-probe-server";
import { readSession } from "@/lib/session";

export default async function JudgePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  const canProbe = session !== null && (session.role === "judge" || session.role === "programme");

  const t = await getTranslations("judge");
  const active = (await getLocale()) as Locale;
  const header = <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />;

  // With a lens the scoreboard is the live endpoint. Without one it is the recorded response, labelled as such, so the page
  // is never a dead end for a visitor who followed the landing page here.
  const live = canProbe ? await settle(() => serverApi().scoreboard()) : null;
  const board: Scoreboard | null = live ? live.data : recordedScoreboard();
  const classifier = board?.metrics.find((m) => m.id === "M6") ?? null;
  const metrics = board ? weakestFirst(board.metrics) : [];
  // The probe console shows each request before it is sent: the personas (without tokens) let it name the acting persona.
  const probePreviews = canProbe ? await loadProbePreviews() : null;

  return (
    <div>
      {header}
      <div className="grid gap-12">
        {canProbe ? (
          <ProbeConsole classifierNote={classifier ? { title: classifier.name, value: classifier.value } : null} previews={probePreviews} />
        ) : (
          <EmptyState title={t("public.lensTitle")} body={t("public.lensBody")} actionHref="/demo" actionLabel={t("empty.cta")} />
        )}

        <section aria-labelledby="scoreboard-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="scoreboard-title" className="m-0 text-xl">
              {t("scoreboard.title")}
            </h2>
            {board ? (
              <p className="mono ltr m-0 text-xs text-fg-3">
                {live ? "" : `${t("public.recorded")} · `}
                {t("generated", { when: formatDateTime(active, board.generated_at) })}
              </p>
            ) : null}
          </div>
          <p className="m-0 mt-2 max-w-[66ch] text-fg-2">{t("scoreboard.intro")}</p>
          {active === "en" ? null : <p className="m-0 mt-2 max-w-[66ch] text-sm font-semibold text-fg">{t("englishNote")}</p>}
          <ul className="m-0 mt-4 grid list-none gap-1 p-0 text-sm text-fg-2">
            <li>{t("framing.synthetic")}</li>
            <li>{t("framing.regression")}</li>
            <li>{t("framing.notRun")}</li>
          </ul>

          {live?.error ? (
            <div className="mt-6">
              <ErrorState problem={live.error.problem} />
            </div>
          ) : board && board.metrics.length === 0 ? (
            <div className="mt-6">
              <EmptyState title={t("empty.title")} body={t("empty.body")} actionHref="/demo" actionLabel={t("empty.cta")} />
            </div>
          ) : board ? (
            <div className="mt-6 grid border-e border-t border-line bg-surface-raised sm:grid-cols-2 lg:grid-cols-3 [&>*]:border-b [&>*]:border-s [&>*]:border-line">
              {metrics.map((metric, index) => (
                <EvidenceCell
                  key={metric.id}
                  tag={index === 0 && metric.id === "M6" ? "weakest" : isRegressionGate(metric.id) ? "gate" : undefined}
                  className={evidenceSpan(metrics.length, index, { leadWide: false, wideColumns: 3 })}
                  id={metric.id}
                  title={metric.name}
                  value={metric.value}
                  n={metric.n}
                  measured={metric.status === "measured"}
                  method={metric.method}
                  doesNotShow={metric.does_not_show}
                  locale={active}
                />
              ))}
            </div>
          ) : null}

          {board && board.caveats && board.caveats.length > 0 ? (
            <div className="mt-8">
              <h3 className="label m-0 mb-2">{t("scoreboard.caveats")}</h3>
              <ul lang="en" dir="ltr" className="m-0 grid max-w-[80ch] list-disc gap-1 ps-5 text-sm text-fg-2">
                {board.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <nav aria-labelledby="links-title" className="border-t border-line pt-6">
          <h2 id="links-title" className="m-0 text-xl">
            {t("links.title")}
          </h2>
          <ul className="m-0 mt-3 grid list-none gap-1 p-0">
            <li>
              <Link href="/governance" className="inline-flex min-h-11 items-center">
                {t("links.governance")}
              </Link>
            </li>
            <li>
              <Link href="/governance#limits" className="inline-flex min-h-11 items-center">
                {t("links.limits")}
              </Link>
            </li>
            <li>
              <Link href="/governance#data-declaration" className="inline-flex min-h-11 items-center">
                {t("links.declaration")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
