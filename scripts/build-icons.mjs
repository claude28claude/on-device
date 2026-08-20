/* ============================================================
   On Device - icon generator

   Draws every icon the site needs, from scratch, with no image
   libraries and no downloads. Run it with:

       node scripts/build-icons.mjs

   It writes into assets/icons/.
   ============================================================ */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "assets", "icons");
mkdirSync(OUT, { recursive: true });

/* ---- Minimal PNG writer --------------------------------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; /* no per-row filter */
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  /* bit depth */
  ihdr[9] = 6;  /* colour type: RGBA */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---- A tiny drawing surface ----------------------------- */
function surface(w, h, bg = [0, 0, 0, 0]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = bg[3];
  }
  return { w, h, data };
}

function blend(s, x, y, [r, g, b], alpha) {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h || alpha <= 0) return;
  const i = (y * s.w + x) * 4;
  const a = Math.min(1, alpha);
  const dstA = s.data[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  s.data[i] = Math.round((r * a + s.data[i] * dstA * (1 - a)) / outA);
  s.data[i + 1] = Math.round((g * a + s.data[i + 1] * dstA * (1 - a)) / outA);
  s.data[i + 2] = Math.round((b * a + s.data[i + 2] * dstA * (1 - a)) / outA);
  s.data[i + 3] = Math.round(outA * 255);
}

/* Coverage-based anti-aliasing: sample each pixel 3x3.
   Every shape carries its own bounding box so we only ever touch
   the pixels it could possibly cover. */
function fillShape(s, colour, shape) {
  const N = 3;
  const b = shape.bounds;
  const x0 = Math.max(0, Math.floor(b[0]));
  const y0 = Math.max(0, Math.floor(b[1]));
  const x1 = Math.min(s.w - 1, Math.ceil(b[2]));
  const y1 = Math.min(s.h - 1, Math.ceil(b[3]));

  /* A plain axis-aligned rectangle on whole pixels needs no sampling. */
  if (shape.solid) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) blend(s, x, y, colour, 1);
    }
    return;
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hits = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          if (shape.inside(x + (sx + 0.5) / N, y + (sy + 0.5) / N)) hits++;
        }
      }
      if (hits) blend(s, x, y, colour, hits / (N * N));
    }
  }
}

function roundedRect(x0, y0, w, h, r) {
  return {
    bounds: [x0, y0, x0 + w, y0 + h],
    inside(px, py) {
      if (px < x0 || py < y0 || px > x0 + w || py > y0 + h) return false;
      const cx = Math.min(Math.max(px, x0 + r), x0 + w - r);
      const cy = Math.min(Math.max(py, y0 + r), y0 + h - r);
      const dx = px - cx;
      const dy = py - cy;
      return dx * dx + dy * dy <= r * r;
    }
  };
}

function circle(cx, cy, r) {
  return {
    bounds: [cx - r, cy - r, cx + r, cy + r],
    inside(px, py) {
      const dx = px - cx;
      const dy = py - cy;
      return dx * dx + dy * dy <= r * r;
    }
  };
}

function rect(x0, y0, w, h) {
  return {
    bounds: [x0, y0, x0 + w - 1, y0 + h - 1],
    solid: Number.isInteger(x0) && Number.isInteger(y0) &&
           Number.isInteger(w) && Number.isInteger(h),
    inside(px, py) {
      return px >= x0 && py >= y0 && px <= x0 + w && py <= y0 + h;
    }
  };
}

/* ---- Colours -------------------------------------------- */
const ACCENT = [23, 80, 200];
const WHITE = [255, 255, 255];
const DARK = [14, 16, 20];
const MUTED = [167, 171, 181];

/* ---- The mark ------------------------------------------- */
/* A solid rounded square with a hole through the middle: a thing
   with a centre that stays put. Plain, no padlocks, no shields. */
function drawMark(s, x, y, size, { squareColour = ACCENT, holeColour = null } = {}) {
  fillShape(s, squareColour, roundedRect(x, y, size, size, size * 0.23));
  const cx = x + size / 2;
  const cy = y + size / 2;
  if (holeColour) {
    fillShape(s, holeColour, circle(cx, cy, size * 0.185));
  } else {
    /* Punch a hole by clearing alpha, within the circle's bounds only. */
    const hole = circle(cx, cy, size * 0.185);
    const [bx0, by0, bx1, by1] = hole.bounds;
    for (let py = Math.max(0, Math.floor(by0)); py <= Math.min(s.h - 1, Math.ceil(by1)); py++) {
      for (let px = Math.max(0, Math.floor(bx0)); px <= Math.min(s.w - 1, Math.ceil(bx1)); px++) {
        if (hole.inside(px + 0.5, py + 0.5)) {
          const i = (py * s.w + px) * 4;
          s.data[i + 3] = 0;
        }
      }
    }
  }
}

/* ---- A 5x7 block font, for the social image ------------- */
const FONT = {
  A: "01110,10001,10001,11111,10001,10001,10001",
  B: "11110,10001,10001,11110,10001,10001,11110",
  C: "01110,10001,10000,10000,10000,10001,01110",
  D: "11110,10001,10001,10001,10001,10001,11110",
  E: "11111,10000,10000,11110,10000,10000,11111",
  F: "11111,10000,10000,11110,10000,10000,10000",
  G: "01110,10001,10000,10111,10001,10001,01111",
  H: "10001,10001,10001,11111,10001,10001,10001",
  I: "11111,00100,00100,00100,00100,00100,11111",
  J: "00111,00010,00010,00010,00010,10010,01100",
  K: "10001,10010,10100,11000,10100,10010,10001",
  L: "10000,10000,10000,10000,10000,10000,11111",
  M: "10001,11011,10101,10101,10001,10001,10001",
  N: "10001,11001,10101,10011,10001,10001,10001",
  O: "01110,10001,10001,10001,10001,10001,01110",
  P: "11110,10001,10001,11110,10000,10000,10000",
  Q: "01110,10001,10001,10001,10101,10010,01101",
  R: "11110,10001,10001,11110,10100,10010,10001",
  S: "01111,10000,10000,01110,00001,00001,11110",
  T: "11111,00100,00100,00100,00100,00100,00100",
  U: "10001,10001,10001,10001,10001,10001,01110",
  V: "10001,10001,10001,10001,10001,01010,00100",
  W: "10001,10001,10001,10101,10101,11011,10001",
  X: "10001,10001,01010,00100,01010,10001,10001",
  Y: "10001,10001,01010,00100,00100,00100,00100",
  Z: "11111,00001,00010,00100,01000,10000,11111",
  ".": "00000,00000,00000,00000,00000,01100,01100",
  " ": "00000,00000,00000,00000,00000,00000,00000"
};

function drawText(s, text, x, y, cell, colour, gap = 1) {
  let cursor = x;
  for (const raw of text.toUpperCase()) {
    const glyph = FONT[raw];
    if (!glyph) {
      cursor += cell * (5 + gap);
      continue;
    }
    const rows = glyph.split(",");
    for (let ry = 0; ry < rows.length; ry++) {
      for (let rx = 0; rx < rows[ry].length; rx++) {
        if (rows[ry][rx] === "1") {
          fillShape(s, colour, rect(cursor + rx * cell, y + ry * cell, cell, cell));
        }
      }
    }
    cursor += cell * (5 + gap);
  }
  return cursor;
}

function textWidth(text, cell, gap = 1) {
  return text.length * cell * (5 + gap) - cell * gap;
}

/* ---- Write the app icons -------------------------------- */
function appIcon(size, { maskable = false } = {}) {
  const s = surface(size, size, maskable ? [...ACCENT, 255] : [0, 0, 0, 0]);
  if (maskable) {
    /* Maskable icons get cropped to a circle by some launchers, so
       the mark sits inside the safe middle 80%. */
    const inner = size * 0.52;
    const off = (size - inner) / 2;
    fillShape(s, WHITE, roundedRect(off, off, inner, inner, inner * 0.23));
    fillShape(s, ACCENT, circle(size / 2, size / 2, inner * 0.185));
  } else {
    drawMark(s, 0, 0, size, { squareColour: ACCENT, holeColour: WHITE });
  }
  return encodePng(size, size, s.data);
}

const sizes = [32, 180, 192, 256, 512];
for (const size of sizes) {
  writeFileSync(join(OUT, `icon-${size}.png`), appIcon(size));
}
writeFileSync(join(OUT, "icon-maskable-512.png"), appIcon(512, { maskable: true }));

/* ---- The social preview --------------------------------- */
function socialImage() {
  const W = 1200;
  const H = 630;
  const s = surface(W, H, [...DARK, 255]);

  /* A quiet grid, so it does not look like an empty rectangle.
     Written straight into the pixel buffer - no shape machinery needed. */
  const line = (x, y) => {
    const i = (y * W + x) * 4;
    s.data[i] = 26; s.data[i + 1] = 30; s.data[i + 2] = 38; s.data[i + 3] = 255;
  };
  for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y++) line(x, y);
  for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x++) line(x, y);

  drawMark(s, 90, 110, 120, { squareColour: ACCENT, holeColour: DARK });

  const title = "ON DEVICE";
  const cell = 15;
  drawText(s, title, 90, 285, cell, WHITE);

  const tagline = "NOTHING LEAVES THIS PAGE.";
  drawText(s, tagline, 90, 425, 7, [121, 170, 255]);

  const sub = "FILE TOOLS THAT RUN IN YOUR OWN BROWSER";
  drawText(s, sub, 90, 505, 4, MUTED);

  return encodePng(W, H, s.data);
}

writeFileSync(join(OUT, "social.png"), socialImage());

/* ---- The SVG favicon ------------------------------------ */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#1750c8"/>
  <circle cx="32" cy="32" r="12" fill="#ffffff"/>
</svg>
`;
writeFileSync(join(OUT, "favicon.svg"), favicon, "utf8");

/* A monochrome mask icon for Safari's pinned tabs. */
const maskIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M15 2h34a13 13 0 0 1 13 13v34a13 13 0 0 1-13 13H15A13 13 0 0 1 2 49V15A13 13 0 0 1 15 2zm17 18a12 12 0 1 0 0 24 12 12 0 0 0 0-24z" fill="black"/>
</svg>
`;
writeFileSync(join(OUT, "mask-icon.svg"), maskIcon, "utf8");

console.log("Icons written to assets/icons/:");
console.log("  " + [...sizes.map((s) => `icon-${s}.png`), "icon-maskable-512.png", "social.png", "favicon.svg", "mask-icon.svg"].join("\n  "));
