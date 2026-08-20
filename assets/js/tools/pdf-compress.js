/* On Device - Compress a PDF */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { tidy, flattenToImages, hasSelectableText } from "../pdf/compress.js";
import { el, toast, announce, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);

let method = "tidy";
let current = null;
let textCheck = null;

const HINTS = {
  tidy: "Safe. Rewrites the file more compactly and keeps everything.",
  flatten:
    "Drastic. Every page becomes a picture, so the saving can be large — but text " +
    "stops being text."
};

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-compress",
    toolLabel: "Compressed",
    fileToken: "smaller",
    singleFile: true,
    onFilesChanged: (files) => inspect(tool, files[0])
  });

  for (const btn of $("method").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      method = btn.dataset.method;
      for (const other of $("method").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      $("method-hint").textContent = HINTS[method];
      $("flatten-options").hidden = method !== "flatten";
    });
  }

  $("quality").addEventListener("input", () => {
    $("quality-hint").textContent = `${$("quality").value} out of 100.`;
  });

  $("try-both").addEventListener("click", () => compare(tool));
  $("run-button").addEventListener("click", () => run(tool));
}

async function inspect(tool, record) {
  current = null;
  textCheck = null;
  $("extra-host").textContent = "";
  if (!record) return;

  try {
    await tool.ensureEngine();
    const opened = await describeWithPassword(record);
    if (!opened) return;
    current = { record, info: opened.info, password: opened.password };

    textCheck = await hasSelectableText(record.blob, { password: opened.password });

    $("text-warning").textContent = textCheck.hasText
      ? `This document HAS selectable text — about ${textCheck.characters} characters in ` +
        `the first ${textCheck.pagesChecked} pages. Flattening will destroy it: the words ` +
        `will still be readable by eye, but not selectable, searchable or copyable. ` +
        `And on a document that is mostly text, flattening usually makes the file ` +
        `LARGER, not smaller — pictures of words take far more room than words. ` +
        `Use "Try both and compare" before committing.`
      : `Checked the first ${textCheck.pagesChecked} pages and found no selectable text, ` +
        `so this is probably already a scan. Flattening costs you very little here, and ` +
        `is where it saves the most.`;

    $("extra-host").append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: record.name }),
        el("p", {
          text:
            `${opened.info.pageCount} page${opened.info.pageCount === 1 ? "" : "s"}, ` +
            `${formatBytes(record.size)}.`
        }),
        el("p", { class: "field-hint", text: $("text-warning").textContent })
      ])
    );
  } catch (err) {
    toolError(err);
  }
}

async function compare(tool) {
  const button = $("try-both");
  button.disabled = true;
  const host = $("extra-host");

  try {
    if (!current) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    host.textContent = "";
    host.append(el("p", { class: "muted", text: "Running both methods…" }));

    const tidied = await tidy(current.record.blob, { name: current.record.name });
    const flattened = await flattenToImages(current.record.blob, {
      name: current.record.name,
      password: current.password,
      dpi: Number($("dpi").value),
      quality: Number($("quality").value)
    });

    const original = current.record.size;
    const row = (label, size, note) => {
      const percent = Math.round((1 - size / original) * 100);
      return el("tr", {}, [
        el("td", { text: label }),
        el("td", { text: formatBytes(size) }),
        el("td", { text: percent > 0 ? `${percent}% smaller` : `${Math.abs(percent)}% larger` }),
        el("td", { text: note })
      ]);
    };

    host.textContent = "";
    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "The real numbers, for this document" }),
        el("table", {}, [
          el("thead", {}, el("tr", {}, [
            el("th", { scope: "col", text: "Method" }),
            el("th", { scope: "col", text: "Size" }),
            el("th", { scope: "col", text: "Change" }),
            el("th", { scope: "col", text: "What it costs" })
          ])),
          el("tbody", {}, [
            el("tr", {}, [
              el("td", { text: "Original" }),
              el("td", { text: formatBytes(original) }),
              el("td", { text: "—" }),
              el("td", { text: "—" })
            ]),
            row("Tidy up", tidied.blob.size, "Nothing at all"),
            row(
              "Flatten to pictures",
              flattened.blob.size,
              textCheck && textCheck.hasText
                ? "Selectable text is lost"
                : "Little, this document has no selectable text"
            )
          ])
        ]),
        el("p", {
          class: "field-hint",
          text:
            "If tidying saved almost nothing, that is normal and not a fault — it means " +
            "the file was already efficiently written. Most of a PDF's size is usually " +
            "its pictures, which only flattening touches."
        })
      ])
    );
    announce("Both methods measured.");
  } catch (err) {
    host.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
  }
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

    const record = current.record;
    let result;

    if (method === "tidy") {
      result = await tidy(record.blob, { name: record.name });
    } else {
      const host = tool.statusHost;
      const bar = el("div", { class: "progress" }, el("i"));
      host.textContent = "";
      host.append(el("div", { class: "note note-accent" }, [
        el("strong", { class: "note-title", text: "Drawing every page" }),
        bar
      ]));

      result = await flattenToImages(record.blob, {
        name: record.name,
        password: current.password,
        dpi: Number($("dpi").value),
        quality: Number($("quality").value),
        onProgress: (f) => {
          bar.querySelector("i").style.width = `${Math.round(f * 100)}%`;
        }
      });
      host.textContent = "";
    }

    const base = record.name.replace(/\.[^.]+$/, "");
    const name = `${base}-smaller.pdf`;
    await tray.addResult({
      blob: result.blob,
      name,
      fromTool: method === "tidy" ? "Tidied" : "Flattened",
      fromFile: record.name
    });

    const percent = Math.round((1 - result.newSize / result.originalSize) * 100);

    if (percent < 0) {
      toast(
        `That made the file BIGGER — ${formatBytes(result.originalSize)} up to ` +
        `${formatBytes(result.newSize)}, ${Math.abs(percent)}% larger. ` +
        (result.lossless
          ? `That is unusual; the original was already very efficiently written.`
          : `This is normal when a document is mostly text: turning crisp text into ` +
            `pictures adds far more data than it saves. Use "Tidy up" instead, or ` +
            `keep the original.`) +
        ` The result is in the tray if you want it, but you probably do not.`,
        { kind: "warn", title: "Bigger, not smaller", timeout: 0 }
      );
    } else if (percent === 0) {
      toast(
        `No change worth mentioning — ${formatBytes(result.newSize)} against ` +
        `${formatBytes(result.originalSize)}. The file was already efficiently written. ` +
        `It is in the results tray anyway, and nothing was lost.`,
        { kind: "warn", title: "No saving", timeout: 12000 }
      );
    } else {
      toast(
        `${percent}% smaller — ${formatBytes(result.originalSize)} down to ` +
        `${formatBytes(result.newSize)}. Saved as “${name}”.` +
        (result.lossless ? " Nothing was lost." : " Selectable text was replaced by pictures."),
        { kind: "ok", title: "Done", timeout: 11000 }
      );
    }
  } catch (err) {
    tool.statusHost.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
