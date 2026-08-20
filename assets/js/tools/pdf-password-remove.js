/* On Device - Remove a PDF password */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { removePassword, isEncrypted } from "../pdf/password.js";
import { el, toast, announce, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-password-remove",
    toolLabel: "Password removed",
    fileToken: "unlocked",
    singleFile: true,
    onFilesChanged: (files) => describe(files[0])
  });

  $("show-password").addEventListener("change", () => {
    $("password").type = $("show-password").checked ? "text" : "password";
  });

  $("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") run(tool);
  });

  $("run-button").addEventListener("click", () => run(tool));

  async function describe(record) {
    const host = $("extra-host");
    host.textContent = "";
    if (!record) return;

    const locked = await isEncrypted(record.blob);
    host.append(
      el("div", { class: locked ? "note note-accent" : "note note-warn" }, [
        el("strong", {
          class: "note-title",
          text: locked ? "This document is protected" : "This document has no password"
        }),
        el("p", {
          class: "mb-0",
          text: locked
            ? `“${record.name}” is encrypted. Enter its password and it will be saved ` +
              `again without one.`
            : `“${record.name}” already opens without a password, so there is nothing ` +
              `here to remove.`
        })
      ])
    );
  }
}

async function run(tool) {
  const button = $("run-button");
  const files = tool.getFiles();
  button.disabled = true;

  try {
    if (!files.length) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    const password = $("password").value;
    if (!password) {
      toast(
        "Enter the document's password. On Device cannot open a PDF without it — " +
        "there is no guessing and no bypass here.",
        { kind: "warn", timeout: 8000 }
      );
      return;
    }

    const host = tool.statusHost;
    const bar = el("div", { class: "progress" }, el("i"));
    host.textContent = "";
    host.append(el("div", { class: "note note-accent" }, [
      el("strong", { class: "note-title", text: "Preparing the decryption engine" }),
      el("p", { text: "About 1.3 MB, downloaded once and kept on this device." }),
      bar
    ]));

    const record = files[0];
    const result = await removePassword(record.blob, {
      password,
      onProgress: ({ fraction }) => {
        bar.querySelector("i").style.width = `${Math.round((fraction || 0) * 100)}%`;
      }
    });
    host.textContent = "";

    const base = record.name.replace(/\.[^.]+$/, "");
    const name = `${base}-unlocked.pdf`;
    await tray.addResult({
      blob: result.blob,
      name,
      fromTool: "Password removed",
      fromFile: record.name
    });

    toast(
      `“${name}” now opens without a password (${formatBytes(result.blob.size)}). ` +
      `It is in the results tray.`,
      { kind: "ok", title: "Unlocked" }
    );
    announce("The password has been removed.");
    $("password").value = "";
  } catch (err) {
    tool.statusHost.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
