import type { CSSProperties } from "react";
import { Cell, type CellFill, type CellTone } from "./Cell";

export interface CellSpec {
  fill: CellFill;
  dashed?: boolean;
  tone?: CellTone;
}

export interface CellGridProps {
  /** Cells in reading order. They fill from the reading start, so the grid is correct in RTL without mirroring. */
  cells: readonly CellSpec[];
  /** Number of columns; rows follow from the cell count. */
  columns: number;
  /** Edge length of one cell in px (default: the --cell-size token). */
  size?: number;
  /** Gap between cells in px (default: the --cell-gap token). */
  gap?: number;
  /** id of the element that describes the grid (preferred: the API caption). */
  labelledBy?: string;
  /** Text alternative when there is no describing element. One of labelledBy or label is required. */
  label?: string;
  testId?: string;
}

/**
 * A generic N by M grid of cells (the static, non-interactive form: role="img" with a text alternative, because the
 * cells carry no information a person needs individually). An interactive grid (a switch matrix, a case bench) must be a
 * real <table> built by its owner; do not put controls in here.
 */
export function CellGrid({ cells, columns, size, gap, labelledBy, label, testId }: CellGridProps) {
  const style = {
    "--tally-cols": columns,
    ...(size === undefined ? {} : { "--cell-size": `${size}px` }),
    ...(gap === undefined ? {} : { "--cell-gap": `${gap}px` }),
  } as CSSProperties;
  const aria = labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label };
  return (
    <div className="tally" role="img" style={style} data-testid={testId} {...aria}>
      {cells.map((cell, index) => (
        <Cell key={index} fill={cell.fill} dashed={cell.dashed} tone={cell.tone} />
      ))}
    </div>
  );
}
