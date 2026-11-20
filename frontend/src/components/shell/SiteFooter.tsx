import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** One compact block: what this is, the simulation notice, and three links. */
export function SiteFooter() {
  const t = useTranslations("shell.footer");
  return (
    <footer className="site-footer">
      <div className="wrap flex flex-wrap items-start justify-between gap-x-8 gap-y-4 py-5">
        <div className="measure grid gap-1">
          <p className="m-0 font-semibold text-fg">{t("what")}</p>
          <p className="m-0">{t("simulated")}</p>
          <p className="m-0">{t("noIntegration")}</p>
        </div>
        <nav aria-label={t("label")}>
          <ul className="m-0 grid list-none gap-1 p-0">
            <li>
              <Link href="/governance#data-declaration" className="inline-flex min-h-6 items-center">
                {t("dataDeclaration")}
              </Link>
            </li>
            <li>
              <Link href="/governance#limits" className="inline-flex min-h-6 items-center">
                {t("limits")}
              </Link>
            </li>
            <li>
              <Link href="/how-it-works" className="inline-flex min-h-6 items-center">
                {t("how")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
