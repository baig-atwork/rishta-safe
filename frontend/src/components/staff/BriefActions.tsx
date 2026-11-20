"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { StaffVerb } from "@/lib/staff-brief";

export interface BriefActionsProps {
  coupleId: string;
  verbs: readonly StaffVerb[];
  /** The closure proforma (a server-rendered form element), shown in the pane on request, or a partial notice. */
  proforma: ReactNode;
}

/**
 * The brief's verbs. Each verb is one existing pathway event (POST /v1/couples/{id}/pathway/events); nothing here
 * invents an event. The closure proforma opens in this pane with its own logic untouched.
 */
export function BriefActions({ coupleId, verbs, proforma }: BriefActionsProps) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [proformaOpen, setProformaOpen] = useState(false);
  const [recorded, setRecorded] = useState<StaffVerb | null>(null);

  const mutation = useMutation<unknown, ApiError, StaffVerb>({
    mutationFn: (verb) => clientApi.advancePathway(coupleId, verb),
    onSuccess: (_data, verb) => {
      setRecorded(verb);
      router.refresh();
    },
  });

  return (
    <div>
      <div className="inst-act" role="group" aria-label={t("action.label")}>
        {verbs.map((verb, index) => (
          <button
            key={verb}
            type="button"
            className={index === 0 ? "btn btn-primary" : "btn btn-secondary"}
            aria-disabled={mutation.isPending}
            onClick={() => {
              if (!mutation.isPending) mutation.mutate(verb);
            }}
          >
            {mutation.isPending && mutation.variables === verb ? t("action.busy") : t(`action.${verb}`)}
          </button>
        ))}
        <button type="button" className="btn btn-quiet" aria-expanded={proformaOpen} aria-controls="closure-proforma" onClick={() => setProformaOpen((open) => !open)}>
          {proformaOpen ? t("action.closeProforma") : t("action.proforma")}
        </button>
      </div>
      {verbs.length === 0 ? <p className="inst-status text-fg-3">{t("action.none")}</p> : null}
      <div role="status" className="inst-status">
        {recorded !== null && !mutation.isError ? t("action.done", { action: t(`action.${recorded}`) }) : null}
      </div>
      {mutation.isError ? (
        <div role="alert" className="panel panel-attention inst-status">
          <p className="m-0 font-semibold">{t("action.error")}</p>
          <p dir="auto" className="m-0 mt-1 text-sm text-fg-2">
            <bdi>{mutation.error.problem.detail ?? mutation.error.problem.title}</bdi>
          </p>
          {mutation.error.correlationId ? (
            <p className="m-0 mt-1 text-sm text-fg-3">
              {t("action.correlation")}: <code className="ltr-run font-mono">{mutation.error.correlationId}</code>
            </p>
          ) : null}
        </div>
      ) : null}
      {proformaOpen ? (
        <section id="closure-proforma" aria-labelledby="proforma-title" className="mt-6 border-t border-line pt-5">
          <h3 id="proforma-title" className="m-0 text-lg">
            {t("proforma.title")}
          </h3>
          <p className="mb-5 mt-2 text-sm text-fg-2">{t("proforma.standfirst")}</p>
          {proforma}
        </section>
      ) : null}
    </div>
  );
}
