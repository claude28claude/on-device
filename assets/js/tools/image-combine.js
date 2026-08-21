/* On Device - Combine images */

import { setupImageTool } from "../tool-page.js";
import { toCanvas, combine } from "../image/compose.js";
import { toBlob, releaseCanvas } from "../image/ops.js";
import { el, toast, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);
let layout = "grid";
let previewUrl = null;

async function start() {
  const tool = await setupImageTool({
    toolId: "image-combine",
    toolLabel: "Combined",
    fileToken: "combined",
    onFilesChanged: () => preview(tool),
    buildJob: async () => ({ op: "noop" }),
    ownRun: true
  });

  for (const btn of $("layout").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      layout = btn.dataset.layout;
      for (const other of $("layout").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      $("columns-field").hidden = layout !== "grid";
      preview(tool);
    });
  }

  for (const id of ["columns", "gap", "background", "format"]) {
    $(id).addEventListener("input", () => {
      $("gap-hint").textContent = `${$("gap").value} pixels.`;
      preview(tool);
    });
  }

  $("run-button").addEventListener("click", () => run(tool));
  $("gap-hint").textContent = `${$("gap").value} pixels.`;
}

async function build(tool) {
  const files = tool.getFiles();
  if (files.length < 2) return null;
  const canvases = [];
  for (const record of files.slice(0, 40)) {
    canvases.push(await toCanvas(record.blob, record.format));
  }
  const sheet = combine(canvases, {
    layout,
    columns: Number($("columns").value) || 0,
    gap: Number($("gap").value),
    background: $("background").value
  });
  for (const c of canvases) releaseCanvas(c);
  return sheet;
}

async function preview(tool) {
  const host = $("extra-host");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  host.textContent = "";

  const files = tool.getFiles();
  if (files.length < 2) {
    if (files.length === 1) {
      host.append(el("div", { class: "note" },
        el("p", { class: "mb-0", text: "Choose at least two pictures to combine." })));
    }
    return;
  }

  try {
    host.append(el("p", { class: "muted", text: "Building the sheet…" }));
    const sheet = await build(tool);
    const blob = await toBlob(sheet, "png");
    const size = `${sheet.width} × ${sheet.height}`;
    releaseCanvas(sheet);
    previewUrl = URL.createObjectURL(blob);

    host.textContent = "";
    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `Preview — ${size} pixels` }),
        el("img", { src: previewUrl, alt: "Combined preview", class: "pane-image" }),
        files.length > 40
          ? el("p", { class: "field-hint", text: `Only the first 40 of ${files.length} are used.` })
          : null
      ])
    );
  } catch (err) {
    host.textContent = "";
    host.append(el("div", { class: "note note-warn" },
      el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })));
  }
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;
  try {
    const files = tool.getFiles();
    if (files.length < 2) {
      toast("Choose at least two pictures.", { kind: "warn", timeout: 5000 });
      return;
    }
    const sheet = await build(tool);
    const format = $("format").value;
    const blob = await toBlob(sheet, format, 92);
    const dims = `${sheet.width} × ${sheet.height}`;
    releaseCanvas(sheet);

    await tray.addResult({
      blob,
      name: `combined.${format}`,
      fromTool: "Combined"
    });
    toast(`${files.length} pictures combined into one ${dims} sheet (${formatBytes(blob.size)}).`, {
      kind: "ok",
      title: "Done"
    });
  } catch (err) {
    toast(err && err.message ? err.message : String(err), { kind: "error", timeout: 0 });
  } finally {
    button.disabled = false;
    tool.refreshRunButton();
  }
}

window.addEventListener("pagehide", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

start().catch((err) => console.error("[On Device] The combine tool failed to start:", err));
