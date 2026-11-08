"""The paid-service consent card's three calls, for the page of an installed copy.

The built-in page called Kiro Crew's consent endpoint (``/api/aws/consent``)
directly. An installed app's page may only call the paths its manifest declares,
and this app declares ``/api/apps/aws-control/*`` alone (the built-in's grant, which
an adopted copy may not exceed), so the card's three calls are served here instead,
at ``/api/apps/aws-control/consent``.

Each one hands the request, unchanged, to Kiro Crew's own consent handler: the owner
check, the account echo a confirmation must match, the drift check and the keystone
write are the host's, never a copy. What this module adds is a narrowing: only the
two services this app gates (``s3`` for the drive, ``ce`` for the bill) are passed
on; every other service is refused here with the host's ``unknown_service`` shape,
so the app's page cannot confirm or withdraw a charge for another feature.
"""

from __future__ import annotations

from aiohttp import web

from .. import _host

#: The paid services this app's page confirms: Amazon S3 and Cost Explorer.
APP_SERVICES: frozenset[str] = frozenset({"s3", "ce"})


def _refused() -> web.Response:
    return web.json_response(
        {"error": "aws-control confirms only the s3 and ce services", "code": "unknown_service"},
        status=400,
    )


def _query_service(request: web.Request) -> str:
    return (request.rel_url.query.get("service") or "").strip()


async def _handle_consent_get(request: web.Request) -> web.StreamResponse:
    if _query_service(request) not in APP_SERVICES:
        return _refused()
    return await _host.api_aws_consent_get(request)


async def _handle_consent_post(request: web.Request) -> web.StreamResponse:
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 - a body that is not JSON names no service
        body = None
    service = body.get("service") if isinstance(body, dict) else None
    if not isinstance(service, str) or service.strip() not in APP_SERVICES:
        return _refused()
    # aiohttp keeps the body it read, so the host's handler reads the same bytes.
    return await _host.api_aws_consent_post(request)


async def _handle_consent_delete(request: web.Request) -> web.StreamResponse:
    if _query_service(request) not in APP_SERVICES:
        return _refused()
    return await _host.api_aws_consent_delete(request)
