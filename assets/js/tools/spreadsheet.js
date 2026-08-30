/* On Device - CSV, JSON and Excel */

import { initPage } from "../app.js";
import * as tray from "../tray.js";
import * as workspace from "../workspace.js";
import { el, icon, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);
let XLSX = null;
let book = null;
let record = null;

async function loadEngine() {
  if (XLSX) return XLSX;
  await import("../../vendor/sheetjs/xlsx.full.min.js");
  XLSX = globalThis.XLSX;
  if (!XLSX) throw new Error("The spreadsheet engine loaded but did not start.");
  return XLSX;
}

/* Work out which character separates the columns, by trying each and
   seeing which gives a consistent number of columns. */
function guessDelimiter(text) {
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 20);
  if (!lines.length) return ",";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => l.split(d).length);
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    const score = consistent * 100 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/* Text files are not always UTF-8. A file saved by an older Excel is
   often Windows-1252, and reading it as UTF-8 turns accented letters
   into nonsense. */
async function readText(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "UTF-8 (with a marker)" };
  }

  const strict = new TextDecoder("utf-8", { fatal: true });
  try {
    return { text: strict.decode(bytes), encoding: "UTF-8" };
  } catch (err) {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "Windows-1252",
      note:
        "This file is not UTF-8, so it was read as Windows-1252 — the encoding older " +
        "versions of Excel use. Accented letters should look right; if they do not, the " +
        "file may use a different encoding again."
    };
  }
}

async function start() {
  await initPage({ pathPrefix: "../", handlesOwnDrops: true });

  const input = el("input", {
    type: "file",
    class: "sr-only",
    accept: ".csv,.tsv,.txt,.json,.xlsx,.xls,.ods",
    id: "sheet-input",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. */
    "aria-label": "Choose a spreadsheet or data file",
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) await load(f);
    }
  });
  renderChooser(input);

  $("sheet").addEventListener("change", showSheet);
  $("delimiter").addEventListener("change", () => record && load(record.blob, record.name));
  $("run-button").addEventListener("click", convert);
  window.addEventListener("drop", async (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await load(f);
  }, true);

  update();

  function renderChooser(fileInput) {
    const host = $("files-host");
    host.textContent = "";
    host.append(
      el("div", { class: "dropzone" }, [
        icon("table", 26),
        el("h2", { class: "h-lg", text: record ? "Open another" : "Choose a spreadsheet" }),
        el("p", {
          text: record
            ? `${record.name} · ${formatBytes(record.size)}`
            : "CSV, Excel or JSON. It stays on this device."
        }),
        el("div", { class: "btn-row" }, [
          el("button", { class: "btn btn-primary", type: "button", onclick: () => fileInput.click() },
            [icon("upload", 17), document.createTextNode(" Choose a file")])
        ]),
        fileInput
      ])
    );
  }

  async function load(fileOrBlob, forcedName) {
    try {
      await loadEngine();
      let rec = null;
      if (forcedName) {
        rec = record;
      } else {
        const { added, problems } = await workspace.add([fileOrBlob]);
        for (const p of problems) toast(p.message, { kind: "warn", timeout: 8000 });
        rec = added[0];
      }
      if (!rec) return;
      record = rec;
      renderChooser(input);

      const isText = ["csv", "json", "txt", "md"].includes(rec.format);
      let note = "";

      if (rec.format === "json") {
        const { text } = await readText(rec.blob);
        const parsed = JSON.parse(text);
        const rows = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.rows) ? parsed.rows
          : [parsed];
        const sheet = XLSX.utils.json_to_sheet(rows);
        book = { SheetNames: ["Sheet1"], Sheets: { Sheet1: sheet } };
      } else if (isText) {
        const { text, encoding, note: encodingNote } = await readText(rec.blob);
        if (encodingNote) note = encodingNote;
        const chosen = $("delimiter").value;
        const delimiter = chosen === "auto" ? guessDelimiter(text) : chosen.replace("\\t", "\t");
        const names = { ",": "commas", ";": "semicolons", "\t": "tabs", "|": "pipes" };
        $("delimiter-note").textContent =
          `Read as ${encoding}, separated by ${names[delimiter] || "commas"}.` +
          (chosen === "auto" ? " Worked out automatically." : "");
        book = XLSX.read(text, { type: "string", FS: delimiter, raw: false });
      } else {
        const bytes = new Uint8Array(await rec.blob.arrayBuffer());
        book = XLSX.read(bytes, { type: "array", cellDates: true });
        $("delimiter-note").textContent = "Not a CSV, so the separator does not apply.";
      }

      const select = $("sheet");
      select.textContent = "";
      for (const name of book.SheetNames) {
        select.append(el("option", { value: name, text: name }));
      }
      select.disabled = book.SheetNames.length < 2;

      showSheet(note);
      update();
      announce(`${rec.name} opened.`);
    } catch (err) {
      $("extra-host").textContent = "";
      $("extra-host").append(
        el("div", { class: "note note-danger" }, [
          el("strong", { class: "note-title", text: "That file could not be opened" }),
          el("p", { class: "mb-0", text: explain(err) })
        ])
      );
      book = null;
      update();
    }
  }
  window.__loadSheet = load;

  function update() {
    $("run-button").disabled = !book;
  }
}

function explain(err) {
  const message = err && err.message ? err.message : String(err);
  if (/JSON/i.test(message)) {
    return `That JSON could not be read: ${message}. Check it is valid JSON — a stray ` +
           `comma or a missing bracket is the usual cause.`;
  }
  if (/password|encrypted/i.test(message)) {
    return "That spreadsheet is password-protected, which this tool cannot open.";
  }
  return message;
}

function showSheet(note) {
  const host = $("extra-host");
  host.textContent = "";
  if (!book) return;

  const name = $("sheet").value || book.SheetNames[0];
  const sheet = book.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  if (typeof note === "string" && note) {
    host.append(el("div", { class: "note note-warn" }, el("p", { class: "mb-0", text: note })));
  }

  if (!rows.length) {
    host.append(el("div", { class: "note" }, el("p", { class: "mb-0", text: "That sheet is empty." })));
    return;
  }

  const columns = Math.max(...rows.map((r) => r.length));
  const shown = rows.slice(0, 200);

  const head = el("tr", {}, [el("th", { scope: "col", text: "" })]);
  for (let c = 0; c < columns; c++) {
    head.append(el("th", { scope: "col", text: XLSX.utils.encode_col(c) }));
  }

  const body = el("tbody");
  shown.forEach((row, i) => {
    const tr = el("tr", {}, [el("th", { scope: "row", text: String(i + 1) })]);
    for (let c = 0; c < columns; c++) {
      tr.append(el("td", { text: row[c] === undefined ? "" : String(row[c]) }));
    }
    body.append(tr);
  });

  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: `${name} — ${rows.length} rows, ${columns} columns` }),
      el("div", { class: "sheet-scroll" },
        el("table", { class: "sheet-table" }, [el("thead", {}, head), body])),
      rows.length > 200
        ? el("p", { class: "field-hint", text: `Showing the first 200 rows of ${rows.length}. All of them are converted.` })
        : null
    ])
  );
}

async function convert() {
  const button = $("run-button");
  button.disabled = true;
  try {
    const format = $("format").value;
    const name = $("sheet").value || book.SheetNames[0];
    const sheet = book.Sheets[name];
    const base = (record ? record.name : "sheet").replace(/\.[^.]+$/, "");

    let blob;
    let outName;

    if (format === "json") {
      const rows = $("first-row-headers").checked
        ? XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
        : XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      outName = `${base}.json`;
    } else if (format === "csv" || format === "tsv") {
      const separator = format === "tsv" ? "\t" : ",";
      const text = XLSX.utils.sheet_to_csv(sheet, { FS: separator });
      /* The marker at the start tells Excel this really is UTF-8, which
         stops accented letters turning into rubbish when it opens. */
      blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
      outName = `${base}.${format}`;
    } else {
      const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
      blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      outName = `${base}.xlsx`;
    }

    await tray.addResult({ blob, name: outName, fromTool: "Converted", fromFile: record ? record.name : "" });
    toast(`Converted and saved as “${outName}” (${formatBytes(blob.size)}).`, {
      kind: "ok",
      title: "Done"
    });
  } catch (err) {
    toast(explain(err), { kind: "error", title: "That did not work", timeout: 0 });
  } finally {
    button.disabled = false;
  }
}

start().catch((err) => console.error("[On Device] The spreadsheet tool failed to start:", err));
