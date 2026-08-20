/* ============================================================
   On Device - PDF passwords

   Adding a password to a PDF, and removing one when you already
   know it.

   This is the one PDF job pdf-lib cannot do, so it uses qpdf -
   the long-standing tool for exactly this - compiled to
   WebAssembly and run here, in this tab.

   Said plainly, because it matters: On Device cannot open a
   document you do not have the password for. There is no
   guessing, no cracking, no bypass, and none is planned. The
   remove tool decrypts a file using a password you supply, so
   that a document you already own stops asking for it.
   ============================================================ */

const QPDF_URL = new URL("../../vendor/qpdf/qpdf.mjs", import.meta.url);
const QPDF_DIR = new URL("../../vendor/qpdf/", import.meta.url);

let factoryPromise = null;

/* qpdf is about 1.3 MB and only arrives when a password tool is used. */
export async function loadQpdf(onProgress = () => {}) {
  if (factoryPromise) return factoryPromise;

  factoryPromise = (async () => {
    /* Count the WebAssembly download so the wait is not a mystery. */
    try {
      const response = await fetch(new URL("qpdf.wasm", QPDF_DIR));
      if (response.ok && response.body && response.body.getReader) {
        const total = Number(response.headers.get("content-length")) || 1345000;
        const reader = response.body.getReader();
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += value.length;
          onProgress({ loaded: got, total, fraction: Math.min(1, got / total) });
        }
      }
    } catch (err) {
      /* The real load happens below; this was only to show progress. */
    }

    const mod = await import(QPDF_URL.href);
    return mod.default;
  })();

  return factoryPromise;
}

/* Run one qpdf command over one file, entirely in memory. */
async function runQpdf(args, inputBytes, { onProgress } = {}) {
  const factory = await loadQpdf(onProgress);

  const messages = [];
  const instance = await factory({
    noInitialRun: true,
    print: (line) => messages.push(String(line)),
    printErr: (line) => messages.push(String(line)),
    /* Tell Emscripten where our copy of the WebAssembly lives, rather
       than letting it guess at a path that would not exist here. */
    locateFile: (path) => new URL(path, QPDF_DIR).href
  });

  instance.FS.writeFile("/in.pdf", inputBytes);

  let status = 0;
  try {
    status = instance.callMain(args);
  } catch (err) {
    /* Emscripten throws an ExitStatus object rather than returning. */
    status = err && typeof err.status === "number" ? err.status : 1;
  }

  let output = null;
  try {
    output = instance.FS.readFile("/out.pdf");
  } catch (err) {
    output = null;
  }

  return { status: status || 0, output, messages };
}

/* Turn a failure into something a person can act on.

   This build of qpdf prints nothing at all - it only returns an exit
   code - so the reason has to be worked out here rather than read off
   a message. Checked by running each case: a wrong password and a
   corrupt file both come back as exit code 2 with silence. */
function explain({ status, messages, wasEncrypted, gavePassword }, fallback) {
  const text = messages.join(" ").trim();

  if (text) {
    if (/invalid password/i.test(text)) {
      return "That password did not open the document. Passwords are case-sensitive.";
    }
    if (/not encrypted/i.test(text)) {
      return "That PDF does not have a password on it, so there is nothing to remove.";
    }
    if (/damaged|not a (valid )?pdf|startxref/i.test(text)) {
      return "That file is damaged and could not be read. It may be incomplete.";
    }
  }

  if (wasEncrypted && gavePassword) {
    return (
      "That password did not open the document. Passwords are case-sensitive, and " +
      "spaces at the start or end count. On Device cannot guess or bypass a password, " +
      "so the right one is the only way in."
    );
  }

  if (wasEncrypted && !gavePassword) {
    return "This document is protected. Enter its password to continue.";
  }

  return (
    fallback +
    " The file may be damaged, or it may not really be a PDF." +
    (text ? ` The engine said: ${text.slice(0, 240)}` : "") +
    (status ? ` (code ${status})` : "")
  );
}

/* ---- Add a password ------------------------------------- */
/* userPassword opens the document. ownerPassword controls whether it
   can be printed or copied; when left empty we reuse the user
   password, which is what most people expect. */
export async function addPassword(file, {
  userPassword,
  ownerPassword = "",
  allowPrinting = true,
  allowCopying = false,
  onProgress = () => {}
} = {}) {
  if (!userPassword) {
    throw new Error("Enter a password first. An empty password protects nothing.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const owner = ownerPassword || userPassword;

  const args = [
    "--encrypt", userPassword, owner, "256",
    `--print=${allowPrinting ? "full" : "none"}`,
    `--extract=${allowCopying ? "y" : "n"}`,
    "--", "/in.pdf", "/out.pdf"
  ];

  const already = await isEncrypted(file);
  if (already) {
    throw new Error(
      "This PDF already has a password on it. Remove the existing one first, then add " +
      "the new password."
    );
  }

  const { status, output, messages } = await runQpdf(args, bytes, { onProgress });

  if (status !== 0 || !output || !output.length) {
    throw new Error(
      explain(
        { status, messages, wasEncrypted: already, gavePassword: true },
        "The password could not be added."
      )
    );
  }

  return {
    blob: new Blob([output], { type: "application/pdf" }),
    warnings: status === 3 ? messages : []
  };
}

/* ---- Remove a password ---------------------------------- */
export async function removePassword(file, { password, onProgress = () => {} } = {}) {
  if (!password) {
    throw new Error(
      "Enter the document's password. On Device cannot open a PDF without it — " +
      "there is no guessing and no bypass here."
    );
  }

  /* Say "there is no password on this" before doing any work, rather
     than handing back a file that looks unchanged and leaving the
     visitor wondering whether it worked. */
  const wasEncrypted = await isEncrypted(file);
  if (!wasEncrypted) {
    throw new Error(
      "That PDF does not have a password on it, so there is nothing to remove. " +
      "It already opens without one."
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const args = [`--password=${password}`, "--decrypt", "/in.pdf", "/out.pdf"];
  const { status, output, messages } = await runQpdf(args, bytes, { onProgress });

  if (status !== 0 || !output || !output.length) {
    throw new Error(
      explain(
        { status, messages, wasEncrypted, gavePassword: Boolean(password) },
        "The password could not be removed."
      )
    );
  }

  return {
    blob: new Blob([output], { type: "application/pdf" }),
    warnings: status === 3 ? messages : []
  };
}

/* ---- Is this document encrypted at all? ----------------- */
export async function isEncrypted(file) {
  /* The reference that says "this document is encrypted" lives in the
     trailer, which sits at the END of a PDF - so looking only at the
     beginning misses it on most real files. We check both ends. */
  const headSlice = file.slice(0, 8192);
  const tailStart = Math.max(0, file.size - 16384);
  const tailSlice = file.slice(tailStart);

  const [headBytes, tailBytes] = await Promise.all([
    headSlice.arrayBuffer(),
    tailSlice.arrayBuffer()
  ]);

  const head = new Uint8Array(headBytes);
  const tail = new Uint8Array(tailBytes);

  const asText = (bytes) => {
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  };

  return /\/Encrypt\b/.test(asText(head)) || /\/Encrypt\b/.test(asText(tail));
}

