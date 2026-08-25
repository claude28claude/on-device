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
import { t } from "./i18n.js";

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
/* Everything at once. */
/* This button sat disabled for seven phases, with a tooltip saying
   the feature "arrives with the Zip tool in Phase 6". The zip library
   arrived in Phase 6 and the button was never connected to it, so the
   site went on promising something it had been able to do all along.

   The zip is written straight to the downloads folder rather than
   being put back in the tray, which would leave you looking at a zip
   of your files sitting next to your files. */
async function downloadAllAsZip(button) {
  if (!results.length) {
    toast("There is nothing in the tray to download.", { kind: "warn" });
    return;
  }

  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Zipping…";

  try {
    const zip = await import("../vendor/zipjs/zip.min.js");
    if (zip.configure) zip.configure({ useWebWorkers: true });

    const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { level: 5 });

    /* Two results can easily share a name - the same tool run twice -
       and inside a zip the second would silently replace the first. */
    const used = new Set();
    for (const record of results) {
      let name = record.name;
      let n = 2;
      while (used.has(name)) {
        const dot = record.name.lastIndexOf(".");
        const base = dot > 0 ? record.name.slice(0, dot) : record.name;
        const ext = dot > 0 ? record.name.slice(dot) : "";
        name = `${base} (${n})${ext}`;
        n++;
      }
      used.add(name);
      await writer.add(name, new zip.BlobReader(record.blob));
    }

    const blob = await writer.close();
    const stamp = new Date();
    const date =
      `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-` +
      `${String(stamp.getDate()).padStart(2, "0")}`;
    const name = `on-device-${date}.zip`;

    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 20000);

    toast(
      `${results.length} file${results.length === 1 ? "" : "s"} zipped into ` +
      `“${name}” (${formatBytes(blob.size)}). Your results are still in the tray.`,
      { kind: "ok", title: "Downloaded", timeout: 9000 }
    );
    announce(`${results.length} files downloaded as one zip.`);
  } catch (err) {
    toast(
      "The zip could not be made: " + (err && err.message ? err.message : String(err)) +
      " Your files are untouched and still in the tray — download them one at a time.",
      { kind: "error", title: "That did not work", timeout: 12000 }
    );
    console.error("[On Device] Zipping the results tray failed:", err);
  } finally {
    button.textContent = original;
    button.disabled = results.length === 0;
  }
}

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
/* Whether the tray is currently showing, so a keyboard shortcut can
   toggle it rather than only ever opening it. */
export function isTrayOpen() {
  return openState;
}

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
      class: "btn btn-sm tray-zip",
      type: "button",
      disabled: true,
      title: t("tray.downloadAll"),
      onclick: () => downloadAllAsZip(zipBtn)
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

  /* Nothing to zip when the tray is empty. Selected by its own class
     rather than by being the first button, so re-ordering the row
     cannot quietly point this at the wrong one. */
  const zipButton = trayNode.querySelector(".tray-zip");
  if (zipButton) zipButton.disabled = results.length === 0;

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
