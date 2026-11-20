"use client";

import { givenName } from "@/lib/names";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type Ref } from "react";
import { useForm, useWatch } from "react-hook-form";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ConsentRecord, Partner } from "@/lib/api/types";
import { isolate } from "./consent-status";
import { buildGrantSchema, CONSENT_PURPOSES, CONSENT_SCOPES, toGrantInput, type GrantValues } from "./grant-schema";

interface GrantFormProps {
  coupleId: string;
  viewerPersonId: string;
  /** The other person in the couple, if the couple record loaded. */
  partner: Partner | null;
  onGranted: (record: ConsentRecord) => void;
  /** Lets the empty state's call to action move focus to the first field. */
  firstFieldRef: Ref<HTMLSelectElement>;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      {children(describedBy)}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Grants the viewer's own report to one recipient. Schema first: one zod schema validates and types the form. */
export function GrantForm({ coupleId, viewerPersonId, partner, onGranted, firstFieldRef }: GrantFormProps) {
  const t = useTranslations("sharing");
  const uid = useId();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const recipients = useMemo(
    () => [
      ...(partner ? [{ value: partner.person_id, label: t("grant.recipient.partner", { name: isolate(givenName(partner.display_name)) }) }] : []),
      { value: "counsellor", label: t("recipient.counsellor") },
    ],
    [partner, t],
  );

  const schema = useMemo(
    () =>
      buildGrantSchema(
        recipients.map((option) => option.value),
        {
          recipientRequired: t("grant.errors.recipientRequired"),
          scopeRequired: t("grant.errors.scopeRequired"),
          purposeRequired: t("grant.errors.purposeRequired"),
          expiryPast: t("grant.errors.expiryPast"),
        },
      ),
    [recipients, t],
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<GrantValues>({
    resolver: zodResolver(schema),
    defaultValues: { recipient: "", scope: "couple_result_only", purpose: "", expiry: "" },
  });

  const mutation = useMutation<ConsentRecord, ApiError, GrantValues>({
    mutationFn: (values) => clientApi.grantConsent(coupleId, toGrantInput(values, viewerPersonId)),
    onSuccess: (record) => {
      reset();
      onGranted(record);
    },
  });

  const scope = useWatch({ control, name: "scope" });
  const recipientField = register("recipient");
  const scopeDescriptionId = `${uid}-scope-description`;

  return (
    <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))} aria-labelledby="grant-title" className="panel grid max-w-xl gap-5">
      <Field id="grant-recipient" label={t("grant.recipient.label")} hint={t("grant.recipient.hint")} error={errors.recipient?.message}>
        {(describedBy) => (
          <select
            id="grant-recipient"
            className="select"
            aria-required="true"
            aria-invalid={errors.recipient ? true : undefined}
            aria-describedby={describedBy}
            {...recipientField}
            ref={(element) => {
              recipientField.ref(element);
              if (typeof firstFieldRef === "function") firstFieldRef(element);
              else if (firstFieldRef) firstFieldRef.current = element;
            }}
          >
            <option value="">{t("grant.recipient.placeholder")}</option>
            {recipients.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="grant-scope" label={t("grant.scope.label")} error={errors.scope?.message}>
        {(describedBy) => (
          <>
            <select
              id="grant-scope"
              className="select"
              aria-required="true"
              aria-invalid={errors.scope ? true : undefined}
              aria-describedby={[describedBy, scopeDescriptionId].filter(Boolean).join(" ")}
              {...register("scope")}
            >
              {CONSENT_SCOPES.map((value) => (
                <option key={value} value={value}>
                  {t(`scope.${value}.label`)}
                </option>
              ))}
            </select>
            <p id={scopeDescriptionId} className="field-hint mt-2">
              {t(`scope.${scope}.description`)}
            </p>
          </>
        )}
      </Field>

      <Field id="grant-purpose" label={t("grant.purpose.label")} hint={t("grant.purpose.hint")} error={errors.purpose?.message}>
        {(describedBy) => (
          <select
            id="grant-purpose"
            className="select"
            aria-required="true"
            aria-invalid={errors.purpose ? true : undefined}
            aria-describedby={describedBy}
            {...register("purpose")}
          >
            <option value="">{t("grant.purpose.placeholder")}</option>
            {CONSENT_PURPOSES.map((value) => (
              <option key={value} value={value}>
                {t(`purposes.${value}`)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="grant-expiry" label={t("grant.expiry.label")} hint={t("grant.expiry.hint")} error={errors.expiry?.message}>
        {(describedBy) => (
          <input
            id="grant-expiry"
            type="date"
            className="input input-ltr"
            min={today}
            aria-invalid={errors.expiry ? true : undefined}
            aria-describedby={describedBy}
            {...register("expiry")}
          />
        )}
      </Field>

      {mutation.error ? (
        <p role="alert" className="field-error m-0">
          {mutation.error.problem.title}
          {mutation.error.correlationId ? (
            <>
              {" "}
              <code className="ltr-run font-mono">{mutation.error.correlationId}</code>
            </>
          ) : null}
        </p>
      ) : null}

      <div>
        <button type="submit" className="btn btn-primary" aria-busy={mutation.isPending} disabled={mutation.isPending}>
          {t("grant.submit")}
        </button>
      </div>
    </form>
  );
}
