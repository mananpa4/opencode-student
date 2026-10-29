/**
 * The models the bridge advertises before Puter has a session. Puter's live catalogue replaces
 * these once the user signs in, but the provider still needs a declared list so the model picker
 * can offer Puter at all.
 */
export const fallbackCatalogue = [
  { id: "gpt-5-nano", name: "GPT-5 nano" },
  { id: "gpt-4o-mini", name: "GPT-4o mini" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "deepseek-chat", name: "DeepSeek Chat" },
] as const
