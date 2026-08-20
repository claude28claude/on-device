/* ============================================================
   On Device - running image jobs

   Prefers a background thread so the interface stays responsive.
   If this browser will not give us one, the work happens on the
   page instead - slower to click during, but it still works, and
   we say so rather than failing.
   ============================================================ */

import { processImage } from "./pipeline.js";
import { readMetadata } from "./exif.js";

let worker = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map();

function workerUrl() {
  /* Resolved against this module, so it is correct whether the site
     sits at the root of a domain or in a subfolder. */
  return new URL("../workers/image-worker.js", import.meta.url);
}

function startWorker() {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(workerUrl(), { type: "module" });
  } catch (err) {
    console.warn("[On Device] No background thread available; working on the page instead.", err);
    workerBroken = true;
    return null;
  }

  worker.addEventListener("message", (event) => {
    const message = event.data || {};

    if (message.type === "fatal") {
      console.error("[On Device] " + message.message);
      for (const [, entry] of pending) entry.reject(new Error(message.message));
      pending.clear();
      stopWorker();
      workerBroken = true;
      return;
    }

    const entry = pending.get(message.id);
    if (!entry) return;

    if (message.type === "progress") {
      entry.onProgress(message.value);
    } else if (message.type === "done") {
      pending.delete(message.id);
      entry.resolve(message.result);
    } else if (message.type === "cancelled") {
      pending.delete(message.id);
      entry.reject(makeCancelled());
    } else if (message.type === "error") {
      pending.delete(message.id);
      entry.reject(new Error(message.message));
    }
  });

  worker.addEventListener("error", (event) => {
    const text =
      "The background thread failed to start: " +
      (event.message || "no reason given") +
      ". Falling back to working on the page.";
    console.warn("[On Device] " + text);
    for (const [, entry] of pending) entry.reject(new Error(text));
    pending.clear();
    stopWorker();
    workerBroken = true;
  });

  return worker;
}

function stopWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export function makeCancelled() {
  const err = new Error("Cancelled.");
  err.cancelled = true;
  return err;
}

export function isCancellation(err) {
  return Boolean(err && err.cancelled);
}

/* Is the work happening off the page? Shown honestly in the
   interface rather than assumed. */
export function usingBackgroundThread() {
  return !workerBroken;
}

/* ---- Running one job ------------------------------------ */
export function run(file, sourceFormat, job, onProgress = () => {}) {
  const active = startWorker();

  if (!active) {
    /* On the page. Progress still reports, but the interface will
       stutter on very large pictures - which is why we prefer not to. */
    return processImage(file, sourceFormat, job, onProgress).then((result) => ({
      blob: result.blob,
      format: result.format,
      width: result.width,
      height: result.height,
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      removed: result.removed || null,
      bytesSaved: result.bytesSaved || 0,
      lossless: Boolean(result.lossless),
      notes: result.notes || []
    }));
  }

  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    active.postMessage({ type: "process", id, file, sourceFormat, job });
  }).finally(() => pending.delete(id));
}

/* Reading the hidden information, off the page too - a very large
   photograph can take a moment. */
export function metadata(file, format) {
  const active = startWorker();
  if (!active) return readMetadata(file, format).then((report) => ({ report }));

  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: () => {} });
    active.postMessage({ type: "metadata", id, file, format });
  }).finally(() => pending.delete(id));
}

/* ---- Cancelling ----------------------------------------- */
/* The only reliable way to stop work already inside a decode is to
   end the thread. The next job starts a fresh one. */
export function cancelEverything() {
  const count = pending.size;
  for (const [, entry] of pending) entry.reject(makeCancelled());
  pending.clear();
  stopWorker();
  return count;
}
