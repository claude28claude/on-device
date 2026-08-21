/* ============================================================
   On Device - running a recipe

   Takes a list of files and a list of steps and walks the files
   through, step by step. Whatever comes out of one step is what
   goes into the next.

   Two rules that matter:

   1. Nothing is thrown away quietly. If a step cannot cope with
      a file, the run stops at that step and says which file and
      why, rather than skipping it and handing back a smaller
      pile than you gave it.

   2. Every step is checked BEFORE anything runs. A recipe that
      would fail at step four is refused at step zero, so you do
      not sit through three minutes of work to be told it was
      never going to succeed.
   ============================================================ */

import { getStep, makeItem } from "./steps.js";

export class Cancelled extends Error {
  constructor() {
    super("The recipe was stopped.");
    this.cancelled = true;
  }
}

/* ---- Checking a recipe before it runs -------------------- */
/* Works out what kind of files each step would be handed, by
   following the chain on paper. Returns a list of problems in
   plain English; an empty list means it should run. */
export function check(steps, startingKinds) {
  const problems = [];
  let kinds = new Set(startingKinds && startingKinds.length ? startingKinds : []);
  let unknown = !kinds.size;
  let count = kinds.size ? null : null;

  for (let i = 0; i < steps.length; i++) {
    const def = getStep(steps[i].stepId);
    const where = `Step ${i + 1}`;

    if (!def) {
      problems.push(`${where} is a kind of step this version does not have. Remove it.`);
      unknown = true;
      continue;
    }

    if (!unknown && kinds.size) {
      const bad = [...kinds].filter((k) => !accepts(def, k));
      if (bad.length) {
        problems.push(
          `${where}, “${def.label}”, cannot work on ${bad.map(kindName).join(" or ")}. ` +
          `By this point in the recipe that is what it would be handed.`
        );
      }
    }

    /* Required text that has been left empty is the commonest way a
       recipe fails, and it is knowable now rather than later. */
    for (const opt of def.options) {
      if (opt.type === "secret") continue;
      const value = steps[i].options ? steps[i].options[opt.key] : undefined;
      if (opt.type === "text" && opt.default === "" && !String(value || "").trim()) continue;
      if (opt.type === "text" && opt.default !== "" && !String(value === undefined ? opt.default : value).trim()) {
        problems.push(`${where}, “${def.label}”: “${opt.label}” has been left empty.`);
      }
    }

    kinds = new Set(produces(def, kinds));
    unknown = false;
    void count;
  }

  return problems;
}

function accepts(def, kind) {
  if (def.accepts === "any") return true;
  if (def.accepts === "pdf") return kind === "pdf";
  if (def.accepts === "image") return kind === "image" || kind === "heic";
  if (def.accepts === "pdf-or-image") return kind === "pdf" || kind === "image" || kind === "heic";
  return true;
}

function produces(def, incoming) {
  switch (def.id) {
    case "pdf-merge":
    case "images-to-pdf":
      return ["pdf"];
    case "pdf-to-images":
      return ["image"];
    case "pdf-extract-text":
      return ["text"];
    case "zip":
      return ["zip"];
    case "image-resize":
    case "image-convert":
    case "image-compress":
    case "image-rotate":
    case "image-strip":
    case "image-watermark":
      return ["image"];
    default:
      /* Every remaining step hands on what it was given. */
      return [...incoming];
  }
}

export function kindName(kind) {
  return {
    pdf: "PDFs", image: "pictures", heic: "iPhone photos", text: "text files",
    csv: "spreadsheet files", json: "data files", zip: "zip files", any: "files"
  }[kind] || "files";
}

/* ---- The run --------------------------------------------- */
/* files: [{ blob, name, format, kind }]
   steps: [{ stepId, options }]
   secrets: { "<stepIndex>.<key>": "value" } - supplied per run,
            never stored.

   onEvent is called with plain objects describing what is
   happening, so the page can show it without this file knowing
   anything about the page. */
export async function run(files, steps, {
  secrets = {},
  onEvent = () => {},
  shouldStop = () => false
} = {}) {
  const startedAt = Date.now();
  let items = files.map((f) => makeItem(f.blob, f.name, f.format, f.kind));

  const trail = [{ label: "Files you dropped in", count: items.length }];

  for (let i = 0; i < steps.length; i++) {
    if (shouldStop()) throw new Cancelled();

    const entry = steps[i];
    const def = getStep(entry.stepId);
    if (!def) {
      throw new Error(
        `Step ${i + 1} is a kind of step this version does not have, so the recipe ` +
        `cannot be run. Open it and remove that step.`
      );
    }

    if (!items.length) {
      throw new Error(
        `By step ${i + 1}, “${def.label}”, there were no files left to work on. ` +
        `That is a bug in the recipe rather than in your files — an earlier step ` +
        `produced nothing.`
      );
    }

    /* Options for this run: what was saved, plus any password typed
       just now. The password is never written back anywhere. */
    const options = { ...(entry.options || {}) };
    for (const opt of def.options) {
      if (opt.type !== "secret") continue;
      options[opt.key] = secrets[`${i}.${opt.key}`] || "";
    }

    onEvent({ type: "step-start", index: i, stepId: def.id, label: def.label, incoming: items.length });

    const ctx = {
      progress(fraction, name) {
        onEvent({
          type: "progress",
          index: i,
          fraction: Math.max(0, Math.min(1, fraction || 0)),
          name: name || ""
        });
      },
      shouldStop
    };

    let produced;
    try {
      produced = await def.run(items, options, ctx);
    } catch (err) {
      if (err && err.cancelled) throw err;
      const message = err && err.message ? err.message : String(err);
      const wrapped = new Error(
        `Step ${i + 1}, “${def.label}”, stopped: ${message}`
      );
      wrapped.stepIndex = i;
      wrapped.original = err;
      throw wrapped;
    }

    if (!Array.isArray(produced) || !produced.length) {
      throw new Error(
        `Step ${i + 1}, “${def.label}”, produced no files at all. Nothing has been ` +
        `saved. This is a fault in On Device, not in your files — please say so on ` +
        `the Help page if you can describe what you had loaded.`
      );
    }

    items = produced;
    trail.push({ label: def.label, count: items.length });
    onEvent({ type: "step-done", index: i, stepId: def.id, label: def.label, outgoing: items.length });
  }

  return { items, trail, ms: Date.now() - startedAt };
}
