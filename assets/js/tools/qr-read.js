/* On Device - Read a QR code */

import { setupImageTool } from "../tool-page.js";
import * as reader from "../qr-read.js";
import { toCanvas } from "../image/compose.js";
import { makeCanvas, releaseCanvas } from "../image/ops.js";
import * as tray from "../tray.js";
import { el, icon, toast, announce, copyText, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);

let current = null;

async function start() {
  await setupImageTool({
    toolId: "qr-read",
    toolLabel: "Code contents",
    fileToken: "code",
    singleFile: true,
    onFilesChanged: (files) => { current = files[0] || null; $("extra-host").textContent = ""; },
    buildJob: async () => ({ op: "noop" }),
    ownRun: true,
    savesPictures: false
  });

  $("run-button").addEventListener("click", run);
}

async function run() {
  const button = $("run-button");
  const host = $("extra-host");

  if (!current) {
    toast("Choose a picture with a QR code in it first.", { kind: "warn", timeout: 5000 });
    return;
  }

  button.disabled = true;
  host.textContent = "";

  const progress = el("p", { class: "field-hint", text: "Opening the picture…" });
  host.append(el("div", { class: "panel" }, [progress]));

  try {
    if (!reader.isLoaded()) {
      progress.textContent =
        `Fetching the reading library from this site (about ` +
        `${formatBytes(reader.engineSizeBytes())}). This happens once.`;
      await reader.loadReader();
    }

    progress.textContent = "Looking for a code…";
    const canvas = await toCanvas(current.blob, current.format);

    let result;
    try {
      result = await reader.readFromCanvas(canvas, {
        onAttempt: (label) => { progress.textContent = `Looking for a code — ${label}…`; }
      });
    } finally {
      /* Keep the canvas if it is going to be drawn, release it if not. */
      if (!$("show-picture").checked) releaseCanvas(canvas);
    }

    host.textContent = "";

    if (!result.found) {
      /* Nothing to draw, so let the picture go rather than leaving a
         full-size canvas held until the page is closed. */
      if ($("show-picture").checked) releaseCanvas(canvas);
      showNothingFound(host, result);
      announce("No QR code was found in that picture.");
      return;
    }

    await showResult(host, result, canvas);
    announce("A code was found and read.");
  } catch (err) {
    host.textContent = "";
    host.append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "That did not work" }),
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
      ])
    );
    console.error("[On Device] Reading the code failed:", err);
  } finally {
    button.disabled = false;
  }
}

/* ---- Nothing found --------------------------------------- */
function showNothingFound(host, result) {
  host.append(
    el("div", { class: "note note-warn" }, [
      el("strong", { class: "note-title", text: "No QR code was found in that picture" }),
      el("p", {
        text:
          "The picture was tried " + result.attempts.length + " different ways: " +
          result.attempts.map((a) => a.label).join(", ") + ". None of them found a code."
      }),
      el("p", { text: "The usual reasons, in the order they are usually to blame:" }),
      el("ul", {}, [
        el("li", { text: "Only part of the code is in the picture. All four corners have to be there, with a little clear space around them." }),
        el("li", { text: "It is too blurred, or too small — a code needs to be a couple of hundred pixels across before the squares can be told apart." }),
        el("li", { text: "It is photographed at a steep angle, or on a curved surface such as a bottle." }),
        el("li", { text: "It is not a QR code. Shop barcodes, Data Matrix and PDF417 all look like codes and are not read by this tool." })
      ]),
      el("p", { class: "mb-0", text: "Nothing was sent anywhere, and your picture is untouched." })
    ])
  );
}

/* ---- Something found ------------------------------------- */
async function showResult(host, result, canvas) {
  const meaning = reader.describe(result.text);

  const rows = el("table", { class: "meta-table" });
  const body = el("tbody", {});
  for (const [label, value] of meaning.fields) {
    body.append(el("tr", {}, [
      el("th", { scope: "row", text: label }),
      el("td", {}, el("span", { class: "mono", text: value }))
    ]));
  }
  rows.append(body);

  const panel = el("div", { class: "panel" }, [
    el("h2", { class: "h-lg" }, [
      icon(iconFor(meaning.kind), 18),
      document.createTextNode(" " + meaning.title)
    ]),
    rows
  ]);

  if (meaning.warning) {
    panel.append(
      el("div", { class: "note note-warn" }, [
        el("strong", { class: "note-title", text: "Before you act on this" }),
        el("p", { class: "mb-0", text: meaning.warning })
      ])
    );
  }

  /* The raw text, always, whatever we made of it. Deliberately not a
     link: this tool tells you what a code says, it does not take you
     there. */
  panel.append(
    el("div", { class: "field" }, [
      el("span", { class: "field-label", text: "Exactly what the code says" }),
      el("textarea", {
        id: "code-text",
        rows: Math.min(8, Math.max(2, String(result.text).split("\n").length + 1)),
        readonly: true,
        spellcheck: "false",
        "aria-label": "The text inside the code"
      }, String(result.text)),
      el("p", { class: "field-hint mb-0", text: `${String(result.text).length} characters. Nothing here is a link, on purpose.` })
    ])
  );

  panel.append(
    el("div", { class: "btn-row" }, [
      el("button", {
        class: "btn btn-primary",
        type: "button",
        onclick: async () => {
          const ok = await copyText(String(result.text));
          toast(ok ? "Copied." : "The browser would not let us reach the clipboard. Select the text and copy it by hand.",
            { kind: ok ? "ok" : "warn" });
        }
      }, "Copy the text"),
      el("button", {
        class: "btn",
        type: "button",
        onclick: () => saveAsText(result.text)
      }, "Save it as a file")
    ])
  );

  /* How it was found - worth saying, because "found on the fourth
     try, after shrinking" tells you the picture was marginal. */
  const winner = result.attempts.find((a) => a.found);
  panel.append(
    el("p", { class: "field-hint mb-0" }, [
      document.createTextNode(
        `Found ${winner && winner.label !== "as it is" ? `by trying it ${winner.label}` : "straight away"}` +
        (result.version ? `, version ${result.version} of the QR standard.` : ".")
      )
    ])
  );

  host.append(panel);

  if ($("show-picture").checked) {
    host.append(pictureWithOutline(canvas, result.corners));
    releaseCanvas(canvas);
  }

  if ($("save-text").checked) await saveAsText(result.text, { quiet: true });
}

function iconFor(kind) {
  return {
    wifi: "wifi-off", contact: "info", email: "type", phone: "info",
    place: "map-pin", link: "shield", event: "info", text: "type"
  }[kind] || "qr";
}

/* Draw the picture with the code ringed, so you can see it found the
   right thing rather than something else in the background. */
function pictureWithOutline(source, corners) {
  const longest = Math.max(source.width, source.height);
  const scale = Math.min(1, 720 / longest);
  const shown = makeCanvas(
    Math.max(1, Math.round(source.width * scale)),
    Math.max(1, Math.round(source.height * scale))
  );
  const ctx = shown.getContext("2d");
  ctx.drawImage(source, 0, 0, shown.width, shown.height);

  if (corners) {
    const points = [
      corners.topLeftCorner, corners.topRightCorner,
      corners.bottomRightCorner, corners.bottomLeftCorner
    ].filter(Boolean);

    if (points.length === 4) {
      ctx.lineWidth = Math.max(2, Math.round(shown.width / 180));
      ctx.strokeStyle = "#00c070";
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }

  const image = el("canvas", { class: "cutout-canvas", width: shown.width, height: shown.height,
    "aria-label": "The picture you gave, with the code outlined" });
  image.getContext("2d").drawImage(shown, 0, 0);
  releaseCanvas(shown);

  return el("div", { class: "panel" }, [
    el("h2", { class: "h-lg", text: "Where it was found" }),
    el("div", { class: "cutout-stage" }, image)
  ]);
}

async function saveAsText(text, { quiet = false } = {}) {
  const base = (current && current.name ? current.name : "code").replace(/\.[^.]+$/, "");
  const name = `${base}-contents.txt`;
  await tray.addResult({
    blob: new Blob([String(text)], { type: "text/plain;charset=utf-8" }),
    name,
    fromTool: "Code contents",
    fromFile: current ? current.name : ""
  });
  if (!quiet) toast(`Saved as “${name}” in the results tray.`, { kind: "ok" });
}

start().catch((err) => {
  console.error("[On Device] The QR reader failed to start:", err);
});
