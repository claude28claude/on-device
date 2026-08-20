/* On Device - the Settings page */

import { initPage } from "./app.js";
import * as store from "./store.js";
import * as idb from "./idb.js";
import * as i18n from "./i18n.js";
import { t } from "./i18n.js";
import { el, icon, toast, announce, confirmDestructive, formatBytes } from "./ui.js";
import { accentSet, contrastRatio, parseColour } from "./colour.js";

const root = document.documentElement;

/* ---- Small binding helpers ------------------------------ */
function bindSegmented(id, path, apply) {
  const host = document.getElementById(id);
  if (!host) return;
  const current = store.get(path);
  for (const btn of host.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.value === String(current)));
    btn.addEventListener("click", () => {
      store.set(path, btn.dataset.value);
      for (const other of host.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      if (apply) apply(btn.dataset.value);
      announce(`${btn.textContent.trim()} selected.`);
    });
  }
}

function bindSelect(id, path, apply) {
  const node = document.getElementById(id);
  if (!node) return;
  node.value = String(store.get(path));
  node.addEventListener("change", () => {
    store.set(path, node.value);
    if (apply) apply(node.value);
  });
}

function bindCheckbox(id, path, apply) {
  const node = document.getElementById(id);
  if (!node) return;
  node.checked = Boolean(store.get(path));
  node.addEventListener("change", () => {
    store.set(path, node.checked);
    if (apply) apply(node.checked);
  });
}

/* ---- Appearance ----------------------------------------- */
function applyTheme(value) {
  let theme = value;
  if (value === "system") {
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = dark ? "midnight" : "paper";
    root.setAttribute("data-theme-mode", "system");
  } else {
    root.setAttribute("data-theme-mode", "fixed");
  }
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = (theme === "paper" || theme === "sepia") ? "light" : "dark";
  /* The accent is derived from the background, so it must be redone
     whenever the theme changes. */
  applyAccent(store.get("appearance.accent", ""), { silent: true });
}

function clearAccentVars() {
  for (const name of ["--accent", "--accent-hover", "--accent-fg", "--accent-soft", "--accent-line", "--focus"]) {
    root.style.removeProperty(name);
  }
}

function applyAccent(hex, { silent = false } = {}) {
  const warnHost = document.getElementById("accent-warning");
  if (warnHost) warnHost.remove();

  if (!hex) {
    clearAccentVars();
    store.set("appearance.accent", "");
    store.update({ appearance: { accentHover: "", accentFg: "", accentSoft: "", accentLine: "" } });
    return;
  }

  /* Read the theme's own background so the derived shades suit it. */
  clearAccentVars();
  const bg = getComputedStyle(root).getPropertyValue("--bg");
  const set = accentSet(hex, bg);
  if (!set) {
    toast(`“${hex}” is not a colour we can read. Use a value like #1750c8.`, { kind: "error" });
    return;
  }

  root.style.setProperty("--accent", set.accent);
  root.style.setProperty("--accent-hover", set.accentHover);
  root.style.setProperty("--accent-fg", set.accentFg);
  root.style.setProperty("--accent-soft", set.accentSoft);
  root.style.setProperty("--accent-line", set.accentLine);
  root.style.setProperty("--focus", set.accent);

  store.update({
    appearance: {
      accent: set.accent,
      accentHover: set.accentHover,
      accentFg: set.accentFg,
      accentSoft: set.accentSoft,
      accentLine: set.accentLine
    }
  });

  /* Tell the visitor honestly if their colour is hard to read. */
  if (set.contrastOnBackground < 4.5) {
    const host = document.getElementById("accent-swatches");
    if (host && host.parentNode) {
      host.parentNode.append(
        el("p", { class: "field-hint", id: "accent-warning" }, [
          el("strong", { text: "Careful: " }),
          document.createTextNode(
            `this colour only reaches a contrast of ${set.contrastOnBackground.toFixed(1)} to 1 ` +
            `against the page background. Links using it will be hard to read for some people; ` +
            `4.5 to 1 is the accessible minimum. Buttons are still fine, because their text ` +
            `colour is adjusted automatically.`
          )
        ])
      );
    }
  }
  if (!silent) announce("Accent colour updated.");
}

function wireAppearance() {
  /* Theme */
  const swatches = document.getElementById("theme-swatches");
  if (swatches) {
    const current = store.get("appearance.theme", "system");
    for (const btn of swatches.querySelectorAll(".theme-swatch")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeValue === current));
      btn.addEventListener("click", () => {
        store.set("appearance.theme", btn.dataset.themeValue);
        for (const other of swatches.querySelectorAll(".theme-swatch")) {
          other.setAttribute("aria-pressed", String(other === btn));
        }
        applyTheme(btn.dataset.themeValue);
        announce(`${btn.textContent.trim()} theme applied.`);
      });
    }
  }

  /* Accent */
  const accentHost = document.getElementById("accent-swatches");
  const customInput = document.getElementById("accent-custom");
  if (accentHost) {
    const current = store.get("appearance.accent", "");
    for (const btn of accentHost.querySelectorAll(".accent-dot")) {
      btn.setAttribute("aria-pressed", String((btn.dataset.accent || "") === current));
      btn.addEventListener("click", () => {
        for (const other of accentHost.querySelectorAll(".accent-dot")) {
          other.setAttribute("aria-pressed", String(other === btn));
        }
        applyAccent(btn.dataset.accent || "");
      });
    }
    if (customInput) {
      if (current) customInput.value = current;
      customInput.addEventListener("input", () => {
        for (const other of accentHost.querySelectorAll(".accent-dot")) {
          other.setAttribute("aria-pressed", "false");
        }
        applyAccent(customInput.value);
      });
    }
  }

  bindSegmented("density-toggle", "appearance.density", (v) => {
    root.setAttribute("data-density", v);
  });

  bindSegmented("corners-toggle", "appearance.corners", (v) => {
    if (v === "square") root.setAttribute("data-corners", "square");
    else root.removeAttribute("data-corners");
  });

  bindSelect("font-choice", "appearance.font", (v) => {
    if (v === "ui") root.removeAttribute("data-font");
    else root.setAttribute("data-font", v);
  });

  bindSelect("motion-choice", "appearance.motion", (v) => {
    if (v === "reduced") root.setAttribute("data-motion", "reduced");
    else if (v === "full") root.setAttribute("data-motion", "full");
    else root.removeAttribute("data-motion");
  });

  /* Text size */
  const scale = document.getElementById("text-scale");
  const scaleHint = document.getElementById("text-scale-hint");
  if (scale) {
    scale.value = String(store.get("appearance.textScale", 1));
    const paint = () => {
      const value = Number(scale.value);
      root.style.setProperty("--text-scale", String(value));
      if (scaleHint) scaleHint.textContent = t("settings.textScale.hint", { pct: Math.round(value * 100) });
      scale.setAttribute("aria-valuetext", `${Math.round(value * 100)} percent`);
    };
    paint();
    scale.addEventListener("input", () => {
      store.set("appearance.textScale", Number(scale.value));
      paint();
    });
  }
}

/* ---- Layout --------------------------------------------- */
function wireLayout() {
  bindSegmented("view-choice", "layout.view", (v) => root.setAttribute("data-view", v));
  bindSelect("home-opens", "layout.homeOpensTo");

  const unhide = document.getElementById("unhide-all");
  if (unhide) {
    const hidden = store.get("layout.hidden", []);
    unhide.disabled = hidden.length === 0;
    unhide.textContent = hidden.length
      ? `Show all ${hidden.length} hidden tools again`
      : "Show all tools again";
    unhide.addEventListener("click", () => {
      store.set("layout.hidden", []);
      unhide.disabled = true;
      unhide.textContent = "Show all tools again";
      toast("All tools are visible again.", { kind: "ok" });
    });
  }
}

/* ---- Behaviour and defaults ----------------------------- */
function wireBehaviour() {
  bindCheckbox("auto-download", "behaviour.autoDownload");
  bindCheckbox("keep-workspace", "behaviour.keepWorkspace");
  bindCheckbox("auto-clear", "behaviour.autoClearOnClose");
  bindCheckbox("keep-history", "behaviour.keepHistory");
  bindCheckbox("confirm-destructive", "behaviour.confirmDestructive");

  const quality = document.getElementById("image-quality");
  const qualityHint = document.getElementById("quality-hint");
  if (quality) {
    quality.value = String(store.get("defaults.imageQuality", 82));
    const paint = () => {
      if (qualityHint) qualityHint.textContent = `${quality.value} out of 100.`;
      quality.setAttribute("aria-valuetext", `${quality.value} out of 100`);
    };
    paint();
    quality.addEventListener("input", () => {
      store.set("defaults.imageQuality", Number(quality.value));
      paint();
    });
  }

  bindSelect("image-format", "defaults.imageFormat");
  bindSelect("page-size", "defaults.pageSize");
  bindSelect("dpi", "defaults.dpi");
  bindSelect("units", "defaults.units");

  const pattern = document.getElementById("filename-pattern");
  const preview = document.getElementById("filename-preview");
  if (pattern) {
    pattern.value = store.get("defaults.filenamePattern", "{name}-{tool}.{ext}");
    const paint = () => {
      const sample = pattern.value
        .replace("{name}", "holiday-photo")
        .replace("{tool}", "resized")
        .replace("{date}", new Date().toISOString().slice(0, 10))
        .replace("{n}", "1")
        .replace("{ext}", "jpg");
      if (preview) preview.textContent = `A file called holiday-photo.jpg would come out as: ${sample}`;
    };
    paint();
    pattern.addEventListener("input", () => {
      store.set("defaults.filenamePattern", pattern.value);
      paint();
    });
  }
}

/* ---- Language ------------------------------------------- */
async function wireLanguage() {
  const select = document.getElementById("language-choice");
  const note = document.getElementById("language-note");
  if (!select) return;

  select.textContent = "";
  for (const lang of i18n.LANGUAGES) {
    let meta;
    try {
      const mod = await lang.loader();
      meta = mod.meta || { code: lang.code, nativeName: lang.code, complete: false };
    } catch (err) {
      console.error(`[On Device] Language “${lang.code}” could not be loaded:`, err);
      continue;
    }
    let suffix = "";
    if (!meta.complete) suffix = " — partly translated";
    else if (meta.reviewed === false) suffix = " — not yet checked by a native speaker";
    select.append(el("option", { value: lang.code, text: meta.nativeName + suffix }));
  }

  select.value = store.get("language", "en");

  select.addEventListener("change", async () => {
    try {
      const meta = await i18n.setLanguage(select.value);
      store.set("language", select.value);
      i18n.applyToDom(document);
      showLanguageNote(note, meta);
      announce(`Language changed to ${meta.nativeName}.`);
      toast(
        "Language changed. Reload the page to translate everything that was already on screen.",
        { kind: "ok", timeout: 8000 }
      );
    } catch (err) {
      toast(err && err.message ? err.message : String(err), { kind: "error", title: "Could not change language" });
      select.value = store.get("language", "en");
    }
  });

  showLanguageNote(note, i18n.getLanguageMeta());
}

function showLanguageNote(host, meta) {
  if (!host) return;
  host.textContent = "";
  if (!meta || meta.code === "en") return;
  host.append(
    el("div", { class: "note note-warn" }, [
      el("strong", { class: "note-title", text: "About this translation" }),
      el("p", {
        class: "mb-0",
        text:
          meta.reviewNote ||
          "This translation was written to prove the translation mechanism works, and has " +
          "not been checked by a native speaker. Anything not yet translated falls back to English."
      })
    ])
  );
}

/* ---- Data: export, import, reset ------------------------ */
function wireData() {
  const exportBtn = document.getElementById("export-settings");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const text = store.exportSettings();
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: "on-device-settings.json" });
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast("Settings saved to a file. Nothing was sent anywhere.", { kind: "ok" });
    });
  }

  const importBtn = document.getElementById("import-settings");
  const importInput = document.getElementById("import-input");
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        store.importSettings(text);
        toast(t("settings.imported") + " Reloading to apply them.", { kind: "ok" });
        window.setTimeout(() => window.location.reload(), 900);
      } catch (err) {
        toast(err && err.message ? err.message : String(err), {
          kind: "error",
          title: "That file could not be imported",
          timeout: 0
        });
      }
    });
  }

  const resetBtn = document.getElementById("reset-all");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const ok = await confirmDestructive({
        title: t("settings.reset"),
        body: t("settings.reset.confirm"),
        confirmLabel: "Reset everything"
      });
      if (!ok) return;

      const removedKeys = store.resetAll();
      let clearedStores = [];
      try {
        clearedStores = await idb.clearEverything();
      } catch (err) {
        console.error("[On Device] Stored files could not be cleared:", err);
      }

      toast(
        `Removed ${removedKeys.length} settings entries and cleared ${clearedStores.length} file stores. ` +
        `The offline copy of the site is kept - remove that from the “How this works” page. Reloading…`,
        { kind: "ok", title: "Reset", timeout: 6000 }
      );
      window.setTimeout(() => window.location.reload(), 1400);
    });
  }
}

async function reportStorage() {
  const node = document.getElementById("storage-used");
  if (!node) return;
  const use = await idb.usage();
  node.textContent = use.known
    ? t("settings.storageUsed", { size: formatBytes(use.bytes) })
    : t("settings.storageUnknown");
}

function warnIfNoStorage() {
  if (store.storageAvailable) return;
  const host = document.getElementById("storage-warning");
  if (!host) return;
  host.append(
    el("div", { class: "note note-danger" }, [
      el("strong", { class: "note-title", text: "Nothing on this page can be saved" }),
      el("p", { class: "mb-0", text: t("error.storage") })
    ])
  );
}

/* ---- Start ---------------------------------------------- */
async function start() {
  await initPage({ pathPrefix: "" });
  warnIfNoStorage();
  wireAppearance();
  wireLayout();
  wireBehaviour();
  await wireLanguage();
  wireData();
  await reportStorage();
}

start().catch((err) => {
  console.error("[On Device] The settings page failed to start:", err);
  const host = document.getElementById("storage-warning");
  if (host) {
    host.append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "This page did not start correctly" }),
        el("p", { class: "mb-0", text: (err && err.message) ? err.message : String(err) })
      ])
    );
  }
});
