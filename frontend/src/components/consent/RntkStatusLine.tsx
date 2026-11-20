"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Cell } from "@/components/grid/Cell";
import { RntkConfirm } from "@/components/result/RntkConfirm";
import { useRntk } from "@/components/result/use-rntk";

export interface RntkStatusLineProps {
  coupleId: string;
  /** From the server's read of the result (withheld_reason_key = right_not_to_know); null when the read failed. */
  active: boolean | null;
}

/**
 * "Right not to know: not declared · Declare" or "declared · Withdraw": the same PUT and DELETE as the threshold. The
 * status is the server's; between a change succeeding and the page re-running, the line shows the new state.
 */
export function RntkStatusLine({ coupleId, active }: RntkStatusLineProps) {
  const t = useTranslations("sharing.rntk");
  const [override, setOverride] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const rntk = useRntk(coupleId, (next) => {
    setOverride(next);
    setConfirming(false);
  });
  // When the server component re-runs with a new status, the override is no longer needed (state reset during render).
  const [seenActive, setSeenActive] = useState(active);
  if (seenActive !== active) {
    setSeenActive(active);
    setOverride(null);
  }
  const shown = override ?? active;

  return (
    <section aria-labelledby="rntk-line" className="grid gap-2 border-y border-line py-4" data-testid="rntk-status">
      <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Cell fill="open" dashed={shown === false} size={16} />
        <span id="rntk-line" className="font-semibold">
          {t("label")}
        </span>
        <span data-testid="rntk-state">{shown === null ? t("unknown") : shown ? t("on") : t("off")}</span>
        {shown === null ? null : (
          <button
            type="button"
            className="btn btn-link"
            aria-busy={rntk.pending}
            disabled={rntk.pending}
            onClick={() => {
              if (shown) rntk.withdraw();
              else {
                rntk.reset();
                setConfirming(true);
              }
            }}
          >
            {shown ? t("withdraw") : t("declare")}
          </button>
        )}
      </p>
      <p className="m-0 text-sm text-fg-2">{t("note")}</p>
      {rntk.error && !confirming ? (
        <p role="alert" className="field-error m-0">
          {t("failed")} <bdi>{rntk.error.problem.title}</bdi>
        </p>
      ) : null}
      <RntkConfirm open={confirming} pending={rntk.pending} error={rntk.error} onConfirm={() => rntk.declare()} onClose={() => setConfirming(false)} />
    </section>
  );
}
