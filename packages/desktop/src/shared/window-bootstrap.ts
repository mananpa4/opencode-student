/**
 * How the window shows the desktop behind it. `system-backdrop` is drawn by DWM (Windows 11 22H2+,
 * macOS vibrancy), so the page can keep its normal glass fills. `alpha` is per-pixel transparency
 * with no system blur (Windows 10), so the page has to compensate with its own floor.
 */
export type WindowTransparency = "off" | "system-backdrop" | "alpha"

// What the main process already knows when it creates a window, handed to the renderer through the
// preload's argv so the shell can mount before the IPC port exists. Undefined means "ask over IPC".
export type WindowBootstrap = {
  id: string
  firstLaunchPending?: boolean
  /** The app runs packaged (`app.isPackaged`), as extensions' `Build.packaged` reports in both processes. */
  packaged?: boolean
  /** The window composites the desktop behind it, so the page must not paint an opaque floor. */
  transparency?: WindowTransparency
}

const prefix = "--opencode-window="

export function windowBootstrapArgument(bootstrap: WindowBootstrap) {
  return prefix + encodeURIComponent(JSON.stringify(bootstrap))
}

export function windowBootstrapFromArguments(args: readonly string[]): WindowBootstrap {
  const value = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)

  if (!value) throw new Error("Window bootstrap argument not found")

  return JSON.parse(decodeURIComponent(value))
}
