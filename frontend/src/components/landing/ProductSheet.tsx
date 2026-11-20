import { useTranslations } from "next-intl";
import { TallyGrid } from "@/components/grid/TallyGrid";
import { CategoryChip } from "@/components/result/CategoryChip";
import type { Locale } from "@/lib/api/types";
import type { LandingSheet } from "@/lib/public-landing";

/** Each language's own name, in its own script: a label, not a translation. */
const LANGUAGE_NAME: Record<Locale, string> = { en: "English", ar: "العربية", ur: "اردو" };

/**
 * The landing's product object: a synthetic couple's result in two languages side by side, with the tally. A server
 * component fed by a recorded API response; it ships no client JavaScript. Every sentence comes from the API.
 */
export function ProductSheet({ sheet }: { sheet: LandingSheet }) {
  const t = useTranslations("landing.sheet");
  const [first, second] = sheet.columns;
  if (!first || !second) return null;
  const captionId = "sheet-tally-caption";
  const relationship = sheet.relationship ? t(`relationship.${sheet.relationship}` as "relationship.first_cousin") : "";
  const policy = sheet.policy ? t(`policy.${sheet.policy}` as "policy.abu_dhabi") : "";

  return (
    <figure aria-label={t("aria")} className="m-0 overflow-hidden rounded-lg bg-surface-raised text-fg">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-5 py-3">
        <CategoryChip category={sheet.category} />
        <span className="mono ltr text-xs text-fg-3">{t("case", { id: sheet.coupleId, relationship, policy })}</span>
        {/* One line of stamps for the whole card (the shell's rail already says synthetic and draft). */}
        <span className="stamp">{t("stamps")}</span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid sm:grid-cols-2">
          {sheet.columns.map((column, index) => (
            <div
              key={column.locale}
              lang={column.locale}
              dir={column.dir}
              className={`grid content-start gap-3 p-5 sm:p-6 ${index === 0 ? "" : "border-t border-line sm:border-s sm:border-t-0"}`}
            >
              <p className="label m-0">{LANGUAGE_NAME[column.locale]}</p>
              <h2 className="m-0 text-xl font-semibold leading-snug">{column.heading}</h2>
              <p id={index === 0 ? captionId : undefined} className="read m-0 text-fg-2">
                {column.caption}
              </p>
            </div>
          ))}
        </div>
        <div className="grid content-center border-t border-line p-5 sm:p-6 lg:border-s lg:border-t-0">
          <TallyGrid
            spec={sheet.tally}
            captionId={captionId}
            size={13}
            legend={{ affected: t("legendAffected"), carrier: t("legendCarrier"), neither: t("legendNeither") }}
          />
        </div>
      </div>
      <figcaption className="mono ltr border-t border-line bg-surface-sunken px-5 py-2.5 text-xs text-fg-3" dir="ltr">
        {t("foot", { endpoints: sheet.endpoints })}
      </figcaption>
    </figure>
  );
}
