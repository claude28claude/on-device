/* ============================================================
   On Device - the shared start-up for every page

   Sets the language, wires the drop zone, the results tray and
   the command palette, keeps the offline indicator honest, and
   registers the service worker that makes the site work with the
   internet switched off.
   ============================================================ */

import * as store from "./store.js";
import * as i18n from "./i18n.js";
import * as workspace from "./workspace.js";
import * as tray from "./tray.js";
import * as dropzone from "./dropzone.js";
import * as palette from "./palette.js";
import { getTool } from "./tools.js";
import { el, icon, toast, announce, openDialog, confirmDestructive } from "./ui.js";
import { t } from "./i18n.js";

export const version = "0.1.0";

let prefix = "";

/* ---- Offline / online status ---------------------------- */
function statusStrip() {
  return document.getElementById("status-strip");
}

function setStatus(message, { tone = "ok", action = null } = {}) {
  const strip = statusStrip();
  if (!strip) return;
  const wrap = strip.querySelector(".wrap");
  if (!wrap) return;
  wrap.textContent = "";
  wrap.append(icon(tone === "warn" ? "wifi-off" : "check", 16), el("span", { text: message }));
  if (action) {
    wrap.append(
      el("button", { class: "btn btn-sm", type: "button", onclick: action.onClick }, action.label)
    );
  }
  strip.hidden = false;
  strip.style.background = tone === "warn" ? "var(--warn-soft)" : "var(--ok-soft)";
}

function hideStatus() {
  const strip = statusStrip();
  if (strip) strip.hidden = true;
}

function watchConnection() {
  const update = () => {
    if (!navigator.onLine) {
      setStatus(t("status.offline"), { tone: "warn" });
      announce(t("status.offline"));
    } else {
      hideStatus();
    }
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ---- Service worker ------------------------------------- */
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("[On Device] This browser has no service worker support, so offline use is not available.");
    return null;
  }
  if (location.protocol === "file:") {
    console.info("[On Device] Opened from a folder on disk. Offline caching is not used here - the files are already local.");
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register(`${prefix}sw.js`, { scope: prefix || "./" });

    if (reg.waiting) offerUpdate(reg);

    reg.addEventListener("updatefound", () => {
      const incoming = reg.installing;
      if (!incoming) return;
      incoming.addEventListener("statechange", () => {
        if (incoming.state === "installed" && navigator.serviceWorker.controller) {
          offerUpdate(reg);
        }
      });
    });

    return reg;
  } catch (err) {
    console.error("[On Device] Offline caching could not be set up:", err);
    setStatus(
      t("status.installFailed", { reason: err && err.message ? err.message : String(err) }),
      { tone: "warn" }
    );
    return null;
  }
}

function offerUpdate(reg) {
  setStatus(t("status.updateReady"), {
    tone: "warn",
    action: {
      label: t("status.reload"),
      onClick: () => {
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      }
    }
  });
}

/* ---- "Not built yet" dialog ----------------------------- */
export async function showNotBuilt(id) {
  const tool = getTool(id);
  if (!tool) return;
  await openDialog({
    title: t("notBuilt.title", { name: t(`tool.${id}.name`) }),
    body: el("div", {}, [
      el("p", { text: t("notBuilt.body", { n: tool.phase }) }),
      el("p", { class: "mb-0" }, [
        el("a", { href: `${prefix}roadmap.html`, text: t("notBuilt.seePlan") })
      ])
    ]),
    buttons: [{ id: "ok", label: t("notBuilt.close"), class: "btn-primary" }]
  });
}

/* ---- Header wiring -------------------------------------- */
function wireHeader() {
  const clearBtn = document.getElementById("clear-everything");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      const confirmed = !store.get("behaviour.confirmDestructive", true) ||
        (await confirmDestructive({
          title: t("action.clearEverything"),
          body: t("action.clearEverything.confirm"),
          confirmLabel: t("action.confirm")
        }));
      if (!confirmed) return;
      await workspace.clearAll();
      await tray.clearResults();
      dropzone.renderFiles();
      toast(t("action.clearEverything.done"), { kind: "ok" });
      announce(t("action.clearEverything.done"), true);
    });
  }

  const paletteBtn = document.getElementById("open-palette");
  if (paletteBtn) paletteBtn.addEventListener("click", () => palette.open());
}

/* ---- Following the system theme ------------------------- */
function watchSystemTheme() {
  if (!window.matchMedia) return;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    if (store.get("appearance.theme", "system") !== "system") return;
    const theme = query.matches ? "midnight" : "paper";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = query.matches ? "dark" : "light";
  };
  if (query.addEventListener) query.addEventListener("change", apply);
  else if (query.addListener) query.addListener(apply);
}

/* ---- Browser capability check --------------------------- */
/* If something we genuinely need is missing, say so up front
   rather than half-working. */
export function checkBrowser() {
  const missing = [];
  if (typeof Blob === "undefined" || typeof File === "undefined") missing.push("reading files");
  if (typeof URL === "undefined" || !URL.createObjectURL) missing.push("saving files");
  if (typeof Promise === "undefined") missing.push("modern JavaScript");
  if (typeof crypto === "undefined" || !crypto.subtle) missing.push("encryption (used by some tools)");

  if (!missing.length) return true;

  const box = el("div", { class: "note note-danger" }, [
    el("strong", { class: "note-title", text: "This browser is missing something we need" }),
    el("p", { text: `It cannot do: ${missing.join(", ")}.` }),
    el("p", { class: "mb-0", text: "Please use a current version of Chrome, Edge, Firefox or Safari." })
  ]);
  const main = document.querySelector("main .wrap") || document.body;
  main.prepend(box);
  console.error("[On Device] Missing browser features:", missing);
  return false;
}

/* ---- Page start-up -------------------------------------- */
export async function initPage({ pathPrefix = "", withDropPanel = null } = {}) {
  prefix = pathPrefix;
  dropzone.setPathPrefix(prefix);
  palette.setPathPrefix(prefix);

  await i18n.initLanguage();
  i18n.applyToDom(document);

  if (!store.storageAvailable) {
    document.documentElement.setAttribute("data-storage", "unavailable");
    console.warn("[On Device] This browser will not let the site store anything on this device.");
  }

  checkBrowser();

  tray.mount();
  wireHeader();
  watchConnection();
  watchSystemTheme();
  palette.installShortcut();
  workspace.installAutoClear();

  window.addEventListener("ondevice:show-not-built", (e) => showNotBuilt(e.detail.id));

  dropzone.installWindowDrop((fileList) => dropzone.handleFiles(fileList));
  if (withDropPanel) {
    dropzone.mountPanel(withDropPanel, { onFiles: (fileList) => dropzone.handleFiles(fileList) });
  }

  await workspace.applyPendingAutoClear();
  await workspace.restore();
  await tray.restore();
  dropzone.renderFiles();

  registerServiceWorker();

  /* Mark the current page in the navigation. */
  const here = location.pathname.split("/").pop() || "index.html";
  for (const link of document.querySelectorAll(".header-nav a")) {
    const target = (link.getAttribute("href") || "").split("/").pop();
    if (target === here) link.setAttribute("aria-current", "page");
  }

  document.documentElement.setAttribute("data-app-ready", "true");
}

export { prefix as pathPrefix };
