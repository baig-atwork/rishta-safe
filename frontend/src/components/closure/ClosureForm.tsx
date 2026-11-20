"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ClosureRecord, ClosureSchema, PatientClosureInput } from "@/lib/api/types";
import { defaultClosureValues, FREE_TEXT_MAX, isYesOption, toPatientInput, type ClosureFormValues } from "./closure-items";
import { buildClosureSchema } from "./closure-schema";
import { PatientItemField } from "./PatientItemField";
import { RadioCard } from "./RadioCard";

export interface ClosureFormProps {
  schema: ClosureSchema;
  coupleId: string;
  personId: string;
}

/**
 * The eight patient items plus the opt-in future-services question. Everything it asks comes from the schema the
 * API returned, rendered by `kind`. There is no question about whether the couple will marry, and none can appear
 * here: the form only renders what the schema lists, and the schema has no such item (ADR 0143).
 */
export function ClosureForm({ schema, coupleId, personId }: ClosureFormProps) {
  const t = useTranslations("closure");
  const doneRef = useRef<HTMLHeadingElement>(null);

  const resolverSchema = useMemo(
    () =>
      buildClosureSchema(schema, {
        required: t("errors.required"),
        integerWhole: t("errors.integerWhole"),
        integerRange: t("errors.integerRange"),
        tooLong: t("errors.tooLong", { max: FREE_TEXT_MAX }),
        interestInvalid: t("errors.interestInvalid"),
      }),
    [schema, t],
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, submitCount },
  } = useForm<ClosureFormValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues: defaultClosureValues(schema),
  });

  const mutation = useMutation<ClosureRecord, ApiError, PatientClosureInput>({
    mutationFn: (input) => clientApi.submitPatientClosure(coupleId, input),
  });

  const interest = useWatch({ control, name: "service_interest" });
  const topics = useWatch({ control, name: "topics" });
  const askTopics = isYesOption(interest) && schema.service_interest.topics.length > 0;

  useEffect(() => {
    if (mutation.isSuccess) doneRef.current?.focus();
  }, [mutation.isSuccess]);

  const answerErrors = errors.answers ?? {};
  const errorCount = Object.keys(answerErrors).length + (errors.service_interest ? 1 : 0);

  if (mutation.isSuccess) {
    return (
      <section aria-labelledby="closure-done-title" className="max-w-xl border-t border-line-strong py-6">
        <h2 id="closure-done-title" ref={doneRef} tabIndex={-1} className="m-0 text-xl">
          {t("success.title")}
        </h2>
        <p role="status" className="mt-2 text-fg-2">
          {t("success.body")}
        </p>
        <p className="m-0 mt-4 text-sm text-fg-3">
          {t("success.reference")} <code className="ltr-run font-mono">{mutation.data.record_id}</code>
          {mutation.data.simulated ? <> · {t("success.simulated")}</> : null}
        </p>
      </section>
    );
  }

  function toggleTopic(topicId: string) {
    const next = topics.includes(topicId) ? topics.filter((topic) => topic !== topicId) : [...topics, topicId];
    setValue("topics", next, { shouldDirty: true });
  }

  return (
    <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(toPatientInput(values, schema, personId)))} className="grid max-w-2xl gap-0 border-t border-line-strong [&>*]:border-b [&>*]:border-line [&>*]:py-6" data-testid="closure-form">
      {schema.language_status === "draft" ? (
        <p className="m-0">
          <span className="stamp">{t("draftStamp")}</span>
        </p>
      ) : null}

      {submitCount > 0 && errorCount > 0 ? (
        <div role="alert" className="panel panel-attention">
          <p className="m-0 font-semibold">{t("errors.summary", { count: errorCount })}</p>
        </div>
      ) : null}

      {schema.patient_items.map((item, index) => (
        <PatientItemField
          key={item.id}
          item={item}
          position={index + 1}
          total={schema.patient_items.length}
          register={register}
          error={answerErrors[item.id]?.message}
        />
      ))}

      {schema.service_interest.options.length > 0 ? (
        <div>
          <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby="service-consent service-hint">
            <legend className="field-label mb-2 p-0 text-base">{schema.service_interest.prompt}</legend>
            <p id="service-consent" className="measure m-0 text-sm text-fg-2">
              {schema.service_interest.consent_text}
            </p>
            <p id="service-hint" className="field-hint mt-3">
              {t("service.optional")}
            </p>
            <div className="grid gap-2">
              {schema.service_interest.options.map((option) => (
                <RadioCard key={option.id} label={option.text} inputProps={{ value: option.id, ...register("service_interest") }} />
              ))}
            </div>
            {errors.service_interest ? <p className="field-error">{errors.service_interest.message}</p> : null}
            {interest ? (
              <button type="button" className="btn btn-ghost mt-2" onClick={() => setValue("service_interest", "")}>
                {t("service.clear")}
              </button>
            ) : null}

            {askTopics ? (
              <div role="group" aria-labelledby="service-topics-label" className="mt-5">
                <p id="service-topics-label" className="field-label m-0">
                  {t("service.topicsPrompt")}
                </p>
                <p className="field-hint">{t("service.topicsHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {schema.service_interest.topics.map((topic) => {
                    const on = topics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        aria-pressed={on}
                        className="btn btn-secondary aria-pressed:border-accent aria-pressed:bg-accent-soft"
                        onClick={() => toggleTopic(topic.id)}
                      >
                        {on ? <Check size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
                        {topic.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </fieldset>
        </div>
      ) : null}

      {mutation.error ? (
        <div role="alert" className="panel panel-attention">
          <h2 className="m-0 text-lg">{t("error.title")}</h2>
          <p className="mt-2 text-fg-2">{t("error.body")}</p>
          <p className="m-0 text-sm text-fg-3">
            <bdi>{mutation.error.problem.title}</bdi>
            {mutation.error.correlationId ? (
              <>
                {" "}
                <code className="ltr-run font-mono">{mutation.error.correlationId}</code>
              </>
            ) : null}
          </p>
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => {
              if (mutation.variables) mutation.mutate(mutation.variables);
            }}
          >
            {t("error.retry")}
          </button>
        </div>
      ) : null}

      <div>
        <button type="submit" className="btn btn-primary" aria-busy={mutation.isPending} disabled={mutation.isPending}>
          {t("submit")}
        </button>
        <p className="m-0 mt-2 text-sm text-fg-3">{t("submitNote")}</p>
      </div>
    </form>
  );
}
