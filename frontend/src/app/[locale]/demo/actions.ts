"use server";

import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, routing, type AppLocale } from "@/i18n/routing";
import { serverApi } from "@/lib/api/server";
import { isSafeCoupleId, type LensTarget } from "@/lib/public-bench";
import { SESSION_COOKIE, homeFor, type Session } from "@/lib/session";

function asLocale(value: string): AppLocale {
  return isAppLocale(value) ? value : routing.defaultLocale;
}

type Destination = { pathname: string; query?: Record<string, string> };

/** Maps a bench target to a route, accepting only the few shapes the bench produces (nothing from the client is a path). */
function destinationFor(target: LensTarget, role: Session["role"]): Destination {
  switch (target.kind) {
    case "result_now":
      return { pathname: "/couple/result", query: { enter: "now" } };
    case "staff_case":
      return isSafeCoupleId(target.coupleId) ? { pathname: `/staff/couples/${target.coupleId}` } : { pathname: homeFor(role) };
    case "clinician_case":
      return isSafeCoupleId(target.coupleId) ? { pathname: "/clinician", query: { couple: target.coupleId } } : { pathname: homeFor(role) };
    case "home":
      return { pathname: homeFor(role) };
  }
}

/**
 * Starts a lens and lands on a case-specific route: the couple result with the threshold skipped ("skip the choice"),
 * a staff brief, or the clinician's record. The cell that only needs the role's home uses the shared `startSession`
 * action instead; this one exists because that action cannot carry a destination.
 * It sets the same httpOnly session cookie as `startSession` (token server-side only).
 */
export async function startLensAt(personaId: string, locale: string, target: LensTarget): Promise<void> {
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
  const destination = destinationFor(target, persona.role);
  redirect({ href: destination, locale: asLocale(locale) });
}

/** POST /v1/demo/reset, then back to the bench with a visible result. A separate, explicit button: probes never reset. */
export async function resetDemoAction(locale: string): Promise<void> {
  let ok = false;
  try {
    ok = (await serverApi().resetDemo()).ok;
  } catch {
    ok = false;
  }
  redirect({ href: { pathname: "/demo", query: { reset: ok ? "done" : "failed" } }, locale: asLocale(locale) });
}
