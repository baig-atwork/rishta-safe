import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { AuditTrail } from "@/components/consent/AuditTrail";
import { RntkStatusLine } from "@/components/consent/RntkStatusLine";
import { LedgerDetails } from "@/components/consent/LedgerDetails";
import { VisibilityMatrix } from "@/components/consent/VisibilityMatrix";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { RetryButton } from "@/components/ui/RetryButton";
import { ErrorState, PageHeader, PartialNotice } from "@/components/ui/states";
import type { ApiError } from "@/lib/api/transport";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale } from "@/lib/api/types";
import { givenName } from "@/lib/names";
import { readSession } from "@/lib/session";

/** The problem title and correlation id, inline, so a partial notice says what failed and what support can look up. */
function ProblemText({ error }: { error: ApiError }) {
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

export default async function SharingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || session.role !== "couple_member" || !session.coupleId || !session.personId) return <NeedPersona role="couple" />;

  const t = await getTranslations("sharing");
  const active = (await getLocale()) as Locale;
  const api = serverApi();
  const coupleId = session.coupleId;
  const personId = session.personId;
  const [consents, audit, couple, result] = await Promise.all([
    settle(() => api.consents(coupleId)),
    settle(() => api.audit(coupleId)),
    settle(() => api.couple(coupleId)),
    settle(() => api.result(coupleId, active)),
  ]);

  const sharingFailure = consents.error ?? couple.error;
  const partner = couple.data?.partners.find((p) => p.person_id !== personId) ?? null;
  const policyKey = couple.data?.policy ?? null;
  // The right-not-to-know state is the server's: the result read says whether it is on record for this viewer.
  const rntkActive = result.data ? result.data.disclosed.withheld_reason_key === "right_not_to_know" : null;

  const header = (
    <PageHeader
      eyebrow={policyKey ? t("matrix.eyebrow", { policy: t(`matrix.policy.${policyKey}`) }) : t("eyebrow")}
      title={partner ? t("matrix.title", { name: givenName(partner.display_name) }) : t("title")}
      standfirst={t("matrix.intro")}
    />
  );

  if (sharingFailure && audit.error) {
    return (
      <div>
        {header}
        <ErrorState problem={sharingFailure.problem} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {header}
      {sharingFailure ? (
        <div className="grid gap-2">
          <PartialNotice>
            {t("partial.sharing")} <ProblemText error={sharingFailure} />
          </PartialNotice>
          <RetryButton label={t("partial.retry")} />
        </div>
      ) : null}
      {consents.data && couple.data && partner && policyKey ? (
        <VisibilityMatrix coupleId={coupleId} meId={personId} partner={partner} initialConsents={consents.data} policy={policyKey} />
      ) : consents.data && couple.data ? (
        <PartialNotice>{t("matrix.partnerMissing")}</PartialNotice>
      ) : null}

      <RntkStatusLine coupleId={coupleId} active={rntkActive} />

      {audit.error ? (
        <div className="grid gap-2" id="audit">
          <PartialNotice>
            {t("partial.audit")} <ProblemText error={audit.error} />
          </PartialNotice>
          <RetryButton label={t("partial.retry")} />
        </div>
      ) : audit.data ? (
        <AuditTrail initialEvents={audit.data} coupleId={coupleId} locale={active} />
      ) : null}

      {consents.data && couple.data ? (
        <LedgerDetails initialConsents={consents.data} viewerPersonId={personId} partners={couple.data.partners} coupleId={coupleId} locale={active} />
      ) : null}
    </div>
  );
}
