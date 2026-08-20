/* ============================================================
   On Device - marking up a PDF

   Watermarks, page numbers, headers and footers, flattening, and
   putting several pages onto one sheet.

   All of it draws onto a copy. The file you loaded is never
   modified.
   ============================================================ */

import { openForWriting, newDocument, PdfError, pageSize } from "./doc.js";
import { loadPdfEngine } from "./loader.js";

/* pdf-lib ships the fourteen typefaces every PDF reader must have,
   so no font is ever downloaded. */
export const FONTS = {
  helvetica: "Helvetica",
  helveticaBold: "Helvetica-Bold",
  times: "Times-Roman",
  timesBold: "Times-Bold",
  courier: "Courier",
  courierBold: "Courier-Bold"
};

async function engine() {
  const { pdfLib } = await loadPdfEngine();
  return pdfLib;
}

function hexToRgbUnit(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  };
}

/* ---- Watermark ------------------------------------------ */
export async function watermark(file, {
  name = "document.pdf",
  text = "",
  imageFile = null,
  imageFormat = "png",
  fontSize = 48,
  colour = "#ff0000",
  opacity = 0.25,
  rotation = 45,
  position = "centre",
  tile = false,
  pages = null
} = {}) {
  const pdfLib = await engine();
  const doc = await openForWriting(file, { name });
  const all = doc.getPages();
  const wanted = pages && pages.length ? new Set(pages) : null;

  let font = null;
  let image = null;

  if (imageFile) {
    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    if (imageFormat === "png") image = await doc.embedPng(bytes);
    else if (imageFormat === "jpg") image = await doc.embedJpg(bytes);
    else {
      throw new PdfError(
        `A watermark picture has to be a PNG or a JPEG. This one is ` +
        `${String(imageFormat).toUpperCase()} — convert it first.`,
        "unsupported-image"
      );
    }
  } else {
    if (!text.trim()) {
      throw new PdfError("Type some watermark text, or choose a picture.", "empty");
    }
    font = await doc.embedFont(pdfLib.StandardFonts.HelveticaBold);
  }

  const rgb = hexToRgbUnit(colour);

  all.forEach((page, index) => {
    if (wanted && !wanted.has(index + 1)) return;
    const { width, height } = page.getSize();

    const drawOne = (x, y) => {
      if (image) {
        const scale = Math.min(width / image.width, height / image.height) * 0.4;
        page.drawImage(image, {
          x: x - (image.width * scale) / 2,
          y: y - (image.height * scale) / 2,
          width: image.width * scale,
          height: image.height * scale,
          opacity,
          rotate: pdfLib.degrees(rotation)
        });
      } else {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        page.drawText(text, {
          x: x - textWidth / 2,
          y: y - fontSize / 2,
          size: fontSize,
          font,
          color: pdfLib.rgb(rgb.r, rgb.g, rgb.b),
          opacity,
          rotate: pdfLib.degrees(rotation)
        });
      }
    };

    if (tile) {
      const stepX = width / 3;
      const stepY = height / 4;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          drawOne(stepX * (col + 0.5), stepY * (row + 0.5));
        }
      }
    } else {
      const spots = {
        centre: [width / 2, height / 2],
        top: [width / 2, height * 0.85],
        bottom: [width / 2, height * 0.15],
        "top-left": [width * 0.25, height * 0.85],
        "top-right": [width * 0.75, height * 0.85],
        "bottom-left": [width * 0.25, height * 0.15],
        "bottom-right": [width * 0.75, height * 0.15]
      };
      const [x, y] = spots[position] || spots.centre;
      drawOne(x, y);
    }
  });

  return doc;
}

/* ---- Page numbers, headers and footers ------------------ */
export async function addPageNumbers(file, {
  name = "document.pdf",
  format = "{n}",
  startAt = 1,
  skipFirst = false,
  position = "bottom-centre",
  fontSize = 11,
  colour = "#333333",
  fontId = "helvetica",
  headerText = "",
  margin = 36
} = {}) {
  const pdfLib = await engine();
  const doc = await openForWriting(file, { name });
  const all = doc.getPages();

  const fontName = {
    helvetica: pdfLib.StandardFonts.Helvetica,
    helveticaBold: pdfLib.StandardFonts.HelveticaBold,
    times: pdfLib.StandardFonts.TimesRoman,
    timesBold: pdfLib.StandardFonts.TimesRomanBold,
    courier: pdfLib.StandardFonts.Courier,
    courierBold: pdfLib.StandardFonts.CourierBold
  }[fontId] || pdfLib.StandardFonts.Helvetica;

  const font = await doc.embedFont(fontName);
  const rgb = hexToRgbUnit(colour);
  const total = all.length;

  all.forEach((page, index) => {
    if (skipFirst && index === 0) return;
    const { width, height } = page.getSize();
    const number = startAt + index - (skipFirst ? 1 : 0);

    const label = String(format)
      .replace(/\{n\}/g, String(number))
      .replace(/\{total\}/g, String(total - (skipFirst ? 1 : 0)))
      .replace(/\{name\}/g, String(name).replace(/\.[^.]+$/, ""));

    const draw = (value, atTop) => {
      if (!value) return;
      const textWidth = font.widthOfTextAtSize(value, fontSize);
      let x = (width - textWidth) / 2;
      if (position.endsWith("left")) x = margin;
      if (position.endsWith("right")) x = width - textWidth - margin;
      const y = atTop ? height - margin : margin - fontSize / 2;
      page.drawText(value, {
        x,
        y,
        size: fontSize,
        font,
        color: pdfLib.rgb(rgb.r, rgb.g, rgb.b)
      });
    };

    draw(label, position.startsWith("top"));
    if (headerText) draw(headerText, !position.startsWith("top"));
  });

  return doc;
}

/* ---- Metadata ------------------------------------------- */
export async function readMetadata(file, { name = "document.pdf" } = {}) {
  const doc = await openForWriting(file, { name });
  const safe = (fn) => {
    try {
      const v = fn();
      return v === undefined || v === null ? "" : String(v);
    } catch (err) {
      return "";
    }
  };
  return {
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    subject: safe(() => doc.getSubject()),
    keywords: safe(() => doc.getKeywords()),
    creator: safe(() => doc.getCreator()),
    producer: safe(() => doc.getProducer()),
    creationDate: safe(() => doc.getCreationDate()),
    modificationDate: safe(() => doc.getModificationDate()),
    pageCount: doc.getPageCount()
  };
}

export async function writeMetadata(file, values, { name = "document.pdf", wipe = false } = {}) {
  const doc = await openForWriting(file, { name });

  if (wipe) {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setCreator("");
    doc.setProducer("");
    /* Dates cannot be removed outright, so they are set to a fixed
       moment rather than left showing when you really worked on it. */
    const epoch = new Date(0);
    doc.setCreationDate(epoch);
    doc.setModificationDate(epoch);
    return doc;
  }

  if (values.title !== undefined) doc.setTitle(values.title);
  if (values.author !== undefined) doc.setAuthor(values.author);
  if (values.subject !== undefined) doc.setSubject(values.subject);
  if (values.keywords !== undefined) {
    doc.setKeywords(String(values.keywords).split(/[,;]\s*/).filter(Boolean));
  }
  if (values.creator !== undefined) doc.setCreator(values.creator);
  if (values.producer !== undefined) doc.setProducer(values.producer);
  return doc;
}

/* ---- Flatten -------------------------------------------- */
/* Bakes form fields in so they can no longer be edited. */
export async function flatten(file, { name = "document.pdf" } = {}) {
  const doc = await openForWriting(file, { name });
  let fieldCount = 0;

  try {
    const form = doc.getForm();
    fieldCount = form.getFields().length;
    if (fieldCount) form.flatten();
  } catch (err) {
    throw new PdfError(
      `The form in “${name}” could not be flattened: ` +
      `${err && err.message ? err.message : err}. ` +
      `Some documents use form features pdf-lib does not handle.`,
      "flatten-failed"
    );
  }

  return { doc, fieldCount };
}

/* ---- Several pages on one sheet ------------------------- */
/* perSheet: 2 or 4. booklet re-orders pages for folding. */
export async function nUp(file, {
  name = "document.pdf",
  perSheet = 2,
  sheetSize = "a4",
  orientation = "landscape",
  booklet = false,
  margin = 18,
  gap = 10
} = {}) {
  const source = await openForWriting(file, { name });
  const out = await newDocument();
  const total = source.getPageCount();

  let order = Array.from({ length: total }, (_, i) => i);

  if (booklet) {
    /* Folded booklets need pages in the order they will sit on the
       sheets: last, first, second, second-last, and so on. Pad to a
       multiple of four with blanks. */
    const padded = order.slice();
    while (padded.length % 4 !== 0) padded.push(null);
    order = [];
    let left = 0;
    let right = padded.length - 1;
    while (left < right) {
      order.push(padded[right], padded[left], padded[left + 1], padded[right - 1]);
      left += 2;
      right -= 2;
    }
    perSheet = 2;
  }

  const size = pageSize(sheetSize, orientation);
  const cols = perSheet === 4 ? 2 : 2;
  const rows = perSheet === 4 ? 2 : 1;
  const perPage = cols * rows;

  const embedded = await out.embedPdf(
    source,
    order.filter((i) => i !== null)
  );
  const lookup = new Map();
  let at = 0;
  for (const i of order) {
    if (i === null) continue;
    lookup.set(i, embedded[at++]);
  }

  for (let start = 0; start < order.length; start += perPage) {
    const sheet = out.addPage([size.width, size.height]);
    const cellWidth = (size.width - margin * 2 - gap * (cols - 1)) / cols;
    const cellHeight = (size.height - margin * 2 - gap * (rows - 1)) / rows;

    for (let slot = 0; slot < perPage; slot++) {
      const index = order[start + slot];
      if (index === null || index === undefined) continue;
      const page = lookup.get(index);
      if (!page) continue;

      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const scale = Math.min(cellWidth / page.width, cellHeight / page.height);
      const drawWidth = page.width * scale;
      const drawHeight = page.height * scale;

      const x = margin + col * (cellWidth + gap) + (cellWidth - drawWidth) / 2;
      const y = size.height - margin - (row + 1) * cellHeight - row * gap +
        (cellHeight - drawHeight) / 2;

      sheet.drawPage(page, { x, y, width: drawWidth, height: drawHeight });
    }
  }

  return { doc: out, sheets: out.getPageCount(), sourcePages: total };
}
