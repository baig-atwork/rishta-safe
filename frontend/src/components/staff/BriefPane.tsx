import { useTranslations } from "next-intl";
import { CategoryChip } from "@/components/result/CategoryChip";
import { Link } from "@/i18n/navigation";
import type { CounsellorBrief, Locale, ReferralTask } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { traceAnchor, type BriefView } from "@/lib/staff-brief";
import { PriorityTag } from "./PriorityTag";
import { TraceChip } from "./TraceChip";

const TASK_TONE: Record<ReferralTask["status"], string> = {
  requested: "",
  accepted: "",
  "in-progress": "",
  completed: "tag-ok",
  rejected: "tag-attention",
  failed: "tag-attention",
  cancelled: "",
  "on-hold": "",
};

const LANG_CODES: readonly Locale[] = ["en", "ar", "ur"];

function isLocale(code: string): code is Locale {
  return (LANG_CODES as readonly string[]).includes(code);
}

/**
 * API text (rule wording, sources, detection statements) exists only in English. On an Arabic or Urdu page it sits in a run
 * marked lang="en" dir="ltr", so the sentence reads left to right as a unit and a Latin id never scrambles the line around
 * it; on an English page it is plain text.
 */
function ApiText({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return locale === "en" ? <span>{children}</span> : <span lang="en" dir="ltr">{children}</span>;
}

function humanise(key: string): string {
  return key.replace(/_/g, " ");
}

/** The brief pane for the selected case: key/value block, the API's sections with a trace chip on every line, then actions. */
export function BriefPane({
  brief,
  view,
  locale,
  briefLocale,
  actions,
}: {
  brief: CounsellorBrief;
  view: BriefView;
  locale: Locale;
  briefLocale: Locale;
  actions: React.ReactNode;
}) {
  const t = useTranslations("staff.brief");
  const members = brief.members ?? [];
  const languages = [...new Set(members.map((m) => m.language))].filter(isLocale);
  const engineId = view.entries[0]?.id ?? "R1";
  const caveat = brief.detection.some((d) => d.related_couple_caveat);
  const withHistory = members.filter((m) => m.family_history.length > 0);

  return (
    <section aria-labelledby="brief-title" data-testid="brief-pane">
      <div className="inst-h">
        <h2 id="brief-title">
          {t("title")} ·{" "}
          <bdi dir="ltr" className="font-mono">
            {brief.couple_id}
          </bdi>
        </h2>
        <CategoryChip category={brief.category} size="sm" />
        <span className="stamp">{t("stamps.synthetic")}</span>
      </div>

      <dl className="inst-kv">
        <dt>{t("meta.couple")}</dt>
        <dd>
          {members.length === 0 ? (
            t("noMembers")
          ) : (
            <>
              {members.map((m, i) => (
                <span key={`${m.display_name}-${i}`} className="block">
                  <bdi>{m.display_name}</bdi>
                  {m.age !== null ? (
                    <>
                      {" "}
                      <bdi dir="ltr" className="text-fg-3">
                        ({m.age})
                      </bdi>
                    </>
                  ) : null}
                </span>
              ))}
              <span className="block text-fg-2">{t(`relationship.${brief.relationship}`)}</span>
            </>
          )}
        </dd>
        <dt>{t("meta.languages")}</dt>
        <dd>
          {members.length === 0
            ? t("noMembers")
            : members.map((m, i) => (
                <span key={`${m.display_name}-${i}`}>
                  {i > 0 ? " · " : null}
                  {isLocale(m.language) ? t(`langName.${m.language}`) : <bdi dir="ltr">{m.language}</bdi>}
                </span>
              ))}
          {languages.length > 1 ? (
            <span className="mt-1 block">
              <span className="text-fg-3">{t("meta.briefIn")}: </span>
              {languages.map((code) => (
                <Link
                  key={code}
                  href={`/staff/couples/${encodeURIComponent(brief.couple_id)}?briefLang=${code}`}
                  className="inst-lang-link"
                  aria-current={code === briefLocale ? "true" : undefined}
                  lang={code}
                >
                  {t(`langName.${code}`)}
                </Link>
              ))}
            </span>
          ) : null}
        </dd>
        {brief.emirate_policy !== undefined ? (
          <>
            <dt>{t("meta.rule")}</dt>
            <dd>
              {brief.emirate_policy === "abu_dhabi" || brief.emirate_policy === "dubai" ? (
                t(`policy.${brief.emirate_policy}`)
              ) : (
                <bdi dir="ltr">{brief.emirate_policy}</bdi>
              )}
            </dd>
          </>
        ) : null}
        <dt>{t("meta.pathway")}</dt>
        <dd>
          {brief.pathway_state !== undefined ? (
            <bdi dir="ltr" className="block font-mono">
              {brief.pathway_state}
            </bdi>
          ) : null}
          <PriorityTag priority={brief.review_priority} />
        </dd>
        <dt>{t("meta.family")}</dt>
        <dd>
          {withHistory.length > 0
            ? withHistory.map((m, i) => (
                <span key={`${m.display_name}-${i}`} className="block">
                  <bdi>{m.display_name}</bdi>{" "}
                  <bdi dir="ltr">{m.family_history.map(humanise).join(", ")}</bdi>
                </span>
              ))
            : t("noHistory")}
        </dd>
      </dl>

      {view.sections.length === 0 ? <p className="text-sm text-fg-3">{t("sectionsNone")}</p> : null}
      {locale !== "en" && view.sections.length > 0 ? <p className="m-0 mb-1 text-sm font-semibold text-fg-2">{t("englishNote")}</p> : null}
      {view.sections.map((section) => (
        <div key={section.key} className="inst-sec" data-section={section.key}>
          <h3>{t.has(`section.${section.key}`) ? t(`section.${section.key}`) : section.title}</h3>
          <ul data-many={section.lines.length > 1 ? "true" : undefined}>
            {section.lines.map((line, index) => (
              <li key={`${index}-${line.text}`}>
                <ApiText locale={locale}>{line.text}</ApiText>
                <TraceChip id={line.chipId} href={`#${traceAnchor(line.chipId)}`} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {brief.detection.length > 0 ? (
        <div className="inst-sec" data-section="detection">
          <h3>{t("detection.title")}</h3>
          <ul data-many={brief.detection.length > 1 ? "true" : undefined}>
            {brief.detection.map((d) => (
              <li key={`${d.panel_id}-${d.statement_key}`}>
                <ApiText locale={locale}>{d.detection_rate_label}</ApiText>
                {d.assumed ? <span className="tag ms-2 font-normal">{t("detection.assumed")}</span> : null}
                <TraceChip id={engineId} href={`#${traceAnchor(engineId)}`} />
              </li>
            ))}
          </ul>
          {caveat ? (
            <p className="mt-2 border-s-4 border-line-strong ps-3 text-fg-2">
              <strong className="block font-semibold">{t("detection.caveatTitle")}</strong>
              {t("detection.caveat")}
            </p>
          ) : null}
        </div>
      ) : null}

      {brief.referral_tasks.length > 0 ? (
        <div className="inst-sec" data-section="referrals">
          <h3>{t("referrals.title")}</h3>
          <table className="data-table">
            <caption className="sr-only">{t("referrals.caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("referrals.destination")}</th>
                <th scope="col">{t("referrals.status")}</th>
                <th scope="col">{t("referrals.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {brief.referral_tasks.map((task) => (
                <tr key={task.task_id}>
                  <td>
                    <bdi>{task.destination}</bdi>
                    <code className="inst-id ltr-run">
                      <bdi dir="ltr">{task.task_id}</bdi>
                    </code>
                  </td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`tag ${TASK_TONE[task.status]}`}>{t(`taskStatus.${task.status}`)}</span>
                      {task.simulated ? <span className="tag font-normal">{t("referrals.simulated")}</span> : null}
                    </span>
                  </td>
                  <td>
                    <bdi>{formatDateTime(locale, task.last_modified)}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {actions}

      <p className="inst-fine">{t("notice.body")}</p>
    </section>
  );
}

/** Shown in the brief pane when no case is selected. */
export function BriefEmpty() {
  const t = useTranslations("staff.brief");
  return (
    <section aria-labelledby="brief-empty-title" data-testid="brief-pane">
      <div className="inst-h">
        <h2 id="brief-empty-title">{t("emptyTitle")}</h2>
      </div>
      <p className="max-w-prose text-fg-2">{t("empty")}</p>
    </section>
  );
}
