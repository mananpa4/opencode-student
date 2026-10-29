/**
 * Web content hygiene, adapted from Scrap-Crawl's `@aio/security` module (itself inspired by
 * WipeDown, MIT). Untrusted page content is a known prompt-injection vector, so everything a web
 * tool hands to a model passes through `sanitizeWebContent` first.
 *
 * The pass is deliberately local and dependency-free: it strips zero-width and bidi control
 * characters used to hide instructions, and neutralises the phrases that try to reassign the
 * model's role or override its instructions. A page that is almost entirely payload is discarded
 * rather than trimmed.
 */

export interface SanitizeResult {
  /** Content safe to hand to a model. Empty when the page was discarded. */
  readonly clean: string
  /** True when the page was reduced to (near) nothing and should be dropped. */
  readonly flagged: boolean
  /** What was removed or normalised, for logs and tool metadata. */
  readonly events: string[]
}

const injectionPatterns: readonly { re: RegExp; label: string }[] = [
  { re: /ignore (all |the )?(previous|prior|above) (instructions|prompts?)/gi, label: "override-instruction" },
  { re: /disregard (all |the )?(previous|prior|above)/gi, label: "override-instruction" },
  { re: /you are now (a|an|in) .{0,40}(mode|assistant|developer)/gi, label: "role-reassignment" },
  { re: /system\s*prompt\s*[:>]/gi, label: "system-prompt-spoof" },
  { re: /<\s*\/?\s*(system|assistant|user)\s*>/gi, label: "chat-role-tag" },
  { re: /\b(execute|run|eval)\b.{0,30}\b(command|code|shell|os\.system)\b/gi, label: "exec-directive" },
  { re: /print\s+["']?!{2,}/gi, label: "marker-injection" },
]

// U+200B–U+200F, U+202A–U+202E, U+2060–U+2064 and U+FEFF hide text from a reader but not a parser.
const hiddenCharacters = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g

export function sanitizeWebContent(input: string): SanitizeResult {
  const events: string[] = []
  let text = input

  if (hiddenCharacters.test(text)) {
    text = text.replace(hiddenCharacters, "")
    events.push("removed-hidden-characters")
  }

  for (const { re, label } of injectionPatterns) {
    if (!re.test(text)) continue
    text = text.replace(re, "[redacted]")
    events.push(label)
  }

  // A page that lost almost all of its text was payload rather than content.
  const original = input.replace(/\s+/g, "").length
  const remaining = text.replace(/\[redacted\]/g, "").replace(/\s+/g, "").length
  const flagged = original > 0 && remaining / original < 0.2

  return { clean: flagged ? "" : text, flagged, events }
}
