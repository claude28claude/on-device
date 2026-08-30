/* ============================================================
   On Device - the workspace

   The files you have loaded, and nothing else. They live in this
   tab's memory, and optionally in this device's own storage so a
   refresh does not lose them.

   Originals are never modified. Tools always produce new files,
   which go to the results tray. That is what makes "revert to
   original" possible.
   ============================================================ */

import * as idb from "./idb.js";
import * as store from "./store.js";
import { identify, warnIfTooBig } from "./sniff.js";

const files = new Map();       /* id -> record */
const objectUrls = new Set();  /* every blob URL we made, so we can revoke them */
const listeners = new Set();
let nextId = 1;

function makeId() {
  return `f${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

function emit(reason, detail) {
  for (const fn of listeners) {
    try {
      fn(list(), reason, detail);
    } catch (err) {
      console.error("[On Device] A workspace listener threw:", err);
    }
  }
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function list() {
  return Array.from(files.values());
}

export function get(id) {
  return files.get(id) || null;
}

export function count() {
  return files.size;
}

/* ---- Blob URLs ------------------------------------------ */
/* Every URL we create is tracked and revoked, so repeated batches
   do not leak memory. */
export function objectUrlFor(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

export function revoke(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrls.delete(url);
}

export function revokeAll() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
}

/* ---- Adding files --------------------------------------- */
/* Returns { added, problems } - problems are things the visitor
   should be told about, never swallowed. */
export async function add(fileList) {
  const incoming = Array.from(fileList || []);
  const added = [];
  const problems = [];

  for (const file of incoming) {
    let info;
    try {
      info = await identify(file);
    } catch (err) {
      problems.push({
        kind: "unreadable",
        name: file.name,
        message: err && err.message ? err.message : String(err)
      });
      continue;
    }

    if (info.empty) {
      problems.push({
        kind: "empty",
        name: file.name,
        message: `“${file.name}” is empty - it contains no data at all. Nothing can be done with it.`
      });
      continue;
    }

    if (info.mismatch && !info.mismatch.minor) {
      problems.push({
        kind: "mismatch",
        name: file.name,
        claimed: info.mismatch.claimed,
        actual: info.mismatch.actual,
        message:
          `“${file.name}” is named like a ${info.mismatch.claimed.toUpperCase()} file, but its ` +
          `contents are actually ${info.mismatch.actual.toUpperCase()}. ` +
          `It will be treated as ${info.mismatch.actual.toUpperCase()}, which is almost certainly what you want.`
      });
    }

    if (info.format === "unknown") {
      problems.push({
        kind: "unknown",
        name: file.name,
        message:
          `We could not work out what kind of file “${file.name}” is. Its contents do not ` +
          `match any format this site recognises. It has still been added, but no tool will ` +
          `offer to open it. If you know what it is, that is worth telling us - it may be a ` +
          `format worth supporting.`
      });
    }

    const big = warnIfTooBig(file.size);
    if (big) {
      problems.push({
        kind: "large",
        name: file.name,
        needed: big.needed,
        budget: big.budget,
        message:
          `“${file.name}” is large. Working on it needs roughly ` +
          `${Math.round(big.needed / 1048576)} MB of memory, and this ` +
          `${big.isMobile ? "phone" : "browser"} is likely to allow about ` +
          `${Math.round(big.budget / 1048576)} MB. The tab may run out of memory. ` +
          `You can still try - nothing is uploaded either way.`
      });
    }

    const record = {
      id: makeId(),
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      format: info.format,
      kind: info.kind,
      label: info.label,
      claimedFormat: info.claimedFormat,
      mismatch: info.mismatch,
      width: info.width,
      height: info.height,
      addedAt: Date.now(),
      blob: file
    };

    files.set(record.id, record);
    added.push(record);
  }

  if (added.length) {
    /* Show the files immediately. They are already in memory and usable.
       Writing them to this device's storage is a convenience for surviving
       a refresh, so it happens in the background - the interface never
       waits for it, and if it fails we say so then rather than freezing
       now. */
    emit("add", added);
    persist().catch((err) => {
      reportStorageProblem(
        "These files are loaded and ready to use, but could not be saved on this " +
        "device, so a refresh will lose them. " + (err && err.message ? err.message : "")
      );
    });
  } else if (problems.length) {
    emit("problem", problems);
  }

  return { added, problems };
}

/* Storage trouble discovered after the fact, once the interface has
   already moved on. */
const storageListeners = new Set();

export function onStorageProblem(fn) {
  storageListeners.add(fn);
  return () => storageListeners.delete(fn);
}

function reportStorageProblem(message) {
  console.warn("[On Device] " + message);
  for (const fn of storageListeners) {
    try {
      fn(message);
    } catch (err) {
      console.error("[On Device] A storage listener threw:", err);
    }
  }
}

export async function removeFile(id) {
  const record = files.get(id);
  if (!record) return false;
  files.delete(id);
  if (record.thumbUrl) revoke(record.thumbUrl);
  emit("remove", record);
  persist().catch((err) =>
    reportStorageProblem(
      "The file was removed here, but this device's saved copy could not be updated. " +
      (err && err.message ? err.message : "")
    )
  );
  return true;
}

export async function clearAll() {
  const n = files.size;
  files.clear();
  revokeAll();
  try {
    await idb.clear("workspace");
  } catch (err) {
    console.error("[On Device] Could not clear stored files:", err);
  }
  emit("clear", { removed: n });
  return n;
}

/* ---- Surviving a refresh -------------------------------- */
async function persist() {
  if (!store.get("behaviour.keepWorkspace", true)) return;
  if (!idb.idbAvailable()) return;
  await idb.clear("workspace");
  for (const record of files.values()) {
    /* Listeners and URLs are not stored - only the file itself. */
    await idb.put("workspace", {
      id: record.id,
      name: record.name,
      size: record.size,
      lastModified: record.lastModified,
      format: record.format,
      kind: record.kind,
      label: record.label,
      claimedFormat: record.claimedFormat,
      mismatch: record.mismatch,
      width: record.width,
      height: record.height,
      addedAt: record.addedAt,
      blob: record.blob
    });
  }
}

export async function restore() {
  if (!store.get("behaviour.keepWorkspace", true)) return [];
  if (!idb.idbAvailable()) return [];
  let saved;
  try {
    saved = await idb.getAll("workspace");
  } catch (err) {
    console.warn("[On Device] Previously loaded files could not be read back:", err);
    return [];
  }
  for (const record of saved || []) {
    if (!record || !record.blob) continue;
    files.set(record.id, record);
  }
  if (saved && saved.length) emit("restore", saved);
  return saved || [];
}

/* ---- Auto-clear on close -------------------------------- */
export function installAutoClear() {
  window.addEventListener("pagehide", () => {
    if (!store.get("behaviour.autoClearOnClose", true)) return;
    revokeAll();
    /* IndexedDB writes during pagehide are unreliable, so we set a
       flag that the next visit acts on. This is honest: it clears at
       the start of the next visit rather than pretending it happened
       at the moment the tab closed. */
    try {
      window.localStorage.setItem("ondevice.clearOnNextLoad", "1");
    } catch (err) { /* storage unavailable; nothing to do */ }
  });
}

/* Moving from page to page inside this site keeps one sessionStorage
   for the tab; closing the tab throws it away. That is exactly the
   line "clear when you leave" wants to draw, and pagehide alone
   cannot draw it - pagehide fires when you click a link to another
   page of this site just as it does when you close the tab.

   Without this the flag set on the way out of the homepage was acted
   on as soon as a tool page opened, so choosing a file and then
   picking a tool threw the file away. It also made the "files you
   already loaded are offered straight away" part of every tool page
   unreachable: by the time it looked, everything had been deleted. */
const SAME_TAB_KEY = "ondevice.sameTabSession";

export async function applyPendingAutoClear() {
  let flagged = false;
  let continuingSameTab = false;
  try {
    flagged = window.localStorage.getItem("ondevice.clearOnNextLoad") === "1";
    if (flagged) window.localStorage.removeItem("ondevice.clearOnNextLoad");
    continuingSameTab = window.sessionStorage.getItem(SAME_TAB_KEY) === "1";
    window.sessionStorage.setItem(SAME_TAB_KEY, "1");
  } catch (err) {
    return false;
  }
  if (!flagged) return false;
  /* Still the same tab, so this was a step within the site rather
     than leaving it. The files stay. */
  if (continuingSameTab) return false;
  if (!store.get("behaviour.autoClearOnClose", true)) return false;
  try {
    await idb.clear("workspace");
    await idb.clear("results");
  } catch (err) {
    console.error("[On Device] Could not clear files from the previous visit:", err);
  }
  return true;
}
