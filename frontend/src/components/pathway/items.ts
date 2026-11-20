import type { PathwayView } from "@/lib/api/types";
import type { Locale } from "@/lib/api/types";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { TrackerItem } from "./PathwayCells";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Maps the API pathway view to tracker rows; every string is already translated and formatted. */
export function buildTrackerItems(view: PathwayView, locale: Locale, t: Translate): TrackerItem[] {
  return view.states.map((state) => {
    const slaTone: TrackerItem["slaTone"] =
      state.sla_status === "on_track" ? "ok" : state.sla_status === "not_applicable" ? null : "attention";
    return {
      key: state.key,
      title: state.label ?? t(`state.${state.key}`),
      timeText:
        state.expected_duration_hours !== null
          ? t("expected", { duration: formatDuration(locale, state.expected_duration_hours) })
          : null,
      status: state.status,
      statusLabel: t(`status.${state.status}`),
      slaLabel: state.sla_status === "not_applicable" ? null : t(`sla.${state.sla_status}`),
      slaTone,
      detail: null,
      when: formatDateTime(locale, state.completed_at ?? state.entered_at),
    };
  });
}
