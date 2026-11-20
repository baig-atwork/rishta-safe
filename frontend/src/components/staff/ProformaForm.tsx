"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import { Controller, useForm, type Control, type FieldValues, type UseFormRegister } from "react-hook-form";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ClosureChoice, ClosureRecord, Locale, ProformaField } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import {
  FORM_ERROR_KEY,
  PROFORMA_TEXT_MAX,
  buildAnswers,
  buildProformaSchema,
  defaultValues,
  fieldIdFromServerPath,
  isStringArray,
  proformaResolver,
  toActionRows,
  type ActionRow,
  type Answers,
} from "./proforma-schema";

let rowSequence = 0;
function nextRowUid(): string {
  rowSequence += 1;
  return `row-${rowSequence}`;
}

interface BlockProps {
  field: ProformaField;
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  error: string | undefined;
}

/** Number, label, who fills it, and the server's hint, shared by every field kind. */
function useFieldParts(field: ProformaField, error: string | undefined) {
  const t = useTranslations("staff.proforma");
  const id = `pf-${field.id}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [field.hint ? hintId : null, error ? errorId : null].filter((part) => part !== null).join(" ") || undefined;
  const caption = (
    <>
      <span className="me-2 font-mono tabular-nums text-ink-3">{field.number}</span>
      <span dir="auto">{field.label}</span>
    </>
  );
  const meta =
    field.filled_by !== "clinician" || field.hint ? (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {field.filled_by !== "clinician" ? <span className="tag font-normal">{t(`filledBy.${field.filled_by}`)}</span> : null}
        {field.hint ? (
          <span id={hintId} dir="auto" className="field-hint m-0">
            {field.hint}
          </span>
        ) : null}
      </div>
    ) : null;
  const errorNode = error ? (
    <p id={errorId} className="field-error">
      <bdi>{error}</bdi>
    </p>
  ) : null;
  return { t, id, describedBy, caption, meta, errorNode };
}

function ChoiceGroup({
  field,
  options,
  register,
  error,
  row,
}: {
  field: ProformaField;
  options: readonly ClosureChoice[];
  register: UseFormRegister<FieldValues>;
  error: string | undefined;
  row: boolean;
}) {
  const { describedBy, caption, meta, errorNode } = useFieldParts(field, error);
  return (
    <fieldset aria-describedby={describedBy} className="m-0 border-0 p-0">
      <legend className="field-label">{caption}</legend>
      {meta}
      <div className={row ? "flex flex-wrap gap-x-6" : "grid"}>
        {options.map((option) => (
          <label key={option.id} className="flex min-h-11 items-center gap-3">
            <input type="radio" value={option.id} className="size-5 shrink-0 accent-brand" {...register(field.id)} />
            <span dir="auto">{option.text}</span>
          </label>
        ))}
      </div>
      {errorNode}
    </fieldset>
  );
}

function ChecklistField({ field, control, error }: Pick<BlockProps, "field" | "control" | "error">) {
  const { describedBy, caption, meta, errorNode } = useFieldParts(field, error);
  return (
    <Controller
      control={control}
      name={field.id}
      render={({ field: bound }) => {
        const picked = isStringArray(bound.value) ? bound.value : [];
        return (
          <fieldset aria-describedby={describedBy} className="m-0 border-0 p-0">
            <legend className="field-label">{caption}</legend>
            {meta}
            <div className="grid">
              {field.choices.map((choice) => (
                <label key={choice.id} className="flex min-h-11 items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-brand"
                    checked={picked.includes(choice.id)}
                    onChange={(event) =>
                      bound.onChange(event.target.checked ? [...picked, choice.id] : picked.filter((value) => value !== choice.id))
                    }
                    onBlur={bound.onBlur}
                  />
                  <span dir="auto">{choice.text}</span>
                </label>
              ))}
            </div>
            {errorNode}
          </fieldset>
        );
      }}
    />
  );
}

function ActionListField({ field, control, error }: Pick<BlockProps, "field" | "control" | "error">) {
  const { t, id, describedBy, caption, meta, errorNode } = useFieldParts(field, error);
  // The owner is a role the server accepts; when it publishes the list the owner is a select, otherwise free text.
  const ownerChoices = field.owner_choices ?? [];
  return (
    <Controller
      control={control}
      name={field.id}
      render={({ field: bound }) => {
        const rows = toActionRows(bound.value);
        const update = (uid: string, patch: Partial<ActionRow>) =>
          bound.onChange(rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));
        return (
          <fieldset aria-describedby={describedBy} className="m-0 border-0 p-0">
            <legend className="field-label">{caption}</legend>
            {meta}
            {rows.length === 0 ? <p className="m-0 mb-3 text-sm text-ink-3">{t("actions.none")}</p> : null}
            <ul className="m-0 mb-3 grid list-none gap-3 p-0">
              {rows.map((row, index) => {
                const base = `${id}-${row.uid}`;
                return (
                  <li key={row.uid}>
                    <fieldset className="panel-sunken m-0">
                      <legend className="px-1 text-sm font-semibold">{t("actions.rowLabel", { number: index + 1 })}</legend>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                        <div>
                          <label htmlFor={`${base}-action`} className="field-label">
                            {t("actions.action")}
                          </label>
                          {field.choices.length > 0 ? (
                            <select
                              id={`${base}-action`}
                              className="select"
                              value={row.action}
                              onChange={(event) => update(row.uid, { action: event.target.value })}
                            >
                              <option value="">{t("choose")}</option>
                              {field.choices.map((choice) => (
                                <option key={choice.id} value={choice.id}>
                                  {choice.text}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`${base}-action`}
                              type="text"
                              dir="auto"
                              autoComplete="off"
                              className="input"
                              value={row.action}
                              onChange={(event) => update(row.uid, { action: event.target.value })}
                            />
                          )}
                        </div>
                        <div>
                          <label htmlFor={`${base}-owner`} className="field-label">
                            {t("actions.owner")}
                          </label>
                          {ownerChoices.length > 0 ? (
                            <select
                              id={`${base}-owner`}
                              className="select"
                              value={row.owner}
                              onChange={(event) => update(row.uid, { owner: event.target.value })}
                            >
                              <option value="">{t("choose")}</option>
                              {ownerChoices.map((choice) => (
                                <option key={choice.id} value={choice.id}>
                                  {choice.text}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`${base}-owner`}
                              type="text"
                              dir="auto"
                              autoComplete="off"
                              className="input"
                              value={row.owner}
                              onChange={(event) => update(row.uid, { owner: event.target.value })}
                            />
                          )}
                        </div>
                        <div>
                          <label htmlFor={`${base}-due`} className="field-label">
                            {t("actions.due")}
                          </label>
                          <input
                            id={`${base}-due`}
                            type="date"
                            className="input input-ltr"
                            value={row.due}
                            onChange={(event) => update(row.uid, { due: event.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label={t("actions.remove", { number: index + 1 })}
                          onClick={() => bound.onChange(rows.filter((other) => other.uid !== row.uid))}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </fieldset>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => bound.onChange([...rows, { uid: nextRowUid(), action: "", owner: "", due: "" }])}
            >
              <Plus aria-hidden="true" className="size-4" />
              {t("actions.add")}
            </button>
            {errorNode}
          </fieldset>
        );
      }}
    />
  );
}

function FieldBlock({ field, control, register, error }: BlockProps) {
  const { t, id, describedBy, caption, meta, errorNode } = useFieldParts(field, error);

  if (field.filled_by === "system" || field.kind === "system") {
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {caption}
        </label>
        {meta}
        <input
          id={id}
          type="text"
          readOnly
          aria-readonly="true"
          aria-describedby={describedBy}
          className="input bg-sunken text-ink-2"
          value={t("systemValue")}
        />
      </div>
    );
  }

  if (field.filled_by === "patient") {
    return (
      <div>
        <p className="field-label">{caption}</p>
        {meta}
        <p className="panel-sunken m-0 text-sm text-ink-2">{t("patientNote")}</p>
      </div>
    );
  }

  switch (field.kind) {
    case "yes_no":
      return (
        <ChoiceGroup
          field={field}
          options={
            field.choices.length > 0
              ? field.choices
              : [
                  { id: "yes", text: t("yes") },
                  { id: "no", text: t("no") },
                ]
          }
          register={register}
          error={error}
          row
        />
      );
    case "single_choice":
      return <ChoiceGroup field={field} options={field.choices} register={register} error={error} row={false} />;
    case "checklist":
      return <ChecklistField field={field} control={control} error={error} />;
    case "action_list":
      return <ActionListField field={field} control={control} error={error} />;
    case "datetime":
      return (
        <div>
          <label htmlFor={id} className="field-label">
            {caption}
          </label>
          {meta}
          <input
            id={id}
            type="datetime-local"
            className="input input-ltr"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...register(field.id)}
          />
          {errorNode}
        </div>
      );
    default:
      return (
        <div>
          <label htmlFor={id} className="field-label">
            {caption}
          </label>
          {meta}
          <textarea
            id={id}
            dir="auto"
            maxLength={PROFORMA_TEXT_MAX}
            className="textarea"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...register(field.id)}
          />
          {errorNode}
        </div>
      );
  }
}

function SuccessPanel({ record, locale, onEdit }: { record: ClosureRecord; locale: Locale; onEdit: () => void }) {
  const t = useTranslations("staff.proforma.success");
  return (
    <section role="status" aria-labelledby="pf-success-title" className="panel grid gap-3">
      <h3 id="pf-success-title" className="m-0 flex items-center gap-2 text-xl">
        <Check aria-hidden="true" className="size-5 shrink-0 text-ok" />
        {t("title")}
      </h3>
      <p className="m-0 text-ink-2">{t("body")}</p>
      <dl className="m-0 grid gap-1 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">{t("record")}</dt>
          <dd className="m-0">
            <code className="ltr-run font-mono">{record.record_id}</code>
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">{t("when")}</dt>
          <dd className="m-0">
            <bdi>{formatDateTime(locale, record.submitted_at)}</bdi>
          </dd>
        </div>
      </dl>
      {record.simulated ? (
        <p className="m-0">
          <span className="stamp">{t("simulated")}</span>
        </p>
      ) : null}
      <div>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          {t("edit")}
        </button>
      </div>
    </section>
  );
}

function SaveError({ error, fields, onRetry }: { error: ApiError; fields: readonly ProformaField[]; onRetry: () => void }) {
  const t = useTranslations("staff.proforma.error");
  const { problem } = error;
  const unmatched = (problem.errors ?? []).filter((item) => fieldIdFromServerPath(item.field, fields) === null);
  return (
    <section role="alert" className="panel panel-attention grid gap-3">
      <h3 className="m-0 text-xl">{t("title")}</h3>
      <p className="measure m-0 text-ink-2">{t("body")}</p>
      <p dir="auto" className="m-0 font-semibold">
        <bdi>{problem.detail ?? problem.title}</bdi> (<span className="ltr-run">{problem.status}</span>)
      </p>
      {unmatched.length > 0 ? (
        <div>
          <p className="m-0 text-sm font-semibold">{t("other")}</p>
          <ul className="m-0 mt-1 grid list-disc gap-1 ps-6 text-sm text-ink-2">
            {unmatched.map((item, index) => (
              <li key={`${item.field}-${index}`}>
                <bdi>{item.message}</bdi>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error.correlationId ? (
        <p className="m-0 text-sm text-ink-3">
          {t("correlation")}: <code className="ltr-run font-mono">{error.correlationId}</code>
        </p>
      ) : null}
      <div>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          {t("retry")}
        </button>
      </div>
    </section>
  );
}

export interface ProformaFormProps {
  coupleId: string;
  /** `closureSchema(locale).proforma_fields`: the form is built from this list and nothing else. */
  fields: readonly ProformaField[];
  /** True when the schema text is a draft translation. */
  draft?: boolean;
}

/**
 * The 12-field closure proforma. System fields are shown read-only, patient fields are marked as the patient's own,
 * and the clinician fields are inputs validated by a zod schema built from the published field list.
 */
export function ProformaForm({ coupleId, fields, draft = false }: ProformaFormProps) {
  const t = useTranslations("staff.proforma");
  const locale = useLocale() as Locale;
  const ordered = useMemo(() => [...fields].sort((a, b) => a.number - b.number), [fields]);

  const resolver = useMemo(
    () =>
      proformaResolver(
        buildProformaSchema(ordered, {
          maxLength: t("validation.maxLength", { max: PROFORMA_TEXT_MAX }),
          datetime: t("validation.datetime"),
          choice: t("validation.choice"),
          actionRow: t("validation.actionRow"),
          atLeastOne: t("validation.atLeastOne"),
        }),
      ),
    [ordered, t],
  );
  const form = useForm<FieldValues>({ defaultValues: defaultValues(ordered), resolver });

  const mutation = useMutation<ClosureRecord, ApiError, Answers>({
    mutationFn: (answers) => clientApi.submitProforma(coupleId, { answers }),
    onError: (error) => {
      for (const item of error.problem.errors ?? []) {
        const id = fieldIdFromServerPath(item.field, ordered);
        if (id !== null) form.setError(id, { type: "server", message: item.message });
      }
    },
  });

  const pending = mutation.isPending;

  function onSubmit(values: FieldValues) {
    if (pending) return;
    mutation.mutate(buildAnswers(ordered, values));
  }

  if (mutation.isSuccess) {
    return <SuccessPanel record={mutation.data} locale={locale} onEdit={() => mutation.reset()} />;
  }

  const errors = form.formState.errors;
  const messageOf = (id: string): string | undefined => {
    const message = errors[id]?.message;
    return typeof message === "string" ? message : undefined;
  };
  const formMessage = messageOf(FORM_ERROR_KEY);

  const parts: ReactNode[] = ordered.map((field) => (
    <li key={field.id} className="border-b border-line pb-6 last:border-b-0">
      <FieldBlock field={field} control={form.control} register={form.register} error={messageOf(field.id)} />
    </li>
  ));

  return (
    <form
      noValidate
      aria-label={t("formLabel")}
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      className="grid gap-6"
    >
      {draft ? (
        <p className="m-0">
          <span className="stamp">{t("draft")}</span>
        </p>
      ) : null}
      <ol className="m-0 grid list-none gap-6 p-0">{parts}</ol>
      {formMessage ? (
        <p role="alert" className="field-error m-0">
          {formMessage}
        </p>
      ) : null}
      {mutation.error ? (
        <SaveError error={mutation.error} fields={ordered} onRetry={() => mutation.variables && mutation.mutate(mutation.variables)} />
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" aria-busy={pending} aria-disabled={pending}>
          {pending ? t("saving") : t("submit")}
        </button>
      </div>
    </form>
  );
}
