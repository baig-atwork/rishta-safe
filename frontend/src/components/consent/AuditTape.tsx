"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Cell } from "@/components/grid/Cell";
import { Link, usePathname } from "@/i18n/navigation";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { AuditEvent, AuditVerification } from "@/lib/api/types";

/** Western digits and the Gregorian calendar in every locale, like lib/format.ts, in the short form the tape needs. */
function shortWhen(locale: string, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn-ca-gregory`, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

/**
 * The 36 px audit tape, sticky to the bottom of every couple route. It shows the last two events of the couple's audit
 * log and, at the end of the reading line, whether the hash chain verifies. Both come from the existing endpoints
 * (GET /v1/couples/{id}/audit, GET /v1/audit/verify) through the same query key the audit table uses, so a consent
 * change refreshes the tape. Clicking it opens the audit table on the sharing page. Four states: a thin skeleton, "no
 * events yet", "audit unavailable, retry", and events with the chain "not checked" when only verification failed.
 */
export function AuditTape({ coupleId }: { coupleId: string }) {
  const t = useTranslations("shell.tape");
  const locale = useLocale();
  const pathname = usePathname();
  const onCoupleRoute = pathname === "/couple" || pathname.startsWith("/couple/");

  const audit = useQuery<AuditEvent[], ApiError>({
    queryKey: ["audit", coupleId],
    queryFn: () => clientApi.audit(coupleId),
    staleTime: 60_000,
    enabled: onCoupleRoute,
  });
  const count = audit.data?.length ?? 0;
  // Re-verify whenever the log length changes, so the status never describes an older log.
  const verify = useQuery<AuditVerification, ApiError>({
    queryKey: ["audit-verify", coupleId, count],
    queryFn: () => clientApi.verifyAudit(),
    enabled: onCoupleRoute && audit.isSuccess,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (!onCoupleRoute) return null;

  const newest = [...(audit.data ?? [])].sort((a, b) => b.index - a.index).slice(0, 2);

  if (audit.isError) {
    return (
      <aside className="tape" aria-label={t("region")}>
        <div className="wrap">
          <span className="label">{t("label")}</span>
          <span className="tape-bad">{t("unavailable")}</span>
          <button type="button" className="btn btn-link text-xs" onClick={() => void audit.refetch()}>
            {t("retry")}
          </button>
        </div>
      </aside>
    );
  }

  // The one real link sits at the reading end. A stretched ::after (globals.css) makes the whole bar clickable with the
  // pointer, while only this small box is a target (a full-width link would overlap whatever scrolls beneath the bar).
  let chain: React.ReactNode = <span className="skeleton inline-block h-3 w-24" aria-hidden="true" />;
  let chainClass = "tape-ok";
  let chainName: string = t("open");
  if (verify.isError) {
    chain = t("notChecked");
    chainClass = "tape-ok tape-muted";
    chainName = t("notChecked");
  } else if (verify.data) {
    const n = verify.data.own_events ?? verify.data.length ?? count;
    if (verify.data.ok) {
      chain = (
        <>
          <Cell fill="solid" />
          {t("verified", { count: n })}
        </>
      );
      chainName = t("verified", { count: n });
    } else {
      chain = (
        <>
          <Cell fill="hatch" />
          {t("failed", { index: verify.data.first_bad_index ?? 0 })}
        </>
      );
      chainClass = "tape-ok tape-bad";
      chainName = t("failed", { index: verify.data.first_bad_index ?? 0 });
    }
  }

  return (
    <aside className="tape" aria-label={t("region")}>
      <div className="wrap" aria-busy={audit.isPending}>
        <span className="label">{t("label")}</span>
        {audit.isPending ? (
          <span className="skeleton inline-block h-3 w-48" aria-hidden="true" />
        ) : newest.length === 0 ? (
          <span className="fg3">{t("none")}</span>
        ) : (
          newest.map((event, i) => (
            <span key={event.event_id} className={`ev${i > 0 ? " x" : ""}`}>
              <span className="mono ltr">
                #{event.index} {event.action}
              </span>
              <span className="when">
                {" · "}
                <bdi>{shortWhen(locale, event.at)}</bdi>
              </span>
            </span>
          ))
        )}
        <Link href="/couple/sharing#audit" className={`tape-link ${chainClass}`} aria-label={chainName}>
          {chain}
        </Link>
      </div>
    </aside>
  );
}
