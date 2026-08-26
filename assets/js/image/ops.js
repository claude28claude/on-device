/* ============================================================
   On Device - the actual image work

   Resizing, cropping, rotating and re-encoding. All of it runs on
   a canvas belonging to this tab, on this machine.

   Resizing down is done in steps rather than one jump, because a
   single large reduction makes a photograph look soft and blocky.
   Halving repeatedly and then finishing the last step is how good
   image software has always done it, and the difference is
   visible.
   ============================================================ */

import { orientationTransform } from "./decode.js";
import { mimeFor } from "./strip.js";

/* ---- Making a canvas, in a worker or on the page -------- */
export function makeCanvas(width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(w, h);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
  throw new Error("This browser provides no way to work on images off-screen.");
}

function context2d(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false });
  if (!ctx) {
    throw new Error(
      "The browser refused to provide a drawing surface. This usually means the image " +
      "is too large for the memory available."
    );
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/* ---- Working out the target size ------------------------ */
/* mode: "pixels" | "percent" | "longest" | "shortest" | "width" | "height" */
export function targetSize(width, height, options) {
  const { mode = "longest", value = 1600, targetWidth, targetHeight, keepAspect = true, allowGrow = false } = options;
  let w = width;
  let h = height;

  if (mode === "percent") {
    const scale = Math.max(0.01, value / 100);
    w = width * scale;
    h = height * scale;
  } else if (mode === "longest") {
    const longest = Math.max(width, height);
    if (longest > value || allowGrow) {
      const scale = value / longest;
      w = width * scale;
      h = height * scale;
    }
  } else if (mode === "shortest") {
    const shortest = Math.min(width, height);
    if (shortest > value || allowGrow) {
      const scale = value / shortest;
      w = width * scale;
      h = height * scale;
    }
  } else if (mode === "width") {
    if (width > value || allowGrow) {
      const scale = value / width;
      w = value;
      h = keepAspect ? height * scale : height;
    }
  } else if (mode === "height") {
    if (height > value || allowGrow) {
      const scale = value / height;
      h = value;
      w = keepAspect ? width * scale : width;
    }
  } else if (mode === "pixels") {
    if (keepAspect) {
      const scale = Math.min(
        (targetWidth || width) / width,
        (targetHeight || height) / height
      );
      const use = allowGrow ? scale : Math.min(scale, 1);
      w = width * use;
      h = height * use;
    } else {
      w = targetWidth || width;
      h = targetHeight || height;
    }
  }

  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
    unchanged: Math.round(w) === width && Math.round(h) === height
  };
}

/* ---- Drawing, with quality-preserving step-down --------- */
function drawScaled(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  let current = source;
  let currentW = sourceWidth;
  let currentH = sourceHeight;
  let owned = false;

  /* Halve until one more halving would overshoot. */
  while (currentW / 2 >= targetWidth && currentH / 2 >= targetHeight && currentW > 2 && currentH > 2) {
    const nextW = Math.max(targetWidth, Math.floor(currentW / 2));
    const nextH = Math.max(targetHeight, Math.floor(currentH / 2));
    const step = makeCanvas(nextW, nextH);
    context2d(step).drawImage(current, 0, 0, currentW, currentH, 0, 0, nextW, nextH);
    if (owned && current.width) releaseCanvas(current);
    current = step;
    currentW = nextW;
    currentH = nextH;
    owned = true;
  }

  const out = makeCanvas(targetWidth, targetHeight);
  context2d(out).drawImage(current, 0, 0, currentW, currentH, 0, 0, targetWidth, targetHeight);
  if (owned) releaseCanvas(current);
  return out;
}

function releaseCanvas(canvas) {
  /* Setting a canvas to zero size is the reliable way to make a
     browser free its memory straight away, which matters when a
     batch runs through dozens of photographs. */
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch (err) { /* nothing to do */ }
}

/* ---- The operations ------------------------------------- */

/* Put a decoded bitmap onto a canvas, applying the photo's own
   rotation flag if the browser did not already do it. */
export function normalise(bitmap, orientation, orientationApplied) {
  if (orientationApplied || !orientation || orientation === 1) {
    const canvas = makeCanvas(bitmap.width, bitmap.height);
    context2d(canvas).drawImage(bitmap, 0, 0);
    return canvas;
  }
  const { w, h, transform } = orientationTransform(orientation, bitmap.width, bitmap.height);
  const canvas = makeCanvas(w, h);
  const ctx = context2d(canvas);
  ctx.setTransform(...transform);
  ctx.drawImage(bitmap, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

export function resize(canvas, options) {
  const size = targetSize(canvas.width, canvas.height, options);
  if (size.unchanged) return { canvas, size, changed: false };
  const out = drawScaled(canvas, canvas.width, canvas.height, size.width, size.height);
  return { canvas: out, size, changed: true };
}

export function crop(canvas, { x, y, width, height }) {
  const sx = Math.max(0, Math.round(x));
  const sy = Math.max(0, Math.round(y));
  const sw = Math.max(1, Math.min(Math.round(width), canvas.width - sx));
  const sh = Math.max(1, Math.min(Math.round(height), canvas.height - sy));
  const out = makeCanvas(sw, sh);
  context2d(out).drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/* degrees: any multiple of 90. flipH / flipV mirror the picture. */
export function rotate(canvas, { degrees = 0, flipH = false, flipV = false }) {
  const turns = ((Math.round(degrees / 90) % 4) + 4) % 4;
  if (!turns && !flipH && !flipV) return canvas;

  const swapped = turns === 1 || turns === 3;
  const w = swapped ? canvas.height : canvas.width;
  const h = swapped ? canvas.width : canvas.height;

  const out = makeCanvas(w, h);
  const ctx = context2d(out);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return out;
}

/* Straightening a scan: rotate by a small angle and grow the canvas
   so nothing is cut off. */
export function straighten(canvas, degrees, { background = null } = {}) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const w = Math.ceil(canvas.width * cos + canvas.height * sin);
  const h = Math.ceil(canvas.width * sin + canvas.height * cos);

  const out = makeCanvas(w, h);
  const ctx = context2d(out);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.translate(w / 2, h / 2);
  ctx.rotate(radians);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return out;
}

/* Flatten transparency onto a solid colour. Needed when saving a
   PNG with transparency as a JPEG, which has no transparency -
   otherwise transparent areas come out black, which surprises
   people. */
export function flatten(canvas, colour = "#ffffff") {
  const out = makeCanvas(canvas.width, canvas.height);
  const ctx = context2d(out);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/* Does this picture actually use transparency? Checked so we only
   warn when it matters. */
export function hasTransparency(canvas) {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const step = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 100));
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        if (data[(y * canvas.width + x) * 4 + 3] < 250) return true;
      }
    }
    return false;
  } catch (err) {
    /* If we cannot tell, assume it might, and warn rather than ruin. */
    return true;
  }
}

/* ---- Saving --------------------------------------------- */
export async function toBlob(canvas, format, quality) {
  const mime = mimeFor(format);
  const q = typeof quality === "number" ? Math.min(1, Math.max(0.01, quality / 100)) : undefined;

  let blob;
  if (typeof canvas.convertToBlob === "function") {
    blob = await canvas.convertToBlob({ type: mime, quality: q });
  } else {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, q));
  }

  if (!blob) {
    throw new Error(
      `The browser could not save the picture as ${format.toUpperCase()}. ` +
      `This usually means the image is too large for the memory available.`
    );
  }

  /* Browsers quietly hand back a PNG when asked for a format they
     cannot write. Saying so is better than delivering the wrong file
     under the right name. */
  if (blob.type && blob.type !== mime) {
    throw new Error(
      `This browser cannot save ${format.toUpperCase()} files — it produced ` +
      `${blob.type.replace("image/", "").toUpperCase()} instead. Choose a different format.`
    );
  }

  return blob;
}

export { releaseCanvas };

/* ---- Fitting a picture into an exact rectangle ----------- */
/* Three honest ways to make a picture exactly W by H, because there
   is no single right answer:

     "contain" - the whole picture is kept and the leftover space is
                 filled with a colour. Nothing is lost, but the shape
                 of the result is not the shape of the picture.
     "cover"   - the picture fills the rectangle and whatever hangs
                 over the edge is cut off. Nothing is distorted, but
                 something is lost.
     "stretch" - the picture is squashed to fit. Nothing is lost and
                 nothing is cropped, and it will look wrong.

   The tool says which of those is happening rather than picking one
   quietly. */
export function fitInto(canvas, {
  width, height, fit = "contain", background = "#ffffff", allowGrow = true
}) {
  const targetW = Math.max(1, Math.round(width));
  const targetH = Math.max(1, Math.round(height));
  const out = makeCanvas(targetW, targetH);
  const ctx = context2d(out);

  if (fit === "stretch") {
    /* Stretching to an exact rectangle IS enlarging when the
       rectangle is bigger, and there is no way to do it without.
       The caller says so in its notes. */
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
    return out;
  }

  /* Both of the remaining fits need a background: "contain" always
     leaves space, and "cover" leaves space too once enlarging is
     refused and the picture is smaller than the rectangle. */
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  let scale = fit === "cover"
    ? Math.max(targetW / canvas.width, targetH / canvas.height)
    : Math.min(targetW / canvas.width, targetH / canvas.height);

  /* "Allow enlarging" means what it says, whichever fit is chosen.
     Without this, asking a small picture for a big exact size blew it
     up regardless of the setting - which is the one thing that
     setting exists to prevent. */
  if (!allowGrow && scale > 1) scale = 1;

  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  /* Centred: the middle of a photograph is usually the subject. */
  ctx.drawImage(canvas, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);
  return out;
}

/* ---- Sharpening ------------------------------------------ */
/* Making a picture smaller always softens it: several pixels are
   averaged into one, and averaging blurs. This puts some of the
   edge definition back using an unsharp mask - the same idea a
   darkroom used, and what every photo editor means by "sharpen".

   amount is 0 to 100. Anything above about 60 starts to look
   crunchy and to ring around high-contrast edges, which is why the
   tool warns rather than letting it run to 100 quietly. */
export function sharpen(canvas, amount) {
  const strength = Math.max(0, Math.min(100, amount)) / 100;
  if (!strength) return canvas;

  const ctx = context2d(canvas);
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const src = image.data;
  const out = new Uint8ClampedArray(src);

  /* A small blur to subtract from the original. */
  const blurred = new Float32Array(width * height * 3);
  const at = (x, y, c) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    return src[(cy * width + cx) * 4 + c];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        /* A 3x3 tent, which is enough to find edges and cheap. */
        const sum =
          at(x - 1, y - 1, c) + 2 * at(x, y - 1, c) + at(x + 1, y - 1, c) +
          2 * at(x - 1, y, c) + 4 * at(x, y, c) + 2 * at(x + 1, y, c) +
          at(x - 1, y + 1, c) + 2 * at(x, y + 1, c) + at(x + 1, y + 1, c);
        blurred[(y * width + x) * 3 + c] = sum / 16;
      }
    }
  }

  /* original + strength * (original - blurred) */
  for (let i = 0, p = 0; i < src.length; i += 4, p += 3) {
    for (let c = 0; c < 3; c++) {
      const original = src[i + c];
      out[i + c] = original + strength * 1.5 * (original - blurred[p + c]);
    }
    out[i + 3] = src[i + 3];
  }

  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  return canvas;
}

/* ---- Saving to a size limit ------------------------------ */
/* "Get it under 500 KB" is a real thing people need - mail servers,
   upload forms and messaging apps all have limits. There is no way
   to ask an encoder for a size, so this searches for the quality
   that lands just under, by halving the range each time.

   It reports what it actually achieved rather than pretending. */
export async function toBlobUnder(canvas, format, targetBytes, {
  /* The floor is low on purpose. A quality of 15 does not look good,
     but somebody who says "this must be under 80 KB" usually means
     it, and the tool reports the quality it settled on so the result
     can be judged rather than guessed at. */
  minQuality = 15,
  maxQuality = 95,
  attempts = 8
} = {}) {
  /* PNG has no quality dial, so there is nothing to search. */
  if (format === "png") {
    const blob = await toBlob(canvas, format);
    return { blob, quality: null, attemptsMade: 1, met: blob.size <= targetBytes, searchable: false };
  }

  let low = minQuality;
  let high = maxQuality;
  let best = null;
  let bestQuality = null;
  let made = 0;

  /* Try the best quality first: if that already fits, take it. */
  const first = await toBlob(canvas, format, high);
  made++;
  if (first.size <= targetBytes) {
    return { blob: first, quality: high, attemptsMade: made, met: true, searchable: true };
  }

  for (let i = 0; i < attempts && low <= high; i++) {
    const middle = Math.round((low + high) / 2);
    const blob = await toBlob(canvas, format, middle);
    made++;

    if (blob.size <= targetBytes) {
      best = blob;
      bestQuality = middle;
      low = middle + 1;        /* try for better quality */
    } else {
      high = middle - 1;       /* too big, try lower */
    }
  }

  if (best) {
    return { blob: best, quality: bestQuality, attemptsMade: made, met: true, searchable: true };
  }

  /* Nothing fitted, so hand back the smallest that could be made and
     say plainly that the limit was not reached. */
  const smallest = await toBlob(canvas, format, minQuality);
  made++;
  return { blob: smallest, quality: minQuality, attemptsMade: made, met: false, searchable: true };
}
