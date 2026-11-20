import { getTranslations, setRequestLocale } from "next-intl/server";
import { HaemAid } from "@/components/haem/HaemAid";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { PageHeader } from "@/components/ui/states";
import { readSession } from "@/lib/session";

export default async function ClinicianPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || (session.role !== "clinician" && session.role !== "counsellor")) return <NeedPersona role="clinician" />;

  const t = await getTranslations("haem");
  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />
      <HaemAid />
    </div>
  );
}
