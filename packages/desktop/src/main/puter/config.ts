import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fallbackCatalogue } from "./catalogue"
import { studentConfigDir } from "../service/student-paths"

/**
 * OpenCode Student keeps its own configuration so it never rewrites the installed OpenCode's
 * files. It does not read the installed OpenCode's config directory at all: Student is a separate
 * agent with its own user, credentials, providers, skills, and plugins.
 *
 * This file only holds values Student owns. The Puter provider is rewritten on every launch
 * because its loopback port and token change.
 */

export function ensurePuterConfig(input: { baseURL: string; apiKey: string }) {
  const directory = process.env.OPENCODE_CONFIG_DIR ?? studentConfigDir()
  mkdirSync(directory, { recursive: true })
  const file = path.join(directory, "opencode.json")
  const existing = existsSync(file) ? read(file) : undefined

  // Never overwrite a config we cannot parse: that file is the user's, not ours.
  if (existsSync(file) && !existing) return

  const config: Record<string, unknown> = existing ?? {}
  const providers = config.providers === undefined ? {} : record(config.providers)
  if (!providers) return
  providers.puter = {
    name: "Puter",
    package: "@ai-sdk/openai-compatible",
    settings: { baseURL: input.baseURL, apiKey: input.apiKey },
    models: Object.fromEntries(fallbackCatalogue.map((model) => [model.id, { name: model.name }])),
  }
  config.providers = providers
  removeLegacyPuter(config)

  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, "utf8")
  renameSync(temporary, file)
}

// `provider` is the V1 key. Normalize migrates it, but writing `providers.puter` next to a legacy
// `provider.puter` would leave two copies of the loopback token in one file.
function removeLegacyPuter(config: Record<string, unknown>) {
  if (config.provider === undefined) return
  const legacy = record(config.provider)
  if (!legacy || !("puter" in legacy)) return
  delete legacy.puter
  if (Object.keys(legacy).length === 0) delete config.provider
  else config.provider = legacy
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  // SAFETY: the guard above rejects every non-object and array value, leaving a plain object.
  return value as Record<string, unknown>
}

function read(file: string) {
  try {
    return record(JSON.parse(readFileSync(file, "utf8")))
  } catch {
    return undefined
  }
}
