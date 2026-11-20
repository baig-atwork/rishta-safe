import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { loadMessages, type Messages } from "../messages/load";
import { routing } from "./routing";

function isRecord(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Missing keys in ar or ur fall back to English rather than crashing a page; a test asserts key parity. */
export function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = isRecord(current) && isRecord(value) ? mergeMessages(current, value) : value;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  // An explicit locale (getTranslations({ locale }), used by generateMetadata) wins over the proxy header.
  const requested = explicit ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const english = await loadMessages("en");
  const messages = locale === "en" ? english : mergeMessages(english, await loadMessages(locale));
  return { locale, messages };
});
