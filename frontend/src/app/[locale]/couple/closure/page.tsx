import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ClosureForm } from "@/components/closure/ClosureForm";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { EmptyState, ErrorState, PageHeader, PartialNotice } from "@/components/ui/states";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale } from "@/lib/api/types";
import { readSession } from "@/lib/session";

export default async function ClosurePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || session.role !== "couple_member" || !session.coupleId || !session.personId) return <NeedPersona role="couple" />;

  const t = await getTranslations("closure");
  const active = (await getLocale()) as Locale;
  const schema = await settle(() => serverApi().closureSchema(active));
  const header = <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />;

  if (schema.error) {
    return (
      <div>
        {header}
        <ErrorState problem={schema.error.problem} />
      </div>
    );
  }

  const { data } = schema;
  if (data.patient_items.length === 0) {
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
      <p className="measure mb-6 mt-0 text-sm text-fg-3">{t("syntheticNote")}</p>
      {data.service_interest.options.length === 0 ? <PartialNotice>{t("partial.service")}</PartialNotice> : null}
      <ClosureForm schema={data} coupleId={session.coupleId} personId={session.personId} />
    </div>
  );
}
