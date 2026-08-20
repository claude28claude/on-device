/* On Device - Password-protect a PDF */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { addPassword } from "../pdf/password.js";
import { el, toast, announce, formatBytes } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);

/* A rough, honest strength read. Not a score out of ten - just the
   things that actually matter, said plainly. */
function judge(password) {
  if (!password) return { text: "Nothing typed yet.", ok: false };

  const length = password.length;
  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 1 : 0);

  if (length < 8) {
    return {
      text: `${length} characters. Short enough that a determined person with the ` +
            `file could work through every possibility. Twelve or more is much better.`,
      ok: false
    };
  }
  if (length >= 16 || (length >= 12 && variety >= 3)) {
    return { text: `${length} characters, ${variety} kinds. Strong.`, ok: true };
  }
  return {
    text: `${length} characters, ${variety} kind${variety === 1 ? "" : "s"} of character. ` +
          `Reasonable. Longer is better than more complicated.`,
    ok: true
  };
}

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-password-add",
    toolLabel: "Password added",
    fileToken: "protected",
    singleFile: true
  });

  $("password").addEventListener("input", () => {
    const verdict = judge($("password").value);
    $("strength-hint").textContent = verdict.text;
    checkMatch();
  });
  $("confirm").addEventListener("input", checkMatch);

  $("show-password").addEventListener("change", () => {
    const type = $("show-password").checked ? "text" : "password";
    $("password").type = type;
    $("confirm").type = type;
  });

  $("run-button").addEventListener("click", () => run(tool));

  function checkMatch() {
    const a = $("password").value;
    const b = $("confirm").value;
    if (!b) {
      $("match-hint").textContent = "";
      return;
    }
    $("match-hint").textContent = a === b ? "They match." : "These do not match yet.";
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
    const confirm = $("confirm").value;

    if (!password) {
      toast("Enter a password. An empty password protects nothing.", { kind: "warn", timeout: 6000 });
      return;
    }
    if (password !== confirm) {
      toast("The two passwords do not match. Check them and try again.", { kind: "error", timeout: 7000 });
      return;
    }

    const host = tool.statusHost;
    const bar = el("div", { class: "progress" }, el("i"));
    host.textContent = "";
    host.append(el("div", { class: "note note-accent" }, [
      el("strong", { class: "note-title", text: "Preparing the encryption engine" }),
      el("p", { text: "About 1.3 MB, downloaded once and kept on this device." }),
      bar
    ]));

    const record = files[0];
    const result = await addPassword(record.blob, {
      userPassword: password,
      allowPrinting: $("allow-printing").checked,
      allowCopying: $("allow-copying").checked,
      onProgress: ({ fraction }) => {
        bar.querySelector("i").style.width = `${Math.round((fraction || 0) * 100)}%`;
      }
    });
    host.textContent = "";

    const base = record.name.replace(/\.[^.]+$/, "");
    const name = `${base}-protected.pdf`;
    await tray.addResult({
      blob: result.blob,
      name,
      fromTool: "Password added",
      fromFile: record.name
    });

    toast(
      `“${name}” is locked and waiting in the results tray (${formatBytes(result.blob.size)}). ` +
      `Keep the password somewhere safe — it cannot be recovered.`,
      { kind: "ok", title: "Protected", timeout: 14000 }
    );
    announce("The document is now password-protected.");

    $("password").value = "";
    $("confirm").value = "";
    $("strength-hint").textContent = "Nothing typed yet.";
    $("match-hint").textContent = "";
  } catch (err) {
    tool.statusHost.textContent = "";
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
