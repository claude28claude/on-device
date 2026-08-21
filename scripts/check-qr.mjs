/* ============================================================
   On Device - checking the QR codes we make can actually be read

   The QR generator here is written from the specification rather
   than borrowed. That is defensible only if it is checked against
   something independent, because a QR code that is subtly wrong
   still LOOKS like a QR code, and our own reader will happily
   understand our own mistakes.

   That is not a hypothetical. Three real faults were found this
   way, after the generator had already shipped:

     - the format information was written with its rows and
       columns swapped;
     - the second copy of the format information was written in the
       opposite order to the first;
     - the table of alignment-square positions had a spurious blank
       row at the front, so every version from 2 upwards used the
       wrong positions, and version 31 was missing altogether.

   Every code produced before those fixes was unreadable by a real
   scanner. Nothing in the site itself noticed.

   This script needs two packages that are NOT part of the site and
   are never shipped with it:

     npm install --no-save @zxing/library qrcode

   @zxing/library is the reference decoder that Android's camera and
   most scanning apps are built on. "qrcode" is a well-established
   encoder used as a second opinion on the exact module layout.

   If they are not installed the script says so and stops, rather
   than passing silently and letting you believe something was
   checked when it was not.

   Run:  node scripts/check-qr.mjs
   ============================================================ */

import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let zxing;
let QRCode;
try {
  zxing = await import("@zxing/library");
  QRCode = (await import("qrcode")).default;
} catch (err) {
  console.log("This check did not run.\n");
  console.log("It needs two packages, which are deliberately not part of the site:\n");
  console.log("  npm install --no-save @zxing/library qrcode\n");
  console.log("Install them and run this again. Nothing has been verified.");
  process.exit(2);
}

const {
  MultiFormatReader, BinaryBitmap, HybridBinarizer,
  RGBLuminanceSource, DecodeHintType, BarcodeFormat
} = zxing;

const { encodeQr } = await import(
  "file:///" + path.join(root, "assets", "js", "qr.js").replace(/\\/g, "/")
);

/* ---- Turning a code into something ZXing can look at ------ */
/* Straight from the grid to greyscale pixels: no image file is
   written or read, so an image encoder cannot be blamed for a
   failure. What is tested is the code itself. */
function decode(get, size, { scale = 4, margin = 4 } = {}) {
  const side = (size + margin * 2) * scale;
  const pixels = new Int32Array(side * side).fill(0xffffff);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!get(x, y)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          pixels[((y + margin) * scale + dy) * side + ((x + margin) * scale + dx)] = 0x000000;
        }
      }
    }
  }

  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, side, side)));
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  try {
    return reader.decode(bitmap, hints).getText();
  } catch (err) {
    return null;
  }
}

/* ---- What gets checked ----------------------------------- */
const CASES = [
  { text: "HELLO", level: "M" },
  { text: "https://claude28claude.github.io/on-device/", level: "M" },
  { text: "On Device — nothing leaves this page.", level: "Q" },
  { text: "WIFI:T:WPA;S:My Network;P:hunter2;;", level: "L" },
  { text: "BEGIN:VCARD\nVERSION:3.0\nFN:A Person\nTEL:+44 20 7946 0000\nEND:VCARD", level: "H" },
  { text: "1234567890", level: "L" },
  { text: "mailto:someone@example.com?subject=Hello", level: "M" },
  { text: "a".repeat(300), level: "L" },
  { text: "Grüße, naïve café — £5 ¥100", level: "M" },
  { text: "你好，世界", level: "Q" }
];

const problems = [];
let readCount = 0;
let identicalCount = 0;

console.log("Checking every code twice: read back by ZXing, and compared");
console.log("module for module against a second encoder.\n");

for (const c of CASES) {
  const qr = encodeQr(c.text, { level: c.level });
  const shown = (c.text.length > 34 ? c.text.slice(0, 31) + "..." : c.text).replace(/\n/g, "\\n");
  const where = `${c.level} v${String(qr.version).padStart(2)} mask ${qr.mask}`;

  /* 1. Can a real scanner read it? */
  const back = decode((x, y) => qr.modules[y][x], qr.size);
  if (back === c.text) {
    readCount++;
  } else {
    problems.push(
      `${where} "${shown}": ` +
      (back === null ? "ZXing could not read it at all" : `read back as ${JSON.stringify(back)}`)
    );
  }

  /* 2. Is it laid out exactly as another encoder lays it out?

        The other encoder is told to use one plain byte segment, as
        this one always does. Left to itself it would split the text
        into a mixture of modes to save space - which is perfectly
        valid, and would make the two grids differ for reasons that
        are not faults. Comparing like with like is the point. */
  {
    const theirs = QRCode.create([{ data: c.text, mode: "byte" }], {
      errorCorrectionLevel: c.level,
      version: qr.version,
      maskPattern: qr.mask
    });
    const size = theirs.modules.size;
    let diff = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((qr.modules[y][x] ? 1 : 0) !== (theirs.modules.data[y * size + x] ? 1 : 0)) diff++;
      }
    }
    if (diff === 0) identicalCount++;
    else problems.push(`${where} "${shown}": ${diff} modules differ from the reference encoder`);
  }

  console.log(`  ${back === c.text ? "reads" : "FAILS"}  ${where}  "${shown}"`);
}

/* ---- Report ---------------------------------------------- */
console.log(`\n${readCount} of ${CASES.length} read back correctly by ZXing.`);
console.log(`${identicalCount} matrices are identical to the reference encoder, module for module.`);

if (problems.length) {
  console.log("\nFAIL - these codes would not scan:\n");
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}

console.log("\nPASS - every code was read back correctly by the library that phone");
console.log("       cameras use, and every matrix matches a second encoder exactly.");
