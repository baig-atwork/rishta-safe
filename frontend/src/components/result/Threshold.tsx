"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Cell, type CellProps } from "@/components/grid/Cell";
import type { ThresholdChoice } from "@/lib/couple-threshold";
import { RntkConfirm } from "./RntkConfirm";
import { useRntk } from "./use-rntk";

export interface ThresholdProps {
  coupleId: string;
  /** "now", "counsellor" or "notyet": the parent stores it and shows the matching view. */
  onChoose: (choice: Exclude<ThresholdChoice, "rntk">) => void;
  /** The right not to know was recorded on the server. */
  onDeclared: () => void;
}

const OPTIONS: { choice: ThresholdChoice; glyph: CellProps; key: "now" | "counsellor" | "notYet" | "rntk" }[] = [
  { choice: "now", glyph: { fill: "solid" }, key: "now" },
  { choice: "counsellor", glyph: { fill: "hatch" }, key: "counsellor" },
  { choice: "notyet", glyph: { fill: "open", dashed: true }, key: "notYet" },
  { choice: "rntk", glyph: { fill: "open" }, key: "rntk" },
];

/**
 * The threshold (02-ux-concept 4.1): four ways to meet the result, a radio group (arrows move between options) and one
 * Continue button. Nothing is preselected: how to meet a result is the person's to choose, not a default we set.
 * The result itself is not in this tree, and not in the page: the parent renders it only after a choice.
 */
export function Threshold({ coupleId, onChoose, onDeclared }: ThresholdProps) {
  const t = useTranslations("result.threshold");
  const [picked, setPicked] = useState<ThresholdChoice | null>(null);
  const [needPick, setNeedPick] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const group = useId();
  const rntk = useRntk(coupleId, (active) => {
    if (active) onDeclared();
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (picked === null) {
      setNeedPick(true);
      return;
    }
    if (picked === "rntk") {
      rntk.reset();
      setConfirming(true);
      return;
    }
    onChoose(picked);
  }

  return (
    <div className="mx-auto grid max-w-[44rem] gap-6 py-6" data-testid="threshold">
      <header>
        <p className="label mb-3">{t("eyebrow")}</p>
        <h1 className="m-0">{t("title")}</h1>
        <p className="measure mt-4 text-fg-2">{t("body")}</p>
      </header>
      <form noValidate onSubmit={submit} className="grid gap-5">
        <fieldset className="m-0 min-w-0 border border-line-strong p-0">
          <legend className="sr-only">{t("legend")}</legend>
          {OPTIONS.map(({ choice, glyph, key }) => {
            const id = `${group}-${choice}`;
            return (
              <label
                key={choice}
                htmlFor={id}
                className="flex cursor-pointer items-start gap-4 border-b border-line px-4 py-4 last:border-b-0 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  id={id}
                  type="radio"
                  name={group}
                  value={choice}
                  checked={picked === choice}
                  onChange={() => {
                    setPicked(choice);
                    setNeedPick(false);
                  }}
                  className="mt-1 size-5 shrink-0 accent-accent"
                  aria-describedby={`${id}-hint`}
                />
                <span className="mt-1 shrink-0">
                  <Cell {...glyph} size={16} />
                </span>
                <span className="grid gap-1">
                  <span className="font-semibold">{t(key)}</span>
                  <span id={`${id}-hint`} className="text-fg-2">
                    {t(`${key}Hint`)}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        {needPick ? (
          <p role="alert" className="field-error m-0">
            {t("pick")}
          </p>
        ) : null}
        <div>
          <button type="submit" className="btn btn-primary">
            {t("continue")}
          </button>
        </div>
      </form>
      <p className="measure m-0 text-sm text-fg-2">{t("law")}</p>
      <RntkConfirm open={confirming} pending={rntk.pending} error={rntk.error} onConfirm={() => rntk.declare()} onClose={() => setConfirming(false)} />
    </div>
  );
}
