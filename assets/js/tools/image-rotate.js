/* On Device - Rotate and flip */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import { el } from "../ui.js";

const $ = (id) => document.getElementById(id);
let degrees = 0;

async function start() {
  const tool = await setupImageTool({
    toolId: "image-rotate",
    toolLabel: "Rotate",
    fileToken: "rotated",
    buildJob: async () => ({
      op: "rotate",
      rotate: { degrees, flipH: $("flip-h").checked, flipV: $("flip-v").checked },
      straighten: Number($("straighten").value) ? { degrees: Number($("straighten").value) } : null,
      background: $("background").value,
      format: $("format").value,
      quality: Number($("quality").value)
    })
  });

  pruneFormatOptions($("format"), tool.capabilities);

  for (const btn of $("turn").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      degrees = Number(btn.dataset.degrees);
      for (const other of $("turn").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
    });
  }

  $("straighten").addEventListener("input", () => {
    const v = Number($("straighten").value);
    $("straighten-value").textContent = `${v}\u00B0`;
    $("straighten").setAttribute("aria-valuetext", `${v} degrees`);
    /* The corner colour only matters once there are corners to fill. */
    $("background-field").hidden = v === 0;
  });

  $("format").addEventListener("change", () => {
    $("quality-field").hidden = $("format").value === "png";
  });
  $("quality").addEventListener("input", () => {
    $("quality-hint").textContent = `${$("quality").value} out of 100.`;
  });
}

start().catch((err) => {
  console.error("[On Device] The rotate tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
