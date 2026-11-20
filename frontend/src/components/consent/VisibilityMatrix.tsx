"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Cell } from "@/components/grid/Cell";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ConsentRecord, ConsentScope, Emirate, Partner } from "@/lib/api/types";
import { FIXED_COLUMNS, MATRIX_SCOPES, switchState, type SwitchState } from "@/lib/couple-matrix";
import { givenName } from "@/lib/names";

export interface VisibilityMatrixProps {
  coupleId: string;
  /** The viewer's person id (consent subject). */
  meId: string;
  partner: Partner;
  initialConsents: ConsentRecord[];
  /** The couple's emirate policy: the care-team cell cites the rule of this emirate. */
  policy: Emirate;
}

const ROW_KEY: Record<ConsentScope, "result" | "genes" | "detail"> = {
  couple_result_only: "result",
  gene_names_only: "genes",
  full_variant_detail: "detail",
};

function ProblemInline({ error }: { error: ApiError }) {
  return (
    <>
      <bdi>{error.problem.title}</bdi>
      {error.correlationId ? (
        <>
          {" "}
          <code className="ltr-run font-mono">{error.correlationId}</code>
        </>
      ) : null}
    </>
  );
}

/** Confirm before a share ends: a controlled native modal <dialog>, same wording and focus rules as the ledger's revoke. */
function RevokeConfirm({ open, recipient, scope, pending, error, onConfirm, onClose }: {
  open: boolean;
  recipient: string;
  scope: string;
  pending: boolean;
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("sharing.revoke");
  const titleId = useId();
  const bodyId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      keepRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog-popup" aria-labelledby={titleId} aria-describedby={bodyId} onClose={onClose}>
      {open ? (
        <>
          <h2 id={titleId} className="m-0 text-lg">
            {t("title", { recipient })}
          </h2>
          <p id={bodyId} className="mt-3 text-fg-2">
            {t("body", { scope })}
          </p>
          <p className="mt-3 text-sm text-fg-3">{t("note")}</p>
          {error ? (
            <p role="alert" className="field-error">
              <ProblemInline error={error} />
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button ref={keepRef} type="button" className="btn btn-secondary" onClick={onClose}>
              {t("keep")}
            </button>
            <button type="button" className="btn btn-danger" aria-busy={pending} disabled={pending} onClick={onConfirm}>
              {t("confirm")}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

/**
 * Who sees what (02-ux-concept 4.3): people across, information layers down, a real table. Only the partner column is
 * the viewer's to change (role="switch", wired to the same grant and revoke calls as the ledger); the other columns are
 * fixed by the disclosure policy and by Decree-Law 49/2023 and carry no control. Every change refreshes the audit
 * queries, so the new row appears in the table and on the tape.
 */
export function VisibilityMatrix({ coupleId, meId, partner, initialConsents, policy }: VisibilityMatrixProps) {
  const t = useTranslations("sharing");
  const queryClient = useQueryClient();
  const consentsKey = ["consents", coupleId] as const;
  const query = useQuery<ConsentRecord[], ApiError>({
    queryKey: consentsKey,
    queryFn: () => clientApi.consents(coupleId),
    initialData: initialConsents,
    staleTime: 60_000,
  });
  const consents = query.data;
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [failure, setFailure] = useState<{ scope: ConsentScope; error: ApiError } | null>(null);
  const [revoking, setRevoking] = useState<{ scope: ConsentScope; state: SwitchState } | null>(null);
  const [busyScope, setBusyScope] = useState<ConsentScope | null>(null);

  const partnerName = givenName(partner.display_name);
  const policyName = t(`matrix.policy.${policy}`);

  function afterChange(action: "consent_granted" | "consent_revoked") {
    setNow(Date.now());
    setFailure(null);
    setAnnouncement(t("matrix.recorded", { action }));
    void queryClient.invalidateQueries({ queryKey: consentsKey });
    void queryClient.invalidateQueries({ queryKey: ["audit", coupleId] });
  }

  const grant = useMutation<ConsentRecord, ApiError, ConsentScope>({
    mutationFn: (scope) =>
      clientApi.grantConsent(coupleId, { subject_person_id: meId, recipient_role: partner.person_id, scope, purpose: "partner_disclosure", expires_at: null }),
    onMutate: (scope) => setBusyScope(scope),
    onSuccess: (record) => {
      queryClient.setQueryData<ConsentRecord[]>(consentsKey, (old) => [...(old ?? []), record]);
      afterChange("consent_granted");
    },
    onError: (error, scope) => setFailure({ scope, error }),
    onSettled: () => setBusyScope(null),
  });

  const revoke = useMutation<ConsentRecord[], ApiError, { scope: ConsentScope; state: SwitchState }>({
    mutationFn: async ({ state }) => {
      const done: ConsentRecord[] = [];
      for (const record of state.records) done.push(await clientApi.revokeConsent(record.consent_id));
      return done;
    },
    onMutate: ({ scope }) => setBusyScope(scope),
    onSuccess: (records) => {
      queryClient.setQueryData<ConsentRecord[]>(consentsKey, (old) =>
        (old ?? []).map((row) => records.find((r) => r.consent_id === row.consent_id) ?? row),
      );
      setRevoking(null);
      afterChange("consent_revoked");
    },
    onError: (error, vars) => setFailure({ scope: vars.scope, error }),
    onSettled: () => setBusyScope(null),
  });

  const states = MATRIX_SCOPES.map((scope) => ({ scope, state: switchState(consents, meId, partner.person_id, scope, now) }));
  const nothingShared = states.every((s) => !s.state.on);

  return (
    <section aria-labelledby="matrix-heading" className="grid gap-4" data-testid="visibility-matrix">
      <h2 id="matrix-heading" className="sr-only">
        {t("matrix.caption")}
      </h2>
      {nothingShared ? (
        <p className="m-0 text-fg-2" data-testid="matrix-empty">
          {t("matrix.introEmpty")}
        </p>
      ) : null}
      {/* A scrollable region must be reachable by keyboard (WCAG 2.1.1; axe scrollable-region-focusable). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div role="region" aria-label={t("matrix.scrollLabel")} tabIndex={0} className="overflow-x-auto border border-line-strong">
        <table className="stack-table w-full min-w-[56rem] border-collapse text-start">
          <caption className="sr-only">{t("matrix.caption")}</caption>
          <thead className="stack-thead bg-surface-sunken">
            <tr>
              <th scope="col" className="min-w-[13rem] border-b border-line-strong p-3 text-start align-bottom font-semibold">
                {t("matrix.rowHeader")}
              </th>
              <th scope="col" className="border-b border-line-strong p-3 text-start align-bottom font-semibold">
                <span className="block">{t("matrix.col.partner", { name: partnerName })}</span>
                <span className="label block font-normal">{t("matrix.hint.partner")}</span>
              </th>
              {FIXED_COLUMNS.map((col) => (
                <th key={col.key} scope="col" className="border-b border-line-strong p-3 text-start align-bottom font-semibold">
                  <span className="block">{t(`matrix.col.${col.key}`)}</span>
                  <span className="label block font-normal">{t(`matrix.hint.${col.key}`)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="stack-tbody">
            {states.map(({ scope, state }) => {
              const rowLabel = t(`matrix.row.${ROW_KEY[scope]}`);
              const busy = busyScope === scope;
              return (
                <tr key={scope} className="stack-group border-b border-line last:border-b-0">
                  <th scope="row" className="stack-group-head p-3 text-start align-top font-semibold">
                    <span className="block">{rowLabel}</span>
                    <code className="ltr-run block whitespace-nowrap font-mono text-xs font-normal text-fg-3">{scope}</code>
                  </th>
                  <td className={`p-3 align-top stack-td ${state.on ? "bg-accent-soft" : ""}`} data-label={t("matrix.col.partner", { name: partnerName })} data-state={state.on ? "on" : "off"}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.on}
                      aria-busy={busy}
                      disabled={busy}
                      className="grid min-h-11 w-full cursor-pointer gap-2 text-start"
                      onClick={() => {
                        setFailure(null);
                        if (state.on) setRevoking({ scope, state });
                        else grant.mutate(scope);
                      }}
                    >
                      <Cell fill={state.on ? "solid" : "open"} dashed={!state.on} tone={state.on ? "accent" : undefined} size={16} />
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span>{state.on ? t("matrix.on", { name: partnerName }) : t("matrix.off")}</span>
                        <span className="font-semibold text-link underline">{busy ? t("matrix.working") : state.on ? t("matrix.revoke") : t("matrix.share")}</span>
                      </span>
                      <span className="sr-only">, {rowLabel}</span>
                    </button>
                    {failure?.scope === scope ? (
                      <p role="alert" className="field-error m-0 mt-2">
                        {t("matrix.changeFailed")} <ProblemInline error={failure.error} />
                      </p>
                    ) : null}
                  </td>
                  {FIXED_COLUMNS.map((col) => (
                    <td key={col.key} className={`p-3 align-top stack-td`} data-label={t(`matrix.col.${col.key}`)} data-fixed={col.key}>
                      <div className="grid gap-2">
                        <Cell fill={col.fill} tone="ink" size={16} />
                        <span>{col.what === "care" ? t("matrix.care", { policy: policyName }) : t(`matrix.${col.what}`)}</span>
                        <span className="label">{t("matrix.fixed")}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p role="status" aria-live="polite" className="m-0 min-h-6 text-sm text-fg-2" data-testid="matrix-live">
        {announcement}
      </p>
      <p className="measure m-0 text-sm text-fg-2">{t("matrix.footnote")}</p>
      <RevokeConfirm
        open={revoking !== null}
        recipient={partnerName}
        scope={revoking ? t(`scope.${revoking.scope}.label`) : ""}
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        onClose={() => setRevoking(null)}
      />
    </section>
  );
}
