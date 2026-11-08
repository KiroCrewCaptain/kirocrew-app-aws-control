"""Serve the backend the way the gateway's RouteRegistry does, and build its context.

The registry mounts one catch-all at ``/api/apps/{app_name}/{path}``, matches the
remainder against each route record, injects path params into ``match_info`` and
calls ``handler(request, ctx)``. :func:`mount` does the same on a test's own
``web.Application``, with aiohttp's router doing the matching under the same
prefix, so a test request uses the URL a dashboard request uses.

:func:`make_ctx` builds the context at App Kit level 2 with the host's real
``AuditSDK`` and ``ScrubSDK`` (Kiro Crew is a pinned test dependency), the host's
own owner gate, and a lifecycle whose ``is_enabled`` asks the host's install
record, so a fresh test home reads the app as off, as it did for the built-in.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from aiohttp import web

APP_NAME = "aws-control"
PREFIX = f"/api/apps/{APP_NAME}"


class FakeHealth:
    def __init__(self) -> None:
        self.status = "healthy"
        self.issues: list[str] = []

    def mark_degraded(self, issue: str) -> None:
        self.status = "degraded"
        self.issues.append(issue)


class HostLifecycle:
    """``ctx.lifecycle`` over the host's install record, read at call time.

    Looked up per call so a test that patches ``kiro_crew.apps.manager.is_app_enabled``
    (as the built-in's suite did) reaches it.
    """

    def __init__(self, name: str) -> None:
        self.name = name

    def is_enabled(self) -> bool:
        from kiro_crew.apps import manager

        return bool(manager.is_app_enabled(self.name))


@dataclass
class FakeCtx:
    """The hook context, as ``AppContext`` shapes it, for one test."""

    name: str = APP_NAME
    sdk_level: int = 2
    scrub: Any = None
    audit: Any = None
    job: Any = None
    lifecycle: Any = None
    http_app: Any = None
    health: FakeHealth = field(default_factory=FakeHealth)
    fixed_data_dir: Path | None = None

    async def require_owner(self, request: web.Request, operation: str) -> Any:
        """The host's own level-1 owner gate (``AppContext.require_owner``), unchanged."""
        from kiro_crew.apps.context import AppContext

        return await AppContext.require_owner(self, request, operation)  # type: ignore[arg-type]

    @property
    def data_dir(self) -> Path:
        """The host's ``app_data_dir(<name>)``, read on every access.

        Computed the way the gateway computes ``ctx.data_dir``. Read per access because
        the built-in's suite moves ``KIROCREW_HOME`` per test, often in ``setUp``.
        """
        if self.fixed_data_dir is not None:
            return self.fixed_data_dir
        from kiro_crew.apps.manager import app_data_dir

        return Path(app_data_dir(self.name))


def make_ctx(**overrides: Any) -> FakeCtx:
    from kiro_crew.apps.audit_sdk import AuditSDK
    from kiro_crew.apps.scrub_sdk import ScrubSDK

    values: dict[str, Any] = {
        "scrub": ScrubSDK(),
        "audit": AuditSDK(APP_NAME),
        "lifecycle": HostLifecycle(APP_NAME),
    }
    values.update(overrides)
    return FakeCtx(**values)


def routes(ctx: Any = None) -> list[Any]:
    """``register_routes(ctx)``, with the bound context when *ctx* is ``None``."""
    from backend import _host, routes as routes_mod

    previous = _host.context()
    records = routes_mod.register_routes(ctx if ctx is not None else previous)
    if ctx is not None and previous is not None:
        _host.bind(previous)
    return records


def registered(ctx: Any = None) -> dict[tuple[str, str], Callable[[web.Request], Any]]:
    """``{(method, path): handler(request)}`` for every route record.

    The built-in's suite read ``app.router`` after ``register_routes(app)`` and called
    a handler with one request. A record's handler takes ``(request, ctx)``; this binds
    the context so a test still calls it with the request alone.
    """
    from backend import _host

    bound = ctx if ctx is not None else _host.context()

    def _one(handler: Any) -> Callable[[web.Request], Any]:
        async def _call(request: web.Request) -> Any:
            return await handler(request, bound)

        return _call

    return {(r.method, r.path): _one(r.handler) for r in routes(ctx)}


def mount(app: web.Application, ctx: Any = None) -> None:
    """Add every route record to *app* under :data:`PREFIX`, as the registry serves it."""
    for path_method, handler in registered(ctx).items():
        method, path = path_method
        app.router.add_route(method, f"{PREFIX}{path}", handler)
