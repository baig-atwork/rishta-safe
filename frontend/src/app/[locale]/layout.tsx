import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { AuditTape } from "@/components/consent/AuditTape";
import { CaseBenchSlot } from "@/components/demo/CaseBenchSlot";
import { HonestyRail } from "@/components/shell/HonestyRail";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { QueryProvider } from "@/components/QueryProvider";
import { dirFor, routing, type AppLocale } from "@/i18n/routing";
import { serverApi, settle } from "@/lib/api/server";
import { readSession } from "@/lib/session";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: t("title"), template: `%s | ${t("brand")}` },
    description: t("description"),
    icons: { icon: "/favicon.svg" },
  };
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

/** Applies a stored theme override before first paint so there is no flash; system preference is the default. */
const themeScript = `try{var t=localStorage.getItem("bayan-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

function preloadFonts(locale: AppLocale): void {
  const font = (file: string) => preload(`/fonts/${file}`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  // Only the face that paints the first fold. Nastaliq (Urdu reading prose) is large and is fetched on demand.
  if (locale === "en") {
    font("archivo-latin-var.woff2");
    font("red-hat-mono-latin-var.woff2");
  } else if (locale === "ar") {
    font("noto-kufi-arabic-arabic-var.woff2");
    font("noto-naskh-arabic-arabic-wght-normal.woff2");
  } else {
    font("noto-naskh-arabic-arabic-wght-normal.woff2");
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  preloadFonts(locale);

  const [messages, session, t] = await Promise.all([
    getMessages(),
    readSession(),
    getTranslations({ locale, namespace: "shell" }),
  ]);
  const personas = await settle(() => serverApi().personas());
  const personaOptions = (personas.data ?? []).map((p) => ({ id: p.id, displayName: p.display_name, role: p.role, coupleId: p.couple_id }));
  const persona = session ? { id: session.personaId, displayName: session.name, coupleId: session.coupleId } : null;

  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <a href="#main" className="skip-link">
              {t("skip")}
            </a>
            <SiteHeader role={session?.role ?? null} persona={persona} personaOptions={personaOptions} lensSlot={<CaseBenchSlot />} />
            <HonestyRail />
            <main id="main" className="wrap flex-1 py-8 sm:py-10">
              {children}
            </main>
            <SiteFooter />
            {session?.role === "couple_member" && session.coupleId ? <AuditTape coupleId={session.coupleId} /> : null}
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
