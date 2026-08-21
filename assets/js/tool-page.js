/* ============================================================
   On Device - the scaffolding every image tool shares

   Picking files, showing what was picked, running the queue, and
   sending finished files to the results tray. Each tool supplies
   only its own options and the job it wants doing.
   ============================================================ */

import { initPage } from "./app.js";
import * as workspace from "./workspace.js";
import * as tray from "./tray.js";
import * as store from "./store.js";
import { el, icon, toast, announce, formatBytes } from "./ui.js";
import { Queue } from "./queue.js";
import { run as runJob, usingBackgroundThread } from "./image/runner.js";
import { makeFilename, resolveFormat } from "./image/pipeline.js";
import { detectCapabilities } from "./image/decode.js";

const IMAGE_KINDS = new Set(["image", "heic"]);

export async function setupImageTool({
  toolId,
  toolLabel,
  fileToken,
  buildJob,
  onFilesChanged = null,
  singleFile = false,
  accept = "image/*,.heic,.heif",
  /* Does this tool produce a picture at the end? A reader does not. */
  savesPictures = true,
  /* Some tools - the ones where you mark, draw or point at something
     - do their own work rather than sending each file through the
       standard picture pipeline. They set this, and take the Run
       button entirely.

     This is not a nicety. Without it, the shared handler ALSO ran,
     quietly saving an untouched copy of the picture under a name
     that claimed something had been done to it. On the blur tool
     that meant a file called "-hidden" with nothing hidden in it. */
  ownRun = false
}) {
  await initPage({ pathPrefix: "../" });

  const filesHost = document.getElementById("files-host");
  const queueHost = document.getElementById("queue-host");
  const runButton = document.getElementById("run-button");
  const statusHost = document.getElementById("tool-status");

  const caps = await detectCapabilities();
  /* Only worth mentioning to a tool that actually saves pictures.
     On a tool that only reads one, "this browser cannot save AVIF"
     is true, irrelevant, and reads like a warning about the job in
     hand. */
  if (savesPictures) reportCapabilities(caps, statusHost);

  let chosen = [];

  const queue = new Queue({
    host: queueHost,
    toolName: toolId,
    worker: async (item, onProgress) => {
      const job = await buildJob(item.record);
      const result = await runJob(item.record.blob, item.record.format, job, onProgress);
      return result;
    },
    onItemDone: async (item, result) => {
      const pattern = store.get("defaults.filenamePattern", "{name}-{tool}.{ext}");
      const name = makeFilename(pattern, {
        name: item.record.name,
        tool: fileToken || toolId.replace(/^image-/, ""),
        format: result.format,
        index: 1
      });
      await tray.addResult({
        blob: result.blob,
        name,
        fromTool: toolLabel,
        fromFile: item.record.name
      });
    }
  });

  /* ---- Choosing files ----------------------------------- */
  const input = el("input", {
    type: "file",
    multiple: !singleFile,
    accept,
    class: "sr-only",
    id: "tool-file-input",
    onchange: async (e) => {
      const picked = e.target.files;
      e.target.value = "";
      if (!picked || !picked.length) return;
      const { added, problems } = await workspace.add(picked);
      for (const p of problems) {
        toast(p.message, {
          kind: p.kind === "mismatch" || p.kind === "large" ? "warn" : "error",
          title: p.kind === "empty" ? "That file is empty" : "About that file",
          timeout: 12000
        });
      }
      if (added.length) useFiles(added);
    }
  });

  function useFiles(records) {
    const images = records.filter((r) => IMAGE_KINDS.has(r.kind));
    const rejected = records.filter((r) => !IMAGE_KINDS.has(r.kind));
    for (const r of rejected) {
      toast(
        `“${r.name}” is a ${r.label}, not a picture, so this tool cannot use it.`,
        { kind: "warn", title: "Not an image", timeout: 9000 }
      );
    }
    if (!images.length) return;
    chosen = singleFile ? images.slice(0, 1) : images;
    queue.setFiles(chosen);
    renderChosen();
    if (onFilesChanged) onFilesChanged(chosen);
    updateRunButton();
    announce(`${chosen.length} image${chosen.length === 1 ? "" : "s"} ready.`);
  }

  function renderChosen() {
    filesHost.textContent = "";
    filesHost.append(
      el("div", { class: "dropzone", dataset: { over: "false" } }, [
        icon("upload", 26),
        el("h2", { class: "h-lg", text: chosen.length ? "Add more images" : "Choose your images" }),
        el("p", {
          text: chosen.length
            ? `${chosen.length} selected. They stay on this device.`
            : "Drag them here, or choose them. They stay on this device — nothing is uploaded."
        }),
        el("div", { class: "btn-row" }, [
          el(
            "button",
            { class: "btn btn-primary", type: "button", onclick: () => input.click() },
            [icon("upload", 17), document.createTextNode(" Choose images")]
          ),
          chosen.length
            ? el(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onclick: () => {
                    chosen = [];
                    queue.setFiles([]);
                    renderChosen();
                    if (onFilesChanged) onFilesChanged(chosen);
                    updateRunButton();
                  }
                },
                "Clear selection"
              )
            : null
        ]),
        input
      ])
    );
  }

  function updateRunButton() {
    if (!runButton) return;
    runButton.disabled = !chosen.length || queue.running;
    const label = runButton.dataset.label || "Run";
    runButton.textContent = chosen.length
      ? `${label} ${chosen.length} image${chosen.length === 1 ? "" : "s"}`
      : label;
  }

  /* Files already loaded elsewhere on the site are offered straight away. */
  const alreadyLoaded = workspace.list().filter((r) => IMAGE_KINDS.has(r.kind));
  if (alreadyLoaded.length) useFiles(alreadyLoaded);
  else renderChosen();

  /* Dropping onto a tool page uses that tool, rather than sending the
     visitor back to the homepage to start again. */
  window.addEventListener("drop", async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    const { added, problems } = await workspace.add(e.dataTransfer.files);
    for (const p of problems) {
      toast(p.message, { kind: p.kind === "empty" ? "error" : "warn", title: "About that file", timeout: 12000 });
    }
    if (added.length) useFiles(added);
  }, true);

  if (runButton && !ownRun) {
    runButton.addEventListener("click", async () => {
      if (!chosen.length) return;
      queue.reset();
      updateRunButton();
      runButton.disabled = true;
      try {
        const { done, failed } = await queue.run();
        if (done && !failed) {
          toast(
            `${done} file${done === 1 ? "" : "s"} finished and waiting in the results tray below.`,
            { kind: "ok", title: "Done" }
          );
        } else if (done && failed) {
          toast(`${done} finished, ${failed} failed. The failures explain themselves in the list.`, {
            kind: "warn",
            title: "Partly done",
            timeout: 12000
          });
        } else if (failed) {
          toast("Nothing could be processed. Each failure is explained in the list.", {
            kind: "error",
            title: "Failed",
            timeout: 0
          });
        }
      } finally {
        updateRunButton();
      }
    });
  }

  store.onChange(() => updateRunButton());
  updateRunButton();

  return { queue, getFiles: () => chosen, refreshRunButton: updateRunButton, capabilities: caps };
}

/* ---- Telling the visitor what this browser can do ------- */
function reportCapabilities(caps, host) {
  if (!host) return;
  const missing = [];
  if (!caps.encode.webp) missing.push("saving WebP");
  if (!caps.encode.avif) missing.push("saving AVIF");
  if (!caps.decode.heic) { /* unknown until tried; not reported here */ }

  if (!usingBackgroundThread()) {
    host.append(
      el("div", { class: "note note-warn" }, [
        el("strong", { class: "note-title", text: "Working on the page rather than in the background" }),
        el("p", {
          class: "mb-0",
          text:
            "This browser will not give us a background thread, so the page may stutter while " +
            "a large picture is processed. Everything still works, and nothing is uploaded."
        })
      ])
    );
  }

  if (missing.length) {
    host.append(
      el("div", { class: "note" }, [
        el("strong", { class: "note-title", text: "What this browser cannot do" }),
        el("p", {
          class: "mb-0",
          text: `It cannot manage: ${missing.join(", ")}. Those options are switched off below rather than offered and then failing.`
        })
      ])
    );
  }
}

/* Disable format options this browser cannot actually write. */
export function pruneFormatOptions(select, caps) {
  if (!select) return;
  for (const option of select.options) {
    const value = option.value;
    if (value === "keep" || value === "png" || value === "jpg") continue;
    if (caps.encode[value] === false) {
      option.disabled = true;
      option.textContent = `${option.textContent} — not supported by this browser`;
    }
  }
}
