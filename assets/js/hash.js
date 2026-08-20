/* ============================================================
   On Device - checksums

   A checksum is a short fingerprint of a file. If you download
   something and the publisher lists its SHA-256, computing it
   here and comparing tells you the file arrived intact and was
   not tampered with on the way.

   SHA-256 and SHA-1 come from the browser's own cryptography.
   MD5 is written out below, because browsers deliberately do not
   provide it any more - it is broken for security purposes and
   they would rather nobody used it. It is still common for
   checking downloads, so it is here, with that warning attached.

   Large files are read in pieces so a two-gigabyte file does not
   have to fit in memory all at once.
   ============================================================ */

const CHUNK = 8 * 1024 * 1024;

export const ALGORITHMS = {
  "SHA-256": { label: "SHA-256", safe: true, note: "The usual choice. Recommended." },
  "SHA-1": {
    label: "SHA-1",
    safe: false,
    note:
      "Still widely published, but broken: two different files can be made to share " +
      "a SHA-1. Fine for spotting a corrupted download, not for proving a file is genuine."
  },
  "SHA-384": { label: "SHA-384", safe: true, note: "A longer relative of SHA-256." },
  "SHA-512": { label: "SHA-512", safe: true, note: "A longer relative of SHA-256." },
  MD5: {
    label: "MD5",
    safe: false,
    note:
      "Thoroughly broken, and browsers no longer provide it - this one is written into " +
      "the site itself. Use it only to check a download against a published MD5, never " +
      "to prove a file has not been tampered with."
  }
};

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/* ---- The browser's own hashes --------------------------- */
/* WebCrypto has no streaming interface, so a very large file has
   to be assembled first. We say so rather than freezing. */
async function webCryptoHash(file, algorithm, onProgress) {
  if (!crypto || !crypto.subtle) {
    throw new Error(
      "This browser does not provide the cryptography needed. That usually means the " +
      "page is not on a secure address."
    );
  }
  onProgress(0.1);
  const buffer = await file.arrayBuffer();
  onProgress(0.6);
  const digest = await crypto.subtle.digest(algorithm, buffer);
  onProgress(1);
  return toHex(digest);
}

/* ---- MD5, written out ----------------------------------- */
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
}

function rotl(x, c) {
  return (x << c) | (x >>> (32 - c));
}

class Md5 {
  constructor() {
    this.a = 0x67452301;
    this.b = 0xefcdab89;
    this.c = 0x98badcfe;
    this.d = 0x10325476;
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.totalLength = 0;
  }

  update(bytes) {
    this.totalLength += bytes.length;
    let at = 0;

    if (this.bufferLength) {
      const need = 64 - this.bufferLength;
      const take = Math.min(need, bytes.length);
      this.buffer.set(bytes.subarray(0, take), this.bufferLength);
      this.bufferLength += take;
      at = take;
      if (this.bufferLength === 64) {
        this.block(this.buffer);
        this.bufferLength = 0;
      }
    }

    while (at + 64 <= bytes.length) {
      this.block(bytes.subarray(at, at + 64));
      at += 64;
    }

    if (at < bytes.length) {
      this.buffer.set(bytes.subarray(at), 0);
      this.bufferLength = bytes.length - at;
    }
  }

  block(chunk) {
    const m = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      m[i] =
        chunk[i * 4] |
        (chunk[i * 4 + 1] << 8) |
        (chunk[i * 4 + 2] << 16) |
        (chunk[i * 4 + 3] << 24);
    }

    let { a, b, c, d } = this;

    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + MD5_K[i] + m[g]) >>> 0;
      b = (b + rotl(sum, MD5_S[i])) >>> 0;
      a = temp;
    }

    this.a = (this.a + a) >>> 0;
    this.b = (this.b + b) >>> 0;
    this.c = (this.c + c) >>> 0;
    this.d = (this.d + d) >>> 0;
  }

  digest() {
    const bitLength = this.totalLength * 8;
    const padded = new Uint8Array(this.bufferLength + 72);
    padded.set(this.buffer.subarray(0, this.bufferLength));
    padded[this.bufferLength] = 0x80;

    let size = this.bufferLength + 1;
    while (size % 64 !== 56) size++;

    const view = new DataView(padded.buffer);
    view.setUint32(size, bitLength >>> 0, true);
    view.setUint32(size + 4, Math.floor(bitLength / 4294967296), true);

    for (let at = 0; at < size + 8; at += 64) {
      this.block(padded.subarray(at, at + 64));
    }

    const out = new Uint8Array(16);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, this.a, true);
    dv.setUint32(4, this.b, true);
    dv.setUint32(8, this.c, true);
    dv.setUint32(12, this.d, true);
    return toHex(out.buffer);
  }
}

async function md5Hash(file, onProgress) {
  const hasher = new Md5();
  let read = 0;
  while (read < file.size) {
    const slice = file.slice(read, Math.min(read + CHUNK, file.size));
    const bytes = new Uint8Array(await slice.arrayBuffer());
    hasher.update(bytes);
    read += bytes.length;
    onProgress(read / file.size);
    /* Let the interface breathe between chunks. */
    await new Promise((r) => setTimeout(r, 0));
  }
  return hasher.digest();
}

/* ---- The entry point ------------------------------------ */
export async function hashFile(file, algorithm, onProgress = () => {}) {
  if (algorithm === "MD5") return md5Hash(file, onProgress);
  return webCryptoHash(file, algorithm, onProgress);
}

/* ---- Comparing two files -------------------------------- */
/* Compares in pieces and stops at the first difference, so two
   large files that differ near the start finish immediately. */
export async function compareFiles(a, b, onProgress = () => {}) {
  if (a.size !== b.size) {
    return {
      identical: false,
      reason: "different-size",
      message:
        `They are different sizes: ${a.size.toLocaleString()} bytes against ` +
        `${b.size.toLocaleString()} bytes. They cannot be identical.`,
      firstDifference: null
    };
  }

  let at = 0;
  while (at < a.size) {
    const end = Math.min(at + CHUNK, a.size);
    const [ab, bb] = await Promise.all([
      a.slice(at, end).arrayBuffer(),
      b.slice(at, end).arrayBuffer()
    ]);
    const av = new Uint8Array(ab);
    const bv = new Uint8Array(bb);

    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) {
        return {
          identical: false,
          reason: "different-content",
          firstDifference: at + i,
          message:
            `The same size, but the contents differ. The first difference is at byte ` +
            `${(at + i).toLocaleString()} of ${a.size.toLocaleString()}.`
        };
      }
    }

    at = end;
    onProgress(at / a.size);
  }

  return {
    identical: true,
    reason: "identical",
    firstDifference: null,
    message: `Byte for byte identical. All ${a.size.toLocaleString()} bytes match.`
  };
}
