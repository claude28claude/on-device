/* On Device - Watermark a PDF */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { watermark } from "../pdf/stamp.js";
import { parsePageRange } from "../pdf/doc.js";
import { toast } from "../ui.js";

const $ = (id) => document.getElementById(id);
let current = null;

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-watermark",
    toolLabel: "Watermarked",
    fileToken: "watermarked",
    singleFile: true,
    onFilesChanged: async (files) => {
      current = null;
      if (!files[0]) return;
      await tool.ensureEngine();
      const opened = await describeWithPassword(files[0]);
      if (opened) current = { record: files[0], info: opened.info, password: opened.password };
    }
  });

  const paint = () => {
    $("size-hint").textContent = `${$("size").value} points.`;
    const o = Number($("opacity").value);
    $("opacity-hint").textContent =
      `${o}% — ` +
      (o <= 15 ? "very faint" : o <= 35 ? "faint enough to read through" : o <= 65 ? "clearly visible" : "heavy");
    $("rotation-hint").textContent = `${$("rotation").value} degrees.`;
  };
  for (const id of ["size", "opacity", "rotation"]) $(id).addEventListener("input", paint);
  paint();

  $("run-button").addEventListener("click", () => run(tool));
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;
  try {
    const files = tool.getFiles();
    if (!files.length) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    if (!$("text").value.trim()) {
      toast("Type some watermark text first.", { kind: "warn", timeout: 5000 });
      return;
    }
    await tool.ensureEngine();

    const record = files[0];
    const pageCount = current ? current.info.pageCount : 0;
    const { pages, problems } = parsePageRange($("range").value, pageCount || 10000);
    for (const p of problems) toast(p, { kind: "warn", timeout: 7000 });

    const doc = await watermark(record.blob, {
      name: record.name,
      text: $("text").value,
      fontSize: Number($("size").value),
      colour: $("colour").value,
      opacity: Number($("opacity").value) / 100,
      rotation: Number($("rotation").value),
      position: $("position").value,
      tile: $("tile").checked,
      pages: pages.length ? pages : null
    });

    const name = await tool.deliver(doc, record.name);
    toast(`Watermarked and saved as “${name}”.`, { kind: "ok", title: "Done" });
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
