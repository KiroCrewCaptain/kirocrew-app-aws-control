"""What an existing user's copy of the built-in needs from this repository.

Kiro Crew adopts a user's built-in record onto this repository in place, at a
pinned commit, with no consent dialog, so the tree must be something it can take
over unchanged:

- the same name, permissions, platform and ``defaultEnabled`` as the built-in
  (``tests/fixtures/builtin-app.json`` is its manifest at the commit this was
  ported from). A widened grant would be held back or force the app off, and
  adoption refuses that. The first pinned version is the built-in's; a later one
  may only be higher;
- hook entries that resolve to callables in this tree;
- nothing that needs a build at install time, and no symlinks or file names a
  Windows checkout cannot hold;
- a committed UI bundle that imports only the seven modules the dashboard
  provides, and from the two SDK modules only names the host of
  ``minKiroCrewVersion`` exports (a named import of a missing export fails the
  whole bundle at load);
- ``minKiroCrewVersion`` set to the first Kiro Crew with the seams the backend
  needs (``ctx.lifecycle``, App Kit level 2).
"""

from __future__ import annotations

import importlib
import json
import os
import re
import unittest
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
BUNDLE = APP_ROOT / "ui" / "dist" / "index.mjs"

HOST_MODULES = {
    "react",
    "react-dom",
    "react/jsx-runtime",
    "lucide-react",
    "@tanstack/react-query",
    "@kirocrew/app-sdk",
    "@kirocrew/app-sdk/ui",
}

#: What the host of ``minKiroCrewVersion`` (0.13.0) exports from each SDK module
#: (its ``public/vendor/*.mjs`` stubs) that this bundle may name.
HOST_EXPORTS = {
    "@kirocrew/app-sdk": {
        "useAppApi",
        "useAppEvents",
        "useTheme",
        "useAppInfo",
        "useNavigate",
        "useNotify",
        "useNavBadge",
        "useChatLauncher",
        "AppApiProvider",
        "useImeGuard",
        "useLanguageGeneration",
        "activeLocale",
        "fmtNumber",
        "fmtCurrency",
        "fmtDate",
        "fmtTime",
        "fmtDateTime",
        "fmtRelative",
        "compareText",
        "APP_SDK_LEVEL",
    },
    "@kirocrew/app-sdk/ui": {
        "Card",
        "CardTitle",
        "Btn",
        "SendBtn",
        "Input",
        "SearchInput",
        "Badge",
        "SourceBadge",
        "StatCard",
        "Skeleton",
        "ContentSkeleton",
        "EmptyState",
        "PageHeader",
        "Toggle",
        "InfoTip",
        "SegmentedControl",
        "MarkdownRenderer",
        "Clickable",
        "Modal",
        "ErrorNotice",
        "SettingsSection",
        "SettingsCard",
        "SettingsInput",
        "SettingsToggle",
        "SettingsSelect",
        "Select",
        "guideCaution",
    },
}

_UNTRACKED_DIRS = {".git", "node_modules", "__pycache__", ".pytest_cache", ".venv"}
_WINDOWS_RESERVED = re.compile(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])$", re.IGNORECASE)
_STATIC_IMPORT = re.compile(
    r"^import\s+(?:(?P<clause>[^'\"]+?)\s+from\s+)?[\"'](?P<spec>[^\"']+)[\"'];?\s*$",
    re.MULTILINE,
)
#: A model id a default or a fallback must never hardcode.
_MODEL_ID = re.compile(
    r"(?<![.\w])(?:claude-[a-z0-9]|gpt-[0-9o]|(?:opus|sonnet|haiku|fable)-?[0-9])", re.IGNORECASE
)


def _manifest() -> dict:
    return json.loads((APP_ROOT / "app.json").read_text(encoding="utf-8"))


def _builtin() -> dict:
    return json.loads((APP_ROOT / "tests" / "fixtures" / "builtin-app.json").read_text("utf-8"))


def _semver(version: str) -> tuple[int, int, int]:
    major, minor, patch = (int(part) for part in version.split("."))
    return major, minor, patch


def _text() -> str:
    return BUNDLE.read_text(encoding="utf-8")


def _bundle_imports() -> list[tuple[str, str]]:
    return [(m["spec"], (m["clause"] or "").strip()) for m in _STATIC_IMPORT.finditer(_text())]


def _named(clause: str) -> set[str]:
    match = re.search(r"\{([^}]*)\}", clause)
    if not match:
        return set()
    return {part.split(" as ")[0].strip() for part in match.group(1).split(",") if part.strip()}


def _tree() -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(APP_ROOT):
        dirnames[:] = [d for d in dirnames if d not in _UNTRACKED_DIRS]
        files += [Path(dirpath) / name for name in filenames]
        files += [Path(dirpath) / d for d in dirnames if (Path(dirpath) / d).is_symlink()]
    return files


class TestTheBundle(unittest.TestCase):
    def test_the_entry_the_manifest_names_is_committed(self) -> None:
        ui = _manifest()["ui"]
        self.assertEqual(ui["entry"], "dist/index.mjs")
        self.assertTrue((APP_ROOT / "ui" / ui["entry"]).is_file(), "run `npm run build` in ui/")

    def test_it_imports_only_what_the_host_provides(self) -> None:
        imports = _bundle_imports()
        self.assertTrue(imports, "no import statements found; the scan is broken")
        starts = re.findall(r"^import\b", _text(), re.MULTILINE)
        self.assertEqual(len(starts), len(imports), "an import the scan could not parse")
        self.assertLessEqual({spec for spec, _ in imports}, HOST_MODULES)
        self.assertNotRegex(_text(), r"\bimport\s*\(", "a dynamic import would load a second file")

    def test_named_sdk_imports_exist_on_the_minimum_host(self) -> None:
        for spec, clause in _bundle_imports():
            if spec in HOST_EXPORTS:
                with self.subTest(module=spec):
                    self.assertLessEqual(_named(clause), HOST_EXPORTS[spec])

    def test_no_build_machine_path_is_baked_in(self) -> None:
        self.assertNotRegex(_text(), r"/(?:home|Users|workplace)/|[A-Za-z]:\\\\")

    def test_the_page_calls_only_its_own_api(self) -> None:
        """Every API path in the bundle is under the manifest's ``permissions.api``."""
        paths = set(re.findall(r"[\"'`](/api/[A-Za-z0-9_./-]*)", _text()))
        self.assertTrue(paths, "no API path found; the scan is broken")
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(path.startswith("/api/apps/aws-control"), path)


class TestTheManifest(unittest.TestCase):
    def test_declares_the_first_kiro_crew_with_the_seams(self) -> None:
        self.assertEqual(_manifest().get("minKiroCrewVersion"), "0.13.0")

    def test_what_adoption_compares_is_the_builtins(self) -> None:
        manifest, builtin = _manifest(), _builtin()
        for key in ("name", "permissions", "defaultEnabled", "platform"):
            with self.subTest(field=key):
                self.assertEqual(manifest[key], builtin[key])
        for key in ("agents", "skills", "mcpServers"):
            with self.subTest(absent=key):
                self.assertNotIn(key, builtin)
                self.assertNotIn(key, manifest)

    def test_the_version_never_falls_below_the_builtins(self) -> None:
        """A fix released here bumps the patch so the update badge shows; adoption
        pins this exact version, so a re-pin carries the wheel copy to it as well."""
        self.assertGreaterEqual(
            _semver(_manifest()["version"]), _semver(_builtin()["version"])
        )

    def test_declares_nothing_adoption_cannot_carry(self) -> None:
        manifest = _manifest()
        self.assertNotIn("overlays", manifest["ui"])
        self.assertNotIn("sessionApproval", manifest)
        self.assertNotIn("agentTools", manifest)
        self.assertIs(manifest["defaultEnabled"], False)
        self.assertNotIn("routes", manifest["backend"], "top-level backend.routes is built-in only")

    def test_the_page_carries_no_glyph_of_its_own(self) -> None:
        """The legacy route and sidebar glyph come from Kiro Crew's pin, not from here."""
        self.assertEqual(
            _manifest()["ui"]["pages"], [{"route": "/apps/aws-control", "label": "AWS Control"}]
        )

    def test_every_hook_resolves_to_a_callable_in_this_tree(self) -> None:
        hooks = _manifest()["backend"]["hooks"]
        self.assertEqual(set(hooks), {"routes", "on_startup", "on_shutdown"})
        for name, ref in hooks.items():
            with self.subTest(hook=name):
                module, _, attr = ref.partition(":")
                self.assertTrue((APP_ROOT / (module.replace(".", "/") + ".py")).is_file())
                self.assertTrue(callable(getattr(importlib.import_module(module), attr)))

    def test_the_display_copy_is_the_builtins(self) -> None:
        manifest, builtin = _manifest(), _builtin()
        for key in ("displayName", "description", "highlights", "tags", "author"):
            with self.subTest(field=key):
                self.assertEqual(manifest[key], builtin[key])

    def test_listing_copy_matches_the_bundled_catalogs(self) -> None:
        manifest = _manifest()
        catalogs = {
            p.stem: json.loads(p.read_text(encoding="utf-8"))["apps"]["awsControl"]["manifest"]
            for p in sorted((APP_ROOT / "ui" / "i18n").glob("*.json"))
        }
        english = catalogs.pop("en")
        self.assertEqual(manifest["displayName"], english["display_name"])
        self.assertEqual(manifest["description"], english["description"])
        self.assertEqual(manifest["ui"]["pages"][0]["label"], english["page_label"])
        self.assertEqual(manifest["highlights"], [english[f"highlight_{i}"] for i in range(1, 6)])
        self.assertEqual(set(manifest["l10n"]), set(catalogs))
        for locale, strings in catalogs.items():
            with self.subTest(locale=locale):
                self.assertEqual(
                    manifest["l10n"][locale],
                    {
                        "displayName": strings["display_name"],
                        "description": strings["description"],
                        "pageLabel": strings["page_label"],
                        "highlights": [strings[f"highlight_{i}"] for i in range(1, 6)],
                    },
                )

    def test_art_is_repo_relative_png(self) -> None:
        manifest = _manifest()
        for key in (
            "iconPath",
            "heroImage",
            "heroImageDark",
            "heroImageDetail",
            "heroImageDetailDark",
        ):
            with self.subTest(field=key):
                self.assertRegex(manifest[key], r"^assets/[a-z-]+\.png$")
                self.assertTrue((APP_ROOT / manifest[key]).is_file())
        for shot in manifest["screenshots"]:
            self.assertRegex(shot, r"^assets/[a-z-]+\.png$")
            self.assertTrue((APP_ROOT / shot).is_file())


class TestATreeAdoptionCanTake(unittest.TestCase):
    def test_no_links_and_no_unportable_names(self) -> None:
        for path in _tree():
            rel = path.relative_to(APP_ROOT).as_posix()
            with self.subTest(path=rel):
                self.assertFalse(path.is_symlink(), "a symlink cannot be adopted")
                for part in path.relative_to(APP_ROOT).parts:
                    self.assertIsNone(_WINDOWS_RESERVED.match(part.split(".")[0]))
                    self.assertNotRegex(part, r'[<>:"|?*\\]')

    def test_no_root_build_file(self) -> None:
        """A root requirements.txt / pyproject / package.json makes an install run a build."""
        for name in ("requirements.txt", "pyproject.toml", "setup.py", "package.json"):
            with self.subTest(name=name):
                self.assertFalse((APP_ROOT / name).exists())


class TestNoHardcodedModel(unittest.TestCase):
    def test_no_backend_or_ui_source_names_a_model_id(self) -> None:
        roots = [APP_ROOT / "backend", APP_ROOT / "ui" / "src", APP_ROOT / "app.json"]
        for root in roots:
            files = [root] if root.is_file() else [p for p in root.rglob("*") if p.is_file()]
            for path in files:
                if path.suffix not in {".py", ".ts", ".tsx", ".json"}:
                    continue
                with self.subTest(path=path.relative_to(APP_ROOT).as_posix()):
                    self.assertIsNone(_MODEL_ID.search(path.read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
