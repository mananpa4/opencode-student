# DIRECTORY_COMPARISON.md — Config & data directories (C: vs D:)

Report comparing the OpenCode config/data directories on `C:\Users\Win` and
`D:\Users\Win`. Generated 2026-10-20. Read alongside `CLAUDE_CONTEXT.md` §7.

---

## 1. Paths compared

| # | Path | Exists | Role |
| --- | --- | --- | --- |
| 1 | `C:\Users\Win\.config\opencode` | yes | Global config dir (XDG `~/.config/opencode`) |
| 2 | `C:\Users\Win\.opencode` | **no** | Legacy/default bin dir |
| 3 | `C:\Users\Win\.local\share\opencode` | yes | Global data dir (XDG `~/.local/share/opencode`) |
| 4 | `D:\Users\Win\.config\opencode` | yes | Global config dir |
| 5 | `D:\Users\Win\.opencode` | yes | Legacy/default bin dir |
| 6 | `D:\Users\Win\.local\share\opencode` | yes | Global data dir |

---

## 2. Contents

### `C:\Users\Win\.config\opencode`

| Entry | Type | Notes |
| --- | --- | --- |
| `service.json` | file (64 B) | Local service descriptor. |

No `opencode.json`, no `plugins/`, no `node_modules/`.

### `C:\Users\Win\.opencode`

**Does not exist.**

### `C:\Users\Win\.local\share\opencode`

| Entry | Size | Notes |
| --- | --- | --- |
| `opencode.db` | ~34.5 MB | SQLite database (grew with use). |
| `opencode.db-wal` | ~10.8 MB | Write-ahead log. |
| `opencode.db-shm` | 32 KB | Shared memory. |
| `log/`, `repos/`, `shell/`, `snapshot/`, `exports/` | dirs | Runtime artifacts. |

### `D:\Users\Win\.config\opencode`

| Entry | Notes |
| --- | --- |
| `opencode.json` | MCP `pencil` server; provider `9router` (baseURL `http://localhost:20128/v1`). |
| `plugins/rtk.ts` | OpenCode plugin (rtk command rewrite). |
| `package.json` | Depends on `@opencode-ai/plugin` 1.4.10. |
| `node_modules/` | Installed plugin dependencies. |
| `bun.lock`, `package-lock.json` | Lockfiles. |
| `service.json` | Local service descriptor. |

### `D:\Users\Win\.opencode`

| Entry | Notes |
| --- | --- |
| `bin/opencode.exe` | Installed CLI binary. |
| `node_modules/` | Installed CLI dependencies. |
| `package.json`, `package-lock.json` | Installed CLI manifest. |

### `D:\Users\Win\.local\share\opencode`

| Entry | Size | Notes |
| --- | --- | --- |
| `opencode.db` | **34.9 GB** | SQLite database — the real data. |
| `opencode.db-wal` | 277 MB | Write-ahead log. |
| `opencode.db-shm` | 32 KB | Shared memory. |
| `auth.json` | 564 B | Provider credentials. |
| `opencode-codex-amr-image-runtime-fixes.db` (+ `-wal`/`-shm`) | ~445 MB | Auxiliary database. |
| `log/`, `repos/`, `shell/`, `snapshot/`, `storage/`, `tool-output/` | dirs | Runtime artifacts. |

---

## 3. Comparison

| Dimension | C: | D: | Verdict |
| --- | --- | --- | --- |
| Config file (`opencode.json`) | absent | present | **D: is authoritative.** |
| Plugins | absent | `rtk.ts` | **D:.** |
| CLI binary | absent | `bin/opencode.exe` | **D:.** |
| Data size | ~34.5 MB DB | 34.9 GB DB | **D: holds the real data.** |
| Auth | absent | `auth.json` | **D:.** |
| Auxiliary DB | absent | `opencode-codex-amr-...db` | **D:.** |

**Conclusion:** `D:\Users\Win` is the effective home for OpenCode. `C:\Users\Win` contains
a smaller, actively growing database and a `service.json` — likely a secondary environment
(for example, a Bun-installed CLI using `C:\Users\Win` as its XDG home). OpenCode Student
touches neither one: it keeps its own profile under
`%APPDATA%\ai.opencode.desktop.dev` and reads nothing from the installed profile (config,
credentials, providers, or subscriptions).

---

## 4. Risks & recommendations

- **Do not delete `C:` data blindly.** It may be a live secondary environment.
- **Preserve `opencode.db`, `opencode.db-wal`, `opencode.db-shm`** on either drive before
  migrating or merging. Copy the whole `opencode.db*` set together while the app is stopped.
- **Decide the authoritative home.** If `D:` is authoritative, point `HOME`/`USERPROFILE`
  (or `XDG_CONFIG_HOME`/`XDG_DATA_HOME`) at `D:\Users\Win` consistently, so `os.homedir()`
  resolves the config and data to the same place.
- **34.9 GB database** is large; consider VACUUM/cleanup if it is mostly historical data.
- **Two `service.json` files** may cause two service registrations; keep only the one that
  matches the chosen home.

---

## 5. Migration checklist (if consolidating onto D:)

1. Quit OpenCode / stop the background service.
2. Back up `C:\Users\Win\.local\share\opencode\opencode.db*` and
   `D:\Users\Win\.local\share\opencode\opencode.db*`.
3. Copy `C:` config (`service.json`) into `D:` only if it is not already present.
4. Set the environment so `os.homedir()` resolves to `D:\Users\Win` (or set
   `XDG_CONFIG_HOME=D:\Users\Win\.config` and `XDG_DATA_HOME=D:\Users\Win\.local\share`).
5. Start OpenCode and verify sessions/config load.
6. Only after verification, archive the C: data.
