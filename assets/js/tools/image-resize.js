/* On Device - Resize images */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import * as store from "../store.js";
import { el } from "../ui.js";
import { targetSize } from "../image/ops.js";

const $ = (id) => document.getElementById(id);

const LABELS = {
  longest: ["Longest side", "Pictures larger than this are scaled down."],
  shortest: ["Shortest side", "Pictures larger than this are scaled down."],
  percent: ["Percentage", "100 leaves the picture as it is. 50 halves it."],
  width: ["Width in pixels", "The height follows, keeping the shape."],
  height: ["Height in pixels", "The width follows, keeping the shape."],
  pixels: ["Exact size", "Both measurements are set below."]
};

async function start() {
  const tool = await setupImageTool({
    toolId: "image-resize",
    toolLabel: "Resize",
    fileToken: "resized",
    onFilesChanged: () => previewSizes(),
    buildJob: async () => buildJob()
  });

  pruneFormatOptions($("format"), tool.capabilities);

  /* Remembered defaults from Settings. */
  $("quality").value = String(store.get("defaults.imageQuality", 85));
  $("format").value = store.get("defaults.imageFormat", "keep");
  paintQuality();
  syncMode();

  $("mode").addEventListener("change", () => {
    syncMode();
    previewSizes();
  });
  $("value").addEventListener("input", previewSizes);
  $("exact-width").addEventListener("input", previewSizes);
  $("exact-height").addEventListener("input", previewSizes);
  $("keep-aspect").addEventListener("change", previewSizes);
  $("allow-grow").addEventListener("change", previewSizes);

  $("quality").addEventListener("input", () => {
    paintQuality();
    store.set("defaults.imageQuality", Number($("quality").value));
  });

  $("format").addEventListener("change", () => {
    store.set("defaults.imageFormat", $("format").value);
    syncQualityVisibility();
  });

  for (const btn of document.querySelectorAll("[data-preset]")) {
    btn.addEventListener("click", () => {
      $("value").value = btn.dataset.preset;
      previewSizes();
    });
  }

  syncQualityVisibility();

  function paintQuality() {
    const v = $("quality").value;
    $("quality-hint").textContent = `${v} out of 100.`;
    $("quality").setAttribute("aria-valuetext", `${v} out of 100`);
  }

  function syncQualityVisibility() {
    const format = $("format").value;
    /* PNG has no quality dial - it is lossless. Saying so beats
       showing a slider that does nothing. */
    const lossless = format === "png";
    $("quality-field").hidden = lossless;
  }

  function syncMode() {
    const mode = $("mode").value;
    const [label, hint] = LABELS[mode] || LABELS.longest;
    $("value-field").hidden = mode === "pixels";
    $("exact-field").hidden = mode !== "pixels";
    $("preset-field").hidden = mode === "percent" || mode === "pixels";
    const labelEl = $("value-field").querySelector("label");
    if (labelEl) labelEl.textContent = label;
    $("value-hint").textContent = hint;
    if (mode === "percent" && Number($("value").value) > 400) $("value").value = "50";
    if (mode !== "percent" && Number($("value").value) < 16) $("value").value = "1600";
  }

  function readOptions() {
    const mode = $("mode").value;
    return {
      mode,
      value: Number($("value").value) || 1600,
      targetWidth: Number($("exact-width").value) || undefined,
      targetHeight: Number($("exact-height").value) || undefined,
      keepAspect: $("keep-aspect").checked,
      allowGrow: $("allow-grow").checked
    };
  }

  function buildJob() {
    return {
      op: "resize",
      resize: readOptions(),
      format: $("format").value,
      quality: Number($("quality").value)
    };
  }

  /* Show what will actually happen, before it happens. */
  function previewSizes() {
    const host = $("extra-host");
    host.textContent = "";
    const files = tool.getFiles();
    if (!files.length) return;

    const options = readOptions();
    const rows = el("tbody");
    let anyUnchanged = false;

    for (const record of files.slice(0, 12)) {
      const w = record.width;
      const h = record.height;
      if (!w || !h) continue;
      const size = targetSize(w, h, options);
      if (size.unchanged) anyUnchanged = true;
      rows.append(
        el("tr", {}, [
          el("td", { text: record.name }),
          el("td", { text: `${w} × ${h}` }),
          el("td", { text: size.unchanged ? "unchanged" : `${size.width} × ${size.height}` })
        ])
      );
    }

    if (!rows.children.length) return;

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "What will happen" }),
        el("table", {}, [
          el("thead", {}, el("tr", {}, [
            el("th", { scope: "col", text: "File" }),
            el("th", { scope: "col", text: "Now" }),
            el("th", { scope: "col", text: "After" })
          ])),
          rows
        ]),
        files.length > 12
          ? el("p", { class: "field-hint", text: `Showing the first 12 of ${files.length}.` })
          : null,
        anyUnchanged
          ? el("p", {
              class: "field-hint",
              text: "Some pictures are already smaller than the target, so they are left alone. Switch on “Allow enlarging” to change that."
            })
          : null
      ])
    );
  }
}

start().catch((err) => {
  console.error("[On Device] The resize tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
