import type { IconArraySpec } from "@/lib/api/types";
import { buildIconArray, iconColumns, type IconKind } from "@/lib/icon-array";
import { Cell, type CellFill } from "./Cell";
import { CellGrid, type CellSpec } from "./CellGrid";

export interface TallyLegend {
  /** Labels come from messages; the counts come from the API spec. */
  affected: string;
  carrier: string;
  neither: string;
}

export interface TallyGridProps {
  /** The engine's part-to-whole numbers (document.blocks[kind=icon_array]). */
  spec: IconArraySpec;
  /** id of the element holding the API caption sentence; the grid is labelled by it. */
  captionId: string;
  legend: TallyLegend;
  /** Cell edge in px (default 15 for the 100 tally). */
  size?: number;
  /** Shown instead of the grid if the numbers do not add up to the total. The array is never repaired silently. */
  invalidLabel?: string;
}

const FILL: Record<IconKind, CellFill> = { affected: "solid", carrier: "hatch", neither: "open" };

/**
 * The result tally (replaces result/IconArray): 100 square cells, solid = would have the condition, hatch = carrier,
 * open = neither. Static (nothing counts up or pulses). Pattern carries the meaning, so it reads without colour. If the
 * engine numbers do not add up the grid is not drawn at all.
 */
export function TallyGrid({ spec, captionId, legend, size = 15, invalidLabel }: TallyGridProps) {
  const arr = buildIconArray(spec);
  if (!arr.valid) {
    return (
      <p role="alert" className="field-error">
        {invalidLabel ?? ""}
      </p>
    );
  }
  const cells: CellSpec[] = arr.icons.map((kind) => ({ fill: FILL[kind] }));
  const kinds: IconKind[] = ["affected", "carrier", "neither"];
  return (
    <div className="grid content-start gap-4">
      <CellGrid cells={cells} columns={iconColumns(arr.total)} size={size} labelledBy={captionId} testId="tally-grid" />
      <ul className="legend">
        {kinds.map((kind) => (
          <li key={kind}>
            <Cell fill={FILL[kind]} />
            <b>{arr.counts[kind]}</b>
            <span>{legend[kind]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
