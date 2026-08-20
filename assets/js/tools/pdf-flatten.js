/* On Device - Flatten a PDF */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { flatten } from "../pdf/stamp.js";
import { toast } from "../ui.js";

const $ = (id) => document.getElementById(id);

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-flatten",
    toolLabel: "Flattened",
    fileToken: "flattened",
    singleFile: true,
    onFilesChanged: (files) => {
      if (files[0]) $("field-readout").textContent = "Press Flatten to bake in the form fields.";
    }
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
    const { doc, fieldCount } = await flatten(record.blob, { name: record.name });

    if (!fieldCount) {
      $("field-readout").textContent =
        "This document has no form fields, so there was nothing to bake in.";
      toast(
        "This PDF has no form fields. It has been saved again unchanged, which is " +
        "harmless but achieved nothing.",
        { kind: "warn", timeout: 9000 }
      );
    } else {
      $("field-readout").textContent = `${fieldCount} form fields were baked in.`;
    }

    const name = await tool.deliver(doc, record.name);
    if (fieldCount) {
      toast(`Flattened ${fieldCount} fields into the page. Saved as "${name}".`,
        { kind: "ok", title: "Done" });
    }
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
