import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState, ErrorState, PartialNotice } from "@/components/ui/states";
import { serverApi, settle } from "@/lib/api/server";
import type { Locale } from "@/lib/api/types";
import { buildBriefView, clockMs, staffVerbs, waitingOf } from "@/lib/staff-brief";
import { BriefActions } from "./BriefActions";
import { BriefEmpty, BriefPane } from "./BriefPane";
import { InstrumentLayout } from "./InstrumentLayout";
import { ProformaPanel } from "./ProformaPanel";
import { QueuePane, type QueueRow } from "./QueuePane";
import { sortEscalations } from "./queue";
import { TracePane } from "./TracePane";

const BRIEF_LOCALES: readonly Locale[] = ["en", "ar", "ur"];

/**
 * /staff and /staff/couples/[id] are one instrument: the queue is always there, the selected case fills the brief and
 * trace panes. Every pane has its own four states, so a failed brief leaves the queue usable. Reads only: opening a
 * case never writes (the backend guarantees the brief is a pure read).
 */
export async function StaffInstrument({
  selectedId,
  role,
  briefLang,
}: {
  selectedId: string | null;
  role: string;
  briefLang?: string | undefined;
}) {
  const t = await getTranslations("staff");
  const active = (await getLocale()) as Locale;
  const briefLocale = BRIEF_LOCALES.find((code) => code === briefLang) ?? active;
  const api = serverApi();

  const [queueResult, briefResult, pathwayResult, schemaResult] = await Promise.all([
    settle(() => api.escalations()),
    selectedId === null ? null : settle(() => api.brief(selectedId, briefLocale)),
    selectedId === null ? null : settle(() => api.pathway(selectedId)),
    selectedId === null ? null : settle(() => api.closureSchema(active)),
  ]);

  let queue: React.ReactNode;
  if (queueResult.error) {
    queue = (
      <section aria-labelledby="queue-title">
        <div className="inst-h">
          <h1 id="queue-title">{t("queue.title")}</h1>
        </div>
        <ErrorState problem={queueResult.error.problem} />
      </section>
    );
  } else if (queueResult.data.length === 0) {
    queue = (
      <section aria-labelledby="queue-title">
        <div className="inst-h">
          <h1 id="queue-title">{t("queue.title")}</h1>
        </div>
        <EmptyState title={t("queue.empty.title")} body={t("queue.empty.body")} actionHref="/governance" actionLabel={t("queue.empty.cta")} />
      </section>
    );
  } else {
    const now = clockMs();
    const rows: QueueRow[] = sortEscalations(queueResult.data).map((item) => ({
      coupleId: item.couple_id,
      label: item.couple_label,
      priority: item.review_priority,
      ruleId: item.decisions[0]?.rule_id ?? null,
      moreRules: Math.max(0, item.decisions.length - 1),
      waiting: waitingOf(item.raised_at, now),
    }));
    queue = <QueuePane rows={rows} selectedId={selectedId} />;
  }

  let brief: React.ReactNode = <BriefEmpty />;
  let trace: React.ReactNode = <TracePane entries={null} coupleId={null} />;
  if (selectedId !== null && briefResult !== null) {
    if (briefResult.error) {
      brief = (
        <section aria-labelledby="brief-title">
          <div className="inst-h">
            <h2 id="brief-title">
              {t("brief.title")} ·{" "}
              <bdi dir="ltr" className="font-mono">
                {selectedId}
              </bdi>
            </h2>
          </div>
          <ErrorState problem={briefResult.error.problem} />
        </section>
      );
    } else {
      const data = briefResult.data;
      const view = buildBriefView(data);
      const verbs = pathwayResult !== null && pathwayResult.data !== null ? staffVerbs(pathwayResult.data, role) : [];
      const proforma =
        schemaResult === null || schemaResult.error ? (
          <PartialNotice>{t("brief.partial")}</PartialNotice>
        ) : (
          <ProformaPanel
            coupleId={data.couple_id}
            fields={schemaResult.data.proforma_fields}
            draft={active !== "en" && schemaResult.data.language_status === "draft"}
          />
        );
      brief = (
        <BriefPane
          brief={data}
          view={view}
          locale={active}
          briefLocale={briefLocale}
          actions={
            <>
              {pathwayResult !== null && pathwayResult.error ? <PartialNotice>{t("brief.partialPathway")}</PartialNotice> : null}
              <BriefActions coupleId={data.couple_id} verbs={verbs} proforma={proforma} />
            </>
          }
        />
      );
      trace = <TracePane entries={view.entries} coupleId={data.couple_id} />;
    }
  }

  return <InstrumentLayout queue={queue} brief={brief} trace={trace} />;
}
