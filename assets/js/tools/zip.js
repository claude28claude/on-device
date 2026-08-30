/* On Device - Zip and unzip */

import { initPage } from "../app.js";
import * as tray from "../tray.js";
import * as workspace from "../workspace.js";
import { el, icon, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);
let mode = "zip";
let chosen = [];
let zipLib = null;

async function loadZip() {
  if (zipLib) return zipLib;
  const mod = await import("../../vendor/zipjs/zip.min.js");
  zipLib = mod;
  /* Compression runs on its own threads by default, which is what we
     want - the interface stays responsive. */
  if (mod.configure) mod.configure({ useWebWorkers: true });
  return zipLib;
}

async function start() {
  await initPage({ pathPrefix: "../", handlesOwnDrops: true });

  const input = el("input", {
    type: "file",
    multiple: true,
    class: "sr-only",
    id: "zip-input",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. */
    "aria-label": "Choose files to zip or unzip",
    onchange: async (e) => {
      /* Take a copy of the list before clearing the input.

         input.files is LIVE: clearing the input empties the very
         same object, so reading it afterwards finds nothing and the
         chosen file is silently dropped. Array.from takes a snapshot,
         and the File objects in it stay readable once the input has
         been reset. */
      const f = Array.from(e.target.files || []);
      e.target.value = "";
      if (f && f.length) await accept(f);
    }
  });
  render(input);

  for (const btn of $("mode").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      for (const other of $("mode").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      syncMode();
      render(input);
      describe();
    });
  }

  $("run-button").addEventListener("click", run);
  window.addEventListener("drop", async (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      await accept(e.dataTransfer.files);
    }
  }, true);

  syncMode();
  update();

  async function accept(list) {
    const { added, problems } = await workspace.add(list);
    for (const p of problems) {
      if (p.kind === "unknown") continue;
      toast(p.message, { kind: p.kind === "empty" ? "error" : "warn", timeout: 9000 });
    }
    if (!added.length) return;
    chosen = mode === "unzip" ? added.slice(0, 1) : chosen.concat(added);
    render(input);
    await describe();
    update();
  }

  function render(fileInput) {
    const host = $("files-host");
    host.textContent = "";
    host.append(
      el("div", { class: "dropzone" }, [
        icon("package", 26),
        el("h2", {
          class: "h-lg",
          text: mode === "zip" ? "Choose files to bundle" : "Choose a zip to open"
        }),
        el("p", {
          text: chosen.length
            ? `${chosen.length} selected.`
            : "They stay on this device — nothing is uploaded."
        }),
        el("div", { class: "btn-row" }, [
          el("button", { class: "btn btn-primary", type: "button", onclick: () => fileInput.click() },
            [icon("upload", 17), document.createTextNode(" Choose files")]),
          chosen.length
            ? el("button", {
                class: "btn",
                type: "button",
                onclick: () => {
                  chosen = [];
                  render(fileInput);
                  $("extra-host").textContent = "";
                  update();
                }
              }, "Clear")
            : null
        ]),
        fileInput
      ])
    );
  }

  function syncMode() {
    $("name-field").hidden = mode !== "zip";
    $("level-field").hidden = mode !== "zip";
    $("password-hint").textContent = mode === "zip"
      ? "Leave empty for no password. Zip encryption is weaker than the Lock a file tool."
      : "Only needed if the zip is password-protected.";
    $("run-button").dataset.label = mode === "zip" ? "Make a zip" : "Open the zip";
    update();
  }

  async function describe() {
    const host = $("extra-host");
    host.textContent = "";
    if (!chosen.length) return;

    if (mode === "zip") {
      const total = chosen.reduce((n, c) => n + c.size, 0);
      const list = el("ul", { class: "file-list" });
      for (const c of chosen) {
        list.append(el("li", {}, [
          el("span", { class: "file-thumb", text: (c.format || "?").slice(0, 4) }),
          el("span", { class: "file-main" }, [
            el("span", { class: "file-name", text: c.name }),
            el("span", { class: "file-meta", text: formatBytes(c.size) })
          ])
        ]));
      }
      host.append(el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `${chosen.length} files, ${formatBytes(total)} in total` }),
        list
      ]));
      return;
    }

    /* Show what is inside the zip before unpacking it. */
    try {
      const zip = await loadZip();
      const reader = new zip.ZipReader(new zip.BlobReader(chosen[0].blob), {
        password: $("password").value || undefined
      });
      const entries = await reader.getEntries();
      await reader.close();

      const rows = el("tbody");
      for (const entry of entries.slice(0, 300)) {
        rows.append(el("tr", {}, [
          el("td", { text: entry.filename }),
          el("td", { text: entry.directory ? "folder" : formatBytes(entry.uncompressedSize) }),
          el("td", { text: entry.encrypted ? "locked" : "" })
        ]));
      }

      host.append(el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `${entries.length} items inside ${chosen[0].name}` }),
        entries.some((e) => e.encrypted)
          ? el("div", { class: "note note-warn" }, el("p", {
              class: "mb-0",
              text: "Some items are password-protected. Enter the password before opening."
            }))
          : null,
        el("table", {}, [
          el("thead", {}, el("tr", {}, [
            el("th", { scope: "col", text: "Name" }),
            el("th", { scope: "col", text: "Size" }),
            el("th", { scope: "col", text: "" })
          ])),
          rows
        ]),
        entries.length > 300
          ? el("p", { class: "field-hint", text: `Showing the first 300 of ${entries.length}.` })
          : null
      ]));
    } catch (err) {
      host.append(el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "That zip could not be read" }),
        el("p", { class: "mb-0", text: explain(err) })
      ]));
    }
  }

  function update() {
    const b = $("run-button");
    b.disabled = !chosen.length;
    b.textContent = b.dataset.label || "Run";
  }
  window.__updateZip = update;
  window.__describeZip = describe;
}

function explain(err) {
  const message = err && err.message ? err.message : String(err);
  if (/password/i.test(message)) {
    return "That zip is password-protected, or the password given is wrong.";
  }
  if (/end of central directory|not.*zip/i.test(message)) {
    return "That does not look like a zip file, or it is damaged and incomplete.";
  }
  return message;
}

async function run() {
  const button = $("run-button");
  button.disabled = true;
  const host = $("queue-host");
  host.textContent = "";
  const bar = el("div", { class: "progress" }, el("i"));
  const label = el("p", { class: "field-hint", text: "Working…" });
  host.append(el("div", { class: "panel" }, [bar, label]));

  try {
    const zip = await loadZip();
    const password = $("password").value || undefined;

    if (mode === "zip") {
      const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"), {
        password,
        level: Number($("level").value),
        encryptionStrength: 3
      });

      for (let i = 0; i < chosen.length; i++) {
        const record = chosen[i];
        label.textContent = `Adding ${record.name}…`;
        await writer.add(record.name, new zip.BlobReader(record.blob));
        bar.querySelector("i").style.width = `${Math.round(((i + 1) / chosen.length) * 100)}%`;
      }

      const blob = await writer.close();
      const name = ($("zip-name").value || "files.zip").replace(/(\.zip)?$/i, ".zip");
      await tray.addResult({ blob, name, fromTool: "Zipped" });

      const original = chosen.reduce((n, c) => n + c.size, 0);
      const saved = Math.round((1 - blob.size / Math.max(1, original)) * 100);
      host.textContent = "";
      toast(
        `${chosen.length} files bundled into “${name}” (${formatBytes(blob.size)}` +
        (saved > 0 ? `, ${saved}% smaller than the originals` : "") + `).` +
        (password ? " It is password-protected." : ""),
        { kind: "ok", title: "Done", timeout: 10000 }
      );
    } else {
      const reader = new zip.ZipReader(new zip.BlobReader(chosen[0].blob), { password });
      const entries = await reader.getEntries();
      const files = entries.filter((e) => !e.directory);

      if (!files.length) {
        toast("That zip contains no files, only folders.", { kind: "warn", timeout: 7000 });
        return;
      }
      if (files.length > 200) {
        toast(
          `That zip holds ${files.length} files. They will all go into the results tray, ` +
          `which may take a moment.`,
          { kind: "warn", timeout: 9000 }
        );
      }

      for (let i = 0; i < files.length; i++) {
        const entry = files[i];
        label.textContent = `Extracting ${entry.filename}…`;
        const blob = await entry.getData(new zip.BlobWriter());
        await tray.addResult({
          blob,
          name: entry.filename.split("/").pop() || entry.filename,
          fromTool: "Unzipped",
          fromFile: chosen[0].name
        });
        bar.querySelector("i").style.width = `${Math.round(((i + 1) / files.length) * 100)}%`;
      }
      await reader.close();

      host.textContent = "";
      toast(`${files.length} files taken out and waiting in the results tray.`, {
        kind: "ok",
        title: "Done"
      });
    }
    announce("Finished.");
  } catch (err) {
    host.textContent = "";
    host.append(el("div", { class: "note note-danger" }, [
      el("strong", { class: "note-title", text: "That did not work" }),
      el("p", { class: "mb-0", text: explain(err) })
    ]));
  } finally {
    button.disabled = false;
    if (window.__updateZip) window.__updateZip();
  }
}

start().catch((err) => console.error("[On Device] The zip tool failed to start:", err));
