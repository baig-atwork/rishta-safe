# syntax=docker/dockerfile:1
#
# Rishta Safe single-container image: the API and the web server in one container, for hosts that give one free service (and sleep
# it when idle). The build context is the repository root:
#
#   docker build -f infra/docker/combined.Dockerfile -t bayan:combined .
#   docker run --rm -p 3000:3000 -e BAYAN_SESSION_SECRET=local-only bayan:combined
#
# It reuses the pinned bases and the build steps of backend.Dockerfile and frontend.Dockerfile (kept in step by hand; the three
# files carry the same digests). Layout: python base, the API's virtualenv at /app/.venv, the Next.js standalone server at
# /srv/web, and the node binary copied from the pinned node image. combined.entrypoint.py starts both and stops both if either dies.
# The API listens on 127.0.0.1:8000 inside the container and is never published; only the web port (PORT, default 3000) is.

ARG PYTHON_IMAGE=python:3.13-slim-trixie@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90
ARG NODE_IMAGE=node:24-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0

FROM ghcr.io/astral-sh/uv:0.13.7@sha256:96f40d3904aad8d0bd010539001d36c8e2188b981e1334471a90c4a1d93bb490 AS uv

# ---- API virtualenv (same steps as backend.Dockerfile) -------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS api-build
COPY --from=uv /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project --no-editable
COPY backend/src/ src/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

# ---- Web build (same steps as frontend.Dockerfile) -----------------------------------------------------------------------
FROM ${NODE_IMAGE} AS web-deps
WORKDIR /app
COPY frontend/package.json ./
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" \
    && pnpm --version
COPY frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml* frontend/.npmrc* ./
RUN --mount=type=cache,id=bayan-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM web-deps AS web-build
# Inside this container the API is on loopback. next build may inline process.env values (rewrites), so the build gets the
# same address the runtime uses.
ARG BAYAN_API_URL=http://127.0.0.1:8000
ENV BAYAN_API_URL=${BAYAN_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY frontend/ ./
RUN mkdir -p public
RUN pnpm build

# ---- Node binary only (no npm, corepack or yarn ship) --------------------------------------------------------------------
FROM ${NODE_IMAGE} AS node-bin

# ---- Runtime -------------------------------------------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS runtime
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN /usr/local/bin/python -m pip uninstall --yes pip
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin app
COPY --from=node-bin /usr/local/bin/node /usr/local/bin/node
COPY --from=api-build /app/.venv /app/.venv
COPY --from=web-build --chown=app:app /app/.next/standalone /srv/web
COPY --from=web-build --chown=app:app /app/.next/static /srv/web/.next/static
COPY --from=web-build --chown=app:app /app/public /srv/web/public
COPY infra/docker/combined.entrypoint.py /app/entrypoint.py
USER 10001:10001
WORKDIR /srv/web
EXPOSE 3000

# The web port answers once both processes are up (the entrypoint starts the web server only after the API is healthy). Python's
# own HTTP client, because the image has no curl or wget; PORT is read at run time.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["python", "-c", "import os, sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/' % os.environ.get('PORT', '3000'), timeout=4).status == 200 else 1)"]

CMD ["python", "/app/entrypoint.py"]
