/* ============================================================
   On Device - hiding part of a picture, permanently

   For faces, number plates, addresses, and screenshots of
   private messages.

   The important detail: this does not draw a blurred layer on
   top of the original. It replaces those pixels and then saves a
   new picture from the result, so the original detail is not in
   the output file at all.

   A warning worth taking seriously: a light blur can sometimes
   be undone. Blurring is a mathematical operation, and if the
   detail is still faintly present, software can sometimes work
   backwards - this has been done to recover faces and to read
   blurred text. Pixelation at a coarse enough size and a solid
   block are both safe. The tool says so, and defaults to a
   strength where it does not matter.
   ============================================================ */

import { makeCanvas, releaseCanvas } from "./ops.js";

function contextOf(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("The browser refused to provide a drawing surface.");
  return ctx;
}

/* ---- Pixelate ------------------------------------------- */
/* Averages each block down to one colour and paints it back. The
   detail inside a block is discarded, not hidden. */
export function pixelateRegion(canvas, { x, y, w, h, blockSize = 16 }) {
  const ctx = contextOf(canvas);
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.min(Math.ceil(w), canvas.width - sx);
  const sh = Math.min(Math.ceil(h), canvas.height - sy);
  if (sw <= 0 || sh <= 0) return;

  const block = Math.max(2, Math.floor(blockSize));
  const image = ctx.getImageData(sx, sy, sw, sh);
  const data = image.data;

  for (let by = 0; by < sh; by += block) {
    for (let bx = 0; bx < sw; bx += block) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;

      const maxY = Math.min(by + block, sh);
      const maxX = Math.min(bx + block, sw);

      for (let py = by; py < maxY; py++) {
        for (let px = bx; px < maxX; px++) {
          const i = (py * sw + px) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          n++;
        }
      }

      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);
      a = Math.round(a / n);

      for (let py = by; py < maxY; py++) {
        for (let px = bx; px < maxX; px++) {
          const i = (py * sw + px) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(image, sx, sy);
}

/* ---- Blur ----------------------------------------------- */
/* Uses the browser's own blur, applied by drawing the region back
   over itself through a filter, then writing the result down. */
export function blurRegion(canvas, { x, y, w, h, radius = 12 }) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.min(Math.ceil(w), canvas.width - sx);
  const sh = Math.min(Math.ceil(h), canvas.height - sy);
  if (sw <= 0 || sh <= 0) return;

  /* Blur the region on its own surface, with a margin so the edges do
     not pull in white from outside the region. */
  const pad = Math.ceil(radius * 2);
  const temp = makeCanvas(sw + pad * 2, sh + pad * 2);
  const tctx = contextOf(temp);

  tctx.drawImage(
    canvas,
    Math.max(0, sx - pad),
    Math.max(0, sy - pad),
    Math.min(sw + pad * 2, canvas.width),
    Math.min(sh + pad * 2, canvas.height),
    0,
    0,
    sw + pad * 2,
    sh + pad * 2
  );

  const blurred = makeCanvas(sw + pad * 2, sh + pad * 2);
  const bctx = contextOf(blurred);
  bctx.filter = `blur(${radius}px)`;
  bctx.drawImage(temp, 0, 0);
  bctx.filter = "none";

  const ctx = contextOf(canvas);
  ctx.drawImage(blurred, pad, pad, sw, sh, sx, sy, sw, sh);

  releaseCanvas(temp);
  releaseCanvas(blurred);
}

/* ---- Solid block ---------------------------------------- */
/* The one that cannot be undone by anybody, ever. */
export function blockRegion(canvas, { x, y, w, h, colour = "#000000" }) {
  const ctx = contextOf(canvas);
  ctx.fillStyle = colour;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

/* ---- Apply a list of regions ---------------------------- */
export function applyRegions(canvas, regions, { method = "pixelate", strength = 16, colour = "#000000" }) {
  for (const region of regions) {
    const box = {
      x: region.x * canvas.width,
      y: region.y * canvas.height,
      w: region.w * canvas.width,
      h: region.h * canvas.height
    };
    if (method === "block") blockRegion(canvas, { ...box, colour });
    else if (method === "blur") blurRegion(canvas, { ...box, radius: strength });
    else pixelateRegion(canvas, { ...box, blockSize: strength });
  }
  return canvas;
}

/* How safe is this setting, honestly? */
export function judgeMethod(method, strength, regionSizePx) {
  if (method === "block") {
    return {
      safe: true,
      text: "A solid block cannot be undone by anyone. This is the safest choice."
    };
  }

  /* Rough guide: the obscuring feature should be a decent fraction of
     the thing being hidden. */
  const relative = regionSizePx ? strength / Math.max(8, Math.min(regionSizePx, 400)) : 0;

  if (method === "pixelate") {
    if (strength >= 20 || relative > 0.12) {
      return {
        safe: true,
        text:
          `Blocks of ${strength} pixels. Coarse enough that the detail underneath is ` +
          `genuinely averaged away.`
      };
    }
    return {
      safe: false,
      text:
        `Blocks of only ${strength} pixels. Fine pixelation over text has been ` +
        `reversed before by trying every possibility and comparing. Use 20 or more, ` +
        `or a solid block.`
    };
  }

  if (strength >= 20 || relative > 0.15) {
    return {
      safe: true,
      text: `A blur radius of ${strength} pixels. Strong enough for this region.`
    };
  }
  return {
    safe: false,
    text:
      `A blur radius of only ${strength} pixels. Light blurring can sometimes be ` +
      `reversed by software. For anything that matters use a solid block, or turn ` +
      `this up past 20.`
  };
}
