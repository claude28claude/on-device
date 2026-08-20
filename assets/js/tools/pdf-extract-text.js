/* On Device - Extract text from a PDF */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { extractText } from "../pdf/render.js";
import { parsePageRange, describeRange } from "../pdf/doc.js";
import { el, toast, announce, copyText, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);
let current = null;
let lastText = "";

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-extract-text",
    toolLabel: "Text",
    fileToken: "text",
    singleFile: true,
    onFilesChanged: (files) => open(tool, files[0])
  });

  $("range").addEventListener("input", () => {
    if (!current) return;
    const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
    $("range-hint").textContent = problems.length
      ? problems.join("; ")
      : pages.length
        ? `${pages.length} page${pages.length === 1 ? "" : "s"}: ${describeRange(pages)}`
        : "Leave empty for the whole document.";
  });

  $("copy-text").addEventListener("click", async () => {
    if (!lastText) {
      toast("Extract the text first.", { kind: "warn", timeout: 4000 });
      return;
    }
    const ok = await copyText(lastText);
    toast(ok ? "Copied." : "Your browser would not let us copy. Select it and copy by hand.", {
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
  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };
    $("extra-host").append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: record.name }),
        el("p", {
          class: "mb-0",
          text: `${opened.info.pageCount} page${opened.info.pageCount === 1 ? "" : "s"}, ` +
                `${formatBytes(record.size)}. Press Extract the text.`
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
  const host = $("extra-host");

  try {
    if (!current) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    await tool.ensureEngine();

    const { pages, problems } = parsePageRange($("range").value, current.info.pageCount);
    for (const p of problems) toast(p, { kind: "warn", timeout: 7000 });

    const bar = el("div", { class: "progress" }, el("i"));
    host.textContent = "";
    host.append(el("div", { class: "panel" }, [el("p", { class: "muted", text: "Reading…" }), bar]));

    const result = await extractText(current.record.blob, {
      password: current.password,
      pages: pages.length ? pages : null,
      onProgress: (f) => {
        bar.querySelector("i").style.width = `${Math.round(f * 100)}%`;
      }
    });

    const withMarks = $("page-marks").checked;
    const parts = [];
    let empty = 0;
    for (const page of result) {
      if (!page.text) empty++;
      if (withMarks) parts.push(`—— Page ${page.number} ——`);
      parts.push(page.text || "(this page has no selectable text)");
      parts.push("");
    }
    lastText = parts.join("\n").trim();

    const characters = result.reduce((n, p) => n + p.text.length, 0);
    host.textContent = "";

    if (!characters) {
      host.append(
        el("div", { class: "note note-warn" }, [
          el("strong", { class: "note-title", text: "No text found at all" }),
          el("p", {
            class: "mb-0",
            text:
              "Every page in this document is a picture rather than text — which is what a " +
              "scan is. There is nothing here to extract. Use “Read a scanned document” " +
              "instead: it works out what the words say by looking at them."
          })
        ])
      );
      announce("No text found. This is a scan.");
      return;
    }

    const area = el("textarea", { rows: "18", id: "text-area", spellcheck: "false", "aria-label": "Extracted text" });
    area.value = lastText;

    host.append(
      el("div", { class: "panel" }, [
        el("h2", {
          class: "h-lg",
          text: `${characters.toLocaleString()} characters from ${result.length} page${result.length === 1 ? "" : "s"}`
        }),
        empty
          ? el("div", { class: "note note-warn" }, el("p", {
              class: "mb-0",
              text:
                `${empty} of these ${result.length} pages contain no selectable text. Those ` +
                `pages are pictures — probably scanned. The text-recognition tool can read them.`
            }))
          : null,
        area
      ])
    );

    const base = current.record.name.replace(/\.[^.]+$/, "");
    await tray.addResult({
      blob: new Blob([lastText], { type: "text/plain;charset=utf-8" }),
      name: `${base}.txt`,
      fromTool: "Text",
      fromFile: current.record.name
    });

    toast(`${characters.toLocaleString()} characters extracted and saved as a text file.`, {
      kind: "ok",
      title: "Done"
    });
    announce("Text extracted.");
  } catch (err) {
    host.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
