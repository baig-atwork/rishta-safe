# 0161: Pin TypeScript 6.0.3 and ESLint 9.39.5, not the newest majors

Status: accepted (2026-11-20). Lane D (frontend).

## Context

Looked up today with `pnpm view`: `typescript` latest is 7.0.2 (the native port) and `eslint` latest is 10.15.0. Checked the peer ranges of what the stack depends on: `typescript-eslint` 8.73.0 declares `typescript >=4.8.4 <6.1.0`; `eslint-plugin-jsx-a11y` 6.10.2 (latest, a required a11y gate) declares `eslint ^3 || ... || ^9`; `eslint-config-next` 16.4.6 brings both. TypeScript 7 does not ship the JavaScript compiler API that `typescript-eslint` and Next's build-time type check call.

## Decision

TypeScript `6.0.3` (the last JavaScript-API release line) and ESLint `9.39.5`. All versions are exact pins in `package.json`. Other pins looked up the same day: Next.js 16.4.6, React 19.3.1, Tailwind 4.3.5, Motion 14.14.0, Vitest 5.1.1, Vite 8.3.8, Playwright 1.65.1, `@axe-core/playwright` 4.14.0, Zod 4.6.7, `@base-ui/react` 1.9.0 (`next-intl`, TanStack Query and three others are pinned one release older, see the addendum).

## Consequences

Strict type checking and the jsx-a11y gate keep working. Revisit when `typescript-eslint` lists TS 7 and `eslint-plugin-jsx-a11y` lists ESLint 10 in their peer ranges; `tsgo` can be added for type checking alone earlier if build time becomes a problem.

## Addendum (2026-11-20): pnpm 11 supply-chain policy

A clean `pnpm install --frozen-lockfile` under pnpm 11.5 enforces `minimumReleaseAge` (24 h) and deny-by-default build scripts. The first lockfile pinned the newest releases, eight of which were under a day old (`next-intl` 4.15.3 and its new `@eloqnt/extractor` and `@eloqnt/messages` dependencies, `@tanstack/react-query` and `query-core` 5.108.1, `@testing-library/jest-dom` 8.0.0, `lucide-react` 1.76.0, `tailwind-merge` 3.7.1). Decision: do not weaken the policy; pin the five direct dependencies to the newest release older than 48 hours (`next-intl` 4.15.1, `@tanstack/react-query` 5.108.0, `@testing-library/jest-dom` 7.0.1, `lucide-react` 1.74.0, `tailwind-merge` 3.7.0), which also drops the two new transitive packages, and regenerate the lockfile. `frontend/pnpm-workspace.yaml` uses `allowBuilds` to deny the build scripts of `@parcel/watcher` and `@swc/core` explicitly (neither is needed). No `minimumReleaseAgeExclude` entries exist. Revisit the pins when the newer releases are a few days old and a release note shows a reason to move.
