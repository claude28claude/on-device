/* ============================================================
   On Device - verifying the borrowed code

       node scripts/check-vendor.mjs

   Two libraries in this project were not written here: pdf-lib
   and pdf.js. Writing a PDF renderer from scratch is not a
   sensible thing to attempt, so they are used - but "we included
   somebody else's code" needs to come with a way to check it.

   This records the exact version and a SHA-256 fingerprint of
   every borrowed file. Anyone can download the same version from
   npm, run the same fingerprint, and confirm the file here is
   byte-for-byte the published one and has not been tampered with.

   That is a stronger guarantee than shipping the code unminified
   and asking people to read a million lines of it.

   Run with --write to regenerate the record after updating a
   library. Run with no arguments to check the files still match.
   ============================================================ */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(ROOT, "assets", "vendor");
const RECORD = join(ROOT, "assets", "vendor", "VENDOR.json");

/* Where each borrowed file came from. */
export const SOURCES = [
  {
    name: "pdf-lib",
    version: "1.17.1",
    licence: "MIT",
    package: "pdf-lib@1.17.1",
    purpose: "Creating and editing PDF files",
    files: ["pdf-lib/pdf-lib.esm.min.js"]
  },
  {
    name: "qpdf (WebAssembly)",
    version: "0.0.2",
    licence: "Apache-2.0",
    package: "@jspawn/qpdf-wasm@0.0.2",
    purpose: "Adding and removing PDF passwords - the one job pdf-lib cannot do",
    files: ["qpdf/qpdf.js", "qpdf/qpdf.mjs", "qpdf/qpdf.wasm"]
  },
  {
    name: "pdf.js",
    version: "5.4.149",
    licence: "Apache-2.0",
    package: "pdfjs-dist@5.4.149",
    purpose: "Reading PDF files, drawing page previews, extracting text",
    files: ["pdfjs/pdf.min.mjs", "pdfjs/pdf.worker.min.mjs"]
  },
  {
    name: "zip.js",
    version: "2.7.57",
    licence: "BSD-3-Clause",
    package: "@zip.js/zip.js@2.7.57",
    purpose: "Reading and writing zip archives, including encrypted ones",
    files: ["zipjs/zip.min.js"]
  },
  {
    name: "SheetJS (community)",
    version: "0.18.5",
    licence: "Apache-2.0",
    package: "xlsx@0.18.5",
    purpose: "Reading and writing Excel spreadsheets",
    files: ["sheetjs/xlsx.full.min.js"]
  },
  {
    name: "tesseract.js",
    version: "5.1.1 (engine 5.1.1, English data 4.0.0)",
    licence: "Apache-2.0",
    package: "tesseract.js@5.1.1 + tesseract.js-core@5.1.1 + @tesseract.js-data/eng@1.0.0",
    purpose: "Reading text out of scans and photographs, offline",
    files: [
      "tesseract/tesseract.esm.min.js",
      "tesseract/worker.min.js",
      "tesseract/core/tesseract-core-simd-lstm.wasm",
      "tesseract/lang/eng.traineddata.gz"
    ]
  },
  {
    name: "marked",
    version: "15.0.7",
    licence: "MIT",
    package: "marked@15.0.7",
    purpose: "Turning markdown into HTML",
    files: ["marked/marked.esm.js"]
  },
  {
    name: "jsQR",
    version: "1.4.0",
    licence: "Apache-2.0",
    package: "jsqr@1.4.0",
    purpose: "Reading QR codes out of a picture",
    /* The only borrowed file here that is not minified: upstream ships
       no minified build. That makes it larger, and also readable, so
       this one can be checked by eye as well as by fingerprint. */
    files: ["jsqr/jsQR.js"]
  },
  {
    name: "Atkinson Hyperlegible",
    version: "5.3.0",
    licence: "OFL-1.1",
    package: "@fontsource/atkinson-hyperlegible@5.3.0",
    purpose: "The 'extra legible' typeface, drawn for readers with low vision",
    files: [
      "atkinson/atkinson-latin-400-normal.woff2",
      "atkinson/atkinson-latin-400-italic.woff2",
      "atkinson/atkinson-latin-700-normal.woff2",
      "atkinson/atkinson-latin-700-italic.woff2"
    ]
  },
  {
    name: "DOMPurify",
    version: "3.2.4",
    licence: "Apache-2.0 (dual-licensed with MPL-2.0)",
    package: "dompurify@3.2.4",
    purpose: "Making markdown-produced HTML safe to display",
    files: ["dompurify/purify.es.mjs"]
  }
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const files = walk(VENDOR)
  .filter((f) => !f.endsWith("VENDOR.json"))
  .map((f) => relative(VENDOR, f).split("\\").join("/"))
  .sort();

const fingerprints = {};
let totalBytes = 0;
for (const rel of files) {
  const full = join(VENDOR, rel);
  fingerprints[rel] = sha256(full);
  totalBytes += statSync(full).size;
}

const record = {
  note:
    "Fingerprints of every borrowed file in this project. Download the same " +
    "package version from npm and compare - they should match exactly.",
  generated: "run scripts/check-vendor.mjs --write to regenerate",
  sources: SOURCES,
  totalFiles: files.length,
  totalBytes,
  fingerprints
};

if (process.argv.includes("--write")) {
  writeFileSync(RECORD, JSON.stringify(record, null, 2) + "\n", "utf8");
  console.log(`Recorded ${files.length} borrowed files (${(totalBytes / 1048576).toFixed(1)} MB).`);
  for (const s of SOURCES) {
    console.log(`  ${s.name} ${s.version} (${s.licence}) - ${s.purpose}`);
  }
  console.log(`\nWritten to assets/vendor/VENDOR.json`);
  process.exit(0);
}

if (!existsSync(RECORD)) {
  console.error("No record found. Run: node scripts/check-vendor.mjs --write");
  process.exit(1);
}

const previous = JSON.parse(readFileSync(RECORD, "utf8"));
const problems = [];

for (const rel of files) {
  if (!previous.fingerprints[rel]) {
    problems.push(`NEW, not in the record: ${rel}`);
  } else if (previous.fingerprints[rel] !== fingerprints[rel]) {
    problems.push(`CHANGED since it was recorded: ${rel}`);
  }
}
for (const rel of Object.keys(previous.fingerprints)) {
  if (!fingerprints[rel]) problems.push(`MISSING, was recorded but is gone: ${rel}`);
}

console.log(`Checked ${files.length} borrowed files (${(totalBytes / 1048576).toFixed(1)} MB).`);
for (const s of SOURCES) {
  console.log(`  ${s.name} ${s.version} (${s.licence})`);
}
console.log("");

if (problems.length) {
  console.error(`FAIL - ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nIf you deliberately updated a library, re-record it with:\n" +
    "  node scripts/check-vendor.mjs --write"
  );
  process.exit(1);
}

console.log("PASS - every borrowed file matches its recorded fingerprint.");
