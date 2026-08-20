/* ============================================================
   On Device - fetching the PDF machinery, once

   Working with PDFs needs two large libraries. Together they are
   several megabytes, which would be a rude thing to download onto
   somebody who only wanted to resize a photograph. So they are
   left out of the first visit entirely and fetched the first time
   a PDF tool is opened.

   After that they are kept on this device and never downloaded
   again - including with the internet switched off.

   The progress shown while they arrive is real: it counts the
   bytes as they land, rather than animating a bar and hoping.
   ============================================================ */

const BASE = new URL("../../vendor/", import.meta.url);

const PARTS = {
  pdfLib: { url: new URL("pdf-lib/pdf-lib.esm.min.js", BASE), bytes: 523417, label: "PDF writer" },
  pdfJs: { url: new URL("pdfjs/pdf.min.mjs", BASE), bytes: 394119, label: "PDF reader" },
  pdfJsWorker: { url: new URL("pdfjs/pdf.worker.min.mjs", BASE), bytes: 1039207, label: "PDF reader engine" }
};

let loadPromise = null;
let loaded = null;

/* ---- Fetching with honest progress ---------------------- */
async function fetchCounting(url, expectedBytes, onBytes) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Part of the PDF machinery could not be loaded (${response.status}). ` +
      `If you are offline and have not used a PDF tool before, connect once and it ` +
      `will be saved for good.`
    );
  }

  /* Reading the stream lets us count. If the browser will not give us a
     stream, we still get the file - just without a moving number. */
  if (!response.body || !response.body.getReader) {
    await response.arrayBuffer();
    onBytes(expectedBytes);
    return;
  }

  const reader = response.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    onBytes(received);
  }
}

/* ---- The public call ------------------------------------ */
/* onProgress receives { loaded, total, fraction, label }. */
export function loadPdfEngine(onProgress = () => {}) {
  if (loaded) return Promise.resolve(loaded);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const total = Object.values(PARTS).reduce((n, p) => n + p.bytes, 0);
    const progress = {};
    const report = (label) => {
      const done = Object.values(progress).reduce((n, v) => n + v, 0);
      onProgress({
        loaded: done,
        total,
        fraction: Math.min(1, done / total),
        label
      });
    };

    /* Pull the files down first, counting as they arrive. The service
       worker keeps whatever it sees, so the import that follows is
       instant and works offline afterwards. */
    for (const [key, part] of Object.entries(PARTS)) {
      progress[key] = 0;
      try {
        await fetchCounting(part.url, part.bytes, (n) => {
          progress[key] = Math.min(n, part.bytes);
          report(part.label);
        });
        progress[key] = part.bytes;
        report(part.label);
      } catch (err) {
        loadPromise = null;
        throw new Error(
          `The ${part.label} could not be downloaded. ` +
          (err && err.message ? err.message : String(err))
        );
      }
    }

    let pdfLib;
    let pdfjs;
    try {
      pdfLib = await import(PARTS.pdfLib.url.href);
    } catch (err) {
      loadPromise = null;
      throw new Error(
        "The PDF writer arrived but would not start. " +
        (err && err.message ? err.message : String(err))
      );
    }

    try {
      pdfjs = await import(PARTS.pdfJs.url.href);
      /* pdf.js does its heavy reading on its own thread. Point it at our
         copy rather than letting it look for one on the internet - which
         the security policy would refuse anyway. */
      pdfjs.GlobalWorkerOptions.workerSrc = PARTS.pdfJsWorker.url.href;
    } catch (err) {
      loadPromise = null;
      throw new Error(
        "The PDF reader arrived but would not start. " +
        (err && err.message ? err.message : String(err))
      );
    }

    loaded = {
      pdfLib,
      pdfjs,
      /* Where pdf.js should look for the extra pieces some documents
         need: typefaces for text that was not embedded, and character
         maps for Chinese, Japanese and Korean. All local. */
      readerOptions: {
        cMapUrl: new URL("pdfjs/cmaps/", BASE).href,
        cMapPacked: true,
        standardFontDataUrl: new URL("pdfjs/standard_fonts/", BASE).href,
        wasmUrl: new URL("pdfjs/wasm/", BASE).href
      }
    };
    report("Ready");
    return loaded;
  })();

  return loadPromise;
}

export function isEngineLoaded() {
  return Boolean(loaded);
}

export function engineSizeBytes() {
  return Object.values(PARTS).reduce((n, p) => n + p.bytes, 0);
}
