import { app, Menu, Tray, nativeImage } from "electron"
import type { MenuItemConstructorOptions } from "electron"
import { Effect, Path } from "effect"
import { emitIpcEvent } from "../ipc-events"
import { DesktopPaths } from "../paths"
import { TrayOpenProject } from "../../shared/ipc-rpc/events"
import type { TrayProject } from "../../shared/ipc-contract"
import { getLastFocusedWindow } from "../windows"
import { nativeT } from "./translations"

export type TrayHandlers = {
  readonly trigger: (id: string) => void
  readonly createWindow: () => void
}

/** How many recent projects the menu lists. Beyond this the submenu stops being a quick launch. */
const MAX_RECENT_PROJECTS = 5

// The tray must outlive the function that creates it, so it lives here rather than in a local.
let tray: Tray | undefined
let installed: TrayHandlers | undefined
let projects: readonly TrayProject[] = []

/** Rebuilds an installed tray after the locale or the project list changed. */
export function refreshTray() {
  if (!tray || !installed) return

  tray.setContextMenu(build(installed))
}

/** Replaces the recent-project quick links. The renderer pushes them; it owns the ordering. */
export function setTrayProjects(next: readonly TrayProject[]) {
  const capped = next.slice(0, MAX_RECENT_PROJECTS)

  if (sameProjects(projects, capped)) return

  projects = capped
  refreshTray()
}

export const installTray = Effect.gen(function* () {
  const path = yield* Path.Path
  const paths = yield* DesktopPaths.resolve

  // A packaged build ships its icons under resources; a development run reads them from the repo.
  const icons = app.isPackaged ? path.join(process.resourcesPath, "icons") : path.join(paths.developmentResourcesRoot, "icons")
  const image = nativeImage.createFromPath(path.join(icons, process.platform === "win32" ? "32x32.png" : "icon.png"))

  // Without an icon the tray is an unnamed grey square, which is worse than no tray at all.
  if (image.isEmpty()) return

  tray = new Tray(image)
  tray.setToolTip(nativeT("desktop.menu.app"))
  // On Windows and Linux a left click is how the window comes back when the app is closed to the tray.
  tray.on("click", () => showWindow())
})

function showWindow() {
  const win = getLastFocusedWindow()

  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()

    return
  }

  installed?.createWindow()
}

function openProject(directory: string) {
  const win = getLastFocusedWindow()

  if (!win) {
    installed?.createWindow()

    return
  }

  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  // The renderer selects the project once the window it belongs to is up.
  if (!win.isDestroyed()) emitIpcEvent(win.webContents, new TrayOpenProject({ directory }))
}

function build(handlers: TrayHandlers): Menu {
  return Menu.buildFromTemplate([
    { label: nativeT("desktop.tray.open"), click: showWindow },
    { type: "separator" },
    { label: nativeT("desktop.tray.newSession"), click: () => handlers.trigger("session.new") },
    { label: nativeT("desktop.tray.openProject"), click: () => handlers.trigger("project.open") },
    { type: "separator" },
    { label: nativeT("desktop.tray.recentProjects"), enabled: false, submenu: recent() },
    { type: "separator" },
    { label: nativeT("desktop.tray.settings"), click: () => handlers.trigger("settings.open") },
    { type: "separator" },
    { label: nativeT("desktop.tray.quit"), click: () => app.quit() },
  ])
}

function recent(): MenuItemConstructorOptions[] {
  if (!projects.length) return [{ label: nativeT("desktop.tray.noRecentProjects"), enabled: false }]

  return projects.map((project) => ({
    label: project.name,
    toolTip: project.directory,
    click: () => openProject(project.directory),
  }))
}

function sameProjects(a: readonly TrayProject[], b: readonly TrayProject[]) {
  return a.length === b.length && a.every((project, index) => project.directory === b[index].directory)
}

/** Wires the handlers an installed tray needs. Called once, after the window and IPC layers exist. */
export function startTray(handlers: TrayHandlers) {
  if (!tray) return

  installed = handlers
  tray.setContextMenu(build(handlers))
}
