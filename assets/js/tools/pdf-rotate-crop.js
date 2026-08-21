/* On Device - Rotate and crop PDF pages */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { rotatePages, cropPages } from "../pdf/edit.js";
import { parsePageRange, describeRange } from "../pdf/doc.js";
import { renderThumbnails, releaseThumbnails } from "../pdf/render.js";
import { el, toast, announce } from "../ui.js";
import { describePageSize } from "../measure.js";

const $ = (id) => document.getElementById(id);

let current = null;
let thumbs = [];
let degrees = 0;

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-rotate-crop",
    toolLabel: "Rotated and cropped",
    fileToken: "adjusted",
    singleFile: true,
    onFilesChanged: (files) => openDocument(tool, files[0])
  });

  for (const btn of $("turn").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      degrees = Number(btn.dataset.degrees);
      for (const other of $("turn").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      paintPreview();
    });
  }

  for (const id of ["crop-top", "crop-bottom", "crop-left", "crop-right"]) {
    $(id).addEventListener("input", () => {
      paintCropReadout();
      paintPreview();
    });
  }

  $("run-button").addEventListener("click", () => run(tool));
  paintCropReadout();
}

function margins() {
  return {
    top: Number($("crop-top").value) / 100,
    bottom: Number($("crop-bottom").value) / 100,
    left: Number($("crop-left").value) / 100,
    right: Number($("crop-right").value) / 100
  };
}

function paintCropReadout() {
  const m = margins();
  const any = m.top || m.bottom || m.left || m.right;
  if (!any) {
    $("crop-readout").textContent = "Nothing trimmed.";
    return;
  }
  const parts = [];
  if (m.top) parts.push(`${Math.round(m.top * 100)}% off the top`);
  if (m.bottom) parts.push(`${Math.round(m.bottom * 100)}% off the bottom`);
  if (m.left) parts.push(`${Math.round(m.left * 100)}% off the left`);
  if (m.right) parts.push(`${Math.round(m.right * 100)}% off the right`);

  let text = parts.join(", ") + ".";
  if (current && current.info.pages[0]) {
    const page = current.info.pages[0];
    const w = Math.round(page.width * (1 - m.left - m.right));
    const h = Math.round(page.height * (1 - m.top - m.bottom));
    text += ` The first page becomes about ${describePageSize(w, h)}.`;
  }
  $("crop-readout").textContent = text;
}

async function openDocument(tool, record) {
  releaseThumbnails(thumbs);
  thumbs = [];
  current = null;
  $("extra-host").textContent = "";
  if (!record) return;

  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };

    /* Only the first few pages are drawn - this is a preview, not the job. */
    const preview = opened.info.pages.slice(0, 4).map((p) => p.number);
    thumbs = await renderThumbnails(record.blob, {
      password: opened.password,
      maxWidth: 170,
      pages: preview
    });

    paintPreview();
    paintCropReadout();
    announce(`${opened.info.pageCount} pages ready.`);
  } catch (err) {
    toolError(err);
  }
}

function paintPreview() {
  const host = $("extra-host");
  host.textContent = "";
  if (!current || !thumbs.length) return;

  const m = margins();
  const grid = el("div", { class: "page-grid" });

  for (const t of thumbs) {
    const frame = el("div", { class: "crop-preview" });
    const img = el("img", { src: t.url, alt: `Page ${t.number}`, loading: "lazy" });
    img.dataset.rot = String(degrees);

    /* Shade the parts that will be trimmed away. */
    const veil = el("span", { class: "crop-veil" });
    veil.style.top = "0";
    veil.style.left = "0";
    veil.style.right = "0";
    veil.style.bottom = "0";
    veil.style.borderTopWidth = `${m.top * 100}%`;
    veil.style.borderBottomWidth = `${m.bottom * 100}%`;
    veil.style.borderLeftWidth = `${m.left * 100}%`;
    veil.style.borderRightWidth = `${m.right * 100}%`;

    frame.append(img, veil);

    const card = el("div", { class: "page-card" }, [
      frame,
      el("span", { class: "page-number", text: `Page ${t.number}` })
    ]);
    grid.append(card);
  }

  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: "Preview" }),
      el("p", {
        class: "field-hint",
        text:
          `Showing the first ${thumbs.length} of ${current.info.pageCount} pages. ` +
          `The shaded border is what gets trimmed.`
      }),
      grid
    ])
  );
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

    const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
    for (const p of problems) toast(p, { kind: "warn", timeout: 7000 });
    const wanted = pages.length ? pages : null;

    const m = margins();
    const anyCrop = m.top || m.bottom || m.left || m.right;

    if (!degrees && !anyCrop) {
      toast("Nothing to do — choose a rotation or trim an edge.", { kind: "warn", timeout: 5000 });
      return;
    }

    let doc;
    if (degrees) {
      doc = await rotatePages(current.record.blob, {
        degrees,
        pages: wanted,
        name: current.record.name
      });
    }

    if (anyCrop) {
      /* Cropping reads from the file again, so if we have already rotated we
         must save that first and crop the saved copy. */
      let source = current.record.blob;
      if (doc) {
        const bytes = await doc.save({ useObjectStreams: true });
        source = new Blob([bytes], { type: "application/pdf" });
      }
      doc = await cropPages(source, {
        margins: m,
        pages: wanted,
        name: current.record.name
      });
    }

    const name = await tool.deliver(doc, current.record.name);
    const what = [
      degrees ? `turned ${degrees}°` : null,
      anyCrop ? "trimmed" : null
    ].filter(Boolean).join(" and ");
    toast(
      `${wanted ? describeRange(wanted) + " " : "All pages "}${what}. Saved as “${name}”.`,
      { kind: "ok", title: "Done" }
    );
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

window.addEventListener("pagehide", () => releaseThumbnails(thumbs));
start().catch(toolError);
