/* On Device - the Settings page */

import { initPage } from "./app.js";
import * as store from "./store.js";
import * as idb from "./idb.js";
import * as i18n from "./i18n.js";
import { t } from "./i18n.js";
import { el, icon, toast, announce, confirmDestructive, formatBytes } from "./ui.js";
import { accentSet } from "./colour.js";
import * as shortcuts from "./shortcuts.js";
import * as layout from "./layout.js";
import { CATEGORIES } from "./tools.js";

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
  bindCheckbox("sidebar-toggle", "layout.sidebar");

  /* "Open straight into one tool" needs to know which tool, so the
     second menu appears only when that is chosen. */
  const opens = document.getElementById("home-opens");
  const whichTool = document.getElementById("home-tool");

  if (whichTool) {
    for (const tool of layout.orderedTools()) {
      if (!tool.built) continue;
      whichTool.append(el("option", { value: tool.id }, layout.labelFor(tool.id)));
    }
    whichTool.value = store.get("layout.homeTool", "") || whichTool.options[0].value;
    whichTool.addEventListener("change", () => {
      store.set("layout.homeTool", whichTool.value);
      announce(`The homepage will open ${whichTool.selectedOptions[0].textContent}.`);
    });
  }

  const syncOpens = () => {
    const value = opens ? opens.value : "all";
    if (whichTool) whichTool.hidden = value !== "tool";
    if (value === "tool" && whichTool && !store.get("layout.homeTool", "")) {
      store.set("layout.homeTool", whichTool.value);
    }
  };

  if (opens) {
    opens.value = String(store.get("layout.homeOpensTo", "all"));
    opens.addEventListener("change", () => {
      store.set("layout.homeOpensTo", opens.value);
      syncOpens();
    });
    syncOpens();
  }

  wireArranger();
}

/* ---- Arranging the tool list ---------------------------- */
/* One row per tool: a name you can type over, up and down buttons,
   and a switch to hide it. Everything writes straight through to the
   settings, so what you see here is what the homepage shows. */
function wireArranger() {
  const host = document.getElementById("tool-arranger");
  const unhide = document.getElementById("unhide-all");
  const resetList = document.getElementById("reset-tool-list");
  const summary = document.getElementById("customise-summary");
  if (!host) return;

  const draw = () => {
    host.textContent = "";

    for (const cat of CATEGORIES) {
      const inCat = layout.orderedIn(cat.id);
      if (!inCat.length) continue;

      const rows = el("div", { class: "arranger" });

      inCat.forEach((tool, index) => {
        const hidden = layout.isHidden(tool.id);
        const nameField = el("input", {
          type: "text",
          class: "arranger-name",
          value: layout.labelFor(tool.id),
          maxlength: 60,
          "aria-label": `Name for ${t(`tool.${tool.id}.name`)}`,
          onchange: (e) => {
            layout.rename(tool.id, e.target.value);
            draw();
            announce(`Renamed to ${layout.labelFor(tool.id)}.`);
          }
        });

        rows.append(el("div", { class: "arranger-row", dataset: { hidden: String(hidden) } }, [
          el("span", { class: "arranger-icon" }, icon(tool.icon, 16)),
          nameField,
          layout.isRenamed(tool.id)
            ? el("button", {
                class: "btn btn-sm btn-quiet", type: "button",
                title: `Put the name back to “${t(`tool.${tool.id}.name`)}”`,
                onclick: () => { layout.clearRename(tool.id); draw(); }
              }, "Undo")
            : null,
          el("div", { class: "btn-row" }, [
            el("button", {
              class: "btn btn-sm btn-quiet", type: "button",
              "aria-label": `Move ${layout.labelFor(tool.id)} up`,
              disabled: index === 0,
              onclick: () => { layout.move(tool.id, -1); draw(); }
            }, "↑"),
            el("button", {
              class: "btn btn-sm btn-quiet", type: "button",
              "aria-label": `Move ${layout.labelFor(tool.id)} down`,
              disabled: index === inCat.length - 1,
              onclick: () => { layout.move(tool.id, 1); draw(); }
            }, "↓"),
            el("button", {
              class: "btn btn-sm", type: "button",
              "aria-pressed": String(hidden),
              onclick: () => {
                layout.setHidden(tool.id, !hidden);
                draw();
                announce(hidden
                  ? `${layout.labelFor(tool.id)} is shown again.`
                  : `${layout.labelFor(tool.id)} is hidden.`);
              }
            }, hidden ? "Show" : "Hide")
          ])
        ]));
      });

      host.append(
        el("h4", { class: "arranger-head", text: t(`cat.${cat.id}`) }),
        rows
      );
    }

    const counts = layout.customisedCount();
    if (summary) {
      const bits = [];
      if (counts.renamed) bits.push(`${counts.renamed} renamed`);
      if (counts.hidden) bits.push(`${counts.hidden} hidden`);
      if (counts.reordered) bits.push("the order changed");
      summary.textContent = bits.length
        ? `You have ${bits.join(", ")}.`
        : "Nothing has been changed from the way it ships.";
    }

    if (unhide) {
      unhide.disabled = counts.hidden === 0;
      unhide.textContent = counts.hidden
        ? `Show all ${counts.hidden} hidden tools again`
        : "Show all tools again";
    }
  };

  if (unhide) {
    unhide.addEventListener("click", () => {
      const n = layout.unhideAll();
      draw();
      toast(`${n} tool${n === 1 ? "" : "s"} visible again.`, { kind: "ok" });
    });
  }

  if (resetList) {
    resetList.addEventListener("click", async () => {
      const counts = layout.customisedCount();
      if (!counts.hidden && !counts.renamed && !counts.reordered) {
        toast("The list is already exactly as it ships.", { kind: "info" });
        return;
      }
      const ok = await confirmDestructive({
        title: "Put the whole list back to normal?",
        body: "Every name, every hidden tool and the order all go back to the way On Device ships. Your pinned tools and everything else are left alone.",
        confirmLabel: "Put it back"
      });
      if (!ok) return;
      layout.resetList();
      draw();
      toast("The tool list is back to normal.", { kind: "ok" });
    });
  }

  draw();
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
  await reportCoverage();
}

/* ---- How much is really translated ---------------------- */
/* Counted from the language files at the moment you look, rather
   than written down once and left to go stale. It also says plainly
   which parts are NOT covered, because "translated" usually gets
   claimed for a great deal more than it is true of. */
async function reportCoverage() {
  const host = document.getElementById("language-coverage");
  if (!host) return;
  host.textContent = "";

  let english;
  try {
    english = (await i18n.LANGUAGES.find((l) => l.code === "en").loader()).default;
  } catch (err) {
    host.append(el("p", { class: "muted", text: "The English text could not be read to compare against." }));
    return;
  }

  const englishKeys = Object.keys(english);
  const table = el("table", { class: "mb-4" }, [
    el("thead", {}, el("tr", {}, [
      el("th", { scope: "col", text: "Language" }),
      el("th", { scope: "col", text: "Lines translated" }),
      el("th", { scope: "col", text: "Checked by a native speaker" })
    ])),
  ]);
  const body = el("tbody", {});

  for (const lang of i18n.LANGUAGES) {
    let strings, meta;
    try {
      const mod = await lang.loader();
      strings = mod.default;
      meta = mod.meta || {};
    } catch (err) {
      continue;
    }

    const present = englishKeys.filter((k) => strings[k] !== undefined);
    /* A line copied straight from English is not a translation - except
       for the handful that genuinely do not change, such as "PDF". */
    const changed = present.filter((k) => strings[k] !== english[k]);
    const percent = Math.round((present.length / englishKeys.length) * 100);

    body.append(el("tr", {}, [
      el("td", { text: meta.nativeName || lang.code }),
      el("td", {
        text: lang.code === "en"
          ? `${englishKeys.length} — this is the original`
          : `${present.length} of ${englishKeys.length} (${percent}%), of which ${changed.length} differ from the English`
      }),
      el("td", { text: lang.code === "en" ? "n/a" : (meta.reviewed ? "Yes" : "No") })
    ]));
  }

  table.append(body);

  host.append(
    table,
    el("div", { class: "note" }, [
      el("strong", { class: "note-title", text: "What those lines cover, and what they do not" }),
      el("p", {
        text:
          "They cover the menus, the buttons, the homepage, the settings, every tool's " +
          "name, description and page heading, and the words used to say what went wrong."
      }),
      el("p", {
        class: "mb-0",
        text:
          "They do NOT cover the explanatory writing inside each tool page — the options, " +
          "the hints and the “what this tool cannot do” notes. That text is still English " +
          "on every page. It is the largest remaining piece of translation work and it is " +
          "not pretended otherwise."
      })
    ])
  );
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

/* ---- Keyboard shortcuts --------------------------------- */
/* Recording works by listening for one key press and writing down
   what was held at the time. While that is happening the live
   shortcut handler stands aside, or recording Ctrl+Shift+T would
   also open the results tray. */
function wireShortcuts() {
  const host = document.getElementById("shortcut-rows");
  if (!host) return;

  const render = () => {
    host.textContent = "";
    for (const action of shortcuts.ACTIONS) {
      const combo = shortcuts.current(action.id);
      const keys = el("span", { class: "shortcut-keys" });
      for (const key of shortcuts.keysOf(combo)) keys.append(el("kbd", { text: key }));
      if (!shortcuts.keysOf(combo).length) {
        keys.append(el("span", { class: "muted", text: "none" }));
      }

      const change = el("button", { class: "btn btn-sm", type: "button" }, "Change");
      const clear = el("button", { class: "btn btn-sm btn-quiet", type: "button" }, "Remove");

      const row = el("div", { class: "setting-row" }, [
        el("div", { class: "setting-text" }, [
          el("strong", { text: action.label }),
          el("span", { class: "muted", text: `Normally ${action.fallback.split("+").join(" ")}` })
        ]),
        el("div", { class: "setting-control" }, [keys, change, clear])
      ]);

      change.addEventListener("click", () => {
        change.textContent = "Press the keys…";
        change.disabled = true;
        clear.disabled = true;
        shortcuts.setCapturing(true);
        announce("Press the key combination you want. Press Escape to leave it as it is.");

        const finish = () => {
          window.removeEventListener("keydown", onKey, true);
          shortcuts.setCapturing(false);
          render();
        };

        const onKey = (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (event.key === "Escape") {
            finish();
            return;
          }

          const combo2 = shortcuts.comboFromEvent(event);
          /* Only a modifier was pressed so far - keep waiting. */
          if (!combo2) return;

          if (shortcuts.isReserved(combo2)) {
            toast(
              `${combo2.split("+").join(" ")} belongs to the browser, so taking it over ` +
              `would break something you rely on. Choose another combination.`,
              { kind: "warn", timeout: 9000 }
            );
            finish();
            return;
          }

          const clash = shortcuts.clashesWith(combo2, action.id);
          if (clash) {
            toast(
              `${combo2.split("+").join(" ")} is already “${clash.label}”. ` +
              `Change that one first, or pick another combination.`,
              { kind: "warn", timeout: 9000 }
            );
            finish();
            return;
          }

          shortcuts.setCombo(action.id, combo2);
          toast(`“${action.label}” is now ${combo2.split("+").join(" ")}.`, { kind: "ok" });
          announce(`${action.label} set to ${combo2.split("+").join(" ")}.`);
          finish();
        };

        window.addEventListener("keydown", onKey, true);
      });

      clear.addEventListener("click", () => {
        shortcuts.setCombo(action.id, "");
        toast(`“${action.label}” now has no shortcut.`, { kind: "ok" });
        render();
      });

      host.append(row);
    }
  };

  render();

  const reset = document.getElementById("reset-shortcuts");
  if (reset) {
    reset.addEventListener("click", () => {
      shortcuts.resetAll();
      render();
      toast("The shortcuts are back to the ones On Device ships with.", { kind: "ok" });
      announce("Shortcuts reset.");
    });
  }
}

/* ---- Start ---------------------------------------------- */
async function start() {
  await initPage({ pathPrefix: "" });
  warnIfNoStorage();
  wireAppearance();
  wireLayout();
  wireBehaviour();
  wireShortcuts();
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
