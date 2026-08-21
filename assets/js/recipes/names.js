/* ============================================================
   On Device - just the names of the saved recipes

   The command palette runs on every page, and it wants to list
   your recipes. Loading the whole recipe machinery to do that
   would drag the PDF and picture code into every page for no
   reason, so this tiny file reads only what a menu needs: the
   name and the identifier.

   It deliberately does no validating. Anything acting on a
   recipe uses store.js, which checks it properly first.
   ============================================================ */

export const STORAGE_KEY = "ondevice.recipes.v1";

export function listNames() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    /* Storage switched off. A palette with no recipes in it is the
       correct outcome, not an error worth interrupting anybody for. */
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.id === "string")
      .map((r) => ({
        id: r.id,
        name: String(r.name || "Untitled recipe"),
        note: String(r.note || ""),
        stepCount: Array.isArray(r.steps) ? r.steps.length : 0
      }));
  } catch (err) {
    console.warn("[On Device] The saved recipes could not be read for the menu.", err);
    return [];
  }
}
