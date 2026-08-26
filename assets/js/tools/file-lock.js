/* On Device - Lock a file with a password */

import { initPage } from "../app.js";
import * as workspace from "../workspace.js";
import * as tray from "../tray.js";
import { lockFile, unlockFile, isLocked, peek, judgePassword, FORMAT_NOTE } from "../lock.js";
import { el, icon, toast, announce, formatBytes, confirmDestructive } from "../ui.js";

const $ = (id) => document.getElementById(id);

let mode = "lock";
let chosen = [];

async function start() {
  await initPage({ pathPrefix: "../" });

  const input = el("input", {
    type: "file",
    multiple: true,
    class: "sr-only",
    id: "lock-input",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. */
    "aria-label": "Choose files to lock or unlock",
    onchange: async (e) => {
      const picked = e.target.files;
      e.target.value = "";
      if (picked && picked.length) await accept(picked);
    }
  });

  renderChooser(input);

  for (const btn of $("mode").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      for (const other of $("mode").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      syncMode();
      describeChosen();
    });
  }

  $("password").addEventListener("input", () => {
    const verdict = judgePassword($("password").value);
    $("strength-hint").textContent = mode === "lock" ? verdict.text : "";
    checkMatch();
  });
  $("confirm").addEventListener("input", checkMatch);

  $("show-password").addEventListener("change", () => {
    const type = $("show-password").checked ? "text" : "password";
    $("password").type = type;
    $("confirm").type = type;
  });

  $("run-button").addEventListener("click", run);

  window.addEventListener("drop", async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    await accept(e.dataTransfer.files);
  }, true);

  syncMode();

  async function accept(fileList) {
    const { added, problems } = await workspace.add(fileList);
    for (const p of problems) {
      if (p.kind === "unknown") continue;   /* a locked file is meant to be unrecognisable */
      toast(p.message, { kind: p.kind === "empty" ? "error" : "warn", title: "About that file", timeout: 10000 });
    }
    if (!added.length) return;
    chosen = added;
    renderChooser(input);
    await describeChosen();
    updateButton();
  }

  function renderChooser(fileInput) {
    const host = $("files-host");
    host.textContent = "";
    host.append(
      el("div", { class: "dropzone" }, [
        icon("upload", 26),
        el("h2", { class: "h-lg", text: chosen.length ? "Add more files" : "Choose any file" }),
        el("p", {
          text: chosen.length
            ? `${chosen.length} selected.`
            : "Anything at all — a document, a photo, a zip. It stays on this device."
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
                  renderChooser(fileInput);
                  $("extra-host").textContent = "";
                  updateButton();
                }
              }, "Clear selection")
            : null
        ]),
        fileInput
      ])
    );
  }

  async function describeChosen() {
    const host = $("extra-host");
    host.textContent = "";
    if (!chosen.length) return;

    const rows = el("tbody");
    let lockedCount = 0;

    for (const record of chosen) {
      const locked = await isLocked(record.blob);
      if (locked) lockedCount++;
      const info = locked ? await peek(record.blob) : null;
      rows.append(
        el("tr", {}, [
          el("td", { text: record.name }),
          el("td", { text: formatBytes(record.size) }),
          el("td", {
            text: locked
              ? `Locked (was “${info ? info.originalName : "unknown"}”)`
              : "Not locked"
          })
        ])
      );
    }

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `${chosen.length} file${chosen.length === 1 ? "" : "s"} selected` }),
        el("table", {}, [
          el("thead", {}, el("tr", {}, [
            el("th", { scope: "col", text: "File" }),
            el("th", { scope: "col", text: "Size" }),
            el("th", { scope: "col", text: "State" })
          ])),
          rows
        ]),
        mode === "unlock" && lockedCount === 0
          ? el("div", { class: "note note-warn" }, [
              el("p", {
                class: "mb-0",
                text:
                  "None of these are files locked by On Device. A locked file normally ends " +
                  "in .ondevice and begins with the text ONDEVLK1."
              })
            ])
          : null,
        mode === "lock" && lockedCount > 0
          ? el("div", { class: "note note-warn" }, [
              el("p", {
                class: "mb-0",
                text: `${lockedCount} of these ${lockedCount === 1 ? "is" : "are"} already locked. ` +
                      `Locking again would work, but you would then need two passwords.`
              })
            ])
          : null,
        el("p", { class: "field-hint", text: FORMAT_NOTE })
      ])
    );
  }

  function syncMode() {
    const locking = mode === "lock";
    $("confirm-field").hidden = !locking;
    $("lock-warning").hidden = !locking;
    $("run-button").dataset.label = locking ? "Lock" : "Unlock";
    $("password").setAttribute("autocomplete", locking ? "new-password" : "off");
    $("strength-hint").textContent = locking ? judgePassword($("password").value).text : "";
    updateButton();
  }

  function checkMatch() {
    if (mode !== "lock") {
      $("match-hint").textContent = "";
      return;
    }
    const a = $("password").value;
    const b = $("confirm").value;
    $("match-hint").textContent = !b ? "" : a === b ? "They match." : "These do not match yet.";
  }

  function updateButton() {
    const button = $("run-button");
    button.disabled = !chosen.length;
    const label = mode === "lock" ? "Lock" : "Unlock";
    button.textContent = chosen.length
      ? `${label} ${chosen.length} file${chosen.length === 1 ? "" : "s"}`
      : label;
  }

  window.__updateButton = updateButton;
  window.__describeChosen = describeChosen;
}

async function run() {
  const button = $("run-button");
  const password = $("password").value;
  button.disabled = true;

  const host = $("queue-host");
  host.textContent = "";

  try {
    if (!chosen.length) {
      toast("Choose a file first.", { kind: "warn", timeout: 4000 });
      return;
    }
    if (!password) {
      toast("Enter a password first.", { kind: "warn", timeout: 5000 });
      return;
    }

    if (mode === "lock") {
      if (password !== $("confirm").value) {
        toast("The two passwords do not match. Check them and try again.", {
          kind: "error",
          timeout: 7000
        });
        return;
      }
      const verdict = judgePassword(password);
      if (verdict.level === "weak") {
        const go = await confirmDestructive({
          title: "That password is short",
          body:
            verdict.text +
            " Somebody who obtains the locked file can try passwords as fast as their " +
            "computer allows. Lock it anyway?",
          confirmLabel: "Lock it anyway",
          danger: false
        });
        if (!go) return;
      }
    }

    const list = el("ul", { class: "file-list" });
    host.append(el("div", { class: "panel" }, [
      el("strong", { text: mode === "lock" ? "Locking" : "Unlocking" }),
      list
    ]));

    let done = 0;
    let failed = 0;

    for (const record of chosen) {
      const bar = el("div", { class: "progress" }, el("i"));
      const status = el("span", { class: "file-meta", text: "Working…" });
      const row = el("li", {}, [
        el("span", { class: "file-thumb", text: mode === "lock" ? "🔒" : "🔓" }),
        el("span", { class: "file-main" }, [
          el("span", { class: "file-name", text: record.name }),
          status,
          bar
        ])
      ]);
      list.append(row);

      try {
        const onProgress = ({ stage, fraction }) => {
          bar.querySelector("i").style.width = `${Math.round((fraction || 0) * 100)}%`;
          status.textContent = stage;
        };

        const result = mode === "lock"
          ? await lockFile(record.blob, password, { onProgress })
          : await unlockFile(record.blob, password, { onProgress });

        /* The blob from lockFile carries the name; unlockFile restores
           the original one. */
        const name = result.name;
        await tray.addResult({
          blob: result.blob,
          name,
          fromTool: mode === "lock" ? "Locked" : "Unlocked",
          fromFile: record.name
        });

        status.textContent = `Done — saved as ${name}`;
        row.dataset.state = "done";
        done++;
      } catch (err) {
        status.textContent = err && err.message ? err.message : String(err);
        row.dataset.state = "error";
        failed++;
      }
    }

    if (done && !failed) {
      toast(
        mode === "lock"
          ? `${done} file${done === 1 ? "" : "s"} locked. Keep that password safe — nobody ` +
            `can recover it, and without it the ${done === 1 ? "file is" : "files are"} gone.`
          : `${done} file${done === 1 ? "" : "s"} unlocked and waiting in the results tray.`,
        { kind: "ok", title: "Done", timeout: 13000 }
      );
    } else if (failed) {
      toast(`${done} succeeded, ${failed} failed. Each failure is explained in the list.`, {
        kind: failed === chosen.length ? "error" : "warn",
        title: "Partly done",
        timeout: 12000
      });
    }

    announce(`${done} finished, ${failed} failed.`);
    if (window.__describeChosen) await window.__describeChosen();
  } catch (err) {
    console.error("[On Device] Lock or unlock failed:", err);
    toast(err && err.message ? err.message : String(err), { kind: "error", timeout: 0 });
  } finally {
    button.disabled = false;
    if (window.__updateButton) window.__updateButton();
  }
}

start().catch((err) => {
  console.error("[On Device] The lock tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
