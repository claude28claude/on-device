/* On Device - PDF to images */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { pagesToImages, pixelSizeFor } from "../pdf/render.js";
import { parsePageRange, describeRange } from "../pdf/doc.js";
import { el, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);
let current = null;
let stop = false;

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-to-images",
    toolLabel: "Page image",
    fileToken: "page",
    singleFile: true,
    onFilesChanged: (files) => openDocument(tool, files[0])
  });

  $("format").addEventListener("change", () => {
    $("quality-field").hidden = $("format").value !== "jpg";
  });
  $("quality").addEventListener("input", () => {
    $("quality-hint").textContent = `${$("quality").value} out of 100.`;
  });
  $("range").addEventListener("input", () => {
    if (!current) return;
    const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
    $("range-hint").textContent = problems.length
      ? problems.join("; ")
      : pages.length
        ? `${pages.length} page${pages.length === 1 ? "" : "s"}: ${describeRange(pages)}`
        : "Leave empty for every page.";
  });
  $("dpi").addEventListener("change", estimate);

  $("run-button").addEventListener("click", () => run(tool));
}

async function openDocument(tool, record) {
  current = null;
  $("extra-host").textContent = "";
  if (!record) return;
  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };

    const first = opened.info.pages[0];
    const mmWide = first ? Math.round((first.width / 72) * 25.4) : 0;
    const mmTall = first ? Math.round((first.height / 72) * 25.4) : 0;

    $("extra-host").append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: record.name }),
        el("p", {
          text:
            `${opened.info.pageCount} page${opened.info.pageCount === 1 ? "" : "s"}` +
            (first ? `, about ${mmWide} by ${mmTall} millimetres each.` : ".")
        }),
        el("p", { class: "field-hint", id: "size-estimate" })
      ])
    );
    estimate();
  } catch (err) {
    toolError(err);
  }
}

function estimate() {
  const node = $("size-estimate");
  if (!node || !current) return;
  const first = current.info.pages[0];
  if (!first) return;
  const dpi = Number($("dpi").value);
  const size = pixelSizeFor(first.width, first.height, dpi);
  node.textContent =
    `At ${dpi} dots per inch each page comes out ${size.width} by ${size.height} pixels.`;
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;
  stop = false;

  const host = $("queue-host");
  const bar = el("div", { class: "progress" }, el("i"));
  const label = el("p", { class: "field-hint", text: "Starting…" });
  host.textContent = "";
  host.append(
    el("div", { class: "panel" }, [
      el("div", { class: "flex-row mb-4" }, [
        el("strong", { text: "Exporting pages" }),
        el(
          "button",
          {
            class: "btn btn-sm btn-danger",
            type: "button",
            onclick: () => {
              stop = true;
            }
          },
          "Stop"
        )
      ]),
      bar,
      label
    ])
  );

  try {
    if (!current) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    await tool.ensureEngine();

    const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
    for (const p of problems) toast(p, { kind: "warn", timeout: 7000 });
    const wanted = pages.length ? pages : null;

    const format = $("format").value;
    const results = await pagesToImages(current.record.blob, {
      password: current.password,
      dpi: Number($("dpi").value),
      format,
      quality: Number($("quality").value),
      pages: wanted,
      onProgress: (f) => {
        bar.querySelector("i").style.width = `${Math.round(f * 100)}%`;
        label.textContent = `${Math.round(f * 100)}% done`;
      },
      shouldStop: () => stop
    });

    const base = current.record.name.replace(/\.[^.]+$/, "");
    let bytes = 0;
    for (const r of results) {
      bytes += r.blob.size;
      await tool.deliverBlob(r.blob, `${base}-page-${String(r.number).padStart(3, "0")}.${format}`);
    }

    host.textContent = "";
    if (stop) {
      toast(`Stopped after ${results.length} pages. Those are in the results tray.`, {
        kind: "warn",
        timeout: 8000
      });
    } else {
      toast(
        `Exported ${results.length} page${results.length === 1 ? "" : "s"} ` +
        `(${formatBytes(bytes)}) to the results tray.`,
        { kind: "ok", title: "Done" }
      );
    }
    announce(`${results.length} pages exported.`);
  } catch (err) {
    host.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
