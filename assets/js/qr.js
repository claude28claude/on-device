/* ============================================================
   On Device - making QR codes

   Written here rather than borrowed, for two reasons: the popular
   library ships no ready-to-use browser build, and a QR code is a
   well-defined thing that can be checked. Everything this file
   produces is tested by decoding it again with a completely
   separate library and comparing.

   Supports byte mode (which covers any text, including accents
   and other alphabets via UTF-8), versions 1 to 40, and all four
   error-correction levels.
   ============================================================ */

/* ---- Galois field arithmetic, for the error correction ---
   Reed-Solomon works in a number system where there are only 256
   values and arithmetic wraps around. These two tables make
   multiplication fast. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/* The divisor polynomial for a given number of check bytes. */
function generatorPoly(count) {
  let poly = [1];
  for (let i = 0; i < count; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data, count) {
  const poly = generatorPoly(count);
  const result = new Uint8Array(data.length + count);
  result.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = result[i];
    if (factor === 0) continue;
    for (let j = 1; j < poly.length; j++) {
      result[i + j] ^= gfMul(poly[j], factor);
    }
  }
  return result.slice(data.length);
}

/* ---- Capacity tables ------------------------------------
   For each version (1-40) and each error-correction level, how the
   data is split into blocks and how many check bytes each has.
   Taken from the QR specification. */
const EC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };

/* [total codewords, ec codewords per block, group1 blocks, group1 data,
    group2 blocks, group2 data] for each version and level. */
const BLOCKS = {
  L: [[26,7,1,19,0,0],[44,10,1,34,0,0],[70,15,1,55,0,0],[100,20,1,80,0,0],[134,26,1,108,0,0],[172,18,2,68,0,0],[196,20,2,78,0,0],[242,24,2,97,0,0],[292,30,2,116,0,0],[346,18,2,68,2,69],[404,20,4,81,0,0],[466,24,2,92,2,93],[532,26,4,107,0,0],[581,30,3,115,1,116],[655,22,5,87,1,88],[733,24,5,98,1,99],[815,28,1,107,5,108],[901,30,5,120,1,121],[991,28,3,113,4,114],[1085,28,3,107,5,108],[1156,28,4,116,4,117],[1258,28,2,111,7,112],[1364,30,4,121,5,122],[1474,30,6,117,4,118],[1588,26,8,106,4,107],[1706,28,10,114,2,115],[1828,30,8,122,4,123],[1921,30,3,117,10,118],[2051,30,7,116,7,117],[2185,30,5,115,10,116],[2323,30,13,115,3,116],[2465,30,17,115,0,0],[2611,30,17,115,1,116],[2761,30,13,115,6,116],[2876,30,12,121,7,122],[3034,30,6,121,14,122],[3196,30,17,122,4,123],[3362,30,4,122,18,123],[3532,30,20,117,4,118],[3706,30,19,118,6,119]],
  M: [[26,10,1,16,0,0],[44,16,1,28,0,0],[70,26,1,44,0,0],[100,18,2,32,0,0],[134,24,2,43,0,0],[172,16,4,27,0,0],[196,18,4,31,0,0],[242,22,2,38,2,39],[292,22,3,36,2,37],[346,26,4,43,1,44],[404,30,1,50,4,51],[466,22,6,36,2,37],[532,22,8,37,1,38],[581,24,4,40,5,41],[655,24,5,41,5,42],[733,28,7,45,3,46],[815,28,10,46,1,47],[901,26,9,43,4,44],[991,26,3,44,11,45],[1085,26,3,41,13,42],[1156,26,17,42,0,0],[1258,28,17,46,0,0],[1364,28,4,47,14,48],[1474,28,6,45,14,46],[1588,28,8,47,13,48],[1706,28,19,46,4,47],[1828,28,22,45,3,46],[1921,28,3,45,23,46],[2051,28,21,45,7,46],[2185,28,19,47,10,48],[2323,28,2,46,29,47],[2465,28,10,46,23,47],[2611,28,14,46,21,47],[2761,28,14,46,23,47],[2876,28,12,47,26,48],[3034,28,6,47,34,48],[3196,28,29,46,14,47],[3362,28,13,46,32,47],[3532,28,40,47,7,48],[3706,28,18,47,31,48]],
  Q: [[26,13,1,13,0,0],[44,22,1,22,0,0],[70,18,2,17,0,0],[100,26,2,24,0,0],[134,18,2,15,2,16],[172,24,4,19,0,0],[196,18,2,14,4,15],[242,22,4,18,2,19],[292,20,4,16,4,17],[346,24,6,19,2,20],[404,28,4,22,4,23],[466,26,4,20,6,21],[532,24,8,20,4,21],[581,20,11,16,5,17],[655,30,5,24,7,25],[733,24,15,19,2,20],[815,28,1,22,15,23],[901,28,17,22,1,23],[991,26,17,21,4,22],[1085,30,15,24,5,25],[1156,28,17,22,6,23],[1258,30,7,24,16,25],[1364,30,11,24,14,25],[1474,30,11,24,16,25],[1588,30,7,24,22,25],[1706,28,28,22,6,23],[1828,30,8,23,26,24],[1921,30,4,24,31,25],[2051,30,1,23,37,24],[2185,30,15,24,25,25],[2323,30,42,24,1,25],[2465,30,10,24,35,25],[2611,30,29,24,19,25],[2761,30,44,24,7,25],[2876,30,39,24,14,25],[3034,30,46,24,10,25],[3196,30,49,24,10,25],[3362,30,48,24,14,25],[3532,30,43,24,22,25],[3706,30,34,24,34,25]],
  H: [[26,17,1,9,0,0],[44,28,1,16,0,0],[70,22,2,13,0,0],[100,16,4,9,0,0],[134,22,2,11,2,12],[172,28,4,15,0,0],[196,26,4,13,1,14],[242,26,4,14,2,15],[292,24,4,12,4,13],[346,28,6,15,2,16],[404,24,3,12,8,13],[466,28,7,14,4,15],[532,22,12,11,4,12],[581,24,11,12,5,13],[655,24,11,12,7,13],[733,30,3,15,13,16],[815,28,2,14,17,15],[901,28,2,14,19,15],[991,26,9,13,16,14],[1085,28,15,15,10,16],[1156,30,19,16,6,17],[1258,24,34,13,0,0],[1364,30,16,15,14,16],[1474,30,30,16,2,17],[1588,30,22,15,13,16],[1706,30,33,16,4,17],[1828,30,12,15,28,16],[1921,30,11,15,31,16],[2051,30,19,15,26,16],[2185,30,23,15,25,16],[2323,30,23,15,28,16],[2465,30,19,15,35,16],[2611,30,11,15,46,16],[2761,30,59,16,1,17],[2876,30,22,15,41,16],[3034,30,2,15,64,16],[3196,30,24,15,46,16],[3362,30,42,15,32,16],[3532,30,10,15,67,16],[3706,30,20,15,61,16]]
};

/* Where the alignment squares go, per version: ALIGNMENT[version - 1]
   is the list of centre coordinates, and a square is drawn at every
   crossing of two of them except where it would sit on a finder.

   This table was wrong in two ways until Phase 12. It had an extra
   empty row at the front, so every version from 2 upwards was given
   the previous version's squares - and version 2 was given none at
   all. Version 31's row was missing outright. The result still looked
   like a QR code and our own reader still understood it; no real
   scanner could. Every row below has been checked against a reference
   encoder. */
const ALIGNMENT = [
  [],                        [6, 18],                   [6, 22],
  [6, 26],                   [6, 30],                   [6, 34],
  [6, 22, 38],               [6, 24, 42],               [6, 26, 46],
  [6, 28, 50],               [6, 30, 54],               [6, 32, 58],
  [6, 34, 62],               [6, 26, 46, 66],           [6, 26, 48, 70],
  [6, 26, 50, 74],           [6, 30, 54, 78],           [6, 30, 56, 82],
  [6, 30, 58, 86],           [6, 34, 62, 90],           [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],       [6, 30, 54, 78, 102],      [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],      [6, 30, 58, 86, 114],      [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],  [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170]
];

/* The BCH generator polynomials used to protect the format and version
   information, and the fixed mask applied to the format bits afterwards.
   These are three different constants and mixing them up produces a code
   that scanners cannot read at all - which is exactly what happened the
   first time. */
const FORMAT_GENERATOR = 0x537;
const FORMAT_MASK = 0x5412;
const VERSION_GENERATOR = 0x1f25;

/* ---- Building the code ---------------------------------- */
function chooseVersion(byteLength, level) {
  for (let version = 1; version <= 40; version++) {
    const [, ecPerBlock, g1, g1d, g2, g2d] = BLOCKS[level][version - 1];
    const capacity = g1 * g1d + g2 * g2d;
    /* Mode indicator (4 bits) + length (8 or 16 bits) + data. */
    const lengthBits = version < 10 ? 8 : 16;
    const needed = Math.ceil((4 + lengthBits) / 8) + byteLength;
    if (capacity >= needed) return version;
  }
  return null;
}

function buildData(bytes, version, level) {
  const [, ecPerBlock, g1, g1d, g2, g2d] = BLOCKS[level][version - 1];
  const totalData = g1 * g1d + g2 * g2d;

  const bits = [];
  const push = (value, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);                                  /* byte mode */
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  /* Terminator, then pad to a whole number of bytes. */
  const capacityBits = totalData * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }

  /* The specification's alternating pad bytes. */
  const PADS = [0xec, 0x11];
  let padAt = 0;
  while (data.length < totalData) data.push(PADS[padAt++ % 2]);

  /* Split into blocks, work out the check bytes for each, then
     interleave them the way the specification requires. */
  const blocks = [];
  let at = 0;
  for (let i = 0; i < g1; i++) {
    const chunk = data.slice(at, at + g1d);
    at += g1d;
    blocks.push({ data: chunk, ec: errorCorrection(Uint8Array.from(chunk), ecPerBlock) });
  }
  for (let i = 0; i < g2; i++) {
    const chunk = data.slice(at, at + g2d);
    at += g2d;
    blocks.push({ data: chunk, ec: errorCorrection(Uint8Array.from(chunk), ecPerBlock) });
  }

  const out = [];
  const maxData = Math.max(g1d, g2d);
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) {
      if (i < block.data.length) out.push(block.data[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of blocks) out.push(block.ec[i]);
  }

  return out;
}

/* ---- The grid ------------------------------------------- */
function makeMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const onEdge = r === -1 || r === 7 || c === -1 || c === 7;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const ring = (r === 0 || r === 6) && c >= 0 && c <= 6;
        const sides = (c === 0 || c === 6) && r >= 0 && r <= 6;
        modules[rr][cc] = onEdge ? 0 : (inner || ring || sides ? 1 : 0);
        reserved[rr][cc] = true;
      }
    }
  };

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  /* Timing lines. */
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0 ? 1 : 0;
    modules[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  /* Alignment squares. */
  const centres = ALIGNMENT[version - 1];
  for (const r of centres) {
    for (const c of centres) {
      const nearFinder =
        (r <= 8 && c <= 8) ||
        (r <= 8 && c >= size - 9) ||
        (r >= size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          modules[r + dr][c + dc] = on ? 1 : 0;
          reserved[r + dr][c + dc] = true;
        }
      }
    }
  }

  /* The dark module, always set. */
  modules[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  /* Reserve the format areas. */
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) { reserved[8][i] = true; modules[8][i] = 0; }
    if (!reserved[i][8]) { reserved[i][8] = true; modules[i][8] = 0; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    modules[8][size - 1 - i] = 0;
    reserved[size - 1 - i][8] = true;
    modules[size - 1 - i][8] = 0;
  }

  /* Version information, for version 7 and above. */
  if (version >= 7) {
    let value = version;
    for (let i = 0; i < 12; i++) {
      value = (value << 1) ^ ((value >> 11) * VERSION_GENERATOR);
    }
    const bits = (version << 12) | value;
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      modules[r][c] = bit;
      reserved[r][c] = true;
      modules[c][r] = bit;
      reserved[c][r] = true;
    }
  }

  return { size, modules, reserved };
}

function placeData(grid, codewords) {
  const { size, modules, reserved } = grid;
  let bitAt = 0;
  const totalBits = codewords.length * 8;
  const bitAtIndex = (i) => (i < totalBits ? (codewords[i >> 3] >> (7 - (i & 7))) & 1 : 0);

  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;   /* skip the timing column */
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (reserved[row][col]) continue;
        modules[row][col] = bitAtIndex(bitAt++);
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

function applyMask(grid, maskIndex) {
  const { size, modules, reserved } = grid;
  const mask = MASKS[maskIndex];
  const out = modules.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if (mask(r, c)) out[r][c] ^= 1;
    }
  }
  return out;
}

function writeFormat(modules, size, level, maskIndex) {
  const levelBits = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }[level];
  const data = (levelBits << 3) | maskIndex;
  let value = data;
  for (let i = 0; i < 10; i++) {
    value = (value << 1) ^ ((value >> 9) * FORMAT_GENERATOR);
  }
  const bits = ((data << 10) | value) ^ FORMAT_MASK;

  /* Where each of the 15 bits goes. Getting this wrong is invisible:
     the code still looks like a QR code, and our own reader still
     understood it, because it made the same mistake in reverse. Only a
     real scanner notices - it reads the format, gets the wrong mask,
     unmasks with it, and the error correction then fails.

     The positions below were checked against a reference encoder, one
     bit at a time. See PROGRESS.md, Phase 12. */
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;

    /* Copy one, wrapped round the top-left finder: bits 0 to 5 run
       down column 8, then across row 8 to the left. */
    if (i < 6) modules[i][8] = bit;
    else if (i === 6) modules[7][8] = bit;
    else if (i === 7) modules[8][8] = bit;
    else if (i === 8) modules[8][7] = bit;
    else modules[8][14 - i] = bit;

    /* Copy two: bits 0 to 7 run leftwards along row 8 from the right
       edge, then 8 to 14 run down column 8 to the bottom edge. Note
       this is the opposite way round from copy one. */
    if (i < 8) modules[8][size - 1 - i] = bit;
    else modules[size - 15 + i][8] = bit;
  }

  /* The "dark module" - one square that is always black, just above
     the bottom-left copy of the format. It is not part of the format
     itself, and the old code was overwriting it with a format bit. */
  modules[size - 8][8] = 1;
}

/* How ugly is this masking? Lower is better. */
function penalty(modules, size) {
  let score = 0;

  /* Runs of five or more the same. */
  const runScore = (get) => {
    let total = 0;
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) {
          run++;
        } else {
          if (run >= 5) total += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) total += 3 + (run - 5);
    }
    return total;
  };
  score += runScore((r, c) => modules[r][c]);
  score += runScore((c, r) => modules[r][c]);

  /* Two-by-two blocks of the same colour. */
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  /* Patterns that look like a finder. */
  const pattern = [1, 0, 1, 1, 1, 0, 1];
  const matches = (get, a, b) => {
    for (let i = 0; i < 7; i++) if (get(a, b + i) !== pattern[i]) return false;
    return true;
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 6; c++) {
      if (matches((x, y) => modules[x][y], r, c)) score += 40;
      if (matches((x, y) => modules[y][x], r, c)) score += 40;
    }
  }

  /* Too much or too little dark. */
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += modules[r][c];
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/* ---- The public call ------------------------------------ */
export function encodeQr(text, { level = "M" } = {}) {
  if (!EC_LEVELS.hasOwnProperty(level)) level = "M";
  const bytes = new TextEncoder().encode(String(text));

  if (!bytes.length) {
    throw new Error("There is nothing to put in the code. Type something first.");
  }

  const version = chooseVersion(bytes.length, level);
  if (!version) {
    throw new Error(
      `That is too much text for a QR code at this error-correction level — ` +
      `${bytes.length} bytes. The most a QR code can hold is about 2,900 bytes at the ` +
      `lowest correction level, and far less at the highest. Shorten it, or choose a ` +
      `lower correction level.`
    );
  }

  const codewords = buildData(bytes, version, level);
  const grid = makeMatrix(version);
  placeData(grid, codewords);

  /* Try all eight masks and keep the tidiest. */
  let best = null;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(grid, m);
    writeFormat(masked, grid.size, level, m);
    const score = penalty(masked, grid.size);
    if (!best || score < best.score) best = { score, modules: masked, mask: m };
  }

  return {
    size: grid.size,
    modules: best.modules,
    version,
    level,
    mask: best.mask,
    byteLength: bytes.length
  };
}

/* ---- Drawing it ----------------------------------------- */
export function qrToCanvas(qr, {
  scale = 8,
  margin = 4,
  dark = "#000000",
  light = "#ffffff",
  canvas = null
} = {}) {
  const pixels = (qr.size + margin * 2) * scale;
  const target = canvas || (typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(pixels, pixels)
    : document.createElement("canvas"));
  target.width = pixels;
  target.height = pixels;

  const ctx = target.getContext("2d");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.fillStyle = dark;

  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) {
        ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
  }
  return target;
}

export function qrToSvg(qr, { margin = 4, dark = "#000000", light = "#ffffff" } = {}) {
  const size = qr.size + margin * 2;
  const parts = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) parts.push(`M${c + margin} ${r + margin}h1v1h-1z`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" width="${size * 8}" height="${size * 8}">` +
    `<rect width="${size}" height="${size}" fill="${light}"/>` +
    `<path fill="${dark}" d="${parts.join("")}"/>` +
    `</svg>`
  );
}

/* ---- The everyday formats people actually want ---------- */
export function wifiString({ ssid, password, security = "WPA", hidden = false }) {
  const esc = (s) => String(s || "").replace(/([\\;,":])/g, "\\$1");
  return `WIFI:T:${security};S:${esc(ssid)};P:${esc(password)};${hidden ? "H:true;" : ""};`;
}

export function contactString({ name, phone, email, organisation, url }) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  if (name) {
    lines.push(`N:${name}`, `FN:${name}`);
  }
  if (organisation) lines.push(`ORG:${organisation}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (url) lines.push(`URL:${url}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function emailString({ to, subject, body }) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to || ""}${params.length ? "?" + params.join("&") : ""}`;
}
