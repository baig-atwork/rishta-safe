"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, ExternalLink, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Resolver, type UseFormRegister } from "react-hook-form";
import "@/components/staff/instrument.css";
import { Cell, type CellFill } from "@/components/grid/Cell";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { CbcInput, HaemInterpretation, HaemSource, HplcInput } from "@/lib/api/types";
import {
  CBC_FIELDS,
  CHOICE_OPTIONS,
  EMPTY_VALUES,
  buildHaemSchemas,
  fieldFromServerPath,
  snapshotOf,
  stepOfField,
  toCbcInput,
  toHplcInput,
  type ChoiceFieldName,
  type HaemFieldName,
  type HaemFormValues,
  type HaemScope,
  type HaemStep,
} from "./schema";

interface Submission {
  cbc: CbcInput;
  hplc: HplcInput | null;
  scope: HaemScope;
  snapshot: string;
}

const STEPS: readonly HaemStep[] = ["cbc", "hplc"];

type NumericFieldName = Exclude<HaemFieldName, "sex" | "variant_hb_name" | ChoiceFieldName>;

function NumberField({
  name,
  optional = false,
  register,
  error,
}: {
  name: NumericFieldName;
  optional?: boolean;
  register: UseFormRegister<HaemFormValues>;
  error: string | undefined;
}) {
  const t = useTranslations("haem");
  const inputId = `haem-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const hasHint = t.has(`fields.${name}.hint`);
  const describedBy = [hasHint ? hintId : null, error ? errorId : null].filter((part) => part !== null).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        {t(`fields.${name}.label`)}
        {optional ? <span className="ms-1 font-normal text-fg-3">({t("optional")})</span> : null}
      </label>
      {hasHint ? (
        <p id={hintId} className="field-hint mb-1 mt-0">
          {t(`fields.${name}.hint`)}
        </p>
      ) : null}
      {/* A lab value reads number then unit, left to right, in every locale. */}
      <div dir="ltr" className="flex">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className="input input-ltr min-w-0 rounded-e-none"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...register(name)}
        />
        <span className="flex min-w-16 shrink-0 items-center justify-center whitespace-nowrap rounded-e-md border border-s-0 border-line-strong bg-surface-sunken px-3 text-sm text-fg-2">
          <bdi>{t(`fields.${name}.unit`)}</bdi>
        </span>
      </div>
      {error ? (
        <p id={errorId} className="field-error">
          <bdi>{error}</bdi>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A closed question: a select whose first option is "Not answered". Leaving it there sends nothing for the question,
 * so the backend reads it as unknown; the form never picks an answer on the clinician's behalf.
 */
function ChoiceField({
  name,
  register,
  error,
}: {
  name: ChoiceFieldName;
  register: UseFormRegister<HaemFormValues>;
  error: string | undefined;
}) {
  const t = useTranslations("haem");
  const inputId = `haem-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const hasHint = t.has(`fields.${name}.hint`);
  const describedBy = [hasHint ? hintId : null, error ? errorId : null].filter((part) => part !== null).join(" ") || undefined;
  const options: readonly string[] = CHOICE_OPTIONS[name];
  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        {t(`fields.${name}.label`)}
      </label>
      {hasHint ? (
        <p id={hintId} className="field-hint mb-1 mt-0">
          {t(`fields.${name}.hint`)}
        </p>
      ) : null}
      <select id={inputId} className="select" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...register(name)}>
        <option value="">{t("choices.unanswered")}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {t.has(`fields.${name}.${option}`) ? t(`fields.${name}.${option}`) : t(`choices.${option}`)}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="field-error">
          <bdi>{error}</bdi>
        </p>
      ) : null}
    </div>
  );
}

function SkeletonLine({ className }: { className: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** The empty reading area: three cells (CBC, HPLC, reading), the last still to come. Decorative; the words carry it. */
const ONBOARDING_CELLS: { fill: CellFill; dashed?: boolean }[] = [{ fill: "solid" }, { fill: "hatch" }, { fill: "open", dashed: true }];

/** Onboarding copy for the empty result area: what to enter, in which order, and what a CBC alone can never give. */
function ResultOnboarding() {
  const t = useTranslations("haem.result.empty");
  return (
    <div className="flex min-h-72 flex-col items-start gap-4">
      <div className="tally" style={{ "--tally-cols": 3, "--cell-size": "18px" } as React.CSSProperties} aria-hidden="true">
        {ONBOARDING_CELLS.map((cell, index) => (
          <Cell key={index} fill={cell.fill} dashed={cell.dashed} />
        ))}
      </div>
      <div className="max-w-xl">
        <h3 className="m-0 text-lg">{t("title")}</h3>
        <p className="measure mt-2 text-fg-2">{t("body")}</p>
      </div>
    </div>
  );
}

function SourceRef({ source }: { source: HaemSource }) {
  const t = useTranslations("haem.result");
  return (
    <span>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer noopener">
          <bdi>{source.title}</bdi>
          <ExternalLink aria-hidden="true" className="ms-1 inline size-3.5 align-baseline rtl:-scale-x-100" />
          <span className="sr-only"> ({t("opensNewTab")})</span>
        </a>
      ) : (
        <bdi>{source.title}</bdi>
      )}
      {source.year !== null ? (
        <>
          {" "}
          (<bdi>{source.year}</bdi>)
        </>
      ) : null}
      {source.illustrative ? <span className="tag ms-2">{t("illustrative")}</span> : null}
    </span>
  );
}

function ReadingResult({ data, scope, stale }: { data: HaemInterpretation; scope: HaemScope; stale: boolean }) {
  const t = useTranslations("haem");
  const labelText = data.label_text !== null && data.label_text.trim() !== "" ? data.label_text : t(`label.${data.label}`);
  return (
    <article aria-labelledby="haem-label-title" className="grid content-start gap-6">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="stamp">{t("result.signoff")}</span>
          <span className="tag font-normal">{t(scope === "cbc" ? "result.basedOn.cbc" : "result.basedOn.both")}</span>
        </div>
        <h3 id="haem-label-title" className="m-0 text-xl">
          {labelText}
        </h3>
        <p className="m-0 text-sm text-fg-3">
          {t("result.labelKey")}: <code className="ltr-run font-mono">{data.label}</code>
        </p>
        <p className="m-0 text-lg font-semibold">{t("result.statement")}</p>
      </header>

      {stale ? (
        <p role="status" className="tag tag-info px-3 py-1 text-sm font-normal">
          {t("result.stale")}
        </p>
      ) : null}

      {data.needs_clinician_signoff ? (
        <section aria-labelledby="haem-callout-title" className="panel-sunken border-s-4 border-line-strong">
          <h4 id="haem-callout-title" className="m-0 flex items-center gap-2 font-sans text-base font-semibold">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            {t("result.callout.title")}
          </h4>
          <p className="m-0 mt-2 text-fg-2">{t("result.callout.body")}</p>
        </section>
      ) : null}

      <section aria-labelledby="haem-trace-title" className="grid gap-3">
        <h4 id="haem-trace-title" className="m-0 font-sans text-base font-semibold">
          {t("result.traceTitle")}
        </h4>
        {data.rule_trace.length === 0 ? (
          <p className="m-0 text-fg-2">{t("result.traceNone")}</p>
        ) : (
          <table className="haem-trace">
            <caption className="sr-only">{t("result.traceTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("result.trace.rule")}</th>
                <th scope="col">{t("result.trace.finding")}</th>
                <th scope="col">{t("result.trace.source")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rule_trace.map((step, index) => (
                <tr key={`${step.rule_id}-${index}`}>
                  <th scope="row">
                    <code className="ltr-run font-mono">{step.rule_id}</code>
                  </th>
                  <td dir="auto">{step.description}</td>
                  <td>{step.source ? <SourceRef source={step.source} /> : t("result.noSource")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="haem-flags-title" className="grid gap-3">
        <h4 id="haem-flags-title" className="m-0 font-sans text-base font-semibold">
          {t("result.flagsTitle")}
        </h4>
        {data.flags.length === 0 ? (
          <p className="m-0 text-fg-2">{t("result.flagsNone")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {data.flags.map((flag, index) => (
              <li key={`${flag}-${index}`} className="tag font-normal">
                <bdi>{flag}</bdi>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="haem-sources-title" className="grid gap-3">
        <h4 id="haem-sources-title" className="m-0 font-sans text-base font-semibold">
          {t("result.sourcesTitle")}
        </h4>
        {data.sources.length === 0 ? (
          <p className="m-0 text-fg-2">{t("result.sourcesNone")}</p>
        ) : (
          <ul className="m-0 grid list-disc gap-2 ps-6 text-sm text-fg-2">
            {data.sources.map((source, index) => (
              <li key={`${source.title}-${index}`}>
                <SourceRef source={source} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const t = useTranslations("haem");
  const { problem } = error;
  const unmatched = (problem.errors ?? []).filter((item) => fieldFromServerPath(item.field) === null);
  const hasFieldErrors = (problem.errors ?? []).length > unmatched.length;
  return (
    <section role="alert" className="panel panel-attention grid content-start gap-3">
      <h3 className="m-0 text-xl">{t("error.title")}</h3>
      <p className="measure m-0 text-fg-2">{t("error.body")}</p>
      <p dir="auto" className="m-0 font-semibold">
        <bdi>{problem.detail ?? problem.title}</bdi> (<span className="ltr-run">{problem.status}</span>)
      </p>
      {hasFieldErrors ? <p className="m-0 text-fg-2">{t("error.fieldsHint")}</p> : null}
      {unmatched.length > 0 ? (
        <div>
          <p className="m-0 text-sm font-semibold">{t("error.other")}</p>
          <ul className="m-0 mt-1 grid list-disc gap-1 ps-6 text-sm text-fg-2">
            {unmatched.map((item, index) => (
              <li key={`${item.field}-${index}`}>
                <bdi>{item.message}</bdi>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error.correlationId ? (
        <p className="m-0 text-sm text-fg-3">
          {t("error.correlation")}: <code className="ltr-run font-mono">{error.correlationId}</code>
        </p>
      ) : null}
      <div>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          {t("actions.retry")}
        </button>
      </div>
    </section>
  );
}

/**
 * Clinician haematology aid: CBC first, then an optional HPLC step. The result, its rule trace and its sources all
 * come from the API; this component never states a clinical range, threshold or conclusion of its own.
 */
export function HaemAid() {
  const t = useTranslations("haem");
  const [step, setStep] = useState<HaemStep>("cbc");
  const stepRef = useRef<HaemStep>("cbc");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const schemas = useMemo(
    () => buildHaemSchemas({ positive: t("validation.positive"), choose: t("validation.choose") }),
    [t],
  );
  const resolver = useMemo<Resolver<HaemFormValues>>(() => {
    const cbc = zodResolver(schemas.cbc);
    const full = zodResolver(schemas.full);
    return (values, context, options) => (stepRef.current === "cbc" ? cbc : full)(values, context, options);
  }, [schemas]);

  const form = useForm<HaemFormValues>({ defaultValues: EMPTY_VALUES, resolver });
  const live = useWatch({ control: form.control });

  const mutation = useMutation<HaemInterpretation, ApiError, Submission>({
    mutationFn: ({ cbc, hplc }) => clientApi.haemInterpret(cbc, hplc),
    onError: (error) => showServerErrors(error),
  });

  function goTo(next: HaemStep) {
    stepRef.current = next;
    moved.current = true;
    setStep(next);
  }

  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [step]);

  function showServerErrors(error: ApiError) {
    let target: HaemStep | null = null;
    for (const item of error.problem.errors ?? []) {
      const name = fieldFromServerPath(item.field);
      if (name === null) continue;
      form.setError(name, { type: "server", message: item.message });
      const where = stepOfField(name);
      if (target === null || where === "cbc") target = where;
    }
    if (target !== null) goTo(target);
  }

  function run(submission: Submission) {
    if (mutation.isPending) return;
    mutation.mutate(submission);
  }

  function onSubmit(values: HaemFormValues) {
    const cbc = toCbcInput(values);
    if (cbc === null) return;
    if (stepRef.current === "cbc") {
      run({ cbc, hplc: null, scope: "cbc", snapshot: snapshotOf(values, "cbc") });
      return;
    }
    const hplc = toHplcInput(values);
    if (hplc === null) return;
    run({ cbc, hplc, scope: "both", snapshot: snapshotOf(values, "both") });
  }

  async function onNext() {
    const ok = await form.trigger([...CBC_FIELDS]);
    if (ok) goTo("hplc");
  }

  const pending = mutation.isPending;
  const reading = mutation.data;
  const submitted = mutation.variables;
  const stale = reading !== undefined && submitted !== undefined && snapshotOf(live, submitted.scope) !== submitted.snapshot;
  const errors = form.formState.errors;
  const fieldError = (name: HaemFieldName): string | undefined => errors[name]?.message;

  return (
    <div className="grid gap-6">
      <section aria-labelledby="haem-boundary-title" className="panel-sunken grid gap-2 border-s-4 border-line-strong">
        <h2 id="haem-boundary-title" className="m-0 font-sans text-base font-semibold">
          {t("boundary.title")}
        </h2>
        <p className="m-0 text-lg font-semibold">{t("boundary.statement")}</p>
        <p className="m-0">
          <span className="stamp">{t("boundary.signoff")}</span>
        </p>
        <p className="m-0 text-sm text-fg-2">{t("boundary.owner")}</p>
        <p className="m-0 text-sm text-fg-2">{t("boundary.synthetic")}</p>
      </section>

      <div className="haem-inst">
        <section aria-labelledby="haem-form-title" className="inst-pane grid content-start gap-5">
          <h2 id="haem-form-title" className="sr-only">
            {t("title")}
          </h2>
          <ol aria-label={t("steps.label")} className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {STEPS.map((key, index) => {
              const current = key === step;
              return (
                <li
                  key={key}
                  aria-current={current ? "step" : undefined}
                  className={clsx(
                    "flex items-center gap-2 border-b-2 pb-2",
                    current ? "border-accent font-semibold text-fg" : "border-transparent text-fg-3",
                  )}
                >
                  <span aria-hidden="true" className="grid size-6 place-items-center rounded-sm border border-current text-xs">
                    {index + 1}
                  </span>
                  <span>{t(`steps.${key}`)}</span>
                </li>
              );
            })}
          </ol>

          <form
            noValidate
            aria-labelledby="haem-step-title"
            onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
            className="grid gap-5"
          >
            <div>
              <p className="eyebrow mb-1">{t("steps.position", { current: STEPS.indexOf(step) + 1, total: STEPS.length })}</p>
              <h3 id="haem-step-title" ref={headingRef} tabIndex={-1} className="m-0 text-lg">
                {t(`${step}.legend`)}
              </h3>
              <p className="field-hint mt-1">{t(`${step}.hint`)}</p>
              <p className="field-hint mt-1">{t("unansweredHint")}</p>
            </div>

            {step === "cbc" ? (
              <fieldset aria-labelledby="haem-step-title" className="m-0 grid gap-4 border-0 p-0">
                <div>
                  <label htmlFor="haem-sex" className="field-label">
                    {t("fields.sex.label")}
                  </label>
                  <select
                    id="haem-sex"
                    className="select"
                    aria-invalid={fieldError("sex") ? true : undefined}
                    aria-describedby={fieldError("sex") ? "haem-sex-error" : undefined}
                    {...form.register("sex")}
                  >
                    <option value="">{t("fields.sex.choose")}</option>
                    <option value="female">{t("fields.sex.female")}</option>
                    <option value="male">{t("fields.sex.male")}</option>
                  </select>
                  {fieldError("sex") ? (
                    <p id="haem-sex-error" className="field-error">
                      <bdi>{fieldError("sex")}</bdi>
                    </p>
                  ) : null}
                </div>
                <NumberField name="age_years" optional register={form.register} error={fieldError("age_years")} />
                <ChoiceField name="pregnant" register={form.register} error={fieldError("pregnant")} />
                <ChoiceField name="transfused_last_4_months" register={form.register} error={fieldError("transfused_last_4_months")} />
                <NumberField name="hb_g_dl" register={form.register} error={fieldError("hb_g_dl")} />
                <NumberField name="mcv_fl" register={form.register} error={fieldError("mcv_fl")} />
                <NumberField name="mch_pg" register={form.register} error={fieldError("mch_pg")} />
                <NumberField name="rbc_10e12_l" optional register={form.register} error={fieldError("rbc_10e12_l")} />
                <NumberField name="ferritin_ug_l" optional register={form.register} error={fieldError("ferritin_ug_l")} />
                <ChoiceField name="ferritin_status" register={form.register} error={fieldError("ferritin_status")} />
              </fieldset>
            ) : (
              <fieldset aria-labelledby="haem-step-title" className="m-0 grid gap-4 border-0 p-0">
                <NumberField name="hba2_percent" register={form.register} error={fieldError("hba2_percent")} />
                <ChoiceField name="hba2_is_total" register={form.register} error={fieldError("hba2_is_total")} />
                <NumberField name="hbf_percent" register={form.register} error={fieldError("hbf_percent")} />
                <NumberField name="variant_hb_percent" optional register={form.register} error={fieldError("variant_hb_percent")} />
                <div>
                  <label htmlFor="haem-variant_hb_name" className="field-label">
                    {t("fields.variant_hb_name.label")}
                    <span className="ms-1 font-normal text-fg-3">({t("optional")})</span>
                  </label>
                  <input
                    id="haem-variant_hb_name"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={60}
                    className="input input-ltr"
                    aria-invalid={fieldError("variant_hb_name") ? true : undefined}
                    aria-describedby={fieldError("variant_hb_name") ? "haem-variant_hb_name-error" : undefined}
                    {...form.register("variant_hb_name")}
                  />
                  {fieldError("variant_hb_name") ? (
                    <p id="haem-variant_hb_name-error" className="field-error">
                      <bdi>{fieldError("variant_hb_name")}</bdi>
                    </p>
                  ) : null}
                </div>
                <ChoiceField name="single_hba_band_only" register={form.register} error={fieldError("single_hba_band_only")} />
              </fieldset>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {step === "hplc" ? (
                <button type="button" className="btn btn-ghost" onClick={() => goTo("cbc")}>
                  <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                  {t("actions.back")}
                </button>
              ) : null}
              <button type="submit" className="btn btn-primary" aria-busy={pending} aria-disabled={pending}>
                {pending ? t("actions.busy") : step === "cbc" ? t("actions.interpretCbc") : t("actions.interpretBoth")}
              </button>
              {step === "cbc" ? (
                <button type="button" className="btn btn-secondary" onClick={() => void onNext()}>
                  {t("actions.next")}
                  <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section aria-labelledby="haem-result-title" aria-busy={pending} className="inst-pane grid content-start gap-4">
          <h2 id="haem-result-title" className="text-xl">
            {t("result.title")}
          </h2>
          <p role="status" className="sr-only">
            {pending ? t("result.loading") : ""}
          </p>
          {pending ? (
            <div aria-hidden="true" className="grid min-h-72 content-start gap-4">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-9 w-3/4" />
              <SkeletonLine className="h-5 w-full" />
              <SkeletonLine className="h-24 w-full" />
              <SkeletonLine className="h-24 w-full" />
            </div>
          ) : mutation.error ? (
            <ErrorPanel error={mutation.error} onRetry={() => submitted && run(submitted)} />
          ) : reading && submitted ? (
            <ReadingResult data={reading} scope={submitted.scope} stale={stale} />
          ) : (
            <ResultOnboarding />
          )}
        </section>
      </div>
    </div>
  );
}
