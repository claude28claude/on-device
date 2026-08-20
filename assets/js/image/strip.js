/* ============================================================
   On Device - removing what a photo is hiding, without harming it

   Most sites that "remove EXIF" simply redraw the picture and save
   it again. That works, but it re-compresses your photograph, so
   you quietly lose quality every time.

   This does it properly: it cuts the metadata sections out of the
   file and leaves the compressed picture data untouched, byte for
   byte. The result is a smaller file containing exactly the same
   image.
   ============================================================ */

import { findJpegSegments, findPngChunks, findRiffChunks } from "./exif.js";

/* ---- JPEG ----------------------------------------------- */
/* Application segments carry Exif, XMP, IPTC and colour profiles.
   We keep the colour profile by default, because dropping it makes
   colours shift, and that is a change to the picture. */
const JPEG_METADATA_MARKERS = new Set([
  0xe1, /* APP1  - Exif and XMP */
  0xe2, /* APP2  - usually the colour profile (kept unless asked) */
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb,
  0xec, /* APP12 - Ducky/Picture info */
  0xed, /* APP13 - IPTC / Photoshop */
  0xee, /* APP14 - Adobe */
  0xef,
  0xfe  /* COM   - free-text comment */
]);

function stripJpeg(bytes, { keepColourProfile = true } = {}) {
  const segments = findJpegSegments(bytes);
  if (!segments.length) {
    throw new Error("This does not look like a JPEG file after all, so nothing was changed.");
  }

  const keep = [];
  const removed = [];
  keep.push(bytes.slice(0, 2)); /* the start-of-image marker */

  for (const seg of segments) {
    if (seg.isImageData) {
      /* Everything from here to the end is the picture itself. */
      keep.push(bytes.slice(seg.start));
      break;
    }

    const isProfile =
      seg.marker === 0xe2 &&
      String.fromCharCode(...bytes.slice(seg.dataStart, seg.dataStart + 4)) === "ICC_";

    if (JPEG_METADATA_MARKERS.has(seg.marker) && !(isProfile && keepColourProfile)) {
      removed.push({
        what: describeJpegMarker(seg.marker, bytes, seg),
        bytes: seg.length
      });
      continue;
    }

    keep.push(bytes.slice(seg.start, seg.start + seg.length));
  }

  return { bytes: concat(keep), removed };
}

function describeJpegMarker(marker, bytes, seg) {
  if (marker === 0xe1) {
    const header = String.fromCharCode(...bytes.slice(seg.dataStart, seg.dataStart + 4));
    if (header === "Exif") return "Camera, date and location information (Exif)";
    if (header === "http") return "Extra descriptive data (XMP)";
    return "Application data";
  }
  if (marker === 0xed) return "Caption and rights information (IPTC)";
  if (marker === 0xe2) return "Colour profile";
  if (marker === 0xee) return "Editing-software data (Adobe)";
  if (marker === 0xfe) return "A free-text comment";
  return `Application data (marker ${marker.toString(16)})`;
}

/* ---- PNG ------------------------------------------------ */
/* PNG is a list of chunks. Only a few are required to draw the
   picture; the rest are safe to drop. */
const PNG_REQUIRED = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "bKGD", "pHYs", "sBIT"]);

const PNG_DESCRIPTIONS = {
  eXIf: "Camera, date and location information (Exif)",
  tEXt: "Embedded text",
  iTXt: "Embedded text",
  zTXt: "Embedded compressed text",
  tIME: "Last-modified time",
  hIST: "Colour histogram",
  sPLT: "Suggested palette"
};

function stripPng(bytes, { keepColourProfile = true } = {}) {
  const chunks = findPngChunks(bytes);
  if (!chunks.length || chunks[0].type !== "IHDR") {
    throw new Error("This does not look like a PNG file after all, so nothing was changed.");
  }

  const keep = [bytes.slice(0, 8)]; /* the PNG signature */
  const removed = [];

  for (const c of chunks) {
    const required = PNG_REQUIRED.has(c.type);
    const isProfile = c.type === "iCCP" || c.type === "sRGB";
    if (!required || (isProfile && !keepColourProfile)) {
      removed.push({
        what: PNG_DESCRIPTIONS[c.type] || `A “${c.type}” section`,
        bytes: c.total
      });
      continue;
    }
    keep.push(bytes.slice(c.start, c.start + c.total));
    if (c.type === "IEND") break;
  }

  return { bytes: concat(keep), removed };
}

/* ---- WebP ----------------------------------------------- */
function stripWebp(bytes, { keepColourProfile = true } = {}) {
  const chunks = findRiffChunks(bytes);
  if (!chunks.length) {
    throw new Error("This does not look like a WebP file after all, so nothing was changed.");
  }

  const removed = [];
  const kept = [];
  for (const c of chunks) {
    const isMeta = c.type === "EXIF" || c.type === "XMP ";
    const isProfile = c.type === "ICCP";
    if (isMeta || (isProfile && !keepColourProfile)) {
      removed.push({
        what: c.type === "EXIF"
          ? "Camera, date and location information (Exif)"
          : c.type === "XMP " ? "Extra descriptive data (XMP)" : "Colour profile",
        bytes: c.total
      });
      continue;
    }
    kept.push(bytes.slice(c.start, c.start + c.total));
  }

  if (!removed.length) return { bytes, removed };

  /* Rebuild the container, and correct the size written in its header. */
  const body = concat(kept);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.slice(0, 12), 0);
  out.set(body, 12);
  const size = out.length - 8;
  out[4] = size & 0xff;
  out[5] = (size >> 8) & 0xff;
  out[6] = (size >> 16) & 0xff;
  out[7] = (size >> 24) & 0xff;

  /* A WebP whose only remaining chunk is a simple VP8/VP8L can drop
     the VP8X header, but leaving it is harmless and safer. */
  return { bytes: out, removed };
}

/* ---- Helpers -------------------------------------------- */
function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/* ---- The entry point ------------------------------------ */
/* Returns a new Blob with the metadata gone and the picture data
   untouched, plus a plain list of exactly what was removed. */
export async function stripMetadata(file, format, options = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let result;

  switch (format) {
    case "jpg":
      result = stripJpeg(bytes, options);
      break;
    case "png":
      result = stripPng(bytes, options);
      break;
    case "webp":
      result = stripWebp(bytes, options);
      break;
    default:
      throw new Error(
        `Metadata can only be removed losslessly from JPEG, PNG and WebP files. ` +
        `This is a ${String(format).toUpperCase()} file. Convert it first, and the ` +
        `converted copy will not carry the original's hidden information.`
      );
  }

  const saved = bytes.length - result.bytes.length;
  return {
    blob: new Blob([result.bytes], { type: file.type || mimeFor(format) }),
    removed: result.removed,
    bytesSaved: saved,
    originalSize: bytes.length,
    newSize: result.bytes.length,
    /* Stated so the interface can promise it honestly. */
    lossless: true
  };
}

export function mimeFor(format) {
  return {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    heic: "image/heic"
  }[format] || "application/octet-stream";
}

export function canStripLosslessly(format) {
  return format === "jpg" || format === "png" || format === "webp";
}
