"""Test floor for every suite in this repository: the app root on ``sys.path`` and an isolated host.

* The gateway loads hook files into a synthetic package named after the app, so
  the backend never needs to be on ``sys.path`` there. A plain pytest run has no
  such loader, so the app root is put on the path and ``backend`` imports as a
  package (and ``crew`` as one, for the crew bundle producer's suite).
* Kiro Crew (a pinned test dependency, ``tests/requirements.txt``) is the host the
  backend resolves through ``backend/_host.py``. Its data home and workspace are
  pinned to a throwaway directory BEFORE anything imports it, and again per test,
  so no test reads or writes the operator's real ``~/.kiro/crew``. The AWS CLI's
  config and credential files point into that directory too, so no test reads the
  operator's real AWS profiles. Git runs with a session-owned global config.
"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

APP_ROOT = Path(__file__).resolve().parent
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

_SESSION_HOME = Path(tempfile.mkdtemp(prefix="kca-aws-control-"))
os.environ["KIROCREW_HOME"] = str(_SESSION_HOME / "crew")
os.environ["KIROCREW_WORKSPACE"] = str(_SESSION_HOME / "workspace")
os.environ["XDG_CONFIG_HOME"] = str(_SESSION_HOME / "xdg")
os.environ["AWS_CONFIG_FILE"] = str(_SESSION_HOME / "aws" / "config")
os.environ["AWS_SHARED_CREDENTIALS_FILE"] = str(_SESSION_HOME / "aws" / "credentials")
for _name in (
    "AWS_PROFILE",
    "AWS_DEFAULT_PROFILE",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
):
    os.environ.pop(_name, None)
_GIT_CONFIG = _SESSION_HOME / "gitconfig"
_GIT_CONFIG.write_text("[maintenance]\n\tauto = false\n[gc]\n\tauto = 0\n", encoding="utf-8")
os.environ["GIT_CONFIG_GLOBAL"] = str(_GIT_CONFIG)
os.environ["GIT_CONFIG_NOSYSTEM"] = "1"
for _name in (
    "GIT_DIR",
    "GIT_INDEX_FILE",
    "GIT_WORK_TREE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
):
    os.environ.pop(_name, None)


def pytest_unconfigure(config: pytest.Config) -> None:
    shutil.rmtree(_SESSION_HOME, ignore_errors=True)


@pytest.fixture
def _floor_monkeypatch():
    """The floor's OWN ``MonkeyPatch``, never the shared ``monkeypatch``.

    As in Kiro Crew's rootdir conftest, which the built-in's suite ran under: a test
    that calls ``monkeypatch.undo()`` mid-way must not also drop the floor's
    ``KIROCREW_HOME`` pin, so the two are undone independently. Several ported tests
    request it by name for their own class-level patches.
    """
    mp = pytest.MonkeyPatch()
    try:
        yield mp
    finally:
        mp.undo()


@pytest.fixture
def monkeypatch(_floor_monkeypatch):
    """pytest's own ``monkeypatch``, ordered AFTER the floor (set up later, undone first)."""
    mp = pytest.MonkeyPatch()
    yield mp
    mp.undo()


@pytest.fixture(autouse=True)
def _isolated_home(tmp_path: Path, _floor_monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "kirocrew-home"
    _floor_monkeypatch.setenv("KIROCREW_HOME", str(home))
    _floor_monkeypatch.setenv("KIROCREW_WORKSPACE", str(tmp_path / "kirocrew-workspace"))
    return home
