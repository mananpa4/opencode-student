# CLAUDE.md — OpenCode Student

Permanent reference for this project. For short-term state, decisions, and pending work,
**always read `CLAUDE_CONTEXT.md` before making important changes**. For the repo's own
authoritative contributor rules, read `AGENTS.md` first.

> This file is deliberately stable: architecture, stack, layout, commands, and standing
> rules. Do not put temporary tasks or short-lived decisions here.

---

## 1. Project

**OpenCode Student** is a fork/rebrand of **OpenCode V2** (`v2.1.1`), the open-source AI
coding agent. The working copy lives at `C:\Users\Win\Downloads\Opencode`.

OpenCode V2 ships four surfaces over one core:

| Surface | Package | UI framework |
| --- | --- | --- |
| Terminal | `packages/cli`, `packages/tui` | OpenTUI (Solid) |
| Web app | `packages/app` | SolidJS + Tailwind v4 |
| Desktop | `packages/desktop` | Electron (wraps the web app) |
| Server / SDK | `packages/server`, `packages/sdk`, `packages/client` | Hono + Effect |

The rebrand is applied across the web app, desktop shell, packaging, and i18n. The wordmark
SVGs still draw "OpenCode"; redesigning them is a design follow-up (see
`CLAUDE_CONTEXT.md`).

**Separate profile.** The desktop runs its own config (`OPENCODE_CONFIG_DIR`), data root
(`XDG_DATA_HOME`), database (`OPENCODE_DB`), and service registration under
`app.getPath("userData")`. It reads nothing from the installed OpenCode's profile: user,
credentials, API keys, providers, subscriptions, skills, and plugins are configured
separately. Its database is seeded once from the installed database, excluding account and
credential tables. See `CLAUDE_CONTEXT.md` §14.

---

## 2. Tech stack

- **Runtime / package manager:** Bun `1.4.3` (workspaces + turbo). Never `npm`/`pnpm`.
- **Language:** TypeScript (`typescript6` 6.0.2 via catalog; native `@typescript/native`).
- **Effect:** Effect v4 (`effect` 4.0.1) for core/server/protocol; `effect-smol` reference.
- **Frontend:** SolidJS 1.9, Tailwind CSS v4 (source-first), `@kobalte/core`, `@corvu/drawer`.
- **TUI:** `@opentui/core`, `@opentui/solid`, `@opentui/keymap`.
- **Data:** Drizzle ORM (SQLite via `@effect/sql-sqlite-bun`), SQLite files `opencode.db`.
- **HTTP:** Hono 4 + `hono-openapi`; generated client in `packages/client`.
- **Desktop:** Electron (`electron-vite`, `electron-builder`).
- **Deploy/infra:** SST (`sst.config.ts`).
- **Testing:** `bun test` (unit), Playwright (e2e + Storybook component tests).
- **AI:** Vercel AI SDK 6, many provider plugins.

---

## 3. Repository layout

```
packages/
  ai/            # provider protocols, routing, error classification
  app/           # web app (SolidJS), settings, session UI wiring
  cli/           # CLI entrypoint, config migration, dev scripts
  client/        # generated typed client (do not edit by hand)
  codemode/      # sandboxed code execution (test262)
  console/       # marketing/console app
  containers/    # container tooling
  core/          # the engine: session, skill, tool, config, plugin, state
  desktop/       # Electron shell
  effect-drizzle-sqlite/  # Effect SQLite layer
  function/      # serverless functions
  gui-extensions/# GUI extensions (Electron main-process features)
  http-recorder/ # HTTP recording for tests
  httpapi-codegen/# OpenAPI -> client codegen
  identity/      # auth/identity
  latex/         # LaTeX rendering
  merman/        # Mermaid rendering
  plugin/        # plugin API (@opencode/plugin)
  plugin-browser/# browser automation plugin
  plugins/       # provider & utility plugins (figma, github, ...)
  posts/         # blog/content
  protocol/      # wire protocol (generated)
  schema/        # Effect schemas shared across packages
  script/        # build/release scripts
  sdk/           # public SDK
  server/        # HTTP server (Hono)
  session-ui/    # shared session/transcript UI (SolidJS)
  simulation/    # deterministic sim harness
  stats/         # usage stats app
  storybook/     # Storybook + Playwright component-test harness
  theme/         # @opencode/theme — TUI theme schema/resolver
  tui/           # terminal UI (OpenTUI)
  ui/            # shared web UI kit (@opencode/ui)
  util/          # shared utilities (Global, FSUtil, hash, path, npm)
  web/           # marketing site / docs assets
sdks/            # sdks/vscode
services/        # changelog, files, update, www
specs/           # v2 specs
infra/           # infra definitions
patches/         # bun patchedDependencies
script/          # repo-wide scripts (lint, codegen, ast-grep)
```

Top-level config: `package.json` (scripts + workspaces + catalog), `turbo.json`,
`bunfig.toml`, `tsconfig.json`, `.oxlintrc.json`, `.prettierignore`.

---

## 4. Important commands

Run from the repository root unless noted. **Tests cannot run from root** (guard:
`do-not-run-tests-from-root`).

| Task | Command |
| --- | --- |
| Dev TUI | `bun run dev` |
| Dev TUI against live server | `bun run dev:live [dir]` |
| Dev web app | `bun run dev:web` |
| Dev desktop | `bun run dev:desktop` |
| Dev storybook | `bun run dev:storybook` |
| Full check (lint + typecheck) | `bun run check` |
| Lint | `bun run lint` |
| Typecheck (root) | `bun run typecheck` (turbo) |
| Typecheck one package | `bun typecheck` from e.g. `packages/core` |
| Unit tests | `bun test <file>` from a package dir |
| Component tests | from `packages/storybook` |
| e2e tests | from `packages/app/e2e` |
| Client regen | `bun run generate` from `packages/client` (after Protocol/HttpApi changes) |

Do **not** run `tsc` directly; use `bun typecheck` in the package.

---

## 5. Conventions (see `AGENTS.md` for the full rules)

- **Style guide:** one function unless composable; validate once at the boundary; no
  `any`; use Bun APIs; rely on inference; functional array methods; no star imports; never
  alias imports; no type-position `import("...")`; prefer `const`; avoid `else`.
- **Effect generators:** bind services to named variables before calling methods; do not
  nest service yields.
- **Tests:** no mocks by default; test real implementation; read the matching
  `.opencode/skills` skill (`unit-tests`, `tui-tests`, `app-e2e-tests`, `component-tests`).
- **Dependencies:** Schema → Core/Protocol → Server; Client may use Schema/Protocol only;
  `sdk` composes Client + Core + Server. Never edit generated `packages/client` files.
- **No Changesets.** The default branch is `dev`; PRs target `dev`.
- **Branch names:** ≤ 3 words, hyphenated, no `feat/`/`fix/` prefixes.
- **Commits/PRs:** `type(scope): summary` (`feat|fix|docs|chore|refactor|test`).

### TUI theme tokens

- Choose tokens by semantic role, never by current color; do not use raw `theme.hue`.
- `text.feedback`/`background.feedback` are only for outcome/status feedback.
- If the theme lacks a token for a role, extend the schema + defaults + resolver + types.
- After changing the token surface, verify built-in light/dark defaults and the
  custom-theme fallback path.

---

## 6. Skills & plugins

OpenCode Student bundles agent skills and plugins:

- `.opencode/skills/<name>/SKILL.md` — auto-scanned. Catalog in **`SKILLS.md`**.
- `.opencode/plugins/*.ts|*.json` — auto-scanned. Currently `rtk.ts` and `scrap-crawl.ts`.
- `~/.agents/skills` and `~/.claude/skills` are also auto-discovered (compatibility plugin).
- `SKILLS.md` lists every bundled skill, its source, and how to add more.

---

## 7. Standing rules for Claude (and other agents)

1. **Read `CLAUDE_CONTEXT.md` before any non-trivial change** and update it afterward.
2. Read `AGENTS.md` (and the relevant package `AGENTS.md`) before editing a package.
3. Treat unfamiliar files as user work; investigate before deleting or overwriting.
4. Make the smallest correct change; do not expand scope for speculative edge cases.
5. Never restart the app/server process while working; use `dev:live` for TUI testing.
6. Do not commit generated client files by hand; run `bun run generate` from `packages/client`.
7. Prefer adding to this repo's conventions over inventing new patterns.
8. When a task completes or a decision is made, update `CLAUDE_CONTEXT.md`.

---

## 8. Documentation map

| File | Contents |
| --- | --- |
| `AGENTS.md` | Authoritative contributor rules (root). |
| `CLAUDE.md` | This file — permanent project reference. |
| `CLAUDE_CONTEXT.md` | Living memory: state, decisions, pending work. |
| `SKILLS.md` | Bundled skills & plugins catalog. |
| `README.md` | Public project README (many translations). |
| `CONTRIBUTING.md` | Contributor guide. |
| `CHANGELOG.md` | Release history. |
| `STATS.md` | Usage stats. |
| `V2_HTTP_API_AUDIT.md` | V2 HTTP API audit. |
| `packages/*/README.md` | Per-package notes. |
| `specs/v2/` | V2 design specs. |
