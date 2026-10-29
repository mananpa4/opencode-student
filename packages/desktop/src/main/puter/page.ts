/**
 * The page the Puter bridge window loads. It is served from the bridge's own loopback origin
 * because Puter.js refuses to sign in from a `file://` page, and it keeps the session in the
 * window's persistent partition instead of in the app's renderer.
 *
 * The main process talks to `window.ocPuter` through `executeJavaScript`; streaming deltas come
 * back over `POST /internal/stream/<id>` so the OpenAI-compatible endpoint can forward them as SSE
 * while Puter produces them.
 */
export function bridgePage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>OpenCode Student · Puter</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 14px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText;
  }
  main { width: min(420px, calc(100vw - 48px)); display: grid; gap: 16px; }
  h1 { font-size: 16px; margin: 0; }
  p { margin: 0; opacity: 0.75; }
  button {
    font: inherit; padding: 10px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
    background: color-mix(in srgb, CanvasText 8%, transparent); color: inherit;
  }
  #error { color: #c2410c; white-space: pre-wrap; }
</style>
</head>
<body>
<main>
  <h1>Connect Puter</h1>
  <p id="hint">Sign in once to use Puter's models from OpenCode Student. The session stays in this window's profile.</p>
  <button id="signin" type="button">Sign in to Puter</button>
  <p id="error"></p>
</main>
<script src="/puter.js"></script>
<script>
  const error = (value) => (value && (value.message || value.msg)) || String(value)
  const textFrom = (response) => {
    if (response == null) return ""
    if (typeof response === "string") return response
    const content = response.message && response.message.content
    if (typeof content === "string") return content
    if (Array.isArray(content))
      return content.map((part) => (typeof part === "string" ? part : part && part.text) || "").join("")
    if (typeof response.text === "string") return response.text
    return ""
  }
  const post = (path, body) =>
    fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

  window.ocPuter = {
    status: async () => {
      const signedIn = puter.auth.isSignedIn()
      const user = signedIn ? await puter.auth.getUser().catch(() => null) : null
      return { signedIn, username: user && (user.username || user.email) }
    },
    signIn: async () => {
      await puter.auth.signIn()
      return true
    },
    models: async () => {
      const models = await puter.ai.listModels()
      return (models || []).map((model) => ({
        id: model.id || model.model || model.name,
        name: model.name || model.id || model.model,
        provider: model.provider,
      })).filter((model) => model.id)
    },
    chat: async ({ id, messages, model, temperature, maxTokens, stream }) => {
      const options = {}
      if (model) options.model = model
      if (typeof temperature === "number") options.temperature = temperature
      if (typeof maxTokens === "number") options.max_tokens = maxTokens

      try {
        if (!stream) return textFrom(await puter.ai.chat(messages, options))

        const response = await puter.ai.chat(messages, { ...options, stream: true })
        for await (const part of response) {
          const delta = typeof part === "string" ? part : part && (part.text || (part.message && part.message.content))
          if (delta) await post("/internal/stream/" + id, { delta })
        }
        await post("/internal/stream/" + id + "/done", {})
        return null
      } catch (cause) {
        if (stream) await post("/internal/stream/" + id + "/error", { message: error(cause) }).catch(() => {})
        throw cause
      }
    },
    image: async ({ prompt, model }) => {
      const options = {}
      if (model) options.model = model
      const image = await puter.ai.txt2img(prompt, options)
      return String(image && (image.src || image))
    },
  }

  const button = document.getElementById("signin")
  const hint = document.getElementById("hint")
  const failure = document.getElementById("error")

  const refresh = async () => {
    const status = await window.ocPuter.status()
    if (!status.signedIn) return
    hint.textContent = "Signed in" + (status.username ? " as " + status.username : "") + "."
    button.disabled = true
    document.title = "OpenCode Student · Puter connected"
  }

  button.addEventListener("click", async () => {
    failure.textContent = ""
    try {
      await window.ocPuter.signIn()
      await refresh()
    } catch (cause) {
      failure.textContent = error(cause)
    }
  })

  refresh().catch(() => {})
</script>
</body>
</html>`
}
