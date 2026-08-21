/* On Device - Several pages per sheet */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { nUp } from "../pdf/stamp.js";
import { toast } from "../ui.js";
import { adopt } from "../defaults.js";

const $ = (id) => document.getElementById(id);

async function start() {
  /* Start from whatever was chosen in Settings, and remember
     any change made here as the new default. */
  adopt({ "sheet-size": "defaults.pageSize" });

  const tool = await setupPdfTool({
    toolId: "pdf-nup",
    toolLabel: "Laid out",
    fileToken: "layout",
    singleFile: true
  });

  $("booklet").addEventListener("change", () => {
    const on = $("booklet").checked;
    $("per-sheet").disabled = on;
    if (on) $("per-sheet").value = "2";
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
    const { doc, sheets, sourcePages } = await nUp(record.blob, {
      name: record.name,
      perSheet: Number($("per-sheet").value),
      sheetSize: $("sheet-size").value,
      orientation: $("orientation").value,
      booklet: $("booklet").checked,
      margin: Number($("margin").value) || 0,
      gap: Number($("gap").value) || 0
    });

    const name = await tool.deliver(doc, record.name);
    toast(
      `${sourcePages} pages laid out onto ${sheets} sheet${sheets === 1 ? "" : "s"}. ` +
      `Saved as "${name}".` +
      ($("booklet").checked ? " Print double-sided and fold down the middle." : ""),
      { kind: "ok", title: "Done", timeout: 10000 }
    );
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
