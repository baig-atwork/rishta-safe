import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ReferenceCells } from "@/components/governance/ReferenceCells";
import { Cell, type CellFill } from "@/components/grid/Cell";
import { PageHeader } from "@/components/ui/states";
import type { Locale } from "@/lib/api/types";

/** The five moves, each drawn with a cell state that echoes its meaning. */
const MOVES: readonly { key: "threshold" | "together" | "sharing" | "instrument" | "evidence"; fill: CellFill; dashed: boolean }[] = [
  { key: "threshold", fill: "open", dashed: true },
  { key: "together", fill: "solid", dashed: false },
  { key: "sharing", fill: "hatch", dashed: false },
  { key: "instrument", fill: "hatch", dashed: false },
  { key: "evidence", fill: "solid", dashed: false },
];

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("how");
  const active = (await getLocale()) as Locale;

  return (
    <div lang={active}>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />
      <div className="grid gap-12">
        <section aria-labelledby="moves-title">
          <h2 id="moves-title" className="m-0 mb-4 text-xl">
            {t("movesTitle")}
          </h2>
          <ol className="m-0 grid list-none gap-0 border-b border-line p-0">
            {MOVES.map((move, index) => (
              <li key={move.key} className="grid gap-x-6 gap-y-1 border-t border-line py-4 md:grid-cols-[4rem_minmax(0,1fr)]">
                <span className="flex items-center gap-2">
                  <Cell fill={move.fill} dashed={move.dashed} size={16} />
                  <span className="mono ltr text-xs text-fg-3">{String(index + 1).padStart(2, "0")}</span>
                </span>
                <div>
                  <h3 className="m-0 text-base font-semibold">{t(`moves.${move.key}.title`)}</h3>
                  <p className="m-0 mt-1 max-w-[56ch] text-fg-2">{t(`moves.${move.key}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="pathway-title">
          <h2 id="pathway-title" className="m-0 mb-1 text-xl">
            {t("pathwayTitle")}
          </h2>
          <p className="m-0 mb-5 max-w-[66ch] text-sm text-fg-2">{t("pathwayNote")}</p>
          <ReferenceCells />
        </section>

        <section aria-labelledby="notes-title" className="grid gap-6 border-t border-line pt-8 md:grid-cols-3">
          <h2 id="notes-title" className="sr-only">
            {t("notesLabel")}
          </h2>
          <div>
            <h3 className="m-0 mb-2 text-base font-semibold">{t("branchTitle")}</h3>
            <p className="m-0 text-sm text-fg-2">{t("branchBody")}</p>
          </div>
          <div>
            <h3 className="m-0 mb-2 text-base font-semibold">{t("simTitle")}</h3>
            <p className="m-0 text-sm text-fg-2">{t("simBody")}</p>
          </div>
          <div>
            <h3 className="m-0 mb-2 text-base font-semibold">{t("sourceTitle")}</h3>
            <p className="m-0 text-sm text-fg-2">{t("sourceBody")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
