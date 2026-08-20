/* On Device - Redact a PDF, properly */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { redact, verifyRemoved } from "../pdf/redact.js";
import { renderThumbnails, releaseThumbnails } from "../pdf/render.js";
import { Marker } from "../marker.js";
import { el, toast, announce, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);

let current = null;
let thumbs = [];
let markers = [];   /* one Marker per page */

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-redact",
    toolLabel: "Redacted",
    fileToken: "redacted",
    singleFile: true,
    onFilesChanged: (files) => open(tool, files[0])
  });

  $("undo-box").addEventListener("click", () => {
    /* Undo on the page that has the most recent mark. */
    for (let i = markers.length - 1; i >= 0; i--) {
      if (markers[i].boxes.length) {
        markers[i].undo();
        return;
      }
    }
    toast("Nothing marked yet.", { kind: "warn", timeout: 3000 });
  });

  $("clear-boxes").addEventListener("click", () => {
    for (const m of markers) m.clear();
  });

  $("run-button").addEventListener("click", () => run(tool));
}

function totalBoxes() {
  return markers.reduce((n, m) => n + m.boxes.length, 0);
}

function updateReadout() {
  const total = totalBoxes();
  const pages = markers.filter((m) => m.boxes.length).length;
  $("box-readout").textContent = total
    ? `${total} area${total === 1 ? "" : "s"} marked across ${pages} ` +
      `page${pages === 1 ? "" : "s"}. Those ${pages} page${pages === 1 ? "" : "s"} will be ` +
      `rebuilt as pictures; the rest are untouched.`
    : "Drag across the page to mark something.";
}

async function open(tool, record) {
  releaseThumbnails(thumbs);
  thumbs = [];
  markers = [];
  current = null;
  $("extra-host").textContent = "";
  updateReadout();
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
      maxWidth: 620,
      onProgress: (f) => {
        const s = $("thumb-status");
        if (s) s.textContent = `Drawing pages… ${Math.round(f * 100)}%`;
      }
    });

    renderPages();
    announce(`${thumbs.length} pages ready to mark.`);
  } catch (err) {
    toolError(err);
  }
}

function renderPages() {
  const host = $("extra-host");
  host.textContent = "";

  const panel = el("div", { class: "panel" }, [
    el("h2", { class: "h-lg", text: `${current.record.name} — drag over anything that must be destroyed` }),
    el("p", {
      class: "field-hint",
      text:
        "Each marked area is painted onto a picture of the page, and the original page " +
        "is thrown away. Nothing underneath survives into the saved file."
    })
  ]);

  thumbs.forEach((t) => {
    const img = el("img", { src: t.url, alt: `Page ${t.number}` });
    const stage = el("div", { class: "mark-stage" }, img);

    const marker = new Marker({
      host: stage,
      label: `Redaction on page ${t.number}`,
      onChange: () => updateReadout()
    });
    marker.pageNumber = t.number;
    marker.attach(stage);
    markers.push(marker);

    panel.append(
      el("div", { class: "mark-page" }, [
        el("span", { class: "mark-page-label", text: `Page ${t.number}` }),
        stage,
        el("div", { class: "btn-row" }, [
          el("button", {
            class: "btn btn-sm",
            type: "button",
            onclick: () => marker.addByKeyboard()
          }, `Add a box to page ${t.number} without dragging`)
        ])
      ])
    );
  });

  host.append(panel);
  updateReadout();
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;

  try {
    if (!current) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    if (!totalBoxes()) {
      toast("Mark something first — drag a box over what should be destroyed.", {
        kind: "warn",
        timeout: 6000
      });
      return;
    }
    await tool.ensureEngine();

    const boxes = [];
    for (const m of markers) {
      for (const b of m.boxes) boxes.push({ ...b, page: m.pageNumber });
    }

    const host = tool.statusHost;
    const bar = el("div", { class: "progress" }, el("i"));
    host.textContent = "";
    host.append(el("div", { class: "note note-accent" }, [
      el("strong", { class: "note-title", text: "Destroying the marked content" }),
      bar
    ]));

    const result = await redact(current.record.blob, {
      name: current.record.name,
      password: current.password,
      boxes,
      dpi: Number($("dpi").value),
      onProgress: (f) => {
        bar.querySelector("i").style.width = `${Math.round(f * 100)}%`;
      }
    });

    const bytes = await result.doc.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: "application/pdf" });
    host.textContent = "";

    const base = current.record.name.replace(/\.[^.]+$/, "");
    const name = `${base}-redacted.pdf`;
    await tray.addResult({
      blob,
      name,
      fromTool: "Redacted",
      fromFile: current.record.name
    });

    /* Now prove it, if the visitor gave us something to look for. */
    const phrase = $("verify").value.trim();
    let proof = null;
    if (phrase) {
      const check = await verifyRemoved(blob, [phrase]);
      proof = check.stillPresent.length === 0;

      host.append(
        el("div", { class: proof ? "note note-ok" : "note note-danger" }, [
          el("strong", {
            class: "note-title",
            text: proof ? "Checked: that text is gone" : "Warning: that text is still there"
          }),
          el("p", {
            class: "mb-0",
            text: proof
              ? `The finished file was read back and searched for “${phrase}”. It does not ` +
                `appear anywhere in it. ${check.textLength} characters of text were read ` +
                `from the document in total.`
              : `“${phrase}” can still be found in the saved file. That means it was on a ` +
                `page you did not mark, or outside the area you marked. Check the whole ` +
                `document and mark it again.`
          })
        ])
      );
    }

    toast(
      `${result.boxCount} area${result.boxCount === 1 ? "" : "s"} destroyed across ` +
      `${result.rasterisedPages.length} page${result.rasterisedPages.length === 1 ? "" : "s"}. ` +
      `${result.untouchedPages.length} page${result.untouchedPages.length === 1 ? "" : "s"} left ` +
      `untouched. Saved as “${name}” (${formatBytes(blob.size)}).` +
      (proof === true ? " Verified: the text you named is gone." : ""),
      { kind: proof === false ? "warn" : "ok", title: "Redacted", timeout: 14000 }
    );
    announce("Redaction finished.");
  } catch (err) {
    tool.statusHost.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

window.addEventListener("pagehide", () => releaseThumbnails(thumbs));
start().catch(toolError);
