# syntax=docker/dockerfile:1
#
# Rishta Safe web image (Next.js standalone). The build context is frontend/ and the Dockerfile lives in infra/docker/:
#
#   docker build -f infra/docker/frontend.Dockerfile -t bayan-web:dev frontend
#
# Three stages: `deps` installs the locked dependencies, `build` runs `pnpm build` (the frontend sets output: 'standalone'),
# `runtime` is the standalone server alone, run as the unprivileged `node` user. The runtime holds no package manager.

# node:24-trixie-slim is Node 24.22.3 (Active LTS line; frontend/package.json says engines.node >=24), pinned by the
# multi-arch index digest (resolved 2026-11-20 with `docker buildx imagetools inspect node:24-trixie-slim`). Tag and digest
# move together, deliberately, never by a floating tag.
ARG NODE_IMAGE=node:24-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# pnpm is installed at the version package.json's `packageManager` field names, read from the file itself, so the image
# cannot drift from what the frontend lane and CI use.
COPY package.json ./
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" \
    && pnpm --version
# pnpm-workspace.yaml and .npmrc carry pnpm settings (build-script approvals, release-age rules); the globs let the build
# work whether or not they exist.
COPY pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
RUN --mount=type=cache,id=bayan-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
# The API address the server-side proxy forwards to. `next build` may inline anything read from process.env while it
# builds (rewrites() in next.config is evaluated at build time and stored in the routes manifest), so the build is given
# the same value the runtime uses. A route handler that reads process.env at request time does not depend on it.
ARG BAYAN_API_URL=http://api:8000
ENV BAYAN_API_URL=${BAYAN_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
# public/ is optional in a Next app; the runtime stage copies it, so it must exist.
RUN mkdir -p public
RUN pnpm build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
# The runtime runs `node server.js` and nothing else. The base image's package managers (npm, corepack, yarn) are not
# needed and carry their own bundled dependencies, which scanners report against the image. The build stages keep them.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /opt/yarn-v1.22.22 /usr/local/bin/yarn /usr/local/bin/yarnpkg
# BAYAN_API_URL is read by the server at request time. The default is the compose service name; Azure sets it to the
# internal FQDN of bayan-api (infra/bicep).
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    BAYAN_API_URL=http://api:8000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
# Docker and docker compose use this. Azure Container Apps ignores it and uses the probes in infra/bicep. Node's own fetch,
# because the image has no curl or wget. `/` follows the locale redirect and answers 200 once the server is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]
