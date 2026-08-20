/* On Device - Split and extract pages */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { extractPages, split } from "../pdf/edit.js";
import { parsePageRange, describeRange } from "../pdf/doc.js";
import { renderThumbnails, releaseThumbnails } from "../pdf/render.js";
import { el, toast, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);

let current = null;      /* { record, info, password } */
let thumbs = [];
let picked = new Set();

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-split",
    toolLabel: "Split",
    fileToken: "pages",
    singleFile: true,
    onFilesChanged: (files) => openDocument(tool, files[0])
  });

  $("mode").addEventListener("change", syncMode);
  $("range").addEventListener("input", () => {
    if (!current) return;
    const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
    picked = new Set(pages);
    paintPicked();
    $("range-hint").textContent = problems.length
      ? problems.join("; ")
      : pages.length
        ? `${pages.length} page${pages.length === 1 ? "" : "s"}: ${describeRange(pages)}`
        : "Type page numbers and ranges, or tick pages below.";
  });

  $("run-button").addEventListener("click", () => run(tool));
  syncMode();

  function syncMode() {
    const mode = $("mode").value;
    $("range-field").hidden = mode !== "extract";
    $("every-field").hidden = mode !== "every";
  }
}

async function openDocument(tool, record) {
  const host = $("extra-host");
  releaseThumbnails(thumbs);
  thumbs = [];
  picked = new Set();
  current = null;
  host.textContent = "";
  if (!record) return;

  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };

    host.append(el("p", { class: "muted", id: "thumb-status", text: `Drawing ${opened.info.pageCount} pages…` }));

    thumbs = await renderThumbnails(record.blob, {
      password: opened.password,
      maxWidth: 130,
      onProgress: (f) => {
        const s = $("thumb-status");
        if (s) s.textContent = `Drawing pages… ${Math.round(f * 100)}%`;
      }
    });

    renderPages(record);
    announce(`${opened.info.pageCount} pages ready.`);
  } catch (err) {
    toolError(err);
  }
}

function renderPages(record) {
  const host = $("extra-host");
  host.textContent = "";

  const grid = el("div", { class: "page-grid" });
  for (const t of thumbs) {
    const box = el("label", { class: "page-card" }, [
      el("input", {
        type: "checkbox",
        "aria-label": `Page ${t.number}`,
        onchange: (e) => {
          if (e.target.checked) picked.add(t.number);
          else picked.delete(t.number);
          syncRangeBox();
        }
      }),
      el("img", { src: t.url, alt: `Page ${t.number}`, loading: "lazy" }),
      el("span", { class: "page-number", text: String(t.number) })
    ]);
    box.dataset.page = String(t.number);
    grid.append(box);
  }

  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: `${record.name} — ${thumbs.length} pages` }),
      el("div", { class: "btn-row mb-4" }, [
        el("button", { class: "btn btn-sm", type: "button", onclick: () => pickAll(true) }, "Select all"),
        el("button", { class: "btn btn-sm", type: "button", onclick: () => pickAll(false) }, "Select none"),
        el("button", { class: "btn btn-sm", type: "button", onclick: pickOdd }, "Odd pages"),
        el("button", { class: "btn btn-sm", type: "button", onclick: pickEven }, "Even pages")
      ]),
      grid
    ])
  );
}

function pickAll(on) {
  picked = on ? new Set(thumbs.map((t) => t.number)) : new Set();
  paintPicked();
  syncRangeBox();
}
function pickOdd() {
  picked = new Set(thumbs.map((t) => t.number).filter((n) => n % 2 === 1));
  paintPicked();
  syncRangeBox();
}
function pickEven() {
  picked = new Set(thumbs.map((t) => t.number).filter((n) => n % 2 === 0));
  paintPicked();
  syncRangeBox();
}

function paintPicked() {
  for (const card of document.querySelectorAll(".page-card")) {
    const n = Number(card.dataset.page);
    const box = card.querySelector("input");
    if (box) box.checked = picked.has(n);
    card.dataset.picked = String(picked.has(n));
  }
}

function syncRangeBox() {
  const pages = Array.from(picked).sort((a, b) => a - b);
  $("range").value = pages.length ? describeRange(pages) : "";
  $("range-hint").textContent = pages.length
    ? `${pages.length} page${pages.length === 1 ? "" : "s"}: ${describeRange(pages)}`
    : "Type page numbers and ranges, or tick pages below.";
  paintPicked();
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;
  try {
    if (!current) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    await tool.ensureEngine();

    const mode = $("mode").value;
    const record = current.record;

    if (mode === "extract") {
      const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
      for (const p of problems) toast(p, { kind: "warn", timeout: 7000 });
      if (!pages.length) {
        toast("No pages chosen, so there is nothing to extract.", { kind: "warn", timeout: 6000 });
        return;
      }
      const doc = await extractPages(record.blob, pages, { name: record.name });
      const name = await tool.deliver(doc, record.name);
      toast(`Pulled out ${pages.length} page${pages.length === 1 ? "" : "s"} into “${name}”.`,
        { kind: "ok", title: "Done" });
      return;
    }

    const { results } = await split(record.blob, {
      mode,
      everyN: Number($("every-n").value) || 1,
      name: record.name
    });

    if (results.length > 60) {
      toast(
        `That would make ${results.length} separate files. They will all appear in the ` +
        `results tray, which may take a moment.`,
        { kind: "warn", timeout: 9000 }
      );
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      await tool.deliver(r.doc, record.name, { suffix: `-${describeRange(r.pages)}` });
    }
    toast(`Split into ${results.length} files, all waiting in the results tray.`,
      { kind: "ok", title: "Done" });
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

window.addEventListener("pagehide", () => releaseThumbnails(thumbs));
start().catch(toolError);
