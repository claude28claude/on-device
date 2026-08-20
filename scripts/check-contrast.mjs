/* ============================================================
   On Device - contrast checker

   Reads the theme colours straight out of assets/css/tokens.css
   and works out whether every important pairing meets the
   accessibility standard, in every theme.

       node scripts/check-contrast.mjs

   Text needs a ratio of at least 4.5 to 1. Borders, focus rings
   and other non-text markings need at least 3 to 1.

   This runs on the real values in the real file, so "we checked
   the contrast" is a fact rather than an intention.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(ROOT, "assets", "css", "tokens.css"), "utf8");

/* ---- Pull the variables out of each block ---------------- */
function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m");
  const m = re.exec(css);
  return m ? m[1] : null;
}

function varsFrom(text) {
  const out = {};
  if (!text) return out;
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(text)) !== null) out[m[1].trim()] = m[2].trim();
  return out;
}

const base = varsFrom(blockFor(":root"));

const THEMES = [
  { id: "paper", vars: base },
  { id: "midnight", vars: { ...base, ...varsFrom(blockFor('[data-theme="midnight"]')) } },
  { id: "contrast", vars: { ...base, ...varsFrom(blockFor('[data-theme="contrast"]')) } },
  { id: "sepia", vars: { ...base, ...varsFrom(blockFor('[data-theme="sepia"]')) } },
  { id: "terminal", vars: { ...base, ...varsFrom(blockFor('[data-theme="terminal"]')) } }
];

/* ---- Colour maths --------------------------------------- */
function hexToRgb(hex) {
  const clean = String(hex).replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function luminance({ r, g, b }) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---- What has to be readable ---------------------------- */
const CHECKS = [
  { fg: "--fg",           bg: "--bg",        min: 4.5, what: "body text on the page" },
  { fg: "--fg-muted",     bg: "--bg",        min: 4.5, what: "secondary text on the page" },
  { fg: "--fg-faint",     bg: "--bg",        min: 4.5, what: "faint text and placeholders on the page" },
  { fg: "--fg",           bg: "--bg-raised", min: 4.5, what: "body text on a card" },
  { fg: "--fg-muted",     bg: "--bg-raised", min: 4.5, what: "secondary text on a card" },
  { fg: "--fg-faint",     bg: "--bg-raised", min: 4.5, what: "faint text on a card" },
  { fg: "--fg",           bg: "--bg-sunken", min: 4.5, what: "text on an inset panel" },
  { fg: "--fg-muted",     bg: "--bg-sunken", min: 4.5, what: "secondary text on an inset panel" },
  { fg: "--accent",       bg: "--bg",        min: 4.5, what: "link text on the page" },
  { fg: "--accent",       bg: "--bg-raised", min: 4.5, what: "link text on a card" },
  { fg: "--accent-fg",    bg: "--accent",    min: 4.5, what: "text on a primary button" },
  { fg: "--accent",       bg: "--accent-soft", min: 4.5, what: "accent text on its own soft background" },
  { fg: "--ok",           bg: "--ok-soft",   min: 4.5, what: "success text on its badge" },
  { fg: "--warn",         bg: "--warn-soft", min: 4.5, what: "warning text on its badge" },
  { fg: "--danger",       bg: "--danger-soft", min: 4.5, what: "error text on its badge" },
  { fg: "--ok",           bg: "--bg",        min: 4.5, what: "success text on the page" },
  { fg: "--warn",         bg: "--bg",        min: 4.5, what: "warning text on the page" },
  { fg: "--danger",       bg: "--bg",        min: 4.5, what: "error text on the page" },
  { fg: "--border-strong", bg: "--bg",       min: 3,   what: "control borders against the page" },
  { fg: "--border-strong", bg: "--bg-raised", min: 3,  what: "control borders against a card" },
  { fg: "--focus",        bg: "--bg",        min: 3,   what: "the focus ring on the page" },
  { fg: "--focus",        bg: "--bg-raised", min: 3,   what: "the focus ring on a card" },
  { fg: "--selection-fg", bg: "--selection-bg", min: 4.5, what: "selected text" }
];

let failures = 0;
let checked = 0;

for (const theme of THEMES) {
  const rows = [];
  for (const check of CHECKS) {
    const fgHex = theme.vars[check.fg];
    const bgHex = theme.vars[check.bg];
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    if (!fg || !bg) {
      rows.push({ ...check, error: `could not read ${!fg ? check.fg : check.bg}` });
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    checked++;
    const pass = r >= check.min;
    if (!pass) failures++;
    rows.push({ ...check, ratio: r, pass, fgHex, bgHex });
  }

  const bad = rows.filter((x) => x.pass === false || x.error);
  console.log(`\n${theme.id.toUpperCase()}  ${bad.length ? `${bad.length} problem(s)` : "all pass"}`);
  for (const row of rows) {
    if (row.error) {
      console.log(`   ??  ${row.what} - ${row.error}`);
      continue;
    }
    const mark = row.pass ? "ok " : "FAIL";
    const detail = `${row.ratio.toFixed(2)}:1 (needs ${row.min}:1)`;
    if (!row.pass) {
      console.log(`   ${mark} ${row.what}: ${detail}  ${row.fgHex} on ${row.bgHex}`);
    } else if (process.env.VERBOSE) {
      console.log(`   ${mark} ${row.what}: ${detail}`);
    }
  }
}

console.log(`\n${checked} pairings checked across ${THEMES.length} themes.`);
if (failures) {
  console.error(`FAIL - ${failures} pairing(s) do not meet the standard.`);
  process.exit(1);
}
console.log("PASS - every pairing meets WCAG AA.");
