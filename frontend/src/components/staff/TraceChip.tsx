import { useTranslations } from "next-intl";

export interface TraceChipProps {
  /** The trace entry id shown on the chip (for example R1, T2, C1 or an id the API gave a trace line). */
  id: string;
  /** In-page target, `#trace-<id>`. */
  href: string;
}

/** A boxed id that links a brief line to its entry in the trace pane. The visible id is part of the accessible name. */
export function TraceChip({ id, href }: TraceChipProps) {
  const t = useTranslations("staff.trace");
  return (
    <a className="trace-chip" href={href} data-trace-chip={id}>
      <bdi dir="ltr">{id}</bdi>
      <span className="sr-only"> {t("jump")}</span>
    </a>
  );
}
