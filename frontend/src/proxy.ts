import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip the API proxy, Next internals and any file with an extension (fonts, icons).
  // The backslash is doubled on purpose: in a JS string "\." is just ".", which would match every path.
  matcher: ["/((?!api|_next|_vercel|fonts|.*\\..*).*)"],
};
