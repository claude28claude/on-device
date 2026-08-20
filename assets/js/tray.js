/* ============================================================
   On Device - the results tray

   Finished files land here and stay put until you download them
   or clear them. A result can be sent straight into another tool
   without going back through your file picker.

   Downloading writes the file from this tab's memory to your
   downloads folder. No network is involved at any point.
   ============================================================ */

import * as idb from "./idb.js";
import * as store from "./store.js";
import { el, icon, toast, announce, formatBytes, formatTime } from "./ui.js";
import { t, tn } from "./i18n.js";

const results = [];
const listeners = new Set();
let trayNode = null;
let bodyNode = null;
let countNode = null;
let openState = false;
let seq = 0;

function emit() {
  for (const fn of listeners) {
    try {
      fn(results.slice());
    } catch (err) {
      console.error("[On Device] A results listener threw:", err);
    }
  }
  render();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function list() {
  return results.slice();
}

export function count() {
  return results.length;
}

/* ---- Adding a result ------------------------------------ */
export async function addResult({ blob, name, fromTool = "", fromFile = "", note = "" }) {
  if (!(blob instanceof Blob)) {
    throw new Error("A tool tried to add something that is not a file to the results tray.");
  }
  const record = {
    id: `r${Date.now().toString(36)}-${(seq++).toString(36)}`,
    name,
    size: blob.size,
    type: blob.type || "application/octet-stream",
    fromTool,
    fromFile,
    note,
    at: Date.now(),
    blob
  };
  results.unshift(record);

  try {
    await idb.put("results", record);
  } catch (err) {
    console.warn("[On Device] A result could not be saved for later:", err);
  }

  emit();
  openTray(true);
  announce(t("tray.count", { n: results.length }));

  if (store.get("behaviour.autoDownload", false)) {
    download(record.id);
  }
  return record;
}

/* ---- Downloading ---------------------------------------- */
export function download(id) {
  const record = results.find((r) => r.id === id);
  if (!record) {
    toast(`That result is no longer in the tray.`, { kind: "error" });
    return false;
  }
  const url = URL.createObjectURL(record.blob);
  const a = el("a", { href: url, download: record.name });
  document.body.append(a);
  a.click();
  a.remove();
  /* Give the browser a moment to start the download before freeing it. */
  window.setTimeout(() => URL.revokeObjectURL(url), 20000);
  announce(`${record.name} downloaded.`);
  return true;
}

export async function removeResult(id) {
  const at = results.findIndex((r) => r.id === id);
  if (at < 0) return false;
  results.splice(at, 1);
  try {
    await idb.remove("results", id);
  } catch (err) {
    console.warn("[On Device] A result could not be removed from storage:", err);
  }
  emit();
  return true;
}

export async function clearResults() {
  const n = results.length;
  results.length = 0;
  try {
    await idb.clear("results");
  } catch (err) {
    console.warn("[On Device] Results storage could not be cleared:", err);
  }
  emit();
  announce(`Results cleared. ${n} removed.`);
  return n;
}

export async function restore() {
  if (!idb.idbAvailable()) return [];
  try {
    const saved = await idb.getAll("results");
    for (const r of saved || []) {
      if (r && r.blob) results.push(r);
    }
    results.sort((a, b) => b.at - a.at);
    if (results.length) {
      emit();
      openTray(false);
    }
    return results.slice();
  } catch (err) {
    console.warn("[On Device] Earlier results could not be read back:", err);
    return [];
  }
}

/* ---- The tray itself ------------------------------------ */
export function openTray(open = true) {
  openState = open;
  if (!trayNode) return;
  trayNode.dataset.open = String(open);
  trayNode.dataset.peek = String(results.length > 0);
  document.body.classList.toggle("has-tray", results.length > 0);
  const toggle = trayNode.querySelector(".tray-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? t("tray.collapse") : t("tray.open"));
  }
}

export function mount(container = document.body) {
  if (trayNode) return trayNode;

  countNode = el("span", { class: "badge", text: "0" });

  const toggle = el(
    "button",
    {
      class: "btn btn-quiet btn-sm tray-toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": "tray-body",
      onclick: () => openTray(!openState)
    },
    [icon("chevron-down", 16)]
  );

  const clearBtn = el(
    "button",
    {
      class: "btn btn-sm",
      type: "button",
      onclick: async () => {
        await clearResults();
        toast("Results cleared.", { kind: "ok", timeout: 3000 });
      }
    },
    t("tray.clear")
  );

  const zipBtn = el(
    "button",
    {
      class: "btn btn-sm",
      type: "button",
      disabled: true,
      title: "Downloading everything as one zip arrives with the Zip tool in Phase 6."
    },
    t("tray.downloadAll")
  );

  bodyNode = el("div", { class: "tray-body", id: "tray-body" });

  trayNode = el("div", { class: "results-tray", dataset: { open: "false", peek: "false" }, role: "region", "aria-label": t("tray.title") }, [
    el("div", { class: "tray-bar" }, [
      el("span", { class: "tray-title" }, [icon("download", 18), document.createTextNode(" " + t("tray.title")), countNode]),
      el("span", { class: "tray-actions" }, [zipBtn, clearBtn, toggle])
    ]),
    bodyNode
  ]);

  container.append(trayNode);
  render();
  return trayNode;
}

function render() {
  if (!trayNode || !bodyNode) return;
  countNode.textContent = String(results.length);
  trayNode.dataset.peek = String(results.length > 0);
  document.body.classList.toggle("has-tray", results.length > 0);

  bodyNode.textContent = "";
  if (!results.length) {
    bodyNode.append(el("p", { class: "muted mb-0", text: t("tray.empty") }));
    return;
  }

  const ul = el("ul", { class: "file-list" });
  for (const r of results) {
    ul.append(
      el("li", {}, [
        el("span", { class: "file-thumb", text: (r.name.split(".").pop() || "?").slice(0, 4) }),
        el("span", { class: "file-main" }, [
          el("span", { class: "file-name", text: r.name }),
          el("span", { class: "file-meta", text: `${formatBytes(r.size)} · ${formatTime(r.at)}${r.fromTool ? " · " + r.fromTool : ""}` })
        ]),
        el("button", { class: "btn btn-sm", type: "button", onclick: () => download(r.id) }, [
          icon("download", 15),
          document.createTextNode(" Download")
        ]),
        el(
          "button",
          {
            class: "btn btn-sm btn-quiet",
            type: "button",
            "aria-label": `Remove ${r.name} from results`,
            onclick: () => removeResult(r.id)
          },
          icon("x", 15)
        )
      ])
    );
  }
  bodyNode.append(ul);
}
