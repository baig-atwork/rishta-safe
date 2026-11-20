import { CellGrid, type CellSpec } from "@/components/grid/CellGrid";

const CELLS = 20;

function clampRatio(ratio: number): number {
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
}

/**
 * A part-to-whole ratio as a row of 20 square cells: solid cells are the share, open cells the rest, and the cell at the
 * target is dashed. It reads without colour (fill and dash are the channels) and fills from the reading start, so it is
 * correct in RTL. `label` must carry the values for assistive technology; the surrounding text states them as well.
 */
export function RatioBar({ ratio, target, label }: { ratio: number; target?: number; label: string }) {
  const filled = Math.round(clampRatio(ratio) * CELLS);
  const targetIndex = target === undefined ? -1 : Math.max(0, Math.min(CELLS - 1, Math.round(clampRatio(target) * CELLS) - 1));
  const cells: CellSpec[] = Array.from({ length: CELLS }, (_, index) => ({
    fill: index < filled ? "solid" : "open",
    ...(index === targetIndex ? { dashed: true } : {}),
  }));
  // The cells scale with the room they have (container query units): twenty fixed 18 px cells were wider than a phone.
  return (
    <div className="my-2 [container-type:inline-size]" style={{ "--cell-size": "clamp(5px, calc((100cqw - 57px) / 20), 16px)" } as React.CSSProperties}>
      <CellGrid cells={cells} columns={CELLS} gap={3} label={label} />
    </div>
  );
}

/** A small count bar for table rows; `max` is the largest count in the table so bars share one scale. */
export function CountBar({ count, max }: { count: number; max: number }) {
  const filled = max > 0 ? Math.round((count / max) * 10) : 0;
  const cells: CellSpec[] = Array.from({ length: 10 }, (_, index) => ({ fill: index < filled ? "solid" : "open" }));
  return <CellGrid cells={cells} columns={10} size={10} gap={2} label={String(count)} />;
}
