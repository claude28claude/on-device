/* On Device - Fill and sign a PDF

   What you add is drawn into the page itself rather than stored as
   an editable form field or a note, so the person receiving the
   document cannot simply move it or delete it. */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { openForWriting } from "../pdf/doc.js";
import { loadPdfEngine } from "../pdf/loader.js";
import { renderThumbnails, releaseThumbnails } from "../pdf/render.js";
import { el, toast, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);

let mode = "text";
let current = null;
let thumbs = [];
let items = [];          /* { page, x, y, type, text, size, colour, dataUrl } */
let signatureData = null;

const HINTS = {
  text: "Click on the page to place your text.",
  tick: "Click on the page to place a tick.",
  date: "Click on the page to place today's date.",
  signature: "Draw your signature below, then click on the page to place it."
};

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-fill-sign",
    toolLabel: "Signed",
    fileToken: "signed",
    singleFile: true,
    onFilesChanged: (files) => open(tool, files[0])
  });

  for (const btn of $("mode").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      for (const other of $("mode").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      $("mode-hint").textContent = HINTS[mode];
      $("text-field").hidden = mode !== "text";
      $("signature-field").hidden = mode !== "signature";
    });
  }

  $("size").addEventListener("input", () => {
    $("size-hint").textContent = `${$("size").value} points.`;
  });

  $("undo-item").addEventListener("click", () => {
    if (!items.length) {
      toast("Nothing placed yet.", { kind: "warn", timeout: 3000 });
      return;
    }
    items.pop();
    paintItems();
    announce("Last item removed.");
  });

  $("clear-items").addEventListener("click", () => {
    items = [];
    paintItems();
    announce("All placed items cleared.");
  });

  setupSignaturePad();
  $("run-button").addEventListener("click", () => run(tool));
}

/* ---- The signature pad ---------------------------------- */
function setupSignaturePad() {
  const canvas = $("signature-pad");
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#12246b";

  let drawing = false;
  let anyInk = false;

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    anyInk = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  });

  const stop = () => {
    if (!drawing) return;
    drawing = false;
    if (anyInk) signatureData = canvas.toDataURL("image/png");
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);

  $("clear-signature").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signatureData = null;
    anyInk = false;
    announce("Signature cleared.");
  });
}

/* ---- Showing the pages ---------------------------------- */
async function open(tool, record) {
  releaseThumbnails(thumbs);
  thumbs = [];
  items = [];
  current = null;
  $("extra-host").textContent = "";
  paintItems();
  if (!record) return;

  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };

    $("extra-host").append(
      el("p", { class: "muted", id: "thumb-status", text: "Drawing the pages…" })
    );

    thumbs = await renderThumbnails(record.blob, {
      password: opened.password,
      maxWidth: 640,
      onProgress: (f) => {
        const s = $("thumb-status");
        if (s) s.textContent = `Drawing pages… ${Math.round(f * 100)}%`;
      }
    });

    renderPages();
    announce(`${thumbs.length} pages ready.`);
  } catch (err) {
    toolError(err);
  }
}

function renderPages() {
  const host = $("extra-host");
  host.textContent = "";

  const panel = el("div", { class: "panel" }, [
    el("h2", { class: "h-lg", text: `Click where each thing should go on ${current.record.name}` })
  ]);

  thumbs.forEach((t) => {
    const img = el("img", { src: t.url, alt: `Page ${t.number}` });
    const stage = el("div", { class: "place-stage", dataset: { page: String(t.number) } }, img);

    stage.addEventListener("click", (e) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      place(t.number, x, y);
    });

    panel.append(
      el("div", { class: "mark-page" }, [
        el("span", { class: "mark-page-label", text: `Page ${t.number}` }),
        stage
      ])
    );
  });

  host.append(panel);
  paintItems();
}

function place(page, x, y) {
  const size = Number($("size").value);
  const colour = $("colour").value;

  if (mode === "signature") {
    if (!signatureData) {
      toast("Draw your signature in the box on the right first.", { kind: "warn", timeout: 6000 });
      return;
    }
    items.push({ page, x, y, type: "signature", dataUrl: signatureData, size: size * 3, colour });
  } else if (mode === "tick") {
    items.push({ page, x, y, type: "text", text: "✓", size: size * 1.4, colour });
  } else if (mode === "date") {
    items.push({ page, x, y, type: "text", text: new Date().toLocaleDateString(), size, colour });
  } else {
    const text = $("text").value.trim();
    if (!text) {
      toast("Type the text you want to place first.", { kind: "warn", timeout: 5000 });
      return;
    }
    items.push({ page, x, y, type: "text", text, size, colour });
  }

  paintItems();
  announce(`Placed on page ${page}.`);
}

function paintItems() {
  $("items-readout").textContent = items.length
    ? `${items.length} item${items.length === 1 ? "" : "s"} placed.`
    : "Nothing placed yet.";

  for (const stage of document.querySelectorAll(".place-stage")) {
    for (const node of stage.querySelectorAll(".placed-item")) node.remove();
    const page = Number(stage.dataset.page);

    for (const item of items.filter((i) => i.page === page)) {
      const node = el("span", { class: "placed-item" });
      node.style.left = `${item.x * 100}%`;
      node.style.top = `${item.y * 100}%`;

      if (item.type === "signature") {
        const img = el("img", { src: item.dataUrl, alt: "Signature" });
        img.style.width = `${item.size}px`;
        node.append(img);
      } else {
        node.textContent = item.text;
        node.style.color = item.colour;
        node.style.fontSize = `${item.size}px`;
      }
      stage.append(node);
    }
  }
}

/* ---- Writing it into the document ----------------------- */
async function run(tool) {
  const button = $("run-button");
  button.disabled = true;

  try {
    if (!current) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    if (!items.length) {
      toast("Nothing has been placed yet. Click on a page to add something.", {
        kind: "warn",
        timeout: 6000
      });
      return;
    }
    await tool.ensureEngine();

    const { pdfLib } = await loadPdfEngine();
    const doc = await openForWriting(current.record.blob, { name: current.record.name });
    const pages = doc.getPages();
    const font = await doc.embedFont(pdfLib.StandardFonts.Helvetica);

    for (const item of items) {
      const page = pages[item.page - 1];
      if (!page) continue;
      const { width, height } = page.getSize();

      /* Screen coordinates count downwards from the top; PDF counts
         upwards from the bottom. */
      const x = item.x * width;
      const y = height - item.y * height;

      if (item.type === "signature") {
        const bytes = dataUrlToBytes(item.dataUrl);
        const image = await doc.embedPng(bytes);
        const drawWidth = item.size;
        const drawHeight = (image.height / image.width) * drawWidth;
        page.drawImage(image, {
          x,
          y: y - drawHeight,
          width: drawWidth,
          height: drawHeight
        });
      } else {
        const rgb = hexToUnit(item.colour);
        page.drawText(item.text, {
          x,
          y: y - item.size,
          size: item.size,
          font,
          color: pdfLib.rgb(rgb.r, rgb.g, rgb.b)
        });
      }
    }

    const name = await tool.deliver(doc, current.record.name);
    toast(
      `${items.length} item${items.length === 1 ? "" : "s"} written into the page and saved as ` +
      `“${name}”. They are part of the page now, not notes that can be dragged away.`,
      { kind: "ok", title: "Signed", timeout: 11000 }
    );
    announce("The document has been signed.");
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function hexToUnit(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  };
}

window.addEventListener("pagehide", () => releaseThumbnails(thumbs));
start().catch(toolError);
