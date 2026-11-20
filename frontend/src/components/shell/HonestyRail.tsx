import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isMockMode } from "@/lib/api/upstream";

/**
 * The persistent honesty rail (28 px, every route, never dismissible). Replaces the 70 px StatusStamps band.
 * Below 760 px only "Synthetic data" and "Not clinical advice" remain, plus the Limits link. Each item keeps the
 * `stamp` class (a stable hook); the rail draws them flat with a hatch cell. A fixture marker appears only when the
 * mock serves the data, so a recorded response is never mistaken for a live one.
 */
export function HonestyRail() {
  const t = useTranslations("shell.rail");
  const mock = isMockMode();
  return (
    <div className="rail">
      <div className="wrap">
        <ul aria-label={t("label")}>
          <li className="stamp">{t("synthetic")}</li>
          <li className="stamp x">{t("draft")}</li>
          <li className="stamp x">{t("pending")}</li>
          <li className="stamp">{t("notAdvice")}</li>
          {mock ? <li className="stamp x">{t("fixtures")}</li> : null}
        </ul>
        <Link href="/governance#limits" className="more">
          {t("limits")}
        </Link>
      </div>
    </div>
  );
}
