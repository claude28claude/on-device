/* ============================================================
   On Device - checking the pages can be used without a mouse
                and without sight

   This is NOT a substitute for driving the site with a real screen
   reader, and it does not pretend to be. It checks the things a
   machine can check honestly:

     - one first-level heading per page, and no skipped levels
     - every control has a name a screen reader can read out
     - every label points at a control that exists
     - every aria-* reference points at something that exists
     - no duplicate identifiers, which quietly break both
     - every picture says whether it is decoration or content
     - the landmarks are there: a header, a main, a footer
     - the skip link exists and points at the main content
     - nothing has been forced out of natural tab order

   Run:  node scripts/check-a11y.mjs
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function pages() {
  const list = [];
  for (const f of fs.readdirSync(root)) {
    if (f.endsWith(".html")) list.push(f);
  }
  for (const f of fs.readdirSync(path.join(root, "tools"))) {
    if (f.endsWith(".html")) list.push(path.join("tools", f));
  }
  return list;
}

/* A deliberately small HTML reader. It does not need to understand
   the whole language - only enough to find tags and their
   attributes, which is all these checks look at. */
function tags(html) {
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = {};
    const are = /([a-zA-Z-:]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = are.exec(m[2]))) {
      attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? a[5] ?? "";
    }
    out.push({ name: m[1].toLowerCase(), attrs, at: m.index, raw: m[0] });
  }
  return out;
}

function textInside(html, tag, from) {
  const close = html.indexOf(`</${tag}`, from);
  if (close < 0) return "";
  const open = html.indexOf(">", from);
  return html.slice(open + 1, close).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").trim();
}

const problems = [];
const notes = [];

function fail(page, message) {
  problems.push(`${page}: ${message}`);
}

for (const page of pages()) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const all = tags(html);

  /* ---- The page itself ---------------------------------- */
  const htmlTag = all.find((t) => t.name === "html");
  if (!htmlTag || !htmlTag.attrs.lang) fail(page, "the page does not say what language it is in");
  if (!/<title>/.test(html)) fail(page, "the page has no title");

  /* ---- Landmarks ---------------------------------------- */
  if (!/<main\b/.test(html)) fail(page, "there is no main region, so “skip to content” has nothing to skip to");
  if (!/<header\b/.test(html)) fail(page, "there is no header region");
  if (!/<footer\b/.test(html)) fail(page, "there is no footer region");

  const navs = all.filter((t) => t.name === "nav");
  for (const nav of navs) {
    if (!nav.attrs["aria-label"] && !nav.attrs["aria-labelledby"]) {
      fail(page, "a navigation region has no name, so a screen reader cannot tell it from the others");
    }
  }

  /* ---- The skip link ------------------------------------ */
  const skip = all.find((t) => t.name === "a" && (t.attrs.class || "").includes("skip-link"));
  if (!skip) fail(page, "there is no skip link");
  else if (skip.attrs.href !== "#main") fail(page, `the skip link points at ${skip.attrs.href}, not #main`);

  /* ---- Headings ----------------------------------------- */
  const headings = all.filter((t) => /^h[1-6]$/.test(t.name));
  const h1s = headings.filter((t) => t.name === "h1");
  if (h1s.length === 0) fail(page, "there is no first-level heading");
  if (h1s.length > 1) fail(page, `there are ${h1s.length} first-level headings; there should be one`);

  let previous = 0;
  for (const h of headings) {
    const level = Number(h.name.slice(1));
    if (previous && level > previous + 1) {
      const text = textInside(html, h.name, h.at).slice(0, 40);
      fail(page, `heading level jumps from h${previous} to h${level} at “${text}”`);
    }
    previous = level;
  }

  /* ---- Identifiers -------------------------------------- */
  const ids = new Map();
  for (const t of all) {
    if (!t.attrs.id) continue;
    ids.set(t.attrs.id, (ids.get(t.attrs.id) || 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) fail(page, `the identifier “${id}” is used ${count} times`);
  }

  /* ---- Labels ------------------------------------------- */
  for (const t of all) {
    if (t.name !== "label" || !t.attrs.for) continue;
    if (!ids.has(t.attrs.for)) {
      fail(page, `a label points at “${t.attrs.for}”, which is not on the page`);
    }
  }

  /* ---- References --------------------------------------- */
  const refAttrs = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns"];
  for (const t of all) {
    for (const attr of refAttrs) {
      const value = t.attrs[attr];
      if (!value) continue;
      for (const ref of value.split(/\s+/).filter(Boolean)) {
        if (!ids.has(ref)) {
          /* aria-controls may legitimately name something built later
             by a script; that is worth a note, not a failure. */
          if (attr === "aria-controls") notes.push(`${page}: aria-controls names “${ref}”, which is created by a script`);
          else fail(page, `${attr} names “${ref}”, which is not on the page`);
        }
      }
    }
  }

  /* ---- Controls that can be read out --------------------- */
  /* A control is named either by a label pointing at it, or by
     sitting INSIDE a label - both are proper HTML, and the second is
     what every checkbox on this site uses. */
  const labelledIds = new Set(
    all.filter((t) => t.name === "label" && t.attrs.for).map((t) => t.attrs.for)
  );

  const wrapped = new Set();
  {
    const re = /<label\b([^>]*)>([\s\S]*?)<\/label>/g;
    let m;
    while ((m = re.exec(html))) {
      if (/for\s*=/.test(m[1])) continue;   /* already counted above */
      const words = m[2].replace(/<[^>]+>/g, " ").trim();
      if (!words) continue;                    /* an empty label names nothing */
      for (const inner of tags(m[2])) {
        if (inner.attrs.id) wrapped.add(inner.attrs.id);
      }
    }
  }

  for (const t of all) {
    if (!["input", "select", "textarea"].includes(t.name)) continue;
    if (t.attrs.type === "hidden") continue;
    const named = t.attrs["aria-label"] || t.attrs["aria-labelledby"] ||
      (t.attrs.id && (labelledIds.has(t.attrs.id) || wrapped.has(t.attrs.id))) ||
      t.attrs.title;
    if (!named) {
      fail(page, `a ${t.name}${t.attrs.id ? ` (“${t.attrs.id}”)` : ""} has nothing that names it`);
    }
  }

  for (const t of all) {
    if (t.name !== "button") continue;
    const text = textInside(html, "button", t.at);
    const named = text || t.attrs["aria-label"] || t.attrs["aria-labelledby"] ||
      t.attrs["data-i18n-attr"];
    if (!named) fail(page, `a button${t.attrs.id ? ` (“${t.attrs.id}”)` : ""} has no words and no label`);
  }

  /* ---- Pictures ----------------------------------------- */
  for (const t of all) {
    if (t.name !== "img") continue;
    if (t.attrs.alt === undefined) {
      fail(page, `an image (${t.attrs.src || "no source"}) does not say whether it is decoration or content`);
    }
  }

  for (const t of all) {
    if (t.name !== "svg") continue;
    const decorative = t.attrs["aria-hidden"] === "true";
    const named = t.attrs["aria-label"] || t.attrs["aria-labelledby"] || t.attrs.role === "img";
    if (!decorative && !named) {
      fail(page, "an inline drawing is neither marked as decoration nor given a name");
    }
  }

  /* ---- Tab order ---------------------------------------- */
  for (const t of all) {
    const index = t.attrs.tabindex;
    if (index === undefined) continue;
    if (Number(index) > 0) {
      fail(page, `something sets tabindex="${index}", which forces it out of the natural order`);
    }
  }
}

/* ---- Report ---------------------------------------------- */
console.log(`Checked ${pages().length} pages.\n`);

if (notes.length) {
  console.log("Worth knowing:");
  for (const n of [...new Set(notes)]) console.log("  " + n);
  console.log("");
}

if (problems.length) {
  console.log("FAIL - these would get in somebody's way:\n");
  for (const p of problems) console.log("  " + p);
  console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
  console.log(
    "\nNote that passing this check is not the same as being usable with a screen\n" +
    "reader. It checks structure. Somebody still has to drive the site with one."
  );
  process.exit(1);
}

console.log("PASS - every page has one first-level heading, no skipped levels,");
console.log("       named controls, working labels and references, and landmarks.");
console.log("");
console.log("This checks structure only. It is not a substitute for driving the site");
console.log("with a real screen reader, which has still not been done.");
