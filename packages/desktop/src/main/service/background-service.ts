import { app } from "electron"
import { mkdirSync } from "node:fs"
import { Context, Effect, FileSystem, Layer, Option, Path } from "effect"
import { puterBridge } from "../puter/bridge"
import { ensurePuterConfig } from "../puter/config"
import { BackgroundServiceState } from "./background-service-state"
import { cleanStages } from "./cli-stages"
import { DesktopCli } from "./desktop-cli"
import { seedStudentDatabase } from "./seed-database"
import { SidecarCredentials } from "./sidecar-credentials"
import { sidecarProbe } from "./sidecar-probe"
import {
  studentCacheRoot,
  studentConfigDir,
  studentDatabaseFile,
  studentDataRoot,
  studentServiceFile,
} from "./student-paths"

export * as BackgroundService from "./background-service"

export interface Interface {
  readonly connection: Effect.Effect<SidecarCredentials.Data>
  readonly reconnect: Effect.Effect<SidecarCredentials.Data>
}

export class Service extends Context.Service<Service, Interface>()("opencode/desktop/BackgroundService") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const context = yield* Effect.context<FileSystem.FileSystem | Path.Path | DesktopCli.Service>()

    return Service.of(
      yield* BackgroundServiceState.make({
        initial: connect("initial").pipe(Effect.provide(context)),
        reconnect: connect("reconnect").pipe(Effect.provide(context), Effect.orDie),
      }),
    )
  }),
)

const connect = Effect.fn("BackgroundService.connect")(function* (mode: "initial" | "reconnect") {
  yield* Effect.logInfo("starting v2 background service")
  const path = yield* Path.Path
  const desktopCli = yield* DesktopCli.Service
  const runFork = Effect.runForkWith(yield* Effect.context<FileSystem.FileSystem | Path.Path>())
  const isolated = !app.isPackaged && process.env.OPENCODE_DESKTOP_ISOLATED_SERVER === "1"
  const cli = yield* desktopCli.resolve
  const version = mode === "initial" ? cli.version : undefined

  // OpenCode Student owns its config, database, data, and state. Nothing is read from the installed
  // OpenCode's profile: its user, credentials, providers, subscriptions, skills, and plugins belong
  // to a different agent. Student configures all of that separately.
  process.env.OPENCODE_CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR ?? studentConfigDir()
  process.env.XDG_DATA_HOME = process.env.XDG_DATA_HOME ?? studentDataRoot()
  process.env.XDG_CACHE_HOME = process.env.XDG_CACHE_HOME ?? studentCacheRoot()
  const database = process.env.OPENCODE_DB ?? studentDatabaseFile()
  process.env.OPENCODE_DB = database
  if (database !== ":memory:") mkdirSync(path.dirname(database), { recursive: true })

  const puter = yield* Effect.tryPromise(() => puterBridge()).pipe(
    Effect.tapError((error) => Effect.logWarning("puter bridge unavailable", { error })),
    Effect.option,
  )
  if (Option.isSome(puter)) {
    const bridge = puter.value
    yield* Effect.sync(() => ensurePuterConfig({ baseURL: `${bridge.url}/v1`, apiKey: bridge.token }))
  }

  const client = yield* Effect.promise(() => import("@opencode/client/service"))

  const ensure = () =>
    client.Service.ensure({
      // Student's own registration file. The child is given the matching state root explicitly:
      // the desktop drops an inherited XDG_STATE_HOME on Windows before this runs.
      file: studentServiceFile(),
      env: { XDG_STATE_HOME: app.getPath("userData") },
      version,
      // A fixed port makes a second contender fail to bind and back off; port 0 never collides, so two
      // services could boot against the same database.
      command: [
        ...cli.command,
        "serve",
        "--service",
        ...(isolated ? ["--hostname", "0.0.0.0", "--port", String(0x0c0c)] : []),
      ],
      onStart: (reason, previousVersion) =>
        runFork(Effect.logInfo("v2 CLI background service starting", { reason, previousVersion })),
    })

  // A compatible service the entry module already found is adopted at once; ensure() still runs
  // afterwards for its side effects (terminal handoff completion), off the renderer's path.
  const early = mode === "initial" && !isolated ? yield* Effect.promise(sidecarProbe) : undefined

  if (early) yield* Effect.sync(() => void ensure().catch(() => undefined))
  const service = early ?? (yield* Effect.tryPromise(ensure))

  if (service.auth?.type !== "basic") throw new Error("V2 CLI background service did not provide authentication")
  const auth = service.auth
  const url = new URL(service.url)

  if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1"
  yield* Effect.logInfo("v2 CLI background service ready", {
    version,
    probed: !!early,
    ...endpoint(url.origin),
  })

  // Seed before handing credentials over: the merge is the only time the renderer could otherwise
  // read an empty database and never refresh, because the import writes rows without bus events.
  // The marker makes this a one-time cost; a failed import is retried on the next launch.
  if (mode === "initial" && database !== ":memory:")
    yield* Effect.tryPromise(() => seedStudentDatabase({ url: url.origin, password: auth.password })).pipe(
      Effect.tap((result) =>
        Option.isSome(result)
          ? Effect.logInfo("seeded student database from the installed OpenCode", result.value)
          : Effect.logInfo("student database already seeded or nothing to import"),
      ),
      Effect.catch((error) => Effect.logWarning("failed to seed the student database", { error })),
    )

  // Only packaged and isolated builds run a staged copy; any other binary sits in the source tree.
  // The service now runs the current version, so an older copy at most belongs to a process still exiting.
  if (mode === "initial" && (app.isPackaged || isolated) && cli.binary)
    runFork(
      cleanStages(cli.binary).pipe(
        Effect.catch((error) => Effect.logError("failed to clean staged v2 CLIs", { error })),
      ),
    )
  const ready = { url: url.origin, password: auth.password } satisfies SidecarCredentials.Data
  SidecarCredentials.set(ready)

  return ready
})

function endpoint(url: string | undefined) {
  if (!url || !URL.canParse(url)) return {}
  const parsed = new URL(url)

  return { url, hostname: parsed.hostname, port: parsed.port }
}
