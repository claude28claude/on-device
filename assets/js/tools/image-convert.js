/* On Device - Convert images */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import * as store from "../store.js";
import { el } from "../ui.js";
import { adopt } from "../defaults.js";

const $ = (id) => document.getElementById(id);

async function start() {
  /* Start from whatever was chosen in Settings, and remember
     any change made here as the new default. */
  adopt({ format: "defaults.imageFormat", quality: "defaults.imageQuality" });

  /* Paint it once now: the slider may have started from a saved
     default, and a caption that disagrees with the control under it
     is worse than no caption. */
  $("quality-hint").textContent = `${$("quality").value} out of 100.`;

  const tool = await setupImageTool({
    toolId: "image-convert",
    toolLabel: "Convert",
    fileToken: "converted",
    onFilesChanged: describeSelection,
    buildJob: async () => ({
      op: "convert",
      format: $("format").value,
      quality: Number($("quality").value),
      background: $("background").value,
      resize: $("also-resize").checked
        ? { mode: "longest", value: Number($("max-side").value) || 2048 }
        : null
    })
  });

  pruneFormatOptions($("format"), tool.capabilities);

  /* If the browser cannot write the format that is selected, move to
     one it can, rather than letting every file fail. */
  const preferred = ["jpg", "png", "webp", "avif"].find((f) => tool.capabilities.encode[f]);
  if (!tool.capabilities.encode[$("format").value] && preferred) $("format").value = preferred;

  $("format").addEventListener("change", syncFormat);
  $("quality").addEventListener("input", paintQuality);
  $("also-resize").addEventListener("change", () => {
    $("resize-field").hidden = !$("also-resize").checked;
  });

  syncFormat();
  paintQuality();

  function paintQuality() {
    $("quality-hint").textContent = `${$("quality").value} out of 100.`;
    $("quality").setAttribute("aria-valuetext", `${$("quality").value} out of 100`);
  }

  function syncFormat() {
    const format = $("format").value;
    $("quality-field").hidden = format === "png";
    $("background-field").hidden = format !== "jpg";
    describeSelection(tool.getFiles());
  }

  function describeSelection(files) {
    const host = $("extra-host");
    host.textContent = "";
    if (!files || !files.length) return;

    const heic = files.filter((f) => f.kind === "heic");
    const target = $("format").value;
    const already = files.filter((f) => f.format === target);

    if (heic.length) {
      host.append(
        el("div", { class: "note note-warn" }, [
          el("strong", { class: "note-title", text: `${heic.length} HEIC photo${heic.length === 1 ? "" : "s"} selected` }),
          el("p", {
            class: "mb-0",
            text:
              "Whether these open depends on your browser, and there is no way to know " +
              "without trying. Press Convert: any that cannot be read will say so " +
              "individually, and the rest will still be converted."
          })
        ])
      );
    }

    if (already.length) {
      host.append(
        el("div", { class: "note" }, [
          el("p", {
            class: "mb-0",
            text:
              `${already.length} of these ${already.length === 1 ? "is" : "are"} already ` +
              `${target.toUpperCase()}. Converting will re-save ${already.length === 1 ? "it" : "them"}, ` +
              `which for JPEG means losing a little quality for no benefit.`
          })
        ])
      );
    }
  }
}

start().catch((err) => {
  console.error("[On Device] The convert tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
