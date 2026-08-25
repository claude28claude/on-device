/* On Device - Compress images */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import { run as runJob } from "../image/runner.js";
import { el, toast, formatBytes, announce } from "../ui.js";
import { adopt } from "../defaults.js";

const $ = (id) => document.getElementById(id);

/* The three levels shown side by side, so the choice is made by eye. */
const LEVELS = [
  { quality: 45, label: "Small" },
  { quality: 70, label: "Balanced" },
  { quality: 90, label: "Careful" }
];

let previewUrls = [];

async function start() {
  /* Start from whatever was chosen in Settings, and remember
     any change made here as the new default. */
  adopt({ quality: "defaults.imageQuality", format: "defaults.imageFormat" });

  /* Paint it once now: the slider may have started from a saved
     default, and a caption that disagrees with the control under it
     is worse than no caption. */
  $("quality-hint").textContent = `${$("quality").value} out of 100.`;

  const tool = await setupImageTool({
    toolId: "image-compress",
    toolLabel: "Compressed",
    fileToken: "compressed",
    buildJob: async () => ({
      op: "compress",
      format: $("format").value,
      quality: Number($("quality").value),
      resize: $("also-resize").checked
        ? { mode: "longest", value: Number($("max-side").value) || 2048 }
        : null
    }),
    onFilesChanged: () => {
      clearPreviews();
      $("extra-host").textContent = "";
    }
  });

  pruneFormatOptions($("format"), tool.capabilities);

  $("quality").addEventListener("input", () => {
    $("quality-hint").textContent = `${$("quality").value} out of 100.`;
    $("quality").setAttribute("aria-valuetext", `${$("quality").value} out of 100`);
  });

  $("also-resize").addEventListener("change", () => {
    $("resize-field").hidden = !$("also-resize").checked;
  });

  $("format").addEventListener("change", () => {
    const format = $("format").value;
    /* PNG is lossless: the quality dial genuinely does nothing to it. */
    const pngOnly = format === "png";
    $("quality").disabled = pngOnly;
  });

  $("preview-button").addEventListener("click", () => buildComparison(tool));
}

function clearPreviews() {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
}

async function buildComparison(tool) {
  const files = tool.getFiles();
  if (!files.length) {
    toast("Choose an image first.", { kind: "warn", timeout: 4000 });
    return;
  }

  const record = files[0];
  const host = $("extra-host");
  clearPreviews();
  host.textContent = "";
  host.append(el("p", { class: "muted", text: `Preparing three versions of ${record.name}…` }));

  const button = $("preview-button");
  button.disabled = true;

  try {
    const format = $("format").value === "keep" ? record.format : $("format").value;
    const results = [];

    for (const level of LEVELS) {
      const result = await runJob(record.blob, record.format, {
        op: "compress",
        format: $("format").value,
        quality: level.quality,
        resize: $("also-resize").checked
          ? { mode: "longest", value: Number($("max-side").value) || 2048 }
          : null
      });
      results.push({ level, result });
    }

    host.textContent = "";

    const originalUrl = URL.createObjectURL(record.blob);
    previewUrls.push(originalUrl);

    const panel = el("div", { class: "panel" });
    panel.append(
      el("h2", { class: "h-lg", text: "Before and after" }),
      el("p", {
        class: "field-hint",
        text:
          "Magnified so the difference is visible. Compression damage shows first around " +
          "sharp edges, text and smooth gradients — look there, not at the middle of a " +
          "blurry background."
      })
    );

    const grid = el("div", { class: "compare-grid compare-zoom" });
    grid.append(pane("Original", record.blob.size, originalUrl, record.size));

    for (const { level, result } of results) {
      const url = URL.createObjectURL(result.blob);
      previewUrls.push(url);
      grid.append(
        pane(
          `${level.label} — quality ${level.quality}`,
          result.blob.size,
          url,
          record.size,
          () => {
            $("quality").value = String(level.quality);
            $("quality-hint").textContent = `${level.quality} out of 100.`;
            announce(`Quality set to ${level.quality}.`);
            toast(`Quality set to ${level.quality}. Press Compress to apply it to all ${tool.getFiles().length} images.`, {
              kind: "ok",
              timeout: 6000
            });
          }
        )
      );
    }

    panel.append(grid);
    panel.append(
      el("p", { class: "field-hint", text: `Showing ${record.name}, ${record.width || "?"} × ${record.height || "?"} pixels, as ${String(format).toUpperCase()}.` })
    );
    host.append(panel);
  } catch (err) {
    host.textContent = "";
    host.append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "The preview could not be made" }),
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
      ])
    );
  } finally {
    button.disabled = false;
  }
}

function pane(title, size, url, originalSize, onPick) {
  const percent = originalSize ? Math.round((1 - size / originalSize) * 100) : 0;
  const img = el("img", { class: "pane-image", src: url, alt: `${title} preview`, loading: "lazy" });
  return el("figure", { class: "compare-pane" }, [
    el("figcaption", {}, [
      el("span", { text: title }),
      el("span", {
        text: originalSize && percent !== 0
          ? `${formatBytes(size)} (${percent > 0 ? "−" : "+"}${Math.abs(percent)}%)`
          : formatBytes(size)
      })
    ]),
    img,
    onPick
      ? el("div", { class: "btn-row" }, [
          el("button", { class: "btn btn-sm btn-block", type: "button", onclick: onPick }, "Use this quality")
        ])
      : null
  ]);
}

start().catch((err) => {
  console.error("[On Device] The compress tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});

window.addEventListener("pagehide", clearPreviews);
