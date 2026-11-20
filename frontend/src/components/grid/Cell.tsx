import type { CSSProperties } from "react";

export type CellFill = "solid" | "hatch" | "open";
export type CellTone = "ink" | "accent" | "shared" | "none" | "info";

export interface CellProps {
  /** solid, diagonal hatch or open. The hatch is the second channel that colour never carries alone. */
  fill: CellFill;
  /** Dashed edge: "pending" or "not yet". */
  dashed?: boolean | undefined;
  /** Colour tone. Omitted: the cell takes the surrounding text colour (so it works on dark surfaces). */
  tone?: CellTone | undefined;
  /** Edge length in px. Default is the --cell-size token (14). */
  size?: number | undefined;
  /** Screen-reader text. Without it the cell is decorative (aria-hidden). */
  label?: string | undefined;
}

/**
 * One square cell of the tally grid: the signature element. Always square, never rounded. Styling lives in
 * globals.css (`.cell`), driven by data attributes, so the hatch (the only gradient in the app) exists in one place.
 */
export function Cell({ fill, dashed = false, tone, size, label }: CellProps) {
  const style: CSSProperties | undefined =
    size === undefined
      ? undefined
      : ({
          "--cell-size": `${size}px`,
          ...(size <= 10 ? { "--hatch-line": "1px", "--hatch-gap": "3px" } : {}),
        } as CSSProperties);
  return (
    <span
      className="cell"
      data-fill={fill}
      data-dashed={dashed ? "true" : undefined}
      data-tone={tone}
      style={style}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
