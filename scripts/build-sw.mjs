/* ============================================================
   On Device - offline file list builder

   Works out every file the site needs in order to run with the
   internet switched off, and writes that list into sw.js along
   with a version stamp taken from the files' own contents.

       node scripts/build-sw.mjs

   Run this after changing any file, before publishing. If you
   forget, the site still works - it just may serve an older
   cached copy until the next visit.
   ============================================================ */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Folders that are part of the site as served. */
const INCLUDE_DIRS = ["assets"];

/* The PDF libraries are several megabytes. Downloading them on a first visit,
   to somebody who may only want to resize a photo, would be rude. They are
   left out of this list and fetched the first time a PDF tool is opened, with
   a progress bar - after which the service worker keeps them, so they are
   downloaded exactly once and work offline from then on. */
const LAZY_PREFIXES = ["assets/vendor/"];
const SKIP_DIRS = new Set([".git", "node_modules", "scripts", "samples"]);
const SKIP_EXT = new Set([".md", ".mjs"]);
const SKIP_FILES = new Set(["sw.js", ".gitignore", "LICENSE"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = [];

/* Everything at the top level that the browser asks for. */
for (const entry of readdirSync(ROOT)) {
  if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
  const full = join(ROOT, entry);
  if (statSync(full).isDirectory()) continue;
  if (SKIP_EXT.has(extname(entry))) continue;
  files.push(full);
}

/* Plus the asset folders, and the tools folder once it has pages. */
for (const dir of [...INCLUDE_DIRS, "tools"]) {
  const full = join(ROOT, dir);
  try {
    if (statSync(full).isDirectory()) walk(full, files);
  } catch (err) {
    /* "tools" does not exist until the first tool is built. */
  }
}

const allUrls = files
  .map((f) => "./" + relative(ROOT, f).split("\\").join("/"))
  .filter((u) => !SKIP_EXT.has(extname(u)));

const lazy = allUrls.filter((u) => LAZY_PREFIXES.some((p) => u.startsWith("./" + p)));
const urls = allUrls.filter((u) => !lazy.includes(u)).sort();

/* The homepage is also reachable as "./", so cache both. */
const precache = ["./", ...urls];

/* Version stamp: a short hash of every file's contents, so a
   changed file always produces a new cache name. */
const hash = createHash("sha256");
for (const f of files.sort()) {
  hash.update(relative(ROOT, f));
  hash.update(readFileSync(f));
}
const stamp = hash.digest("hex").slice(0, 10);

const pkgVersion = "0.1.0";
const version = `${pkgVersion}-${stamp}`;

/* ---- Rewrite the two marked blocks in sw.js -------------- */
const swPath = join(ROOT, "sw.js");
let sw = readFileSync(swPath, "utf8");

function replaceBlock(text, name, replacement) {
  const start = `/* --- BUILD:${name} --- */`;
  const end = `/* --- END BUILD:${name} --- */`;
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from < 0 || to < 0) {
    throw new Error(`sw.js is missing its ${name} markers. Cannot update it safely.`);
  }
  return text.slice(0, from + start.length) + "\n" + replacement + "\n" + text.slice(to);
}

sw = replaceBlock(sw, "VERSION", `const VERSION = ${JSON.stringify(version)};`);
sw = replaceBlock(
  sw,
  "PRECACHE",
  "const PRECACHE = [\n" + precache.map((u) => `  ${JSON.stringify(u)}`).join(",\n") + "\n];"
);

writeFileSync(swPath, sw, "utf8");

console.log(`Offline file list written into sw.js`);
console.log(`  version:  ${version}`);
console.log(`  files:    ${precache.length} saved on the first visit`);
if (lazy.length) {
  console.log(
    `  lazy:     ${lazy.length} borrowed files kept out of the first visit ` +
    `and cached when a PDF tool is first opened`
  );
}
for (const u of precache) console.log(`    ${u}`);
