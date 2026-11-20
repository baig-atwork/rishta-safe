import { cookies } from "next/headers";
import type { Role } from "./api/types";

export const SESSION_COOKIE = "bayan_session";

export interface Session {
  token: string;
  personaId: string;
  role: Role;
  coupleId: string | null;
  personId: string | null;
  name: string;
}

function isRole(value: unknown): value is Role {
  return (
    value === "couple_member" ||
    value === "counsellor" ||
    value === "clinician" ||
    value === "programme" ||
    value === "judge" ||
    value === "external"
  );
}

export function parseSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const rec = data as Record<string, unknown>;
    if (typeof rec["token"] !== "string" || typeof rec["personaId"] !== "string" || !isRole(rec["role"])) return null;
    return {
      token: rec["token"],
      personaId: rec["personaId"],
      role: rec["role"],
      coupleId: typeof rec["coupleId"] === "string" ? rec["coupleId"] : null,
      personId: typeof rec["personId"] === "string" ? rec["personId"] : null,
      name: typeof rec["name"] === "string" ? rec["name"] : "",
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}

/** Where each role lands after choosing a persona. */
export function homeFor(role: Role): string {
  switch (role) {
    case "couple_member":
      return "/couple";
    case "counsellor":
      return "/staff";
    case "clinician":
      return "/clinician";
    case "programme":
      return "/programme";
    case "judge":
      return "/judge";
    default:
      return "/demo";
  }
}
