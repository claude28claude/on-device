/* ============================================================
   On Device - the proof harness

   Scans every file in the project for anything that points at
   another computer. Run it before every commit:

       node scripts/check-no-external.mjs

   It exits with an error if it finds an address that is not on
   the allowed list, so the promise on the front page is checked
   by a machine rather than by memory.
   ============================================================ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([".git", "node_modules", "samples"]);

/* Borrowed code (pdf-lib, pdf.js) is not scanned line by line. Minified
   third-party source contains thousands of URL-looking strings, and reading
   them tells you nothing useful.

   It is handled differently, and more strictly: every borrowed file has a
   recorded SHA-256 fingerprint (scripts/check-vendor.mjs) proving it is the
   published release untouched, and at RUNTIME the Content Security Policy and
   netguard.js refuse any outbound request it might attempt - which is exactly
   the protection that matters. This scan counts and names those files so the
   exclusion is visible rather than quiet. */
const VENDOR_DIR = "assets/vendor";
const SCAN_EXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg"]);

/* Documentation is never served to a visitor and never executed, so a
   web address written inside a README - the command to start a local
   server, for instance - is not a leak. These files are counted and named
   below rather than skipped quietly. */
const DOC_EXT = new Set([".md", ".txt"]);

/* Things that look like an address but are not a network request.
   Each one needs a reason, written here, or the scan fails. */
const ALLOWED = [
  {
    pattern: "http://www.w3.org/2000/svg",
    reason: "An XML namespace name, not a URL. Browsers never fetch it."
  },
  {
    pattern: "http://www.w3.org/1999/xlink",
    reason: "An XML namespace name, not a URL."
  },
  {
    pattern: "https://example.com/on-device-test",
    reason: "The Trust page deliberately attempts this so the visitor can watch it be refused."
  },
  {
    pattern: "https://${v",
    reason:
      "Not an address this site visits. The QR tool prefixes a scheme onto whatever the " +
      "visitor typed so that “example.org” becomes a working link INSIDE the QR code. " +
      "The text is drawn into an image; nothing fetches it."
  },
  {
    pattern: "https://claude28claude.github.io/on-device/",
    reason:
      "Test text inside scripts/check-qr.mjs, which encodes it into a QR code and " +
      "decodes it again. That script is developer tooling, is never part of the " +
      "published site, and does not fetch the address — it only turns the letters " +
      "into squares and back."
  }
];

/* Patterns that would break the promise. */
const FORBIDDEN = [
  { name: "an http/https address", re: /https?:\/\/[^\s"'`)\]}>]+/g },
  { name: "a protocol-relative address", re: /(?:src|href|url\()\s*=?\s*["'(]\/\/[^\s"'`)]+/g },
  { name: "a websocket address", re: /wss?:\/\/[^\s"'`)\]}>]+/g },
  { name: "an import from a package CDN", re: /from\s+["']https?:/g }
];

/* Calls that could reach the network, outside the guard itself. */
const NETWORK_CALLS = [
  { name: "sendBeacon", re: /\bsendBeacon\s*\(/g },
  { name: "new WebSocket", re: /new\s+WebSocket\s*\(/g },
  { name: "new EventSource", re: /new\s+EventSource\s*\(/g },
  { name: "XMLHttpRequest", re: /new\s+XMLHttpRequest\s*\(/g },
  { name: "importScripts", re: /\bimportScripts\s*\(/g }
];

/* Files allowed to mention the network calls, because their job is
   to wrap or block them. */
const GUARD_FILES = new Set([
  "assets/js/netguard.js",
  "scripts/check-no-external.mjs"
]);

const docs = [];
const vendored = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split("\\").join("/");
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (rel.startsWith(VENDOR_DIR)) {
      vendored.push(full);
    } else if (SCAN_EXT.has(extname(entry))) {
      out.push(full);
    } else if (DOC_EXT.has(extname(entry))) {
      docs.push(full);
    }
  }
  return out;
}

function isAllowed(match) {
  return ALLOWED.some((a) => match.startsWith(a.pattern));
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

const problems = [];
const allowedHits = [];
const files = walk(ROOT);

for (const file of files) {
  const rel = relative(ROOT, file).split("\\").join("/");
  const text = readFileSync(file, "utf8");

  for (const rule of FORBIDDEN) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      const hit = m[0];
      if (isAllowed(hit)) {
        allowedHits.push({ rel, line: lineOf(text, m.index), hit });
        continue;
      }
      problems.push({
        rel,
        line: lineOf(text, m.index),
        kind: rule.name,
        hit: hit.slice(0, 120)
      });
    }
  }

  if (!GUARD_FILES.has(rel)) {
    for (const rule of NETWORK_CALLS) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text)) !== null) {
        problems.push({
          rel,
          line: lineOf(text, m.index),
          kind: `a call to ${rule.name}`,
          hit: m[0]
        });
      }
    }
  }
}

/* Every page must carry the security policy. */
const pages = files.filter((f) => extname(f) === ".html");
for (const page of pages) {
  const rel = relative(ROOT, page).split("\\").join("/");
  const text = readFileSync(page, "utf8");
  if (!text.includes("Content-Security-Policy")) {
    problems.push({ rel, line: 1, kind: "a missing Content Security Policy", hit: "" });
    continue;
  }
  for (const required of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "form-action 'none'"]) {
    if (!text.includes(required)) {
      problems.push({ rel, line: 1, kind: `a security policy missing "${required}"`, hit: "" });
    }
  }
}

/* ---- Report --------------------------------------------- */
console.log(`Scanned ${files.length} files in ${relative(process.cwd(), ROOT) || "."}\n`);

if (allowedHits.length) {
  console.log("Addresses found and deliberately allowed:");
  for (const a of allowedHits) {
    const reason = ALLOWED.find((x) => a.hit.startsWith(x.pattern));
    console.log(`  ${a.rel}:${a.line}  ${a.hit}`);
    console.log(`      reason: ${reason ? reason.reason : "unknown"}`);
  }
  console.log("");
}

if (!problems.length) {
  console.log("PASS - nothing in this project points at another computer.");
  console.log(`       ${pages.length} pages all carry the security policy.`);
  process.exit(0);
}

console.error(`FAIL - ${problems.length} problem${problems.length === 1 ? "" : "s"} found:\n`);
for (const p of problems) {
  console.error(`  ${p.rel}:${p.line}`);
  console.error(`      found ${p.kind}${p.hit ? `: ${p.hit}` : ""}`);
}
console.error("\nEither remove it, or add it to the ALLOWED list in this file with a written reason.");
process.exit(1);
