import type { ElectronAPI } from "../api-types"

const deepLinkEvent = "opencode:deep-link"

export function startDeepLinks(api: ElectronAPI) {
  void api.consumeInitialDeepLinks().then(emitDeepLinks)
  api.onDeepLink(emitDeepLinks)
}

/** Publishes deep links for the app to consume, whether they arrived from the OS or from the tray. */
export function emitDeepLinks(urls: string[]) {
  if (urls.length === 0) return
  window.__OPENCODE__ ??= {}
  window.__OPENCODE__.deepLinks = [...(window.__OPENCODE__.deepLinks ?? []), ...urls]
  window.dispatchEvent(new CustomEvent(deepLinkEvent, { detail: { urls } }))
}
