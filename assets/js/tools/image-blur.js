/* On Device - Blur or pixelate part of a photo */

import { setupImageTool } from "../tool-page.js";
import { Marker } from "../marker.js";
import { applyRegions, judgeMethod } from "../image/obscure.js";
import { decodeImage } from "../image/decode.js";
import { normalise, toBlob, releaseCanvas } from "../image/ops.js";
import { el, toast, announce, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);

let method = "block";
let marker = null;
let current = null;
let previewUrl = null;

async function start() {
  const tool = await setupImageTool({
    toolId: "image-blur",
    toolLabel: "Hidden",
    fileToken: "hidden",
    singleFile: true,
    onFilesChanged: (files) => show(files[0]),
    buildJob: async () => ({ op: "noop" })
  });

  for (const btn of $("method").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      method = btn.dataset.method;
      for (const other of $("method").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      $("strength-field").hidden = method === "block";
      $("colour-field").hidden = method !== "block";
      paintSafety();
    });
  }

  $("strength").addEventListener("input", paintSafety);
  $("undo-box").addEventListener("click", () => marker && marker.undo());
  $("clear-boxes").addEventListener("click", () => marker && marker.clear());
  $("run-button").addEventListener("click", () => run(tool));

  paintSafety();

  function paintSafety() {
    const strength = Number($("strength").value);
    const regionPx = current && marker && marker.boxes.length && current.width
      ? Math.min(
          ...marker.boxes.map((b) => Math.min(b.w * current.width, b.h * current.height))
        )
      : null;
    const verdict = judgeMethod(method, strength, regionPx);
    $("safety-text").textContent = verdict.text;
    $("safety-note").className = verdict.safe ? "note note-ok" : "note note-warn";
    if (method !== "block") {
      $("strength-hint").textContent =
        method === "pixelate" ? `Blocks of ${strength} pixels.` : `Blur radius ${strength} pixels.`;
    }
  }

  window.__paintSafety = paintSafety;
}

function show(record) {
  const host = $("extra-host");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  host.textContent = "";
  marker = null;
  current = null;
  if (!record) return;

  current = record;
  previewUrl = URL.createObjectURL(record.blob);

  const img = el("img", { src: previewUrl, alt: `Preview of ${record.name}` });
  const stage = el("div", { class: "mark-stage" }, img);

  marker = new Marker({
    host: stage,
    label: "Hidden area",
    onChange: (boxes) => {
      $("box-readout").textContent = boxes.length
        ? `${boxes.length} area${boxes.length === 1 ? "" : "s"} marked.`
        : "Drag across the picture to mark something.";
      if (window.__paintSafety) window.__paintSafety();
    }
  });
  marker.attach(stage);

  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: `Drag over what should be hidden in ${record.name}` }),
      stage,
      el("div", { class: "btn-row" }, [
        el("button", {
          class: "btn btn-sm",
          type: "button",
          onclick: () => marker.addByKeyboard()
        }, "Add a box without dragging")
      ]),
      el("p", {
        class: "field-hint",
        text:
          "A marked box can be focused with Tab, moved with the arrow keys, resized " +
          "with Shift and the arrows, and removed with Delete."
      })
    ])
  );
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;

  try {
    if (!current) {
      toast("Choose a picture first.", { kind: "warn", timeout: 4000 });
      return;
    }
    if (!marker || !marker.boxes.length) {
      toast("Mark something first — drag a box over what should be hidden.", {
        kind: "warn",
        timeout: 6000
      });
      return;
    }

    const decoded = await decodeImage(current.blob, current.format);
    let canvas;
    try {
      canvas = normalise(decoded.bitmap, decoded.orientation, decoded.orientationApplied);
    } finally {
      decoded.bitmap.close();
    }

    applyRegions(canvas, marker.boxes, {
      method,
      strength: Number($("strength").value),
      colour: $("colour").value
    });

    const chosen = $("format").value;
    const format = chosen === "keep"
      ? (current.format === "jpg" ? "jpg" : "png")
      : chosen;

    const blob = await toBlob(canvas, format, 92);
    releaseCanvas(canvas);

    const base = current.name.replace(/\.[^.]+$/, "");
    const name = `${base}-hidden.${format}`;
    await tray.addResult({
      blob,
      name,
      fromTool: "Hidden",
      fromFile: current.name
    });

    const verdict = judgeMethod(method, Number($("strength").value), null);
    toast(
      `${marker.boxes.length} area${marker.boxes.length === 1 ? "" : "s"} hidden and saved ` +
      `as “${name}” (${formatBytes(blob.size)}). The pixels underneath are not in the new ` +
      `file.` + (verdict.safe ? "" : " Note the warning about this setting."),
      { kind: verdict.safe ? "ok" : "warn", title: "Done", timeout: 11000 }
    );
    announce("The marked areas are hidden.");
  } catch (err) {
    console.error("[On Device] Hiding failed:", err);
    const host = $("tool-status");
    host.textContent = "";
    host.append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "That did not work" }),
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
      ])
    );
  } finally {
    button.disabled = false;
  }
}

window.addEventListener("pagehide", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

start().catch((err) => {
  console.error("[On Device] The blur tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
