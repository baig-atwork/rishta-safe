import { useSyncExternalStore } from "react";

/** Phone widths: two columns and long tables do not fit. The server and the first client render say false. */
export const NARROW_QUERY = "(max-width: 759px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const snapshot = (): boolean => typeof window.matchMedia === "function" && window.matchMedia(NARROW_QUERY).matches;

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
