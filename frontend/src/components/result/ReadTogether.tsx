"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { AdvanceButton } from "@/components/pathway/AdvanceButton";
import { TallyGrid } from "@/components/grid/TallyGrid";
import { ErrorState, SkeletonBlock } from "@/components/ui/states";
import { Link } from "@/i18n/navigation";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { Block, ExplainerDoc, GlossaryEntry, Locale, Partner, ResultEnvelope } from "@/lib/api/types";
import { useNarrow } from "@/lib/couple-narrow";
import { pairBlocks, secondLocale, type PairedBlocks } from "@/lib/couple-pairing";
import { DISCLOSURE_ORDER, sectionResult, type DisclosureKey, type ResultSections } from "@/lib/result-layers";
import { BlockView, Blocks } from "./Blocks";
import { CategoryChip } from "./CategoryChip";

/** Pre-translated content of the next-step panel (built on the server from the pathway; no result wording here). */
export interface NextPanelData {
  heading: string;
  body: string | null;
  /** The demo pathway event the panel may fire (labelled as a simulation by AdvanceButton). */
  advanceEvent: string | null;
}

export interface ReadTogetherProps {
  coupleId: string;
  locale: Locale;
  partners: Partner[] | null;
  viewerPersonId: string | null;
  next: NextPanelData;
  onClose: () => void;
  onChange: () => void;
}

const subscribeNever = () => () => undefined;
const SINGLE_KEY = "bayan.together.single";
const LOCALES: readonly Locale[] = ["en", "ar", "ur"];
const dirOf = (locale: Locale): "ltr" | "rtl" => (locale === "en" ? "ltr" : "rtl");

/** The remembered choice: true (one language), false (both), null (never chosen: the screen size decides). */
function readSingle(): boolean | null {
  try {
    const stored = window.localStorage.getItem(SINGLE_KEY);
    return stored === "1" ? true : stored === "0" ? false : null;
  } catch {
    return null;
  }
}
function writeSingle(value: boolean): void {
  try {
    window.localStorage.setItem(SINGLE_KEY, value ? "1" : "0");
  } catch {
    // Not remembered: the choice still applies on this page.
  }
}

interface Column {
  locale: Locale;
  doc: ExplainerDoc;
  sections: ResultSections;
}

/** One row of the first fold or a disclosure: the page-language cell, then (when shown) the second-language cell. */
function Row({ first, second, className = "" }: { first: ReactNode; second: ReactNode | null; className?: string }) {
  return (
    <div className={`grid gap-x-10 gap-y-3 min-[760px]:grid-cols-[repeat(var(--cols),minmax(0,1fr))] ${className}`} style={{ "--cols": second === null ? 1 : 2 } as React.CSSProperties}>
      <div>{first}</div>
      {second === null ? null : <div className="text-fg-2 max-[759px]:border-t max-[759px]:border-dashed max-[759px]:border-line max-[759px]:pt-3">{second}</div>}
    </div>
  );
}

/** A list of paired blocks; a break in alignment stops pairing, says so, and shows each language's remainder in full. */
function PairedView({ pairs, a, b, notAligned }: { pairs: PairedBlocks; a: Column; b: Column | null; notAligned: string }) {
  return (
    <div className="grid gap-5">
      {pairs.pairs.map((pair, index) => (
        <Row
          key={index}
          first={<BlockView block={pair.primary} lang={a.locale} dir={dirOf(a.locale)} />}
          second={b === null ? null : <BlockView block={pair.secondary} lang={b.locale} dir={dirOf(b.locale)} />}
        />
      ))}
      {!pairs.aligned ? (
        <>
          <p role="status" className="panel-sunken m-0 text-sm">
            {notAligned}
          </p>
          <Row
            first={<RestView blocks={pairs.restPrimary} locale={a.locale} />}
            second={b === null ? null : <RestView blocks={pairs.restSecondary} locale={b.locale} />}
          />
        </>
      ) : null}
    </div>
  );
}

function RestView({ blocks, locale }: { blocks: Block[]; locale: Locale }) {
  return (
    <div className="grid gap-4" lang={locale} dir={dirOf(locale)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} lang={locale} dir={dirOf(locale)} />
      ))}
    </div>
  );
}

function Disclosure({ title, open = false, pinned = false, pinnedNote, children }: { title: string; open?: boolean; pinned?: boolean; pinnedNote?: string; children: ReactNode }) {
  return (
    <details open={open || pinned} className="group border-b border-line py-1">
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 font-semibold"
        onClick={pinned ? (event) => event.preventDefault() : undefined}
      >
        <span>{title}</span>
        <span aria-hidden="true" className="font-mono text-fg-2">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <div className="grid gap-4 pb-4 pt-1">
        {pinned && pinnedNote ? <p className="m-0 text-sm text-fg-2">{pinnedNote}</p> : null}
        {children}
      </div>
    </details>
  );
}

function FoldSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_auto]" data-testid="result-skeleton">
      <div className="grid gap-4">
        <SkeletonBlock className="h-9 w-3/4" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
      <SkeletonBlock className="size-56" />
    </div>
  );
}

/**
 * Read together (02-ux-concept 4.2): the result in the page language and, beside it, in the other member's language,
 * aligned block by block. Two TanStack queries (page locale, second locale); every word of the result comes from the API.
 * The first fold is the chip, both headings, both summaries, the caption in both languages and the tally; the rest is
 * progressive disclosure, then the next step on the reading end.
 */
export function ReadTogether({ coupleId, locale, partners, viewerPersonId, next, onClose, onChange }: ReadTogetherProps) {
  const t = useTranslations("result");
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  /** The person's choice on this page; null means "use what was remembered". */
  const [singleChoice, setSingleChoice] = useState<boolean | null>(null);
  const narrow = useNarrow();
  const single = singleChoice ?? (ready ? (readSingle() ?? narrow) : false);
  const setSingle = (value: boolean) => setSingleChoice(value);
  const [added, setAdded] = useState<Locale | null>(null);
  const captionId = useId();

  const primary = useQuery<ResultEnvelope, ApiError>({ queryKey: ["result", coupleId, locale], queryFn: () => clientApi.result(coupleId, locale) });
  const second: Locale | null = added ?? (partners === null ? null : secondLocale({ pageLocale: locale, partners, viewerPersonId }));
  const wantSecond = ready && !single && second !== null;
  const secondary = useQuery<ResultEnvelope, ApiError>({
    queryKey: ["result", coupleId, second],
    queryFn: () => clientApi.result(coupleId, second ?? locale),
    enabled: wantSecond,
  });
  const options = useQuery<ExplainerDoc, ApiError>({ queryKey: ["options", locale], queryFn: () => clientApi.options(locale) });
  const glossary = useQuery<GlossaryEntry[], ApiError>({ queryKey: ["glossary", locale], queryFn: () => clientApi.glossary(locale) });

  if (primary.isPending) return <FoldSkeleton label={t("stateLoading")} />;
  if (primary.isError) return <ErrorState problem={primary.error.problem} />;

  const { disclosed, explainer } = primary.data;
  if (disclosed.category === null || explainer === null) {
    return (
      <section className="panel panel-attention" role="status">
        <h1 className="m-0 text-xl">{t("withheld.title")}</h1>
        <p className="measure mt-2 text-fg-2">{t("withheldNow")}</p>
      </section>
    );
  }

  const a: Column = { locale, doc: explainer, sections: sectionResult(explainer) };
  const secDoc = wantSecond && secondary.data?.explainer ? secondary.data.explainer : null;
  const b: Column | null = secDoc !== null && second !== null ? { locale: second, doc: secDoc, sections: sectionResult(secDoc) } : null;
  const showTwo = b !== null;
  const secondPending = wantSecond && secondary.isPending;
  const secondFailed = wantSecond && secondary.isError;
  const langName = (code: Locale) => t(`together.lang.${code}`);
  const status = (doc: ExplainerDoc) => t(`together.status.${doc.language_status}`);
  const related = disclosed.relationship !== "unrelated";
  const sa = a.sections;
  const sb = b?.sections ?? null;
  const shownGlossary = (glossary.data ?? []).filter((entry) => explainer.glossary_keys.includes(entry.key));
  const optionBlocks = options.data ? options.data.blocks.filter((x) => x.kind !== "heading" && x.kind !== "disclaimer") : [];

  const label = (key: DisclosureKey): string => t(`more.${key}`);
  const disclosureBody = (key: DisclosureKey): ReactNode => {
    const aBlocks = sa.disclosures[key];
    const bBlocks = sb?.disclosures[key] ?? [];
    const pairs = pairBlocks(aBlocks, showTwo ? bBlocks : aBlocks);
    return (
      <>
        {aBlocks.length === 0 && key !== "who" && key !== "own" ? <p className="m-0 text-fg-2">{t("more.none")}</p> : null}
        {aBlocks.length > 0 ? <PairedView pairs={pairs} a={a} b={showTwo ? b : null} notAligned={t("together.notAligned")} /> : null}
        {key === "own" && disclosed.own_findings.length > 0 ? (
          <div>
            <p className="m-0 text-sm text-fg-2">{t("ownFindingsNote")}</p>
            <ul className="m-0 mt-2 grid list-none gap-1 p-0">
              {disclosed.own_findings.map((f) => (
                <li key={`${f.gene}-${f.condition_id}`}>
                  <code className="ltr-run font-mono">{f.gene}</code> · {t(`zygosity.${f.zygosity}`)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {key === "who" ? (
          <p className="m-0">
            <Link href="/couple/sharing" className="btn btn-link">
              {t("more.whoLink")}
            </Link>
          </p>
        ) : null}
      </>
    );
  };

  const showOwn = sa.disclosures.own.length > 0 || disclosed.own_findings.length > 0;
  const captionA = sa.figure?.icon_array?.caption ?? sa.figure?.text ?? null;
  const captionB = sb?.figure?.icon_array?.caption ?? sb?.figure?.text ?? null;

  return (
    <div className="grid gap-10 py-2 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="result-read">
      <section aria-labelledby={`${captionId}-h`} data-cat={disclosed.category} data-testid="layer-1" className="grid gap-6 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <CategoryChip category={disclosed.category} />
          <div role="group" aria-label={t("together.groupLabel")} className="flex flex-wrap items-center gap-3">
            <span className="label">{t("together.label")}</span>
            <span className="inline-flex items-center gap-2 border border-line-strong px-2 py-1 text-sm" lang={a.locale}>
              {langName(a.locale)}
              <span className="stamp" lang={locale}>
                {status(a.doc)}
              </span>
            </span>
            {showTwo && b !== null ? (
              <span className="inline-flex items-center gap-2 border border-line-strong px-2 py-1 text-sm" lang={b.locale}>
                {langName(b.locale)}
                <span className="stamp" lang={locale}>
                  {status(b.doc)}
                </span>
              </span>
            ) : null}
            {showTwo ? (
              <button
                type="button"
                className="btn btn-link btn-sm"
                onClick={() => {
                  writeSingle(true);
                  setSingle(true);
                }}
              >
                {t("together.one")}
              </button>
            ) : single && second !== null ? (
              <button
                type="button"
                className="btn btn-link btn-sm"
                onClick={() => {
                  writeSingle(false);
                  setSingle(false);
                }}
              >
                {t("together.both")}
              </button>
            ) : null}
            {second === null && !single ? (
              <label className="inline-flex items-center gap-2 text-sm">
                <span>{t("together.add")}</span>
                <select
                  className="select"
                  aria-label={t("together.addLabel")}
                  value=""
                  onChange={(event) => {
                    const value = LOCALES.find((code) => code === event.target.value);
                    if (value) setAdded(value);
                  }}
                >
                  <option value="" />
                  {LOCALES.filter((code) => code !== locale).map((code) => (
                    <option key={code} value={code} lang={code}>
                      {langName(code)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-6">
            {sa.headline ? (
              <Row
                first={
                  <h1 id={`${captionId}-h`} className="m-0 max-w-[24ch]" lang={a.locale} dir={dirOf(a.locale)}>
                    {sa.headline.text}
                  </h1>
                }
                second={
                  showTwo && b !== null ? (
                    sb?.headline ? (
                      <h2 className="m-0 max-w-[24ch] text-xl text-fg" lang={b.locale} dir={dirOf(b.locale)}>
                        {sb.headline.text}
                      </h2>
                    ) : (
                      <span />
                    )
                  ) : secondPending ? (
                    <SkeletonBlock className="h-9 w-3/4" />
                  ) : secondFailed && second !== null ? (
                    <p role="alert" className="m-0 text-sm">
                      {t("together.secondFailed", { language: langName(second) })}{" "}
                      <button type="button" className="btn btn-link btn-sm" onClick={() => void secondary.refetch()}>
                        {t("together.retry")}
                      </button>
                    </p>
                  ) : null
                }
              />
            ) : (
              <h1 id={`${captionId}-h`} className="m-0">
                {t(`category.${disclosed.category}`)}
              </h1>
            )}
            {sa.lead ? (
              <Row
                first={
                  <p className="read m-0" lang={a.locale} dir={dirOf(a.locale)}>
                    {sa.lead.text}
                  </p>
                }
                second={
                  showTwo && b !== null ? (
                    sb?.lead ? (
                      <p className="read m-0" lang={b.locale} dir={dirOf(b.locale)}>
                        {sb.lead.text}
                      </p>
                    ) : (
                      <span />
                    )
                  ) : secondPending ? (
                    <SkeletonBlock className="h-24 w-full" />
                  ) : null
                }
              />
            ) : null}
            {captionA ? (
              <Row
                className="border-s-2 border-line-strong ps-4"
                first={
                  <p id={captionId} className="read m-0" lang={a.locale} dir={dirOf(a.locale)}>
                    {captionA}
                  </p>
                }
                second={
                  showTwo && b !== null ? (
                    captionB ? (
                      <p className="read m-0" lang={b.locale} dir={dirOf(b.locale)}>
                        {captionB}
                      </p>
                    ) : (
                      <span />
                    )
                  ) : secondPending ? (
                    <SkeletonBlock className="h-16 w-full" />
                  ) : null
                }
              />
            ) : null}
          </div>
          {sa.figure?.icon_array ? (
            <aside aria-label={t("together.tallyLabel")} className="grid content-start gap-3">
              <TallyGrid
                spec={sa.figure.icon_array}
                captionId={captionId}
                size={15}
                legend={{
                  affected: t("iconArray.legend.affected"),
                  carrier: t("iconArray.legend.carrier"),
                  neither: t("iconArray.legend.neither"),
                }}
                invalidLabel={t("iconArray.invalid")}
              />
              <p className="m-0 font-mono text-xs text-fg-3">{t("iconArray.total", { total: sa.figure.icon_array.total })}</p>
            </aside>
          ) : null}
        </div>
      </section>

      {/* On a phone the next step comes straight after the summary and tally, then the accordions (order below). */}
        <section aria-label={t("more.label")} data-testid="layer-2" className="content-start border-t border-line pt-8 max-lg:order-3">
          {DISCLOSURE_ORDER.filter((key) => key !== "own" || showOwn).map((key) => (
            <Disclosure
              key={key}
              title={label(key)}
              open={key === "meaning" && !narrow}
              pinned={key === "limits" && related}
              {...(key === "limits" && related ? { pinnedNote: t("more.pinned") } : {})}
            >
              {disclosureBody(key)}
            </Disclosure>
          ))}
          {shownGlossary.length > 0 ? (
            <Disclosure title={t("more.glossary")}>
              <dl className="m-0 grid gap-0">
                {shownGlossary.map((entry) => (
                  <div key={entry.key} className="grid gap-1 border-b border-line py-3 first:pt-0 last:border-b-0 md:grid-cols-[12rem_1fr] md:gap-6">
                    <dt className="font-semibold">{entry.term}</dt>
                    <dd className="m-0 text-fg-2">{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
          ) : null}
        </section>

        <aside
          aria-labelledby={`${captionId}-next`}
          data-testid="layer-3"
          className="next-panel grid content-start gap-4 self-start border border-line-strong p-5 max-lg:order-2 lg:sticky lg:top-[calc(var(--header-h)+var(--rail-h)+1rem)] lg:mt-8"
        >
          <p className="label m-0">{t("next.label")}</p>
          <h2 id={`${captionId}-next`} className="m-0 text-xl">
            {next.heading}
          </h2>
          {next.body ? <p className="m-0 text-fg-2">{next.body}</p> : null}
          {sa.next.length > 0 ? <Blocks blocks={sa.next} /> : null}
          {next.advanceEvent ? <AdvanceButton coupleId={coupleId} event={next.advanceEvent} /> : null}
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-link underline">{t("next.options")}</summary>
            <div className="grid gap-3 pt-2">
              {options.isPending ? <p className="m-0 text-fg-2">{t("next.optionsLoading")}</p> : null}
              {options.isError ? (
                <p role="status" className="m-0 text-fg-2">
                  {t("next.optionsFailed")}
                </p>
              ) : null}
              {optionBlocks.length > 0 ? <Blocks blocks={optionBlocks} /> : null}
            </div>
          </details>
          <hr className="rule m-0" />
          <div data-testid="boundary" className="grid gap-2 text-sm text-fg-2">
            {sa.disclaimers.map((block, index) => (
              <p key={index} className="m-0">
                {block.text}
              </p>
            ))}
            {sa.trailing.map((block, index) => (
              <p key={`t-${index}`} className="m-0">
                {block.text}
              </p>
            ))}
          </div>
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <button type="button" className="btn btn-link btn-sm" onClick={onClose}>
              {t("close")}
            </button>
            <button type="button" className="btn btn-link btn-sm" onClick={onChange}>
              {t("change")}
            </button>
          </p>
        </aside>
    </div>
  );
}
