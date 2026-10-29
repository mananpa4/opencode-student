# OpenCode Student — Roadmap

Ideas captured for later. Items here are not started; they record intent and the constraints that
will shape the implementation.

## Auto-update from a GitHub repository

Update OpenCode Student by checking a GitHub repository instead of a hosted update feed, so builds
can be published by pushing a tag rather than by running a release pipeline.

- **Check**: query the repository's latest release (or newest tag) through the GitHub API, comparing
  it against the running version. Rate limits apply to unauthenticated requests from an installed
  app, so the check should be cached and spaced out rather than run on every launch.
- **Download**: fetch the platform artifact (NSIS installer on Windows, dmg on macOS, AppImage or
  deb on Linux) from the release assets. Assets need stable, predictable names per platform so the
  client can select one without guessing.
- **Verify**: check a published checksum or signature before running anything. An update path that
  executes a downloaded binary has to authenticate it, and a compromised or misconfigured repo must
  not be able to ship arbitrary code to installed copies.
- **Apply**: Electron's `autoUpdater` needs an update server speaking the Squirrel protocol, which a
  plain GitHub repo does not provide. The realistic options are to point `electron-updater` at the
  GitHub releases URL it already supports, or to download the artifact and launch the installer
  ourselves. Either way the app must relaunch cleanly and roll back or keep the previous version if
  the new one fails to start.
- **Respect channels**: the existing `dev` / `beta` / `prod` icon channels imply release channels;
  the update check should follow the same channel rather than always taking the newest build.

## System tray

Shipped: the desktop app now runs in the system tray with a custom icon, a right-click menu
(Open, New Session, Open Project…, Settings, Quit), and quick-launch links to the most recent
projects. See `packages/desktop/src/main/native/tray.ts`.

## Liquid Glass: legibility over a real backdrop

Shipped: the glass theme is the default, and the window composites the real desktop behind it.
Two parts are worth revisiting later.

- **The halo.** Text legibility uses 7.css's Aero recipe: the same shadow repeated several times
  instead of one wide blur, so the layers stack into an opaque ring around each glyph. The title
  bar takes the literal 8 × `0 0 10px`; surfaces and body use shorter stacks. Text is near-black
  in light mode and near-white in dark mode, matching 7.css's `--w7-el-c: #000`.
- **The floor.** Windows 10 has no desktop blur for a transparent Electron window, so the window
  paints its own frosted floor (68% white, 60% black) rather than a thin tint. Below that, text
  from the window behind reads through the sidebar.

**Not done — real blur behind the window on Windows 10.** `SetWindowCompositionAttribute` with
`ACCENT_ENABLE_BLURBEHIND` / `ACCENT_ENABLE_ACRYLICBLURBEHIND` still blurs the desktop on Windows
10, unlike `backgroundMaterial`, which is Windows 11 only. Electron does not expose it, so this
needs a small FFI bridge (for example `koffi` calling `user32.dll` with the window handle from
`getNativeWindowHandle()`). That would replace the frosted floor with a true acrylic material and
remove the ghosting entirely. The acrylic variant is known to lag while dragging a window on
Windows 10; the older blur-behind variant does not tint.
