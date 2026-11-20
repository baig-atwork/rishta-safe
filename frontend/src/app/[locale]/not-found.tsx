import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  const t = useTranslations("states");
  return (
    <EmptyState
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      actionHref="/demo"
      actionLabel={t("notFoundBench")}
      secondaryHref="/"
      secondaryLabel={t("notFoundCta")}
    />
  );
}
