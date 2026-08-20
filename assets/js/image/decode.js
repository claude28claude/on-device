/* ============================================================
   On Device - turning a file into pixels

   Your browser already knows how to decode JPEG, PNG, WebP, GIF
   and BMP. We ask it to do that, here, in this tab.

   HEIC is the awkward one. Some browsers can decode it and some
   cannot, and there is no way to know except to try. So we try,
   and if it fails we say exactly what happened and what to do
   instead - rather than showing a broken image.
   ============================================================ */

import { readOrientation } from "./exif.js";

/* ---- What can this browser actually do? ----------------- */
let capabilityPromise = null;

/* Turn the base64 probe into bytes ourselves.

   Deliberately NOT with fetch(). The site's own security policy
   forbids the page from fetching anything that is not a file on this
   site, and a data: URL is not - so fetching one would be refused,
   and would show up on the Trust page as a blocked attempt. Decoding
   the text here touches nothing. */
function bytesFromBase64(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function canDecode(mime, base64) {
  try {
    const blob = new Blob([bytesFromBase64(base64)], { type: mime });
    const bitmap = await createImageBitmap(blob);
    bitmap.close();
    return true;
  } catch (err) {
    return false;
  }
}

/* Tiny but genuinely valid picture files, written out here as text.
   They are used only to ask this browser "can you read this kind of
   picture?" - nothing is fetched from anywhere. */
const PROBES = {
  webp: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  avif: "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI="
};

export function detectCapabilities() {
  if (capabilityPromise) return capabilityPromise;
  capabilityPromise = (async () => {
    const caps = {
      offscreenCanvas: typeof OffscreenCanvas === "function",
      createImageBitmap: typeof createImageBitmap === "function",
      imageOrientation: false,
      decode: { jpg: true, png: true, gif: true, bmp: true, webp: false, avif: false, heic: null },
      encode: { jpg: false, png: false, webp: false, avif: false }
    };

    /* Does createImageBitmap honour a photo's own rotation flag? */
    try {
      await createImageBitmap(new Blob([new Uint8Array([0])]), { imageOrientation: "from-image" });
      caps.imageOrientation = true;
    } catch (err) {
      /* The blob is deliberately invalid; a TypeError means the option
         itself was rejected, any other error means it was understood. */
      caps.imageOrientation = !(err instanceof TypeError);
    }

    caps.decode.webp = await canDecode("image/webp", PROBES.webp);
    caps.decode.avif = await canDecode("image/avif", PROBES.avif);

    /* Encoding: ask a canvas what it will actually produce. Browsers
       silently fall back to PNG when asked for a format they cannot
       write, so we check the type of what comes back rather than
       trusting the request. */
    for (const [format, mime] of [
      ["jpg", "image/jpeg"],
      ["png", "image/png"],
      ["webp", "image/webp"],
      ["avif", "image/avif"]
    ]) {
      caps.encode[format] = await canEncode(mime);
    }

    return caps;
  })();
  return capabilityPromise;
}

async function canEncode(mime) {
  try {
    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(2, 2);
      const ctx = canvas.getContext("2d");
      ctx.fillRect(0, 0, 2, 2);
      const blob = await canvas.convertToBlob({ type: mime, quality: 0.8 });
      return blob.type === mime;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    ctx.fillRect(0, 0, 2, 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.8));
    return Boolean(blob) && blob.type === mime;
  } catch (err) {
    return false;
  }
}

/* ---- Decoding ------------------------------------------- */
/* Returns { bitmap, width, height, orientationApplied }. The caller
   must call bitmap.close() when finished, or memory leaks across a
   long batch. */
export async function decodeImage(file, format) {
  const caps = await detectCapabilities();

  if (typeof createImageBitmap !== "function") {
    throw new Error(
      "This browser cannot decode images the way On Device needs. " +
      "Please use a current version of Chrome, Edge, Firefox or Safari."
    );
  }

  let bitmap = null;
  let orientationApplied = false;

  try {
    if (caps.imageOrientation) {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      orientationApplied = true;
    } else {
      bitmap = await createImageBitmap(file);
    }
  } catch (err) {
    throw decodeFailure(file, format, caps, err);
  }

  if (!bitmap || !bitmap.width || !bitmap.height) {
    throw new Error(
      `“${file.name}” decoded to an empty picture. The file is probably damaged.`
    );
  }

  /* If the browser would not apply the photo's own rotation flag, we
     apply it ourselves later, so read it now. */
  const orientation = orientationApplied ? 1 : await readOrientation(file, format);

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    orientation,
    orientationApplied
  };
}

/* Turn a decoding failure into something a person can act on. */
function decodeFailure(file, format, caps, err) {
  const detail = err && err.message ? err.message : String(err);

  if (format === "heic") {
    return new Error(
      `“${file.name}” is a HEIC photo, and this browser will not open it. ` +
      `Safari on a Mac or iPhone usually can; Chrome, Edge and Firefox usually cannot. ` +
      `On Device does not yet include its own HEIC decoder — see the roadmap for why. ` +
      `If you have the photo on an iPhone, emailing it to yourself normally converts it to JPEG.`
    );
  }

  if (format === "avif" && !caps.decode.avif) {
    return new Error(
      `“${file.name}” is an AVIF image and this browser cannot open that format. ` +
      `A recent Chrome, Edge or Firefox can.`
    );
  }

  if (format === "webp" && !caps.decode.webp) {
    return new Error(
      `“${file.name}” is a WebP image and this browser cannot open that format. ` +
      `Please use a more recent browser.`
    );
  }

  return new Error(
    `“${file.name}” could not be opened as an image. The file may be damaged, or it may ` +
    `not really be a ${String(format).toUpperCase()} despite its name. ` +
    `The browser said: ${detail}`
  );
}

/* ---- Orientation ---------------------------------------- */
/* The transform needed to put a photo the right way up, for the
   browsers that do not do it for us. */
export function orientationTransform(orientation, width, height) {
  switch (orientation) {
    case 2: return { w: width, h: height, transform: [-1, 0, 0, 1, width, 0] };
    case 3: return { w: width, h: height, transform: [-1, 0, 0, -1, width, height] };
    case 4: return { w: width, h: height, transform: [1, 0, 0, -1, 0, height] };
    case 5: return { w: height, h: width, transform: [0, 1, 1, 0, 0, 0] };
    case 6: return { w: height, h: width, transform: [0, 1, -1, 0, height, 0] };
    case 7: return { w: height, h: width, transform: [0, -1, -1, 0, height, width] };
    case 8: return { w: height, h: width, transform: [0, -1, 1, 0, 0, width] };
    default: return { w: width, h: height, transform: [1, 0, 0, 1, 0, 0] };
  }
}
