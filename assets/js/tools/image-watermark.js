/* On Device - Watermark an image */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import { toCanvas, watermarkCanvas } from "../image/compose.js";
import { toBlob, releaseCanvas } from "../image/ops.js";
import { el, toast } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);
let previewUrl = null;

async function start() {
  const tool = await setupImageTool({
    toolId: "image-watermark",
    toolLabel: "Watermarked",
    fileToken: "marked",
    onFilesChanged: (files) => preview(files[0]),
    buildJob: async () => ({ op: "noop" }),
    ownRun: true
  });

  pruneFormatOptions($("format"), tool.capabilities);

  for (const id of ["text", "size", "opacity", "colour", "position", "tile"]) {
    $(id).addEventListener("input", () => {
      paintHints();
      preview(tool.getFiles()[0]);
    });
    $(id).addEventListener("change", () => preview(tool.getFiles()[0]));
  }

  $("run-button").addEventListener("click", () => run(tool));
  paintHints();

  function paintHints() {
    $("size-hint").textContent = `${$("size").value}% of the picture.`;
    $("opacity-hint").textContent = `${$("opacity").value}%.`;
  }
}

function settings() {
  return {
    text: $("text").value,
    size: Number($("size").value) / 100,
    opacity: Number($("opacity").value) / 100,
    colour: $("colour").value,
    position: $("position").value,
    tile: $("tile").checked
  };
}

async function preview(record) {
  const host = $("extra-host");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  host.textContent = "";
  if (!record) return;

  try {
    const canvas = await toCanvas(record.blob, record.format);
    watermarkCanvas(canvas, settings());
    const blob = await toBlob(canvas, "png");
    releaseCanvas(canvas);
    previewUrl = URL.createObjectURL(blob);

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "Preview" }),
        el("img", { src: previewUrl, alt: "Watermarked preview", class: "pane-image" }),
        el("p", {
          class: "field-hint",
          text: "Showing the first picture. Every selected picture gets the same treatment."
        })
      ])
    );
  } catch (err) {
    host.append(
      el("div", { class: "note note-warn" },
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) }))
    );
  }
}

async function run(tool) {
  const button = $("run-button");
  const files = tool.getFiles();
  button.disabled = true;
  try {
    if (!files.length) {
      toast("Choose a picture first.", { kind: "warn", timeout: 4000 });
      return;
    }
    if (!$("text").value.trim()) {
      toast("Type some watermark text first.", { kind: "warn", timeout: 5000 });
      return;
    }

    let done = 0;
    for (const record of files) {
      try {
        const canvas = await toCanvas(record.blob, record.format);
        watermarkCanvas(canvas, settings());
        const chosen = $("format").value;
        const format = chosen === "keep" ? (record.format === "jpg" ? "jpg" : "png") : chosen;
        const blob = await toBlob(canvas, format, 90);
        releaseCanvas(canvas);
        const base = record.name.replace(/\.[^.]+$/, "");
        await tray.addResult({
          blob,
          name: `${base}-marked.${format}`,
          fromTool: "Watermarked",
          fromFile: record.name
        });
        done++;
      } catch (err) {
        toast(`“${record.name}” failed: ${err && err.message ? err.message : err}`, {
          kind: "error",
          timeout: 10000
        });
      }
    }

    if (done) {
      toast(`${done} picture${done === 1 ? "" : "s"} watermarked and in the results tray.`, {
        kind: "ok",
        title: "Done"
      });
    }
  } finally {
    button.disabled = false;
    tool.refreshRunButton();
  }
}

window.addEventListener("pagehide", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

start().catch((err) => console.error("[On Device] The watermark tool failed to start:", err));
