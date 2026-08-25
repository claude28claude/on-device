/* On Device - Polish a screenshot */

import { setupImageTool } from "../tool-page.js";
import { toCanvas, polish } from "../image/compose.js";
import { toBlob, releaseCanvas } from "../image/ops.js";
import { el, toast } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);
let previewUrl = null;

async function start() {
  const tool = await setupImageTool({
    toolId: "screenshot-polish",
    toolLabel: "Polished",
    fileToken: "polished",
    onFilesChanged: () => preview(tool),
    buildJob: async () => ({ op: "noop" }),
    ownRun: true
  });

  for (const id of ["padding", "radius", "shadow", "background", "gradient", "gradient-to", "format"]) {
    $(id).addEventListener("input", () => {
      paintHints();
      preview(tool);
    });
    $(id).addEventListener("change", () => {
      $("gradient-field").hidden = !$("gradient").checked;
      preview(tool);
    });
  }

  for (const btn of document.querySelectorAll("[data-bg]")) {
    btn.addEventListener("click", () => {
      const [from, to] = btn.dataset.bg.split(",");
      $("background").value = from;
      $("gradient-to").value = to;
      $("gradient").checked = from !== to;
      $("gradient-field").hidden = !$("gradient").checked;
      preview(tool);
    });
  }

  $("run-button").addEventListener("click", () => run(tool));
  paintHints();

  function paintHints() {
    $("padding-hint").textContent = `${$("padding").value}% of the shortest side.`;
    $("radius-hint").textContent = `${$("radius").value}%.`;
  }
}

function settings() {
  return {
    padding: Number($("padding").value) / 100,
    radius: Number($("radius").value) / 100,
    shadow: $("shadow").checked,
    background: $("background").value,
    gradient: $("gradient").checked,
    gradientTo: $("gradient-to").value
  };
}

async function preview(tool) {
  const host = $("extra-host");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  host.textContent = "";

  const record = tool.getFiles()[0];
  if (!record) return;

  try {
    const canvas = await toCanvas(record.blob, record.format);
    const out = polish(canvas, settings());
    releaseCanvas(canvas);
    const blob = await toBlob(out, "png");
    const dims = `${out.width} × ${out.height}`;
    releaseCanvas(out);
    previewUrl = URL.createObjectURL(blob);

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `Preview — ${dims} pixels` }),
        el("img", { src: previewUrl, alt: "Polished preview", class: "pane-image" })
      ])
    );
  } catch (err) {
    host.append(el("div", { class: "note note-warn" },
      el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })));
  }
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;
  try {
    const files = tool.getFiles();
    if (!files.length) {
      toast("Choose a screenshot first.", { kind: "warn", timeout: 4000 });
      return;
    }

    let done = 0;
    for (const record of files) {
      const canvas = await toCanvas(record.blob, record.format);
      const out = polish(canvas, settings());
      releaseCanvas(canvas);
      const format = $("format").value;
      const blob = await toBlob(out, format, 92);
      releaseCanvas(out);
      const base = record.name.replace(/\.[^.]+$/, "");
      await tray.addResult({
        blob,
        name: `${base}-polished.${format}`,
        fromTool: "Polished",
        fromFile: record.name
      });
      done++;
    }

    toast(`${done} screenshot${done === 1 ? "" : "s"} polished and in the results tray.`, {
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

start().catch((err) => console.error("[On Device] The polish tool failed to start:", err));
