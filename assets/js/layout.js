/* ============================================================
   On Device - your tool list, arranged your way

   Hiding, renaming and reordering tools all read and write the
   same three settings. Every place that shows a tool - the
   homepage, the command palette, the roadmap - asks this file
   rather than reading the settings itself, so a tool you renamed
   is renamed everywhere and a tool you hid is hidden everywhere.

   Nothing here is clever. It is here so there is exactly one
   answer to "what is this tool called and should it be shown".
   ============================================================ */

import { TOOLS, CATEGORIES, getTool } from "./tools.js";
import * as store from "./store.js";
import { t } from "./i18n.js";

/* ---- Names ----------------------------------------------- */
/* The name a tool goes by: whatever you called it, or the name it
   ships with in the current language. */
export function labelFor(id) {
  const custom = store.get("layout.renames", {})[id];
  if (custom && String(custom).trim()) return String(custom).trim();
  return t(`tool.${id}.name`);
}

export function isRenamed(id) {
  const custom = store.get("layout.renames", {})[id];
  return Boolean(custom && String(custom).trim());
}

export function rename(id, text) {
  const renames = { ...store.get("layout.renames", {}) };
  const clean = String(text || "").trim().slice(0, 60);
  if (!clean || clean === t(`tool.${id}.name`)) delete renames[id];
  else renames[id] = clean;
  store.set("layout.renames", renames);
  return clean;
}

export function clearRename(id) {
  const renames = { ...store.get("layout.renames", {}) };
  delete renames[id];
  store.set("layout.renames", renames);
}

/* ---- Hiding ---------------------------------------------- */
export function isHidden(id) {
  return store.get("layout.hidden", []).includes(id);
}

export function setHidden(id, hidden) {
  const list = store.get("layout.hidden", []).filter((x) => x !== id);
  if (hidden) list.push(id);
  store.set("layout.hidden", list);
  return hidden;
}

export function hiddenCount() {
  return store.get("layout.hidden", []).length;
}

export function unhideAll() {
  const n = hiddenCount();
  store.set("layout.hidden", []);
  return n;
}

/* ---- Order ----------------------------------------------- */
/* The saved order is a list of tool identifiers. It is treated as
   a preference, not as the truth: any tool missing from it falls
   back to the order it appears in the registry, and any name in it
   that no longer exists is ignored. That way a saved order from an
   older version never hides a new tool or breaks the list. */
export function orderedTools() {
  const saved = store.get("layout.order", []);
  if (!Array.isArray(saved) || !saved.length) return TOOLS.slice();

  const position = new Map();
  saved.forEach((id, i) => position.set(id, i));

  return TOOLS.slice().sort((a, b) => {
    const pa = position.has(a.id) ? position.get(a.id) : Number.MAX_SAFE_INTEGER;
    const pb = position.has(b.id) ? position.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return TOOLS.indexOf(a) - TOOLS.indexOf(b);
  });
}

/* Tools of one category, in your order. */
export function orderedIn(categoryId) {
  return orderedTools().filter((tool) => tool.cat === categoryId);
}

/* Move a tool up or down within its own category. Moving between
   categories is not offered: a tool's category is what the grid is
   grouped by, so a PDF tool sitting under Images would simply look
   like a bug. */
export function move(id, direction) {
  const tool = getTool(id);
  if (!tool) return false;

  const siblings = orderedIn(tool.cat).map((x) => x.id);
  const at = siblings.indexOf(id);
  const to = at + (direction < 0 ? -1 : 1);
  if (at < 0 || to < 0 || to >= siblings.length) return false;

  siblings.splice(to, 0, siblings.splice(at, 1)[0]);

  /* Rebuild the whole order, category by category, so what is saved
     is always a complete list rather than a patch on the last one. */
  const next = [];
  for (const cat of CATEGORIES) {
    if (cat.id === tool.cat) next.push(...siblings);
    else next.push(...orderedIn(cat.id).map((x) => x.id));
  }
  store.set("layout.order", next);
  return true;
}

export function hasCustomOrder() {
  const saved = store.get("layout.order", []);
  return Array.isArray(saved) && saved.length > 0;
}

export function resetOrder() {
  store.set("layout.order", []);
}

/* ---- Everything back to normal --------------------------- */
export function resetList() {
  store.set("layout.order", []);
  store.set("layout.hidden", []);
  store.set("layout.renames", {});
}

export function customisedCount() {
  return {
    hidden: hiddenCount(),
    renamed: Object.keys(store.get("layout.renames", {})).length,
    reordered: hasCustomOrder()
  };
}
