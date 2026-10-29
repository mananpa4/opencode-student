import { BrowserWindow } from "electron"
import type { WindowTransparency } from "../../shared/window-bootstrap"
import { WINDOW_TRANSPARENCY_KEY } from "../storage/keys"
import { getStore } from "../storage/store"

/**
 * Real desktop transparency, the way CompactFiles does it with WPF-UI's
 * `WindowBackdropType="Acrylic"`: the system composites a backdrop behind the
 * window and the app only paints translucent glass on top.
 *
 * Electron has two ways to get there, and which one works depends on the OS:
 *
 *   system-backdrop  Windows 11 22H2+ (build 22621) lets DWM draw Mica or
 *                    Acrylic behind a frameless window via `backgroundMaterial`.
 *                    Nothing is per-pixel transparent, so clicks, resizing and
 *                    the caption overlay behave normally.
 *   alpha            Windows 10 and older have no system material, so the only
 *                    way to see the wallpaper is a per-pixel transparent window.
 *                    The page must not paint an opaque floor, and every surface
 *                    has to keep alpha > 0 or clicks fall through to the window
 *                    underneath.
 *
 * Linux has no equivalent and stays opaque.
 */

// `process.getSystemVersion()` reports "10.0.19044" on Windows 10 and
// "10.0.22631" on Windows 11 23H2, so the third segment is the build number.
function systemBackdropAvailable() {
  if (process.platform !== "win32") return false

  return Number(process.getSystemVersion().split(".")[2] ?? 0) >= 22621
}

export function windowTransparency(): WindowTransparency {
  if (process.platform === "linux") return "off"
  if (getStore().get(WINDOW_TRANSPARENCY_KEY) === false) return "off"

  return systemBackdropAvailable() ? "system-backdrop" : "alpha"
}

export function transparencyEnabled() {
  return windowTransparency() !== "off"
}

/**
 * The frame options that turn the window into glass. `transparent` and
 * `backgroundMaterial` are construction-only, so this is spread into
 * `new BrowserWindow({...})` rather than applied afterwards.
 */
export function transparencyOptions(): Partial<Electron.BrowserWindowConstructorOptions> {
  switch (windowTransparency()) {
    case "system-backdrop":
      // `backgroundMaterial` is drawn by DWM, so the window itself must not be
      // per-pixel transparent; only its background colour is clear.
      return { transparent: false, backgroundColor: "#00000000", backgroundMaterial: "acrylic" }
    case "alpha":
      return process.platform === "darwin"
        ? {
            transparent: true,
            backgroundColor: "#00000000",
            vibrancy: "under-window",
            visualEffectState: "active",
          }
        : { transparent: true, backgroundColor: "#00000000" }
    default:
      return {}
  }
}

/**
 * The renderer reports its theme background on every boot so a window shown
 * before the first paint already matches. A transparent window has no floor to
 * paint, so the report is remembered but never applied.
 */
export function applyWindowBackground(win: BrowserWindow, color: string) {
  if (transparencyEnabled()) {
    win.setBackgroundColor("#00000000")
    return
  }

  win.setBackgroundColor(color)
}
