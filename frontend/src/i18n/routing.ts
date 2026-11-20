import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ar", "ur"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});

const rtlLocales: readonly AppLocale[] = ["ar", "ur"];

export function dirFor(locale: AppLocale): "ltr" | "rtl" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}
