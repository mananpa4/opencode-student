import path from "node:path"
import { app } from "electron"

/**
 * OpenCode Student runs its own service, database, configuration, and data. It never reads the
 * installed OpenCode's configuration, credentials, or database. These paths are resolved before the
 * CLI starts so the desktop, the probe, and the child process all agree on them.
 */

export function studentConfigDir() {
  return path.join(app.getPath("userData"), "config")
}

export function studentDataDir() {
  return path.join(app.getPath("userData"), "data")
}

export function studentDatabaseFile() {
  return path.join(studentDataDir(), "opencode.db")
}

/**
 * The XDG data root for the CLI. Keeping it under userData means Student's credentials, MCP auth,
 * repos, snapshots, and shell history never mix with the installed OpenCode's data directory.
 */
export function studentDataRoot() {
  return path.join(app.getPath("userData"), "data-root")
}

export function studentCacheRoot() {
  return path.join(app.getPath("userData"), "cache")
}

/**
 * The CLI's state root, which owns the service registration, locks, and migration state. It stays
 * under userData so Student never discovers or replaces the installed OpenCode's service, and it is
 * passed to the child explicitly because the desktop removes an inherited XDG_STATE_HOME on Windows.
 */
export function studentStateDir() {
  return path.join(app.getPath("userData"), "opencode")
}

export function studentServiceFile() {
  const name = process.env.OPENCODE_DESKTOP_SERVER_CHANNEL === "local" ? "service-local.json" : "service.json"
  return path.join(studentStateDir(), name)
}

/** The installed OpenCode's database, merged into Student's own database once. */
export function installedDatabaseFile() {
  return path.join(app.getPath("home"), ".local", "share", "opencode", "opencode.db")
}
