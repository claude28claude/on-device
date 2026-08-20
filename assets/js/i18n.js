/* ============================================================
   On Device - translation

   Language files are plain JavaScript modules loaded from this
   site. Nothing is fetched from a translation service, because
   nothing here talks to the internet.

   English is always loaded, and is used for any line another
   language has not translated yet, so a partial translation can
   never leave a blank space in the interface.
   ============================================================ */

import en, { meta as enMeta } from "./strings/en.js";
import * as store from "./store.js";

/* Registered languages. Adding one means adding a file next to
   en.js and one line here. */
export const LANGUAGES = [
  { code: "en", loader: () => import("./strings/en.js") },
  { code: "hi", loader: () => import("./strings/hi.js") }
];

let strings = en;
let currentMeta = enMeta;
let currentCode = "en";
const missing = new Set();
const listeners = new Set();

export function getLanguage() {
  return currentCode;
}

export function getLanguageMeta() {
  return currentMeta;
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Load a language and make it current. Falls back to English and
   reports the problem rather than silently doing nothing. */
export async function setLanguage(code) {
  const entry = LANGUAGES.find((l) => l.code === code);
  if (!entry) {
    console.error("[On Device] Unknown language:", code);
    throw new Error(`This build does not include the language “${code}”.`);
  }
  if (code === "en") {
    strings = en;
    currentMeta = enMeta;
  } else {
    const mod = await entry.loader();
    /* Any line the translation is missing falls back to English. */
    strings = { ...en, ...(mod.default || {}) };
    currentMeta = mod.meta || { code, name: code, nativeName: code, dir: "ltr", complete: false };
  }
  currentCode = code;
  document.documentElement.setAttribute("lang", code);
  document.documentElement.setAttribute("dir", currentMeta.dir || "ltr");
  for (const fn of listeners) {
    try {
      fn(code);
    } catch (err) {
      console.error("[On Device] A language listener threw:", err);
    }
  }
  return currentMeta;
}

/* Look up a line of text, filling in any {placeholders}. */
export function t(key, vars) {
  let value = strings[key];
  if (value === undefined) {
    if (!missing.has(key)) {
      missing.add(key);
      console.warn(`[On Device] Missing text for “${key}”.`);
    }
    return key;
  }
  if (vars) {
    value = value.replace(/\{(\w+)\}/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
    );
  }
  return value;
}

/* Singular/plural helper: uses "<key>.plural" when n is not 1. */
export function tn(key, n, vars) {
  const finalKey = n === 1 ? key : `${key}.plural`;
  const use = strings[finalKey] !== undefined ? finalKey : key;
  return t(use, { n, ...(vars || {}) });
}

export function missingKeys() {
  return Array.from(missing);
}

/* Translate any element in the page carrying data-i18n attributes:
     data-i18n="key"          - sets the text
     data-i18n-attr="aria-label:key, title:key"
   Called after the language changes so nothing is left behind. */
export function applyToDom(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.getAttribute("data-i18n"));
  }
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    const spec = el.getAttribute("data-i18n-attr");
    for (const pair of spec.split(",")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  for (const el of root.querySelectorAll("[data-i18n-html]")) {
    /* Only ever used for our own strings from our own language files,
       never for anything a visitor typed or a file contained. */
    el.textContent = t(el.getAttribute("data-i18n-html"));
  }
}

/* Load the saved language at start-up. */
export async function initLanguage() {
  const saved = store.get("language", "en");
  if (saved && saved !== "en") {
    try {
      await setLanguage(saved);
    } catch (err) {
      console.error("[On Device] Falling back to English.", err);
      await setLanguage("en");
    }
  } else {
    document.documentElement.setAttribute("lang", "en");
    document.documentElement.setAttribute("dir", "ltr");
  }
  return currentCode;
}
