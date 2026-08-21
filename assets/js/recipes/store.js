/* ============================================================
   On Device - saved recipes

   A recipe lives in this device's own storage, next to the
   settings. It can be written out to a file and read back on
   another device, which is the only way one ever travels: there
   is no account and no server to sync with.

   Passwords are deliberately NOT part of a saved recipe. A step
   that needs one asks every time it runs. A recipe file you send
   to somebody should never be able to leak a password, and this
   is the only way to guarantee that.
   ============================================================ */

import { getStep, secretKeys, defaultOptions } from "./steps.js";
import { STORAGE_KEY } from "./names.js";

/* One name for the storage slot, shared with names.js so the palette
   and this file can never drift apart. */
const KEY = STORAGE_KEY;

let recipes = [];
let loadError = null;

const listeners = new Set();

function emit() {
  for (const fn of listeners) {
    try {
      fn(recipes);
    } catch (err) {
      console.error("[On Device] A recipe listener threw:", err);
    }
  }
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function storageAvailable() {
  try {
    window.localStorage.setItem("ondevice.probe", "1");
    window.localStorage.removeItem("ondevice.probe");
    return true;
  } catch (err) {
    return false;
  }
}

export const canSave = storageAvailable();

function makeId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---- Load ------------------------------------------------ */
if (canSave) {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) recipes = parsed.map(clean).filter(Boolean);
    }
  } catch (err) {
    loadError = err;
    console.error("[On Device] Saved recipes could not be read.", err);
  }
}

export function getLoadError() {
  return loadError;
}

/* A recipe read back from storage - or from somebody else's file -
   is not trusted. Anything referring to a step that does not exist
   is dropped, and every option is checked against the step that
   actually exists now, so an old file cannot smuggle in a value the
   current code does not understand. */
function clean(raw) {
  if (!raw || typeof raw !== "object") return null;
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  const kept = [];
  const dropped = [];

  for (const s of steps) {
    const def = getStep(s && s.stepId);
    if (!def) {
      dropped.push(s && s.stepId ? String(s.stepId) : "an unnamed step");
      continue;
    }
    const options = defaultOptions(def.id);
    const secrets = new Set(secretKeys(def.id));
    if (s.options && typeof s.options === "object") {
      for (const key of Object.keys(options)) {
        if (secrets.has(key)) continue;
        if (s.options[key] !== undefined) options[key] = s.options[key];
      }
    }
    kept.push({ stepId: def.id, options });
  }

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
    name: String(raw.name || "Untitled recipe").slice(0, 120),
    note: String(raw.note || "").slice(0, 400),
    steps: kept,
    droppedSteps: dropped,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now()
  };
}

function persist() {
  if (!canSave) return;
  try {
    /* Strip the "dropped" note before writing: it describes this
       load, not the recipe. */
    const plain = recipes.map(({ droppedSteps, ...rest }) => rest);
    window.localStorage.setItem(KEY, JSON.stringify(plain));
  } catch (err) {
    console.error("[On Device] Recipes could not be saved.", err);
    throw new Error(
      "That recipe could not be saved on this device. The browser's storage is " +
      "either full or switched off — in a private window it usually is."
    );
  }
}

/* ---- Reading --------------------------------------------- */
export function list() {
  return recipes.slice();
}

export function get(id) {
  return recipes.find((r) => r.id === id) || null;
}

export function count() {
  return recipes.length;
}

/* ---- Writing --------------------------------------------- */
export function save(recipe) {
  const record = clean({ ...recipe, updatedAt: Date.now() });
  if (!record.steps.length) {
    throw new Error("A recipe with no steps would do nothing. Add at least one step first.");
  }
  const at = recipes.findIndex((r) => r.id === record.id);
  if (at >= 0) recipes[at] = record;
  else recipes.push(record);
  persist();
  emit();
  return record;
}

export function remove(id) {
  const at = recipes.findIndex((r) => r.id === id);
  if (at < 0) return false;
  recipes.splice(at, 1);
  persist();
  emit();
  return true;
}

export function duplicate(id) {
  const source = get(id);
  if (!source) return null;
  const copy = clean({
    ...source,
    id: makeId(),
    name: `${source.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  recipes.push(copy);
  persist();
  emit();
  return copy;
}

export function blank() {
  return { id: makeId(), name: "", note: "", steps: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export function newId() {
  return makeId();
}

/* ---- Out to a file, and back in -------------------------- */
export function exportAll() {
  return JSON.stringify(
    {
      app: "On Device",
      kind: "recipes",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: "Passwords are never stored in a recipe. Steps that need one will ask when the recipe is run.",
      recipes: recipes.map(({ droppedSteps, ...rest }) => rest)
    },
    null,
    2
  );
}

export function exportOne(id) {
  const one = get(id);
  if (!one) throw new Error("That recipe no longer exists.");
  const { droppedSteps, ...rest } = one;
  return JSON.stringify(
    {
      app: "On Device",
      kind: "recipes",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: "Passwords are never stored in a recipe. Steps that need one will ask when the recipe is run.",
      recipes: [rest]
    },
    null,
    2
  );
}

/* Returns a plain-English account of what happened, because an
   import that silently drops half a file is worse than one that
   refuses. */
export function importFrom(text, { replace = false } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("That file is not readable as a recipe file — it is not valid JSON.");
  }
  if (!parsed || parsed.kind !== "recipes" || !Array.isArray(parsed.recipes)) {
    throw new Error(
      "That file does not look like an On Device recipe file. It should be the file " +
      "produced by the Export button on the Recipes page."
    );
  }

  const incoming = parsed.recipes.map(clean).filter(Boolean);
  if (!incoming.length) {
    throw new Error("That file contains no recipes this version understands.");
  }

  const droppedSteps = incoming.flatMap((r) => r.droppedSteps || []);
  const emptied = incoming.filter((r) => !r.steps.length).map((r) => r.name);
  const usable = incoming.filter((r) => r.steps.length);

  if (!usable.length) {
    throw new Error(
      "Every recipe in that file refers to steps this version does not have" +
      (droppedSteps.length ? `: ${[...new Set(droppedSteps)].join(", ")}` : "") + "."
    );
  }

  if (replace) {
    recipes = usable;
  } else {
    /* An imported recipe never overwrites one already here. Same name
       gets a suffix so both survive and you can compare them. */
    const names = new Set(recipes.map((r) => r.name));
    for (const r of usable) {
      r.id = makeId();
      let name = r.name;
      let n = 2;
      while (names.has(name)) {
        name = `${r.name} (${n})`;
        n++;
      }
      names.add(name);
      r.name = name;
      recipes.push(r);
    }
  }

  persist();
  emit();

  return {
    imported: usable.length,
    skipped: emptied,
    droppedSteps: [...new Set(droppedSteps)]
  };
}

export function clearAll() {
  recipes = [];
  if (canSave) {
    try {
      window.localStorage.removeItem(KEY);
    } catch (err) { /* nothing usable to do */ }
  }
  emit();
}
