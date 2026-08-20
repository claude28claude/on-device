/* ============================================================
   On Device - drawing PDF pages

   Used for the page thumbnails the editing tools show, and for
   exporting pages as pictures. Both go through the same path so
   what you see in a thumbnail is what you get in the export.
   ============================================================ */

import { openForReading } from "./doc.js";
import { makeCanvas, toBlob, releaseCanvas } from "../image/ops.js";

/* PDFs measure in points, 72 to the inch, so the scale needed for a
   given resolution is simply dpi / 72. */
export function scaleForDpi(dpi) {
  return Math.max(0.05, dpi / 72);
}

/* Work out the pixel size a page will come out at, using exactly the
   same arithmetic the renderer uses. Anything that shows a size to the
   visitor must call this, so an estimate can never disagree with the
   file that actually arrives. */
export function pixelSizeFor(pointsWide, pointsTall, dpi) {
  const scale = scaleForDpi(dpi);
  return {
    width: Math.max(1, Math.floor(pointsWide * scale)),
    height: Math.max(1, Math.floor(pointsTall * scale))
  };
}

/* Render one already-open page onto a fresh canvas. */
export async function renderPage(page, { scale = 1, background = "#ffffff" } = {}) {
  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.floor(viewport.width));
  const height = Math.max(1, Math.floor(viewport.height));

  /* A very large page at a high resolution can ask for more memory than
     the browser will give. Saying so beats a blank image. */
  const pixels = width * height;
  if (pixels > 80e6) {
    throw new Error(
      `That page would come out ${width} x ${height} pixels, which is too large for ` +
      `a browser to draw in one piece. Choose a lower resolution.`
    );
  }

  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");

  /* PDF pages are transparent by default; most people expect paper. */
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  await page.render({ canvasContext: ctx, viewport, background: "rgba(0,0,0,0)" }).promise;
  return canvas;
}

/* Small pictures of every page, for the page-picking interfaces.
   Rendered one at a time and released as we go, so a 400-page
   document does not sit in memory all at once. */
export async function renderThumbnails(file, {
  password = "",
  maxWidth = 150,
  pages = null,
  onProgress = () => {},
  shouldStop = () => false
} = {}) {
  const doc = await openForReading(file, { password });
  const out = [];
  try {
    const numbers = pages || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    for (let i = 0; i < numbers.length; i++) {
      if (shouldStop()) break;
      const n = numbers[i];
      const page = await doc.getPage(n);
      try {
        const unit = page.getViewport({ scale: 1 });
        const scale = Math.min(maxWidth / unit.width, 1.5);
        const canvas = await renderPage(page, { scale });
        const blob = await toBlob(canvas, "png");
        releaseCanvas(canvas);
        out.push({
          number: n,
          url: URL.createObjectURL(blob),
          width: Math.round(unit.width),
          height: Math.round(unit.height),
          rotation: page.rotate || 0
        });
      } finally {
        page.cleanup();
      }
      onProgress((i + 1) / numbers.length);
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

export function releaseThumbnails(thumbs) {
  for (const t of thumbs || []) {
    if (t && t.url) URL.revokeObjectURL(t.url);
  }
}

/* Full-size export of chosen pages as pictures. */
export async function pagesToImages(file, {
  password = "",
  dpi = 150,
  format = "png",
  quality = 90,
  pages = null,
  background = "#ffffff",
  onProgress = () => {},
  shouldStop = () => false
} = {}) {
  const doc = await openForReading(file, { password });
  const results = [];
  try {
    const numbers = pages || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const scale = scaleForDpi(dpi);

    for (let i = 0; i < numbers.length; i++) {
      if (shouldStop()) break;
      const n = numbers[i];
      const page = await doc.getPage(n);
      try {
        const canvas = await renderPage(page, {
          scale,
          background: format === "png" ? background : "#ffffff"
        });
        const blob = await toBlob(canvas, format, quality);
        results.push({ number: n, blob, width: canvas.width, height: canvas.height });
        releaseCanvas(canvas);
      } finally {
        page.cleanup();
      }
      onProgress((i + 1) / numbers.length);
    }
  } finally {
    await doc.destroy();
  }
  return results;
}

/* Pull the selectable text out of a document. Returns null where a
   page genuinely has none, so the caller can tell the difference
   between "empty page" and "scanned picture of text". */
export async function extractText(file, {
  password = "",
  pages = null,
  onProgress = () => {},
  shouldStop = () => false
} = {}) {
  const doc = await openForReading(file, { password });
  const out = [];
  try {
    const numbers = pages || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    for (let i = 0; i < numbers.length; i++) {
      if (shouldStop()) break;
      const n = numbers[i];
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        /* Rebuild lines by watching where the text jumps down the page. */
        let text = "";
        let lastY = null;
        for (const item of content.items) {
          if (!item.str) continue;
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) text += "\n";
          text += item.str;
          if (item.hasEOL) text += "\n";
          lastY = y;
        }
        out.push({ number: n, text: text.trim() });
      } finally {
        page.cleanup();
      }
      onProgress((i + 1) / numbers.length);
    }
  } finally {
    await doc.destroy();
  }
  return out;
}
