import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { dirFor, type AppLocale } from "@/i18n/routing";
import { mergeMessages } from "@/i18n/request";
import arMessages from "./messages-ar";
import enMessages from "./messages-en";
import urMessages from "./messages-ur";

const BY_LOCALE = { en: enMessages, ar: arMessages, ur: urMessages } as const;

/** Renders a client component inside next-intl and TanStack Query, with lang and dir set like the real layout. */
export function renderWithIntl(ui: ReactElement, locale: AppLocale = "en"): RenderResult {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirFor(locale);
  const messages = locale === "en" ? enMessages : mergeMessages(enMessages, BY_LOCALE[locale]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={client}>
        <div dir={dirFor(locale)} lang={locale}>
          {ui}
        </div>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
