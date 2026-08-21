/* ============================================================
   On Device - settings store

   Everything the visitor chooses lives here, in this device's
   own local storage. Nothing is sent anywhere; there is nowhere
   to send it to.

   The whole thing can be exported to a file and imported again
   on another device.
   ============================================================ */

const KEY = "ondevice.settings.v1";
const RECENT_KEY = "ondevice.recent.v1";

/* ---- Defaults ------------------------------------------- */
/* Every option the app understands is listed here. If a value is
   missing from storage, the default below is used, so an older
   saved file never leaves a setting undefined. */
export const DEFAULTS = {
  version: 1,
  language: "en",

  appearance: {
    theme: "system",        /* system | paper | midnight | contrast | sepia | terminal */
    accent: "",             /* empty means "use the theme's own accent" */
    density: "comfortable", /* comfortable | compact */
    textScale: 1,           /* 0.9 - 1.4 */
    font: "ui",             /* ui | legible | mono */
    corners: "rounded",     /* rounded | square */
    motion: "system"        /* system | reduced | full */
  },

  layout: {
    view: "grid",           /* grid | list */
    homeOpensTo: "all",     /* all | favourites | tool */
    homeTool: "",
    sidebar: false,
    pinned: [],
    hidden: [],
    renames: {}
  },

  behaviour: {
    autoDownload: false,
    keepHistory: false,
    historyDays: 7,
    autoClearOnClose: true,
    confirmDestructive: true,
    keepWorkspace: true
  },

  defaults: {
    imageQuality: 82,
    imageFormat: "keep",    /* keep | jpg | png | webp | avif */
    pageSize: "a4",         /* a4 | letter | match */
    dpi: 150,
    units: "px",            /* px | mm | cm | in */
    compression: "balanced",/* light | balanced | strong */
    filenamePattern: "{name}-{tool}.{ext}"
  },

  /* Alt+Shift is used because no major browser claims it, so a fresh
     install never fights the browser for a key. See shortcuts.js. */
  shortcuts: {
    palette: "Ctrl+K",
    home: "Alt+Shift+H",
    recipes: "Alt+Shift+R",
    tray: "Alt+Shift+T",
    clearAll: "Alt+Shift+Backspace"
  },

  /* Per-tool remembered options, filled in as tools are built. */
  tools: {}
};

/* ---- Is local storage usable at all? -------------------- */
export const storageAvailable = (() => {
  try {
    const probe = "ondevice.probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch (err) {
    return false;
  }
})();

/* ---- Deep merge of saved values over the defaults ------- */
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function merge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isPlainObject(patch)) return out;
  for (const key of Object.keys(patch)) {
    const next = patch[key];
    if (isPlainObject(next) && isPlainObject(out[key])) {
      out[key] = merge(out[key], next);
    } else if (next !== undefined) {
      out[key] = Array.isArray(next) ? next.slice() : next;
    }
  }
  return out;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/* ---- Load / save ---------------------------------------- */
let current = clone(DEFAULTS);
let loadError = null;

if (storageAvailable) {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) current = merge(DEFAULTS, JSON.parse(raw));
  } catch (err) {
    loadError = err;
    console.error("[On Device] Saved settings could not be read; using defaults.", err);
  }
}

export function getLoadError() {
  return loadError;
}

const listeners = new Set();

function emit(reason) {
  for (const fn of listeners) {
    try {
      fn(current, reason);
    } catch (err) {
      console.error("[On Device] A settings listener threw:", err);
    }
  }
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  if (!storageAvailable) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
    return true;
  } catch (err) {
    console.error("[On Device] Settings could not be saved.", err);
    throw new Error(
      "Your settings could not be saved on this device. " +
      "This usually means the browser's storage is full or this is a private window."
    );
  }
}

/* ---- Reading and writing by path ------------------------ */
export function all() {
  return current;
}

export function get(path, fallback) {
  const parts = path.split(".");
  let node = current;
  for (const p of parts) {
    if (node === undefined || node === null) return fallback;
    node = node[p];
  }
  return node === undefined ? fallback : node;
}

export function set(path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  let node = current;
  for (const p of parts) {
    if (!isPlainObject(node[p])) node[p] = {};
    node = node[p];
  }
  node[last] = value;
  persist();
  emit(path);
  return value;
}

export function update(patch) {
  current = merge(current, patch);
  persist();
  emit("update");
  return current;
}

/* ---- Pinned tools --------------------------------------- */
export function isPinned(id) {
  return get("layout.pinned", []).includes(id);
}

export function togglePin(id) {
  const pinned = get("layout.pinned", []).slice();
  const at = pinned.indexOf(id);
  if (at >= 0) pinned.splice(at, 1);
  else pinned.push(id);
  set("layout.pinned", pinned);
  return at < 0;
}

/* ---- Recently used -------------------------------------- */
export function getRecent() {
  if (!storageAvailable) return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

export function noteUsed(id) {
  if (!storageAvailable) return;
  const list = getRecent().filter((x) => x !== id);
  list.unshift(id);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)));
  } catch (err) {
    console.warn("[On Device] Could not record recently used tools.", err);
  }
}

export function clearRecent() {
  if (!storageAvailable) return;
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch (err) { /* nothing to do */ }
}

/* ---- Export / import ------------------------------------ */
export function exportSettings() {
  return JSON.stringify(
    {
      app: "On Device",
      kind: "settings",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: current
    },
    null,
    2
  );
}

export function importSettings(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("That file is not a settings file - it is not readable as JSON.");
  }
  if (!parsed || parsed.kind !== "settings" || !parsed.settings) {
    throw new Error(
      "That file does not look like an On Device settings file. " +
      "It should be the file produced by Settings, Export."
    );
  }
  current = merge(DEFAULTS, parsed.settings);
  persist();
  emit("import");
  return current;
}

/* ---- Reset ---------------------------------------------- */
export function resetAll() {
  const removed = [];
  if (storageAvailable) {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("ondevice.")) keys.push(k);
    }
    for (const k of keys) {
      window.localStorage.removeItem(k);
      removed.push(k);
    }
  }
  current = clone(DEFAULTS);
  emit("reset");
  return removed;
}
