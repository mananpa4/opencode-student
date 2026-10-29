import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Database as Native } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { EffectDrizzleSqlite } from "@opencode/core/database/drizzle"
import { Database } from "@opencode/core/database/database"
import { DatabaseTransfer } from "@opencode/core/database/transfer"

// The shapes the merge has to get right: a plain primary key, a foreign key whose
// parent must land first, and a secondary UNIQUE constraint that `OR IGNORE` must
// also treat as a conflict.
const schema = [
  `CREATE TABLE IF NOT EXISTS project (id TEXT PRIMARY KEY, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS session_v2 (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE, time_created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS session_message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES session_v2(id) ON DELETE CASCADE, seq INTEGER NOT NULL, UNIQUE (session_id, seq))`,
]

const source = [
  `INSERT INTO project (id, time_created, time_updated) VALUES ('p1', 2000, 2000)`,
  `INSERT INTO project (id, time_created, time_updated) VALUES ('p2', 3000, 3000)`,
  `INSERT INTO session_v2 (id, project_id, time_created) VALUES ('s1', 'p1', 2000)`,
  `INSERT INTO session_v2 (id, project_id, time_created) VALUES ('s2', 'p2', 3000)`,
  `INSERT INTO session_message (id, session_id, seq) VALUES ('m-clash', 's1', 0)`,
  `INSERT INTO session_message (id, session_id, seq) VALUES ('m-new', 's1', 1)`,
]

const target = [
  `INSERT INTO project (id, time_created, time_updated) VALUES ('p1', 1000, 1000)`,
  `INSERT INTO session_v2 (id, project_id, time_created) VALUES ('s1', 'p1', 1000)`,
  `INSERT INTO session_message (id, session_id, seq) VALUES ('m-keep', 's1', 0)`,
]

const write = (path: string, statements: string[]) => {
  const db = new Native(path)
  db.run("BEGIN")
  for (const statement of statements) db.run(statement)
  db.run("COMMIT")
  db.close()
}

/** Runs `effect` against a drizzle client over the database file at `filename`. */
const run = <A, E>(filename: string, effect: Effect.Effect<A, E, Database.Service | Scope.Scope>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      return yield* effect.pipe(Effect.provideService(Database.Service, { db }))
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )

const rows = (path: string, statement: string) => {
  const db = new Native(path)
  const result = db.query(statement).all()
  db.close()
  return result
}

// Credentials and account links belong to one agent's identity. A merge must skip them so a
// source profile can never sign the target into someone else's account or subscription.
const identitySchema = [
  `CREATE TABLE IF NOT EXISTS credential (id TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, email TEXT NOT NULL)`,
]

const identityRows = [
  `INSERT INTO credential (id, value) VALUES ('c1', 'secret')`,
  `INSERT INTO account (id, email) VALUES ('a1', 'someone@example.com')`,
]

const fixture = async () => {
  const dir = await mkdtemp(join(tmpdir(), "opencode-transfer-"))
  const sourcePath = join(dir, "source.db")
  const targetPath = join(dir, "target.db")
  write(sourcePath, [...schema, ...source])
  write(targetPath, [...schema, ...target])
  return { dir, sourcePath, targetPath }
}

test("merges rows the target does not have and leaves the rest untouched", async () => {
  const { dir, sourcePath, targetPath } = await fixture()
  const before = await stat(sourcePath)

  try {
    const merged = await run(targetPath, DatabaseTransfer.importSnapshot({ path: sourcePath }))

    // p2, s2 and m-new are new here; p1, s1 and m-clash already exist.
    expect(merged.inserted).toBe(3)
    expect(merged.skipped).toBe(3)
    expect(merged.sourceRows).toBe(6)
    expect(merged.merged).toEqual(["project", "session_v2", "session_message"])

    // The existing p1 keeps its own values: a merge must never overwrite.
    expect(rows(targetPath, `SELECT id, time_created FROM project ORDER BY id`)).toEqual([
      { id: "p1", time_created: 1000 },
      { id: "p2", time_created: 3000 },
    ])
    expect(rows(targetPath, `SELECT id FROM session_v2 ORDER BY id`)).toEqual([{ id: "s1" }, { id: "s2" }])
    // m-clash collides with m-keep on UNIQUE (session_id, seq), so it is skipped.
    expect(rows(targetPath, `SELECT id, seq FROM session_message ORDER BY seq`)).toEqual([
      { id: "m-keep", seq: 0 },
      { id: "m-new", seq: 1 },
    ])

    // Re-running the same merge adds nothing.
    const again = await run(targetPath, DatabaseTransfer.importSnapshot({ path: sourcePath }))
    expect(again.inserted).toBe(0)
    expect(again.skipped).toBe(6)

    // The source is only ever read, even though this is a live SQLite file.
    const after = await stat(sourcePath)
    expect(after.size).toBe(before.size)
    expect(after.mtimeMs).toBe(before.mtimeMs)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("never merges credentials or account links from the source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "opencode-transfer-identity-"))
  const sourcePath = join(dir, "source.db")
  const targetPath = join(dir, "target.db")

  try {
    write(sourcePath, [...schema, ...identitySchema, ...source, ...identityRows])
    write(targetPath, [...schema, ...identitySchema, ...target])

    const merged = await run(targetPath, DatabaseTransfer.importSnapshot({ path: sourcePath }))

    expect(merged.merged).toEqual(["project", "session_v2", "session_message"])
    expect(merged.sourceRows).toBe(6)
    expect(rows(targetPath, `SELECT COUNT(*) AS n FROM credential`)).toEqual([{ n: 0 }])
    expect(rows(targetPath, `SELECT COUNT(*) AS n FROM account`)).toEqual([{ n: 0 }])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("exports a readable snapshot and refuses to overwrite the live database", async () => {
  const { dir, sourcePath, targetPath } = await fixture()

  try {
    await run(targetPath, DatabaseTransfer.importSnapshot({ path: sourcePath }))

    const snapshot = await run(targetPath, DatabaseTransfer.exportSnapshot({ data: dir }))
    expect(snapshot.path.startsWith(join(dir, "exports"))).toBe(true)
    expect(snapshot.tables).toBe(3)
    expect(snapshot.rows).toBe(6)
    expect(rows(snapshot.path, `SELECT id, time_created FROM project ORDER BY id`)).toEqual([
      { id: "p1", time_created: 1000 },
      { id: "p2", time_created: 3000 },
    ])

    const overwrite = run(targetPath, DatabaseTransfer.exportSnapshot({ path: targetPath, data: dir }))
    await expect(overwrite).rejects.toBeInstanceOf(DatabaseTransfer.DestinationIsDatabaseError)
    await expect(
      run(targetPath, DatabaseTransfer.importSnapshot({ path: join(dir, "missing.db") })),
    ).rejects.toBeInstanceOf(DatabaseTransfer.SourceNotFoundError)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
