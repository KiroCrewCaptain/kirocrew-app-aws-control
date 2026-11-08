"""The aws-control app's providers for Kiro Crew's registration seams.

Kiro Crew core asks three questions only this app can answer, and never imports
the app to ask them (``kiro_crew.apps.seams``):

* ``crew_runtime``: where the crew container runtime's Docker build context is
  (``crew/runtime/``), and the digest the image cache keys a crew bundle on
  (``crew/packaging/build.py``);
* ``aws_account_policy``: which AWS profile an account-level paid service runs
  under, and what kind of sign-in a profile uses (``backend/accounts.py``);
* ``transfer_staging``: a private directory under the sandbox-masked transfer
  root, for a file the AWS CLI must read by name (``backend/storage.py``).

The built-in answered from a ``seams.py`` core imported on its first lookup. An
installed app has no such hook, so :func:`register` is called from this app's
``on_startup`` (the path ``kiro_crew.apps.seams`` documents for an installed
app), through the gateway's registry resolved by name in ``_host``. The id is the
manifest name, the same one the built-in registered under, so an adopted copy
replaces the built-in's providers rather than colliding with them.

Every provider method looks its target up on the owning module at call time, so
a test that patches that module's function patches what core reaches too. A
provider answers whether or not the app is enabled, as the built-in's did.
"""

from __future__ import annotations

import importlib
import importlib.util
import sys
from contextlib import AbstractContextManager
from pathlib import Path
from types import ModuleType
from typing import Any

#: The manifest name, which is the id every seam records its provider under.
APP_ID = "aws-control"

#: The app's root directory (the parent of ``backend/``).
APP_ROOT = Path(__file__).resolve().parents[1]

#: The crew container runtime: the Docker build context the remote-crew images are
#: built from (``Dockerfile``, ``Dockerfile.crew``, ``Dockerfile.microvm``,
#: ``container/``, ``vendor/``).
CREW_RUNTIME_DIR = APP_ROOT / "crew" / "runtime"

#: The crew bundle producer's package directory.
CREW_PACKAGING_DIR = APP_ROOT / "crew" / "packaging"


def _crew_packaging_build() -> ModuleType:
    """``crew/packaging/build.py``, imported as a submodule of its own package.

    In the gateway the app's tree is a synthetic package, so the producer is a
    relative import away. Under a plain test run ``backend`` is a top-level package
    and has no parent to import from, so the producer's package is loaded from its
    directory under a private name instead. Either way it is the same file, and its
    pipeline owners resolve relative to it.
    """
    parent = (__package__ or "").rpartition(".")[0]
    if parent:
        return importlib.import_module(f"{parent}.crew.packaging.build")
    name = "_aws_control_crew_packaging"
    if name not in sys.modules:
        spec = importlib.util.spec_from_file_location(
            name,
            CREW_PACKAGING_DIR / "__init__.py",
            submodule_search_locations=[str(CREW_PACKAGING_DIR)],
        )
        if spec is None or spec.loader is None:
            raise ImportError(f"cannot load the crew bundle producer from {CREW_PACKAGING_DIR}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
    return importlib.import_module(f"{name}.build")


class _CrewRuntime:
    """``kiro_crew.apps.seams.CrewRuntime``, from ``crew/``."""

    @property
    def runtime_dir(self) -> Path:
        return CREW_RUNTIME_DIR

    def bundle_digest(self, bundle_dir: Path) -> str:
        return _crew_packaging_build().bundle_digest(bundle_dir)


class _AwsAccountPolicy:
    """``kiro_crew.apps.seams.AwsAccountPolicy``, from ``backend/accounts.py``."""

    async def resolve_consent_target(self) -> tuple[str, str] | None:
        from . import accounts

        return await accounts.resolve_consent_target()

    async def configured_region(self, profile: str) -> str:
        from . import accounts

        return await accounts.configured_region(profile)

    async def is_sso_profile(self, profile: str) -> bool:
        from . import accounts

        return await accounts.classify_profile(profile) == accounts.KIND_SSO


class _TransferStaging:
    """``kiro_crew.apps.seams.TransferStaging``, from ``backend/storage.py``."""

    def pinned_staging(self, prefix: str) -> AbstractContextManager[tuple[Path, int]]:
        from . import storage

        return storage.pinned_staging(prefix)


#: seam constant name on ``kiro_crew.apps.seams`` -> the provider this app gives it.
PROVIDERS: dict[str, Any] = {
    "SEAM_CREW_RUNTIME": _CrewRuntime(),
    "SEAM_AWS_ACCOUNT_POLICY": _AwsAccountPolicy(),
    "SEAM_TRANSFER_STAGING": _TransferStaging(),
}


def register(registry: Any) -> list[str]:
    """Register every provider on *registry* (``kiro_crew.apps.seams``).

    Returns the seams that could not be registered, each with its reason: a
    registry without the seam's name, or one that refuses this app because another
    app already holds the seam. Never raises, so one refused seam does not take the
    app's routes and backups down with it.
    """
    problems: list[str] = []
    register_fn = getattr(registry, "register", None)
    if not callable(register_fn):
        return [f"{name}: no seam registry on this Kiro Crew" for name in PROVIDERS]
    for constant, provider in PROVIDERS.items():
        seam = getattr(registry, constant, None)
        if not isinstance(seam, str):
            problems.append(f"{constant}: this Kiro Crew has no such seam")
            continue
        try:
            register_fn(seam, APP_ID, provider)
        except ValueError as exc:
            problems.append(f"{seam}: {exc}")
    return problems
