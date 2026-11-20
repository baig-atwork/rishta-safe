import { useTranslations } from "next-intl";
import { Cell, type CellProps } from "@/components/grid/Cell";
import type { PathwayStatus } from "@/lib/api/types";

export interface TrackerItem {
  key: string;
  title: string;
  /** Plain-language expected time, already formatted for the locale. */
  timeText: string | null;
  status: PathwayStatus;
  statusLabel: string | null;
  slaLabel: string | null;
  slaTone: "ok" | "attention" | "info" | null;
  detail: string | null;
  when: string | null;
}

/** done = solid, you are here = open with a lapis ring, coming up = open, waiting or past the time = dashed. */
const GLYPH: Record<PathwayStatus, CellProps> = {
  done: { fill: "solid" },
  current: { fill: "open", tone: "accent" },
  upcoming: { fill: "open" },
  blocked: { fill: "open", dashed: true, tone: "info" },
};

/**
 * The pathway as a row of square cells, one per step (02-ux-concept 4.7): the cell says where the step stands, the label
 * under it names the step, its status and its expected time in mono. The time limit state (on time, taking longer) is
 * text plus a glyph, never colour alone. Under 760 px the row becomes a vertical list, still made of cells. A server
 * component: no client JS.
 */
export function PathwayCells({ items, label }: { items: TrackerItem[]; label: string }) {
  const t = useTranslations("home");
  return (
    <ol aria-label={label} className="m-0 grid list-none gap-0 p-0 max-[759px]:gap-4 min-[760px]:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] min-[760px]:gap-y-6" data-testid="pathway-cells">
      {items.map((item) => (
        <li
          key={item.key}
          aria-current={item.status === "current" ? "step" : undefined}
          data-status={item.status}
          className="grid min-w-[7.5rem] content-start gap-2 border-line pe-3 max-[759px]:grid-cols-[auto_1fr] max-[759px]:gap-x-4 min-[760px]:border-t min-[760px]:pt-3"
        >
          <span className={`inline-flex size-9 items-center justify-center ${item.status === "current" ? "ring-2 ring-accent" : ""}`}>
            <Cell {...GLYPH[item.status]} size={20} />
          </span>
          <span className="grid content-start gap-1">
            <span className={`text-sm font-semibold ${item.status === "upcoming" ? "text-fg-2" : "text-fg"}`}>{item.title}</span>
            <span className="label">{item.status === "done" ? t("cellDone") : item.status === "current" ? t("cellCurrent") : item.status === "blocked" ? t("cellBlocked") : t("cellUpcoming")}</span>
            {item.timeText ? <span className="font-mono text-xs text-fg-3">{item.timeText}</span> : null}
            {item.when ? <span className="font-mono text-xs text-fg-3">{item.when}</span> : null}
            {item.slaLabel ? (
              <span className={`tag ${item.slaTone === "attention" ? "tag-attention" : item.slaTone === "ok" ? "tag-ok" : "tag-info"}`}>
                <Cell fill={item.slaTone === "attention" ? "open" : "solid"} dashed={item.slaTone === "attention"} size={8} />
                {item.slaLabel}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
