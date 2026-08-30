/* ============================================================
   On Device - the scaffolding every PDF tool shares

   Choosing files, downloading the PDF machinery once with a real
   progress bar, asking for a password when a document needs one,
   and sending finished files to the results tray.
   ============================================================ */

import { initPage } from "./app.js";
import { t } from "./i18n.js";
import * as workspace from "./workspace.js";
import * as tray from "./tray.js";
import * as store from "./store.js";
import { el, icon, toast, announce, formatBytes, openDialog } from "./ui.js";
import { loadPdfEngine, isEngineLoaded, engineSizeBytes } from "./pdf/loader.js";
import { describe, PdfError, NEEDS_PASSWORD, WRONG_PASSWORD } from "./pdf/doc.js";
import { save } from "./pdf/edit.js";

const PDF_KINDS = new Set(["pdf"]);

/* ---- The one-time download ------------------------------ */
export async function ensureEngine(host) {
  if (isEngineLoaded()) return true;

  const bar = el("div", { class: "progress" }, el("i"));
  const label = el("p", { class: "field-hint", text: "Starting…" });
  const panel = el("div", { class: "note note-accent" }, [
    el("strong", { class: "note-title", text: "Preparing the PDF tools" }),
    el("p", {
      text:
        `Working with PDFs needs about ${Math.round(engineSizeBytes() / 1048576)} MB of ` +
        `machinery. It is downloaded once, kept on this device, and never fetched again — ` +
        `including when you are offline. Your file is not involved and is not sent anywhere.`
    }),
    bar,
    label
  ]);

  if (host) {
    host.textContent = "";
    host.append(panel);
  }
  announce(t("pdfTools.preparing"));

  try {
    await loadPdfEngine(({ loaded, total, fraction, label: part }) => {
      bar.querySelector("i").style.width = `${Math.round(fraction * 100)}%`;
      label.textContent =
        `${part} — ${formatBytes(loaded)} of ${formatBytes(total)} ` +
        `(${Math.round(fraction * 100)}%)`;
    });
    if (host) host.textContent = "";
    announce(t("pdfTools.ready"));
    return true;
  } catch (err) {
    if (host) {
      host.textContent = "";
      host.append(
        el("div", { class: "note note-danger" }, [
          el("strong", { class: "note-title", text: "The PDF tools could not be prepared" }),
          el("p", { text: err && err.message ? err.message : String(err) }),
          el("div", { class: "btn-row" }, [
            el("button", { class: "btn", type: "button", onclick: () => window.location.reload() }, "Try again")
          ])
        ])
      );
    }
    throw err;
  }
}

/* ---- Asking for a password ------------------------------ */
export async function askPassword(name, { wrong = false } = {}) {
  const input = el("input", { type: "password", id: "pdf-password", autocomplete: "off" });
  const body = el("div", {}, [
    el("p", {
      text: wrong
        ? `That password did not open “${name}”. Passwords are case-sensitive.`
        : `“${name}” is protected with a password.`
    }),
    el("div", { class: "field" }, [
      el("label", { for: "pdf-password", text: "Password" }),
      input
    ]),
    el("p", {
      class: "field-hint",
      text:
        "This is for a document you own and can already open. On Device cannot guess or " +
        "break a password, and does not try. What you type stays on this device."
    })
  ]);

  const answer = await openDialog({
    title: "Password needed",
    body,
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "ok", label: "Open", class: "btn-primary" }
    ]
  });

  return answer === "ok" ? input.value : null;
}

/* Open a document, asking for a password if it needs one.
   Returns { info, password } or null if the visitor gave up. */
export async function describeWithPassword(record) {
  let password = record.password || "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const info = await describe(record.file || record.blob, { password });
      return { info, password };
    } catch (err) {
      if (err instanceof PdfError && (err.kind === NEEDS_PASSWORD || err.kind === WRONG_PASSWORD)) {
        const entered = await askPassword(record.name, { wrong: err.kind === WRONG_PASSWORD });
        if (entered === null) return null;
        password = entered;
        continue;
      }
      throw err;
    }
  }
  toast(`Too many attempts on “${record.name}”. Nothing was sent anywhere.`, {
    kind: "warn",
    timeout: 8000
  });
  return null;
}

/* ---- The shared page set-up ----------------------------- */
export async function setupPdfTool({
  toolId,
  toolLabel,
  fileToken,
  accepts = "pdf",
  singleFile = false,
  onFilesChanged = null
}) {
  await initPage({ pathPrefix: "../", handlesOwnDrops: true });

  const filesHost = document.getElementById("files-host");
  const statusHost = document.getElementById("tool-status");
  const runButton = document.getElementById("run-button");

  let chosen = [];

  const acceptAttr = accepts === "pdf"
    ? "application/pdf,.pdf"
    : "application/pdf,.pdf,image/*";

  const input = el("input", {
    type: "file",
    multiple: !singleFile,
    accept: acceptAttr,
    class: "sr-only",
    id: "tool-file-input",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. The visible button beside it is a
       separate element and does not lend it one. */
    "aria-label": "Choose files for this tool",
    onchange: async (e) => {
      /* Take a copy of the list before clearing the input.

         input.files is LIVE: clearing the input empties the very
         same object, so reading it afterwards finds nothing and the
         chosen file is silently dropped. Array.from takes a snapshot,
         and the File objects in it stay readable once the input has
         been reset. */
      const picked = Array.from(e.target.files || []);
      e.target.value = "";
      if (picked && picked.length) await accept(picked);
    }
  });

  async function accept(fileList) {
    const { added, problems } = await workspace.add(fileList);
    for (const p of problems) {
      toast(p.message, {
        kind: p.kind === "empty" ? "error" : "warn",
        title: "About that file",
        timeout: 12000
      });
    }
    if (added.length) useFiles(added);
  }

  function wanted(record) {
    if (accepts === "pdf") return PDF_KINDS.has(record.kind);
    return PDF_KINDS.has(record.kind) || record.kind === "image" || record.kind === "heic";
  }

  function useFiles(records) {
    const good = records.filter(wanted);
    for (const r of records.filter((x) => !wanted(x))) {
      toast(
        `“${r.name}” is a ${r.label}, which this tool cannot use.`,
        { kind: "warn", title: "Wrong kind of file", timeout: 9000 }
      );
    }
    if (!good.length) return;
    chosen = singleFile ? good.slice(0, 1) : chosen.concat(good.filter((g) => !chosen.includes(g)));
    render();
    if (onFilesChanged) onFilesChanged(chosen);
    updateRunButton();
  }

  function render() {
    filesHost.textContent = "";
    filesHost.append(
      el("div", { class: "dropzone", dataset: { over: "false" } }, [
        icon("upload", 26),
        el("h2", { class: "h-lg", text: chosen.length ? "Add more files" : "Choose your files" }),
        el("p", {
          text: chosen.length
            ? `${chosen.length} selected. They stay on this device.`
            : "Drag them here, or choose them. Nothing is uploaded."
        }),
        el("div", { class: "btn-row" }, [
          el("button", { class: "btn btn-primary", type: "button", onclick: () => input.click() },
            [icon("upload", 17), document.createTextNode(" Choose files")]),
          chosen.length
            ? el("button", {
                class: "btn",
                type: "button",
                onclick: () => {
                  chosen = [];
                  render();
                  if (onFilesChanged) onFilesChanged(chosen);
                  updateRunButton();
                }
              }, "Clear selection")
            : null
        ]),
        input
      ])
    );
  }

  function updateRunButton() {
    if (!runButton) return;
    const label = runButton.dataset.label || "Run";
    runButton.disabled = !chosen.length;
    runButton.textContent = chosen.length > 1
      ? t("tool.runCount.files", { n: chosen.length, label })
      : label;
  }

  const already = workspace.list().filter(wanted);
  if (already.length) useFiles(already);
  else render();

  window.addEventListener("drop", async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    await accept(e.dataTransfer.files);
  }, true);

  /* Deliver a finished document to the tray. */
  async function deliver(pdfDoc, sourceName, { suffix = "" } = {}) {
    const pattern = store.get("defaults.filenamePattern", "{name}-{tool}.{ext}");
    const base = String(sourceName).replace(/\.[^.]+$/, "");
    const name = pattern
      .replace(/\{name\}/g, base)
      .replace(/\{tool\}/g, (fileToken || toolId) + suffix)
      .replace(/\{date\}/g, new Date().toISOString().slice(0, 10))
      .replace(/\{n\}/g, "1")
      .replace(/\{ext\}/g, "pdf");
    const finalName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
    const saved = await save(pdfDoc, { name: finalName });
    await tray.addResult({
      blob: saved.blob,
      name: finalName,
      fromTool: toolLabel,
      fromFile: sourceName
    });
    return finalName;
  }

  async function deliverBlob(blob, name) {
    await tray.addResult({ blob, name, fromTool: toolLabel });
    return name;
  }

  return {
    getFiles: () => chosen,
    setFiles: (list) => { chosen = list; render(); updateRunButton(); },
    refresh: updateRunButton,
    statusHost,
    deliver,
    deliverBlob,
    ensureEngine: () => ensureEngine(statusHost)
  };
}

export function toolError(err) {
  const host = document.getElementById("tool-status");
  console.error("[On Device]", err);
  if (!host) return;
  host.textContent = "";
  host.append(
    el("div", { class: "note note-danger" }, [
      el("strong", { class: "note-title", text: "That did not work" }),
      el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
    ])
  );
}
