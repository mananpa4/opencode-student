import { randomBytes, randomUUID } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { BrowserWindow } from "electron"
import sdk from "../../../resources/puter/js.puter.js?raw"
import { fallbackCatalogue } from "./catalogue"
import { bridgePage } from "./page"

/**
 * Puter has no API key: it authenticates with a web session. This bridge runs the official SDK in
 * a hidden BrowserWindow on its own persistent partition and exposes the calls OpenCode needs over
 * a loopback OpenAI-compatible API, so Puter plugs into the existing provider pipeline instead of
 * becoming a second chat implementation.
 *
 * The window is only shown when a request needs a session. The user signs in once, the partition
 * keeps the token, and later launches never open it again.
 */

export interface PuterBridge {
  readonly url: string
  readonly token: string
}

type Catalogue = readonly { id: string; name?: string; provider?: string }[]

let running: Promise<PuterBridge> | undefined

export function puterBridge() {
  running ??= start()
  return running
}

async function start(): Promise<PuterBridge> {
  const token = randomBytes(24).toString("hex")
  const streams = new Map<string, Stream>()
  let window: BrowserWindow | undefined

  const run = <T>(script: string) => window!.webContents.executeJavaScript(script, true) as Promise<T>

  const status = () => run<{ signedIn: boolean; username?: string }>("window.ocPuter.status()")

  // A Puter call cannot run without a session, and signing in needs a visible page: this is the
  // only place the window is shown, so ordinary launches stay quiet.
  const ensureSignedIn = async () => {
    if ((await status()).signedIn) return
    const target = window
    if (!target || target.isDestroyed()) throw new Error("Puter sign-in window is unavailable")
    target.show()
    target.focus()

    for (let attempt = 0; attempt < 300; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      if (!window || window.isDestroyed()) throw new Error("Puter sign-in window was closed")
      if ((await status()).signedIn) {
        window.hide()
        return
      }
    }

    throw new Error("Timed out waiting for Puter sign-in")
  }

  const catalogue = async (): Promise<Catalogue> => {
    const current = await status()
    if (!current.signedIn) return fallbackCatalogue
    return run<Catalogue>("window.ocPuter.models()").catch(() => fallbackCatalogue)
  }

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname

    if (request.method === "GET" && path === "/") return text(response, 200, "text/html; charset=utf-8", bridgePage())
    if (request.method === "GET" && path === "/puter.js")
      return text(response, 200, "text/javascript; charset=utf-8", sdk)

    if (request.method === "POST" && path.startsWith("/internal/stream/")) {
      const [, , , id, action] = path.split("/")
      const stream = id ? streams.get(id) : undefined
      if (!stream) return json(response, 404, {})
      const payload = await readBody(request)
      if (action === "done") stream.done()
      else if (action === "error")
        stream.fail(typeof payload.message === "string" ? payload.message : "Puter request failed")
      else stream.push(typeof payload.delta === "string" ? payload.delta : "")
      return json(response, 200, {})
    }

    if (!path.startsWith("/v1/")) return json(response, 404, { error: { message: "Not found" } })
    if (request.headers.authorization !== `Bearer ${token}`)
      return json(response, 401, { error: { message: "Unauthorized" } })

    if (request.method === "GET" && path === "/v1/models") {
      const models = await catalogue()
      return json(response, 200, {
        object: "list",
        data: models.map((model) => ({ id: model.id, object: "model", owned_by: model.provider ?? "puter" })),
      })
    }

    if (request.method === "POST" && path === "/v1/chat/completions") {
      const input = await readBody(request)
      const model = typeof input.model === "string" ? input.model : undefined
      const messages = Array.isArray(input.messages) ? input.messages : []
      await ensureSignedIn()

      if (input.stream === true) {
        const id = randomUUID()
        const created = Math.floor(Date.now() / 1000)
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        })
        const send = (payload: unknown) => response.write(`data: ${JSON.stringify(payload)}\n\n`)
        const chunk = (delta: unknown, finish: string | null) =>
          send({
            id,
            object: "chat.completion.chunk",
            created,
            model: model ?? "puter",
            choices: [{ index: 0, delta, finish_reason: finish }],
          })

        streams.set(id, {
          push: (delta) => chunk({ content: delta }, null),
          done: () => {
            chunk({}, "stop")
            response.write("data: [DONE]\n\n")
            response.end()
            streams.delete(id)
          },
          fail: (reason) => {
            chunk({}, "stop")
            response.write(`data: ${JSON.stringify({ error: { message: reason } })}\n\n`)
            response.write("data: [DONE]\n\n")
            response.end()
            streams.delete(id)
          },
        })
        response.on("close", () => streams.delete(id))

        run(`window.ocPuter.chat(${JSON.stringify({ id, messages, model, temperature: input.temperature, maxTokens: input.max_tokens, stream: true })})`)
          .then(() => streams.get(id)?.done())
          .catch((error: unknown) => streams.get(id)?.fail(message(error)))
        return
      }

      const content = await run<string>(
        `window.ocPuter.chat(${JSON.stringify({ messages, model, temperature: input.temperature, maxTokens: input.max_tokens, stream: false })})`,
      )
      return json(response, 200, {
        id: `chatcmpl-${randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model ?? "puter",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })
    }

    if (request.method === "POST" && path === "/v1/images/generations") {
      const input = await readBody(request)
      await ensureSignedIn()
      const url = await run<string>(
        `window.ocPuter.image(${JSON.stringify({ prompt: input.prompt, model: input.model })})`,
      )
      return json(response, 200, { created: Math.floor(Date.now() / 1000), data: [{ url }] })
    }

    return json(response, 404, { error: { message: "Not found" } })
  }

  // The handler is fully defined before the port opens, so the page's first request cannot land
  // in the middle of initialization.
  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (response.headersSent) return response.end()
      json(response, 500, { error: { message: message(error) } })
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (typeof address !== "object" || !address) throw new Error("Puter bridge could not bind a loopback port")
  const origin = `http://127.0.0.1:${address.port}`

  window = new BrowserWindow({
    show: false,
    width: 520,
    height: 420,
    title: "OpenCode Student · Puter",
    autoHideMenuBar: true,
    webPreferences: {
      partition: "persist:opencode-student-puter",
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  window.on("closed", () => (window = undefined))
  await window.loadURL(`${origin}/`)

  return { url: origin, token }
}

type Stream = {
  readonly push: (delta: string) => void
  readonly done: () => void
  readonly fail: (reason: string) => void
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) return String(error.message)
  return String(error)
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString("utf8")
  if (!raw) return {} as Record<string, unknown>
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {} as Record<string, unknown>
  }
}

function text(response: ServerResponse, status: number, type: string, value: string) {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" })
  response.end(value)
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" })
  response.end(JSON.stringify(value))
}
