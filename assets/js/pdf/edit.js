/* ============================================================
   On Device - rearranging PDFs

   Merging, splitting, reordering, rotating and cropping. All of it
   copies pages from one document into another rather than editing
   in place, which is why the original file you loaded is never
   touched.
   ============================================================ */

import { openForWriting, newDocument, save, pageSize, PdfError } from "./doc.js";
import { loadPdfEngine } from "./loader.js";

/* ---- Merge ---------------------------------------------- */
/* sources: [{ file, name, pages }] - pages optional, one-based.
   Images are placed on a page of their own. */
export async function merge(sources, {
  imagePageSize = "a4",
  imageOrientation = "auto",
  imageMargin = 0,
  onProgress = () => {}
} = {}) {
  const { pdfLib } = await loadPdfEngine();
  const out = await newDocument();
  const notes = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    onProgress(i / sources.length);

    if (source.kind === "image" || source.kind === "heic") {
      await addImagePage(out, pdfLib, source, { imagePageSize, imageOrientation, imageMargin, notes });
      continue;
    }

    const doc = await openForWriting(source.file, { name: source.name });
    const total = doc.getPageCount();
    const wanted = source.pages && source.pages.length
      ? source.pages.filter((n) => n >= 1 && n <= total).map((n) => n - 1)
      : Array.from({ length: total }, (_, n) => n);

    if (!wanted.length) {
      notes.push(`“${source.name}” contributed no pages, because none were selected.`);
      continue;
    }

    const copied = await out.copyPages(doc, wanted);
    for (const page of copied) out.addPage(page);
  }

  if (out.getPageCount() === 0) {
    throw new PdfError(
      "Nothing was added, so there is no document to save. Choose at least one PDF or image.",
      "empty"
    );
  }

  onProgress(1);
  return { doc: out, notes };
}

/* Put one picture on its own page. */
async function addImagePage(out, pdfLib, source, { imagePageSize, imageOrientation, imageMargin, notes }) {
  const bytes = new Uint8Array(await source.file.arrayBuffer());
  let image;

  try {
    if (source.format === "png") image = await out.embedPng(bytes);
    else if (source.format === "jpg") image = await out.embedJpg(bytes);
    else {
      throw new PdfError(
        `“${source.name}” is a ${String(source.format).toUpperCase()} image. A PDF can only ` +
        `carry JPEG and PNG pictures directly, so convert it first — the Convert tool does ` +
        `that, and it also runs on this device.`,
        "unsupported-image"
      );
    }
  } catch (err) {
    if (err instanceof PdfError) throw err;
    throw new PdfError(
      `“${source.name}” could not be placed into the PDF: ${err && err.message ? err.message : err}`,
      "bad-image"
    );
  }

  let width;
  let height;
  if (imagePageSize === "match") {
    width = image.width;
    height = image.height;
  } else {
    const orientation = imageOrientation === "auto"
      ? (image.width > image.height ? "landscape" : "portrait")
      : imageOrientation;
    const size = pageSize(imagePageSize, orientation);
    width = size.width;
    height = size.height;
  }

  const page = out.addPage([width, height]);
  const margin = Math.max(0, imageMargin);
  const boxWidth = Math.max(1, width - margin * 2);
  const boxHeight = Math.max(1, height - margin * 2);
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  page.drawImage(image, {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  });
}

/* ---- Images to PDF -------------------------------------- */
export async function imagesToPdf(images, options = {}) {
  const { doc, notes } = await merge(
    images.map((i) => ({ ...i, kind: "image" })),
    options
  );
  return { doc, notes };
}

/* ---- Extract a selection of pages ----------------------- */
export async function extractPages(file, pages, { name = "document.pdf" } = {}) {
  const doc = await openForWriting(file, { name });
  const total = doc.getPageCount();
  const wanted = pages.filter((n) => n >= 1 && n <= total).map((n) => n - 1);

  if (!wanted.length) {
    throw new PdfError(
      `None of the pages you chose exist in “${name}”, which has ${total} ` +
      `page${total === 1 ? "" : "s"}.`,
      "no-pages"
    );
  }

  const out = await newDocument();
  const copied = await out.copyPages(doc, wanted);
  for (const page of copied) out.addPage(page);
  return out;
}

/* ---- Split into several documents ----------------------- */
/* mode: "every" (every N pages) | "burst" (one file per page)
         | "ranges" (a list of page lists) */
export async function split(file, {
  mode = "burst",
  everyN = 1,
  ranges = [],
  name = "document.pdf",
  onProgress = () => {}
} = {}) {
  const doc = await openForWriting(file, { name });
  const total = doc.getPageCount();

  let groups = [];
  if (mode === "burst") {
    groups = Array.from({ length: total }, (_, i) => [i + 1]);
  } else if (mode === "every") {
    const size = Math.max(1, Math.floor(everyN));
    for (let start = 1; start <= total; start += size) {
      const group = [];
      for (let n = start; n < start + size && n <= total; n++) group.push(n);
      groups.push(group);
    }
  } else {
    groups = ranges.filter((g) => g && g.length);
  }

  if (!groups.length) {
    throw new PdfError("No pages were selected, so there is nothing to split out.", "no-pages");
  }

  const results = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const out = await newDocument();
    const copied = await out.copyPages(doc, group.map((n) => n - 1));
    for (const page of copied) out.addPage(page);
    results.push({ doc: out, pages: group });
    onProgress((i + 1) / groups.length);
  }

  return { results, totalPages: total };
}

/* ---- Organise: an explicit new order -------------------- */
/* order: [{ from: 3, rotate: 90 }, ...] - "from" is one-based and may
   repeat, which duplicates that page. Anything left out is dropped. */
export async function reorder(file, order, { name = "document.pdf" } = {}) {
  await prepare();
  const doc = await openForWriting(file, { name });
  const total = doc.getPageCount();

  const valid = order.filter((o) => o.from >= 1 && o.from <= total);
  if (!valid.length) {
    throw new PdfError(
      "Every page has been removed, so there would be nothing left to save.",
      "no-pages"
    );
  }

  const out = await newDocument();
  const copied = await out.copyPages(doc, valid.map((o) => o.from - 1));
  copied.forEach((page, i) => {
    const turn = valid[i].rotate || 0;
    if (turn) {
      const current = page.getRotation().angle || 0;
      page.setRotation(degreesOf(((current + turn) % 360 + 360) % 360));
    }
    out.addPage(page);
  });

  return out;
}

let degreesFn = null;
function degreesOf(angle) {
  /* pdf-lib wants its own Degrees object. */
  if (!degreesFn) throw new Error("The PDF engine was used before it finished loading.");
  return degreesFn(angle);
}

/* Captured once the engine is available. */
export async function prepare() {
  const { pdfLib } = await loadPdfEngine();
  degreesFn = pdfLib.degrees;
  return true;
}

/* ---- Rotate every page (or some of them) ---------------- */
export async function rotatePages(file, {
  degrees: turn = 90,
  pages = null,
  name = "document.pdf"
} = {}) {
  await prepare();
  const doc = await openForWriting(file, { name });
  const all = doc.getPages();
  const wanted = pages && pages.length ? new Set(pages) : null;

  all.forEach((page, index) => {
    if (wanted && !wanted.has(index + 1)) return;
    const current = page.getRotation().angle || 0;
    page.setRotation(degreesOf(((current + turn) % 360 + 360) % 360));
  });

  return doc;
}

/* ---- Crop ----------------------------------------------- */
/* margins are fractions of the page, trimmed from each edge. */
export async function cropPages(file, {
  margins = { top: 0, right: 0, bottom: 0, left: 0 },
  pages = null,
  name = "document.pdf"
} = {}) {
  const doc = await openForWriting(file, { name });
  const all = doc.getPages();
  const wanted = pages && pages.length ? new Set(pages) : null;
  let changed = 0;

  all.forEach((page, index) => {
    if (wanted && !wanted.has(index + 1)) return;

    const { width, height } = page.getSize();
    const left = width * clamp01(margins.left);
    const right = width * clamp01(margins.right);
    const top = height * clamp01(margins.top);
    const bottom = height * clamp01(margins.bottom);

    const newWidth = width - left - right;
    const newHeight = height - top - bottom;
    if (newWidth < 10 || newHeight < 10) {
      throw new PdfError(
        `Those margins would leave almost nothing of page ${index + 1}. ` +
        `Trim less than the full width or height.`,
        "over-cropped"
      );
    }

    /* The crop box is expressed against the page's own coordinates,
       which start at the bottom-left corner. */
    const box = page.getMediaBox();
    page.setCropBox(box.x + left, box.y + bottom, newWidth, newHeight);
    changed++;
  });

  if (!changed) {
    throw new PdfError("No pages were selected, so nothing was cropped.", "no-pages");
  }

  return doc;
}

function clamp01(v) {
  const n = Number(v) || 0;
  return Math.min(0.9, Math.max(0, n));
}

export { save };
