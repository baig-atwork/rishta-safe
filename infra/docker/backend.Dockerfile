# syntax=docker/dockerfile:1
#
# Rishta Safe API image. The build context is backend/ and the Dockerfile lives in infra/docker/:
#
#   docker build -f infra/docker/backend.Dockerfile -t bayan-api:dev backend
#
# Two stages. `build` installs the locked runtime dependencies and the project (no dev group, not editable) into a
# virtualenv with uv. `runtime` is the same Python base plus that virtualenv, run as an unprivileged user. Neither uv nor
# a compiler ships, and pip is removed (nothing installs at run time).
#
# Everything the app reads at run time (the YAML under bayan/data) is package data inside the installed wheel, so the
# virtualenv is the whole application.

# python:3.13-slim-trixie is Python 3.13.18, pinned by the multi-arch index digest (resolved 2026-11-20 with
# `docker buildx imagetools inspect python:3.13-slim-trixie`). Both stages use it. Tag and digest move together,
# deliberately, never by a floating tag.
ARG PYTHON_IMAGE=python:3.13-slim-trixie@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90

# uv 0.13.7: the version the lockfile was written with and that CI and the controller's machine use (pyproject pins the
# build backend to uv_build >=0.13.7,<0.14). Index digest resolved 2026-11-20. 0.13.9 exists (released 2026-11-17) and is
# deliberately not taken yet: tool parity first, a patch bump is a dependency-sweep item (docs/parking-lot.md).
FROM ghcr.io/astral-sh/uv:0.13.7@sha256:96f40d3904aad8d0bd010539001d36c8e2188b981e1334471a90c4a1d93bb490 AS uv

FROM ${PYTHON_IMAGE} AS build

COPY --from=uv /uv /uvx /bin/

# Bytecode is compiled once, here, and not on every cold start. Copy mode because the uv cache mount is another
# filesystem. Never download an interpreter: the base image's Python is the one that runs the app.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

# The virtualenv lands in /app/.venv and the runtime stage copies it to the same path, so its shebangs stay valid.
WORKDIR /app

# Dependencies first: this layer is rebuilt only when pyproject.toml or uv.lock change.
# --locked (not --frozen): fail if uv.lock is out of date with pyproject.toml, instead of silently installing from a stale
# lock. Both resolve exactly the versions in uv.lock; --locked only adds that freshness check.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project --no-editable

COPY src/ src/

# The project itself, as a regular (non-editable) install, so the virtualenv does not depend on /app/src.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable


FROM ${PYTHON_IMAGE} AS runtime

ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# python:slim ships pip in /usr/local and pip vendors its own copies of certifi, urllib3 and others, which security scanners
# report against the image even though uv.lock locks different versions. The virtualenv holds no pip and nothing installs
# at run time, so pip goes.
RUN /usr/local/bin/python -m pip uninstall --yes pip

# A named user (not just a uid): some libraries look the current uid up in /etc/passwd. No home, no login shell.
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin app

COPY --from=build /app/.venv /app/.venv

USER 10001:10001

EXPOSE 8000

# Docker and docker compose use this. Azure Container Apps ignores it and uses the probes in infra/bicep. Python's own HTTP
# client, because python:slim has no curl or wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4).status == 200 else 1)"]

# --proxy-headers with --forwarded-allow-ips "*": the Container Apps ingress (and, locally, the compose network) terminates
# TLS and sets X-Forwarded-For and X-Forwarded-Proto, and the port is published nowhere else, so the ingress is the only
# peer. Revisit if the container is ever reachable directly: a client could then forge X-Forwarded-For.
CMD ["uvicorn", "bayan.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
