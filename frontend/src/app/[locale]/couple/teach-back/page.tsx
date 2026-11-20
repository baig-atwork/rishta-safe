import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { TeachBack } from "@/components/closure/TeachBack";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale } from "@/lib/api/types";
import { readSession } from "@/lib/session";

export default async function TeachBackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || session.role !== "couple_member" || !session.coupleId) return <NeedPersona role="couple" />;

  const coupleId = session.coupleId;
  const t = await getTranslations("quiz");
  const active = (await getLocale()) as Locale;
  const quiz = await settle(() => serverApi().teachback(coupleId, active));
  const header = <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />;

  if (quiz.error) {
    return (
      <div>
        {header}
        <ErrorState problem={quiz.error.problem} />
      </div>
    );
  }

  if (quiz.data.questions.length === 0) {
    return (
      <div>
        {header}
        <EmptyState title={t("empty.title")} body={t("empty.body")} actionHref="/couple" actionLabel={t("empty.cta")} />
      </div>
    );
  }

  return (
    <div>
      {header}
      <TeachBack quiz={quiz.data} coupleId={coupleId} locale={active} />
    </div>
  );
}
