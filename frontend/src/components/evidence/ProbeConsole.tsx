"use client";

import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { runProbeAction, type ProbeActionResult } from "@/app/[locale]/judge/actions";
import { ScrollRegion } from "@/components/evidence/ScrollRegion";
import { Cell, type CellFill } from "@/components/grid/Cell";
import {
  MAX_FREE_TEXT,
  PROBE_IDS,
  PROBE_LOCALES,
  type AuditDelta,
  type ProbePreviewStep,
  type ProbeId,
  type ProbeRun,
  type StepRun,
  type Verdict,
  type VerifyView,
} from "@/lib/public-probes";

export interface ProbeConsoleProps {
  /** The scoreboard's own words about how well the refusal classifier does (M6), shown beside the free-text probe. */
  classifierNote: { title: string; value: string } | null;
  /** Each probe's planned request and acting persona, planned on the server (no tokens), shown before anything is sent. */
  previews?: Partial<Record<ProbeId, ProbePreviewStep[]>> | null | undefined;
}

const VERDICT_CELL: Record<Verdict, { fill: CellFill; dashed: boolean }> = {
  refused: { fill: "solid", dashed: false },
  answered: { fill: "hatch", dashed: false },
  notRefused: { fill: "open", dashed: false },
  raised: { fill: "hatch", dashed: false },
  noneRaised: { fill: "open", dashed: true },
  error: { fill: "open", dashed: true },
};

/** Pane that fades in (opacity and a short rise) after `delayMs`. Reduced motion collapses the transition to nothing. */
function Reveal({ delayMs, children, label }: { delayMs: number; children: React.ReactNode; label: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return (
    <section
      aria-label={label}
      data-shown={shown ? "true" : "false"}
      className="border-t border-line-strong/40 pt-4 opacity-0 transition-[opacity,transform] duration-[180ms] ease-out translate-y-2 data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100"
    >
      {children}
    </section>
  );
}

function Json({ value, label }: { value: unknown; label: string }) {
  return (
    <ScrollRegion label={label} className="max-h-72 overflow-y-auto">
      <pre className="mono ltr m-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-inverse-2">{JSON.stringify(value, null, 2)}</pre>
    </ScrollRegion>
  );
}

function StepView({ step, index, total }: { step: StepRun; index: number; total: number }) {
  const t = useTranslations("judge");
  const cell = VERDICT_CELL[step.facts.verdict];
  const verdictLabel = t(`verdict.${step.facts.verdict}`);
  return (
    <div className="grid gap-5">
      <section aria-label={t("req")} className="grid gap-2">
        <p className="label m-0 text-fg-inverse-2">
          {t("req")}
          {total > 1 ? ` · ${t("probes.step", { n: index + 1 })}` : ""} · {t("probes.actAs", { name: step.actor.displayName })}
        </p>
        <p className="mono ltr m-0 text-sm text-fg-inverse">
          <b>{step.request.method}</b> {step.request.path}
        </p>
        {step.request.body === undefined ? null : <Json value={step.request.body} label={t("req")} />}
      </section>
      <Reveal delayMs={0} label={t("res")}>
        <p className="label m-0 mb-3 text-fg-inverse-2">{t("res")}</p>
        <p className="m-0 flex items-center gap-3 text-base font-semibold" data-testid="probe-verdict">
          <Cell fill={cell.fill} dashed={cell.dashed} size={16} />
          {verdictLabel}
          <span className="mono ltr text-sm font-normal text-fg-inverse-2">{step.status === 0 ? "no response" : step.status}</span>
        </p>
        {step.facts.text ? (
          <p dir="auto" className="m-0 mt-3 max-w-[70ch] text-sm leading-relaxed text-fg-inverse" data-testid="probe-text">
            {step.facts.text}
          </p>
        ) : null}
        <dl className="mono ltr m-0 mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs text-fg-inverse-2">
          {step.facts.facts.map((fact, i) => (
            <div key={`${fact.key}-${i}`} className="contents">
              <dt>{fact.key}</dt>
              <dd className="m-0 break-words text-fg-inverse">{fact.value}</dd>
            </div>
          ))}
          <div className="contents">
            <dt>ms</dt>
            <dd className="m-0 text-fg-inverse">{step.ms}</dd>
          </div>
        </dl>
        <details className="mt-3">
          <summary className="label cursor-pointer text-fg-inverse-2">{t("rawResponse")}</summary>
          <div className="mt-2">
            <Json value={step.body} label={t("rawResponse")} />
          </div>
        </details>
      </Reveal>
    </div>
  );
}

/** The request a probe will send, shown before it is sent: the persona that acts, the endpoint and the body. */
function RequestPreview({ steps }: { steps: ProbePreviewStep[] | null }) {
  const t = useTranslations("judge");
  if (steps === null || steps.length === 0) return null;
  return (
    <section aria-label={t("probes.requestTitle")} className="grid gap-4" data-testid="probe-request">
      <p className="label m-0 text-fg-inverse-2">{t("probes.requestTitle")}</p>
      {steps.map((step, index) => (
        <div key={index} className="grid gap-2">
          <p className="label m-0 text-fg-inverse-2">
            {steps.length > 1 ? `${t("probes.step", { n: index + 1 })} · ` : ""}
            {t("probes.actAs", { name: step.actor.displayName })}
          </p>
          <p className="mono ltr m-0 text-sm text-fg-inverse">
            <b>{step.request.method}</b> {step.request.path}
          </p>
          {step.request.body === undefined ? null : <Json value={step.request.body} label={t("probes.body")} />}
        </div>
      ))}
      <p className="m-0 text-xs text-fg-inverse-2">{t("probes.sendHint")}</p>
    </section>
  );
}

function AuditPane({ run, onRetry }: { run: ProbeRun; onRetry: () => void }) {
  const t = useTranslations("judge");
  const audit: AuditDelta = run.audit;
  const verify: VerifyView | null = run.verify;
  const couple = audit.coupleId ?? "";
  const chainGrew = run.chain.before !== null && run.chain.after !== null && run.chain.after > run.chain.before;
  return (
    <Reveal delayMs={120} label={t("audit.title")}>
      <p className="label m-0 mb-3 text-fg-inverse-2">{t("audit.title")}</p>
      {audit.state === "unread" ? (
        <p role="status" className="m-0 flex flex-wrap items-center gap-3 text-sm text-fg-inverse">
          {t("audit.unread")}
          <button type="button" className="btn btn-sm btn-secondary border-fg-inverse-2 text-fg-inverse" onClick={onRetry}>
            {t("audit.retry")}
          </button>
        </p>
      ) : audit.state === "rows" ? (
        <div className="grid gap-2" data-testid="audit-rows">
          <p className="mono ltr m-0 text-xs text-fg-inverse-2">{t("audit.rows", { couple })}</p>
          <ScrollRegion label={t("audit.title")}>
            <table className="mono ltr w-full min-w-[640px] border-collapse text-xs text-fg-inverse">
              <thead>
                <tr className="text-fg-inverse-2">
                  {(["index", "when", "who", "action", "detail", "hash"] as const).map((col) => (
                    <th key={col} scope="col" className="border-b border-fg-inverse-2/40 px-2 py-1.5 text-start font-medium">
                      {t(`audit.col.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((row) => (
                  <tr key={row.index} className="align-top">
                    <td className="px-2 py-1.5">{row.index}</td>
                    <td className="px-2 py-1.5">{row.at}</td>
                    <td className="px-2 py-1.5">{row.actor}</td>
                    <td className="px-2 py-1.5">{row.action}</td>
                    <td className="px-2 py-1.5 break-words">{row.detail}</td>
                    <td className="px-2 py-1.5" title={row.hash}>
                      {row.prevHash.slice(0, 8)} → {row.hash.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </div>
      ) : (
        <div className="grid gap-1" data-testid="audit-none">
          {chainGrew && run.chain.before !== null && run.chain.after !== null ? (
            <p className="m-0 flex items-center gap-3 text-sm text-fg-inverse">
              <Cell fill="hatch" size={14} />
              {t("audit.chainOnly", { before: run.chain.before, after: run.chain.after })}
            </p>
          ) : (
            <>
              <p className="m-0 flex items-center gap-3 text-sm text-fg-inverse">
                <Cell fill="open" dashed size={14} />
                {t("audit.none")}
              </p>
              {run.chain.after !== null ? <p className="mono ltr m-0 text-xs text-fg-inverse-2">{t("audit.noneChain", { length: run.chain.after })}</p> : null}
            </>
          )}
        </div>
      )}
      <p className="mono ltr m-0 mt-3 text-xs text-fg-inverse-2" data-testid="audit-verify">
        {verify === null
          ? t("verify.unread")
          : verify.ok
            ? t("verify.ok", { length: verify.length ?? 0 })
            : t("verify.bad", { index: verify.firstBadIndex ?? 0 })}
      </p>
    </Reveal>
  );
}

/**
 * The probe console: a dark instrument. Pick a probe, send a real request as a stated synthetic persona (a server action
 * holds the persona tokens), and read the request, the response and the audit row it wrote. A probe that writes no row
 * says so. The delta comes from two reads of the log, never from a script.
 */
export function ProbeConsole({ classifierNote, previews = null }: ProbeConsoleProps) {
  const t = useTranslations("judge");
  const pageLocale = useLocale();
  // Probe 1 is open on load so the console never looks dead; nothing is sent until the person presses the button.
  const [selected, setSelected] = useState<ProbeId | null>(PROBE_IDS[0]);
  const [text, setText] = useState("");
  const [probeLocale, setProbeLocale] = useState<string>(PROBE_LOCALES.find((l) => l === pageLocale) ?? "en");
  const [result, setResult] = useState<ProbeActionResult | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const regionRef = useRef<HTMLDivElement>(null);
  const planned = selected === null ? null : (previews?.[selected] ?? null);
  // The free-text probe's body follows what is typed; every other probe's request is fixed.
  const preview =
    planned !== null && selected === "words"
      ? planned.map((step) => ({ ...step, request: { ...step.request, body: { ...(step.request.body as object), text, locale: probeLocale } } }))
      : planned;
  const textId = useId();
  const localeId = useId();

  function send(id: ProbeId) {
    setResult(null);
    startTransition(async () => {
      const outcome = await runProbeAction(id, { text, locale: probeLocale });
      setResult(outcome);
      setRunCount((n) => n + 1);
    });
  }

  function choose(id: ProbeId) {
    setSelected(id);
    setResult(null);
  }

  return (
    <section aria-labelledby="console-title" className="-mx-4 bg-surface-inverse px-4 py-8 text-fg-inverse sm:mx-0 sm:rounded-lg sm:p-8">
      <h2 id="console-title" className="m-0 mb-1 text-xl font-semibold">
        {t("probes.title")}
      </h2>
      <p className="m-0 mb-6 text-sm text-fg-inverse-2">{t("probes.pick")}</p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ol className="m-0 grid list-none content-start gap-0 border-t border-fg-inverse-2/40 p-0" aria-label={t("probes.list")}>
          {PROBE_IDS.map((id, index) => {
            const active = selected === id;
            return (
              <li key={id} className="border-b border-fg-inverse-2/40">
                <button
                  type="button"
                  aria-pressed={active}
                  data-probe={id}
                  onClick={() => choose(id)}
                  className={clsx(
                    "grid w-full min-h-12 grid-cols-[auto_1fr] items-start gap-x-3 px-2 py-3 text-start",
                    active ? "bg-fg-inverse/10" : "hover:bg-fg-inverse/5",
                  )}
                >
                  <span className="mono ltr mt-0.5 text-xs text-fg-inverse-2">{index + 1}</span>
                  <span className="grid gap-1">
                    <span className="text-sm font-semibold text-fg-inverse">{t(`probes.item.${id}.title`)}</span>
                    <span className="text-xs leading-snug text-fg-inverse-2">{t(`probes.item.${id}.desc`)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div ref={regionRef} className="grid min-w-0 content-start gap-5" aria-live="polite" aria-busy={pending}>
          {selected === null ? (
            <p className="m-0 flex items-center gap-3 text-sm text-fg-inverse-2" data-testid="probe-idle">
              <Cell fill="open" dashed size={14} />
              {t("probes.pick")}
            </p>
          ) : (
            <>
              {selected === "words" ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor={textId} className="label text-fg-inverse-2">
                      {t("probes.words.label")}
                    </label>
                    <textarea
                      id={textId}
                      value={text}
                      maxLength={MAX_FREE_TEXT}
                      rows={3}
                      dir="auto"
                      onChange={(event) => setText(event.target.value)}
                      className="textarea w-full border-fg-inverse-2 bg-transparent text-fg-inverse"
                    />
                    <span className="text-xs text-fg-inverse-2">{t("probes.words.limit")}</span>
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor={localeId} className="label text-fg-inverse-2">
                      {t("probes.words.locale")}
                    </label>
                    <select
                      id={localeId}
                      value={probeLocale}
                      onChange={(event) => setProbeLocale(event.target.value)}
                      className="select w-fit border-fg-inverse-2 bg-surface-inverse text-fg-inverse"
                    >
                      {PROBE_LOCALES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  {classifierNote ? (
                    <p className="m-0 text-xs leading-relaxed text-fg-inverse-2">
                      <span className="label me-2">{t("probes.words.caveat")}</span>
                      <span dir="auto" className="mono">
                        {classifierNote.value}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {selected === "distress" ? <p className="stamp w-fit border-fg-inverse-2 bg-transparent text-fg-inverse-2">{t("probes.syntheticSentence")}</p> : null}
              {result && result.ok && result.run.probeId === selected ? null : <RequestPreview steps={preview} />}
              <div>
                <button
                  type="button"
                  className="btn btn-primary bg-accent-on-dark text-surface-inverse hover:bg-accent-on-dark"
                  onClick={() => send(selected)}
                  disabled={pending}
                  data-testid="probe-run"
                >
                  {pending ? t("probes.running") : runCount > 0 && result ? t("probes.again") : t("probes.run")}
                </button>
              </div>
              {pending ? (
                <p className="mono m-0 text-sm text-fg-inverse-2" data-testid="probe-sending">
                  {t("probes.running")}
                </p>
              ) : null}
              {pending || (result && result.ok && result.run.probeId === selected) ? null : (
                <section aria-label={t("res")} className="grid gap-2 border border-dashed border-fg-inverse-2/60 p-4" data-testid="probe-response-slot">
                  <p className="label m-0 text-fg-inverse-2">{t("res")}</p>
                  <p className="m-0 text-sm text-fg-inverse-2">{t("probes.emptyResponse")}</p>
                </section>
              )}
              {result && !result.ok ? (
                <div role="alert" className="grid gap-1 border-s-2 border-attention-fg ps-4 text-sm">
                  <p className="m-0 font-semibold">{t("error.sent")}</p>
                  <p className="m-0 text-fg-inverse-2">{result.message}</p>
                  <p className="mono ltr m-0 text-xs text-fg-inverse-2">
                    {t("error.status", { status: result.status })}
                    {result.correlationId ? ` · ${t("error.correlation")} ${result.correlationId}` : ""}
                  </p>
                </div>
              ) : null}
              {result && result.ok && result.run.probeId === selected ? (
                <div key={runCount} className="grid gap-5" data-testid="probe-result">
                  {result.run.steps.map((step, index) => (
                    <StepView key={index} step={step} index={index} total={result.run.steps.length} />
                  ))}
                  <AuditPane run={result.run} onRetry={() => send(selected)} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
