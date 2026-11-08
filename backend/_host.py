"""Every place this app reaches into the Kiro Crew gateway, in one module.

An installed app's Python runs inside the gateway process. No other module under
``backend/`` names a ``kiro_crew`` module (``tests/test_no_host_imports.py``); what
the app takes from the gateway comes through this file, in two kinds.

1. **App Kit seams**, read off the hook context with ``getattr`` (feature-detected).
   The context is bound once per enable (:func:`bind`, from ``on_startup`` and from
   ``register_routes``), because the built-in's modules call these from deep inside
   the domain code, far from any handler:

   - ``hooks.routes`` records: :class:`Route`, a local frozen dataclass a level-1
     ``RouteRegistry`` accepts structurally;
   - ``ctx.lifecycle.is_enabled()`` (level 2), as :func:`is_app_enabled`: the app's
     own on/off switch, which every route checks first. Without it the app reads as
     off and every route refuses;
   - ``ctx.require_owner(request, operation)`` (level 1), as :func:`require_owner`:
     the host's owner gate. Without it every caller is refused, the owner included;
   - ``ctx.job`` (``permissions.jobs``), as :func:`get_sdk`: the durable-jobs runtime
     the backups run on. Without it no backup can start;
   - ``ctx.audit.record`` (level 0), as :func:`sel` ``().log_api_access``. Rows read
     caller ``app:aws-control`` and operation ``aws-control.<verb>``;
   - ``ctx.data_dir``, as :func:`app_data_dir`.

2. **Host functions with no App Kit seam yet** (:data:`HOST_IMPORTS`). The built-in
   imported them directly, and the app does nothing without them: the AWS CLI
   chokepoint and its error type (``deploy.engine``), the paid-service consent gate
   (``aws_consent``), the profile registry, the security event log's internal-read
   audit (``hooks``), the snapshot the backup archives, the credential redactors and
   the sandbox's mask answers. They are resolved by name from the running gateway,
   one at a time, each with a stand-in for a gateway that lacks it. **Every stand-in
   refuses**: a missing function raises :class:`HostUnavailable`, a missing exception
   type is a subclass of it, a missing module raises on first use.
   :func:`missing` names what this gateway did not provide; ``register_routes``
   then serves only refusals and ``on_startup`` starts nothing (``ctx.health``
   names the gap). PORTING.md lists each surface with the seam it needs.
"""

from __future__ import annotations

import importlib
import logging
import sqlite3 as _stdlib_sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from aiohttp import web

#: Must equal ``app.json`` ``name``.
APP_NAME = "aws-control"

#: The App Kit seam level this app is written against (``ctx.lifecycle``).
REQUIRED_SDK_LEVEL = 2

logger = logging.getLogger(f"kirocrew.app.{APP_NAME}")

Handler = Callable[[web.Request, Any], Awaitable[web.StreamResponse]]


@dataclass(frozen=True)
class Route:
    """One ``hooks.routes`` record, accepted structurally by the gateway."""

    method: str
    path: str
    handler: Handler


class HostUnavailable(RuntimeError):
    """The running gateway does not provide a host function this work needs."""


# ── the bound hook context ──

_ctx: Any = None


def bind(ctx: Any) -> None:
    """Make *ctx* the context the domain modules read their seams from."""
    global _ctx
    _ctx = ctx


def context() -> Any:
    """The bound hook context, or ``None`` before a hook ran."""
    return _ctx


def sdk_level(ctx: Any = None) -> int:
    """The seam level the gateway reports; 0 for a gateway that predates the field."""
    level = getattr(ctx if ctx is not None else _ctx, "sdk_level", 0)
    return level if isinstance(level, int) and not isinstance(level, bool) else 0


def is_app_enabled(name: str = APP_NAME) -> bool:
    """Whether this app is installed and switched on (``ctx.lifecycle.is_enabled``).

    Blocking (a file read), so the routes call it through ``asyncio.to_thread``, as
    the built-in called the host's ``is_app_enabled``. No bound context, no
    lifecycle seam, a seam that raises, or a name other than this app's: off.
    """
    if name != APP_NAME:
        return False
    lifecycle = getattr(_ctx, "lifecycle", None)
    check = getattr(lifecycle, "is_enabled", None)
    if not callable(check):
        return False
    try:
        return check() is True
    except Exception:  # noqa: BLE001 - an unreadable switch reads as off
        logger.warning(
            "aws-control: the lifecycle seam failed; treating the app as off", exc_info=True
        )
        return False


def _owner_denied() -> web.Response:
    return web.json_response(
        {"error": "owner authorization required", "code": "owner_only"}, status=403
    )


async def require_owner(request: web.Request, operation: str) -> web.StreamResponse | None:
    """``None`` when the caller is the dashboard owner, else the refusal to return.

    *operation* is bare (``"access"``): the host prefixes the app's name when it
    audits a denial. A gateway without the seam refuses everyone.
    """
    gate = getattr(_ctx, "require_owner", None)
    if not callable(gate):
        return _owner_denied()
    return await gate(request, operation)


def get_sdk(name: str = APP_NAME) -> Any:
    """The bound context's durable-jobs SDK (``ctx.job``), or ``None``.

    The built-in looked the SDK up by app name in the host's registry, so a re-enable
    (a fresh context, a fresh SDK) was picked up on the next wake. Rebinding the
    context on every enable does the same here.
    """
    if name != APP_NAME:
        return None
    return getattr(_ctx, "job", None)


def app_data_dir(name: str = APP_NAME) -> Path:
    """This app's data directory: ``ctx.data_dir``.

    Before a context is bound (an import-time read, a CLI process) it is the same
    ``<data home>/apps/<name>/data`` the host computes, through the host's own helper
    (``apps.manager.app_data_dir`` in :data:`HOST_IMPORTS`). Neither: refused.
    """
    if name != APP_NAME:
        raise HostUnavailable(f"{APP_NAME} has no data directory for {name!r}")
    data_dir = getattr(_ctx, "data_dir", None)
    if isinstance(data_dir, Path):
        return data_dir
    host = _lookup("_host_app_data_dir")
    if getattr(host, "_aws_control_stand_in", False):
        raise HostUnavailable("this Kiro Crew does not provide the app data directory")
    return Path(host(name))


class _Audit:
    """``sel().log_api_access(...)`` over ``ctx.audit.record``.

    The built-in's call sites keep their shape. ``caller`` and ``source`` are
    dropped: the host attributes the row to this app itself (``app:aws-control``),
    so an app cannot write a row as anyone else. The built-in's ``aws_control.``
    operation prefix is dropped too, because the host namespaces the operation with
    the app's own name. Never raises, like the SEL write it replaces.
    """

    def log_api_access(
        self,
        *,
        operation: str,
        outcome: str,
        resources: str = "",
        error: str = "",
        caller: str = "",
        source: str = "",
        **_extra: Any,
    ) -> None:
        audit = getattr(_ctx, "audit", None)
        record = getattr(audit, "record", None)
        if not callable(record):
            logger.warning("aws-control: no audit seam; an audit row was not written")
            return
        op = operation.removeprefix("aws_control.")
        try:
            record(op, outcome, resources=resources, error=error)
        except Exception:  # noqa: BLE001 - auditing must not break the operation
            logger.debug("aws-control: audit record failed", exc_info=True)


_AUDIT = _Audit()


def sel() -> _Audit:
    """The audit writer (the name the built-in's call sites use)."""
    return _AUDIT


# ── host functions with no App Kit seam yet ──
#
# module the built-in imported from -> the names this app uses from it. A name may
# be a function, a class, a constant or a submodule, exactly as the built-in's
# ``from <module> import <name>`` read it.
HOST_IMPORTS: dict[str, tuple[str, ...]] = {
    "kiro_crew": (
        "_facade_mirror",
        "aws_consent",
        "hooks",
        "platform_compat",
        "snapshot",
        "snapshot_redact",
    ),
    "kiro_crew._sqlite_compat": ("sqlite3",),
    "kiro_crew.apps.job_sdk": ("JobError", "UnknownJobKind"),
    "kiro_crew.apps.manager": ("app_data_dir",),
    "kiro_crew.apps.seams": (),
    "kiro_crew.artifacts": (
        "ArtifactNotFoundError",
        "ArtifactValidationError",
        "_validate_slug",
        "get_default_store",
    ),
    "kiro_crew.atomic_write": ("atomic_write",),
    "kiro_crew.config.paths": ("data_home", "kiro_sessions_dir"),
    "kiro_crew.dashboard.body_numbers": ("body_int",),
    "kiro_crew.dashboard.handlers.aws_consent": (
        "api_aws_consent_delete",
        "api_aws_consent_get",
        "api_aws_consent_post",
    ),
    "kiro_crew.dashboard.handlers._shared": ("_is_restricted_session",),
    "kiro_crew.deploy": ("engine", "iam", "profiles"),
    "kiro_crew.deploy.engine": ("AWSError", "_checked", "_harden_bucket"),
    "kiro_crew.deploy.scan": ("is_credential_finding", "scan_content"),
    "kiro_crew.history": ("SESSIONS_DIR_NAME",),
    "kiro_crew.identity_stores": ("_store_write_time", "state_db_candidates"),
    "kiro_crew.loop_lock": ("LoopBoundLock",),
    "kiro_crew.owner_only_files": ("mkdirs_owner_only",),
    "kiro_crew.platform.context": ("redact_log_via_context",),
    "kiro_crew.platform_compat": (
        "file_lock",
        "first_linked_ancestor",
        "is_link_or_junction",
        "open_lock_file",
    ),
    "kiro_crew.publish_governance": ("publish_denied_reason",),
    "kiro_crew.sandbox": (
        "carveout_shadowed_by_foreign_mask",
        "crew_home_visible_spellings",
        "effective_sandbox_mode",
    ),
    "kiro_crew.security": (
        "redact",
        "redact_credentials",
        "redact_exfiltration_urls",
        "redact_with_findings",
        "scan_exfiltration_urls",
    ),
    "kiro_crew.snapshot": ("snapshot_main",),
}

#: Host names this module serves under another name, because the public-seam
#: wrapper above owns the plain one.
_RENAMED: dict[tuple[str, str], str] = {
    ("kiro_crew.apps.manager", "app_data_dir"): "_host_app_data_dir",
}

#: Names that are exception types: their stand-in must be catchable.
_EXCEPTIONS = frozenset(
    {"AWSError", "JobError", "UnknownJobKind", "ArtifactNotFoundError", "ArtifactValidationError"}
)

#: Names that are modules: their stand-in raises on the first attribute read.
_MODULES = frozenset(
    {
        "_facade_mirror",
        "aws_consent",
        "hooks",
        "platform_compat",
        "snapshot",
        "snapshot_redact",
        "engine",
        "iam",
        "profiles",
    }
)


class _MissingModule:
    """A host module this gateway does not have: every attribute read refuses."""

    _aws_control_stand_in = True

    def __init__(self, name: str) -> None:
        self.__name = name

    def __getattr__(self, attr: str) -> Any:
        raise HostUnavailable(f"this Kiro Crew does not provide {self.__name}.{attr}")


class _MissingLock:
    """``LoopBoundLock`` on a gateway without it: constructible, refuses on use."""

    _aws_control_stand_in = True

    def __getattr__(self, attr: str) -> Any:
        raise HostUnavailable("this Kiro Crew does not provide loop_lock.LoopBoundLock")


class _MissingConstant(str):
    """A host constant this gateway does not have (an empty string, flagged)."""

    _aws_control_stand_in = True


def _stand_in(module_name: str, name: str) -> Any:
    qualified = f"{module_name}.{name}"
    if name in _EXCEPTIONS:
        return type(name, (HostUnavailable,), {"_aws_control_stand_in": True})
    if name in _MODULES:
        return _MissingModule(qualified)
    if name == "LoopBoundLock":
        return _MissingLock
    if name == "sqlite3":
        # The host's shim only picks a newer SQLite build when one is installed;
        # the standard library's module is the same API.
        return _stdlib_sqlite3
    if name.isupper():
        return _MissingConstant("")

    def refused(*_args: Any, **_kwargs: Any) -> Any:
        raise HostUnavailable(f"this Kiro Crew does not provide {qualified}")

    refused.__name__ = f"refused_{name}"
    refused._aws_control_stand_in = True  # type: ignore[attr-defined]
    return refused


def _resolve_one(module: Any, module_name: str, name: str) -> Any:
    if module is None:
        return None
    value = getattr(module, name, None)
    if value is None:
        try:
            value = importlib.import_module(f"{module_name}.{name}")
        except ImportError:
            return None
    return value


#: exported name -> (module, attribute), built from :data:`HOST_IMPORTS`.
_INDEX: dict[str, tuple[str, str]] = {
    _RENAMED.get((module_name, name), name): (module_name, name)
    for module_name, names in HOST_IMPORTS.items()
    for name in names
}
_STAND_INS_MADE: dict[str, Any] = {}


def _module(module_name: str) -> Any:
    try:
        return importlib.import_module(module_name)
    except ImportError:
        return None


def _lookup(exported: str) -> Any:
    """The host's value for *exported*, read from its module NOW, or its stand-in.

    Read per call rather than bound once, so each ``from ._host import X`` behaves as
    the built-in's ``from kiro_crew.<module> import X`` did at the same place: once at
    import for a module-level import, and on every call for one inside a function
    (where a test's patch of the host module is what the code must see).
    """
    module_name, name = _INDEX[exported]
    value = _resolve_one(_module(module_name), module_name, name)
    if value is None:
        if exported not in _STAND_INS_MADE:
            _STAND_INS_MADE[exported] = _stand_in(module_name, name)
        value = _STAND_INS_MADE[exported]
    return value


def __getattr__(attr: str) -> Any:
    if attr in _INDEX:
        return _lookup(attr)
    raise AttributeError(f"module {__name__!r} has no attribute {attr!r}")


_MISSING: list[str] = []
for _module_name, _names in HOST_IMPORTS.items():
    _probe = _module(_module_name)
    if _probe is None:
        _MISSING.append(_module_name)
        continue
    for _name in _names:
        if _resolve_one(_probe, _module_name, _name) is None:
            _MISSING.append(f"{_module_name}.{_name}")


def missing() -> list[str]:
    """The host modules and names this gateway did not provide, in table order."""
    return list(_MISSING)


def seam_registry() -> Any:
    """``kiro_crew.apps.seams``, or ``None`` on a gateway without the registry."""
    return _module("kiro_crew.apps.seams")
