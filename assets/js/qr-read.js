/* ============================================================
   On Device - reading a QR code out of a picture

   Loading note: jsQR is a UMD bundle, not an ES module. Handed to
   import() it would be parsed as a module, where the top-level
   "this" is undefined, and its wrapper would fall over trying to
   attach itself to it. So it is loaded the old way, as an ordinary
   script tag, which the security policy allows because the file is
   served from this site's own address like everything else.

   Nothing here reaches the network beyond that one file.
   ============================================================ */

const BASE = new URL("../vendor/jsqr/", import.meta.url);

let loading = null;

export function engineSizeBytes() {
  /* Roughly what the file weighs, so the interface can say what it
     is about to fetch rather than freezing silently. */
  return 257_000;
}

export function isLoaded() {
  return typeof window !== "undefined" && typeof window.jsQR === "function";
}

export function loadReader() {
  if (isLoaded()) return Promise.resolve(window.jsQR);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("jsQR.js", BASE).href;
    script.async = true;

    script.addEventListener("load", () => {
      if (typeof window.jsQR === "function") {
        resolve(window.jsQR);
      } else {
        reject(new Error(
          "The QR reading library loaded but did not appear where it was expected. " +
          "This is a fault in On Device rather than in your picture."
        ));
      }
    });

    script.addEventListener("error", () => {
      loading = null;
      reject(new Error(
        "The QR reading library could not be loaded from this site. If you are " +
        "offline and have not used this tool before, connect once and it will be " +
        "saved for good."
      ));
    });

    document.head.append(script);
  });

  return loading;
}

/* ---- Looking at a picture -------------------------------- */
/* A photograph of a code on a wall is rarely as clean as a code on
   a screen. Rather than give up on the first try, the picture is
   offered several ways: as it is, then inverted for light-on-dark
   codes, then at a couple of smaller sizes, which often rescues a
   large blurry photograph by averaging the noise away. */
export async function readFromCanvas(canvas, { onAttempt = () => {} } = {}) {
  const jsQR = await loadReader();
  const attempts = [];

  /* jsQR is supposed to return null when it finds nothing. On some
     pictures with no code in them at all it throws instead, from
     inside its own pattern-locating code. That is its bug, not the
     visitor's, and "no code here" is the correct answer either way -
     so a throw is treated as "not found" rather than being allowed
     to surface as a baffling error message. */
  const tryOnce = (label, image, width, height, options) => {
    onAttempt(label);
    let found = null;
    try {
      found = jsQR(image, width, height, options);
    } catch (err) {
      found = null;
    }
    attempts.push({ label, found: Boolean(found) });
    return found;
  };

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const full = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let result =
    tryOnce("as it is", full.data, full.width, full.height, { inversionAttempts: "dontInvert" }) ||
    tryOnce("inverted", full.data, full.width, full.height, { inversionAttempts: "onlyInvert" });

  /* Shrinking a big photograph often helps: it smooths out paper
     grain and camera noise that break the black-and-white decision. */
  if (!result) {
    const longest = Math.max(canvas.width, canvas.height);
    for (const target of [1600, 1000, 640]) {
      if (target >= longest) continue;
      const scale = target / longest;
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.round(canvas.width * scale));
      small.height = Math.max(1, Math.round(canvas.height * scale));
      const sctx = small.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(canvas, 0, 0, small.width, small.height);
      const shrunk = sctx.getImageData(0, 0, small.width, small.height);

      result =
        tryOnce(`shrunk to ${target} across`, shrunk.data, shrunk.width, shrunk.height,
          { inversionAttempts: "dontInvert" }) ||
        tryOnce(`shrunk to ${target} across, inverted`, shrunk.data, shrunk.width, shrunk.height,
          { inversionAttempts: "onlyInvert" });
      if (result) break;
    }
  }

  if (!result) return { found: false, attempts };

  return {
    found: true,
    text: result.data,
    corners: result.location,
    version: result.version,
    attempts
  };
}

/* ---- Working out what the text actually is ---------------- */
/* A QR code is just text, but most of the useful ones follow a
   convention. Saying "this is a wifi network" beats showing
   somebody "WIFI:T:WPA;S:...;;" and letting them work it out. */
export function describe(text) {
  const value = String(text || "");

  const wifi = /^WIFI:(.*);;?$/i.exec(value);
  if (wifi) {
    /* A wifi code escapes the characters that would otherwise end a
       field: backslash, semicolon, comma, quote and colon. Splitting
       on a plain semicolon therefore cuts a password like "pa;ss" in
       half and shows the wrong one - which on a password is not a
       cosmetic fault. So the string is walked a character at a time,
       and a backslash always means "the next character is data". */
    const parts = {};
    let field = "";
    let key = null;
    const store = () => {
      if (key !== null) parts[key.toUpperCase()] = field;
      key = null;
      field = "";
    };

    for (let i = 0; i < wifi[1].length; i++) {
      const c = wifi[1][i];
      if (c === "\\") {
        i++;
        if (i < wifi[1].length) field += wifi[1][i];
      } else if (c === ":" && key === null) {
        key = field;
        field = "";
      } else if (c === ";") {
        store();
      } else {
        field += c;
      }
    }
    store();
    return {
      kind: "wifi",
      title: "A wifi network",
      fields: [
        ["Network name", parts.S || "(not given)"],
        ["Security", parts.T || "none"],
        ["Password", parts.P || "(none)"],
        ["Hidden network", parts.H === "true" ? "yes" : "no"]
      ],
      warning:
        "This will connect a device to a network somebody else chose. Only use it " +
        "if you know where the code came from."
    };
  }

  if (/^BEGIN:VCARD/i.test(value)) {
    const fields = [];
    for (const line of value.split(/\r?\n/)) {
      const at = line.indexOf(":");
      if (at < 0) continue;
      const key = line.slice(0, at).split(";")[0].toUpperCase();
      const val = line.slice(at + 1);
      const label = { FN: "Name", N: "Name", TEL: "Telephone", EMAIL: "Email", ORG: "Organisation", URL: "Website", ADR: "Address" }[key];
      if (label && val) fields.push([label, val.replace(/;+/g, " ").trim()]);
    }
    return { kind: "contact", title: "A contact card", fields };
  }

  if (/^BEGIN:VEVENT/i.test(value) || /^BEGIN:VCALENDAR/i.test(value)) {
    return { kind: "event", title: "A calendar event", fields: [["Raw text", value]] };
  }

  const mail = /^mailto:([^?]*)\??(.*)$/i.exec(value);
  if (mail) {
    const params = new URLSearchParams(mail[2] || "");
    return {
      kind: "email",
      title: "An email address",
      fields: [
        ["To", decodeURIComponent(mail[1])],
        ["Subject", params.get("subject") || "(none)"],
        ["Message", params.get("body") || "(none)"]
      ]
    };
  }

  const tel = /^(tel|sms):(.+)$/i.exec(value);
  if (tel) {
    return {
      kind: "phone",
      title: tel[1].toLowerCase() === "tel" ? "A telephone number" : "A text message",
      fields: [["Number", tel[2]]]
    };
  }

  const geo = /^geo:(-?[\d.]+),(-?[\d.]+)/i.exec(value);
  if (geo) {
    return { kind: "place", title: "A place on a map", fields: [["Latitude", geo[1]], ["Longitude", geo[2]]] };
  }

  if (/^https?:\/\//i.test(value)) {
    let host = "";
    try { host = new URL(value).host; } catch (err) { host = "(unreadable)"; }
    return {
      kind: "link",
      title: "A web address",
      fields: [["Goes to", host], ["Full address", value]],
      warning:
        "A code can send you anywhere, and the address is not shown until you read it. " +
        "Check it looks like somewhere you meant to go before opening it."
    };
  }

  return { kind: "text", title: "Plain text", fields: [["Text", value]] };
}
