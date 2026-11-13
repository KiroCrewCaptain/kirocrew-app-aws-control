# Porting notes: built-in → external app

This repository was ported from Kiro Crew's built-in app at
`src/kiro_crew/apps/builtins/aws_control/` (KiroCrew `main` at `6d07df11cf`):
`backend/`, `hooks.py`, `seams.py`, the whole `crew/` tree (`packaging/`, `runtime/`,
`scripts/`) and `tests/`; its dashboard page at `website/src/apps/aws-control/`; its
store art at `website/public/app-assets/aws-control/`; its backend tests under `test/`
(`test_aws_control_*.py`, the four `aws_control_*_helpers.py`, and the generic
`composition_contract_checks.py` and `named_cases_helpers.py` they import); and its
frontend tests beside the page plus `website/src/test/DrivePage.gridAutoFill.test.tsx`,
`DrivePage.restoreOverwrittenConfirm.test.tsx`, `DrivePage.restoreRecoveredNotice.test.tsx`
and `DrivePageTestUtils.tsx`.

"Gap" means something the built-in gets from Kiro Crew that an installed app has no
public way to get today. Each gap is a Kiro Crew change, not a change here.

Every change to the wheel copy since that commit is carried over here, in the table
below (Kiro Crew's drift guard, #31351, names the commit range to check on the next
change):

| Kiro Crew change | Files here |
|---|---|
| kirodotdev/KiroCrew#33196: both backup kinds register with the Job SDK's `retention=100`, so each keeps at most 100 finished run records; on a host without the option the kind registers uncapped | `backend/hooks.py`, `tests/test_aws_control_hooks.py` |
| kirodotdev/KiroCrew#33304: a failed profile scan on a gateway whose `aws` is AWS CLI v1 (no `configure list-profiles`) answers 501 `unsupported_aws_cli_v1` instead of the retryable 503, and Add accounts names the version with no Try again. `aws_cli_is_v1` asks `aws --version` through the same CLI chokepoint, so it needs no host function newer than the pin | `backend/accounts.py`, `backend/routes_parts/accounts.py`, `ui/src/AwsControlPage.tsx`, `ui/src/types.ts`, `ui/i18n/*.json` (`add_accounts_cli_v1`), `tests/test_aws_control_app_profiles.py`, `ui/tests/AwsControlPage.test.tsx` |
| kirodotdev/KiroCrew#34888: a drive key segment or an install id that ends in a newline is refused (`invalid_key`; a folder named like an install id plus a newline is not an owner), since `$` also matches before a trailing newline and the two patterns now end at `\Z` | `backend/storage.py`, `backend/backup_parts/identity.py`, `tests/test_aws_control_trailing_newline.py` |
| kirodotdev/KiroCrew#24732: the crew bundle's sensitive-path list names `.local/share/mimocode/auth.json`, so that harness's credential file never enters a bundle. The test dependency on Kiro Crew moves to `9b32941be6`, whose shared validator carries the same entry, since the producer's suite refuses a local entry the host does not have | `crew/packaging/pipeline/sensitive.py`, `tests/requirements.txt` |
| kirodotdev/KiroCrew#28535: the crew container forces `sandbox_readonly_paths` and `sandbox_readonly_exceptions` to the gateway's own empty default, so a supplied config file cannot decide them | `crew/runtime/container/supervisor/backend.py` |
| kirodotdev/KiroCrew#26624: the hard-linked staging destination refusal test runs on Windows too | `tests/test_aws_control_storage.py` |

A fix released here bumps the patch version, so an installed copy shows the update.

## What carried over unchanged

- `app.json` `name` (`aws-control`) and `version` (`0.1.0` at the port; a fix
  released here bumps the patch, see above), so adoption maps an existing built-in
  record onto this source one to one; `defaultEnabled` (`false`),
  `platform`, `permissions` (`api` for `/api/apps/aws-control` and
  `/api/apps/aws-control/*`, `storage`, `network`, `jobs`), and every display field.
  `tests/test_manifest_contract.py` compares them with the built-in's manifest
  (`tests/fixtures/builtin-app.json`). The app declares no agents, skills, MCP servers
  or agent tools, as the built-in did not.
- Every route's path, method, validation and response shape, and both guard wrappers
  (`_guarded` on every route, `_mutating` on every write: restricted-session refusal and
  an audit row around each AWS write).
- All of `backend/` apart from the import lines and the changes below: accounts,
  storage, drive, shares, library, costs and the backup engine (`backup.py` and its
  `backup_parts/` owners), with the facade composition that lets a patch of
  `backend.backup` / `backend.routes` / `backend.storage` reach every owner.
- The data location. The gateway hands the hooks `ctx.data_dir =
  <data home>/apps/aws-control/data`, the directory the built-in resolved through
  `app_data_dir("aws-control")`, and every file in it keeps its name (backup state,
  the backup ledger, the share ledger, the install id and label, the Library ledger).
  Everything the app keeps elsewhere is Kiro Crew's and is read where it is: the deploy
  profile registry, the paid-service consent grants (`s3`, `ce`), the
  `aws-control-staging` transfer root, and the durable-jobs records, which the host
  keys by app name.
- The page's client-side state: the `kc:app:aws-control:view` view-state records (the
  drive folder per account), the `['aws-control', ...]` query keys, and the
  `awsControl.selectedAccount` and view-mode `localStorage` keys, so a reader lands
  where they left the built-in.
- The `crew/` tree byte for byte, apart from two test path fixes (below).

## What changed, and why

| Built-in | Here | Why |
|---|---|---|
| `"backend": {"routes": "backend.routes:register_routes", "hooks": {"on_startup": "hooks:on_startup", ...}}` | `"backend": {"hooks": {"routes": "backend.routes:register_routes", "on_startup": "backend.hooks:on_startup", "on_shutdown": "backend.hooks:on_shutdown"}}` | Top-level `backend.routes` is read only by the built-in boot loop. An installed app's routes go through `RouteRegistry`. `hooks.py` moved under `backend/` so every module is a relative import away from the one it needs. |
| `register_routes(app)` adding 32 absolute routes to `app.router` | `register_routes(ctx) -> list[Route]`, relative paths, handlers `(request, ctx)` | The `hooks.routes` contract. `Route` is the app's own frozen dataclass (`backend/_host.py`). The registry serves the records under `/api/apps/aws-control/`, the built-in's URLs. `register_routes` also binds `ctx` for the domain modules. |
| `is_app_enabled("aws-control")` (private `apps.manager`) | `ctx.lifecycle.is_enabled()` (App Kit level 2), through `_host.is_app_enabled` | The public switch. No seam, a failing seam, or another app's name reads as off, so every route refuses. The registry also takes a disabled app's routes down. |
| `is_owner_dashboard_request` + `_owner_denial_response` (private dashboard handlers) | `ctx.require_owner(request, "access")` (level 1) | The host's own owner gate, with the same predicate. App tokens are still refused. The refusal is the host's: a 403 with code `owner_only` (the built-in said `dashboard_owner_required`; the page never branched on it), or a 401 for a stale pre-owner session. |
| `job_sdk.get_sdk("aws-control")` | `ctx.job` of the context bound on the latest enable | `permissions.jobs` (unchanged) is what puts it on the context. A re-enable rebinds, so the nightly loop picks up the fresh SDK as before. |
| `sel().log_api_access(caller=..., operation="aws_control.<op>", source=...)` | `ctx.audit.record("<op>", outcome, resources=..., error=...)` | The level-0 audit seam. Rows read caller `app:aws-control`, operation `aws-control.<op>`. The built-in's `caller` (`dashboard-owner` vs `aws-control-nightly`) has no field on the seam and is not recorded (gap 6). |
| `seams.py` registering three core seams on core's first lookup | `backend/seams.py`, registered by `on_startup` through the host's `kiro_crew.apps.seams.register` under the same id | The path that module documents for an installed app. The id is the manifest name, so an adopted copy replaces the built-in's providers rather than colliding with them. A refusal is reported in `ctx.health`, never raised. |
| `from kiro_crew.apps.builtins.aws_control.backend.X import ...` | `from .X import ...` / `from ..X import ...` | Hook files load into a synthetic package; relative imports are the documented form. |
| Every other `from kiro_crew... import ...` | `from ._host import ...` | See "Private Kiro Crew imports" below. |
| `iconUrl` / `heroImage*` / `heroImageDetail*` as `/app-assets/aws-control/*.svg`, `screenshots` `/app-assets/...` | `iconPath` / `heroImage*` / `heroImageDetail*` / `screenshots` as repo-relative PNGs under `assets/` | A registry app's art is repo-relative, and the catalog's publish step refuses SVG for a non-builtin source. The PNGs were rendered from the built-in SVGs (kept beside them): the icon at 512×512 on an opaque `#ecfeff` tile with `--ico-a` / `--ico-b` fixed to `#22d3ee` / `#0e7490`, the heroes at 1200×675, the detail heroes at 1200×288. |
| `ui.pages` `[{"route": "/aws-control", "label": "AWS Control", "icon": "Cloud"}]`, page compiled into the dashboard | `ui.entry: "dist/index.mjs"` (a committed ESM bundle built from `ui/src/`), `ui.pages` `[{"route": "/apps/aws-control", "label": "AWS Control"}]`, no `icon` | An installed app ships its page as a bundle AppHost loads. The legacy `/aws-control` route and `Cloud` glyph of an ADOPTED record come from Kiro Crew's adoption pin (`legacyNav`), never from this manifest. |
| App Store copy keys in the dashboard catalogs | `l10n` block in `app.json`, one entry per shipped non-English locale | The listing copy travels with the app; it is the `apps.awsControl.manifest` subtree of `ui/i18n/<locale>.json`, kept equal by a test. |
| `"license": "MIT"` | `"license": "Apache-2.0"` | The code is Kiro Crew's, which is Apache-2.0, and so is this repository (`LICENSE`). Adoption does not compare the field. |
| No `minKiroCrewVersion` | `"minKiroCrewVersion": "0.13.0"` | The first Kiro Crew with App Kit level 2 (`ctx.lifecycle`). |
| (none) | `GET` / `POST` / `DELETE /api/apps/aws-control/consent` | The page's paid-service consent card called Kiro Crew's `/api/aws/consent` directly. An installed page may call only the paths its manifest declares, and the built-in declared `/api/apps/aws-control/*` alone, which an adopted copy may not exceed. These three routes hand the request unchanged to Kiro Crew's own consent handlers (the owner check, the account echo, the drift check and the keystone write stay the host's), and only for the app's two services, `s3` and `ce`; any other service is refused with `unknown_service` before the host is reached (`backend/routes_parts/consent.py`, `tests/test_external_seams.py`). |

### On a host that lacks what the app needs

`register_routes` and `on_startup` compare the gateway with what the app needs: every
name in the host table below, and App Kit seam level 2. If anything is missing, every
route answers 503 `host_unavailable` naming it, `on_startup` registers no seam, no job
runner and no nightly loop, and `ctx.health` says why. Nothing is served from a
stand-in. `minKiroCrewVersion` keeps a fresh install off such a gateway; the case that
remains is a Kiro Crew downgraded after adoption, where the built-in copy's own routes
serve the same paths.

## Private Kiro Crew imports: resolved by name in `backend/_host.py`

Nothing else under `backend/` names a `kiro_crew` module
(`tests/test_no_host_imports.py`, which also pins this table). Each row is resolved
from the running gateway by `importlib`, at the same moment the built-in's import ran
(once at import for a module-level import, on every call for one inside a function),
with a refusing stand-in when the gateway lacks it.

| Module | Names | What it is | The seam it needs |
|---|---|---|---|
| `kiro_crew.deploy`, `kiro_crew.deploy.engine` | `engine`, `iam`, `profiles`; `AWSError`, `_checked`, `_harden_bucket` | The single AWS CLI chokepoint every S3 / STS / Cost Explorer call goes through, its error type and bucket hardening; the deploy profile registry the accounts pane lists and edits; the drive-tier IAM policy renderer | An AWS SDK seam (run an AWS CLI call under a named profile; read and edit the profile registry) |
| `kiro_crew.aws_consent` | module | The paid-service consent gate (`refuse_and_log`, `probe_identity`, `GATED_SERVICES`) every handler runs before reaching AWS | A consent seam for an app's own paid services |
| `kiro_crew.dashboard.handlers.aws_consent` | `api_aws_consent_get`, `_post`, `_delete` | The consent card's three handlers, behind the new `/consent` routes | The same consent seam, or the card on the SDK |
| `kiro_crew.dashboard.handlers._shared` | `_is_restricted_session` | The restricted-session refusal every write runs | A public restricted-session predicate on the context |
| `kiro_crew.snapshot`, `kiro_crew.snapshot_redact` | `snapshot_main`, module | The snapshot engine the backup archives, and its redaction | A backup seam |
| `kiro_crew.hooks` | module | `emit_internal_read_audit` for the sessions archive's read of kiro-cli's conversation store, and the no-follow, size-bounded safe reads | A sensitive-store read seam (see gap 2) |
| `kiro_crew.identity_stores`, `kiro_crew.config.paths`, `kiro_crew.history` | `_store_write_time`, `state_db_candidates`; `data_home`, `kiro_sessions_dir`; `SESSIONS_DIR_NAME` | Where the sessions archive finds the transcripts and conversation stores | The backup seam |
| `kiro_crew.sandbox` | `carveout_shadowed_by_foreign_mask`, `crew_home_visible_spellings`, `effective_sandbox_mode` | Whether a backed-up path is masked from agents, so a restore never writes where an agent can read | A sandbox-policy read seam |
| `kiro_crew.security`, `kiro_crew.deploy.scan`, `kiro_crew.platform.context`, `kiro_crew.publish_governance` | `redact`, `redact_credentials`, `redact_exfiltration_urls`, `redact_with_findings`, `scan_exfiltration_urls`; `is_credential_finding`, `scan_content`; `redact_log_via_context`; `publish_denied_reason` | The redactors applied to previews, labels, logs and archive text; the credential scan a Library push must pass; the publish governance a share link must pass | `ctx.scrub` covers outbound text only and returns no findings; these need findings and the publish decision |
| `kiro_crew.artifacts` | `get_default_store`, `_validate_slug`, `ArtifactNotFoundError`, `ArtifactValidationError` | The local artifact library the Library pane pushes from | An artifact-library read seam |
| `kiro_crew.apps.job_sdk` | `JobError`, `UnknownJobKind` | The error types `ctx.job` raises | Export them with the SDK |
| `kiro_crew.apps.seams` | module | The registry the three core seams are registered on | (public by documentation; private by module path) |
| `kiro_crew.apps.manager` | `app_data_dir` | `ctx.data_dir` before a context is bound (an import-time read) | (none needed once every read is in a hook) |
| `kiro_crew.atomic_write`, `kiro_crew.owner_only_files`, `kiro_crew.platform_compat`, `kiro_crew.loop_lock`, `kiro_crew._sqlite_compat`, `kiro_crew._facade_mirror`, `kiro_crew.dashboard.body_numbers` | `atomic_write`; `mkdirs_owner_only`; `file_lock`, `first_linked_ancestor`, `is_link_or_junction`, `open_lock_file`; `LoopBoundLock`; `sqlite3`; module; `body_int` | File, lock, link and body helpers with no policy | A public file/lock helper module in the SDK |

`crew/` is not in the table. Its bundle producer (`crew/packaging/`) is a host-side tool
and its runtime (`crew/runtime/container/`) is the container image's own program; both
import Kiro Crew as a library on purpose, as they did in the wheel.

## The crew tree

`crew/runtime/` is the Docker build context the remote-crew images are built from, and
`crew/packaging/build.py` computes the bundle digest the image cache keys on. Kiro
Crew's MicroVM lane reaches both through the `crew_runtime` seam this app registers,
so after adoption the image is built from this repository's copy. Two test files
changed: `crew/packaging/tests/test_pipeline_composition.py` imports the producer as
`crew.packaging.build` (the repository root, not `src/`, is the import root), and
`crew/runtime/container_tests/test_microvm_guest_hardening.py` reads the MicroVM base
template from the installed `kiro_crew` package instead of a sibling path.

## UI

The page is `ui/src/`, ported from `website/src/apps/aws-control/` with the same
markup, class strings and behaviour. `npm run build` in `ui/` writes the committed
`ui/dist/index.mjs`; CI rebuilds it and fails on a difference. Every dashboard module
the page imported is replaced under `ui/src/host/`:

| Built-in import | Here |
|---|---|
| `components/ui` (`Btn`, `Badge`, `Card`, `CardTitle`, `StatCard`, `Skeleton`, `ContentSkeleton`, `EmptyState`, `Input`, `SearchInput`, `Toggle`), `Clickable`, `SegmentedControl`, `ErrorNotice` | The same components from `@kirocrew/app-sdk/ui` |
| `IconButton`, `FilteredEmpty`, `PanelSectionHeader`, `Checkbox` (`components/ui`) | Restated in `host/ui.tsx` with the same markup; `IconButton` shows its label as a native tooltip instead of the dashboard's instant tip |
| `components/ui/dropdown-menu` (Radix) | `host/dropdown.tsx`: the same five parts and props, a `role="menu"` list that opens on a primary press or Enter / Space / ArrowDown, closes on Escape, an outside press or a choice, and returns focus unless `onCloseAutoFocus` prevents it. No portal and no edge flipping |
| `AwsConsentGate` and `api/client` (`awsConsent`, `grantAwsConsent`, `revokeAwsConsent`) | `host/AwsConsentGate.tsx`, the same component, over `host/coreApi.ts`, which calls the app's own `/consent` routes |
| `api/client` `artifact(slug)` and `library/ArtifactThumbs` (`WidgetThumb`, `ContentThumb`, `ImageThumb`, `WebAppThumb`) | Not available to an installed app: a Library card shows its kind's glyph and label instead of a live preview |
| `library/LibraryTable` (`LibraryTableHead`, `PINNED_SURFACE`) | `host/LibraryTable.tsx`, the non-sorting head the drive's tables use |
| `ContentRenderer` / `FileRenderers` (`detectFileType`) | `host/ContentRenderer.tsx` / `host/FileRenderers.ts`: markdown and code through the SDK's `MarkdownRenderer`, JSON pretty-printed, CSV/TSV as a table, everything else (HTML included) as source text |
| `app-sdk/appQuery`, `app-sdk/viewState` (built-in-only) | `host/appQuery.ts`, `host/viewState.ts`: the same keys under the fixed `aws-control` namespace |
| `react-router-dom` (`useLocation`, `useNavigate`, `Link`) | `host/router.ts`: the built-in's `/aws-control/<pane>` spelling, kept as the real path on an adopted copy's legacy route and carried as `?pane=<pane>` on a fresh install's `/apps/aws-control` (whose route takes no sub-path); a link to a dashboard route goes through the SDK's `useNavigate` |
| `react-i18next` `Trans`, `i18n/t` | `host/Trans.tsx`, `host/i18n.ts` over the app's own catalogs (`ui/i18n/<locale>.json`: the `apps.awsControl`, `components.awsConsentGate` subtrees and three `components.ui` keys, copied from Kiro Crew for all 12 dashboard locales) |
| `i18n/format` | `fmtNumber`, `fmtCurrency`, `fmtDate`, `fmtRelative` from `@kirocrew/app-sdk`; `fmtBytes` restated over `fmtNumber` |
| `utils/errorReport` | `host/errorReport.ts`, the journal half (record, find, redact). The page passes each failure's report to the SDK's `ErrorNotice` explicitly, so the host's "ask the agent" hand-off still carries the endpoint, status and code |
| `utils/clipboard`, `hooks/*` (`usePersistedString`, `useDialogFocusTrap`, `useScrollEdges`, `useMenuOpensDialog`, `useNearViewport`, `useIsMobile`), `RadioChipGroup`, `NavBackBar`, `subNavParams` | Restated under `host/`; the focus trap's IME latch is reduced to the native `isComposing` check |

## Tests

| Built-in test | Here | Change |
|---|---|---|
| `test/test_aws_control_*.py` (29 files) and their helpers | `tests/` | Imports moved to `backend.*`; the route-table builders read `register_routes(ctx)` records (`tests/harness.py`); patches of `is_owner_dashboard_request` patch `_owner_refusal`; the owner refusal asserts `owner_only`; the contract table gained the three `/consent` routes; the hook tests start with a level-2 context; the composition guards scan this repository's layout. |
| `test/test_core_aws_control_decoupling.py` | (stays in Kiro Crew) | It checks that core does not import the app. |
| `src/.../aws_control/tests/test_aws_control_windows.py` | `tests/test_aws_control_windows.py` | Reads this repository's manifest; the discovery case serializes the parsed manifest instead of built-in discovery. |
| `crew/packaging/tests/`, `crew/runtime/container_tests/` | same paths | The two path fixes above. The container suite runs in its own CI job with the image's dependencies and `CREW_CONTAINER_TESTS_REQUIRED=1`, as Kiro Crew's lane did. |
| (none) | `tests/test_no_host_imports.py`, `tests/test_manifest_contract.py`, `tests/test_external_seams.py` | No `kiro_crew` import outside the shim and the table pinned; the manifest's parity with the built-in, the bundle's imports, hooks that resolve, no model id; the route records, the lifecycle and owner gates, `ctx.job`, `ctx.audit`, the seam registration, and the consent routes' narrowing. |
| `website/src/apps/aws-control/*.test.*` and the three `website/src/test/DrivePage.*` suites | `ui/tests/` | Run by vitest against stand-ins for the host SDK (`ui/tests/stubs/`). The preview suite asserts this page's renderer (fenced code to the host's markdown renderer, HTML shown as source, JSON pretty-printed) where the built-in's asserted the dashboard's viewers; the error-surface suite asserts the report the page hands the host's notice; the two `msw` suites use a local server. |
| (none) | `ui/tests/hostAdapters.test.tsx` | Sub-routes on each mount, the consent calls' paths, the menu, the built-in's view-state key and query namespace, the catalogs' fallback. |

`python -m pytest` runs the backend and crew-producer suites (2,800 tests);
`crew/runtime/container_tests` adds 852 and the UI suite 450. All run offline.

## Remaining gaps

1. **The private host functions above.** Each is a private Kiro Crew name a refactor
   can move. The stand-ins keep that failure closed and reported (`ctx.health`, 503
   `host_unavailable`), but the whole app stops until the name is back or a seam
   replaces it. `tests/test_no_host_imports.py` fails on a rename in the pinned Kiro
   Crew; `minKiroCrewVersion` is the only guard in the field.
2. **Core still names the app.** None of these is in this repository, and each is
   correct only while the app is installed as `aws-control`:
   - the `aws_control.conversation_export` row of the sensitive-store read allowlist in
     `kiro_crew/hooks.py`, which the sessions archive's audit names;
   - the `apps/aws-control/data` and `aws-control-staging` sandbox leaves
     (`sandbox_leaves.py`, `security/paths_lists.py`, `sandbox_precreate.py`,
     `sandbox_aliases.py`). App-declared credential masks (#32652, in flight) would let
     the data-directory mask move into this manifest; the staging leaf is a top-level
     data-home leaf outside the app's data directory, which that seam does not cover;
   - `s3` and `ce` in `aws_consent.GATED_SERVICES`;
   - the `security_posture*.py` rows that exempt or classify the built-in's files by
     their built-in paths, which do not cover this copy once it is installed elsewhere;
   - in the dashboard: `AwsConsentGate` and the `apps.awsControl` catalogs (shared with
     the built-in page), the `builtinRegistry` route, the App Store catalog entry, the
     `website/scripts/capture-aws-control*.mjs` and related capture scripts;
   - in the build: `.github/workflows/crew-image-build.yml`, the `ci.yml` crew-container
     lane, the `setup.cfg` `package_data` and `MANIFEST.in` rows that ship the crew
     runtime in the wheel, the `.gitignore` vendor-wheel rule, and the two core tests
     (`test_docker_wheel_layer_contract.py`, `test_docker_kas_bundle.py`) that load this
     app's planner for its Dockerfile reader.
3. **Core features served by this app's seams.** The MicroVM lane's image recipe
   (`crew_runtime`), the consent cards' and the composer's account policy
   (`aws_account_policy`) and the MicroVM control calls' secret staging
   (`transfer_staging`) ask seams this app registers from `on_startup`, so only in the
   gateway process and only while the app is enabled. The built-in's `seams.py` answered
   in every process and whether or not the app was on (its default is off). While the
   wheel still ships the built-in, its providers still answer wherever this copy has
   not registered; once the built-in is removed, a CLI process or a host with the app
   off gets `None` from all three. Removing the built-in needs a seam that registers
   providers for an installed app independent of its enabled state and of the process.
4. **The crew image producers assume a Kiro Crew checkout.**
   `crew/scripts/build_crew_base_image.sh` resolves the repository root seven levels up
   and builds the gateway wheel from it; `crew/scripts/crew_image_build_plan.py` names
   `CREW_SUBPATH = "src/kiro_crew/apps/builtins/aws_control/crew"`; the workflow that
   runs them (`crew-image-build.yml`) is Kiro Crew's. Building the crew images from this
   repository needs those producers to take the Kiro Crew source and this crew tree as
   two inputs.
5. **Execution trust.** A built-in's in-gateway Python is exempt from the third-party
   execution gate. This copy's hooks load only when the operator trusts it. For an
   existing user Kiro Crew's adoption writes that grant for this repository; a fresh
   install goes through the normal trust dialog.
6. **Audit attribution.** `ctx.audit.record` has no actor field, so a row no longer
   says whether the owner or the nightly schedule caused it (the built-in wrote
   `caller="dashboard-owner"` / `"aws-control-nightly"`), and the operation reads
   `aws-control.<op>` instead of `aws_control.<op>`.
7. **The consent card's routes.** `/api/apps/aws-control/consent` is new surface on
   this app (narrower than the host endpoint it forwards to: owner only, `s3` / `ce`
   only, the host's own handlers). A consent card on the App SDK, or a declared
   permission for the host's consent endpoint that adoption accepts, would remove it.
8. **Page pieces the SDK does not offer.** Library cards show a kind glyph instead of
   the gallery's live preview (the artifact API and the thumbnails are not open to an
   installed app); file previews have no JSON tree, JSONL stream, sandboxed HTML page,
   Excalidraw scene or Pierre code viewer (markdown and code go through the host's
   markdown renderer; HTML is shown as source, never rendered); menus have no portal
   or edge flipping; the dialog focus trap's IME latch is the native check only; a
   fresh install's panes ride in `?pane=` because `/apps/:name` takes no sub-path.
9. **Styles.** The page keeps the built-in's Tailwind utility class strings, which
   render because the dashboard's stylesheet carries them while the compiled built-in
   page ships. Removing that page from Kiro Crew needs the host to keep those
   utilities (or the bundle to carry its own CSS) first.
10. **Store listing localization, sidebar icon, themeable icon, author.** As for the
    other ports: the catalog's publish step does not carry `l10n` yet; the `Cloud`
    glyph and `/aws-control` route come only from the adoption pin's `legacyNav`; the
    raster icon has fixed colours; `"author": "kirocrew"` is attributed on the catalog
    row.

11. **A backup in flight when the app is switched off (suspected).** Disabling or
    uninstalling unloads the app's modules (`apps/module_loader.unload_app_modules`),
    which the built-in's never were. In two early runs of the adoption smoke below, a
    nightly snapshot the adopted copy had just claimed ended `failed` with `No module
    named '_kirocrew_app_aws-control'` while the run went on to disable and uninstall
    the app; a backup started by hand on the enabled copy ran to `done`, and the same
    job loaded in-process outside the gateway did not fail that way. The likeliest
    cause is a worker thread outliving the unload; no traceback confirmed it. Nothing
    is lost (the run is recorded as failed), but the reason shown is not the real one.
12. **Reinstalling after uninstall on a Kiro Crew that still ships the built-in.**
    After the adopted copy is uninstalled, installing this repository again from a
    local path (`kirocrew app install ./clone`, `POST /api/apps/install`) succeeds,
    but `apps/lifecycle._resolve_hook` and the route loader still resolve
    `backend.*` to the wheel's `kiro_crew.apps.builtins.aws_control` package
    (`shipped_builtin_app_root` does not consult the release marker), so route
    registration fails (`'AppContext' object has no attribute 'router'`) and
    `on_startup` fails. The App Store reinstall path was not exercised (the
    catalog was offline in the smoke). This is a Kiro Crew bug, not this
    repository's.

## Adoption smoke

On an isolated Kiro Crew (`6d07df11cf`, the built-in present) with
`KIROCREW_HARNESS_ADOPTION_PINS` naming a local pin for commit `513c4cf` (its
codeload archive as `harnessArchive`) and the AWS command line tool pointed at a
local stand-in: the built-in was enabled and given state (three registered
profiles, an S3 confirmation, a drive, a file, a share link, the nightly backup on,
an install label); STAGE staged the pin; on the next start APPLY moved the record
to `origin=registry` at the pinned commit, enabled. The data directory, the secret
(none), the crons (none), the agents (none), the consent grant and the registered
profiles were identical; the only new record is the approved grant adoption writes,
equal to the built-in's declared `api` and nothing else. The legacy `/aws-control`
route served, the app row carried `legacyNav` `/aws-control` / `Cloud`, the adopted
backend listed the file, the share and the nightly switch, the consent card's route
answered `granted`, the three core seams answered from the adopted tree, and a
manual snapshot backup ran to `done`. An update with the catalog offline was
refused and changed nothing; disable answered 404 and enable restored the same
listing; uninstall kept the data. Gaps 11 and 12 came from this run.

## What Kiro Crew keeps doing

The release that adds adoption still ships the built-in. A user's built-in record
moves onto this repository at the commit Kiro Crew pins; a record that cannot move
keeps running the built-in copy, unchanged. Removing the built-in from Kiro Crew is a
later release, after gaps 2, 3 and 4 above are closed.

## Release handoff: one commit for both pins

1. Push the port here and let CI go green. Call the full 40-hex SHA `C`.
2. In the Kiro Crew release PR that adds the pin, run
   `python3 scripts/adoption_pin.py compute <this URL> C` and add the row it prints
   (with `legacyNav` `{"route": "/aws-control", "icon": "Cloud"}`) to
   `src/kiro_crew/apps/adoption-pins.json`, and set its `minAppSdkLevel` to `2`
   (`compute` always writes `1`; this copy needs `ctx.lifecycle` and serves only
   refusals below level 2, so a level-1 host must keep the built-in); then
   `python3 scripts/adoption_pin.py verify`.
3. The KiroCrewApps row for `aws-control` switches to `"type": "git"`, this URL,
   `"ref": "C"`, never a branch name.
4. Check both name the same `C` and that GitHub serves it.
