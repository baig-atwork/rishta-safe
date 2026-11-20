"use client";

import { givenNameOrNull } from "@/lib/names";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Cell } from "@/components/grid/Cell";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ConsentRecord, Locale, Partner } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { consentStatus, isolate, type ConsentStatus } from "./consent-status";
import { GrantForm } from "./GrantForm";
import { RevokeDialog } from "./RevokeDialog";
import { CAPTION, TABLE, TABLE_WRAP, TBODY, TD, THEAD, TR } from "./table-classes";

export interface SharingPanelProps {
  initialConsents: ConsentRecord[];
  viewerPersonId: string;
  /** Both people in the couple, as the couple record lists them. */
  partners: Partner[];
  coupleId: string;
  locale: Locale;
}

const STATUS_TAG: Record<ConsentStatus, string> = { active: "tag tag-brand", revoked: "tag", expired: "tag" };

/**
 * Sharing and consent: what each person lets their partner (or the counsellor) see of their own report.
 * The state is a statutory recipient and nothing here pretends otherwise; the intro says so first.
 */
export function SharingPanel({ initialConsents, viewerPersonId, partners, coupleId, locale }: SharingPanelProps) {
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
  const [changedId, setChangedId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);

  const partner = partners.find((person) => person.person_id !== viewerPersonId) ?? null;

  /** Plain text for sentences (names isolated so they cannot reorder RTL text); the table wraps names in <bdi>. */
  const nameOf = (id: string): string | null => givenNameOrNull(partners.find((person) => person.person_id === id)?.display_name);
  const recipientText = (value: string): string => {
    const name = nameOf(value);
    if (name) return isolate(name);
    return t.has(`recipient.${value}`) ? t(`recipient.${value}`) : isolate(value);
  };
  const recipientNode = (value: string) => {
    const name = nameOf(value);
    if (name) return <bdi>{name}</bdi>;
    return t.has(`recipient.${value}`) ? t(`recipient.${value}`) : <bdi>{value}</bdi>;
  };

  function recordChange(record: ConsentRecord, kind: "granted" | "revoked") {
    queryClient.setQueryData<ConsentRecord[]>(consentsKey, (old) =>
      kind === "granted" ? [...(old ?? []), record] : (old ?? []).map((row) => (row.consent_id === record.consent_id ? record : row)),
    );
    setNow(Date.now());
    setChangedId(record.consent_id);
    setAnnouncement(t(`live.${kind}`, { recipient: recipientText(record.recipient), scope: t(`scope.${record.scope}.label`) }));
    void queryClient.invalidateQueries({ queryKey: consentsKey });
    void queryClient.invalidateQueries({ queryKey: ["audit", coupleId] });
  }

  return (
    <div className="grid gap-12">
      <section aria-labelledby="sharing-intro-title">
        <h2 id="sharing-intro-title" className="mb-3 text-xl">
          {t("intro.heading")}
        </h2>
        <div className="measure grid gap-3 text-fg-2">
          <p className="m-0">{t("intro.partner")}</p>
          <p className="m-0">{t.rich("intro.state", { ltr: (chunks) => <bdi>{chunks}</bdi> })}</p>
          <p className="m-0">{t.rich("intro.notToKnow", { ltr: (chunks) => <bdi>{chunks}</bdi> })}</p>
        </div>
      </section>

      <section aria-labelledby="ledger-title">
        <h2 id="ledger-title" ref={headingRef} tabIndex={-1} className="mb-1 text-xl">
          {t("ledger.heading")}
        </h2>
        <p role="status" aria-live="polite" className="m-0 mb-3 min-h-6 text-sm text-fg-2">
          {announcement}
        </p>

        {query.isRefetchError ? (
          <div role="alert" className="panel-sunken panel-attention mb-4">
            <p className="m-0 font-semibold">{t("ledger.refreshError")}</p>
            <p className="m-0 mt-1 text-sm text-fg-2">
              <bdi>{query.error.problem.title}</bdi>
              {query.error.correlationId ? (
                <>
                  {" "}
                  <code className="ltr-run font-mono">{query.error.correlationId}</code>
                </>
              ) : null}
            </p>
            <button type="button" className="btn btn-secondary mt-3" onClick={() => void query.refetch()}>
              {t("ledger.refreshRetry")}
            </button>
          </div>
        ) : null}

        {consents.length === 0 ? (
          <div className="panel-sunken flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
            <span aria-hidden="true" className="flex shrink-0 gap-1 text-fg-3">
              <Cell fill="open" size={20} />
              <Cell fill="open" size={20} />
              <Cell fill="open" dashed size={20} />
            </span>
            <div className="max-w-xl">
              <h3 className="m-0 text-xl">{t("empty.title")}</h3>
              <p className="measure mt-2 text-fg-2">{t("empty.body")}</p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => firstFieldRef.current?.focus()}>
                {t("empty.cta")}
              </button>
            </div>
          </div>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <caption className={CAPTION}>{t("ledger.caption")}</caption>
              <thead className={THEAD}>
                <tr>
                  {(["subject", "recipient", "scope", "purpose", "granted", "expiry", "status", "action"] as const).map((column) => (
                    <th key={column} scope="col">
                      {t(`ledger.columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={TBODY}>
                {consents.map((record) => {
                  const status = consentStatus(record, now);
                  const own = record.subject_person_id === viewerPersonId;
                  const subjectName = nameOf(record.subject_person_id);
                  const changed = changedId === record.consent_id;
                  return (
                    <tr key={`${record.consent_id}:${status}`} className={changed ? `${TR} row-settle` : TR}>
                      <td className={TD} data-label={t("ledger.columns.subject")}>
                        <span>
                          <bdi>{subjectName ?? record.subject_person_id}</bdi>
                          {own ? <span className="tag tag-brand ms-2">{t("ledger.you")}</span> : null}
                        </span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.recipient")}>
                        <span>
                          {recipientNode(record.recipient)}
                          {record.recipient === viewerPersonId ? <span className="tag tag-brand ms-2">{t("ledger.you")}</span> : null}
                        </span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.scope")}>
                        <span>{t(`scope.${record.scope}.label`)}</span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.purpose")}>
                        <span>
                          {/* A purpose id from the backend's closed list reads as its label; older free text shows as written. */}
                          <bdi>{t.has(`purposes.${record.purpose}`) ? t(`purposes.${record.purpose}`) : record.purpose}</bdi>
                        </span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.granted")}>
                        <span>{formatDate(locale, record.granted_at)}</span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.expiry")}>
                        <span>{record.expires_at ? formatDate(locale, record.expires_at) : t("ledger.noExpiry")}</span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.status")}>
                        <span>
                          <span className={STATUS_TAG[status]}>{t(`status.${status}`)}</span>
                        </span>
                      </td>
                      <td className={TD} data-label={t("ledger.columns.action")}>
                        <div>
                          {own && status === "active" ? (
                            <RevokeDialog
                              record={record}
                              recipientLabel={recipientText(record.recipient)}
                              scopeLabel={t(`scope.${record.scope}.label`)}
                              onRevoked={(updated) => recordChange(updated, "revoked")}
                              focusAfterRevoke={headingRef}
                            />
                          ) : own ? (
                            <span className="text-fg-3">{t("ledger.noAction")}</span>
                          ) : (
                            <span className="text-fg-3">{t("ledger.readOnly", { name: subjectName ? isolate(subjectName) : t("ledger.otherPerson") })}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 id="grant-title" className="mb-1 text-xl">
          {t("grant.heading")}
        </h2>
        <p className="measure mb-4 mt-0 text-fg-2">{t("grant.intro")}</p>
        <GrantForm
          coupleId={coupleId}
          viewerPersonId={viewerPersonId}
          partner={partner}
          firstFieldRef={firstFieldRef}
          onGranted={(record) => recordChange(record, "granted")}
        />
      </section>
    </div>
  );
}
