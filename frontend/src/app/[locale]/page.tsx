import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { EvidenceCell } from "@/components/evidence/EvidenceCell";
import { MatrixProof, QueueProof, ThresholdProof } from "@/components/landing/Proofs";
import { ProductSheet } from "@/components/landing/ProductSheet";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/api/types";
import { buildLandingSheet, evidenceSpan, landingMetrics, landingQueue } from "@/lib/public-landing";

/** A section with one claim on the reading start and one proof on the reading end. */
function ClaimProof({
  id,
  label,
  title,
  body,
  children,
}: {
  id: string;
  label: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-12 first:border-t-0 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <div>
          <p className="label m-0 mb-3">{label}</p>
          <h2 id={id} className="m-0 max-w-[22ch] text-xl font-semibold leading-tight">
            {title}
          </h2>
          <p className="m-0 mt-4 max-w-[46ch] text-fg-2">{body}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tj = await getTranslations("judge");
  const active = (await getLocale()) as Locale;
  const sheet = buildLandingSheet(active);
  const metrics = landingMetrics();
  const queue = landingQueue();

  return (
    <>
      {/* The only dark fold: a statement row, then the real product object at full width. It breaks out of the shell's
          container to the viewport edge; the html:has() rule keeps the 100vw breakout from adding a scrollbar. */}
      <section
        aria-labelledby="hero-title"
        className="relative -mt-8 w-screen bg-surface-inverse text-fg-inverse ms-[calc(50%-50vw)] sm:-mt-10 [html:has(&)]:overflow-x-clip"
      >
        <div className="wrap py-10 sm:py-14">
          <p className="m-0 mb-4 max-w-[70ch] text-sm leading-snug text-fg-inverse-2">{t("eyebrow")}</p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
            <div>
              <h1
                id="hero-title"
                className="t-display m-0 max-w-[22ch] [:lang(ar)_&]:max-w-[18ch] [:lang(ar)_&]:leading-[1.4] [:lang(ur)_&]:max-w-[18ch] [:lang(ur)_&]:leading-[1.8]"
              >
                {t("title")}
              </h1>
            </div>
            <div className="lg:pt-2">
              <p className="m-0 max-w-[44ch] text-lg leading-relaxed text-fg-inverse-2">{t("lead")}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/demo" className="btn btn-primary bg-accent-on-dark text-surface-inverse hover:bg-accent-on-dark">
                  {t("ctaBench")}
                </Link>
                <Link href="/judge" className="btn btn-link min-h-10 gap-2 text-fg-inverse">
                  {t("ctaEvidence")}
                  <span aria-hidden="true" className="rtl:rotate-180">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-8 sm:mt-10">
            <ProductSheet sheet={sheet} />
          </div>
        </div>
      </section>

      <ClaimProof id="threshold-title" label={t("threshold.label")} title={t("threshold.title")} body={t("threshold.body")}>
        <ThresholdProof />
      </ClaimProof>

      <ClaimProof id="sharing-title" label={t("sharing.label")} title={t("sharing.title")} body={t("sharing.body")}>
        <MatrixProof />
      </ClaimProof>

      <section aria-labelledby="evidence-title" className="border-t border-line py-12 sm:py-16">
        <p className="label m-0 mb-3">{t("evidence.label")}</p>
        <h2 id="evidence-title" className="m-0 max-w-[34ch] text-xl font-semibold leading-tight">
          {t("evidence.title")}
        </h2>
        <p className="m-0 mt-4 max-w-[56ch] text-fg-2">{t("evidence.body")}</p>
        {active === "en" ? null : <p className="m-0 mt-3 max-w-[56ch] text-sm font-semibold text-fg">{tj("englishNote")}</p>}
        <div className="mt-8 grid border-e border-t border-line bg-surface-raised sm:grid-cols-2 lg:grid-cols-4 [&>*]:border-b [&>*]:border-s [&>*]:border-line">
          {metrics.map((metric, index) => (
            <EvidenceCell
              key={metric.id}
              tag={index === 0 && metric.id === "M6" ? "weakest" : metric.gate ? "gate" : undefined}
              className={evidenceSpan(metrics.length, index, { leadWide: true, wideColumns: 4 })}
              id={metric.id}
              title={metric.title}
              value={metric.value}
              n={metric.n}
              measured={metric.measured}
              doesNotShow={metric.doesNotShow}
              locale={active}
            />
          ))}
        </div>
        <p className="mono ltr m-0 mt-3 text-xs text-fg-3">{t("evidence.source")}</p>
        <p className="m-0 mt-5">
          <Link href="/judge" className="btn btn-secondary">
            {t("evidence.cta")}
          </Link>
        </p>
      </section>

      <ClaimProof id="staff-title" label={t("staff.label")} title={t("staff.title")} body={t("staff.body")}>
        <QueueProof rows={queue} />
      </ClaimProof>
    </>
  );
}
