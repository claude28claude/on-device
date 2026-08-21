/* On Device - Colour picker and palette */

import { setupImageTool } from "../tool-page.js";
import { toCanvas, extractPalette } from "../image/compose.js";
import { releaseCanvas } from "../image/ops.js";
import { contrastRatio, hexToRgb } from "../colour.js";
import { el, toast, copyText, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);

async function start() {
  const tool = await setupImageTool({
    toolId: "colour-palette",
    toolLabel: "Palette",
    fileToken: "palette",
    singleFile: true,
    onFilesChanged: (files) => read(files[0]),
    buildJob: async () => ({ op: "noop" }),
    ownRun: true
  });

  $("count").addEventListener("input", () => {
    $("count-hint").textContent = `${$("count").value} colours.`;
    read(tool.getFiles()[0]);
  });
  $("run-button").addEventListener("click", () => read(tool.getFiles()[0]));
  $("run-button").textContent = "Read the colours";
}

async function read(record) {
  const host = $("extra-host");
  host.textContent = "";
  if (!record) return;

  try {
    const canvas = await toCanvas(record.blob, record.format);
    const palette = extractPalette(canvas, { count: Number($("count").value) });
    releaseCanvas(canvas);

    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    const grid = el("div", { class: "palette-grid" });
    for (const colour of palette) {
      const rgb = hexToRgb(colour.hex);
      const onWhite = contrastRatio(rgb, white);
      const onBlack = contrastRatio(rgb, black);
      const readable = onWhite >= 4.5 ? "readable on white"
        : onBlack >= 4.5 ? "readable on black"
        : "too pale for text on either";

      const swatch = el("button", {
        class: "palette-swatch",
        type: "button",
        "aria-label": `Copy ${colour.hex}`,
        onclick: async () => {
          const ok = await copyText(colour.hex);
          toast(ok ? `${colour.hex} copied.` : "Your browser would not let us copy.",
            { kind: ok ? "ok" : "warn", timeout: 3000 });
        }
      }, [
        el("span", { class: "palette-colour" }),
        el("span", { class: "palette-hex mono", text: colour.hex }),
        el("span", { class: "field-hint", text: `${colour.share}% of the picture` }),
        el("span", { class: "field-hint", text: readable })
      ]);
      swatch.querySelector(".palette-colour").style.background = colour.hex;
      grid.append(swatch);
    }

    const asText = palette.map((c) => c.hex).join(", ");
    host.append(el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: `The main colours in ${record.name}` }),
      grid,
      el("p", { class: "field-hint", text: "Click any colour to copy its code." }),
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn btn-sm", type: "button", onclick: async () => {
          const ok = await copyText(asText);
          toast(ok ? "All codes copied." : "Your browser would not let us copy.",
            { kind: ok ? "ok" : "warn", timeout: 3000 });
        }}, "Copy them all")
      ])
    ]));
    announce(`${palette.length} colours found.`);
  } catch (err) {
    host.append(el("div", { class: "note note-danger" },
      el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })));
  }
}

start().catch((err) => console.error("[On Device] The palette tool failed to start:", err));
