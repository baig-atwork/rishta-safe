import { useLocale, useTranslations } from "next-intl";
import { startSession } from "@/app/[locale]/actions";
import { startLensAt } from "@/app/[locale]/demo/actions";
import "./bench.css";
import { ScrollRegion } from "@/components/evidence/ScrollRegion";
import { Cell, type CellFill } from "@/components/grid/Cell";
import { givenName } from "@/lib/names";
import {
  buildBenchRows,
  staffLenses,
  type BenchPersona,
  type BenchRow,
  type DemoCase,
  type LensTarget,
} from "@/lib/public-bench";

export interface CaseBenchProps {
  cases: readonly DemoCase[];
  /** Token-free personas (see toBenchPersona). */
  personas: readonly BenchPersona[];
  /**
   * The Lens dialog's compact variant: the case, the two partner lenses, and the lenses that are not tied to a case.
   * No staff-per-case columns, no skip links.
   */
  compact?: boolean;
  /** The cases loaded but the personas did not: every lens cell reads "Lens unavailable". */
  personasFailed?: boolean;
}

interface LensButtonProps {
  persona: BenchPersona;
  locale: string;
  fill: CellFill;
  dashed?: boolean;
  label: string;
  ariaLabel: string;
  /** Home: the shared startSession action. Anything else: startLensAt with this target. */
  target: LensTarget;
  /** `data-persona-id` is for the page's own unique cells (e2e signInAs); the dialog uses `data-lens-persona` only. */
  pageUnique?: boolean;
  small?: boolean;
}

/**
 * One lens cell: a real button in a form, so it starts the session server-side (the token never reaches the browser) and
 * works without client JavaScript. Every lens cell carries `data-lens-persona`.
 */
function LensButton({ persona, locale, fill, dashed = false, label, ariaLabel, target, pageUnique = false, small = false }: LensButtonProps) {
  const action = target.kind === "home" ? startSession.bind(null, persona.id, locale) : startLensAt.bind(null, persona.id, locale, target);
  return (
    <form action={action} className="m-0">
      <button
        type="submit"
        data-lens-persona={persona.id}
        data-persona-id={pageUnique ? persona.id : undefined}
        data-case-target={target.kind === "home" ? undefined : target.kind}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-2 text-start font-semibold text-link hover:underline ${small ? "min-h-6 text-xs" : "min-h-10 text-sm"}`}
      >
        <Cell fill={fill} dashed={dashed} tone={fill === "solid" ? "accent" : undefined} />
        <span>{label}</span>
      </button>
    </form>
  );
}

function Unavailable() {
  const t = useTranslations("demo");
  return <span className="inline-flex items-center gap-2 text-xs text-fg-3">
    <Cell fill="open" dashed />
    {t("unavailable")}
  </span>;
}

function StaffBlock({ personas, locale, failed, compact }: { personas: readonly BenchPersona[]; locale: string; failed: boolean; compact: boolean }) {
  const t = useTranslations("demo");
  const lenses = staffLenses(personas);
  return (
    <section aria-labelledby="bench-not-tied" className="mb-6">
      <h2 id="bench-not-tied" className="label m-0 mb-1">
        {t("notTied.title")}
      </h2>
      <p className="m-0 mb-2 text-sm text-fg-2">{t("notTied.body")}</p>
      {failed || lenses.length === 0 ? (
        <Unavailable />
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0">
          {lenses.map(({ role, persona }) => (
            <li key={persona.id}>
              <LensButton
                persona={persona}
                locale={locale}
                fill="hatch"
                label={t(`staff.${role}`)}
                ariaLabel={t("openLens", { label: t(`staff.${role}`), name: persona.display_name })}
                target={{ kind: "home" }}
                pageUnique={!compact}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The one action a first-time visitor needs: open the flagship case as its first partner, on the result with the choice
 * skipped. The case and the partner come from the rows the API produced; nothing is hard-coded.
 */
function Flagship({ row, locale }: { row: BenchRow; locale: string }) {
  const t = useTranslations("demo");
  const partner = row.partners[0];
  if (!partner) return null;
  return (
    <section aria-labelledby="bench-flagship" className="mb-8 grid gap-3 border border-line bg-surface-raised p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8" data-testid="flagship">
      <div className="grid gap-1">
        <h2 id="bench-flagship" className="m-0 text-lg font-semibold">
          {t("flagship.title")}
        </h2>
        <p className="m-0 max-w-[60ch] text-sm text-fg-2">{t("flagship.body", { n: row.n, title: row.title, name: partner.display_name })}</p>
      </div>
      <form action={startLensAt.bind(null, partner.id, locale, { kind: "result_now" })} className="m-0">
        <button type="submit" className="btn btn-primary" data-flagship={row.coupleId}>
          {t("flagship.cta")}
        </button>
      </form>
    </section>
  );
}

function CaseHeader({ row, compact }: { row: BenchRow; compact: boolean }) {
  const t = useTranslations("demo");
  return (
    <th scope="row" className="min-w-[16rem] max-w-[26rem] whitespace-normal py-3 pe-4 text-start align-top font-sans text-sm font-normal normal-case tracking-normal text-fg">
      <span className="flex items-baseline gap-2">
        <span className="mono ltr text-xs text-fg-3">{String(row.n).padStart(2, "0")}</span>
        <span className="font-semibold">{row.title}</span>
      </span>
      {row.startHere ? <span className="stamp ms-8 mt-1 w-fit">{t("startHere")}</span> : null}
      {compact ? null : <span className="ms-8 mt-1 block text-xs leading-snug text-fg-3">{row.summary}</span>}
    </th>
  );
}

/**
 * The Case bench: ten seeded cases, each listed by what it tests, crossed with the roles that can open it. A cell opens
 * that case as that person. The programme column is open on purpose: that lens never sees one case. Server component:
 * every cell is a form with a server action, and the personas it receives carry no tokens.
 */
export function CaseBench({ cases, personas, compact = false, personasFailed = false }: CaseBenchProps) {
  const t = useTranslations("demo");
  const tr = useTranslations("roles");
  const locale = useLocale();
  const rows = buildBenchRows(cases, personas);
  const lensDown = personasFailed || personas.length === 0;
  const flagship = compact || lensDown ? undefined : rows.find((row) => row.startHere);

  return (
    <div data-testid={compact ? "case-bench-compact" : "case-bench"}>
      {compact ? <p className="m-0 mb-4 text-sm text-fg-2">{t("compactHint")}</p> : null}
      {flagship ? <Flagship row={flagship} locale={locale} /> : null}
      <StaffBlock personas={personas} locale={locale} failed={lensDown} compact={compact} />
      {lensDown ? (
        <p role="status" className="m-0 mb-4 text-sm text-fg-2">
          {t("partial")}
        </p>
      ) : null}
      {compact ? null : (
        <details className="bench-rules mb-2">
          <summary>{t("showRules")}</summary>
        </details>
      )}
      <ScrollRegion label={t("caption")}>
        <table className="tbl min-w-[720px]">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("col.case")}</th>
              {compact ? null : (
                <th scope="col" className="bench-rule-col">
                  {t("col.rule")}
                </th>
              )}
              <th scope="col">{t("col.p1")}</th>
              <th scope="col">{t("col.p2")}</th>
              {compact ? null : (
                <>
                  <th scope="col">{t("col.counsellor")}</th>
                  <th scope="col">{t("col.clinician")}</th>
                  <th scope="col">{t("col.programme")}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.coupleId} className="align-top" data-case={row.coupleId}>
                <CaseHeader row={row} compact={compact} />
                {compact ? null : (
                  <td className="bench-rule-col mono ltr whitespace-nowrap py-3 text-xs text-fg-2">
                    {row.policy} · {row.relationship}
                  </td>
                )}
                {row.partners.map((partner, index) => (
                  <td key={index} className="py-2 align-top">
                    {partner === null || lensDown ? (
                      <Unavailable />
                    ) : (
                      <div className="grid gap-0.5">
                        <LensButton
                          persona={partner}
                          locale={locale}
                          fill="solid"
                          label={givenName(partner.display_name)}
                          ariaLabel={t("openAs", { n: row.n, name: partner.display_name })}
                          target={{ kind: "home" }}
                          pageUnique={!compact}
                        />
                        {compact ? null : (
                          <LensButton
                            persona={partner}
                            locale={locale}
                            fill="open"
                            dashed
                            label={t("skip")}
                            ariaLabel={t("skipFor", { label: t("skip"), n: row.n, name: partner.display_name })}
                            target={{ kind: "result_now" }}
                            small
                          />
                        )}
                      </div>
                    )}
                  </td>
                ))}
                {compact ? null : (
                  <>
                    <td className="py-2 align-top">
                      {row.counsellor && !lensDown ? (
                        <LensButton
                          persona={row.counsellor}
                          locale={locale}
                          fill="hatch"
                          label={t("cell.brief")}
                          ariaLabel={t("openStaff", { label: t("cell.brief"), n: row.n, role: tr("counsellor") })}
                          target={{ kind: "staff_case", coupleId: row.coupleId }}
                        />
                      ) : (
                        <Unavailable />
                      )}
                    </td>
                    <td className="py-2 align-top">
                      {row.clinician && !lensDown ? (
                        <LensButton
                          persona={row.clinician}
                          locale={locale}
                          fill="hatch"
                          label={t("cell.record")}
                          ariaLabel={t("openStaff", { label: t("cell.record"), n: row.n, role: tr("clinician") })}
                          target={{ kind: "clinician_case", coupleId: row.coupleId }}
                        />
                      ) : (
                        <Unavailable />
                      )}
                    </td>
                    <td className="py-3 align-top text-xs text-fg-3">
                      <span className="inline-flex items-center gap-2">
                        <Cell fill="open" />
                        {t("aggregateOnly")}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-xs text-fg-3" aria-label={t("legend.enter")}>
        <li className="inline-flex items-center gap-2">
          <Cell fill="solid" tone="accent" size={10} />
          {t("legend.enter")}
        </li>
        <li className="inline-flex items-center gap-2">
          <Cell fill="hatch" size={10} />
          {t("legend.staff")}
        </li>
        <li className="inline-flex items-center gap-2">
          <Cell fill="open" size={10} />
          {t("legend.none")}
        </li>
      </ul>
    </div>
  );
}
