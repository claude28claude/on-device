/* ============================================================
   On Device - what kind of file is this, really?

   Filenames lie. A photo emailed from an iPhone often arrives
   named ".jpg" while actually being a HEIC, and a "PDF" that
   will not open is frequently a renamed Word file.

   So we read the first few bytes of the file and identify it by
   what it actually contains. The file is read here, in this tab,
   using the browser's own file reader. It is not sent anywhere.
   ============================================================ */

const HEIC_BRANDS = new Set([
  "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "avci"
]);
const AVIF_BRANDS = new Set(["avif", "avis"]);
const MP4_BRANDS = new Set(["isom", "iso2", "mp41", "mp42", "avc1", "dash", "M4V ", "mmp4"]);
const MOV_BRANDS = new Set(["qt  "]);

function ascii(bytes, start, length) {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function startsWith(bytes, signature, offset = 0) {
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/* Map a specific format to the broad "kind" the tools care about. */
const KIND_OF = {
  pdf: "pdf",
  png: "image", jpg: "image", gif: "image", bmp: "image", webp: "image",
  tiff: "image", ico: "image", svg: "image", avif: "image",
  heic: "heic",
  zip: "zip", xlsx: "sheet", docx: "zip", pptx: "zip",
  csv: "csv", json: "json", txt: "text", md: "text", html: "text", xml: "text",
  mp3: "audio", wav: "audio", ogg: "audio", flac: "audio", m4a: "audio",
  mp4: "video", mov: "video", webm: "video", avi: "video", mkv: "video"
};

const LABELS = {
  pdf: "PDF document",
  png: "PNG image", jpg: "JPEG image", gif: "GIF image", bmp: "BMP image",
  webp: "WebP image", tiff: "TIFF image", ico: "Icon file", svg: "SVG image",
  avif: "AVIF image", heic: "HEIC photo (the format iPhones use)",
  zip: "Zip archive", xlsx: "Excel spreadsheet", docx: "Word document",
  pptx: "PowerPoint file",
  csv: "CSV spreadsheet", json: "JSON data", txt: "Plain text",
  md: "Markdown text", html: "Web page", xml: "XML data",
  mp3: "MP3 audio", wav: "WAV audio", ogg: "OGG audio", flac: "FLAC audio",
  m4a: "M4A audio",
  mp4: "MP4 video", mov: "QuickTime video", webm: "WebM video",
  avi: "AVI video", mkv: "Matroska video",
  unknown: "Unrecognised file"
};

/* What the filename claims. */
export function formatFromName(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  if (!m) return null;
  const ext = m[1].toLowerCase();
  const alias = {
    jpeg: "jpg", tif: "tiff", htm: "html", heif: "heic",
    yml: "txt", text: "txt", log: "txt", markdown: "md", mjs: "txt", js: "txt"
  };
  const format = alias[ext] || ext;
  return KIND_OF[format] ? format : null;
}

/* Identify from the leading bytes. Returns a format id or null. */
export function formatFromBytes(buffer) {
  const b = new Uint8Array(buffer);
  if (b.length < 4) return null;

  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return "pdf";                  /* %PDF */
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return "gif";                  /* GIF8 */
  if (startsWith(b, [0x42, 0x4d])) return "bmp";                              /* BM */
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00])) return "ico";
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff";
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";                 /* also mkv */
  if (startsWith(b, [0x4f, 0x67, 0x67, 0x53])) return "ogg";
  if (startsWith(b, [0x66, 0x4c, 0x61, 0x43])) return "flac";
  if (startsWith(b, [0x49, 0x44, 0x33])) return "mp3";                        /* ID3 */
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";

  /* RIFF containers: WebP, WAV, AVI all start "RIFF". */
  if (ascii(b, 0, 4) === "RIFF") {
    const sub = ascii(b, 8, 4);
    if (sub === "WEBP") return "webp";
    if (sub === "WAVE") return "wav";
    if (sub === "AVI ") return "avi";
    return null;
  }

  /* ISO base media: HEIC, AVIF, MP4, MOV, M4A all use "ftyp". */
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (HEIC_BRANDS.has(brand)) return "heic";
    if (AVIF_BRANDS.has(brand)) return "avif";
    if (brand === "M4A ") return "m4a";
    if (MOV_BRANDS.has(brand)) return "mov";
    if (MP4_BRANDS.has(brand)) return "mp4";
    /* Unknown brand in a known container: still a video container. */
    return "mp4";
  }

  /* Zip family. Office files are zips with a known first entry. */
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) ||
      startsWith(b, [0x50, 0x4b, 0x05, 0x06]) ||
      startsWith(b, [0x50, 0x4b, 0x07, 0x08])) {
    return "zip";
  }

  return null;
}

/* Text formats have no signature, so we look at the content. */
function sniffText(text) {
  const trimmed = text.trim();
  if (!trimmed) return "txt";
  if (trimmed.startsWith("<?xml")) return "xml";
  if (/^<(!doctype html|html)\b/i.test(trimmed)) return "html";
  if (trimmed.startsWith("<svg") || /^<\?xml[\s\S]{0,200}<svg\b/i.test(trimmed)) return "svg";
  if ((trimmed.startsWith("{") && trimmed.includes(":")) || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch (err) {
      /* Might be a truncated sample of a large JSON file. */
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    }
  }
  const lines = trimmed.split(/\r?\n/).slice(0, 5).filter(Boolean);
  if (lines.length >= 2) {
    const counts = lines.map((l) => (l.match(/[,;\t]/g) || []).length);
    if (counts[0] > 0 && counts.every((c) => c === counts[0])) return "csv";
  }
  if (/^#{1,6}\s|\n#{1,6}\s|\n- |\n\* /.test(trimmed)) return "md";
  return "txt";
}

function looksLikeText(bytes) {
  let suspicious = 0;
  const limit = Math.min(bytes.length, 512);
  for (let i = 0; i < limit; i++) {
    const c = bytes[i];
    if (c === 0) return false;
    if (c < 9 || (c > 13 && c < 32)) suspicious++;
  }
  return suspicious / Math.max(limit, 1) < 0.06;
}

/* ---------------------------------------------------------
   The main entry point.
   --------------------------------------------------------- */
export async function identify(file) {
  const claimedFormat = formatFromName(file.name);

  let head;
  try {
    head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  } catch (err) {
    throw new Error(
      `“${file.name}” could not be read from disk. ` +
      `The file may have been moved, renamed or deleted since you chose it. ` +
      `Original message: ${err && err.message ? err.message : err}`
    );
  }

  let format = formatFromBytes(head.buffer);

  /* A zip might really be an Office document. Look for the marker
     name inside the first block; it is not conclusive but it is
     right almost always, and we say "probably" when unsure. */
  if (format === "zip") {
    const text = ascii(head, 0, Math.min(head.length, 2048));
    if (text.includes("word/")) format = "docx";
    else if (text.includes("xl/")) format = "xlsx";
    else if (text.includes("ppt/")) format = "pptx";
    else if (claimedFormat === "xlsx" || claimedFormat === "docx" || claimedFormat === "pptx") {
      format = claimedFormat;
    }
  }

  if (!format && looksLikeText(head)) {
    let text = "";
    try {
      text = new TextDecoder("utf-8", { fatal: false }).decode(head);
    } catch (err) {
      text = ascii(head, 0, head.length);
    }
    format = sniffText(text);
  }

  const resolved = format || "unknown";
  const kind = KIND_OF[resolved] || "unknown";

  /* Did the name lie? We only call it a mismatch when both are
     known and they disagree in a way that matters. */
  let mismatch = null;
  if (claimedFormat && format && claimedFormat !== format) {
    const sameKind = KIND_OF[claimedFormat] === KIND_OF[format];
    const textFamily = ["txt", "csv", "json", "md", "html", "xml"];
    const bothText = textFamily.includes(claimedFormat) && textFamily.includes(format);
    if (!sameKind || (!bothText && KIND_OF[claimedFormat] !== KIND_OF[format])) {
      mismatch = { claimed: claimedFormat, actual: format };
    } else if (!bothText && claimedFormat !== format && KIND_OF[claimedFormat] === KIND_OF[format]) {
      /* e.g. a .jpg that is really a .png - same kind, still worth saying. */
      mismatch = { claimed: claimedFormat, actual: format, minor: true };
    }
  }

  return {
    file,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    format: resolved,
    kind,
    label: LABELS[resolved] || LABELS.unknown,
    claimedFormat,
    mismatch,
    /* An empty file is a common and confusing failure; call it out. */
    empty: file.size === 0
  };
}

export function labelFor(format) {
  return LABELS[format] || LABELS.unknown;
}

/* ---------------------------------------------------------
   How big a file can this device realistically handle?

   These are estimates from what the browser is willing to tell
   us. We use them to warn BEFORE starting work, never to
   explain a crash afterwards.
   --------------------------------------------------------- */
export function memoryBudget() {
  /* deviceMemory is in gigabytes, rounded down, and capped at 8
     by the browser. It is absent in Firefox and Safari. */
  const deviceGb = navigator.deviceMemory || null;

  let heapLimit = null;
  if (performance && performance.memory && performance.memory.jsHeapSizeLimit) {
    heapLimit = performance.memory.jsHeapSizeLimit;
  }

  const isMobile = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;

  /* A conservative working limit. Image and PDF work typically needs
     three to four times the file size in memory at once.

     Chrome reports the same 4 GB heap limit on a small laptop as on a
     large workstation, so where we also know how much memory the
     machine actually has, we take whichever estimate is smaller. An
     over-optimistic guess here means a crashed tab and lost work,
     which is the one outcome worth being pessimistic about. */
  const estimates = [];
  if (heapLimit) estimates.push(heapLimit * 0.35);
  if (deviceGb) estimates.push(deviceGb * 1024 * 1024 * 1024 * 0.12);
  if (!estimates.length) estimates.push(isMobile ? 180 * 1024 * 1024 : 500 * 1024 * 1024);
  let bytes = Math.floor(Math.min(...estimates));

  /* Phones reclaim memory far more aggressively than the numbers above
     suggest, whatever the browser reports. */
  if (isMobile) bytes = Math.min(bytes, 260 * 1024 * 1024);

  return {
    bytes,
    known: Boolean(heapLimit || deviceGb),
    isMobile,
    deviceGb,
    heapLimit
  };
}

export function warnIfTooBig(fileSize) {
  const budget = memoryBudget();
  /* Rough rule: a file needs about 4x its size in working memory. */
  const needed = fileSize * 4;
  if (needed <= budget.bytes) return null;
  return { needed, budget: budget.bytes, known: budget.known, isMobile: budget.isMobile };
}
