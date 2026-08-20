/* ============================================================
   On Device - preboot

   Runs before the page is painted so the visitor's chosen theme,
   text size and density are already in place. Without this there
   is a white flash before a dark theme loads.

   Everything it reads comes from this device's own local storage.
   ============================================================ */

(function () {
  "use strict";

  var KEY = "ondevice.settings.v1";
  var root = document.documentElement;

  var settings = null;
  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) settings = JSON.parse(raw);
  } catch (err) {
    /* Local storage can be unavailable (private windows, file:// in some
       browsers). The app still works; it just will not remember choices.
       We say so on the Settings page rather than failing quietly here. */
    root.setAttribute("data-storage", "unavailable");
  }

  var a = (settings && settings.appearance) || {};

  /* Theme ------------------------------------------------- */
  var theme = a.theme || "system";
  if (theme === "system") {
    var prefersDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "midnight" : "paper";
    root.setAttribute("data-theme-mode", "system");
  } else {
    root.setAttribute("data-theme-mode", "fixed");
  }
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = (theme === "paper" || theme === "sepia") ? "light" : "dark";

  /* Accent ------------------------------------------------ */
  if (a.accent) {
    root.style.setProperty("--accent", a.accent);
    if (a.accentHover) root.style.setProperty("--accent-hover", a.accentHover);
    if (a.accentFg) root.style.setProperty("--accent-fg", a.accentFg);
    if (a.accentSoft) root.style.setProperty("--accent-soft", a.accentSoft);
    if (a.accentLine) root.style.setProperty("--accent-line", a.accentLine);
    root.style.setProperty("--focus", a.accent);
  }

  /* Density, text size, font, corners, motion -------------- */
  if (a.density) root.setAttribute("data-density", a.density);
  if (a.textScale) root.style.setProperty("--text-scale", String(a.textScale));
  if (a.font && a.font !== "ui") root.setAttribute("data-font", a.font);
  if (a.corners === "square") root.setAttribute("data-corners", "square");
  if (a.motion === "reduced") root.setAttribute("data-motion", "reduced");

  /* Layout ------------------------------------------------ */
  var l = (settings && settings.layout) || {};
  if (l.view) root.setAttribute("data-view", l.view);

  /* Language ---------------------------------------------- */
  root.setAttribute("lang", (settings && settings.language) || "en");
})();
