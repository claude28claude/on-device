/* On Device - Read a scanned document */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { pagesToImages } from "../pdf/render.js";
import { parsePageRange } from "../pdf/doc.js";
import { recognise, judge, engineSizeBytes, shutdown } from "../pdf/ocr.js";
import { el, toast, announce, copyText, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);
let current = null;
let lastText = "";
let stop = false;

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-ocr",
    toolLabel: "Recognised text",
    fileToken: "read",
    accepts: "pdf+images",
    singleFile: true,
    onFilesChanged: (files) => open(tool, files[0])
  });

  $("copy-text").addEventListener("click", async () => {
    if (!lastText) {
      toast("Read the text first.", { kind: "warn", timeout: 4000 });
      return;
    }
    const ok = await copyText(lastText);
    toast(ok ? "Copied." : "Your browser would not let us copy.", {
      kind: ok ? "ok" : "warn",
      timeout: 4000
    });
  });

  $("run-button").addEventListener("click", () => run(tool));
}

async function open(tool, record) {
  current = null;
  lastText = "";
  $("extra-host").textContent = "";
  if (!record) return;

  if (record.kind !== "pdf") {
    current = { record, isImage: true };
    $("extra-host").append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: record.name }),
        el("p", { class: "mb-0", text: `${record.label}, ${formatBytes(record.size)}. Press Read the text.` })
      ])
    );
    return;
  }

  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password, isImage: false };
    $("extra-host").append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: record.name }),
        el("p", {
          class: "mb-0",
          text:
            `${opened.info.pageCount} page${opened.info.pageCount === 1 ? "" : "s"}. ` +
            `Recognition takes a few seconds a page, so start with one.`
        })
      ])
    );
  } catch (err) {
    toolError(err);
  }
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
    el("div", { class: "note note-accent" }, [
      el("strong", { class: "note-title", text: "Preparing the text-recognition engine" }),
      el("p", {
        text:
          `About ${Math.round(engineSizeBytes() / 1048576)} MB, downloaded once and kept on ` +
          `this device — including the English language data, which is stored here rather ` +
          `than fetched from anyone else.`
      }),
      bar,
      label,
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn btn-sm btn-danger", type: "button", onclick: () => { stop = true; } }, "Stop")
      ])
    ])
  );

  try {
    if (!current) {
      toast("Choose a scan, a photo or a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }

    const onProgress = ({ stage, fraction, loaded, total }) => {
      bar.querySelector("i").style.width = `${Math.round((fraction || 0) * 100)}%`;
      label.textContent = loaded
        ? `${stage} — ${formatBytes(loaded)} of ${formatBytes(total)}`
        : String(stage || "working");
    };

    /* Build the list of pictures to read. */
    const pictures = [];
    if (current.isImage) {
      pictures.push({ number: 1, blob: current.record.blob });
    } else {
      const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
      for (const p of problems) toast(p, { kind: "warn", timeout: 7000 });
      label.textContent = "Drawing the pages…";
      const rendered = await pagesToImages(current.record.blob, {
        password: current.password,
        dpi: Number($("dpi").value),
        format: "png",
        pages: pages.length ? pages : null,
        onProgress: (f) => {
          bar.querySelector("i").style.width = `${Math.round(f * 40)}%`;
        },
        shouldStop: () => stop
      });
      pictures.push(...rendered);
    }

    if (!pictures.length) {
      toast("There was nothing to read.", { kind: "warn", timeout: 5000 });
      return;
    }

    const results = [];
    for (let i = 0; i < pictures.length; i++) {
      if (stop) break;
      label.textContent = `Reading page ${pictures[i].number} of ${pictures.length}…`;
      const outcome = await recognise(pictures[i].blob, { onProgress });
      results.push({ number: pictures[i].number, ...outcome });
      bar.querySelector("i").style.width = `${Math.round(((i + 1) / pictures.length) * 100)}%`;
    }

    const parts = [];
    for (const r of results) {
      if (results.length > 1) parts.push(`—— Page ${r.number} ——`);
      parts.push(r.text || "(nothing readable on this page)");
      parts.push("");
    }
    lastText = parts.join("\n").trim();

    const characters = results.reduce((n, r) => n + r.text.length, 0);
    const confidences = results.map((r) => r.confidence).filter((c) => c !== null);
    const average = confidences.length
      ? Math.round(confidences.reduce((n, c) => n + c, 0) / confidences.length)
      : null;
    const verdict = judge(average, characters);

    host.textContent = "";
    const extra = $("extra-host");
    extra.textContent = "";

    const area = el("textarea", { rows: "18", id: "text-area", spellcheck: "false", "aria-label": "Recognised text" });
    area.value = lastText;

    extra.append(
      el("div", { class: "panel" }, [
        el("h2", {
          class: "h-lg",
          text: `Read ${results.length} page${results.length === 1 ? "" : "s"}`
        }),
        el("div", { class: verdict.good ? "note note-ok" : "note note-warn" }, [
          el("strong", { class: "note-title", text: verdict.good ? "How it went" : "Read this with caution" }),
          el("p", { class: "mb-0", text: verdict.text })
        ]),
        area
      ])
    );

    if (characters) {
      const base = current.record.name.replace(/\.[^.]+$/, "");
      await tray.addResult({
        blob: new Blob([lastText], { type: "text/plain;charset=utf-8" }),
        name: `${base}-read.txt`,
        fromTool: "Recognised text",
        fromFile: current.record.name
      });
      toast(
        `${characters.toLocaleString()} characters recognised` +
        (average !== null ? `, ${average}% confident` : "") +
        `. Saved as a text file.`,
        { kind: verdict.good ? "ok" : "warn", title: "Done", timeout: 11000 }
      );
    } else {
      toast(verdict.text, { kind: "warn", title: "Nothing readable", timeout: 12000 });
    }
    announce(`Recognition finished. ${characters} characters.`);
  } catch (err) {
    host.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

window.addEventListener("pagehide", shutdown);
start().catch(toolError);
