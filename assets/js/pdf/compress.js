/* ============================================================
   On Device - making a PDF smaller

   Read this bit, because it is the honest part.

   There are two ways to shrink a PDF, and they are not the same:

   1. TIDY. Rewrite the file's internal structure more compactly
      and throw away anything unused. Completely safe - the text
      stays selectable, the quality is untouched - but the saving
      is usually small, often only a few per cent.

   2. FLATTEN. Draw every page as a picture at a chosen
      resolution and build a new PDF out of those pictures. The
      saving can be enormous on a scanned or image-heavy
      document. But the text stops being text: it can no longer
      be selected, searched or copied, and it will look softer if
      you zoom in.

   Most sites do the second and call it "compression" without
   mentioning what you lost. On Device offers both, explains the
   difference before you choose, and shows the real size of each.
   ============================================================ */

import { openForWriting, newDocument, PdfError } from "./doc.js";
import { openForReading } from "./doc.js";
import { renderPage, scaleForDpi } from "./render.js";
import { toBlob, releaseCanvas } from "../image/ops.js";

/* ---- The safe one: rewrite, lose nothing ---------------- */
export async function tidy(file, { name = "document.pdf" } = {}) {
  const doc = await openForWriting(file, { name });
  const bytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false
  });
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    lossless: true,
    originalSize: file.size,
    newSize: bytes.length
  };
}

/* ---- The drastic one: pages become pictures ------------- */
export async function flattenToImages(file, {
  name = "document.pdf",
  password = "",
  dpi = 120,
  quality = 70,
  format = "jpg",
  onProgress = () => {},
  shouldStop = () => false
} = {}) {
  const reader = await openForReading(file, { password });
  const out = await newDocument();

  try {
    const count = reader.numPages;
    const scale = scaleForDpi(dpi);

    for (let n = 1; n <= count; n++) {
      if (shouldStop()) break;
      const page = await reader.getPage(n);
      try {
        const unit = page.getViewport({ scale: 1 });
        const canvas = await renderPage(page, { scale, background: "#ffffff" });
        const blob = await toBlob(canvas, format, quality);
        releaseCanvas(canvas);

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const image = format === "png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);

        /* Keep the page the same physical size as the original, so it
           still prints correctly - only the detail changes. */
        const sheet = out.addPage([unit.width, unit.height]);
        sheet.drawImage(image, { x: 0, y: 0, width: unit.width, height: unit.height });
      } finally {
        page.cleanup();
      }
      onProgress(n / count);
    }
  } finally {
    await reader.destroy();
  }

  if (out.getPageCount() === 0) {
    throw new PdfError("No pages were produced, so there is nothing to save.", "empty");
  }

  const bytes = await out.save({ useObjectStreams: true });
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    lossless: false,
    originalSize: file.size,
    newSize: bytes.length,
    pages: out.getPageCount()
  };
}

/* ---- Does this document have selectable text? ----------- */
/* Worth knowing before flattening, because that is exactly what
   flattening destroys. A scan has no text to lose; a contract does. */
export async function hasSelectableText(file, { password = "", sample = 5 } = {}) {
  const doc = await openForReading(file, { password });
  try {
    const limit = Math.min(sample, doc.numPages);
    let characters = 0;
    for (let n = 1; n <= limit; n++) {
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        for (const item of content.items) characters += (item.str || "").trim().length;
      } finally {
        page.cleanup();
      }
      if (characters > 200) break;
    }
    return {
      hasText: characters > 40,
      characters,
      pagesChecked: limit
    };
  } finally {
    await doc.destroy();
  }
}
