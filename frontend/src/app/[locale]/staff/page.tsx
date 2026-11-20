import { setRequestLocale } from "next-intl/server";
import { StaffInstrument } from "@/components/staff/StaffInstrument";
import { sortEscalations } from "@/components/staff/queue";
import { NeedPersona } from "@/components/ui/NeedPersona";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, routing } from "@/i18n/routing";
import { serverApi, settle } from "@/lib/api/server";
import { readSession } from "@/lib/session";

/**
 * The review queue with no case selected. When the queue has cases this redirects to the first one (the queue stays on
 * the left and its brief opens beside it, so no pane is ever blank). Only an empty or unreadable queue renders here, with
 * its own empty state or error.
 */
export default async function StaffQueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readSession();
  if (!session || (session.role !== "counsellor" && session.role !== "clinician")) return <NeedPersona role="counsellor" />;
  const queue = await settle(() => serverApi().escalations());
  const first = queue.data === null ? undefined : sortEscalations(queue.data)[0];
  if (first !== undefined) {
    redirect({ href: `/staff/couples/${encodeURIComponent(first.couple_id)}`, locale: isAppLocale(locale) ? locale : routing.defaultLocale });
  }
  return <StaffInstrument selectedId={null} role={session.role} />;
}
