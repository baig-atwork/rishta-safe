import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { KpiDetail, ProgrammeFigures } from "@/components/programme/KpiDetail";
import { CountBar } from "@/components/programme/RatioBar";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { readSession } from "@/lib/session";

export default async function ProgrammePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || (session.role !== "programme" && session.role !== "judge")) return <NeedPersona role="programme" />;

  const t = await getTranslations("programme");
  const tp = await getTranslations("pathway");
  const active = (await getLocale()) as Locale;

  const header = <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />;
  /** Persistent in every state: these are synthetic cases, never national statistics, and no individual result is visible. */
  const notice = (
    <section aria-labelledby="programme-notice-title" className="mb-8 grid gap-2 border-y border-line py-4">
      <h2 id="programme-notice-title" className="m-0 font-sans text-base font-semibold">
        {t("notice.title")}
      </h2>
      <p className="measure m-0 text-fg-2">{t("notice.body")}</p>
      <p className="m-0 font-semibold">{t("notice.noResults")}</p>
    </section>
  );

  const result = await settle(() => serverApi().kpis());
  if (result.error) {
    return (
      <div>
        {header}
        {notice}
        <ErrorState problem={result.error.problem} />
      </div>
    );
  }

  const kpis = result.data;
  if (kpis.cases_total === 0) {
    return (
      <div>
        {header}
        {notice}
        <EmptyState title={t("empty.title")} body={t("empty.body")} actionHref="/demo" actionLabel={t("empty.cta")} />
      </div>
    );
  }

  const maxCount = Math.max(1, ...kpis.by_state.map((row) => row.count));

  return (
    <div>
      {header}
      {notice}

      <p className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-2">
        {kpis.synthetic ? <span className="stamp">{t("stamp.synthetic")}</span> : null}
        <span>{t("casesTotal", { count: formatNumber(active, kpis.cases_total) })}</span>
        <span>{t("generated", { when: formatDateTime(active, kpis.generated_at) })}</span>
      </p>

      <div className="grid gap-10">
        {/* Three large figures first, then the rest as one ruled table. The real backend reports flagged-case referral,
            counselling and times; it has no per-state breakdown, so that section is drawn only when there is data. */}
        <ProgrammeFigures kpis={kpis} locale={active} />
        {kpis.detail ? <KpiDetail detail={kpis.detail} locale={active} /> : null}

        {kpis.by_state.length === 0 ? null : (
          <section aria-labelledby="states-title" className="grid gap-4">
            <h2 id="states-title" className="m-0 text-xl">
              {t("states.title")}
            </h2>
            <table className="data-table">
              <caption className="sr-only">{t("states.caption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("states.col.state")}</th>
                  <th scope="col">{t("states.col.cases")}</th>
                  <th scope="col">{t("states.col.median")}</th>
                  <th scope="col">{t("states.col.breaches")}</th>
                </tr>
              </thead>
              <tbody>
                {kpis.by_state.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="bg-transparent font-semibold text-fg">
                      {tp(`state.${row.key}`)}
                    </th>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="min-w-8 font-semibold mono">{formatNumber(active, row.count)}</span>
                        <CountBar count={row.count} max={maxCount} />
                      </div>
                    </td>
                    <td className="mono">
                      {row.median_hours === null ? (
                        <span className="text-fg-3">{t("states.noData")}</span>
                      ) : (
                        formatNumber(active, row.median_hours, { maximumFractionDigits: 1 })
                      )}
                    </td>
                    <td className={row.sla_breaches > 0 ? "font-semibold mono" : "mono"}>
                      {formatNumber(active, row.sla_breaches)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <p className="mono mt-10 border-t border-line pt-4 text-xs text-fg-3">{t("footer")}</p>
    </div>
  );
}
