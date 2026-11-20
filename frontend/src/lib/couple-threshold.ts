import type { ResultCategory } from "./api/types";

/**
 * The threshold: how a couple member chooses to meet their result (02-ux-concept 4.1). Pure logic, no React and no
 * wording: the component renders the copy. Storage is injected so the branching is testable without a browser.
 */

export type ThresholdChoice = "now" | "counsellor" | "notyet" | "rntk";
export const THRESHOLD_CHOICES: readonly ThresholdChoice[] = ["now", "counsellor", "notyet", "rntk"];

/** What the page does before any choice, from what the API disclosed. */
export type EntryState =
  /** The person declared a right not to know: show the declared state with a way to withdraw. */
  | "declared"
  /** The server decided to hold the result back (counselling first, partner has not agreed): show its withheld document. */
  | "withheld"
  /** A category exists: the threshold comes first (unless a choice is stored for this lens). */
  | "threshold";

export interface DisclosureHint {
  category: ResultCategory | null;
  withheld_reason_key: string | null;
}

export function entryState(disclosed: DisclosureHint): EntryState {
  if (disclosed.withheld_reason_key === "right_not_to_know") return "declared";
  if (disclosed.category === null || disclosed.withheld_reason_key !== null) return "withheld";
  return "threshold";
}

/** What the screen shows once the entry state and any stored or just-made choice are known. */
export type ThresholdView = "choose" | "result" | "closed-counsellor" | "closed-notyet";

export function viewFor(choice: ThresholdChoice | null): ThresholdView {
  switch (choice) {
    case "now":
      return "result";
    case "counsellor":
      return "closed-counsellor";
    case "notyet":
      return "closed-notyet";
    default:
      return "choose";
  }
}

/** Minimal Storage surface, so tests can pass a plain object and the browser passes window.localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ThresholdStores {
  /** Survives the session: "now" and "counsellor". */
  local: KeyValueStore | null;
  /** Gone with the tab: "not yet", so the question is asked again next session. */
  session: KeyValueStore | null;
}

/** One key per lens (persona) and case, so two people on one browser never share a choice. */
export const thresholdKey = (personaId: string, coupleId: string): string => `bayan.threshold.${personaId}.${coupleId}`;

function isStored(value: string | null): value is "now" | "counsellor" | "notyet" {
  return value === "now" || value === "counsellor" || value === "notyet";
}

/** Reads the stored choice. Storage can throw (private mode, blocked cookies): that reads as "no choice stored". */
export function readStoredChoice(stores: ThresholdStores, personaId: string, coupleId: string): ThresholdChoice | null {
  const key = thresholdKey(personaId, coupleId);
  try {
    const fromSession = stores.session?.getItem(key) ?? null;
    if (fromSession === "notyet") return "notyet";
    const fromLocal = stores.local?.getItem(key) ?? null;
    return isStored(fromLocal) && fromLocal !== "notyet" ? fromLocal : null;
  } catch {
    return null;
  }
}

/**
 * Persists a choice where the spec says. "rntk" is never stored here: the server holds it (PUT right-not-to-know), and
 * a stale local "now" is cleared so a later withdrawal comes back to the threshold, not straight to the result.
 */
export function persistChoice(stores: ThresholdStores, personaId: string, coupleId: string, choice: ThresholdChoice): void {
  const key = thresholdKey(personaId, coupleId);
  try {
    stores.local?.removeItem(key);
    stores.session?.removeItem(key);
    if (choice === "now" || choice === "counsellor") stores.local?.setItem(key, choice);
    if (choice === "notyet") stores.session?.setItem(key, "notyet");
  } catch {
    // Storage unavailable: the choice still applies for this visit (component state); it is just not remembered.
  }
}

/** "Change how I meet it": forget the stored choice so the threshold shows again. */
export function clearChoice(stores: ThresholdStores, personaId: string, coupleId: string): void {
  const key = thresholdKey(personaId, coupleId);
  try {
    stores.local?.removeItem(key);
    stores.session?.removeItem(key);
  } catch {
    // Nothing stored that could be cleared.
  }
}

/** The browser's stores, or null ones where access throws (a blocked-storage browser). Call only in the browser. */
export function browserStores(): ThresholdStores {
  let local: KeyValueStore | null = null;
  let session: KeyValueStore | null = null;
  try {
    local = window.localStorage;
  } catch {
    local = null;
  }
  try {
    session = window.sessionStorage;
  } catch {
    session = null;
  }
  return { local, session };
}
