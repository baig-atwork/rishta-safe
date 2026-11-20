import type { ComponentPropsWithRef, ReactNode } from "react";

const BASE =
  "flex min-h-11 cursor-pointer rounded-md border border-line bg-surface-raised py-2 " +
  "has-[:checked]:border-accent has-[:checked]:bg-accent-soft";
const LAYOUT = {
  row: "items-center gap-3 px-3",
  stacked: "flex-col items-center justify-center gap-1 px-1 text-center",
} as const;

/**
 * One radio choice as a whole-row target (44px or more). The native radio dot shows the selection, so the checked
 * state never depends on colour alone; the tint is only reinforcement.
 */
export function RadioCard({
  label,
  hiddenSuffix,
  inputProps,
  layout = "row",
}: {
  label: ReactNode;
  /** Extra words for screen readers only, e.g. the endpoint a scale point stands for. */
  hiddenSuffix?: string | undefined;
  inputProps: ComponentPropsWithRef<"input">;
  layout?: keyof typeof LAYOUT;
}) {
  return (
    <label className={`${BASE} ${LAYOUT[layout]}`}>
      <input type="radio" className="size-5 shrink-0 accent-accent" {...inputProps} />
      <span>
        {label}
        {hiddenSuffix ? <span className="sr-only"> {hiddenSuffix}</span> : null}
      </span>
    </label>
  );
}
