/* ============================================================
   On Device - build a JPEG that carries realistic Exif

       node scripts/add-exif.mjs

   Takes samples/photo-plain.jpg and writes samples/photo-with-gps.jpg
   with camera details, dates and a GPS position attached.

   This exists so the metadata reader can be tested against data
   whose correct answer is known in advance. Testing a parser
   against files you did not construct only tells you it did not
   crash.

   The location used is the Royal Observatory, Greenwich - a
   public landmark, chosen so no real person's whereabouts are
   committed to this repository.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");

/* ---- A little-endian TIFF builder ----------------------- */
const TYPE = { BYTE: 1, ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5, UNDEFINED: 7 };
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };

function entry(tag, type, values) {
  const list = Array.isArray(values) ? values : [values];
  let count;
  if (type === TYPE.ASCII) count = String(values).length + 1;
  else count = list.length;
  return { tag, type, count, values, size: TYPE_SIZE[type] * count };
}

function writeValue(buf, at, type, values, count) {
  if (type === TYPE.ASCII) {
    const text = String(values);
    for (let i = 0; i < text.length; i++) buf.writeUInt8(text.charCodeAt(i), at + i);
    buf.writeUInt8(0, at + text.length);
    return;
  }
  const list = Array.isArray(values) ? values : [values];
  for (let i = 0; i < count; i++) {
    const v = list[i];
    if (type === TYPE.SHORT) buf.writeUInt16LE(v, at + i * 2);
    else if (type === TYPE.LONG) buf.writeUInt32LE(v, at + i * 4);
    else if (type === TYPE.BYTE || type === TYPE.UNDEFINED) buf.writeUInt8(v, at + i);
    else if (type === TYPE.RATIONAL) {
      buf.writeUInt32LE(v[0], at + i * 8);
      buf.writeUInt32LE(v[1], at + i * 8 + 4);
    }
  }
}

/* Lay out a set of directories that may point at one another. */
function buildTiff({ ifd0, exifEntries, gpsEntries }) {
  const ifdSize = (entries) => 2 + entries.length * 12 + 4;

  /* Reserve the pointer entries now; their values are filled in once
     the offsets are known. */
  const exifPointer = entry(0x8769, TYPE.LONG, 0);
  const gpsPointer = entry(0x8825, TYPE.LONG, 0);
  const ifd0All = [...ifd0, exifPointer, gpsPointer].sort((a, b) => a.tag - b.tag);
  const exifAll = [...exifEntries].sort((a, b) => a.tag - b.tag);
  const gpsAll = [...gpsEntries].sort((a, b) => a.tag - b.tag);

  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(ifd0All);
  const gpsAt = exifAt + ifdSize(exifAll);
  let dataAt = gpsAt + ifdSize(gpsAll);

  exifPointer.values = exifAt;
  gpsPointer.values = gpsAt;

  /* Anything longer than four bytes lives in the data area. */
  const assign = (entries) => {
    for (const e of entries) {
      if (e.size > 4) {
        e.dataOffset = dataAt;
        dataAt += e.size + (e.size % 2); /* keep offsets even */
      }
    }
  };
  assign(ifd0All);
  assign(exifAll);
  assign(gpsAll);

  const buf = Buffer.alloc(dataAt);
  buf.write("II", 0, "ascii");
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(ifd0At, 4);

  const writeIfd = (entries, at, nextIfd = 0) => {
    buf.writeUInt16LE(entries.length, at);
    entries.forEach((e, i) => {
      const p = at + 2 + i * 12;
      buf.writeUInt16LE(e.tag, p);
      buf.writeUInt16LE(e.type, p + 2);
      buf.writeUInt32LE(e.count, p + 4);
      if (e.size > 4) {
        buf.writeUInt32LE(e.dataOffset, p + 8);
        writeValue(buf, e.dataOffset, e.type, e.values, e.count);
      } else {
        writeValue(buf, p + 8, e.type, e.values, e.count);
      }
    });
    buf.writeUInt32LE(nextIfd, at + 2 + entries.length * 12);
  };

  writeIfd(ifd0All, ifd0At, 0);
  writeIfd(exifAll, exifAt, 0);
  writeIfd(gpsAll, gpsAt, 0);

  return buf;
}

/* ---- Degrees to the three rationals Exif wants ---------- */
function toDms(value) {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const minutesFull = (abs - d) * 60;
  const m = Math.floor(minutesFull);
  const s = (minutesFull - m) * 60;
  return [
    [d, 1],
    [m, 1],
    [Math.round(s * 10000), 10000]
  ];
}

/* ---- Put the segment into the JPEG ---------------------- */
function insertExif(jpeg, tiff) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error("The source is not a JPEG.");
  }

  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const segment = Buffer.alloc(4 + payload.length);
  segment.writeUInt8(0xff, 0);
  segment.writeUInt8(0xe1, 1);
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);

  /* Sit immediately after the start-of-image marker, before any
     other application segment. */
  return Buffer.concat([jpeg.slice(0, 2), segment, jpeg.slice(2)]);
}

/* ---- Build it ------------------------------------------- */
let source;
try {
  source = readFileSync(join(SAMPLES, "photo-plain.jpg"));
} catch (err) {
  console.error(
    [
      "samples/photo-plain.jpg is missing.",
      "",
      "That file is a real JPEG produced by a browser, because Node cannot write",
      "one without an image library and this project has no dependencies. It is",
      "committed to the repository, so this error normally means it was deleted.",
      "",
      "To recreate it: open the site, and in the browser console draw anything on",
      "a canvas, call toBlob('image/jpeg'), and save the result to that path."
    ].join("\n")
  );
  process.exit(1);
}

const LATITUDE = 51.477928;   /* Royal Observatory, Greenwich */
const LONGITUDE = -0.001545;

const tiff = buildTiff({
  ifd0: [
    entry(0x010f, TYPE.ASCII, "On Device"),
    entry(0x0110, TYPE.ASCII, "Test Camera 1"),
    entry(0x0112, TYPE.SHORT, 1),
    entry(0x0131, TYPE.ASCII, "On Device sample generator 1.0"),
    entry(0x0132, TYPE.ASCII, "2026:08:20 14:32:07"),
    entry(0x013b, TYPE.ASCII, "A Photographer"),
    entry(0x8298, TYPE.ASCII, "Sample file, no rights reserved")
  ],
  exifEntries: [
    entry(0x829a, TYPE.RATIONAL, [[1, 250]]),        /* exposure 1/250 */
    entry(0x829d, TYPE.RATIONAL, [[28, 10]]),        /* f/2.8 */
    entry(0x8827, TYPE.SHORT, 400),                  /* ISO */
    entry(0x9003, TYPE.ASCII, "2026:08:20 14:32:07"),
    entry(0x9004, TYPE.ASCII, "2026:08:20 14:32:07"),
    entry(0x920a, TYPE.RATIONAL, [[350, 10]]),       /* 35mm */
    entry(0xa002, TYPE.LONG, 1600),
    entry(0xa003, TYPE.LONG, 1200),
    entry(0xa430, TYPE.ASCII, "A Photographer"),
    entry(0xa431, TYPE.ASCII, "SERIAL-12345678"),
    entry(0xa433, TYPE.ASCII, "On Device"),
    entry(0xa434, TYPE.ASCII, "35mm f/2.8 Test Lens")
  ],
  gpsEntries: [
    entry(0x0000, TYPE.BYTE, [2, 3, 0, 0]),
    entry(0x0001, TYPE.ASCII, LATITUDE >= 0 ? "N" : "S"),
    entry(0x0002, TYPE.RATIONAL, toDms(LATITUDE)),
    entry(0x0003, TYPE.ASCII, LONGITUDE >= 0 ? "E" : "W"),
    entry(0x0004, TYPE.RATIONAL, toDms(LONGITUDE)),
    entry(0x0005, TYPE.BYTE, 0),
    entry(0x0006, TYPE.RATIONAL, [[457, 10]]),       /* 45.7 m */
    entry(0x001d, TYPE.ASCII, "2026:08:20")
  ]
});

const withExif = insertExif(source, tiff);
writeFileSync(join(SAMPLES, "photo-with-gps.jpg"), withExif);

/* A second one that is rotated, so the orientation handling is
   exercised: the flag says "turned right" while the pixels are not. */
const rotatedTiff = buildTiff({
  ifd0: [
    entry(0x010f, TYPE.ASCII, "On Device"),
    entry(0x0110, TYPE.ASCII, "Test Camera 1"),
    entry(0x0112, TYPE.SHORT, 6), /* turned right 90 degrees */
    entry(0x0132, TYPE.ASCII, "2026:08:20 14:40:00")
  ],
  exifEntries: [entry(0x9003, TYPE.ASCII, "2026:08:20 14:40:00")],
  gpsEntries: []
});
writeFileSync(join(SAMPLES, "photo-sideways.jpg"), insertExif(source, rotatedTiff));

console.log("Written:");
console.log(`  samples/photo-with-gps.jpg   ${withExif.length} bytes`);
console.log(`     camera: On Device Test Camera 1, lens 35mm f/2.8 Test Lens`);
console.log(`     serial: SERIAL-12345678`);
console.log(`     taken:  2026:08:20 14:32:07`);
console.log(`     GPS:    ${LATITUDE}, ${LONGITUDE}  (Royal Observatory, Greenwich)`);
console.log(`     alt:    45.7 m`);
console.log(`  samples/photo-sideways.jpg   orientation flag 6 (turned right)`);
