"use server";

import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, routing, type AppLocale } from "@/i18n/routing";
import { serverApi } from "@/lib/api/server";
import { SESSION_COOKIE, homeFor, type Session } from "@/lib/session";

function asLocale(value: string): AppLocale {
  return isAppLocale(value) ? value : routing.defaultLocale;
}

/** Picks a seeded persona: stores its demo token in an httpOnly cookie and lands on the role's home. */
export async function startSession(personaId: string, locale: string): Promise<void> {
  const personas = await serverApi().personas();
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) return;
  const session: Session = {
    token: persona.token,
    personaId: persona.id,
    role: persona.role,
    coupleId: persona.couple_id,
    personId: persona.person_id,
    name: persona.display_name,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env["BAYAN_INSECURE_COOKIE"] !== "1",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect({ href: homeFor(persona.role), locale: asLocale(locale) });
}

export async function endSession(locale: string): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect({ href: "/demo", locale: asLocale(locale) });
}
