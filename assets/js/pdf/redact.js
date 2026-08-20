/* ============================================================
   On Device - redaction that actually redacts

   THE WHOLE POINT OF THIS FILE.

   Almost every "redact PDF" tool draws a black rectangle on top
   of the words. The words are still in the file. Anyone can
   select the text underneath, copy it out, or open the file in a
   text editor and read it. Newspapers, courts and governments
   have all published documents redacted that way and had the
   hidden text extracted within hours.

   This does it properly, and the method is deliberately blunt:

   1. Draw the black boxes onto a picture of the page.
   2. Throw the original page away entirely.
   3. Rebuild the document using that picture.

   The result is that the redacted content does not exist in the
   output file in any form. Not hidden, not covered - gone.

   The cost is real and is stated on the tool page: a redacted
   page becomes a picture, so its text can no longer be selected
   or searched. Pages with no redactions are left untouched, so
   only what you marked pays that price.
   ============================================================ */

import { openForReading, newDocument, PdfError } from "./doc.js";
import { renderPage, scaleForDpi } from "./render.js";
import { makeCanvas, toBlob, releaseCanvas } from "../image/ops.js";
import { loadPdfEngine } from "./loader.js";

/* Redactions arrive as fractions of the page, so they mean the same
   thing whatever resolution the page is drawn at.
   { page: 1, x: 0.1, y: 0.2, w: 0.3, h: 0.05 } */

export async function redact(file, {
  name = "document.pdf",
  password = "",
  boxes = [],
  dpi = 200,
  colour = "#000000",
  onProgress = () => {},
  shouldStop = () => false
} = {}) {
  if (!boxes.length) {
    throw new PdfError(
      "No areas were marked, so there is nothing to redact. Drag over the parts you " +
      "want destroyed.",
      "nothing-marked"
    );
  }

  const { pdfLib } = await loadPdfEngine();
  const reader = await openForReading(file, { password });

  /* Which pages are affected? Only those get turned into pictures. */
  const byPage = new Map();
  for (const box of boxes) {
    if (!byPage.has(box.page)) byPage.set(box.page, []);
    byPage.get(box.page).push(box);
  }

  const sourceForCopying = await loadForCopying(file, password, pdfLib);
  const untouched = [];
  const rasterised = [];

  /* Built in ONE pass, in page order.

     An earlier version assembled the redacted pages in one document and
     then tried to re-embed them into another. Pages cannot be embedded
     across documents that way, and the result was a completely blank
     page where the redacted one should have been - the content silently
     destroyed rather than the marked area. Caught by rendering the
     output and counting the ink on it. Building in a single pass avoids
     the whole problem. */
  const out = await newDocument();

  try {
    const count = reader.numPages;
    const scale = scaleForDpi(dpi);

    for (let n = 1; n <= count; n++) {
      if (shouldStop()) break;

      const pageBoxes = byPage.get(n);

      /* No marks on this page: copy it across exactly as it was. */
      if (!pageBoxes || !pageBoxes.length) {
        if (sourceForCopying) {
          const [copiedPage] = await out.copyPages(sourceForCopying, [n - 1]);
          out.addPage(copiedPage);
          untouched.push(n);
          onProgress(n / count);
          continue;
        }
        /* An encrypted source cannot be copied from, so this page has to
           be redrawn as a picture too. It is not redacted, only
           re-rendered - and the caller is told. */
      }

      const page = await reader.getPage(n);
      try {
        const unit = page.getViewport({ scale: 1 });
        const canvas = await renderPage(page, { scale, background: "#ffffff" });
        const ctx = canvas.getContext("2d");

        /* Paint the boxes onto the picture. From here the covered
           pixels are the only version that exists. */
        if (pageBoxes && pageBoxes.length) {
          ctx.fillStyle = colour;
          for (const box of pageBoxes) {
            ctx.fillRect(
              Math.floor(box.x * canvas.width),
              Math.floor(box.y * canvas.height),
              Math.ceil(box.w * canvas.width),
              Math.ceil(box.h * canvas.height)
            );
          }
        }

        /* JPEG would leave faint compression ghosts around a hard black
           edge. PNG is exact, which is what redaction needs. */
        const blob = await toBlob(canvas, "png");
        releaseCanvas(canvas);

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const image = await out.embedPng(bytes);
        const sheet = out.addPage([unit.width, unit.height]);
        sheet.drawImage(image, { x: 0, y: 0, width: unit.width, height: unit.height });

        if (pageBoxes && pageBoxes.length) rasterised.push(n);
        else untouched.push(n);
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

  return {
    doc: out,
    rasterisedPages: rasterised,
    untouchedPages: untouched,
    boxCount: boxes.length,
    everythingRedrawn: !sourceForCopying
  };
}

/* pdf-lib needs its own copy of the source to lift untouched pages from. */
async function loadForCopying(file, password, pdfLib) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (err) {
    /* An encrypted document cannot be copied from, so every page has to
       be rasterised instead. The caller handles that by finding no
       untouched pages to restore. */
    return null;
  }
}

/* ---- Proving it worked ---------------------------------- */
/* After redacting, we read the text back out of the finished file and
   check the words that were meant to disappear are actually gone.
   A redaction tool that cannot demonstrate this is asking to be
   believed, which is the thing this whole site refuses to do. */
export async function verifyRemoved(resultBlob, phrases, { password = "" } = {}) {
  if (!phrases || !phrases.length) return { checked: 0, stillPresent: [] };

  const doc = await openForReading(resultBlob, { password });
  let all = "";
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        for (const item of content.items) all += (item.str || "") + " ";
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  const haystack = all.toLowerCase();
  const stillPresent = phrases.filter((p) => p && haystack.includes(String(p).toLowerCase()));

  return { checked: phrases.length, stillPresent, textLength: all.length };
}
