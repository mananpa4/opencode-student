# OpenCode Student

The open source AI coding agent — a liquid-glass themed fork of [OpenCode V2](https://github.com/anomalyco/opencode).

OpenCode Student is a personal edition of OpenCode V2 (`v2.1.1`): it keeps the same
engine, adds a transparent **Liquid Glass** UI, bundles a curated set of agent **skills
and plugins**, and connects to the **Scrap-Crawl** scraping platform.

---

## Features

- **Four surfaces, one engine** — Terminal (TUI), web app, Electron desktop, and a
  server/SDK, all driven by the same session core.
- **Liquid Glass UI** — transparent, refractive surfaces across the web app and desktop
  shell, with text/icon glow for legibility (the TUI keeps the stock theme for now).
- **Bundled skills** — 40 curated skills (productivity, design, React/Vercel, Android,
  scraping) in `.opencode/skills/`. See [`SKILLS.md`](./SKILLS.md).
- **Plugins** — `.opencode/plugins/rtk.ts` rewrites shell commands for token savings.
- **Scrap-Crawl integration** — use the scraping/crawling platform for web research.
- **Puter bridge** — optional local OpenAI-compatible endpoint backed by a Puter session.
- **Separate profile** — own config, data, database and service; reads nothing from the
  installed OpenCode's user, credentials or subscriptions. See
  [Separate profile](#separate-profile).
- **Database import/export** — export with `VACUUM INTO` and merge another database
  non-destructively from Settings → Experimental.
- **Tray** — recent projects and the main actions from the system tray.
- **Network masking** — outbound identity sanitization; no RAM, MAC, serial or HWID
  collection.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime / PM | Bun (workspaces + turbo) |
| Language | TypeScript (typescript6) |
| Engine | Effect v4 |
| Frontend | SolidJS 1.9, Tailwind CSS v4 |
| TUI | OpenTUI (Solid) |
| Data | Drizzle ORM + SQLite (`opencode.db`) |
| HTTP | Hono 4 + hono-openapi |
| Desktop | Electron (electron-vite, electron-builder) |
| Infra | SST |
| Tests | `bun test`, Playwright (e2e + component) |

---

## Repository layout

```
packages/
  ai/            # provider protocols, routing, error classification
  app/           # web app (SolidJS)
  cli/           # CLI entrypoint, config migration
  client/        # generated typed client (do not edit by hand)
  core/          # engine: session, skill, tool, config, plugin, state
  desktop/       # Electron shell
  plugin/        # plugin API (@opencode/plugin)
  plugins/       # provider & utility plugins
  schema/        # shared Effect schemas
  server/        # HTTP server (Hono)
  session-ui/    # shared session/transcript UI
  theme/         # @opencode/theme — TUI theme schema/resolver
  tui/           # terminal UI (OpenTUI)
  ui/            # shared web UI kit (@opencode/ui)
  util/          # shared utilities
  ...
.opencode/
  skills/        # bundled agent skills
  plugins/       # bundled plugins
  agent/         # custom agents
  command/       # custom slash commands
  themes/        # custom themes
```

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and conventions.

---

## Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/v2/install | bash

# Package managers
npm i -g @opencode/cli@latest      # or bun/pnpm/yarn
brew install anomalyco/tap/opencode-v2
sudo pacman -S opencode
```

### Desktop App (BETA)

Download from [opencode.ai/download](https://opencode.ai/download). Windows, macOS
(Apple Silicon / Intel), and Linux (`.deb`, `.rpm`, `.AppImage`) are available.

---

## Development

```bash
bun install                 # install dependencies (needs `node` on PATH for esbuild)
bun run check               # lint + typecheck (canonical)
bun typecheck               # from a package dir for a focused check
bun test <file>             # unit tests (from a package dir, never the root)

bun run dev                 # dev TUI
bun run dev:live [dir]      # dev TUI against the live server
bun run dev:web             # dev web app
bun run dev:desktop         # dev desktop
bun run dev:storybook       # dev Storybook
```

> Tests cannot run from the repository root (guard: `do-not-run-tests-from-root`).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`AGENTS.md`](./AGENTS.md).

---

## Agents

OpenCode Student includes two built-in agents switchable with `Tab`:

- **build** — default, full-access agent for development work.
- **plan** — read-only agent for analysis and code exploration.

A **general** subagent handles complex searches and multistep tasks (`@general`).

---

## Skills & plugins

Skills are markdown files with frontmatter in `.opencode/skills/<name>/SKILL.md`.
Plugins are `.ts`/`.json` files in `.opencode/plugins/`. Both are auto-discovered.
`~/.agents/skills` and `~/.claude/skills` are also picked up automatically.

Full catalog: [`SKILLS.md`](./SKILLS.md).

---

## Separate profile

OpenCode Student keeps its own profile and never reads or writes the installed OpenCode's
profile. It is a separate agent: its user, API keys, providers, and subscriptions are
configured here, not shared with OpenCode.

| What | Where |
| --- | --- |
| Config | `%APPDATA%\ai.opencode.desktop.dev\config` (`OPENCODE_CONFIG_DIR`) |
| Data root (credentials, MCP auth, repos, snapshots) | `%APPDATA%\ai.opencode.desktop.dev\data-root` (`XDG_DATA_HOME`) |
| Cache | `%APPDATA%\ai.opencode.desktop.dev\cache` (`XDG_CACHE_HOME`) |
| Database | `%APPDATA%\ai.opencode.desktop.dev\data\opencode.db` (`OPENCODE_DB`) |
| Service registration, locks | `%APPDATA%\ai.opencode.desktop.dev\opencode` (passed to the CLI as `XDG_STATE_HOME`) |

On first launch Student seeds its database from the installed
`~/.local/share/opencode/opencode.db` with the same non-destructive `INSERT OR IGNORE` import
the Settings screen exposes. The seed skips the `account`, `account_state`, `control_account`,
and `credential` tables, so sessions and projects come over but no user, API key, or
subscription does. See
[`INTEGRATIONS.md`](./INTEGRATIONS.md#11-configuración-base-de-datos-y-registro-propios).

---

## Scrap-Crawl

OpenCode Student connects to the [Scrap-Crawl](https://github.com/...) platform
(`aio-scrap-crawl`) for scraping and crawling. See [`CLAUDE_CONTEXT.md`](./CLAUDE_CONTEXT.md)
for the current integration status.

---

## Documentation

| File | Contents |
| --- | --- |
| [`CLAUDE.md`](./CLAUDE.md) | Permanent project reference. |
| [`CLAUDE_CONTEXT.md`](./CLAUDE_CONTEXT.md) | Living memory: state, decisions, pending work. |
| [`SKILLS.md`](./SKILLS.md) | Bundled skills & plugins. |
| [`AGENTS.md`](./AGENTS.md) | Authoritative contributor rules. |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contributor guide. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history. |

---

## License

MIT. See [`LICENSE`](./LICENSE).

---

**Join the community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
