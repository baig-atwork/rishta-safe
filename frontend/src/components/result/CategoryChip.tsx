import { useTranslations } from "next-intl";
import type { ResultCategory } from "@/lib/api/types";
import { Cell, type CellProps } from "@/components/grid/Cell";

export interface CategoryChipProps {
  category: ResultCategory;
  /** Overrides the label. Default: the closed-vocabulary label `result.category.<category>` from the message catalogue. */
  label?: string;
  size?: "sm" | "md";
}

/** Two cells = two partners. shared: a hatched pair; none: an open pair; more information: one open, one dashed. */
const GLYPH: Record<ResultCategory, [CellProps, CellProps]> = {
  shared_result_found: [
    { fill: "hatch", tone: "shared" },
    { fill: "hatch", tone: "shared" },
  ],
  no_shared_change_found: [
    { fill: "open", tone: "none" },
    { fill: "open", tone: "none" },
  ],
  more_information_needed: [
    { fill: "open", tone: "info" },
    { fill: "open", tone: "info", dashed: true },
  ],
};

/**
 * The result category as glyph plus label. The three categories are information states, not a scale: equal weight,
 * never red or green, and the glyph (not the colour) is the second channel. Withheld results (right not to know,
 * counselling first, awaiting partner) are not a category, so they have no chip: the API's withheld document is shown.
 */
export function CategoryChip({ category, label, size = "md" }: CategoryChipProps) {
  const t = useTranslations("result.category");
  const [a, b] = GLYPH[category];
  return (
    <span className="chip" data-cat={category} data-size={size}>
      <span className="glyph" aria-hidden="true">
        <Cell {...a} />
        <Cell {...b} />
      </span>
      <span>{label ?? t(category)}</span>
    </span>
  );
}
