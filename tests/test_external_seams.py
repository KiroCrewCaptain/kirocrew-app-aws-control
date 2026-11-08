"""What changed in the move from built-in to installed app, pinned.

* ``register_routes(ctx)`` returns structural ``Route`` records for the
  ``RouteRegistry`` (relative paths, ``(request, ctx)`` handlers) and binds *ctx*;
  on a host that lacks a host function or the seam level, every path answers 503
  ``host_unavailable`` and ``ctx.health`` names the gap.
* The enabled check is ``ctx.lifecycle.is_enabled()``; without the seam the app
  reads as off.
* The owner check is ``ctx.require_owner``; without it every caller is refused.
* The durable jobs come from ``ctx.job``.
* SEL writes go through ``ctx.audit.record`` with the ``aws_control.`` prefix
  dropped (the host namespaces the operation itself).
* ``on_startup`` registers the three core seams this app provides, and does
  nothing on a host that lacks what the app needs.
* The consent routes hand the request to Kiro Crew's consent handlers for ``s3`` /
  ``ce`` only.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
from unittest.mock import AsyncMock

import harness
import pytest
from aiohttp import web
from aiohttp.test_utils import make_mocked_request

from backend import _host, hooks, routes, seams


def _payload(response: web.StreamResponse) -> dict:
    return json.loads(response.body.decode("utf-8"))  # type: ignore[attr-defined]


def _owner_request(method: str, path: str, *, body: bytes | None = None) -> web.Request:
    app = web.Application()
    app["state"] = SimpleNamespace(owner_id="owner-1")
    req = make_mocked_request(method, f"{harness.PREFIX}{path}", app=app, payload=None)
    req["app"] = ""
    req["user"] = "owner-1"
    if body is not None:
        req._read_bytes = body  # what aiohttp keeps after the first read
    return req


class TestRouteRecords:
    def test_records_are_relative_and_called_with_request_and_ctx(self, bound_ctx):
        records = routes.register_routes(bound_ctx)
        assert len(records) == 35
        for record in records:
            assert record.method in {"GET", "POST", "DELETE"}
            assert record.path.startswith("/") and not record.path.startswith("/api/")
            assert callable(record.handler)
        assert _host.context() is bound_ctx

    def test_the_table_is_the_builtins_plus_the_consent_card(self, bound_ctx):
        paths = [(r.method, r.path) for r in routes.register_routes(bound_ctx)]
        assert paths[0] == ("GET", "/accounts")
        assert paths[-3:] == [("GET", "/consent"), ("POST", "/consent"), ("DELETE", "/consent")]
        assert len(set(paths)) == len(paths)

    def test_registering_creates_no_files(self, bound_ctx, _isolated_home):
        routes.register_routes(bound_ctx)
        assert not (Path(_isolated_home) / "apps").exists()

    def test_a_host_missing_a_function_serves_only_refusals(self, bound_ctx):
        with mock.patch.object(_host, "missing", return_value=["kiro_crew.deploy.engine"]):
            records = routes.register_routes(bound_ctx)
        assert bound_ctx.health.status == "degraded"
        assert "kiro_crew.deploy.engine" in bound_ctx.health.issues[0]
        response = asyncio.run(records[0].handler(_owner_request("GET", "/accounts"), bound_ctx))
        assert response.status == 503
        assert _payload(response)["code"] == "host_unavailable"

    def test_a_host_below_level_2_serves_only_refusals(self):
        ctx = harness.make_ctx(sdk_level=1)
        records = routes.register_routes(ctx)
        assert ctx.health.status == "degraded"
        assert "seam level 2" in ctx.health.issues[0]
        response = asyncio.run(records[0].handler(_owner_request("GET", "/accounts"), ctx))
        assert response.status == 503


class TestLifecycleGate:
    def test_the_switch_is_the_lifecycle_seam(self, bound_ctx):
        bound_ctx.lifecycle = SimpleNamespace(is_enabled=lambda: True)
        assert _host.is_app_enabled("aws-control") is True
        bound_ctx.lifecycle = SimpleNamespace(is_enabled=lambda: False)
        assert _host.is_app_enabled("aws-control") is False

    def test_no_seam_or_a_failing_seam_reads_as_off(self, bound_ctx):
        bound_ctx.lifecycle = None
        assert _host.is_app_enabled("aws-control") is False

        def _boom() -> bool:
            raise OSError("unreadable")

        bound_ctx.lifecycle = SimpleNamespace(is_enabled=_boom)
        assert _host.is_app_enabled("aws-control") is False

    def test_another_apps_name_is_never_on(self, bound_ctx):
        bound_ctx.lifecycle = SimpleNamespace(is_enabled=lambda: True)
        assert _host.is_app_enabled("personal-shopper") is False

    def test_a_disabled_app_refuses_through_the_seam(self, bound_ctx):
        bound_ctx.lifecycle = SimpleNamespace(is_enabled=lambda: False)
        handlers = harness.registered(bound_ctx)
        response = asyncio.run(handlers[("GET", "/accounts")](_owner_request("GET", "/accounts")))
        assert response.status == 403
        assert _payload(response)["code"] == "app_disabled"


class TestOwnerGate:
    def test_without_the_seam_everyone_is_refused(self):
        _host.bind(SimpleNamespace())
        response = asyncio.run(_host.require_owner(_owner_request("GET", "/accounts"), "access"))
        assert response is not None and response.status == 403
        assert _payload(response)["code"] == "owner_only"

    def test_the_owner_passes_the_hosts_gate(self, bound_ctx):
        assert (
            asyncio.run(_host.require_owner(_owner_request("GET", "/accounts"), "access")) is None
        )


#: An audit resource string naming the documentation account (built, not written out).
RESOURCES = "account=" + "1111" + "2222" + "3333"


class TestJobsAndAudit:
    def test_the_job_sdk_is_the_bound_contexts(self, bound_ctx):
        sentinel = object()
        bound_ctx.job = sentinel
        assert _host.get_sdk("aws-control") is sentinel
        assert _host.get_sdk("other") is None

    def test_an_audit_row_goes_through_ctx_audit_without_the_old_prefix(self, bound_ctx):
        rows: list[tuple] = []
        bound_ctx.audit = SimpleNamespace(record=lambda *a, **k: rows.append((a, k)))
        _host.sel().log_api_access(
            caller="aws-control-nightly",
            operation="aws_control.backup_upload",
            outcome="success",
            source="aws-control",
            resources=RESOURCES,
        )
        assert rows == [(("backup_upload", "success"), {"resources": RESOURCES, "error": ""})]

    def test_an_audit_seam_that_raises_never_reaches_the_caller(self, bound_ctx):
        def _boom(*_a, **_k):
            raise RuntimeError("sink down")

        bound_ctx.audit = SimpleNamespace(record=_boom)
        _host.sel().log_api_access(operation="aws_control.x", outcome="error")


class TestStartup:
    def test_on_startup_registers_the_three_core_seams(self, bound_ctx):
        registered: list[tuple] = []
        fake = SimpleNamespace(
            SEAM_CREW_RUNTIME="crew_runtime",
            SEAM_AWS_ACCOUNT_POLICY="aws_account_policy",
            SEAM_TRANSFER_STAGING="transfer_staging",
            register=lambda seam, app, provider: registered.append((seam, app, provider)),
        )

        async def _drive() -> None:
            hooks._task = None
            with (
                mock.patch.object(_host, "seam_registry", return_value=fake),
                mock.patch.object(hooks, "_loop", AsyncMock()),
                mock.patch.object(hooks.backup_mod, "clear_stop"),
            ):
                await hooks.on_startup(bound_ctx)
            with mock.patch.object(hooks.backup_mod, "signal_stop"):
                await hooks.on_shutdown(bound_ctx)

        asyncio.run(_drive())
        assert [(s, a) for s, a, _p in registered] == [
            ("crew_runtime", "aws-control"),
            ("aws_account_policy", "aws-control"),
            ("transfer_staging", "aws-control"),
        ]
        assert registered[0][2].runtime_dir == seams.CREW_RUNTIME_DIR
        assert (seams.CREW_RUNTIME_DIR / "Dockerfile").is_file()

    def test_a_seam_another_app_holds_is_reported_not_raised(self, bound_ctx):
        def _refuse(seam, app, provider):
            raise ValueError(f"seam {seam!r} is already provided by app 'other'")

        fake = SimpleNamespace(
            SEAM_CREW_RUNTIME="crew_runtime",
            SEAM_AWS_ACCOUNT_POLICY="aws_account_policy",
            SEAM_TRANSFER_STAGING="transfer_staging",
            register=_refuse,
        )
        problems = seams.register(fake)
        assert len(problems) == 3 and "already provided" in problems[0]

    def test_on_startup_on_a_host_without_the_seams_starts_nothing(self):
        ctx = harness.make_ctx(sdk_level=1)

        async def _drive() -> None:
            hooks._task = None
            with mock.patch.object(hooks, "_register_job_runners", AsyncMock()) as runners:
                await hooks.on_startup(ctx)
            assert runners.await_count == 0
            assert hooks._task is None

        asyncio.run(_drive())
        assert ctx.health.status == "degraded"

    def test_the_crew_bundle_digest_is_this_trees_producer(self, tmp_path):
        build = seams._crew_packaging_build()
        assert Path(build.__file__).resolve() == (seams.CREW_PACKAGING_DIR / "build.py").resolve()
        assert callable(build.bundle_digest)


class TestConsentRoutes:
    @pytest.fixture
    def handlers(self, bound_ctx):
        bound_ctx.lifecycle = SimpleNamespace(is_enabled=lambda: True)
        return harness.registered(bound_ctx)

    @pytest.mark.parametrize("service", ["s3", "ce"])
    def test_the_apps_services_go_to_the_hosts_handlers(self, handlers, service):
        ok = web.json_response({"ok": True})
        base = "kiro_crew.dashboard.handlers.aws_consent"
        with (
            mock.patch(f"{base}.api_aws_consent_get", AsyncMock(return_value=ok)) as get,
            mock.patch(f"{base}.api_aws_consent_post", AsyncMock(return_value=ok)) as post,
            mock.patch(f"{base}.api_aws_consent_delete", AsyncMock(return_value=ok)) as delete,
        ):
            req = _owner_request("GET", f"/consent?service={service}")
            assert asyncio.run(handlers[("GET", "/consent")](req)).status == 200
            get.assert_awaited_once_with(req)
            body = json.dumps({"service": service, "expectedAccount": "1"}).encode()
            req = _owner_request("POST", "/consent", body=body)
            assert asyncio.run(handlers[("POST", "/consent")](req)).status == 200
            post.assert_awaited_once_with(req)
            req = _owner_request("DELETE", f"/consent?service={service}")
            assert asyncio.run(handlers[("DELETE", "/consent")](req)).status == 200
            delete.assert_awaited_once_with(req)

    @pytest.mark.parametrize("service", ["polly", "transcribe", "bedrock-kb", "", "S3"])
    def test_any_other_service_is_refused_before_the_host(self, handlers, service):
        base = "kiro_crew.dashboard.handlers.aws_consent"
        with (
            mock.patch(f"{base}.api_aws_consent_get", AsyncMock()) as get,
            mock.patch(f"{base}.api_aws_consent_post", AsyncMock()) as post,
            mock.patch(f"{base}.api_aws_consent_delete", AsyncMock()) as delete,
        ):
            for method in ("GET", "DELETE"):
                resp = asyncio.run(
                    handlers[(method, "/consent")](
                        _owner_request(method, f"/consent?service={service}")
                    )
                )
                assert resp.status == 400 and _payload(resp)["code"] == "unknown_service"
            body = json.dumps({"service": service}).encode()
            resp = asyncio.run(
                handlers[("POST", "/consent")](_owner_request("POST", "/consent", body=body))
            )
            assert resp.status == 400
            resp = asyncio.run(
                handlers[("POST", "/consent")](_owner_request("POST", "/consent", body=b"not json"))
            )
            assert resp.status == 400
        assert get.await_count == post.await_count == delete.await_count == 0

    def test_a_non_owner_never_reaches_the_host(self, handlers):
        req = _owner_request("GET", "/consent?service=s3")
        req["user"] = "someone-else"
        with mock.patch(
            "kiro_crew.dashboard.handlers.aws_consent.api_aws_consent_get", AsyncMock()
        ) as get:
            resp = asyncio.run(handlers[("GET", "/consent")](req))
        assert resp.status == 403
        assert get.await_count == 0
