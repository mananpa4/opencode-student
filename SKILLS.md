# SKILLS.md — OpenCode Student skill & plugin catalog

Living catalog of the agent skills and plugins bundled with **OpenCode Student**.
OpenCode discovers these automatically; no config entry is required.

- Project skills live in `.opencode/skills/<name>/SKILL.md` (auto-scanned).
- Project plugins live in `.opencode/plugins/*.ts|*.json` (auto-scanned).
- Global skills are also auto-discovered from `~/.agents/skills` and `~/.claude/skills`
  via the built-in compatibility plugin.
- Additional sources can be added with the `skills` config field
  (`skills: ["./path"]` or `skills: { paths: [...], urls: [...] }`).

Skills are **model-invoked**: they are listed to the model and loaded on demand, so a
large catalog costs only a short name/description line per skill.

---

## Integrated skills (curated from `D:\Users\Win`)

### Productivity / meta

| Skill | Purpose |
| --- | --- |
| `caveman` | Ultra-compressed communication mode (~75% token savings). |
| `find-skills` | Discover and install skills from the open agent-skills ecosystem. |
| `skill-creator` | Create/update a skill with scoped instructions and resources. |
| `skill-installer` | Install skills from a curated list or GitHub repo. |
| `review-agent` | Read-only, defect-first review of a code change. |

### Design / UI

| Skill | Purpose |
| --- | --- |
| `claude-liquid-glass` | Enforces native iOS 26+ Liquid Glass (SwiftUI/UIKit/RN). |
| `web-design-guidelines` | Review UI code for Web Interface Guidelines compliance. |
| `writing-guidelines` | Review docs/prose for Writing Guidelines compliance. |
| `text-to-lottie` | Author renderable Lottie (Bodymovin) JSON animations. |

### Web development / React / Vercel

| Skill | Purpose |
| --- | --- |
| `vercel-react-best-practices` | React/Next.js performance guidelines (70 rules). |
| `vercel-composition-patterns` | React composition patterns that scale. |
| `vercel-react-view-transitions` | Native-feeling animations via the View Transition API. |
| `vercel-optimize` | Vercel cost/performance optimization audit. |
| `deploy-to-vercel` | Deploy apps/websites to Vercel. |
| `vercel-cli-with-tokens` | Vercel CLI with token-based auth. |

### AI / media

| Skill | Purpose |
| --- | --- |
| `imagegen` | Generate/edit raster images with AI. |
| `openai-docs` | OpenAI APIs, models, pricing, and Codex docs. |

### Android

| Skill | Purpose |
| --- | --- |
| `android-cli` | Install/use the `android` CLI, SDK, devices, and Android skills. |

### Scraping / Zyte (supports the Scrap-Crawl workflow)

`scrape` is the orchestrator; the rest are sub-skills of the workflow.

| Skill | Purpose |
| --- | --- |
| `scrape` | End-to-end scraping workflow (URL → working spider). |
| `scrape-spec` | Explore pages and validate an extraction spec. |
| `scrape-explore-site` | Explore a site and save diverse pages with classified links. |
| `scrape-define` | Quick schema definition with a fast approval loop. |
| `scrape-create-spider` | Generate a Scrapy spider wiring page objects together. |
| `scrape-codegen` | Generate web-poet page object code from a spec. |
| `scrape-codegen-analyze` | Analyze HTML to produce field extraction instructions. |
| `scrape-codegen-generate` | Generate page object code from per-page analyses. |
| `scrape-analyze-page` | Extract all fields/values from a detail page. |
| `scrape-add-page-object` | Add an empty web-poet page object. |
| `scrape-review-schema` | Generate an HTML review page for schema/data verification. |
| `scrape-scrapy-cloud` | Deploy/schedule spiders on Scrapy Cloud. |
| `scrape-ensure-project` | Ensure a Scrapy project with scrapy-poet + Zyte API. |
| `scrape-zyte-login` | Set up a Zyte account and credentials. |

### Project-native skills (already in the repo)

`app-e2e-tests`, `component-tests`, `effect`, `opencode-dev`,
`rtl-aware-development`, `sample-skill`, `tui-tests`, `unit-tests`.

---

## Integrated plugins

| Plugin | Location | Purpose |
| --- | --- | --- |
| `rtk` | `.opencode/plugins/rtk.ts` | Rewrites `bash`/`shell` commands through `rtk rewrite` for token savings. Requires `rtk >= 0.23.0` in `PATH`; disables itself otherwise. |
| `scrap-crawl` | `.opencode/plugins/scrap-crawl.ts` | Registers a `scrap_crawl` tool that shells out to the Scrap-Crawl (`aio-scrap-crawl`) CLI, so the agent can scrape/crawl URLs through the platform. |

`rtk` was integrated from `~/.config/opencode/plugins/rtk.ts`. Its `import type` is
erased at runtime, so it loads without resolving the type package.

### `scrap-crawl` integration details

The `scrap_crawl` tool is the OpenCode Student bridge to the external Scrap-Crawl
platform at `F:\Usuarios\Tony\OneDrive\Documents\GitHub\Scrap-Crawl`.

- **Surface chosen:** plugin/tool (not MCP). Scrap-Crawl's REST API is still "planned
  only"; the usable path today is its CLI. A tool plugin shells out to it directly.
- **Underlying CLI:** `node <aio-scrap-crawl>/apps/cli/dist/index.js <scrape|crawl> <url>`.
- **Available engines:** `fetch` (always), `firecrawl`, `scrapling`, `browser-use`,
  `crawlee`, `crawlera`, `nodriver`, `playwright`, `puppeteer`, `requests`. Only `fetch`
  is available out of the box; the rest activate as their keys/browsers are configured.
- **Environment overrides:**
  - `SCRAP_CRAWL_HOME` — path to the `aio-scrap-crawl` checkout.
  - `SCRAP_CRAWL_BIN` — interpreter (default `node`).
- **Verified working:** `scrape https://example.com` returns title, text, links, images,
  metadata, and even antibot detection (it reported Cloudflare + recommended engine).

---

## Other assets found on `D:\Users\Win` (not bundled)

These are ecosystem-specific and were **not** copied; they are documented here so the
catalog is complete and future integrations are easy to trace.

| Asset | Path | Notes |
| --- | --- | --- |
| Azure skills (26) | `~/.agents/skills/azure-*`, `entra-*`, `microsoft-foundry` | Already auto-discovered via `~/.agents/skills`. |
| Claude plugins | `~/.claude/plugins/marketplaces/...` | Claude Code format; only their `zyte-ai/skills` were ported. |
| Codex plugins | `~/.codex/plugins/cache/...` | Codex runtime format (browser, code-review, visualize, work-pets, …). |
| Gemini plugins | `~/.gemini/config/plugins/...` | Gemini CLI format (`android-cli-plugin`, `firebase`, `google-antigravity-sdk`). |
| Pencil MCP | `~/.config/opencode/opencode.json`, `~/.codex/config.toml`, `~/.gemini/config/mcp_config.json` | Already configured for OpenCode. |
| Hooks | `~/.agents/hooks/hooks.json` | Telemetry tracking hooks (not applicable to OpenCode). |

---

## Maintenance

- To add a skill: copy `<name>/SKILL.md` (plus any `references/`, `scripts/`, `assets/`)
  into `.opencode/skills/<name>/`.
- To add a plugin: drop a `.ts`/`.js`/`.json` file into `.opencode/plugins/`.
- Restart OpenCode (or rely on the file watcher) for new skills/plugins to be discovered.
- Update this file whenever the catalog changes.
