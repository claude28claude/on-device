/* ============================================================
   On Device - opening a PDF

   Two libraries are used, for two different jobs:

   - pdf.js READS. It understands the format well enough to draw a
     page, pull out text, and open a document that has a password.
   - pdf-lib WRITES. It builds new documents, moves pages about,
     and saves the result.

   Both run here, in this tab. Neither is permitted to contact
   anything, and the browser enforces that regardless of what they
   might try.
   ============================================================ */

import { loadPdfEngine } from "./loader.js";

/* ---- Errors people can act on --------------------------- */
export class PdfError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "PdfError";
    this.kind = kind;
  }
}

export const NEEDS_PASSWORD = "needs-password";
export const WRONG_PASSWORD = "wrong-password";
export const DAMAGED = "damaged";
export const ENCRYPTED_FOR_WRITING = "encrypted-for-writing";

function readingFailure(name, err) {
  const message = err && err.message ? err.message : String(err);
  const type = err && err.name ? err.name : "";

  if (type === "PasswordException" || /password/i.test(message)) {
    if (/incorrect/i.test(message)) {
      return new PdfError(
        `That password did not open “${name}”. Check it and try again — ` +
        `passwords are case-sensitive.`,
        WRONG_PASSWORD
      );
    }
    return new PdfError(
      `“${name}” is protected with a password. Enter it to continue.`,
      NEEDS_PASSWORD
    );
  }

  if (type === "InvalidPDFException" || /invalid|structure|corrupt/i.test(message)) {
    return new PdfError(
      `“${name}” is damaged and cannot be opened. The file may have been cut short ` +
      `while downloading, or it may not really be a PDF despite its name. ` +
      `The reader said: ${message}`,
      DAMAGED
    );
  }

  return new PdfError(
    `“${name}” could not be opened: ${message}`,
    DAMAGED
  );
}

/* ---- Reading ------------------------------------------- */
/* Returns a pdf.js document. Remember to call .destroy() when done,
   or a long batch will hold every document in memory at once. */
export async function openForReading(file, { password = "" } = {}) {
  const { pdfjs, readerOptions } = await loadPdfEngine();
  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const task = pdfjs.getDocument({
      data,
      password,
      ...readerOptions,
      /* Keep pdf.js quiet in the console; problems come back as errors. */
      verbosity: 0
    });
    return await task.promise;
  } catch (err) {
    throw readingFailure(file.name, err);
  }
}

/* A quick look at a document without keeping it open. */
export async function describe(file, { password = "" } = {}) {
  const doc = await openForReading(file, { password });
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const view = page.getViewport({ scale: 1 });
      pages.push({
        number: n,
        width: Math.round(view.width),
        height: Math.round(view.height),
        rotation: page.rotate || 0,
        landscape: view.width > view.height
      });
      page.cleanup();
    }

    let info = {};
    try {
      const meta = await doc.getMetadata();
      info = meta.info || {};
    } catch (err) {
      /* Metadata is a nicety; its absence is not a failure. */
    }

    return {
      pageCount: doc.numPages,
      pages,
      encrypted: Boolean(password),
      title: info.Title || "",
      author: info.Author || "",
      producer: info.Producer || "",
      creator: info.Creator || ""
    };
  } finally {
    await doc.destroy();
  }
}

/* ---- Writing -------------------------------------------- */
/* pdf-lib refuses encrypted documents outright. That is the correct
   behaviour, but the message it produces is unhelpful, so we replace
   it with one that says what to do. */
export async function openForWriting(file, { name = "this file" } = {}) {
  const { pdfLib } = await loadPdfEngine();
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    return await pdfLib.PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (/encrypt/i.test(message)) {
      throw new PdfError(
        `“${name}” is password-protected, and protected documents cannot be edited ` +
        `directly. Remove the password first — that tool arrives in Phase 4 — and ` +
        `then this will work.`,
        ENCRYPTED_FOR_WRITING
      );
    }
    if (/parse|invalid|expected/i.test(message)) {
      throw new PdfError(
        `“${name}” is damaged and cannot be edited. The file may be incomplete. ` +
        `The writer said: ${message}`,
        DAMAGED
      );
    }
    throw new PdfError(`“${name}” could not be opened for editing: ${message}`, DAMAGED);
  }
}

export async function newDocument() {
  const { pdfLib } = await loadPdfEngine();
  return pdfLib.PDFDocument.create();
}

/* Saving. pdf-lib hands back bytes; we wrap them as a file. */
export async function save(pdfDoc, { name = "document.pdf" } = {}) {
  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    name
  };
}

/* ---- Page sizes ----------------------------------------- */
/* PDF measures in points: 72 to the inch. */
export const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89, label: "A4" },
  letter: { width: 612, height: 792, label: "Letter" },
  legal: { width: 612, height: 1008, label: "Legal" },
  a3: { width: 841.89, height: 1190.55, label: "A3" },
  a5: { width: 419.53, height: 595.28, label: "A5" }
};

export function pageSize(id, orientation = "portrait") {
  const size = PAGE_SIZES[id] || PAGE_SIZES.a4;
  if (orientation === "landscape") {
    return { width: size.height, height: size.width };
  }
  return { width: size.width, height: size.height };
}

/* ---- Reading a page range people actually type ---------- */
/* Accepts "1", "3-9", "2,5,7", "1-3, 8, 12-" and so on.
   Returns a sorted list of page numbers, one-based. */
export function parsePageRange(text, pageCount) {
  const trimmed = String(text || "").trim();
  /* Always the same shape, including when nothing was typed. Returning a
     bare array here once meant every caller that destructured the result
     failed the moment the box was left empty. */
  if (!trimmed) return { pages: [], problems: [] };

  const wanted = new Set();
  const problems = [];

  for (const rawPart of trimmed.split(/[,\s]+/).filter(Boolean)) {
    const part = rawPart.replace(/\s/g, "");

    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= pageCount) wanted.add(n);
      else problems.push(`there is no page ${n}`);
      continue;
    }

    const range = /^(\d*)-(\d*)$/.exec(part);
    if (range) {
      const from = range[1] ? Number(range[1]) : 1;
      const to = range[2] ? Number(range[2]) : pageCount;
      if (from > pageCount) {
        problems.push(
          `“${part}” starts past the end — this document has ${pageCount} ` +
          `page${pageCount === 1 ? "" : "s"}`
        );
        continue;
      }
      if (from > to) {
        problems.push(`“${part}” counts backwards`);
        continue;
      }
      let added = 0;
      for (let n = Math.max(1, from); n <= Math.min(pageCount, to); n++) {
        wanted.add(n);
        added++;
      }
      if (!added) problems.push(`“${part}” is outside this document`);
      continue;
    }

    problems.push(`“${rawPart}” is not a page or a range`);
  }

  return {
    pages: Array.from(wanted).sort((a, b) => a - b),
    problems
  };
}

/* Turn a list of pages back into something readable: [1,2,3,7] -> "1-3, 7" */
export function describeRange(pages) {
  if (!pages.length) return "none";
  const parts = [];
  let start = pages[0];
  let previous = pages[0];
  for (let i = 1; i <= pages.length; i++) {
    const n = pages[i];
    if (n !== previous + 1) {
      parts.push(start === previous ? String(start) : `${start}-${previous}`);
      start = n;
    }
    previous = n;
  }
  return parts.join(", ");
}
