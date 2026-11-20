import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ResultExperience } from "@/components/result/ResultExperience";
import { WithheldResult } from "@/components/result/ResultView";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { ErrorState, PageHeader } from "@/components/ui/states";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale } from "@/lib/api/types";
import { describeNext } from "@/lib/couple-next-text";
import { entryState } from "@/lib/couple-threshold";
import { planNextActions } from "@/lib/next-actions";
import { readSession } from "@/lib/session";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const { enter } = await searchParams;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || session.role !== "couple_member" || !session.coupleId) return <NeedPersona role="couple" />;

  const t = await getTranslations("result");
  const tp = await getTranslations("pathway");
  const tc = await getTranslations("couple");
  const active = (await getLocale()) as Locale;
  const api = serverApi();
  const coupleId = session.coupleId;
  const [result, pathway, couple] = await Promise.all([
    settle(() => api.result(coupleId, active)),
    settle(() => api.pathway(coupleId)),
    settle(() => api.couple(coupleId)),
  ]);

  if (result.error) {
    return (
      <div>
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
        <ErrorState problem={result.error.problem} />
      </div>
    );
  }

  const entry = entryState(result.data.disclosed);
  // The server decided to hold the result back (counselling first, partner has not agreed): show its withheld document.
  if (entry === "withheld") return <WithheldResult envelope={result.data} />;

  // Only metadata crosses to the browser here: no result text until the person chooses (ResultExperience).
  const plan = pathway.data ? planNextActions(pathway.data, session.role) : null;
  const next = plan
    ? describeNext(plan, active, { pathway: tp, couple: tc })
    : { kind: "none" as const, heading: t("next.none"), body: t("next.noneBody"), event: null };
  const counselling = pathway.data?.states.find((s) => s.key === "counselling");
  const counsellingStep = counselling ? `${counselling.label ?? tp(`state.${counselling.key}`)} (${tp(`status.${counselling.status}`)})` : null;

  return (
    <ResultExperience
      coupleId={coupleId}
      personaId={session.personaId}
      viewerPersonId={session.personId}
      locale={active}
      partners={couple.data?.partners ?? null}
      entry={entry}
      enterNow={enter === "now"}
      counsellingStep={counsellingStep}
      next={{ heading: next.heading, body: next.body, advanceEvent: next.event }}
    />
  );
}
