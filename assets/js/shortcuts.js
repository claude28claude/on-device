/* ============================================================
   On Device - keyboard shortcuts you can change

   One place decides what a key press means. The combinations
   themselves live in the settings, so they can be changed, and
   the cheat sheet on the Settings page is drawn from this same
   list rather than being typed out separately - which is how a
   cheat sheet ends up lying about what the keys do.
   ============================================================ */

import * as store from "./store.js";

/* Which keys we refuse to take over. Stealing one of these makes
   the browser feel broken and can strand somebody who relies on
   it - Ctrl+Shift+T reopens a closed tab, Ctrl+Shift+R forces a
   reload, and somebody who has just lost a tab will not thank us
   for showing them a results tray instead. */
const RESERVED = new Set([
  /* Browser windows and tabs */
  "Ctrl+W", "Ctrl+T", "Ctrl+N", "Ctrl+Q", "Ctrl+Tab",
  "Ctrl+Shift+W", "Ctrl+Shift+T", "Ctrl+Shift+N", "Ctrl+Shift+Q",
  /* Reloading, printing, saving, finding, the address bar */
  "Ctrl+R", "Ctrl+Shift+R", "Ctrl+L", "Ctrl+P", "Ctrl+S", "Ctrl+F", "Ctrl+D",
  /* Developer tools and browser panels */
  "Ctrl+Shift+I", "Ctrl+Shift+J", "Ctrl+Shift+C", "Ctrl+Shift+O",
  "Ctrl+Shift+B", "Ctrl+Shift+Delete",
  /* Keys the page itself, or a screen reader, needs */
  "F5", "F11", "F12", "Tab", "Escape", "Enter", "Space"
]);

/* The defaults deliberately live in the Alt+Shift space, which
   neither Chrome nor Firefox nor Safari uses for anything, so a
   fresh install cannot fight the browser. Ctrl+K is the exception,
   because it is what everybody's fingers already expect a command
   palette to be. */
export const ACTIONS = [
  {
    id: "palette",
    label: "Open the command palette",
    fallback: "Ctrl+K"
  },
  {
    id: "home",
    label: "Go to the list of tools",
    fallback: "Alt+Shift+H"
  },
  {
    id: "recipes",
    label: "Go to your recipes",
    fallback: "Alt+Shift+R"
  },
  {
    id: "tray",
    label: "Show or hide the results tray",
    fallback: "Alt+Shift+T"
  },
  {
    id: "clearAll",
    label: "Clear every loaded file and result",
    fallback: "Alt+Shift+Backspace"
  }
];

export const ACTIONS_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/* ---- Turning a key press into a written combination ------ */
/* Which key was pressed is read from its position on the keyboard
   rather than from the character it produced. That matters: on a
   Mac, holding Option and pressing H produces "˙", not "H", so
   reading the character would record a shortcut that could never
   be typed again. The position is the same either way.

   The cost is that on a non-QWERTY layout the label shown may not
   match the keycap. Since the same reading is used to record the
   shortcut and to recognise it, the key you pressed is always the
   key that works - only the name written next to it can be wrong. */
function keyLabel(event) {
  const code = event.code || "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";
  if (code === "Slash") return "/";
  if (code === "Backslash") return "\\";
  if (code === "Period") return ".";
  if (code === "Comma") return ",";
  if (code === "Semicolon") return ";";
  if (code === "Quote") return "'";
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  if (code === "Backquote") return "`";
  if (code) return code;

  /* Very old browsers have no "code". Falling back to the character
     is worse, but it is better than refusing to work at all. */
  const key = event.key || "";
  return key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key;
}

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift", "CapsLock"]);

/* Cmd on a Mac and Ctrl elsewhere are treated as the same key,
   because that is what people expect and it means one saved
   setting works on both. */
export function comboFromEvent(event) {
  if (MODIFIER_KEYS.has(event.key)) return null;

  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  const label = keyLabel(event);
  if (!label) return null;
  parts.push(label);
  return parts.join("+");
}

export function matches(combo, event) {
  if (!combo) return false;
  const wanted = String(combo).split("+");
  const key = wanted[wanted.length - 1];
  const wantsCtrl = wanted.includes("Ctrl");
  const wantsAlt = wanted.includes("Alt");
  const wantsShift = wanted.includes("Shift");

  const hasCtrl = event.ctrlKey || event.metaKey;
  if (wantsCtrl !== hasCtrl) return false;
  if (wantsAlt !== event.altKey) return false;
  if (wantsShift !== event.shiftKey) return false;

  return keyLabel(event) === key;
}

/* Split for display, so the Settings page can draw each key in
   its own <kbd> box without guessing at the format. */
export function keysOf(combo) {
  return String(combo || "").split("+").filter(Boolean);
}

export function isReserved(combo) {
  return RESERVED.has(combo);
}

/* Which other action already uses this combination? */
export function clashesWith(combo, exceptActionId) {
  for (const action of ACTIONS) {
    if (action.id === exceptActionId) continue;
    if (current(action.id) === combo) return action;
  }
  return null;
}

export function current(actionId) {
  const action = ACTIONS_BY_ID.get(actionId);
  if (!action) return "";
  return store.get(`shortcuts.${actionId}`, action.fallback) || "";
}

export function setCombo(actionId, combo) {
  store.set(`shortcuts.${actionId}`, combo);
}

export function resetAll() {
  for (const action of ACTIONS) store.set(`shortcuts.${action.id}`, action.fallback);
}

/* ---- Listening ------------------------------------------- */
/* While somebody is recording a new shortcut, the live handler
   has to stand aside, or pressing Ctrl+Shift+T to record it
   would also open the tray. */
let capturing = false;

export function setCapturing(on) {
  capturing = Boolean(on);
}

function typingInAField() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName || "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
}

export function install(handlers = {}, { pathPrefix = "" } = {}) {
  window.addEventListener("keydown", (event) => {
    if (capturing) return;

    for (const action of ACTIONS) {
      const combo = current(action.id);
      if (!combo || !matches(combo, event)) continue;

      /* A bare letter with no modifier must not fire while somebody is
         typing their name into a box. */
      const bare = keysOf(combo).length === 1;
      if (bare && typingInAField()) return;

      event.preventDefault();

      if (handlers[action.id]) {
        handlers[action.id]();
      } else if (action.id === "home") {
        window.location.href = `${pathPrefix}index.html`;
      } else if (action.id === "recipes") {
        window.location.href = `${pathPrefix}recipes.html`;
      }
      return;
    }
  });
}
