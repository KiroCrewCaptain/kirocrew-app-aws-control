"""The backend suite's floor: its helpers on ``sys.path`` and a bound hook context.

The isolated host (data home, AWS config, git) is the repository's root
``conftest.py``. Here:

* ``tests`` is on the path, because the built-in's suite imports its helpers by
  bare name (``from aws_control_backup_helpers import ...``).
* Every test runs with a context bound the way ``register_routes`` and
  ``on_startup`` bind the gateway's: the host's own audit sink, scrubber and owner
  gate, a lifecycle that reads the host's install record, and a data directory
  that follows ``KIROCREW_HOME``. A test that models a gateway without one of them
  replaces it.
* This app's seam providers are registered on the host's registry, as
  ``on_startup`` registers them.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parent
if str(TESTS) not in sys.path:
    sys.path.insert(0, str(TESTS))


@pytest.fixture(autouse=True)
def bound_ctx(_isolated_home: Path):
    """The context ``register_routes`` / ``on_startup`` would bind, for every test."""
    from harness import make_ctx

    from backend import _host

    ctx = make_ctx()
    previous = _host.context()
    _host.bind(ctx)
    yield ctx
    _host.bind(previous)


@pytest.fixture(scope="session", autouse=True)
def _this_app_provides_the_core_seams():
    """Register this app's seam providers, as ``on_startup`` does in the gateway.

    The pinned Kiro Crew still ships the built-in, whose ``seams.py`` registers the
    same three seams under the same app id the first time any seam is looked up.
    That load is forced first, so this registration replaces it rather than being
    replaced by it, and core's callers (the consent card's account policy, the crew
    runtime, transfer staging) reach this repository's code, the code under test.
    """
    from backend import _host, seams

    registry = _host.seam_registry()
    registry.provider(registry.SEAM_CREW_RUNTIME)
    assert seams.register(registry) == []
    yield
