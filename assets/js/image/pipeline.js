/* ============================================================
   On Device - one photograph, start to finish

   Every image tool hands a file and a list of instructions to
   this one place. Keeping it in a single readable file means
   there is one path to check rather than six.

   Nothing here touches the network. It could not: the page it
   runs in is not permitted to.
   ============================================================ */

import { decodeImage, detectCapabilities } from "./decode.js";
import { normalise, resize, crop, rotate, straighten, flatten, hasTransparency, toBlob, releaseCanvas } from "./ops.js";
import { stripMetadata, canStripLosslessly, mimeFor } from "./strip.js";

/* ---- Filenames ------------------------------------------ */
export function baseName(name) {
  return String(name).replace(/\.[^.]+$/, "");
}

export function extensionFor(format) {
  return { jpg: "jpg", png: "png", webp: "webp", avif: "avif", gif: "gif", bmp: "bmp", tiff: "tiff" }[format] || format;
}

/* Fills in the visitor's chosen pattern, e.g. "{name}-{tool}.{ext}". */
export function makeFilename(pattern, { name, tool, format, index = 1 }) {
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const out = String(pattern || "{name}-{tool}.{ext}")
    .replace(/\{name\}/g, baseName(name))
    .replace(/\{tool\}/g, tool)
    .replace(/\{date\}/g, stamp)
    .replace(/\{n\}/g, String(index))
    .replace(/\{ext\}/g, extensionFor(format));
  /* A pattern with no extension still needs one, or the file will not
     open when it lands in a downloads folder. */
  return /\.[a-z0-9]+$/i.test(out) ? out : `${out}.${extensionFor(format)}`;
}

/* ---- Deciding the output format ------------------------- */
export async function resolveFormat(requested, sourceFormat) {
  const caps = await detectCapabilities();
  let format = requested === "keep" || !requested ? sourceFormat : requested;

  /* Formats a browser can read but never write. */
  if (format === "heic" || format === "gif" || format === "bmp" || format === "tiff") {
    format = "png";
  }

  if (!caps.encode[format]) {
    if (format === "avif") {
      throw new Error(
        "This browser cannot save AVIF files. Chrome and Firefox on a recent version can; " +
        "Safari and Edge generally cannot. Choose WebP for a similar saving, or JPEG for the " +
        "widest compatibility."
      );
    }
    if (format === "webp") {
      throw new Error(
        "This browser cannot save WebP files. Choose JPEG or PNG instead."
      );
    }
    throw new Error(`This browser cannot save ${String(format).toUpperCase()} files.`);
  }

  return format;
}

/* ---- The run -------------------------------------------- */
/* job: {
     op, resize, crop, rotate, straighten,
     format, quality, stripMetadata, background
   }
   onProgress is called with a number from 0 to 1. */
export async function processImage(file, sourceFormat, job, onProgress = () => {}) {
  const notes = [];
  onProgress(0.05);

  /* The lossless path: removing metadata and nothing else never
     touches the picture at all. */
  if (job.op === "strip" && canStripLosslessly(sourceFormat)) {
    const result = await stripMetadata(file, sourceFormat, {
      keepColourProfile: job.keepColourProfile !== false
    });
    onProgress(1);
    return {
      blob: result.blob,
      format: sourceFormat,
      width: null,
      height: null,
      removed: result.removed,
      bytesSaved: result.bytesSaved,
      lossless: true,
      notes: [
        "The picture itself was not re-saved, so no quality was lost. Only the hidden " +
        "information was cut out."
      ]
    };
  }

  const decoded = await decodeImage(file, sourceFormat);
  onProgress(0.25);

  let canvas = null;
  try {
    canvas = normalise(decoded.bitmap, decoded.orientation, decoded.orientationApplied);
    if (!decoded.orientationApplied && decoded.orientation > 1) {
      notes.push("The photo carried a rotation flag, which has been applied so it is the right way up.");
    }
  } finally {
    decoded.bitmap.close();
  }

  const originalWidth = canvas.width;
  const originalHeight = canvas.height;

  try {
    if (job.crop) {
      const next = crop(canvas, job.crop);
      releaseCanvas(canvas);
      canvas = next;
    }
    onProgress(0.4);

    if (job.straighten) {
      const next = straighten(canvas, job.straighten.degrees, { background: job.background || null });
      releaseCanvas(canvas);
      canvas = next;
    }

    if (job.rotate && (job.rotate.degrees || job.rotate.flipH || job.rotate.flipV)) {
      const next = rotate(canvas, job.rotate);
      releaseCanvas(canvas);
      canvas = next;
    }
    onProgress(0.55);

    if (job.resize) {
      const result = resize(canvas, job.resize);
      if (result.changed) {
        releaseCanvas(canvas);
        canvas = result.canvas;
      }
    }
    onProgress(0.7);

    const format = await resolveFormat(job.format, sourceFormat);

    /* JPEG has no transparency. Saying so, and filling the see-through
       areas with a colour, beats handing back a picture with black
       patches where the transparency was. */
    if (format === "jpg" || format === "bmp") {
      if (hasTransparency(canvas)) {
        const next = flatten(canvas, job.background || "#ffffff");
        releaseCanvas(canvas);
        canvas = next;
        notes.push(
          `JPEG cannot store transparency, so the see-through areas were filled with ` +
          `${job.background || "white"}.`
        );
      }
    }
    onProgress(0.8);

    const blob = await toBlob(canvas, format, job.quality);
    onProgress(0.97);

    /* Re-encoding always drops the metadata, which is worth saying
       plainly - people expect their location to travel with the file. */
    if (sourceFormat === "jpg" || sourceFormat === "heic") {
      notes.push("Re-saving removed the original's hidden information, including any location.");
    }

    const result = {
      blob,
      format,
      width: canvas.width,
      height: canvas.height,
      originalWidth,
      originalHeight,
      lossless: false,
      notes
    };
    onProgress(1);
    return result;
  } finally {
    if (canvas) releaseCanvas(canvas);
  }
}

export { mimeFor };
