"use client";

import { useTranslations } from "next-intl";
import type { UseFormRegister } from "react-hook-form";
import type { PatientItem } from "@/lib/api/types";
import { AGREE_1_5, FREE_TEXT_MAX, isRequired, TRUE_FALSE_UNSURE, type ClosureFormValues } from "./closure-items";
import { RadioCard } from "./RadioCard";

interface PatientItemFieldProps {
  item: PatientItem;
  position: number;
  total: number;
  register: UseFormRegister<ClosureFormValues>;
  error: string | undefined;
}

/**
 * One patient item, rendered by its `kind`. Prompts come from the API; the labels around them (true, false, not
 * sure, the scale ends) come from next-intl. Nothing here knows what any item asks about.
 */
export function PatientItemField({ item, position, total, register, error }: PatientItemFieldProps) {
  const t = useTranslations("closure");
  const id = `item-${item.id}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const name = `answers.${item.id}` as const;
  const required = isRequired(item);
  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(" ");

  const eyebrow = (
    <p className="label mb-1">
      {t("item.position", { position, total })}
      {required ? null : <span> · {t("item.optional")}</span>}
    </p>
  );
  const errorNode = error ? (
    <p id={errorId} className="field-error">
      {error}
    </p>
  ) : null;

  if (item.kind === "free_text" || item.kind === "integer_0_100") {
    const isText = item.kind === "free_text";
    return (
      <div>
        {eyebrow}
        <label htmlFor={id} className="field-label text-base">
          {item.prompt}
        </label>
        <p id={hintId} className="field-hint">
          {isText ? t("item.textHint", { max: FREE_TEXT_MAX }) : t("item.integerHint")}
        </p>
        {isText ? (
          <textarea
            id={id}
            className="textarea"
            rows={4}
            maxLength={FREE_TEXT_MAX}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...register(name)}
          />
        ) : (
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            className="input input-ltr max-w-40"
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...register(name)}
          />
        )}
        {errorNode}
      </div>
    );
  }

  const options: { value: string; label: string; suffix?: string }[] =
    item.kind === "true_false_unsure"
      ? TRUE_FALSE_UNSURE.map((value) => ({ value, label: t(`tfu.${value}`) }))
      : item.kind === "agree_1_5"
        ? AGREE_1_5.map((value) => ({
            value,
            label: value,
            ...(value === "1" ? { suffix: t("scale.low") } : value === "5" ? { suffix: t("scale.high") } : {}),
          }))
        : item.choices.map((choice) => ({ value: choice.id, label: choice.text }));

  return (
    <div>
      {eyebrow}
      <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={describedBy}>
        <legend className="field-label mb-2 p-0 text-base">{item.prompt}</legend>
        {item.kind === "agree_1_5" ? (
          <>
            <p id={hintId} className="field-hint">
              {t("item.scaleHint")}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {options.map((option) => (
                <RadioCard
                  key={option.value}
                  layout="stacked"
                  label={<span className="ltr-run">{option.label}</span>}
                  hiddenSuffix={option.suffix}
                  inputProps={{ value: option.value, ...register(name) }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between gap-4 text-sm text-fg-2" aria-hidden="true">
              <span>{t("scale.low")}</span>
              <span>{t("scale.high")}</span>
            </div>
          </>
        ) : (
          <>
            <p id={hintId} className="field-hint">
              {t("item.chooseOne")}
            </p>
            <div className="grid gap-2">
              {options.map((option) => (
                <RadioCard key={option.value} label={option.label} inputProps={{ value: option.value, ...register(name) }} />
              ))}
            </div>
          </>
        )}
        {errorNode}
      </fieldset>
    </div>
  );
}
