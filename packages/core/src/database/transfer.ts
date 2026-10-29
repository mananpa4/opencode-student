export * as DatabaseTransfer from "./transfer.js"

import { Data, Effect } from "effect"
import { sql } from "drizzle-orm"
import { Database } from "./database.js"
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

// Portable snapshot / non-destructive merge of `opencode.db`.
//
// Export writes a compact, single-file snapshot with `VACUUM INTO`, which reads a
// consistent view of the live database *including* its WAL content, so the
// `-wal`/`-shm` sidecars never have to be copied.
//
// Import MERGES a source database into the live one: a row is inserted only when
// its primary key (or a unique constraint) does not already exist. Existing rows
// are never updated or deleted, so nothing already in this database is lost. The
// source is opened strictly read-only through a separate connection and is never
// written to, even while OpenCode is running against it.

export interface ExportResult {
  path: string
  size: number
  tables: number
  rows: number
}

export interface ImportResult {
  path: string
  tables: number
  merged: string[]
  sourceRows: number
  inserted: number
  skipped: number
}

export class SourceNotFoundError extends Data.TaggedError("SourceNotFoundError")<{ path: string }> {}

export class InvalidSourceError extends Data.TaggedError("InvalidSourceError")<{ path: string }> {}

export class DestinationIsDatabaseError extends Data.TaggedError("DestinationIsDatabaseError")<{
  path: string
}> {}

export class UnsupportedRuntimeError extends Data.TaggedError("UnsupportedRuntimeError")<{ message: string }> {}

export class TransferError extends Data.TaggedError("TransferError")<{ path: string; message: string }> {}

export type Error =
  | SourceNotFoundError
  | InvalidSourceError
  | DestinationIsDatabaseError
  | UnsupportedRuntimeError
  | TransferError

// The migration journal is excluded: replaying another database's journal would
// mark migrations complete that this database never ran.
//
// Credentials and account links are agent identity, not portable session data.
// Student must never adopt the installed OpenCode's user, API keys, or
// subscriptions, so both the one-time seed and manual imports skip these tables.
// A snapshot still contains Student's own credential rows; importing one never
// restores them, so sign in again after moving to another machine.
const SKIP_TABLES = new Set([
  "migration",
  "__drizzle_migrations",
  "account",
  "account_state",
  "control_account",
  "credential",
])

// Parents must be inserted before children (all FKs are ON DELETE CASCADE). A
// source database is internally consistent, so ordering it this way lets every
// child row find its parent.
const TABLE_ORDER = [
  "project",
  "project_directory",
  "workspace",
  "worktree",
  "event_sequence",
  "event",
  "permission",
  "kv",
  "session_v2",
  "instruction_blob",
  "session_message",
  "session_inbox",
  "session_pending",
  "instruction_entry",
  "instruction_state",
]

/** `"name"` with embedded quotes doubled, for identifiers that come from `sqlite_master`. */
function ident(name: string) {
  return `"${name.replaceAll('"', '""')}"`
}

/** `'name'` with embedded quotes doubled, for PRAGMA string arguments. */
function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

/** A read-only `bun:sqlite` connection over an external database. */
function openSource(path: string) {
  return Effect.tryPromise({
    try: async () => {
      const { Database: Native } = await import("bun:sqlite")
      return new Native(path, { readonly: true, strict: true })
    },
    catch: (error) =>
      new UnsupportedRuntimeError({ message: error instanceof Error ? error.message : String(error) }),
  })
}

type Native = {
  query(statement: string): { all(): unknown[] }
  close(): void
}

function tableNamesOf(source: Native) {
  const rows = source
    .query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND substr(name, 1, 1) <> '_' ORDER BY name`,
    )
    .all() as { name: string }[]
  return rows.map((row) => row.name).filter((name) => !SKIP_TABLES.has(name))
}

function ordered(names: string[]) {
  const known = TABLE_ORDER.filter((name) => names.includes(name))
  return [...known, ...names.filter((name) => !TABLE_ORDER.includes(name))]
}

function sourceColumnsOf(source: Native, table: string) {
  return (source.query(`PRAGMA table_info(${literal(table)})`).all() as { name: string }[]).map((row) => row.name)
}

function sourceCountOf(source: Native, table: string) {
  const rows = source.query(`SELECT COUNT(*) AS n FROM ${ident(table)}`).all() as { n: number }[]
  return Number(rows[0]?.n ?? 0)
}

function stamp() {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Write a compact single-file snapshot of this database to `input.path`, or to a
 * timestamped file under `input.data` (the OpenCode data directory) when omitted.
 *
 * `data` is passed in rather than read from `Global.Service`: this runs inside a
 * request handler, where `Global` is not a request-scoped service.
 */
export function exportSnapshot(input: { path?: string; data: string }) {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service

    const destination = input.path
      ? resolve(input.path)
      : join(input.data, "exports", `opencode-student-${stamp()}.db`)

    // `VACUUM INTO` refuses an existing target. Overwriting the live database
    // (possibly reached through an alias) would be catastrophic, so compare
    // against the connection's own file rather than trusting the requested path.
    const live = (
      yield* db.get<{ file: string }>(sql`SELECT file FROM pragma_database_list WHERE name = 'main'`).pipe(
        Effect.mapError((error) => new TransferError({ path: destination, message: describe(error) })),
      )
    )?.file
    if (live && resolve(destination) === resolve(live)) {
      return yield* new DestinationIsDatabaseError({ path: destination })
    }

    mkdirSync(dirname(destination), { recursive: true })
    if (existsSync(destination)) rmSync(destination, { force: true })

    yield* db.run(sql.raw(`VACUUM INTO ${literal(destination)}`)).pipe(
      Effect.mapError((error) => new TransferError({ path: destination, message: describe(error) })),
    )

    const names = yield* db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .pipe(Effect.mapError((error) => new TransferError({ path: destination, message: describe(error) })))
    const counts = names.map((name) => `SELECT COUNT(*) AS n FROM ${ident(name.name)}`)
    const rows = counts.length
      ? (yield* db
          .get<{ n: number }>(sql.raw(`SELECT COALESCE(SUM(n), 0) AS n FROM (${counts.join(" UNION ALL ")})`))
          .pipe(Effect.mapError((error) => new TransferError({ path: destination, message: describe(error) }))))?.n ??
        0
      : 0

    return { path: destination, size: statSync(destination).size, tables: names.length, rows }
  })
}

/**
 * Merge the database at `input.path` into this database without overwriting
 * anything: every source row whose primary key is absent here is inserted, and
 * rows that already exist are left exactly as they are.
 */
export function importSnapshot(input: { path: string }) {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service

    const path = resolve(input.path)
    if (!existsSync(path)) return yield* new SourceNotFoundError({ path })

    const source = yield* Effect.acquireRelease(openSource(path), (native) =>
      Effect.sync(() => native.close()),
    )

    const available = tableNamesOf(source)
    if (available.some((name) => TABLE_ORDER.includes(name)) === false) {
      return yield* new InvalidSourceError({ path })
    }

    const merged: string[] = []
    let sourceRows = 0
    let inserted = 0
    let skipped = 0

    for (const table of ordered(available)) {
      const sourceColumns = sourceColumnsOf(source, table)
      const targetColumns = yield* db
        .all<{ name: string }>(sql.raw(`SELECT name FROM pragma_table_info(${literal(table)})`))
        .pipe(Effect.mapError((error) => new TransferError({ path, message: describe(error) })))
      if (targetColumns.length === 0) continue

      // Schema drift across OpenCode versions is possible: only carry the columns
      // this database actually has, so an older or newer source still merges.
      const targetNames = targetColumns.map((column) => column.name)
      const common = sourceColumns.filter((name) => targetNames.includes(name))
      if (common.length === 0) continue

      const targetCount = yield* db
        .get<{ n: number }>(sql.raw(`SELECT COUNT(*) AS n FROM ${ident(table)}`))
        .pipe(Effect.mapError((error) => new TransferError({ path, message: describe(error) })))
      const before = Number(targetCount?.n ?? 0)
      const from = sourceCountOf(source, table)
      sourceRows += from

      if (from > 0) {
        const chunk = Math.max(25, Math.min(500, Math.floor(2000 / Math.max(common.length, 1))))
        let cursor = 0
        let rows: Record<string, unknown>[] = []
        do {
          rows = source
            .query(
              `SELECT rowid AS __cursor, ${common.map(ident).join(", ")} FROM ${ident(table)} WHERE rowid > ${cursor} ORDER BY rowid LIMIT ${chunk}`,
            )
            .all() as Record<string, unknown>[]
          if (rows.length === 0) break
          cursor = Number(rows[rows.length - 1]?.__cursor ?? 0)

          const tuples = rows.map(
            (row) => sql`(${sql.join(common.map((name) => sql`${row[name] ?? null}`), sql`, `)})`,
          )
          yield* db
            .run(
              sql`INSERT OR IGNORE INTO ${sql.identifier(table)} (${sql.join(
                common.map((name) => sql.identifier(name)),
                sql`, `,
              )}) VALUES ${sql.join(tuples, sql`, `)}`,
            )
            .pipe(Effect.mapError((error) => new TransferError({ path, message: describe(error) })))
        } while (rows.length === chunk)
      }

      const after = Number(
        (yield* db
          .get<{ n: number }>(sql.raw(`SELECT COUNT(*) AS n FROM ${ident(table)}`))
          .pipe(Effect.mapError((error) => new TransferError({ path, message: describe(error) }))))?.n ?? 0,
      )
      const added = Math.max(0, after - before)
      inserted += added
      skipped += Math.max(0, from - added)
      if (added > 0) merged.push(table)
    }

    return { path, tables: merged.length, merged, sourceRows, inserted, skipped }
  })
}
