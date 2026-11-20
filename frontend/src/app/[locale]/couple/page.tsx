import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { AdvanceButton } from "@/components/pathway/AdvanceButton";
import { buildTrackerItems } from "@/components/pathway/items";
import { PathwayCells } from "@/components/pathway/PathwayCells";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { ErrorState, PageHeader, PartialNotice } from "@/components/ui/states";
import { Link } from "@/i18n/navigation";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale, NextActionOption } from "@/lib/api/types";
import { actionLabel, describeNext } from "@/lib/couple-next-text";
import { givenName } from "@/lib/names";
import { planNextActions } from "@/lib/next-actions";
import { readSession } from "@/lib/session";

const LINKS = ["sharing", "closure", "teachback"] as const;
const LINK_HREF: Record<(typeof LINKS)[number], string> = {
  sharing: "/couple/sharing",
  closure: "/couple/closure",
  teachback: "/couple/teach-back",
};

export default async function CoupleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || session.role !== "couple_member" || !session.coupleId) return <NeedPersona role="couple" />;

  const t = await getTranslations("couple");
  const tp = await getTranslations("pathway");
  const th = await getTranslations("home");
  const active = (await getLocale()) as Locale;
  const api = serverApi();
  const [pathway, couple] = await Promise.all([settle(() => api.pathway(session.coupleId!)), settle(() => api.couple(session.coupleId!))]);
  const name = givenName(session.name);

  if (pathway.error) {
    return (
      <div>
        <PageHeader eyebrow={t("eyebrow")} title={t("title", { name })} />
        <ErrorState problem={pathway.error.problem} />
      </div>
    );
  }

  const view = pathway.data;
  const items = buildTrackerItems(view, active, (key, values) => tp(key, values));
  const plan = planNextActions(view, session.role);
  const next = describeNext(plan, active, { pathway: tp, couple: t });
  const partner = couple.data?.partners.find((p) => p.person_id !== session.personId);
  const branchLabel = (option: NextActionOption): string => actionLabel(option, tp);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title", { name })} standfirst={t("standfirst")} />
      {couple.error ? <PartialNotice>{t("partialCouple")}</PartialNotice> : null}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="tracker-title" className="order-2 lg:order-1">
          <h2 id="tracker-title" className="mb-2 text-xl">
            {t("trackerTitle")}
          </h2>
          <p className="measure mb-6 mt-0 text-sm text-fg-3">{tp("simulatedStep")}</p>
          <PathwayCells items={items} label={t("trackerLabel")} />
        </section>
        <div className="order-1 grid content-start gap-6 lg:order-2">
          <section aria-labelledby="result-entry-title" className="grid gap-3 border border-line-strong p-5" data-testid="result-entry">
            <h2 id="result-entry-title" className="m-0 text-xl">
              {th("resultTitle")}
            </h2>
            <p className="m-0 text-fg-2">{th("resultBody")}</p>
            <p className="m-0">
              <Link href="/couple/result" className="btn btn-primary">
                {th("resultCta")}
              </Link>
            </p>
          </section>
          <section aria-labelledby="next-title" className="grid gap-3 border border-line-strong p-5">
            <p className="label m-0">{t("nextEyebrow")}</p>
            <h2 id="next-title" className="m-0 text-xl">
              {next.heading}
            </h2>
            {next.body ? <p className="m-0 text-fg-2">{next.body}</p> : null}
            {next.event ? (
              <div>
                <p className="label mb-2">{th("simulatedLabel")}</p>
                <AdvanceButton coupleId={view.couple_id} event={next.event} />
              </div>
            ) : null}
            {plan.branches.length > 0 ? (
              <details className="border-t border-line pt-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{t("other.title")}</summary>
                <p className="mt-1 text-sm text-fg-3">{t("other.note")}</p>
                <ul className="m-0 mt-3 grid list-none gap-3 p-0">
                  {plan.branches.map((option) =>
                    option.event ? (
                      <li key={option.key}>
                        <AdvanceButton coupleId={view.couple_id} event={option.event} label={branchLabel(option)} variant="secondary" showNote={false} />
                      </li>
                    ) : null,
                  )}
                </ul>
              </details>
            ) : null}
          </section>
          <section aria-labelledby="go-title" className="grid gap-2">
            <h2 id="go-title" className="label m-0">
              {th("links")}
            </h2>
            <ul className="m-0 grid list-none gap-0 border-t border-line p-0">
              {LINKS.map((key) => (
                <li key={key} className="border-b border-line">
                  <Link href={LINK_HREF[key]} className="flex min-h-11 flex-col justify-center py-2 no-underline hover:underline">
                    <span className="font-semibold">{t(`links.${key}.title`)}</span>
                    <span className="text-sm text-fg-2">{t(`links.${key}.body`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {partner ? <p className="m-0 text-sm text-fg-3">{t("partnerNote", { name: givenName(partner.display_name) })}</p> : null}
        </div>
      </div>
    </div>
  );
}
