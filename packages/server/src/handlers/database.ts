import { DatabaseTransfer } from "@opencode/core/database/transfer"
import { Global } from "@opencode/util/global"
import { DatabaseTransferError } from "@opencode/protocol/groups/database"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"

// `Global` is resolved here, at the group layer, because it is not part of the
// request-scoped services; requiring it inside a handler would leak into the
// router's request requirements.
export const DatabaseHandler = HttpApiBuilder.group(Api, "server.database", (handlers) =>
  Effect.gen(function* () {
    const global = yield* Global.Service
    return handlers
      .handle("database.export", (ctx) =>
        DatabaseTransfer.exportSnapshot({ ...ctx.payload, data: global.data }).pipe(transfer),
      )
      .handle("database.import", (ctx) => DatabaseTransfer.importSnapshot(ctx.payload).pipe(transfer))
  }),
)

function transfer<A, R>(effect: Effect.Effect<A, DatabaseTransfer.Error, R>) {
  return effect.pipe(
    Effect.mapError((error) => {
      const path = "path" in error ? error.path : undefined
      return new DatabaseTransferError({
        name: "DatabaseTransferError",
        data: { message: describe(error), path },
      })
    }),
  )
}

function describe(error: DatabaseTransfer.Error) {
  if (error instanceof DatabaseTransfer.SourceNotFoundError) return `Source database not found: ${error.path}`
  if (error instanceof DatabaseTransfer.InvalidSourceError) return `Not an OpenCode database: ${error.path}`
  if (error instanceof DatabaseTransfer.DestinationIsDatabaseError)
    return `Refusing to overwrite the live database: ${error.path}`
  if (error instanceof DatabaseTransfer.UnsupportedRuntimeError)
    return `Reading an external database requires the Bun runtime: ${error.message}`
  return error.message
}
