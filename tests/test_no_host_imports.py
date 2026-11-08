"""Only the host shim reaches Kiro Crew, only through ``importlib``, and only by its table.

The gateway's public surface for an app is the ``AppContext`` its hooks get and the
structural route records the registry accepts. AWS Control also calls gateway
functions no App Kit seam provides yet (the AWS CLI chokepoint, the paid-service
consent gate, the profile registry, the snapshot engine, the credential redactors,
the sandbox's mask answers, the security event log's internal-read audit;
PORTING.md lists each). Those are resolved from the running gateway in
``backend/_host.py`` alone, by name through ``importlib``, each with a refusing
stand-in, so a missing one refuses the work instead of breaking the module load. No
other backend module may import ``kiro_crew`` in any form or name one of its
modules, and the shim has no ``kiro_crew`` import statement. The table is pinned
here, so a new reach into the host cannot be added without this test (and
PORTING.md) changing.

``crew/`` is not covered: its bundle producer is a host-side tool and its runtime is
the container image's program, and both import Kiro Crew as a library on purpose
(PORTING.md, "The crew tree").
"""

from __future__ import annotations

import ast
import re
import tempfile
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
_SHIM = "_host.py"

#: module -> names. Each row is a gap PORTING.md names with the seam it needs.
PINNED_HOST_IMPORTS: dict[str, tuple[str, ...]] = {
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


def _host_imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found += [a.name for a in node.names if a.name.split(".")[0] == "kiro_crew"]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if node.module.split(".")[0] == "kiro_crew":
                found.append(node.module)
        elif isinstance(node, ast.Call):
            name = getattr(node.func, "attr", None) or getattr(node.func, "id", None)
            if name in {"import_module", "__import__"} and node.args:
                arg = node.args[0]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    if arg.value.split(".")[0] == "kiro_crew":
                        found.append(arg.value)
    return found


def _host_strings(path: Path) -> list[str]:
    """String literals naming a ``kiro_crew`` module (what the resolver is handed)."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and re.fullmatch(r"kiro_crew(\.[a-z_]+)*", node.value)
    ]


class TestNoHostImports(unittest.TestCase):
    def test_no_backend_module_but_the_host_shim_reaches_kiro_crew(self) -> None:
        files = sorted(BACKEND.rglob("*.py"))
        self.assertTrue(files, "no backend modules found")
        for path in files:
            if path.name == _SHIM and path.parent == BACKEND:
                continue
            with self.subTest(module=path.relative_to(BACKEND.parent).as_posix()):
                self.assertEqual(_host_imports(path), [])
                self.assertEqual(_host_strings(path), [])

    def test_the_host_shim_has_no_import_statement_for_kiro_crew(self) -> None:
        self.assertEqual(_host_imports(BACKEND / _SHIM), [])

    def test_the_host_table_is_pinned(self) -> None:
        from backend import _host

        self.assertEqual(_host.HOST_IMPORTS, PINNED_HOST_IMPORTS)

    def test_the_shim_names_only_modules_in_its_table(self) -> None:
        named = set(_host_strings(BACKEND / _SHIM))
        self.assertEqual(named, set(PINNED_HOST_IMPORTS))

    def test_every_pinned_name_exists_on_the_pinned_kiro_crew(self) -> None:
        """A rename in Kiro Crew shows up here, not as a quiet stand-in in production."""
        from backend import _host

        self.assertEqual(_host.missing(), [])

    def test_the_scan_sees_each_import_form(self) -> None:
        """The detector itself: every spelling it must catch is caught."""
        source = (
            "import kiro_crew\n"
            "import kiro_crew.apps as a\n"
            "from kiro_crew.executors import run_in_embed_pool\n"
            "import importlib\n"
            "importlib.import_module('kiro_crew.embeddings')\n"
            "__import__('kiro_crew')\n"
            "from . import kiro_crew_like\n"
            "import kiro_crewish\n"
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "probe.py"
            path.write_text(source, encoding="utf-8")
            self.assertEqual(
                _host_imports(path),
                [
                    "kiro_crew",
                    "kiro_crew.apps",
                    "kiro_crew.executors",
                    "kiro_crew.embeddings",
                    "kiro_crew",
                ],
            )


if __name__ == "__main__":
    unittest.main()
