/**
 * Whether the visitor asked for reduced motion. Read when an interaction starts (not during render), for the one
 * place where motion changes behaviour rather than just style: a sequence the component paces itself. Pure CSS
 * animations need no check, because the global `prefers-reduced-motion` rule in globals.css neutralises them.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
