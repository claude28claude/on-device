/* ============================================================
   On Device - sample file generator

       node scripts/make-samples.mjs

   Writes real test files into samples/ so the tools can be tried
   without risking anything of your own, and so each phase can be
   tested against actual bytes rather than guesses.

   These files are NOT part of the published site. They are
   excluded from the offline cache and from the address scan.
   ============================================================ */

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");
mkdirSync(OUT, { recursive: true });

const written = [];
function write(name, data, note) {
  writeFileSync(join(OUT, name), data);
  written.push({ name, bytes: data.length, note });
}

/* ---------------------------------------------------------
   A real, valid PDF with three pages and readable text.
   Built by hand so the byte offsets in the cross-reference
   table are correct - a PDF with a broken table is exactly the
   kind of "corrupt file" the tools must handle gracefully, and
   we want the good sample to genuinely be good.
   --------------------------------------------------------- */
function buildPdf(pageTexts, { title = "On Device sample", author = "On Device" } = {}) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length; /* object numbers start at 1 */
  };

  const fontNum = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageNums = [];
  const contentNums = [];
  for (const text of pageTexts) {
    const stream =
      `BT /F1 24 Tf 72 700 Td (${text.replace(/([()\\])/g, "\\$1")}) Tj ET\n` +
      `BT /F1 11 Tf 72 660 Td (This is a sample file made by On Device for testing. Nothing here left your machine.) Tj ET`;
    contentNums.push(add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
  }

  /* The pages object needs its own number before the pages can
     point back at it, so reserve it by counting ahead. */
  const pagesNum = objects.length + pageTexts.length + 1;

  pageTexts.forEach((_, i) => {
    pageNums.push(
      add(
        `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`
      )
    );
  });

  const actualPagesNum = add(
    `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`
  );
  if (actualPagesNum !== pagesNum) {
    throw new Error(
      `Internal error building the sample PDF: expected the pages object to be ${pagesNum}, got ${actualPagesNum}.`
    );
  }

  const infoNum = add(
    `<< /Title (${title}) /Author (${author}) /Subject (Sample file) ` +
    `/Keywords (sample test on-device) /Creator (On Device sample generator) ` +
    `/Producer (On Device) /CreationDate (D:20260101120000Z) >>`
  );
  const catalogNum = add(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);

  /* Assemble, recording where each object starts. */
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R /Info ${infoNum} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

write(
  "sample-3-page.pdf",
  buildPdf(["Page one", "Page two", "Page three"]),
  "A valid three-page PDF with text and metadata"
);

write(
  "sample-1-page.pdf",
  buildPdf(["A single page"], { title: "One page", author: "Nobody" }),
  "A valid one-page PDF"
);

/* A deliberately damaged PDF: correct header, ruined body. Tools
   must say what is wrong rather than hanging. */
const good = buildPdf(["Broken on purpose"]);
const broken = Buffer.from(good);
broken.fill(0x00, Math.floor(broken.length * 0.55), Math.floor(broken.length * 0.75));
write("damaged.pdf", broken, "A PDF with its middle destroyed, to test error messages");

/* ---------------------------------------------------------
   A real PNG.
   --------------------------------------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, paint) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = rowStart + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const photo = makePng(900, 600, (x, y) => {
  const band = Math.floor(y / 75) % 2;
  const r = Math.round(40 + (x / 900) * 180);
  const g = Math.round(90 + (y / 600) * 120);
  const b = band ? 200 : 120;
  return [r, g, b, 255];
});
write("sample-photo.png", photo, "A 900x600 PNG");

const square = makePng(512, 512, (x, y) => {
  const cx = x - 256, cy = y - 256;
  const d = Math.sqrt(cx * cx + cy * cy);
  return d < 190 ? [23, 80, 200, 255] : [250, 249, 247, 255];
});
write("square-for-icons.png", square, "A 512x512 square image, for the icon maker");

/* The classic real-world trap: a PNG called .jpg. */
write("actually-a-png.jpg", photo, "A PNG with a .jpg name, to prove the site checks contents not names");

/* ---------------------------------------------------------
   A HEIC container.

   HONEST LIMITATION: this has a genuine HEIC file signature, so
   it correctly tests IDENTIFICATION. It does not contain a real
   encoded image, so it cannot test DECODING. A photo straight
   off an iPhone is still needed for that, and Phase 2 must not
   be signed off without one.
   --------------------------------------------------------- */
function box(type, payload) {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(8 + payload.length, 0);
  return Buffer.concat([size, Buffer.from(type, "ascii"), payload]);
}
const ftyp = box("ftyp", Buffer.concat([
  Buffer.from("heic", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("mif1heic", "ascii")
]));
const meta = box("meta", Buffer.alloc(64));
const mdat = box("mdat", Buffer.alloc(256, 0x11));
write(
  "signature-only.heic",
  Buffer.concat([ftyp, meta, mdat]),
  "A file with a real HEIC signature but no real image inside - tests identification only"
);

/* ---------------------------------------------------------
   Text, data, and awkward cases.
   --------------------------------------------------------- */
write("empty.txt", Buffer.alloc(0), "A completely empty file");

write(
  "sample-data.csv",
  Buffer.from(
    "name,city,amount,date\n" +
    "Ada Lovelace,London,1240.50,2026-01-14\n" +
    'Grace "Amazing" Hopper,New York,880.00,2026-02-03\n' +
    "Alan Turing,Wilmslow,15.75,2026-03-21\n" +
    "Katherine Johnson,Hampton,9310.25,2026-04-08\n",
    "utf8"
  ),
  "A CSV including a quoted field with a comma trap"
);

write(
  "semicolons-and-latin1.csv",
  Buffer.from("naam;stad;bedrag\nJos\xE9;M\xE1laga;12,50\nRen\xE9e;Z\xFCrich;8,90\n", "latin1"),
  "A CSV with semicolons and old-style text encoding - the classic broken spreadsheet"
);

write(
  "sample-data.json",
  Buffer.from(JSON.stringify({
    note: "A sample JSON file made by On Device.",
    rows: [
      { name: "Ada Lovelace", city: "London", amount: 1240.5 },
      { name: "Grace Hopper", city: "New York", amount: 880 }
    ]
  }, null, 2), "utf8"),
  "A small JSON file"
);

write(
  "sample-notes.md",
  Buffer.from(
    "# Sample notes\n\n" +
    "This file exists so the markdown tool has something to open.\n\n" +
    "## A list\n\n- One\n- Two\n- Three\n\n" +
    "> Nothing here left your machine.\n",
    "utf8"
  ),
  "A markdown file"
);

/* A file pretending to be a PDF. */
write(
  "not-really.pdf",
  Buffer.from("This is just a text file that somebody renamed to .pdf.\n", "utf8"),
  "A text file with a .pdf name"
);

/* A large file, for the memory warning. Written as incompressible
   noise so it is genuinely big rather than big-on-paper. */
const big = Buffer.alloc(120 * 1024 * 1024);
let seed = 123456789;
for (let i = 0; i < big.length; i += 4) {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  big.writeUInt32LE(seed, i);
}
write("large-120mb.bin", big, "A 120 MB file, to test the memory warning and large-file handling");

/* ---- Report --------------------------------------------- */
console.log(`Samples written to samples/:\n`);
for (const w of written) {
  const size = w.bytes >= 1048576
    ? `${(w.bytes / 1048576).toFixed(1)} MB`
    : w.bytes >= 1024
    ? `${(w.bytes / 1024).toFixed(1)} KB`
    : `${w.bytes} B`;
  console.log(`  ${w.name.padEnd(28)} ${size.padStart(9)}   ${w.note}`);
}
