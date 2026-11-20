import { setRequestLocale } from "next-intl/server";
import { StaffInstrument } from "@/components/staff/StaffInstrument";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { readSession } from "@/lib/session";

/** The same instrument with this case selected: the brief and its trace open beside the queue. */
export default async function CounsellorBriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; coupleId: string }>;
  searchParams: Promise<{ briefLang?: string | string[] }>;
}) {
  const { locale, coupleId } = await params;
  const { briefLang } = await searchParams;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || (session.role !== "counsellor" && session.role !== "clinician")) return <NeedPersona role="counsellor" />;
  return <StaffInstrument selectedId={coupleId} role={session.role} briefLang={Array.isArray(briefLang) ? briefLang[0] : briefLang} />;
}
