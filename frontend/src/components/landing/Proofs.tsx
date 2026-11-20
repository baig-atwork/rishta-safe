import { useTranslations } from "next-intl";
import { Cell, type CellFill } from "@/components/grid/Cell";
import "@/components/evidence/restack.css";
import { WrapId } from "@/components/evidence/WrapId";
import type { LandingQueueRow } from "@/lib/public-landing";

/** Shared look of a section's "proof" block: it is real UI, not an illustration. */
const OPTION_CELLS: readonly { key: "now" | "counsellor" | "notYet" | "rntk"; fill: CellFill; dashed: boolean }[] = [
  { key: "now", fill: "solid", dashed: false },
  { key: "counsellor", fill: "hatch", dashed: false },
  { key: "notYet", fill: "open", dashed: true },
  { key: "rntk", fill: "open", dashed: false },
];

/** The four ways to meet a result, drawn with the four cell states. A static copy of what /couple/result asks. */
export function ThresholdProof() {
  const t = useTranslations("landing.threshold");
  return (
    <div>
      <ol className="m-0 grid list-none gap-0 border border-line bg-surface-raised p-0 sm:grid-cols-2 xl:grid-cols-4">
        {OPTION_CELLS.map((option, index) => (
          <li
            key={option.key}
            className={`grid content-start gap-2 border-line p-4 ${index === 0 ? "border-t-2 border-t-accent" : ""} ${index > 0 ? "border-t sm:border-t-0 sm:border-s" : ""} ${index === 2 ? "sm:border-t xl:border-t-0" : ""} ${index === 3 ? "sm:border-t xl:border-t-0" : ""}`}
          >
            <Cell fill={option.fill} dashed={option.dashed} size={16} />
            <b className="text-sm leading-snug">{t(`${option.key}.title`)}</b>
            <span className="text-sm text-fg-2">{t(`${option.key}.body`)}</span>
          </li>
        ))}
      </ol>
      <p className="mono m-0 mt-4 max-w-[66ch] text-xs leading-relaxed text-fg-3">
        {t("law")} <span className="ltr-run">{t("endpoint")}</span>
      </p>
    </div>
  );
}

type Sees = "sees" | "care" | "law" | "never" | "consent";
const MATRIX: readonly { row: "result" | "genes" | "detail"; cells: readonly Sees[] }[] = [
  { row: "result", cells: ["sees", "care", "law", "never", "never"] },
  { row: "genes", cells: ["consent", "care", "law", "never", "never"] },
  { row: "detail", cells: ["consent", "care", "law", "never", "never"] },
];
const SEES_CELL: Record<Sees, { fill: CellFill; dashed: boolean }> = {
  sees: { fill: "solid", dashed: false },
  care: { fill: "solid", dashed: false },
  law: { fill: "hatch", dashed: false },
  never: { fill: "open", dashed: false },
  consent: { fill: "open", dashed: true },
};
const COLUMNS = ["partner", "care", "db", "employer", "insurer"] as const;

/** Who sees what, as the real matrix reads on /couple/sharing: a table of cells, each with its words. */
export function MatrixProof() {
  const t = useTranslations("landing.sharing");
  return (
    <div>
      <table className="restack w-full border-collapse border border-line bg-surface-raised text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-line bg-surface-sunken p-3 text-start">
              <span className="sr-only">{t("info")}</span>
            </th>
            {COLUMNS.map((col) => (
              <th key={col} scope="col" className="border-b border-s border-line bg-surface-sunken p-3 text-start font-semibold">
                {t(`col.${col}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX.map((line) => (
            <tr key={line.row}>
              <th scope="row" className="border-b border-line p-3 text-start font-semibold last:border-b-0">
                {t(`row.${line.row}`)}
              </th>
              {line.cells.map((kind, index) => {
                const cell = SEES_CELL[kind];
                const column = COLUMNS[index];
                return (
                  <td key={column} data-label={column ? t(`col.${column}`) : undefined} className="border-b border-s border-line p-3 align-top">
                    <span className="grid gap-1.5">
                      <Cell fill={cell.fill} dashed={cell.dashed} />
                      <span className={kind === "consent" ? "text-link font-semibold" : "text-fg-2"}>{t(`cell.${kind}`)}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mono m-0 mt-4 max-w-[66ch] text-xs leading-relaxed text-fg-3">{t("fine")}</p>
    </div>
  );
}

const PRIORITY_OF = { immediate: "urgent", same_session: "urgent", fast_track: "priority", routine: "routine" } as const;
const GLYPH = { urgent: "▲", priority: "■", routine: "□" } as const;

function words(key: string): string {
  return key.replace(/_/g, " ");
}

/** A slice of the recorded review queue: written rule, tier and due hint per couple. Nothing is generated. */
export function QueueProof({ rows }: { rows: readonly LandingQueueRow[] }) {
  const t = useTranslations("landing.staff");
  const known = (group: "tier" | "due", key: string): string => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : words(key));
  return (
    <table className="tbl restack">
      <caption className="sr-only">{t("caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("col.case")}</th>
          <th scope="col">{t("col.priority")}</th>
          <th scope="col">{t("col.rule")}</th>
          <th scope="col">{t("col.tier")}</th>
          <th scope="col">{t("col.due")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const priority = PRIORITY_OF[row.due];
          return (
            <tr key={row.coupleId}>
              <th scope="row" className="mono ltr whitespace-nowrap font-normal normal-case tracking-normal text-fg">
                {row.coupleId}
              </th>
              <td data-label={t("col.priority")} className={`mono ${priority === "urgent" ? "text-attention-fg" : ""}`}>
                <span aria-hidden="true">{GLYPH[priority]} </span>
                {t(`priority.${priority}`)}
              </td>
              <td data-label={t("col.rule")} className="mono ltr">
                <WrapId id={row.ruleId} />
              </td>
              <td data-label={t("col.tier")}>{known("tier", row.tier)}</td>
              <td data-label={t("col.due")}>{known("due", row.due)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
