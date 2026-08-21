/* ============================================================
   On Device - the defaults you set once

   Settings has a "Behaviour and defaults" section: picture quality,
   picture format, page size, resolution. Those are promises, and a
   setting that quietly does nothing is worse than no setting at
   all - so this file is what makes each tool actually start from
   what you chose.

   A tool calls adopt() with a small map of "this control" to "that
   setting". Two things then happen:

     - the control starts at your saved value, if that value is one
       the control actually offers;
     - changing the control writes the new value back, so the last
       thing you chose becomes what you get next time.

   Where a tool has no such control, it is simply not listed. That
   is why the Settings page now says, under each default, which
   tools use it.
   ============================================================ */

import * as store from "./store.js";

/* Does this control actually offer that value? A saved setting from
   another tool - or from a newer version - must never leave a menu
   showing something it cannot do. */
function canTake(node, value) {
  if (node.tagName === "SELECT") {
    return Array.from(node.options).some((o) => o.value === String(value));
  }
  if (node.type === "range" || node.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    const min = node.min === "" ? -Infinity : Number(node.min);
    const max = node.max === "" ? Infinity : Number(node.max);
    return n >= min && n <= max;
  }
  return true;
}

/* map: { controlId: "settings.path" } */
export function adopt(map, { onApplied = () => {} } = {}) {
  const applied = [];

  for (const [id, path] of Object.entries(map)) {
    const node = document.getElementById(id);
    if (!node) continue;

    const saved = store.get(path, undefined);
    if (saved !== undefined && saved !== "" && canTake(node, saved)) {
      if (node.type === "checkbox") node.checked = Boolean(saved);
      else node.value = String(saved);
      applied.push(id);
    }

    node.addEventListener("change", () => {
      const value = node.type === "checkbox"
        ? node.checked
        : (node.type === "range" || node.type === "number" ? Number(node.value) : node.value);
      store.set(path, value);
    });
  }

  if (applied.length) onApplied(applied);
  return applied;
}
