/* ============================================================
   On Device - the image worker

   Runs the actual picture work on a separate thread so the
   interface never freezes, however large the photograph.

   It has no network access of any kind, and would be refused if
   it tried. It receives a file, does the work, and hands back the
   result. That is the whole of it.
   ============================================================ */

import { processImage } from "../image/pipeline.js";
import { readMetadata } from "../image/exif.js";

const cancelled = new Set();

self.addEventListener("message", async (event) => {
  const message = event.data || {};

  if (message.type === "cancel") {
    cancelled.add(message.id);
    return;
  }

  if (message.type === "metadata") {
    const { id, file, format } = message;
    try {
      const report = await readMetadata(file, format);
      self.postMessage({ type: "done", id, result: { report } });
    } catch (err) {
      self.postMessage({ type: "error", id, message: errorText(err) });
    }
    return;
  }

  if (message.type !== "process") return;

  const { id, file, sourceFormat, job } = message;

  try {
    if (cancelled.has(id)) {
      cancelled.delete(id);
      self.postMessage({ type: "cancelled", id });
      return;
    }

    const result = await processImage(file, sourceFormat, job, (value) => {
      self.postMessage({ type: "progress", id, value });
    });

    if (cancelled.has(id)) {
      cancelled.delete(id);
      self.postMessage({ type: "cancelled", id });
      return;
    }

    self.postMessage({
      type: "done",
      id,
      result: {
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
      }
    });
  } catch (err) {
    self.postMessage({ type: "error", id, message: errorText(err) });
  }
});

function errorText(err) {
  if (!err) return "Something went wrong, but the browser gave no reason.";
  if (err.message) return err.message;
  return String(err);
}

/* Anything that escapes entirely still gets reported rather than
   leaving the interface waiting. */
self.addEventListener("error", (event) => {
  self.postMessage({
    type: "fatal",
    message:
      "The image worker stopped unexpectedly: " +
      (event.message || "no reason given") +
      ". Your files were not sent anywhere."
  });
});

self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "fatal",
    message:
      "The image worker hit an unexpected problem: " +
      (event.reason && event.reason.message ? event.reason.message : String(event.reason))
  });
});
