import { useTranslations } from "next-intl";
import type { ReviewPriority } from "@/lib/api/types";

/**
 * Review priority is an ordered scale, so it is carried by a glyph and an uppercase label first; only `urgent` borrows
 * the attention colour. Glyphs: triangle urgent, filled square priority, open square routine.
 */
const GLYPH: Record<ReviewPriority, string> = { urgent: "▲", priority: "■", routine: "□" };

export function PriorityTag({ priority }: { priority: ReviewPriority }) {
  const t = useTranslations("staff.priority");
  return (
    <span className="inst-pri" data-priority={priority}>
      <span aria-hidden="true">{GLYPH[priority]}</span>
      {t(priority)}
    </span>
  );
}
