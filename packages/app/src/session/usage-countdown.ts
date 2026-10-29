import { Persist, removePersisted } from "@/runtime/persistence/storage"

export const USAGE_COUNTDOWN_KEYS = {
  goUpsell: "go-upsell",
  chatgptUsageLimit: "chatgpt-usage-limit",
} as const

/**
 * Clears the locally persisted usage/rate-limit countdown state: the 24h upsell
 * suppression windows and the ChatGPT usage notice.
 *
 * This only touches client-side persisted state. It never modifies the config file,
 * provider credentials, or `opencode.db` (and its `-wal`/`-shm`), and it does not
 * change the provider's actual quota.
 */
export function resetUsageCountdowns() {
  removePersisted(Persist.global(USAGE_COUNTDOWN_KEYS.goUpsell))
  removePersisted(Persist.global(USAGE_COUNTDOWN_KEYS.chatgptUsageLimit))
}
