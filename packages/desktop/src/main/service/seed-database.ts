import { existsSync } from "node:fs"
import { Option, Schema } from "effect"
import { getStore } from "../storage/store"
import { STUDENT_DATABASE_SEEDED_KEY } from "../storage/keys"
import { installedDatabaseFile } from "./student-paths"

const Imported = Schema.Struct({
  inserted: Schema.Number,
  skipped: Schema.Number,
})

/**
 * Student starts with its own database, then merges the installed OpenCode's database once. The
 * merge is the non-destructive `INSERT OR IGNORE` import the Settings screen also exposes, so rows
 * Student already has are never overwritten and the source is opened read-only.
 *
 * This runs before the renderer receives connection credentials, so the first session list already
 * includes the seeded sessions. A failed import is retried on the next launch.
 */
export async function seedStudentDatabase(endpoint: { url: string; password: string }) {
  if (getStore().get(STUDENT_DATABASE_SEEDED_KEY) === true) return Option.none()

  const source = installedDatabaseFile()
  if (!existsSync(source)) return Option.none()

  const response = await fetch(new URL("/api/experimental/database/import", endpoint.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(`opencode:${endpoint.password}`).toString("base64")}`,
    },
    body: JSON.stringify({ path: source }),
  })
  if (!response.ok) throw new Error(`Database import failed with status ${response.status}`)

  const result = Schema.decodeUnknownOption(Imported)(await response.json())
  getStore().set(STUDENT_DATABASE_SEEDED_KEY, true)
  return result
}
