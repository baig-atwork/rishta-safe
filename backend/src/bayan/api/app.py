"""Application factory: wires the lane services, mounts every router, maps errors to RFC 9457.

Controller-owned. Lanes expose `build_*_service` functions and `router` objects; this module
only composes them. A lane whose service is not built yet is skipped in dev and fatal in demo/prod.
"""

from __future__ import annotations

import importlib
import pkgutil
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from bayan.api.wiring import build_and_seed
from bayan.core.clock import Clock, PinnableClock
from bayan.core.config import Settings, get_settings
from bayan.core.errors import BayanError
from bayan.core.types import Role
from bayan.governance.deps import require_roles

log = structlog.get_logger("bayan.api")

PROBLEM_JSON = "application/problem+json"
# The haematology aid is a clinician-facing aid (never shown to couples): role-guard the router.
ROUTER_DEPENDENCIES: dict[str, list[Any]] = {
    "haem": [Depends(require_roles(Role.CLINICIAN, Role.COUNSELLOR, Role.JUDGE))],
}
VERSION = "0.1.0"


def _problem(
    request: Request, status: int, code: str, title: str, detail: str, **extra: Any
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"https://bayan.invalid/problems/{code}",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
        "instance": str(request.url.path),
        "correlation_id": getattr(request.state, "correlation_id", None),
    }
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON)


async def _bayan_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, BayanError)
    return _problem(request, exc.status, exc.code, exc.__class__.__name__, exc.detail, **exc.extra)


async def _validation_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [
        {"loc": [str(p) for p in e["loc"]], "msg": e["msg"], "type": e["type"]}
        for e in exc.errors()
    ]
    return _problem(
        request,
        422,
        "validation_error",
        "Validation failed",
        "The request is not valid.",
        errors=errors,
    )


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_error", path=request.url.path, error=type(exc).__name__)
    return _problem(
        request, 500, "internal_error", "Internal error", "Something went wrong on our side."
    )


def _mount_routers(app: FastAPI) -> list[str]:
    import bayan.api.routers as routers_pkg

    mounted: list[str] = []
    seen: set[tuple[str, str]] = set()
    for info in pkgutil.iter_modules(routers_pkg.__path__):
        module = importlib.import_module(f"bayan.api.routers.{info.name}")
        router = getattr(module, "router", None)
        if not isinstance(router, APIRouter):
            continue
        for route in router.routes:
            path = getattr(route, "path", "")
            for method in getattr(route, "methods", None) or set():
                key = (method, path)
                if key in seen:
                    raise RuntimeError(f"duplicate route {method} {path} (module {info.name})")
                seen.add(key)
            if not path.startswith("/v1/") and path != "/v1":
                raise RuntimeError(f"route {path} in {info.name} must start with /v1")
        app.include_router(router, dependencies=ROUTER_DEPENDENCIES.get(info.name, []))
        mounted.append(info.name)
    return mounted


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    settings = settings or get_settings()
    clock = clock or PinnableClock()
    app = FastAPI(
        title="Rishta Safe API",
        version=VERSION,
        summary="Couple-result companion for the UAE premarital genetic screening pathway (synthetic data).",
        description=(
            "Prototype on made-up data. Not a medical device. Education and decision support only; "
            "complex findings go to an accredited professional."
        ),
        docs_url="/docs" if settings.demo_mode else None,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.clock = clock

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    @app.middleware("http")
    async def correlation(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        cid = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.correlation_id = cid
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(correlation_id=cid)
        response = await call_next(request)
        response.headers["x-request-id"] = cid
        response.headers["cache-control"] = "no-store"
        response.headers["x-content-type-options"] = "nosniff"
        return response

    app.add_exception_handler(BayanError, _bayan_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(Exception, _unhandled_handler)

    built = build_and_seed(app)
    mounted = _mount_routers(app)
    app.state.built_services = built
    app.state.mounted_routers = mounted

    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz", include_in_schema=False)
    async def readyz() -> dict[str, Any]:
        return {"status": "ready", "services": built, "routers": mounted}

    @app.get("/version", include_in_schema=False)
    async def version() -> dict[str, str]:
        return {"version": VERSION, "env": settings.env, "data": "synthetic"}

    log.info("app_ready", services=built, routers=mounted)
    return app
