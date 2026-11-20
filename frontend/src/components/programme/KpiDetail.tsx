import { useTranslations } from "next-intl";
import type { Locale, ProgrammeKpiDetail, ProgrammeKpis } from "@/lib/api/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { heroFigures, toDuration, type HeroFigure } from "@/lib/public-programme";
import { RatioBar } from "./RatioBar";

/** One large figure: a plain label, the number in mono with its unit, a line of context and the "simulated" stamp. */
function Figure({ label, value, unit, sub, children }: { label: string; value: React.ReactNode; unit?: string | undefined; sub?: string | undefined; children?: React.ReactNode }) {
  const t = useTranslations("programme");
  return (
    <li className="grid content-start gap-2 border-t border-line pt-5 md:border-t-0 md:border-s md:ps-6 md:first:border-s-0 md:first:ps-0">
      <p className="m-0 text-sm font-semibold text-fg-2">{label}</p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 font-mono text-5xl font-semibold leading-none sm:text-6xl">
        <span className="ltr">{value}</span>
        {unit ? <span className="text-lg font-normal text-fg-2">{unit}</span> : null}
      </p>
      {sub ? <p className="m-0 text-sm text-fg-2">{sub}</p> : null}
      {children}
      <span className="stamp w-fit">{t("stamp.simulated")}</span>
    </li>
  );
}

function HeroFigureView({ figure, locale, target }: { figure: HeroFigure; locale: Locale; target: number }) {
  const t = useTranslations("programme");
  const none = <span className="text-fg-3">{t("hero.noData")}</span>;
  switch (figure.id) {
    case "referred":
      return (
        <Figure
          label={t("hero.referred.label")}
          value={figure.value === null ? none : formatPercent(locale, figure.value)}
          sub={figure.value === null ? t("referral.none") : `${t("referral.targetShare", { value: formatPercent(locale, target) })}. ${figure.value >= target ? t("referral.atOrAbove") : t("referral.below")}`}
        >
          {figure.value === null ? null : (
            <RatioBar
              ratio={figure.value}
              target={target}
              label={`${t("hero.referred.label")}. ${formatPercent(locale, figure.value)}. ${t("referral.targetShare", { value: formatPercent(locale, target) })}`}
            />
          )}
        </Figure>
      );
    case "result": {
      const median = figure.hours === null ? null : toDuration(figure.hours);
      const p90 = figure.p90Hours === null ? null : toDuration(figure.p90Hours);
      return (
        <Figure
          label={t("hero.result.label")}
          value={median === null ? none : formatNumber(locale, median.value, { maximumFractionDigits: 1 })}
          unit={median === null ? undefined : t(`unit.${median.unit}`)}
          sub={
            p90 === null
              ? undefined
              : t("hero.result.sub", {
                  n: formatNumber(locale, figure.n),
                  value: `${formatNumber(locale, p90.value, { maximumFractionDigits: 1 })} ${t(`unit.${p90.unit}`)}`,
                })
          }
        />
      );
    }
    case "counselling":
      return (
        <Figure
          label={t("hero.counselling.label")}
          value={figure.value === null ? none : formatPercent(locale, figure.value)}
          sub={t("hero.counselling.sub", { count: formatNumber(locale, figure.count), total: formatNumber(locale, figure.total) })}
        />
      );
    case "cases":
      return <Figure label={t("hero.cases.label")} value={formatNumber(locale, figure.value)} />;
    case "breaches":
      return <Figure label={t("hero.breaches.label")} value={formatNumber(locale, figure.value)} />;
  }
}

/** The three figures to read first, large. */
export function ProgrammeFigures({ kpis, locale }: { kpis: ProgrammeKpis; locale: Locale }) {
  const t = useTranslations("programme");
  return (
    <section aria-labelledby="hero-figures-title">
      <h2 id="hero-figures-title" className="sr-only">
        {t("hero.title")}
      </h2>
      <ul className="m-0 grid list-none gap-8 p-0 md:grid-cols-3 md:gap-0">
        {heroFigures(kpis).map((figure) => (
          <HeroFigureView key={figure.id} figure={figure} locale={locale} target={kpis.referral_target} />
        ))}
      </ul>
    </section>
  );
}

interface Row {
  key: string;
  measure: string;
  cases?: string | undefined;
  figure: React.ReactNode;
}

/**
 * The rest of the programme figures the real backend publishes, as one ruled table: referral within the standard,
 * counselling, times, open tasks. Every figure is computed from the synthetic demo cases and is shown as such by the page
 * around it; nothing here is, or is presented as, a national statistic. A figure with no cases behind it shows "No data".
 * A group with nothing to report is not drawn at all.
 */
export function KpiDetail({ detail, locale }: { detail: ProgrammeKpiDetail; locale: Locale }) {
  const t = useTranslations("programme");
  const noData = <span className="text-fg-3">{t("states.noData")}</span>;
  const share = (value: number | null) => (value === null ? noData : formatPercent(locale, value));
  const duration = (hours: number | null) => {
    if (hours === null) return noData;
    const d = toDuration(hours);
    return `${formatNumber(locale, d.value, { maximumFractionDigits: 1 })} ${t(`unit.${d.unit}`)}`;
  };

  const rows: Row[] = [
    { key: "flagged", measure: t("rest.flagged"), cases: formatNumber(locale, detail.n_flagged), figure: null },
  ];
  if (detail.share_referred_within_standard !== null) {
    rows.push({
      key: "within",
      measure: t("rest.within", { days: formatNumber(locale, detail.referral_standard_days) }),
      figure: share(detail.share_referred_within_standard),
    });
  }
  rows.push(
    { key: "booked", measure: `${t("detail.counselling.title")}: ${t("detail.counselling.booked")}`, cases: formatNumber(locale, detail.counselling_booked), figure: share(detail.counselling_uptake_booked_share) },
    { key: "completed", measure: `${t("detail.counselling.title")}: ${t("detail.counselling.completed")}`, cases: formatNumber(locale, detail.counselling_completed), figure: share(detail.counselling_uptake_completed_share) },
    { key: "declined", measure: `${t("detail.counselling.title")}: ${t("detail.counselling.declined")}`, cases: formatNumber(locale, detail.counselling_declined), figure: null },
    { key: "t-result", measure: `${t("detail.times.result")}, ${t("detail.times.median")}`, cases: formatNumber(locale, detail.time_to_result.n), figure: duration(detail.time_to_result.median_hours) },
    { key: "t-result-p90", measure: `${t("detail.times.result")}, ${t("detail.times.p90")}`, cases: formatNumber(locale, detail.time_to_result.n), figure: duration(detail.time_to_result.p90_hours) },
    { key: "t-ref", measure: `${t("detail.times.referral")}, ${t("detail.times.median")}`, cases: formatNumber(locale, detail.time_to_referral.n), figure: duration(detail.time_to_referral.median_hours) },
    { key: "t-ref-p90", measure: `${t("detail.times.referral")}, ${t("detail.times.p90")}`, cases: formatNumber(locale, detail.time_to_referral.n), figure: duration(detail.time_to_referral.p90_hours) },
    { key: "closed", measure: t("detail.tasks.closed"), figure: formatNumber(locale, detail.n_closed) },
    { key: "open", measure: t("detail.tasks.open"), figure: formatNumber(locale, detail.open_tasks) },
    { key: "stale", measure: t("detail.tasks.stale"), figure: formatNumber(locale, detail.stale_tasks) },
  );

  return (
    <div className="grid gap-10">
      <section aria-labelledby="detail-rest-title" className="grid gap-3 border-t border-line pt-6">
        <h2 id="detail-rest-title" className="m-0 text-xl">
          {t("rest.title")}
        </h2>
        <table className="data-table">
          <caption className="sr-only">{t("rest.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("rest.col.measure")}</th>
              <th scope="col">{t("rest.col.cases")}</th>
              <th scope="col">{t("rest.col.figure")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="bg-transparent font-semibold text-fg">
                  {row.measure}
                </th>
                <td className="mono">{row.cases ?? null}</td>
                <td className="mono">{row.figure}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail.referral_standard_is_illustrative ? (
          <p className="m-0 text-sm text-fg-3">{t("detail.referral.standardIllustrative", { days: formatNumber(locale, detail.referral_standard_days) })}</p>
        ) : null}
      </section>

      <section aria-labelledby="detail-basis-title" className="grid gap-2">
        <h2 id="detail-basis-title" className="m-0 font-sans text-base font-semibold">
          {t("detail.basis.title")}
        </h2>
        <p dir="auto" className="measure m-0 text-sm text-fg-2">
          {detail.basis}
        </p>
      </section>
    </div>
  );
}
