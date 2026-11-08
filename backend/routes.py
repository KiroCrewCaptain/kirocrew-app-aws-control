"""HTTP routes for AWS Control, served in-process by the gateway.

``register_routes(ctx)`` is the manifest's ``backend.hooks.routes`` hook: it
returns one record per route and the gateway's ``RouteRegistry`` serves them
under ``/api/apps/aws-control/``, the built-in's URLs. The registry takes the
routes down while the app is disabled; every handler still checks the switch
itself (``ctx.lifecycle``), as the built-in did.

Surface (owner-only throughout, see below):

READS
``GET /accounts``                              aggregated account list (?refresh=1)
``GET /profiles/available``                    local profiles, with registered flags
``GET /profiles/{name}/reconnect-plan``        what Reconnect can offer, no action
``GET /drive/{account}``                       drive presence + cached usage
``GET /drive/{account}/list``                  one listing page (?section&path&token)
``GET /drive/{account}/download``              short-lived download URL (?section&key)
``GET /drive/{account}/preview``               first bytes of a text file (?section&key)
``GET /drive/{account}/search``                filename search in a section (?section&q)
``GET /costs/{account}``                       cached bill (?refresh=1 re-queries CE)
``GET /library/{account}``                     local artifacts + reconciled push state
``GET /backup/{account}``                      backup state + remote archive listing
``GET /shares``                                live share ledger, objects checked (?account=)
``GET /iam-policy``                            drive-tier policy JSON (local render)

MUTATIONS (also restricted-session refused + SEL-audited)
``POST /profiles/register``                    add local profiles to the registry
``POST /profiles/unregister``                  drop profiles from the registry only
``POST /drive/{account}/bootstrap``            create the bucket (two-call confirm)
``POST /drive/{account}/upload``               upload one file (?section&key, raw body)
``POST /drive/{account}/delete``               delete one object
``POST /drive/{account}/move``                 move one object (drive section only)
``POST /drive/{account}/folder``               create an empty folder (placeholder)
``POST /drive/{account}/folder/delete``        delete a folder and all its objects
``POST /drive/{account}/share``                mint a presigned share + ledger entry
``POST /shares/{id}/forget``                   drop a ledger entry (link lives to expiry)
``POST /library/{account}/push``               push one artifact to the cloud library
``POST /library/{account}/remove``             delete a cloud copy + forget its record
``POST /backup/{account}/run``                 run a backup (snapshot | sessions)
``POST /backup/{account}/nightly``             toggle the nightly snapshot
``POST /backup/{account}/retention``           set or clear the retention count
``POST /backup/{account}/nightly-sessions``    toggle the nightly sessions archive
``POST /backup/{account}/layer-b``             permit unredacted context in the sessions archive
``POST /backup/{account}/restore``             download an archive to the staging dir
``POST /install/label``                        rename THIS install (display only, local)

CONSENT (the page's paid-service card; handed to Kiro Crew's own handlers)
``GET /consent``                               what s3 / ce would bill (?service)
``POST /consent``                              confirm it (echoes what was shown)
``DELETE /consent``                            withdraw it (?service)

GUARDS, in order, and why each exists:

1. **Enabled check** (``ctx.lifecycle.is_enabled``) — a disabled app answers
   403 ``app_disabled`` to everyone, so a probe cannot tell "app off" from "not for you".
2. **Owner-only, INCLUDING reads.** Account ids and caller ARNs are what the
   keystone-fenced consent leaf is fenced FROM; a surface printing them for
   any authenticated app token would hand out through one door what is
   locked behind another. The host's own owner gate (``ctx.require_owner``)
   encodes the rule, the same predicate ``aws_consent`` and ``mcp_apps`` use.
3. **Consent** — every handler that reaches AWS calls
   ``aws_consent.refuse_and_log`` (``s3`` or ``ce``) with the profile+region
   it is about to use. Fails closed; the page renders the consent card.
4. **Restricted-session refusal + SEL audit** on every mutation, matching
   the deploy handlers' discipline.
5. **Two-call confirm on billable resource creation** (bucket bootstrap):
   the first call returns a preview, only ``{"confirm": true}`` executes.
   There is no agent path to these endpoints at all (guard 2), so the
   dashboard click IS the human confirmation the spec's G1 requires.
"""

# This module is the AWS Control routes' registration table and their facade: every
# name is reached as ``backend.routes.<name>``.
# A read is served by the owner that binds the name, and a write -- ``monkeypatch.setattr``,
# ``mock.patch`` -- reaches every owner holding it (:mod:`kiro_crew._facade_mirror`), so a
# test patches this module and never an owner. Owners never import this module. New
# work goes to the owner of its responsibility:
#
#   ``routes_parts.common`` -- limits, locks, error responses, the audit, the handler
#       wrappers, the request targets, and the re-check a queued write runs
#   ``routes_parts.accounts`` -- accounts, reconnect plans, the profile registry, the
#       bill and the IAM policy
#   ``routes_parts.drive`` -- drive status and bootstrap, and listing, download,
#       preview and search
#   ``routes_parts.drive_writes`` -- upload, delete, move, folders, and share links
#   ``routes_parts.library`` -- the reconciled cloud library, and push and remove
#   ``routes_parts.backups`` -- backup status, runs, toggles, retention, Layer B,
#       restore and the install label

from __future__ import annotations

import importlib as _importlib
import sys as _sys
from typing import TYPE_CHECKING, Any

from aiohttp import web

from . import _host
from ._host import _facade_mirror
from .routes_parts.accounts import (
    _handle_accounts,
    _handle_costs,
    _handle_iam_policy,
    _handle_profiles_available,
    _handle_profiles_register,
    _handle_profiles_unregister,
    _handle_reconnect_plan,
)
from .routes_parts.backups import (
    _handle_backup_layer_b,
    _handle_backup_nightly,
    _handle_backup_nightly_sessions,
    _handle_backup_restore,
    _handle_backup_retention,
    _handle_backup_run,
    _handle_backup_status,
    _handle_install_label,
)
from .routes_parts.common import Handler, _guarded, _mutating
from .routes_parts.consent import (
    _handle_consent_delete,
    _handle_consent_get,
    _handle_consent_post,
)
from .routes_parts.drive import (
    _handle_drive_bootstrap,
    _handle_drive_download,
    _handle_drive_list,
    _handle_drive_preview,
    _handle_drive_search,
    _handle_drive_status,
)
from .routes_parts.drive_writes import (
    _handle_drive_delete,
    _handle_drive_folder_create,
    _handle_drive_folder_delete,
    _handle_drive_move,
    _handle_drive_share,
    _handle_drive_upload,
    _handle_share_forget,
    _handle_shares_list,
)
from .routes_parts.library import (
    _handle_library_list,
    _handle_library_push,
    _handle_library_remove,
)


def route_table() -> tuple[tuple[str, str, Handler], ...]:
    """Every route, as the built-in registered it, in its order.

    Method, path under ``/api/apps/aws-control``, and the handler with its guards.
    Built per call, at registration, as the built-in's ``register_routes`` wrapped
    its handlers, so a handler patched before registration is the one served.
    """
    return (
        ("GET", "/accounts", _guarded(_handle_accounts)),
        ("GET", "/profiles/available", _guarded(_handle_profiles_available)),
        ("GET", "/profiles/{name}/reconnect-plan", _guarded(_handle_reconnect_plan)),
        ("GET", "/drive/{account}", _guarded(_handle_drive_status)),
        ("GET", "/drive/{account}/list", _guarded(_handle_drive_list)),
        ("GET", "/drive/{account}/download", _guarded(_handle_drive_download)),
        ("GET", "/drive/{account}/preview", _guarded(_handle_drive_preview)),
        ("GET", "/drive/{account}/search", _guarded(_handle_drive_search)),
        ("GET", "/costs/{account}", _guarded(_handle_costs)),
        ("GET", "/library/{account}", _guarded(_handle_library_list)),
        ("GET", "/backup/{account}", _guarded(_handle_backup_status)),
        ("GET", "/shares", _guarded(_handle_shares_list)),
        ("GET", "/iam-policy", _guarded(_handle_iam_policy)),
        (
            "POST",
            "/profiles/register",
            _guarded(_mutating("profiles_register")(_handle_profiles_register)),
        ),
        (
            "POST",
            "/profiles/unregister",
            _guarded(_mutating("profiles_unregister")(_handle_profiles_unregister)),
        ),
        (
            "POST",
            "/drive/{account}/bootstrap",
            _guarded(_mutating("drive_bootstrap")(_handle_drive_bootstrap)),
        ),
        (
            "POST",
            "/drive/{account}/upload",
            _guarded(_mutating("drive_upload")(_handle_drive_upload)),
        ),
        (
            "POST",
            "/drive/{account}/delete",
            _guarded(_mutating("drive_delete")(_handle_drive_delete)),
        ),
        ("POST", "/drive/{account}/move", _guarded(_mutating("drive_move")(_handle_drive_move))),
        (
            "POST",
            "/drive/{account}/folder",
            _guarded(_mutating("drive_folder_create")(_handle_drive_folder_create)),
        ),
        (
            "POST",
            "/drive/{account}/folder/delete",
            _guarded(_mutating("drive_folder_delete")(_handle_drive_folder_delete)),
        ),
        ("POST", "/drive/{account}/share", _guarded(_mutating("drive_share")(_handle_drive_share))),
        ("POST", "/shares/{id}/forget", _guarded(_mutating("share_forget")(_handle_share_forget))),
        (
            "POST",
            "/library/{account}/push",
            _guarded(_mutating("library_push")(_handle_library_push)),
        ),
        (
            "POST",
            "/library/{account}/remove",
            _guarded(_mutating("library_remove")(_handle_library_remove)),
        ),
        ("POST", "/backup/{account}/run", _guarded(_mutating("backup_run")(_handle_backup_run))),
        (
            "POST",
            "/backup/{account}/nightly",
            _guarded(_mutating("backup_nightly")(_handle_backup_nightly)),
        ),
        (
            "POST",
            "/backup/{account}/retention",
            _guarded(_mutating("backup_retention")(_handle_backup_retention)),
        ),
        (
            "POST",
            "/backup/{account}/nightly-sessions",
            _guarded(_mutating("backup_nightly_sessions")(_handle_backup_nightly_sessions)),
        ),
        (
            "POST",
            "/backup/{account}/layer-b",
            _guarded(_mutating("backup_layer_b")(_handle_backup_layer_b)),
        ),
        (
            "POST",
            "/backup/{account}/restore",
            _guarded(_mutating("backup_restore")(_handle_backup_restore)),
        ),
        ("POST", "/install/label", _guarded(_mutating("install_label")(_handle_install_label))),
        ("GET", "/consent", _guarded(_handle_consent_get)),
        ("POST", "/consent", _guarded(_mutating("consent_grant")(_handle_consent_post))),
        ("DELETE", "/consent", _guarded(_mutating("consent_revoke")(_handle_consent_delete))),
    )


def _adapt(handler: Handler) -> _host.Handler:
    """A ``(request)`` handler as the ``(request, ctx)`` record the registry calls."""

    async def _routed(request: web.Request, ctx: Any) -> web.StreamResponse:  # noqa: ARG001
        return await handler(request)

    _routed.__name__ = getattr(handler, "__name__", "_routed")
    _routed.__wrapped__ = handler  # type: ignore[attr-defined]
    return _routed


def _host_unavailable_handler(gaps: list[str]) -> _host.Handler:
    async def _refused(request: web.Request, ctx: Any) -> web.StreamResponse:  # noqa: ARG001
        return web.json_response(
            {
                "error": "this Kiro Crew does not provide what AWS Control needs",
                "code": "host_unavailable",
                "missing": gaps,
            },
            status=503,
        )

    return _refused


def register_routes(ctx: Any) -> list[_host.Route]:
    """The ``backend.hooks.routes`` hook: bind *ctx* and return the route records.

    The gateway's ``RouteRegistry`` serves them under ``/api/apps/aws-control/``,
    the built-in's URLs, and takes them down while the app is disabled. Each handler
    still checks the switch itself (``ctx.lifecycle``), as the built-in did.

    On a gateway that lacks a host function this app needs, or a seam level below
    the one it is written against, every path answers 503 ``host_unavailable``
    naming what is missing, and ``ctx.health`` says so: nothing is served from a
    stand-in.
    """
    _host.bind(ctx)
    gaps = _host.missing()
    level = _host.sdk_level(ctx)
    if level < _host.REQUIRED_SDK_LEVEL:
        gaps = gaps + [f"App Kit seam level {_host.REQUIRED_SDK_LEVEL} (this host: {level})"]
    if gaps:
        health = getattr(ctx, "health", None)
        mark = getattr(health, "mark_degraded", None)
        if callable(mark):
            mark("AWS Control is off on this Kiro Crew; missing: " + ", ".join(gaps))
        refused = _host_unavailable_handler(gaps)
        return [_host.Route(method, path, refused) for method, path, _h in route_table()]
    return [_host.Route(method, path, _adapt(handler)) for method, path, handler in route_table()]


#: Owner modules, lowest layer first: the first holder of a name answers its reads.
_OWNERS = (
    f"{__package__}.routes_parts.common",
    f"{__package__}.routes_parts.accounts",
    f"{__package__}.routes_parts.drive",
    f"{__package__}.routes_parts.drive_writes",
    f"{__package__}.routes_parts.library",
    f"{__package__}.routes_parts.backups",
    f"{__package__}.routes_parts.consent",
)
for _owner in _OWNERS:
    _importlib.import_module(_owner)
#: Name the facade serves but does not bind -> the owner that answers a read of it.
_EXPORTS: dict[str, str] = {}
_EXPORTS.update(_facade_mirror.install(_sys.modules[__name__], _OWNERS, excluded=()).served)
_sys.modules[__name__].__class__ = _facade_mirror.MirroredModule
#: What a star import binds: every public name of the unsplit module's namespace.
__all__ = sorted(n for n in set(globals()) | set(_EXPORTS) if not n.startswith("_"))

if TYPE_CHECKING:  # every owner-defined name in _EXPORTS, for type checkers and IDEs
    from .routes_parts.accounts import _MAX_REGISTERED  # noqa: F401
    from .routes_parts.backups import _account_jobs, _job_view, _toggle_nightly  # noqa: F401
    from .routes_parts.common import (  # noqa: F401
        _DOWNLOAD_URL_SECS,
        _LIBRARY_RECONCILE_LOCK_WAIT_SECS,
        _MAX_UPLOAD_BYTES,
        _PREVIEW_MAX_BYTES,
        _PREVIEW_REDACT_LOOKAHEAD,
        _PREVIEW_TRIM_SEARCH,
        _PUBLISH_PROVIDER_ID,
        _USAGE_TTL_SECS,
        APP_NAME,
        _account_target,
        _audit,
        _audit_sync,
        _aws_failed,
        _bad_request,
        _body,
        _bootstrap_lock,
        _conflict,
        _consent,
        _drive_bucket,
        _drive_key_lock_refs,
        _drive_key_lock_unref,
        _drive_key_locks,
        _drive_section_lock,
        _drive_section_locks,
        _forbidden,
        _ledger_corrupt,
        _library_lock,
        _locked_drive_keys,
        _locked_drive_sweep,
        _locked_drive_write,
        _not_found,
        _publish_gate,
        _reauthorize_in_lock,
        _resolve_target,
        _response_code,
        _safe_error,
        _SectionRWLock,
        _unavailable,
        _unsupported,
        _usage_cache,
        _valid_section,
        logger,
    )
    from .routes_parts.drive import _redact_preview, _require_drive, _trim_preview  # noqa: F401
    from .routes_parts.drive_writes import (  # noqa: F401
        _TLS_POLICY_CHECKED,
        _confirm_tls_policy,
        _drive_object_keys,
    )
    from .routes_parts.library import _reconciled_remote_slugs  # noqa: F401


if TYPE_CHECKING:  # names it serves from outside the family, from their homes
    from ._host import aws_consent  # noqa: F401
    from . import accounts as accounts_mod  # noqa: F401
    from . import backup as backup_mod  # noqa: F401
    from . import costs as costs_mod  # noqa: F401
    from . import library as library_mod  # noqa: F401
    from . import shares as shares_mod  # noqa: F401
    from . import storage as storage_mod  # noqa: F401
    from ._host import JobError  # noqa: F401
    from ._host import UnknownJobKind  # noqa: F401
    from ._host import get_sdk as get_job_sdk  # noqa: F401
    from ._host import is_app_enabled  # noqa: F401
    from ._host import body_int  # noqa: F401
    from ._host import profiles as deploy_profiles  # noqa: F401
    from ._host import AWSError  # noqa: F401
    from ._host import LoopBoundLock  # noqa: F401
    from ._host import publish_denied_reason  # noqa: F401
    from ._host import redact_credentials  # noqa: F401
    from ._host import redact_exfiltration_urls  # noqa: F401
    from ._host import sel  # noqa: F401
