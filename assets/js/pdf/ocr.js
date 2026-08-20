/* ============================================================
   On Device - reading text out of a picture

   For a scan, or a photograph of a document: working out what the
   words say, so they can be searched and copied.

   This uses Tesseract, the long-standing open text-recognition
   engine, compiled to WebAssembly. Every part of it lives in this
   site, including the English language data - because by default
   the library fetches that from somebody else's server, which is
   exactly what this site does not do, and which the security
   policy would refuse anyway.

   That is why it is a large one-time download: about 17 MB. It is
   fetched once, kept on this device, and never fetched again.
   ============================================================ */

const BASE = new URL("../../vendor/tesseract/", import.meta.url);

let workerPromise = null;
let tesseract = null;

export function engineSizeBytes() {
  /* Measured from the vendored files. */
  return 68000 + 124000 + 2859709 + 3938657 + 2952873;
}

async function loadLibrary() {
  if (tesseract) return tesseract;
  const mod = await import(new URL("tesseract.esm.min.js", BASE).href);
  /* This build puts everything on the default export rather than exporting
     names, so take whichever shape actually has createWorker on it. */
  tesseract = (mod && typeof mod.createWorker === "function") ? mod : mod.default;
  if (!tesseract || typeof tesseract.createWorker !== "function") {
    throw new Error(
      "The text-recognition library loaded but does not look the way this site expects. " +
      "This is a bug here, not a problem with your file."
    );
  }
  return tesseract;
}

/* Fetch a file while counting the bytes, so the wait has a number
   on it. The service worker keeps whatever it sees, so the real
   load that follows comes from this device. */
async function prefetch(url, onBytes) {
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body || !response.body.getReader) {
      if (response.ok) await response.arrayBuffer();
      return;
    }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onBytes(value.length);
    }
  } catch (err) {
    /* The real load below will report the problem properly. */
  }
}

export async function getWorker({ onProgress = () => {} } = {}) {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const total = engineSizeBytes();
    let got = 0;
    const count = (n) => {
      got += n;
      onProgress({
        stage: "downloading",
        loaded: got,
        total,
        fraction: Math.min(0.85, got / total)
      });
    };

    /* Pull the big pieces down first so the progress bar means
       something, rather than sitting still while the library works. */
    await prefetch(new URL("core/tesseract-core-simd-lstm.wasm", BASE).href, count);
    await prefetch(new URL("lang/eng.traineddata.gz", BASE).href, count);

    const lib = await loadLibrary();

    onProgress({ stage: "starting the engine", fraction: 0.9 });

    let worker;
    try {
      worker = await lib.createWorker("eng", 1, {
        workerPath: new URL("worker.min.js", BASE).href,
        corePath: new URL("core/", BASE).href,
        langPath: new URL("lang/", BASE).href,
        /* The library would otherwise cache language data itself under a
           name we do not control; the service worker already keeps it. */
        cacheMethod: "none",
        logger: (m) => {
          if (m && typeof m.progress === "number" && m.status) {
            onProgress({
              stage: m.status,
              fraction: 0.9 + Math.min(0.09, m.progress * 0.09)
            });
          }
        }
      });
    } catch (err) {
      workerPromise = null;
      throw new Error(
        "The text-recognition engine would not start: " +
        (err && err.message ? err.message : String(err)) +
        ". Nothing was sent anywhere."
      );
    }

    onProgress({ stage: "ready", fraction: 1 });
    return worker;
  })();

  return workerPromise;
}

/* Recognise one picture. Returns the text plus a confidence score,
   which is worth showing: a bad scan produces confident nonsense
   otherwise. */
export async function recognise(source, { onProgress = () => {} } = {}) {
  const worker = await getWorker({ onProgress });
  const result = await worker.recognize(source);
  const data = result && result.data ? result.data : {};
  return {
    text: (data.text || "").trim(),
    confidence: typeof data.confidence === "number" ? Math.round(data.confidence) : null,
    words: Array.isArray(data.words) ? data.words.length : null
  };
}

export async function shutdown() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch (err) {
    /* Nothing useful to do if it was already gone. */
  }
  workerPromise = null;
}

/* An honest reading of how well it went. */
export function judge(confidence, textLength) {
  if (!textLength) {
    return {
      good: false,
      text:
        "No text was found at all. Either the picture has no writing in it, or it is " +
        "too blurred, too small or too skewed to read. A straight, well-lit scan at " +
        "300 dots per inch works far better than a photograph taken at an angle."
    };
  }
  if (confidence === null) {
    return { good: true, text: `${textLength} characters found.` };
  }
  if (confidence >= 85) {
    return { good: true, text: `${textLength} characters, ${confidence}% confident. That is a good read.` };
  }
  if (confidence >= 65) {
    return {
      good: true,
      text:
        `${textLength} characters, ${confidence}% confident. Usable, but check it — at ` +
        `this level there will be mistakes, particularly in numbers and names.`
    };
  }
  return {
    good: false,
    text:
      `${textLength} characters, only ${confidence}% confident. Treat this as a rough ` +
      `guess rather than a transcript. A sharper, straighter, higher-resolution scan ` +
      `would do much better.`
  };
}
