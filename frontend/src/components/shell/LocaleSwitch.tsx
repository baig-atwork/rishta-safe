"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";

/** Visible label per locale. The accessible name starts with the visible text (WCAG 2.5.3, axe label-content-name-mismatch) and adds the full language name. */
const SEGMENTS: Record<AppLocale, { visible: string; name: string }> = {
  en: { visible: "EN", name: "EN English" },
  ar: { visible: "عربي", name: "العربية" },
  ur: { visible: "اردو", name: "اردو" },
};

/** Segmented EN | عربي | اردو. Each link keeps the current path and carries its own lang so a screen reader switches voice. */
export function LocaleSwitch() {
  const t = useTranslations("shell");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("language")} className="locale-seg">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          lang={locale}
          hrefLang={locale}
          aria-label={SEGMENTS[locale].name}
          aria-current={current === locale ? "true" : undefined}
        >
          {SEGMENTS[locale].visible}
        </Link>
      ))}
    </nav>
  );
}
