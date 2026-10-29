;(function () {
  var key = "opencode-theme-id"
  var themeId = localStorage.getItem(key) || "oc-2"

  var scheme = localStorage.getItem("opencode-color-scheme") || "system"
  var isDark = scheme === "dark" || (scheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  var mode = isDark ? "dark" : "light"

  // The desktop window composites the real desktop behind it, so an opaque floor here would hide
  // the wallpaper the glass is meant to refract. The main process hands the decision over in the
  // bootstrap before this script runs, and which kind of backdrop it is changes how much fill the
  // page has to paint itself (see glass-tokens.css).
  var transparency = window.electron && window.electron.bootstrap && window.electron.bootstrap.transparency
  var transparent = transparency === "alpha" || transparency === "system-backdrop"

  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode
  if (transparent) document.documentElement.dataset.windowTransparency = transparency
  document.documentElement.style.backgroundColor = transparent ? "transparent" : isDark ? "#080808" : "#fafafa"
  // Update theme-color meta tag to match app color scheme
  var metas = document.querySelectorAll("meta[name='theme-color']")
  if (metas.length > 0) metas[0].setAttribute("content", isDark ? "#080808" : "#fafafa")

  if (themeId === "oc-2") return

  var css = localStorage.getItem("opencode-theme-css-" + mode)
  if (css) {
    var style = document.createElement("style")
    style.id = "oc-theme-preload"
    style.textContent =
      ":root{color-scheme:" +
      mode +
      ";--text-mix-blend-mode:" +
      (isDark ? "plus-lighter" : "multiply") +
      ";" +
      css +
      "}"
    document.head.appendChild(style)
  }
})()
