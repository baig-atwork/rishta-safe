import { useTranslations } from "next-intl";
import { EmptyState } from "./states";

/** Shown on role pages when no matching demo persona is active: an actionable empty state, never a dead end. */
export function NeedPersona({ role }: { role: "couple" | "counsellor" | "clinician" | "programme" | "judge" }) {
  const t = useTranslations("needPersona");
  return <EmptyState title={t("title")} body={t(`body.${role}`)} actionHref="/demo" actionLabel={t("cta")} />;
}
