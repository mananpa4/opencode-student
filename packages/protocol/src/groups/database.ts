import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"

const root = "/api/experimental/database"

export const DatabaseExportInput = Schema.Struct({
  /** Absolute or working-directory-relative destination. Defaults to the data dir's `exports/` folder. */
  path: Schema.optional(Schema.String),
})

export const DatabaseExportResult = Schema.Struct({
  path: Schema.String,
  size: Schema.Number,
  tables: Schema.Number,
  rows: Schema.Number,
})

export const DatabaseImportInput = Schema.Struct({
  /** Path of the `opencode.db` to merge in. Its `-wal`/`-shm` sidecars are read alongside it. */
  path: Schema.String,
})

export const DatabaseImportResult = Schema.Struct({
  path: Schema.String,
  tables: Schema.Number,
  merged: Schema.Array(Schema.String),
  sourceRows: Schema.Number,
  inserted: Schema.Number,
  skipped: Schema.Number,
})

export class DatabaseTransferError extends Schema.TaggedError<DatabaseTransferError>()(
  "DatabaseTransferError",
  {
    name: Schema.Literal("DatabaseTransferError"),
    data: Schema.Struct({
      message: Schema.String,
      path: Schema.optional(Schema.String),
    }),
  },
  { httpApiStatus: 400 },
) {}

export const DatabaseGroup = HttpApiGroup.make("server.database")
  .add(
    HttpApiEndpoint.post("database.export", `${root}/export`, {
      payload: DatabaseExportInput,
      success: DatabaseExportResult,
      error: DatabaseTransferError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "experimental.database.export",
        summary: "Export opencode.db",
        description:
          "Write a compact single-file snapshot of this database with VACUUM INTO, including uncommitted WAL content. Never writes to the live database.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("database.import", `${root}/import`, {
      payload: DatabaseImportInput,
      success: DatabaseImportResult,
      error: DatabaseTransferError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "experimental.database.import",
        summary: "Import opencode.db",
        description:
          "Merge another database into this one. Rows whose primary key already exists are skipped, so nothing already stored here is overwritten or lost. The source is opened read-only and never modified.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "database",
      description: "Portable export and non-destructive merge of the OpenCode database.",
    }),
  )
