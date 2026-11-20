"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { PathwayView } from "@/lib/api/types";

/**
 * Demo-only control: records the pathway event so a judge can see the tracker move. Labelled as a simulation.
 * `label` names the event (the API's own label); without one the generic "Simulate this step" is shown.
 */
export function AdvanceButton({
  coupleId,
  event,
  label,
  variant = "primary",
  showNote = true,
}: {
  coupleId: string;
  event: string;
  label?: string | null;
  variant?: "primary" | "secondary";
  showNote?: boolean;
}) {
  const t = useTranslations("couple");
  const router = useRouter();
  const mutation = useMutation<PathwayView, ApiError>({
    mutationFn: () => clientApi.advancePathway(coupleId, event),
    onSuccess: () => router.refresh(),
  });
  return (
    <div>
      <button
        type="button"
        className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}
        aria-busy={mutation.isPending}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {label ? <bdi>{label}</bdi> : t("simulateStep")}
      </button>
      {showNote ? <p className="m-0 mt-2 text-sm text-fg-3">{t("simulateNote")}</p> : null}
      {mutation.error ? (
        <p role="alert" className="field-error">
          {mutation.error.problem.title}
          {mutation.error.correlationId ? (
            <>
              {" "}
              <code className="ltr-run font-mono">{mutation.error.correlationId}</code>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
