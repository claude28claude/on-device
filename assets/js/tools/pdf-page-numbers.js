/* On Device - Page numbers and headers */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { addPageNumbers } from "../pdf/stamp.js";
import { toast } from "../ui.js";

const $ = (id) => document.getElementById(id);

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-page-numbers",
    toolLabel: "Numbered",
    fileToken: "numbered",
    singleFile: true
  });

  $("size").addEventListener("input", () => {
    $("size-hint").textContent = `${$("size").value} points.`;
  });

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
    await tool.ensureEngine();

    const record = files[0];
    const doc = await addPageNumbers(record.blob, {
      name: record.name,
      format: $("format").value || "{n}",
      startAt: Number($("start-at").value) || 1,
      skipFirst: $("skip-first").checked,
      position: $("position").value,
      fontSize: Number($("size").value),
      colour: $("colour").value,
      fontId: $("font").value,
      headerText: $("header").value
    });

    const name = await tool.deliver(doc, record.name);
    toast(`Numbered and saved as "${name}".`, { kind: "ok", title: "Done" });
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
