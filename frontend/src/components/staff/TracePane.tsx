import { useLocale, useTranslations } from "next-intl";
import type { ResultCategory } from "@/lib/api/types";
import { traceAnchor, type TraceEntry } from "@/lib/staff-brief";

function Stamps({ entry }: { entry: TraceEntry }) {
  const t = useTranslations("staff.trace");
  if (!entry.signoffPending && !entry.legalRead) return null;
  return (
    <span className="inst-stamps">
      {entry.signoffPending ? <span className="stamp">{t("signoff")}</span> : null}
      {entry.legalRead ? <span className="stamp">{t("legal")}</span> : null}
    </span>
  );
}

function EntryBody({ entry, coupleId }: { entry: TraceEntry; coupleId: string }) {
  const t = useTranslations("staff.trace");
  // API text (reason, source, the line itself) is English only: on an Arabic or Urdu page it is a left-to-right English run.
  const apiRun: { lang?: string; dir: "ltr" | "auto" } = useLocale() === "en" ? { dir: "auto" } : { lang: "en", dir: "ltr" };
  const tc = useTranslations("result.category");
  switch (entry.kind) {
    case "engine":
      return (
        <span>
          {t("engine")}
          {entry.text !== "" ? (
            <>
              {" · "}
              <bdi dir="ltr" className="font-mono">
                {entry.text}
              </bdi>
            </>
          ) : null}
          {entry.category !== undefined ? <> · {tc(entry.category as ResultCategory)}</> : null}
        </span>
      );
    case "rule":
      return (
        <>
          <span>
            {t("trigger")} <bdi dir="ltr" className="font-mono">{entry.ruleId}</bdi>
            {entry.tier !== undefined ? (
              <>
                {" · "}
                {t("tier")} <bdi dir="ltr" className="font-mono">{entry.tier}</bdi>
              </>
            ) : null}
            {entry.due !== undefined ? (
              <>
                {" · "}
                {t("due")} <bdi dir="ltr" className="font-mono">{entry.due}</bdi>
              </>
            ) : null}
          </span>
          {entry.reason !== undefined && entry.reason !== "" ? (
            <span {...apiRun} className="src">
              {entry.reason}
            </span>
          ) : null}
          {entry.source !== undefined && entry.source !== "" ? (
            <span {...apiRun} className="src">
              {t("source")}: <bdi>{entry.source}</bdi>
            </span>
          ) : null}
        </>
      );
    case "consent":
      return (
        <span>
          <bdi dir="ltr" className="font-mono">
            GET /v1/couples/{coupleId}/consents
          </bdi>
          {" · "}
          {t("consents", { count: String(entry.count ?? 0), policy: entry.policy ?? "" })}
        </span>
      );
    case "pathway":
      return (
        <span>
          <bdi dir="ltr" className="font-mono">
            GET /v1/couples/{coupleId}/pathway
          </bdi>
          {" · "}
          {t("pathway", { count: String(entry.count ?? 0), state: entry.state ?? "" })}
        </span>
      );
    default:
      return (
        <span {...apiRun} className="src">
          {entry.text}
        </span>
      );
  }
}

/** The trace pane: one entry per rule, record or engine line the brief cites, with its source and sign-off stamps. */
export function TracePane({ entries, coupleId }: { entries: readonly TraceEntry[] | null; coupleId: string | null }) {
  const t = useTranslations("staff.trace");
  const locale = useLocale();
  return (
    <section aria-labelledby="trace-title" data-testid="trace-pane">
      <div className="inst-h">
        <h2 id="trace-title" className="label m-0">
          {t("title")}
        </h2>
      </div>
      <p className="m-0">
        <span className="stamp">{t("rulesPending")}</span>
      </p>
      {entries === null || coupleId === null ? (
        <p className="inst-fine">{t("empty")}</p>
      ) : (
        <>
          {locale === "en" ? null : <p className="m-0 mt-2 text-sm font-semibold text-fg-2">{t("englishNote")}</p>}
        <ol className="inst-trace">
          {entries.map((entry) => (
            <li key={entry.id} id={traceAnchor(entry.id)} tabIndex={-1} data-trace-entry={entry.id}>
              <b>
                <bdi dir="ltr">{entry.id}</bdi>
              </b>
              <EntryBody entry={entry} coupleId={coupleId} />
              <Stamps entry={entry} />
            </li>
          ))}
        </ol>
        </>
      )}
      <p className="inst-fine">{t("footer")}</p>
    </section>
  );
}
