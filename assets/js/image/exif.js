/* ============================================================
   On Device - reading what a photo is hiding

   Photographs carry far more than the picture. A phone snap
   typically records the camera, the lens, the exact second, the
   software used - and, very often, the precise spot on Earth
   where you were standing.

   This file reads all of that, here, in this tab. Nothing is
   sent anywhere. It is written from the format specifications
   rather than borrowed, so it can be read and checked.

   Supported: JPEG (APP1/Exif), PNG (eXIf and text chunks),
   WebP (EXIF and XMP chunks), TIFF. HEIC is noted as a known
   limitation - see readHeic below.
   ============================================================ */

/* ---- The tag names we bother to name ------------------- */
const IFD0_TAGS = {
  0x010e: "Description",
  0x010f: "Camera make",
  0x0110: "Camera model",
  0x0112: "Orientation",
  0x011a: "Horizontal resolution",
  0x011b: "Vertical resolution",
  0x0131: "Software",
  0x0132: "Date and time",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x8769: "__exifPointer",
  0x8825: "__gpsPointer"
};

const EXIF_TAGS = {
  0x829a: "Exposure time",
  0x829d: "Aperture",
  0x8822: "Exposure programme",
  0x8827: "ISO speed",
  0x9003: "Date taken",
  0x9004: "Date digitised",
  0x9201: "Shutter speed",
  0x9202: "Aperture value",
  0x9204: "Exposure compensation",
  0x9207: "Metering mode",
  0x9209: "Flash",
  0x920a: "Focal length",
  0x9286: "User comment",
  0xa002: "Width",
  0xa003: "Height",
  0xa402: "Exposure mode",
  0xa403: "White balance",
  0xa405: "Focal length (35mm)",
  0xa430: "Camera owner",
  0xa431: "Camera serial number",
  0xa432: "Lens specification",
  0xa433: "Lens make",
  0xa434: "Lens model",
  0xa435: "Lens serial number"
};

const GPS_TAGS = {
  0x0001: "__latRef",
  0x0002: "__lat",
  0x0003: "__lonRef",
  0x0004: "__lon",
  0x0005: "__altRef",
  0x0006: "__alt",
  0x0007: "__timeStamp",
  0x000d: "GPS speed",
  0x001d: "__dateStamp"
};

const ORIENTATIONS = {
  1: "Normal",
  2: "Mirrored",
  3: "Upside down",
  4: "Mirrored and upside down",
  5: "Mirrored and turned left",
  6: "Turned right (90°)",
  7: "Mirrored and turned right",
  8: "Turned left (270°)"
};

/* ---- A tiny reader over the bytes ----------------------- */
function reader(bytes, bigEndian) {
  return {
    bytes,
    big: bigEndian,
    u8(at) {
      return bytes[at];
    },
    u16(at) {
      return bigEndian
        ? (bytes[at] << 8) | bytes[at + 1]
        : (bytes[at + 1] << 8) | bytes[at];
    },
    u32(at) {
      return bigEndian
        ? ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
        : ((bytes[at + 3] << 24) | (bytes[at + 2] << 16) | (bytes[at + 1] << 8) | bytes[at]) >>> 0;
    },
    i32(at) {
      const v = this.u32(at);
      return v > 0x7fffffff ? v - 0x100000000 : v;
    },
    ascii(at, length) {
      let out = "";
      for (let i = 0; i < length; i++) {
        const c = bytes[at + i];
        if (c === 0) break;
        out += String.fromCharCode(c);
      }
      return out.trim();
    }
  };
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function readValue(r, type, count, at) {
  switch (type) {
    case 1:
    case 6:
    case 7:
      if (count === 1) return r.u8(at);
      return Array.from(r.bytes.slice(at, at + count));
    case 2:
      return r.ascii(at, count);
    case 3:
    case 8: {
      if (count === 1) return r.u16(at);
      const out = [];
      for (let i = 0; i < count; i++) out.push(r.u16(at + i * 2));
      return out;
    }
    case 4:
    case 9: {
      if (count === 1) return type === 9 ? r.i32(at) : r.u32(at);
      const out = [];
      for (let i = 0; i < count; i++) out.push(type === 9 ? r.i32(at + i * 4) : r.u32(at + i * 4));
      return out;
    }
    case 5:
    case 10: {
      const rats = [];
      for (let i = 0; i < count; i++) {
        const n = type === 10 ? r.i32(at + i * 8) : r.u32(at + i * 8);
        const d = type === 10 ? r.i32(at + i * 8 + 4) : r.u32(at + i * 8 + 4);
        rats.push({ n, d, value: d === 0 ? 0 : n / d });
      }
      return count === 1 ? rats[0] : rats;
    }
    default:
      return null;
  }
}

/* Walk one image file directory. */
function readIfd(r, tiffStart, ifdOffset, names, out, pointers) {
  const at = tiffStart + ifdOffset;
  if (at + 2 > r.bytes.length) return 0;
  const count = r.u16(at);
  /* A wildly large count means we are not looking at a real directory. */
  if (count > 512) return 0;

  for (let i = 0; i < count; i++) {
    const entry = at + 2 + i * 12;
    if (entry + 12 > r.bytes.length) break;
    const tag = r.u16(entry);
    const type = r.u16(entry + 2);
    const num = r.u32(entry + 4);
    const size = (TYPE_SIZE[type] || 0) * num;
    if (!size || num > 100000) continue;

    let valueAt = entry + 8;
    if (size > 4) {
      valueAt = tiffStart + r.u32(entry + 8);
      if (valueAt < 0 || valueAt + size > r.bytes.length) continue;
    }

    const value = readValue(r, type, num, valueAt);
    if (value === null) continue;

    const name = names[tag];
    if (name === "__exifPointer") pointers.exif = value;
    else if (name === "__gpsPointer") pointers.gps = value;
    else if (name) out[name] = value;
    else out[`Tag 0x${tag.toString(16).padStart(4, "0")}`] = value;
  }

  const nextAt = at + 2 + count * 12;
  return nextAt + 4 <= r.bytes.length ? r.u32(nextAt) : 0;
}

/* ---- Turn GPS rationals into a plain number ------------- */
function toDegrees(parts, ref) {
  if (!Array.isArray(parts) || parts.length < 3) return null;
  const [d, m, s] = parts;
  if (!d || !m || !s) return null;
  let value = (d.value || 0) + (m.value || 0) / 60 + (s.value || 0) / 3600;
  if (ref === "S" || ref === "W") value = -value;
  return value;
}

/* ---- The main TIFF block parser ------------------------- */
function parseTiff(bytes) {
  if (bytes.length < 8) return null;
  const order = String.fromCharCode(bytes[0], bytes[1]);
  const big = order === "MM";
  if (order !== "MM" && order !== "II") return null;

  const r = reader(bytes, big);
  if (r.u16(2) !== 42) return null;

  const raw = {};
  const pointers = {};
  const first = r.u32(4);
  readIfd(r, 0, first, IFD0_TAGS, raw, pointers);

  const exif = {};
  if (pointers.exif) readIfd(r, 0, pointers.exif, EXIF_TAGS, exif, {});

  const gpsRaw = {};
  if (pointers.gps) readIfd(r, 0, pointers.gps, GPS_TAGS, gpsRaw, {});

  return { ifd0: raw, exif, gpsRaw };
}

/* ---- Presenting it in plain words ----------------------- */
function pretty(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "value" in value) {
    if (value.d === 1) return String(value.n);
    const v = value.value;
    return Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : null;
  }
  if (Array.isArray(value)) return value.map(pretty).filter(Boolean).join(", ");
  return String(value);
}

function buildReport(parsed, extras = {}) {
  if (!parsed) return null;
  const { ifd0, exif, gpsRaw } = parsed;

  const camera = [];
  const push = (label, value, note) => {
    const text = pretty(value);
    if (text !== null && text !== "" && text !== "0") camera.push({ label, value: text, note });
  };

  push("Camera make", ifd0["Camera make"]);
  push("Camera model", ifd0["Camera model"]);
  push("Lens make", exif["Lens make"]);
  push("Lens model", exif["Lens model"]);
  push("Software", ifd0.Software);
  push("Artist", ifd0.Artist);
  push("Copyright", ifd0.Copyright);
  push("Camera owner", exif["Camera owner"]);
  push("Camera serial number", exif["Camera serial number"], "This uniquely identifies your camera body.");
  push("Lens serial number", exif["Lens serial number"]);
  push("Description", ifd0.Description);
  push("User comment", exif["User comment"]);

  const when = [];
  if (ifd0["Date and time"]) when.push({ label: "File date", value: ifd0["Date and time"] });
  if (exif["Date taken"]) when.push({ label: "Date taken", value: exif["Date taken"] });
  if (exif["Date digitised"]) when.push({ label: "Date digitised", value: exif["Date digitised"] });

  const settings = [];
  const pushS = (label, value, suffix = "") => {
    const text = pretty(value);
    if (text !== null && text !== "") settings.push({ label, value: text + suffix });
  };
  if (exif["Exposure time"] && exif["Exposure time"].d) {
    const e = exif["Exposure time"];
    settings.push({
      label: "Exposure time",
      value: e.value >= 1 ? `${e.value} s` : `1/${Math.round(1 / (e.value || 1))} s`
    });
  }
  if (exif.Aperture && exif.Aperture.value) {
    settings.push({ label: "Aperture", value: `f/${Math.round(exif.Aperture.value * 10) / 10}` });
  }
  pushS("ISO speed", exif["ISO speed"]);
  if (exif["Focal length"] && exif["Focal length"].value) {
    settings.push({ label: "Focal length", value: `${Math.round(exif["Focal length"].value * 10) / 10} mm` });
  }
  pushS("Flash", exif.Flash);

  const orientation = ifd0.Orientation;

  /* GPS, stated bluntly. */
  let gps = null;
  const lat = toDegrees(gpsRaw.__lat, gpsRaw.__latRef);
  const lon = toDegrees(gpsRaw.__lon, gpsRaw.__lonRef);
  if (lat !== null && lon !== null) {
    let altitude = null;
    if (gpsRaw.__alt && gpsRaw.__alt.value !== undefined) {
      const sign = gpsRaw.__altRef === 1 ? -1 : 1;
      altitude = Math.round(gpsRaw.__alt.value * sign * 10) / 10;
    }
    gps = {
      latitude: Math.round(lat * 1000000) / 1000000,
      longitude: Math.round(lon * 1000000) / 1000000,
      altitude,
      dateStamp: gpsRaw.__dateStamp || null,
      /* Six decimal places is about a tenth of a metre. */
      text: `${Math.round(lat * 1000000) / 1000000}, ${Math.round(lon * 1000000) / 1000000}`
    };
  }

  const everythingElse = [];
  for (const [key, value] of Object.entries({ ...ifd0, ...exif })) {
    if (key.startsWith("__")) continue;
    const text = pretty(value);
    if (text === null || text === "") continue;
    everythingElse.push({ label: key, value: text });
  }

  return {
    hasAnything: everythingElse.length > 0 || Boolean(gps),
    camera,
    when,
    settings,
    orientation: orientation ? { value: orientation, text: ORIENTATIONS[orientation] || `Code ${orientation}` } : null,
    gps,
    everythingElse,
    ...extras
  };
}

/* ---- Finding the metadata inside each format ------------ */

/* JPEG: walk the segment markers looking for APP1/Exif. */
export function findJpegSegments(bytes) {
  const segments = [];
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return segments;
  let at = 2;
  while (at < bytes.length - 1) {
    if (bytes[at] !== 0xff) {
      at++;
      continue;
    }
    const marker = bytes[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      /* Start of the compressed image, or end of file. */
      segments.push({ marker, start: at, length: bytes.length - at, isImageData: true });
      break;
    }
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    segments.push({ marker, start: at, length: length + 2, dataStart: at + 4, dataLength: length - 2 });
    at += 2 + length;
  }
  return segments;
}

function readJpeg(bytes) {
  const segments = findJpegSegments(bytes);
  let tiffBlock = null;
  const extras = { xmp: null, comment: null, iptc: false };

  for (const seg of segments) {
    if (seg.isImageData) continue;
    if (seg.marker === 0xe1) {
      const header = String.fromCharCode(...bytes.slice(seg.dataStart, seg.dataStart + 6));
      if (header === "Exif\0\0") {
        tiffBlock = bytes.slice(seg.dataStart + 6, seg.dataStart + seg.dataLength);
      } else if (header.startsWith("http:")) {
        extras.xmp = true;
      }
    } else if (seg.marker === 0xed) {
      extras.iptc = true;
    } else if (seg.marker === 0xfe) {
      extras.comment = new TextDecoder().decode(bytes.slice(seg.dataStart, seg.dataStart + seg.dataLength));
    }
  }

  if (!tiffBlock) return buildReport({ ifd0: {}, exif: {}, gpsRaw: {} }, extras);
  return buildReport(parseTiff(tiffBlock), extras);
}

/* PNG: look for eXIf and the text chunks. */
export function findPngChunks(bytes) {
  const chunks = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    chunks.push({ type, start: at, dataStart: at + 8, length, total: length + 12 });
    if (type === "IEND") break;
    at += length + 12;
    if (length > bytes.length) break;
  }
  return chunks;
}

function readPng(bytes) {
  const chunks = findPngChunks(bytes);
  let tiffBlock = null;
  const texts = [];
  for (const c of chunks) {
    if (c.type === "eXIf") {
      tiffBlock = bytes.slice(c.dataStart, c.dataStart + c.length);
    } else if (c.type === "tEXt" || c.type === "iTXt" || c.type === "zTXt") {
      const raw = bytes.slice(c.dataStart, c.dataStart + Math.min(c.length, 400));
      const text = new TextDecoder("utf-8", { fatal: false }).decode(raw).replace(/\0/g, ": ");
      texts.push(text.trim());
    }
  }
  const report = tiffBlock
    ? buildReport(parseTiff(tiffBlock))
    : buildReport({ ifd0: {}, exif: {}, gpsRaw: {} });
  if (report && texts.length) {
    report.hasAnything = true;
    for (const text of texts) report.everythingElse.push({ label: "Embedded text", value: text });
  }
  return report;
}

/* WebP: a RIFF container with optional EXIF and XMP chunks. */
export function findRiffChunks(bytes) {
  const chunks = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const type = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    const size = (bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] << 24)) >>> 0;
    chunks.push({ type, start: at, dataStart: at + 8, length: size, total: 8 + size + (size % 2) });
    at += 8 + size + (size % 2);
    if (size === 0 && chunks.length > 64) break;
  }
  return chunks;
}

function readWebp(bytes) {
  const chunks = findRiffChunks(bytes);
  let tiffBlock = null;
  let xmp = false;
  for (const c of chunks) {
    if (c.type === "EXIF") tiffBlock = bytes.slice(c.dataStart, c.dataStart + c.length);
    if (c.type === "XMP ") xmp = true;
  }
  return tiffBlock
    ? buildReport(parseTiff(tiffBlock), { xmp })
    : buildReport({ ifd0: {}, exif: {}, gpsRaw: {} }, { xmp });
}

function readTiff(bytes) {
  return buildReport(parseTiff(bytes));
}

/* HEIC: an honest limitation.

   HEIC keeps its metadata inside nested boxes in a way that needs a
   full container parser to reach reliably. Rather than half-read it
   and risk telling somebody their photo has no location when it
   does, we say plainly that we cannot check. */
function readHeic() {
  return {
    hasAnything: null,
    unreadable: true,
    unreadableReason:
      "This is a HEIC photo. On Device cannot yet read the hidden information inside " +
      "HEIC files, so it cannot tell you whether this one contains your location. " +
      "It might. Convert it to JPEG or PNG first and check the result - converting " +
      "here does not copy the location across.",
    camera: [],
    when: [],
    settings: [],
    orientation: null,
    gps: null,
    everythingElse: []
  };
}

/* ---- The entry point ------------------------------------ */
export async function readMetadata(file, format) {
  let bytes;
  try {
    /* Metadata lives near the front; a megabyte is far more than enough
       and avoids pulling a huge photo into memory just to read it. */
    const slice = file.size > 2 * 1024 * 1024 ? file.slice(0, 2 * 1024 * 1024) : file;
    bytes = new Uint8Array(await slice.arrayBuffer());
  } catch (err) {
    throw new Error(
      `“${file.name}” could not be read: ${err && err.message ? err.message : err}`
    );
  }

  switch (format) {
    case "jpg":
      return readJpeg(bytes);
    case "png":
      return readPng(bytes);
    case "webp":
      return readWebp(bytes);
    case "tiff":
      return readTiff(bytes);
    case "heic":
    case "avif":
      return readHeic();
    default:
      return {
        hasAnything: false,
        unsupported: true,
        unreadableReason:
          `On Device does not read hidden information from ${String(format).toUpperCase()} files. ` +
          `JPEG, PNG, WebP and TIFF are supported.`,
        camera: [],
        when: [],
        settings: [],
        orientation: null,
        gps: null,
        everythingElse: []
      };
  }
}

/* Orientation straight from bytes we already have in hand. Used when
   listing files, where re-reading from disk would be wasteful. */
export function orientationFromBytes(bytes, format) {
  try {
    if (format === "jpg") {
      const report = readJpeg(bytes);
      return (report && report.orientation && report.orientation.value) || 1;
    }
    if (format === "tiff") {
      const report = readTiff(bytes);
      return (report && report.orientation && report.orientation.value) || 1;
    }
  } catch (err) {
    /* An unreadable rotation flag is not worth failing over. */
  }
  return 1;
}

/* Just the orientation, which every image tool needs so photos are
   not silently turned on their side. */
export async function readOrientation(file, format) {
  if (format !== "jpg" && format !== "tiff") return 1;
  try {
    const bytes = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    const report = format === "jpg" ? readJpeg(bytes) : readTiff(bytes);
    return (report && report.orientation && report.orientation.value) || 1;
  } catch (err) {
    return 1;
  }
}
