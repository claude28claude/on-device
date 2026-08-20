/* On Device - Organise pages */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { reorder } from "../pdf/edit.js";
import { renderThumbnails, releaseThumbnails } from "../pdf/render.js";
import { el, toast, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);

let current = null;
let thumbs = [];
/* The working order: each entry points back at an original page. */
let plan = [];
let selected = new Set();

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-organise",
    toolLabel: "Organised",
    fileToken: "organised",
    singleFile: true,
    onFilesChanged: (files) => openDocument(tool, files[0])
  });

  $("rotate-all-left").addEventListener("click", () => rotateAll(-90));
  $("rotate-all-right").addEventListener("click", () => rotateAll(90));
  $("select-all").addEventListener("click", () => { selected = new Set(plan.map((p) => p.id)); paint(); });
  $("select-none").addEventListener("click", () => { selected = new Set(); paint(); });
  $("delete-selected").addEventListener("click", deleteSelected);
  $("duplicate-selected").addEventListener("click", duplicateSelected);
  $("reset-order").addEventListener("click", resetPlan);
  $("run-button").addEventListener("click", () => run(tool));
}

async function openDocument(tool, record) {
  releaseThumbnails(thumbs);
  thumbs = [];
  plan = [];
  selected = new Set();
  current = null;
  $("extra-host").textContent = "";
  if (!record) return;

  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };

    $("extra-host").append(
      el("p", { class: "muted", id: "thumb-status", text: `Drawing ${opened.info.pageCount} pages…` })
    );

    thumbs = await renderThumbnails(record.blob, {
      password: opened.password,
      maxWidth: 130,
      onProgress: (f) => {
        const s = $("thumb-status");
        if (s) s.textContent = `Drawing pages… ${Math.round(f * 100)}%`;
      }
    });

    resetPlan();
    announce(`${opened.info.pageCount} pages ready to organise.`);
  } catch (err) {
    toolError(err);
  }
}

let nextId = 1;
function resetPlan() {
  if (!thumbs.length) return;
  plan = thumbs.map((t) => ({ id: nextId++, from: t.number, rotate: 0, deleted: false, thumb: t }));
  selected = new Set();
  paint();
}

function rotateAll(by) {
  for (const p of plan) if (!p.deleted) p.rotate = ((p.rotate + by) % 360 + 360) % 360;
  paint();
  announce(`All pages turned ${by > 0 ? "right" : "left"}.`);
}

function deleteSelected() {
  if (!selected.size) {
    toast("Select some pages first.", { kind: "warn", timeout: 4000 });
    return;
  }
  let n = 0;
  for (const p of plan) if (selected.has(p.id)) { p.deleted = true; n++; }
  selected = new Set();
  paint();
  announce(`${n} pages marked for deletion. Nothing is lost until you save.`);
}

function duplicateSelected() {
  if (!selected.size) {
    toast("Select some pages first.", { kind: "warn", timeout: 4000 });
    return;
  }
  const out = [];
  for (const p of plan) {
    out.push(p);
    if (selected.has(p.id) && !p.deleted) out.push({ ...p, id: nextId++ });
  }
  plan = out;
  selected = new Set();
  paint();
}

function move(id, by) {
  const index = plan.findIndex((p) => p.id === id);
  const target = index + by;
  if (index < 0 || target < 0 || target >= plan.length) return;
  const [item] = plan.splice(index, 1);
  plan.splice(target, 0, item);
  paint();
  announce(`Page moved to position ${target + 1}.`);
}

function paint() {
  const host = $("extra-host");
  host.textContent = "";
  if (!plan.length) return;

  const kept = plan.filter((p) => !p.deleted).length;
  $("organise-readout").textContent =
    `${kept} page${kept === 1 ? "" : "s"} will be saved, from ${thumbs.length} originally. ` +
    `${selected.size} selected.`;

  const grid = el("div", { class: "page-grid" });
  plan.forEach((p, index) => {
    const img = el("img", { src: p.thumb.url, alt: `Page ${p.from}`, loading: "lazy" });
    img.dataset.rot = String(p.rotate);

    const card = el("div", { class: "page-card" }, [
      el("input", {
        type: "checkbox",
        "aria-label": `Select page ${p.from}`,
        checked: selected.has(p.id),
        onchange: (e) => {
          if (e.target.checked) selected.add(p.id);
          else selected.delete(p.id);
          $("organise-readout").textContent =
            `${plan.filter((x) => !x.deleted).length} pages will be saved. ${selected.size} selected.`;
        }
      }),
      img,
      el("span", { class: "page-number", text: `${index + 1} (was ${p.from})` }),
      el("span", { class: "page-tools" }, [
        el("button", { type: "button", title: "Move left", "aria-label": `Move page ${p.from} earlier`, onclick: () => move(p.id, -1) }, "←"),
        el("button", { type: "button", title: "Turn left", "aria-label": `Turn page ${p.from} left`, onclick: () => { p.rotate = ((p.rotate - 90) % 360 + 360) % 360; paint(); } }, "⤺"),
        el("button", { type: "button", title: "Turn right", "aria-label": `Turn page ${p.from} right`, onclick: () => { p.rotate = (p.rotate + 90) % 360; paint(); } }, "⤻"),
        el("button", {
          type: "button",
          title: p.deleted ? "Keep this page" : "Delete this page",
          "aria-label": `${p.deleted ? "Keep" : "Delete"} page ${p.from}`,
          onclick: () => { p.deleted = !p.deleted; paint(); }
        }, p.deleted ? "↺" : "✕"),
        el("button", { type: "button", title: "Move right", "aria-label": `Move page ${p.from} later`, onclick: () => move(p.id, 1) }, "→")
      ])
    ]);
    card.dataset.deleted = String(p.deleted);
    card.dataset.picked = String(selected.has(p.id));
    grid.append(card);
  });

  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: `${current.record.name} — ${plan.length} pages in the new order` }),
      el("p", { class: "field-hint", text: "Nothing is changed until you save. The original file is never touched." }),
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

    const order = plan.filter((p) => !p.deleted).map((p) => ({ from: p.from, rotate: p.rotate }));
    if (!order.length) {
      toast("Every page is marked for deletion, so there would be nothing to save.",
        { kind: "error", timeout: 8000 });
      return;
    }

    const doc = await reorder(current.record.blob, order, { name: current.record.name });
    const name = await tool.deliver(doc, current.record.name);
    toast(`Saved ${order.length} pages as “${name}”.`, { kind: "ok", title: "Done" });
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

window.addEventListener("pagehide", () => releaseThumbnails(thumbs));
start().catch(toolError);
