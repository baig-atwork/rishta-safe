import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Precompiling the ICU messages at build time keeps the ICU parser (intl-messageformat, about 12 KB gzip) out of the
// browser bundle; the client formats with icu-minify instead. Catalogs are src/messages/<locale>/<area>.json.
const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    messages: { path: "./src/messages", format: "json", locales: [], precompile: true },
  },
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // The infra lane's Dockerfile copies .next/standalone, .next/static and public.
  // BAYAN_DIST_DIR lets parallel agents build and serve from separate folders (default .next, which the Dockerfile expects).
  distDir: process.env["BAYAN_DIST_DIR"] ?? ".next",
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
