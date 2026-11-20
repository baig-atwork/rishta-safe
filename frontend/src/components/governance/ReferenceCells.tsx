import { useTranslations } from "next-intl";
import { Cell } from "@/components/grid/Cell";
import { PATHWAY_REFERENCE } from "@/lib/pathway-reference";

/**
 * The published nine-state pathway as cells: one open cell per state, then a ruled list with the standard's own time and
 * detail. It is a reference (nothing is done or current here), so every cell is open; the strip is decorative, the list is
 * the content. Times are parameters from the published standards, not promises.
 */
export function ReferenceCells() {
  const t = useTranslations("how");
  const tp = useTranslations("pathway");
  return (
    <div className="grid gap-6">
      {/* The nine states as a labelled rail: a visual summary of the list below (hidden from assistive technology, which reads the list). */}
      <ol aria-hidden="true" className="m-0 grid list-none grid-cols-3 gap-x-3 gap-y-5 p-0 sm:grid-cols-5 lg:grid-cols-9">
        {PATHWAY_REFERENCE.map((state, index) => (
          <li key={state.key} className="grid content-start gap-1.5 border-t-2 border-line-strong pt-2">
            <span className="flex items-center gap-2">
              <Cell fill="open" size={16} />
              <span className="mono ltr text-xs text-fg-3">{String(index + 1).padStart(2, "0")}</span>
            </span>
            <span className="text-xs font-semibold leading-snug">{tp(`state.${state.key}`)}</span>
          </li>
        ))}
      </ol>
      <ol className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {PATHWAY_REFERENCE.map((state, index) => (
          <li key={state.key} className="grid content-start gap-1.5 border-t border-line py-4 sm:pe-6">
            <h3 className="m-0 text-base font-semibold">
              <span className="mono ltr me-2 text-xs font-normal text-fg-3">{String(index + 1).padStart(2, "0")}</span>
              {tp(`state.${state.key}`)}
            </h3>
            <p className="mono m-0 text-xs text-fg-2">{t(`time.${state.key}`)}</p>
            <p className="m-0 text-sm text-fg-2">{t(`detail.${state.key}`)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
