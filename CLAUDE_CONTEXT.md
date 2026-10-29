# CLAUDE_CONTEXT.md — OpenCode Student (living memory)

This is the **living memory** of the project. Update it after every meaningful task,
decision, or discovery. `CLAUDE.md` holds only permanent reference; everything that
changes goes here.

- **Last updated:** 2026-10-26
- **Repo:** `C:\Users\Win\Downloads\Opencode` (OpenCode V2 `2.1.1`, rebranded to OpenCode Student)

---

## 1. Current state

- Repository fully analyzed: architecture, packages, theme system, skill/plugin loading,
  config discovery, usage/rate-limit UI, desktop shell.
- Base docs created: `CLAUDE.md`, `SKILLS.md`, `README.md`, `DIRECTORY_COMPARISON.md`,
  this file.
- **Skills/plugins integrated:** 40 skills in `.opencode/skills/`; `rtk` and
  `scrap-crawl` plugins in `.opencode/plugins/`.
- **Toolchain installed properly:** Bun 1.4.3, Node.js LTS 24.20.0, Git 2.55.0.5, npm
  11.19.0, pnpm 10.33.0 — all now on the system PATH via winget/npm (no more PATH
  workarounds needed).
- **External repos prepared:** `AndroidLiquidGlass` (Gradle build green),
  `LiquidGlassEffect` (static), `Scrap-Crawl` (`pnpm install` + `pnpm build` green).
- **UX/UI:** Liquid Glass theme layer added to the web app; rebrand applied across web,
  desktop, and i18n; countdown reset button wired in dialog + Settings; transparency modes
  and text/icon glow verified in the running desktop app; tray icon with recent projects
  and main actions.
- **Scrap-Crawl connected** via a `scrap_crawl` tool plugin; verified end-to-end.
- **Network masking** — identity sanitization on outbound fetch/search requests; no RAM,
  MAC, serial number or HWID collection.
- **Puter bridge** — local OpenAI-compatible endpoint in the Electron main process, written
  to Student's config as `providers.puter`.
- **Database import/export** — non-destructive `INSERT OR IGNORE` merge (Settings →
  Experimental), plus the one-time first-launch seed.
- **Separate profile** — own config, data root, database, service registration and locks; the
  installed OpenCode's user, API keys, providers and subscriptions are never read (see §14).

### What is done

- [x] Full repo analysis (packages, stack, commands, conventions).
- [x] `CLAUDE.md` created.
- [x] `CLAUDE_CONTEXT.md` created.
- [x] `SKILLS.md` created.
- [x] Curated skills integrated into `.opencode/skills/` (see §4).
- [x] `rtk` plugin integrated into `.opencode/plugins/` (see §5).
- [x] External asset inventory on `D:\Users\Win` (see §6).
- [x] Repository dependencies installed: `bun install` → 2653 packages / 9.3 GB, EXIT=0.
- [x] Git initialized on branch `dev`; husky hooks installed (`core.hooksPath = .husky/_`).
- [x] Smoke test: `bun typecheck` in `packages/plugin` → EXIT=0.
- [x] Toolchain installed via winget/npm: Bun 1.4.3, Node 24.20.0, Git 2.55.0.5, npm
      11.19.0, pnpm 10.33.0 — all on PATH.
- [x] `bun install` re-ran cleanly with the new toolchain → EXIT=0.
- [x] External repos prepared:
      - `Scrap-Crawl/aio-scrap-crawl`: `pnpm install` (373 packages) + `pnpm build`
        (turbo, 8/8 tasks) → EXIT=0.
      - `AndroidLiquidGlass`: `gradlew :app:compileKotlinDesktop` → BUILD SUCCESSFUL in
        3m39s (JDK = `D:\Users\Win\.jdks\temurin-23.0.2`).
      - `LiquidGlassEffect`: static, no install needed.
- [x] **Countdown reset button** — see §10.
- [x] **Rebrand to OpenCode Student** — see §11.
- [x] **Liquid Glass theme (web app)** — see §12.
- [x] **Scrap-Crawl connection** — see §13.
- [x] **Separate profile: config, database, service registration** — see §14.
- [x] **Database import/export** — `VACUUM INTO` export + non-destructive merge import
      (`packages/core/src/database/transfer.ts`, Settings → Experimental).
- [x] **First-launch seed** — one-time merge of the installed `opencode.db` before the
      renderer receives credentials.
- [x] **Tray** — icon, recent projects, `session.new` / `project.open` / `settings.open`,
      right-click close/open.
- [x] **Transparency + glow** — `glass.css` / `glass-tokens.css` with `alpha`,
      `system-backdrop` and `off` modes; 7.css-style text/icon glow for legibility.
- [x] **Puter bridge** — local OpenAI-compatible endpoint + `providers.puter`.
- [x] **Network masking** — outbound identity sanitization; no hardware fingerprinting.
- [x] `README.md` rewritten for OpenCode Student.
- [x] `DIRECTORY_COMPARISON.md` created (C: vs D: report).
- [x] `bun run lint` 0 errors (pre-existing warnings only); `bun run typecheck` 34/34.

### In progress

- [ ] TUI (`packages/theme` + `packages/tui`) Liquid Glass pass — not started.
- [ ] Directory consolidation decision (C: vs D:) — see §7.

---

## 2. Pending tasks (ordered)

1. **TUI Liquid Glass** — the web layer landed; the terminal surfaces still use the stock
   theme. Apply the glass look to `packages/theme` (TUI schema tokens) and `packages/tui`
   (panels, dialog, composer).
2. **Directory consolidation** — decide which home is authoritative (`C:\Users\Win` vs
   `D:\Users\Win`); preserve `opencode.db`, `-wal`, `-shm` when migrating (§7).
3. **Optional: Puter image provider** — expose `puter.ai.txt2img` as a model provider so
   image generation is selectable from the UI, not only through the bridge.
4. **Optional: real desktop blur on Windows 10** — `SetWindowCompositionAttribute` via
   koffi; today the glass floor is an emeried 68% white / 60% black surface.
5. **Optional: Scrap-Crawl REST API** — when `aio-scrap-crawl` ships its planned API,
   switch the plugin from CLI shell-out to HTTP for lower latency and richer results.
6. **Commit baseline** — the repo has a large set of uncommitted changes (all of the
   above) and no remote. Decide whether to commit a baseline and add `origin`.

---

## 3. Technical decisions

- **Skills live in `.opencode/skills/`** (auto-scanned, no config needed). Chosen over a
  separate `skills/` dir + config entry to keep discovery automatic and match repo convention.
- **Plugins live in `.opencode/plugins/`** (auto-scanned; `PluginSourceDirectory.names =
  ["plugin","plugins"]`).
- **`rtk` plugin import corrected** to `@opencode/plugin` (the repo's package name), from
  the user's global `@opencode-ai/plugin`. The `import type` is erased at runtime.
- **Do not duplicate the global `rtk` plugin into the repo carelessly** — it is already
  active from `~/.config/opencode/plugins/rtk.ts`. The repo copy is for project-level dev.
- **Compatibility plugin already auto-discovers** `~/.agents/skills` and `~/.claude/skills`,
  so those skills are available without copying.
- **Did not bundle** Azure skills, Claude/Codex/Gemini plugins — ecosystem-specific; only
  their portable skills were ported (Zyte scrape set, android-cli, Codex system skills).
- **Config `skills` field** accepts an array of strings or `{ paths, urls }`; `~` expands
  to home; relative paths resolve against the project directory.
- **Toolchain via winget** (`--source winget` to skip the msstore agreement prompt). This
  gives Bun/Node/Git proper PATH entries so no manual PATH stitching is needed anymore.
- **pnpm purge guard** — Scrap-Crawl's `pnpm install` aborted with
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; fixed with
  `--config.confirmModulesPurge=false`.
- **Liquid Glass is a CSS layer, not a theme rewrite** — a new `glass.css` in
  `packages/ui/src/styles/` (imported as a `components` layer) plus tokens, rather than
  mutating the existing v2 token set. This keeps the stock themes intact and makes the
  glass look easy to tune or remove.
- **Glass tokens use a `[data-color-scheme="dark"]` override** so the same `.glass`
  surface works in both modes with different translucency.

---

## 4. Integrated skills (40 total in `.opencode/skills/`)

| Source | Skills |
| --- | --- |
| `~/.agents/skills` | caveman, claude-liquid-glass, text-to-lottie, web-design-guidelines, writing-guidelines, vercel-react-best-practices, vercel-composition-patterns, vercel-react-view-transitions, find-skills, vercel-optimize, deploy-to-vercel, vercel-cli-with-tokens |
| `~/.codex/skills/.system` | review-agent, skill-creator, skill-installer, imagegen, openai-docs |
| `~/.gemini/.../android-cli-plugin/skills` | android-cli |
| `~/.claude/plugins/marketplaces/zyte-ai/skills` | scrape + 13 `scrape-*` sub-skills |
| repo-native (pre-existing) | app-e2e-tests, component-tests, effect, opencode-dev, rtl-aware-development, sample-skill, tui-tests, unit-tests |

Full catalog: `SKILLS.md`.

---

## 5. Integrated plugins

| Plugin | File | Notes |
| --- | --- | --- |
| `rtk` | `.opencode/plugins/rtk.ts` | Rewrites bash/shell commands via `rtk rewrite`; needs `rtk >= 0.23.0` in PATH. |
| `scrap-crawl` | `.opencode/plugins/scrap-crawl.ts` | Registers a `scrap_crawl` tool that shells out to the Scrap-Crawl CLI. See §13. |

---

## 6. External assets found on `D:\Users\Win` (inventory)

| Asset | Path | Status |
| --- | --- | --- |
| OpenCode global config | `~/.config/opencode/opencode.json` | MCP `pencil`; provider `9router` (localhost:20128). |
| OpenCode plugin | `~/.config/opencode/plugins/rtk.ts` | Ported to repo. |
| OpenCode package | `~/.config/opencode/package.json` | Depends on `@opencode-ai/plugin` 1.4.10. |
| OpenCode binary | `~/.opencode/bin/opencode.exe` | Installed CLI. |
| Skills (42) | `~/.agents/skills/` | Auto-discovered; curated subset ported. |
| Skills | `~/.claude/skills/` (gepeto, pinokio) | Auto-discovered. |
| Codex system skills | `~/.codex/skills/.system/` | Subset ported. |
| Claude plugins | `~/.claude/plugins/marketplaces/...` | Zyte skills ported; rest Claude-format. |
| Codex plugins | `~/.codex/plugins/cache/...` | Not portable (Codex runtime). |
| Gemini plugins | `~/.gemini/config/plugins/...` | android-cli skill ported. |
| Pencil MCP | opencode.json / codex config.toml / gemini mcp_config.json | Already configured. |
| Hooks | `~/.agents/hooks/hooks.json` | Telemetry only; N/A. |

---

## 7. Config / data directory comparison (C: vs D:)

Full report: [`DIRECTORY_COMPARISON.md`](./DIRECTORY_COMPARISON.md).

| Path | Contents |
| --- | --- |
| `C:\Users\Win\.config\opencode` | `service.json` only. |
| `C:\Users\Win\.local\share\opencode` | `opencode.db` (~34.5 MB), `opencode.db-wal` (~10.8 MB), `-shm`, `log/`, `repos/`, `shell/`, `snapshot/`, `exports/`. |
| `C:\Users\Win\.opencode` | **does not exist**. |
| `D:\Users\Win\.config\opencode` | `opencode.json` (MCP + provider), `plugins/rtk.ts`, `package.json`, `node_modules/`, `bun.lock`, `service.json`. |
| `D:\Users\Win\.opencode` | `bin/opencode.exe`, `node_modules/`, `package.json`. |
| `D:\Users\Win\.local\share\opencode` | `opencode.db` (**34.9 GB**), `opencode.db-wal` (277 MB), `-shm`, `auth.json`, `snapshot/`, `storage/`, `tool-output/`, plus `opencode-codex-amr-image-runtime-fixes.db`. |

**Student's own profile** (never written by the installed OpenCode) lives under
`%APPDATA%\ai.opencode.desktop.dev`: `config/`, `data/opencode.db`, and
`opencode/service-*.json`; see §14. `~/.local/share/opencode` stays shared for logs, repos,
snapshots and shell data, while the database is redirected with `OPENCODE_DB`.

**Conclusion:** `D:\Users\Win` is authoritative (real data + config + binary). `C:`
holds a smaller but growing DB and a `service.json`. **Open question:** which home should
`os.homedir()` resolve to? Preserve `opencode.db`, `-wal`, `-shm` when migrating.

---

## 8. Known problems / risks

- **Toolchain is now properly installed** — the earlier PATH workarounds are obsolete.
  A fresh shell picks up Bun/Node/Git automatically; tooling that inherits a stale parent
  environment may still need the registry PATH re-read once.
- **40 skills** raise the model's tool-listing cost. If context bloat appears, trim the
  Zyte sub-skills or move them behind a config path.
- **Two homes (C: and D:)** create ambiguity for `os.homedir()` / XDG resolution.
- **Liquid Glass legibility** — glass overlays over busy content can hurt contrast. Verify
  focus rings and menu/dialog text before shipping; tune `--glass-bg`/`--glass-blur` if so.
- **`scrap-crawl` hardcodes a default `SCRAP_CRAWL_HOME`** (`F:\...`). Override with the
  env var on other machines.
- **`rtk` double-load risk** if both the global and project plugin are active in the same
  process.
- **Windows deletes an inherited `XDG_STATE_HOME`** in `preferApplicationEnvironment`, so
  Student passes its registration file explicitly and injects `XDG_STATE_HOME` into the CLI
  child instead of relying on the parent environment (§14).
- **Windows 10 build 19044 has no real desktop blur** — the glass floor is an emeried 68%
  white / 60% black surface; the ghosting is a physical limitation.
- **Large uncommitted diff** — no remote, no baseline commit yet (§2.6).

---

## 9. Recommended next steps

1. Apply the Liquid Glass pass to the TUI (`packages/theme` + `packages/tui`).
2. Decide the authoritative home (C: vs D:) and migrate, preserving `opencode.db*`.
3. Optional: Puter image provider, real Windows 10 blur, Scrap-Crawl REST API (§2).
4. Commit a baseline and add `origin` if the work should be tracked.

---

## 10. Countdown reset button

The usage/upsell "countdown" state lives in client-side persisted storage, **not** in
`opencode.db`. Resetting it clears only the 24h suppression windows and the ChatGPT usage
notice — it never touches the config file, credentials, or the database, and it cannot
change the provider's actual quota.

- **New module:** `packages/app/src/session/usage-countdown.ts` — exports
  `USAGE_COUNTDOWN_KEYS` and `resetUsageCountdowns()`, which removes the
  `Persist.global("go-upsell")` and `Persist.global("chatgpt-usage-limit")` entries via
  `removePersisted`.
- **Dialog button:** `DialogUsageExceeded` (`packages/app/src/providers/connect/usage-exceeded.tsx`)
  gained an `onReset` prop and a "Reset countdown" button (i18n key
  `dialog.usageExceeded.reset`). `useUsageExceededDialogs`
  (`packages/app/src/session/usage-exceeded-dialogs.tsx`) passes a `resetUsageCountdowns`
  that clears both the in-memory stores and the persisted values, then closes the dialog.
- **Settings row:** Settings → General now has a "Reset usage counters" row
  (`ResetUsageCountersSetting` in
  `packages/app/src/settings/general/general.tsx`) with a Reset button that calls
  `resetUsageCountdowns()` and shows a toast.
- **i18n:** English keys added under `dialog.usageExceeded.reset` and
  `settings.general.row.resetUsage.*` (button, title, description, toast).
- **Typecheck:** `packages/app` → EXIT=0.

---

## 11. Rebrand → OpenCode Student

User-visible "OpenCode" was replaced with "OpenCode Student". Provider/server names
(OpenCode Console, OpenCode Go, OpenCode Free, opencode.ai URLs) were intentionally left
unchanged, as were legal trademark lines' subject only where it names the product.

| Area | Files changed |
| --- | --- |
| Web app shell | `packages/app/manifest.json` (`name`, `short_name`), `packages/app/index.html` (`<title>`). |
| Web i18n (en) | `packages/app/src/runtime/i18n/en.ts` — about description/trademark/notices, project settings copy, language/colorScheme/theme descriptions, workspaces empty, ChatGPT welcome. |
| Desktop i1i8n | `packages/app/src/runtime/i18n/desktop-native.ts` — `desktop.menu.app`, `.documentation`, `.ariaLabel`, `desktop.recovery.*`. |
| Theme name | `packages/ui/src/theme/context.tsx` (`names["oc-2"]`), `packages/ui/src/theme/themes/oc-2.json` (`name`). |
| UI meta | `packages/ui/src/components/favicon.tsx` (`apple-mobile-web-app-title`), `packages/ui/src/context/marked-theme-register.tsx` (custom theme id). |
| Connect screen / menu | `packages/app/src/servers/connect/screen.tsx` (aria-label now i18n), `packages/app/src/shell/titlebar/windows-menu.tsx` (group label now i18n `desktop.menu.app`). |
| Desktop constants | `packages/desktop/src/main/constants.ts` (`appNames` dev/beta/prod + `APP_NAME`). |
| Desktop windows | `packages/desktop/src/main/windows/appearance.ts`, `.../early.ts` (window title). |
| Desktop renderer | `packages/desktop/src/renderer/index.html` (`<title>`). |
| Packaging | `packages/desktop/electron-builder.config.ts` (`productName` + `protocols.name` per channel), `packages/desktop/scripts/copy-metainfo.ts` (product name + description), `packages/desktop/resources/linux/opencode-desktop.desktop` (`Name=`; `Exec=` path kept for the existing test), `packages/desktop/package.json` (author name). |

**Typecheck after rebrand:** `packages/ui`, `packages/app`, `packages/desktop` → all EXIT=0.

**Not changed (follow-ups):** the wordmark/logo SVGs still draw "OpenCode"; redesigning
them to say "OpenCode Student" is a design task. `Exec=/opt/OpenCode/...` and the
`ai.opencode.desktop` appId / `opencode://` scheme were kept to avoid breaking deep links
and the packaging test.

---

## 12. Liquid Glass theme (web app)

Implemented as a dedicated CSS layer so the stock v2 themes stay intact.

- **New file:** `packages/ui/src/styles/glass.css`, imported in
  `packages/ui/src/styles/index.css` as a `components` layer.
- **Tokens** (`:root` + `[data-color-scheme="dark"]` override): `--glass-bg`,
  `--glass-bg-strong`, `--glass-bg-hover`, `--glass-border`, `--glass-border-strong`,
  `--glass-highlight`, `--glass-shadow`, `--glass-shadow-strong`, `--glass-blur`,
  `--glass-saturation`, `--glass-radius`, and `--glass-aurora-1/2/3`.
- **Utilities:** `.glass` (blurred translucent surface + 1px border + inset top highlight +
  a Fresnel-style edge sheen via `::before`), `.glass-strong`, `.glass-button` (hover lift
  with reduced-motion guard).
- **Applied to surfaces** by selector: dialog, menu, popover, tooltip, hover-card,
  context-menu, select, composer, terminal panel, side panel, chat panel, settings panel,
  card.
- **Aurora backdrop:** `packages/app/src/index.css` adds soft radial-gradient fields on
  `body` (`background-attachment: fixed`) so the glass surfaces have colour to refract.
- **Technique references:** `AndroidLiquidGlass` (AGSL SDF refraction + Fresnel edge light)
  and `LiquidGlassEffect` (backdrop-filter blur/saturate + displacement).

**Not yet done:** the TUI (`packages/theme` + `packages/tui`) and native desktop title bar
(the title bar is already transparent, so renderer glass shows through).

---

## 13. Scrap-Crawl connection

OpenCode Student now connects to the Scrap-Crawl platform
(`F:\Usuarios\Tony\OneDrive\Documents\GitHub\Scrap-Crawl`, the `aio-scrap-crawl` monorepo).

- **Integration surface:** a **plugin/tool** (not MCP). The platform's REST API is still
  "planned only", so the reliable path today is its CLI. The plugin shells out to it.
- **Plugin:** `.opencode/plugins/scrap-crawl.ts`, id `opencode.student.scrap-crawl`. It
  registers a `scrap_crawl` tool (JSON-schema input: `url` required, `mode`
  `scrape|crawl` optional) that runs
  `node <aio-scrap-crawl>/apps/cli/dist/index.js <mode> <url>` and returns the stdout
  (or a clear failure message).
- **Env overrides:** `SCRAP_CRAWL_HOME` (checkout path), `SCRAP_CRAWL_BIN` (interpreter,
  default `node`).
- **Degrades gracefully** — if the checkout/CLI is missing, it returns a message instead
  of throwing.
- **Verified:** the CLI resolves; `engines` lists `fetch` (available) plus
  `firecrawl`/`scrapling`/`browser-use`/`crawlee`/`playwright`/`puppeteer`/etc.
  (inactive without keys); `scrape https://example.com` returned the parsed page
  (title/text/metadata) and antibot detection (Cloudflare, suggested engine `scrapling`).
- **Prep done:** `pnpm install` (373 packages) and `pnpm build` (turbo 8/8 tasks) in
  `aio-scrap-crawl` → EXIT=0.
- **Typecheck:** plugin builds with `bun build --target=bun` → EXIT=0 (note: it avoids
  importing `effect` because `effect` is not resolvable from `.opencode/plugins`, only
  from `packages/*/node_modules`).

---

## 14. Separate profile: config, database, registration

Student is a separate agent. It never writes to, and never reads, the installed OpenCode's
config, credentials, providers, subscriptions, database, or service registration. Its user
and API keys are configured here, not shared with OpenCode.

| What | Where | How |
| --- | --- | --- |
| Config | `%APPDATA%\ai.opencode.desktop.dev\config` | `OPENCODE_CONFIG_DIR`; `Config.update` and Puter write here. |
| Data root (credentials, MCP auth, repos, snapshots, shell, logs) | `%APPDATA%\ai.opencode.desktop.dev\data-root` | `XDG_DATA_HOME` is fixed under `userData`, so `~/.local/share/opencode` is never opened. |
| Cache | `%APPDATA%\ai.opencode.desktop.dev\cache` | `XDG_CACHE_HOME` fixed under `userData`. |
| Database | `%APPDATA%\ai.opencode.desktop.dev\data\opencode.db` | `OPENCODE_DB`; seeded once from `~/.local/share/opencode/opencode.db`, with identity tables excluded. |
| Service registration, locks | `%APPDATA%\ai.opencode.desktop.dev\opencode\service-*.json` | Explicit file passed to `Service.ensure`/`discover`; child gets `XDG_STATE_HOME = userData`. |

**Config sources.** Precedence (lowest → highest): global (`OPENCODE_CONFIG_DIR`) < explicit
(`OPENCODE_CONFIG`) < direct (`--config`) < project < content (`OPENCODE_CONFIG_CONTENT`) <
managed. `~/.config/opencode` is not a source: the `Config.Options.inherit` /
`OPENCODE_CONFIG_INHERIT` path was removed so the installed profile can never leak settings,
skills, plugins, agents, or provider definitions into Student.

**Credentials and subscriptions.** Student's own credentials live in the `credential` table of
its own database (the `import_legacy_credentials` migration reads `auth.json` from Student's
own data root, not from OpenCode). The seed and every manual import exclude `account`,
`account_state`, `control_account`, and `credential`, so no user, API key, provider, or
subscription can arrive from another profile. `DatabaseTransfer.SKIP_TABLES` owns that list.

**Database seed.** `seed-database.ts` runs after the service is ready and **before**
`SidecarCredentials.set`, so the first session list already includes the imported rows. It
calls `POST /api/experimental/database/import` (the same non-destructive `INSERT OR IGNORE`
merge as Settings → Experimental; source opened read-only), then sets the
`studentDatabaseSeeded` store key. A failed import is retried on the next launch; a missing
source is skipped. The installed OpenCode keeps using its own database and can keep growing.

**Registration isolation.** The desktop deletes an inherited `XDG_STATE_HOME` on Windows
(`preferApplicationEnvironment`), so Student cannot rely on the parent environment. Instead,
`studentServiceFile()` (`<userData>/opencode/service-local.json` in dev, `service.json` in
packaged builds) is passed explicitly to `Service.ensure` and `Service.discover`, and the
spawned CLI receives `XDG_STATE_HOME = userData` through `env`. The CLI writes its
registration to `Global.state/filename()`, which is exactly that file. Student therefore
never discovers or replaces the installed OpenCode's service.

**Puter config.** The bridge rewrites `providers.puter` on every launch (port/token change)
and migrates a legacy `provider.puter` in the same file. It only ever touches Student's own
config file.

**Verified in a real dev run.** Registration at
`%APPDATA%\ai.opencode.desktop.dev\opencode\service-local.json`; the shared
`~/.local/state/opencode/service-local.json` and the installed `service.json` untouched; the
seed inserted 1393 rows; `GET /api/session` returned the 9 seeded sessions; the installed
OpenCode's config (`~/.config/opencode`) and DB were not modified.

**Files:** `packages/desktop/src/main/service/{student-paths,seed-database,background-service,sidecar-probe}.ts`,
`packages/desktop/src/main/puter/config.ts`, `packages/desktop/src/main/storage/keys.ts`,
`packages/core/src/database/transfer.ts`, `packages/core/src/config{,/discovery,/watch}.ts`,
`packages/server/src/{options,routes}.ts`, `packages/cli/src/server-process.ts`.
