import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { resetDemoAction } from "@/app/[locale]/demo/actions";
import { CaseBench } from "@/components/demo/CaseBench";
import { EmptyState, ErrorState, PageHeader, PartialNotice } from "@/components/ui/states";
import { loadBench } from "@/lib/public-bench-server";
import { readSession } from "@/lib/session";

export default async function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { locale } = await params;
  const { reset } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("demo");
  const active = await getLocale();
  const [{ cases, casesError, personas }, session] = await Promise.all([loadBench(), readSession()]);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("intro")} />
      {reset === "done" ? <PartialNotice>{t("resetDone")}</PartialNotice> : null}
      {reset === "failed" ? (
        <p role="alert" className="field-error mb-4">
          {t("resetFailed")}
        </p>
      ) : null}
      {casesError ? <ErrorState problem={casesError.problem} /> : null}
      {cases && cases.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} actionHref="/how-it-works" actionLabel={t("empty.cta")} />
      ) : null}
      {cases && cases.length > 0 ? (
        <>
          <CaseBench cases={cases} personas={personas ?? []} personasFailed={personas === null} />
          <div className="mt-10 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line pt-5">
            <p className="m-0 me-auto max-w-[56ch] text-sm text-fg-2">{session?.role === "judge" ? t("resetHint") : t("resetNeedsJudge")}</p>
            {session?.role === "judge" ? (
              <form action={resetDemoAction.bind(null, active)} className="m-0">
                <button type="submit" className="btn btn-secondary" data-testid="reset-demo">
                  {t("reset")}
                </button>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
