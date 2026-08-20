/* On Device - Text workbench */

import { initPage } from "../app.js";
import * as tray from "../tray.js";
import * as workspace from "../workspace.js";
import { el, icon, toast, announce, copyText } from "../ui.js";

const $ = (id) => document.getElementById(id);
let area = null;
const history = [];

const OPERATIONS = {
  upper: (t) => t.toUpperCase(),
  lower: (t) => t.toLowerCase(),
  title: (t) => t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  sentence: (t) =>
    t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase()),
  trim: (t) => t.split("\n").map((l) => l.trim()).join("\n"),
  collapse: (t) => t.replace(/[ \t]{2,}/g, " "),
  blank: (t) => t.split("\n").filter((l) => l.trim()).join("\n"),
  unwrap: (t) =>
    t.replace(/([^\n])\n(?!\n)([^\n])/g, "$1 $2"),
  sort: (t) => t.split("\n").sort((a, b) => a.localeCompare(b)).join("\n"),
  sortdesc: (t) => t.split("\n").sort((a, b) => b.localeCompare(a)).join("\n"),
  dedupe: (t) => {
    const seen = new Set();
    return t.split("\n").filter((l) => {
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    }).join("\n");
  },
  reverse: (t) => t.split("\n").reverse().join("\n"),
  shuffle: (t) => {
    const lines = t.split("\n");
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    return lines.join("\n");
  },
  number: (t) => t.split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n")
};

async function start() {
  await initPage({ pathPrefix: "../" });

  area = el("textarea", {
    id: "text-area",
    rows: "20",
    spellcheck: "false",
    "aria-label": "Your text",
    placeholder: "Type or paste text here, or drop a text file onto the page."
  });
  area.addEventListener("input", paintStats);

  const input = el("input", {
    type: "file",
    class: "sr-only",
    accept: ".txt,.md,.csv,.json,.log,text/*",
    id: "text-input",
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) await load(f);
    }
  });

  $("files-host").textContent = "";
  $("files-host").append(
    el("div", { class: "panel" }, [
      el("div", { class: "flex-row mb-4" }, [
        el("h2", { class: "h-lg mb-0", text: "Your text" }),
        el("button", { class: "btn btn-sm", type: "button", onclick: () => input.click() },
          [icon("upload", 15), document.createTextNode(" Open a text file")]),
        el("button", {
          class: "btn btn-sm",
          type: "button",
          onclick: async () => {
            const ok = await copyText(area.value);
            toast(ok ? "Copied." : "Your browser would not let us copy.", {
              kind: ok ? "ok" : "warn",
              timeout: 3000
            });
          }
        }, "Copy all")
      ]),
      area,
      el("p", { class: "field-hint", id: "stats" }),
      input
    ])
  );

  for (const btn of document.querySelectorAll("[data-op]")) {
    btn.addEventListener("click", () => apply(btn.dataset.op, btn.textContent.trim()));
  }
  $("do-replace").addEventListener("click", replace);
  $("undo").addEventListener("click", undo);
  $("clear").addEventListener("click", () => {
    remember();
    area.value = "";
    paintStats();
  });
  $("run-button").addEventListener("click", save);
  $("run-button").disabled = false;

  window.addEventListener("drop", async (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await load(f);
  }, true);

  paintStats();

  async function load(file) {
    const { added, problems } = await workspace.add([file]);
    for (const p of problems) {
      toast(p.message, { kind: "warn", title: "About that file", timeout: 8000 });
    }
    const record = added[0];
    if (!record) return;
    if (record.size > 20 * 1024 * 1024) {
      toast(
        `“${record.name}” is ${Math.round(record.size / 1048576)} MB. Very large text in a ` +
        `box makes a browser sluggish. Opening it anyway — expect it to be slow.`,
        { kind: "warn", timeout: 10000 }
      );
    }
    remember();
    area.value = await record.blob.text();
    paintStats();
    announce(`${record.name} opened.`);
  }
}

function remember() {
  history.push(area.value);
  if (history.length > 40) history.shift();
}

function apply(op, label) {
  const fn = OPERATIONS[op];
  if (!fn) return;
  remember();
  area.value = fn(area.value);
  paintStats();
  announce(`${label} applied.`);
}

function replace() {
  const find = $("find").value;
  if (!find) {
    toast("Type what to find first.", { kind: "warn", timeout: 4000 });
    return;
  }
  remember();
  try {
    if ($("regex").checked) {
      const re = new RegExp(find, "g");
      const before = area.value;
      area.value = before.replace(re, $("replace").value);
      const count = (before.match(re) || []).length;
      toast(`${count} replacement${count === 1 ? "" : "s"} made.`, { kind: "ok", timeout: 4000 });
    } else {
      const parts = area.value.split(find);
      area.value = parts.join($("replace").value);
      toast(`${parts.length - 1} replacement${parts.length - 1 === 1 ? "" : "s"} made.`, {
        kind: "ok",
        timeout: 4000
      });
    }
  } catch (err) {
    history.pop();
    toast(
      `That search pattern is not valid: ${err && err.message ? err.message : err}. ` +
      `Switch off "treat the search as a pattern" to search for it literally.`,
      { kind: "error", timeout: 10000 }
    );
    return;
  }
  paintStats();
}

function undo() {
  if (!history.length) {
    toast("Nothing to undo.", { kind: "warn", timeout: 3000 });
    return;
  }
  area.value = history.pop();
  paintStats();
  announce("Undone.");
}

function paintStats() {
  const text = area.value;
  const lines = text ? text.split("\n").length : 0;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characters = text.length;
  const noSpaces = text.replace(/\s/g, "").length;
  const unique = new Set(text.split("\n")).size;
  const node = $("stats");
  if (node) {
    node.textContent =
      `${lines.toLocaleString()} lines (${unique.toLocaleString()} different) · ` +
      `${words.toLocaleString()} words · ${characters.toLocaleString()} characters ` +
      `(${noSpaces.toLocaleString()} without spaces)`;
  }
  const button = $("run-button");
  if (button) button.disabled = !text.length;
}

async function save() {
  if (!area.value) return;
  const blob = new Blob([area.value], { type: "text/plain;charset=utf-8" });
  await tray.addResult({ blob, name: "text.txt", fromTool: "Text workbench" });
  toast("Saved to the results tray.", { kind: "ok", title: "Done" });
}

start().catch((err) => console.error("[On Device] The text workbench failed to start:", err));
