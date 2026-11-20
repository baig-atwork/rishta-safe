import { notFound } from "next/navigation";

/**
 * Catch-all for any URL under a locale that no route matches. Without it Next.js renders its unstyled root 404 outside
 * the shell; calling notFound() here renders `[locale]/not-found.tsx` inside the layout (header, rail, footer).
 */
export default function UnmatchedRoute(): never {
  notFound();
}
