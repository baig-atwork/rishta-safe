"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Cell } from "@/components/grid/Cell";
import { SkeletonBlock } from "@/components/ui/states";
import type { Locale, Partner } from "@/lib/api/types";
import {
  browserStores,
  clearChoice,
  persistChoice,
  readStoredChoice,
  viewFor,
  type EntryState,
  type ThresholdChoice,
} from "@/lib/couple-threshold";
import type { NextPanelData } from "./ReadTogether";
import { Threshold } from "./Threshold";
import { useRntk } from "./use-rntk";

export interface ResultExperienceProps {
  coupleId: string;
  personaId: string;
  viewerPersonId: string | null;
  locale: Locale;
  partners: Partner[] | null;
  /** From the server's read of the result: "declared" (right not to know on record) or "threshold" (a category exists). No text. */
  entry: Exclude<EntryState, "withheld">;
  /** `?enter=now`: skip the choice for this visit (a judge in a hurry); nothing is stored. */
  enterNow: boolean;
  /** The label of the counselling step with its status, for the "with a counsellor first" closed view (null: unavailable). */
  counsellingStep: string | null;
  next: NextPanelData;
}

const subscribeNever = () => () => undefined;

/** The reader (queries, both languages, disclosures) loads only once someone chooses to read: it is not in the first load. */
const ReadTogether = dynamic(() => import("./ReadTogether").then((module) => module.ReadTogether), {
  loading: () => <ThresholdSkeleton label="" />,
});

function ThresholdSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto grid min-h-[38rem] max-w-[44rem] content-start gap-6 py-6" data-testid="threshold-skeleton">
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-12 w-3/4" />
      <SkeletonBlock className="h-12 w-full" />
      <SkeletonBlock className="h-[21rem] w-full" />
      <SkeletonBlock className="h-10 w-28" />
    </div>
  );
}

/**
 * The gate in front of the result (02-ux-concept 4.1). The server decided the entry state from the API; the browser
 * knows the stored choice. Until a choice exists the result is not rendered at all (not hidden by CSS), and its text is
 * not even fetched: ReadTogether, which holds the queries, mounts only for the "result" view.
 */
export function ResultExperience({ coupleId, personaId, viewerPersonId, locale, partners, entry, enterNow, counsellingStep, next }: ResultExperienceProps) {
  const t = useTranslations("result");
  /** False while the server markup is hydrated, true in the browser: storage is only read once it is true. */
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  /** The choice made on this screen this visit; undefined means "not chosen here: use the stored one (or ?enter=now)". */
  const [chosen, setChosen] = useState<ThresholdChoice | null | undefined>(undefined);
  /** Between a declare or withdraw succeeding and the server component re-running, this says what the screen shows. */
  const [override, setOverride] = useState<"declared" | "undeclared" | null>(null);
  const [seenEntry, setSeenEntry] = useState(entry);
  if (seenEntry !== entry) {
    // The server component re-ran with a new entry state: the override has done its job.
    setSeenEntry(entry);
    setOverride(null);
  }
  const choice: ThresholdChoice | null =
    chosen !== undefined ? chosen : !ready ? null : enterNow && entry === "threshold" ? "now" : readStoredChoice(browserStores(), personaId, coupleId);
  const setChoice = (value: ThresholdChoice | null) => setChosen(value);

  const rntk = useRntk(coupleId, (active) => setOverride(active ? "declared" : "undeclared"));

  const effective: "declared" | "threshold" = override === "declared" ? "declared" : override === "undeclared" ? "threshold" : entry;

  function choose(next_: Exclude<ThresholdChoice, "rntk">) {
    persistChoice(browserStores(), personaId, coupleId, next_);
    setChoice(next_);
  }
  /** Reopens the threshold ("Change how I meet it"): the stored choice is forgotten. */
  function reopen() {
    clearChoice(browserStores(), personaId, coupleId);
    setChoice(null);
  }

  if (effective === "declared") {
    return (
      <div className="mx-auto grid max-w-[44rem] gap-5 py-6" data-testid="declared">
        <div className="flex items-center gap-3">
          <Cell fill="open" size={18} />
          <p className="label m-0">{t("threshold.eyebrow")}</p>
        </div>
        <h1 className="m-0">{t("threshold.declaredTitle")}</h1>
        <p className="measure m-0 text-fg-2">{t("threshold.declaredBody")}</p>
        {rntk.error ? (
          <p role="alert" className="field-error m-0">
            <bdi>{rntk.error.problem.title}</bdi>
            {rntk.error.correlationId ? (
              <>
                {" "}
                <code className="ltr-run font-mono">{rntk.error.correlationId}</code>
              </>
            ) : null}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            className="btn btn-primary"
            aria-busy={rntk.pending}
            disabled={rntk.pending}
            onClick={() => {
              clearChoice(browserStores(), personaId, coupleId);
              setChoice(null);
              rntk.withdraw();
            }}
          >
            {t("threshold.withdraw")}
          </button>
        </div>
      </div>
    );
  }

  if (!ready) return <ThresholdSkeleton label={t("threshold.loadingLabel")} />;

  switch (viewFor(choice)) {
    case "result":
      return <ReadTogether coupleId={coupleId} locale={locale} partners={partners} viewerPersonId={viewerPersonId} next={next} onClose={() => choose("notyet")} onChange={reopen} />;
    case "closed-counsellor":
      return (
        <div className="mx-auto grid max-w-[44rem] gap-5 py-6" data-testid="closed-counsellor">
          <div className="flex items-center gap-3">
            <Cell fill="hatch" size={18} />
            <p className="label m-0">{t("threshold.eyebrow")}</p>
          </div>
          <h1 className="m-0">{t("threshold.counsellorTitle")}</h1>
          <p className="measure m-0 text-fg-2">{counsellingStep ? t("threshold.counsellorStep", { step: counsellingStep }) : t("threshold.counsellorNoStep")}</p>
          <p className="m-0 flex flex-wrap gap-4">
            <button type="button" className="btn btn-primary" onClick={() => setChoice("now")}>
              {t("threshold.open")}
            </button>
            <button type="button" className="btn btn-link" onClick={reopen}>
              {t("threshold.change")}
            </button>
          </p>
        </div>
      );
    case "closed-notyet":
      return (
        <div className="mx-auto grid max-w-[44rem] gap-5 py-6" data-testid="closed-notyet">
          <div className="flex items-center gap-3">
            <Cell fill="open" dashed size={18} />
            <p className="label m-0">{t("threshold.eyebrow")}</p>
          </div>
          <h1 className="m-0">{t("threshold.notYetTitle")}</h1>
          <p className="measure m-0 text-fg-2">{t("threshold.notYetBody")}</p>
          <p className="m-0 flex flex-wrap gap-4">
            <button type="button" className="btn btn-primary" onClick={() => setChoice("now")}>
              {t("threshold.openIt")}
            </button>
            <button type="button" className="btn btn-link" onClick={reopen}>
              {t("threshold.change")}
            </button>
          </p>
        </div>
      );
    default:
      return <Threshold coupleId={coupleId} onChoose={choose} onDeclared={() => setOverride("declared")} />;
  }
}
