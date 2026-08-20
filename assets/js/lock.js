/* ============================================================
   On Device - locking a file with a password

   Encrypts any file so it can be emailed or carried on a USB
   stick without being readable, and unlocks it again here.

   Uses the browser's own cryptography - AES-GCM with a key
   stretched from your password by PBKDF2 - so there is no
   encryption library to trust, and no clever scheme invented
   here. This is the same machinery a bank's website uses,
   already built into your browser.

   THE WARNING THAT MATTERS: a forgotten password means the file
   is gone. Not "gone until you contact support" - gone. There is
   no server, no recovery key, no back door, and nobody anywhere
   who can help. That is what makes it secure, and it is also the
   risk.

   The file format is written out in full below so that anyone
   could write their own unlocker if this site ever disappeared.
   ============================================================ */

const MAGIC = "ONDEVLK1";       /* 8 bytes, so a locked file is recognisable */
const ITERATIONS = 310000;      /* PBKDF2 rounds - deliberately slow to attack */
const SALT_BYTES = 16;
const IV_BYTES = 12;

/* ---- The file layout ------------------------------------
   offset  size  what
   0       8     "ONDEVLK1"
   8       1     version (1)
   9       4     length of the original filename, big-endian
   13      n     the original filename, UTF-8
   13+n    16    salt
   29+n    12    nonce
   41+n    4     PBKDF2 iterations, big-endian
   45+n    rest  the encrypted file, AES-GCM, tag included
   --------------------------------------------------------- */

export const FORMAT_NOTE =
  'A locked file starts with the text "ONDEVLK1", then the original ' +
  "filename, a random salt and nonce, the iteration count, and the encrypted " +
  "contents (AES-256-GCM). The layout is documented in assets/js/lock.js so " +
  "anyone could write their own unlocker.";

function assertCrypto() {
  if (!globalThis.crypto || !crypto.subtle) {
    throw new Error(
      "This browser does not provide the cryptography needed to lock files. " +
      "That usually means the page is not on a secure address. Use a current " +
      "version of Chrome, Edge, Firefox or Safari."
    );
  }
}

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

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

function u32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

/* ---- Lock ------------------------------------------------ */
export async function lockFile(file, password, { onProgress = () => {} } = {}) {
  assertCrypto();
  if (!password) {
    throw new Error("Enter a password. An empty password protects nothing.");
  }

  onProgress({ stage: "reading", fraction: 0.05 });
  const plain = new Uint8Array(await file.arrayBuffer());

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  onProgress({ stage: "stretching the password", fraction: 0.2 });
  const key = await deriveKey(password, salt, ITERATIONS);

  onProgress({ stage: "encrypting", fraction: 0.6 });
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  );

  const nameBytes = new TextEncoder().encode(file.name || "file");
  const out = concat([
    new TextEncoder().encode(MAGIC),
    new Uint8Array([1]),
    u32(nameBytes.length),
    nameBytes,
    salt,
    iv,
    u32(ITERATIONS),
    cipher
  ]);

  onProgress({ stage: "done", fraction: 1 });

  return {
    blob: new Blob([out], { type: "application/octet-stream" }),
    name: `${file.name || "file"}.ondevice`,
    originalSize: plain.length,
    lockedSize: out.length
  };
}

/* ---- Is this one of ours? ------------------------------- */
export async function isLocked(file) {
  if (file.size < 45) return false;
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return new TextDecoder().decode(head) === MAGIC;
}

/* Read the original filename without needing the password. */
export async function peek(file) {
  if (!(await isLocked(file))) return null;
  const head = new Uint8Array(await file.slice(0, 13).arrayBuffer());
  const nameLength = new DataView(head.buffer).getUint32(9, false);
  if (nameLength > 4096) return null;
  const nameBytes = new Uint8Array(await file.slice(13, 13 + nameLength).arrayBuffer());
  return {
    originalName: new TextDecoder().decode(nameBytes),
    version: head[8]
  };
}

/* ---- Unlock ---------------------------------------------- */
export async function unlockFile(file, password, { onProgress = () => {} } = {}) {
  assertCrypto();
  if (!password) throw new Error("Enter the password this file was locked with.");

  if (!(await isLocked(file))) {
    throw new Error(
      `“${file.name}” is not a file locked by On Device. Locked files start with ` +
      `the text “${MAGIC}” and normally end in .ondevice.`
    );
  }

  onProgress({ stage: "reading", fraction: 0.05 });
  const all = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(all.buffer);

  const version = all[8];
  if (version !== 1) {
    throw new Error(
      `This file was locked by a newer version of On Device (format ${version}). ` +
      `Update the site and try again.`
    );
  }

  const nameLength = view.getUint32(9, false);
  let at = 13;
  const originalName = new TextDecoder().decode(all.slice(at, at + nameLength));
  at += nameLength;

  const salt = all.slice(at, at + SALT_BYTES);
  at += SALT_BYTES;
  const iv = all.slice(at, at + IV_BYTES);
  at += IV_BYTES;
  const iterations = view.getUint32(at, false);
  at += 4;
  const cipher = all.slice(at);

  if (!cipher.length) {
    throw new Error("That locked file is empty or truncated — there is nothing inside it.");
  }

  onProgress({ stage: "stretching the password", fraction: 0.25 });
  const key = await deriveKey(password, salt, iterations);

  onProgress({ stage: "decrypting", fraction: 0.7 });
  let plain;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
  } catch (err) {
    /* AES-GCM refuses to hand back anything if the password is wrong OR
       the file has been altered. Both matter, so say both. */
    throw new Error(
      "That did not unlock the file. Either the password is wrong — they are " +
      "case-sensitive — or the file has been damaged or changed since it was locked. " +
      "There is no way to tell which, and no way around it: nobody can open this " +
      "without the right password."
    );
  }

  onProgress({ stage: "done", fraction: 1 });

  return {
    blob: new Blob([plain]),
    name: originalName || "unlocked-file",
    size: plain.length
  };
}

/* ---- How long would this take to guess? ----------------- */
/* A rough, honest read rather than a score. */
export function judgePassword(password) {
  if (!password) return { text: "Nothing typed yet.", level: "none" };

  const length = password.length;
  const kinds =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 1 : 0);

  if (length < 8) {
    return {
      level: "weak",
      text:
        `${length} characters. Somebody who has your file can try passwords as fast ` +
        `as their computer allows. This is short enough to be worked through. Use at ` +
        `least twelve.`
    };
  }
  if (length < 12) {
    return {
      level: "fair",
      text:
        `${length} characters, ${kinds} kind${kinds === 1 ? "" : "s"} of character. ` +
        `Fair. Length helps more than punctuation does — four unrelated words beat ` +
        `one word with symbols in it.`
    };
  }
  return {
    level: "strong",
    text:
      `${length} characters, ${kinds} kind${kinds === 1 ? "" : "s"} of character. ` +
      `Strong. Now make sure you can remember it, because nobody can recover it.`
  };
}
