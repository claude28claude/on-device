/* On Device - Icon and favicon maker */

import { setupImageTool } from "../tool-page.js";
import { toCanvas, makeIcons, manifestSnippet, faviconHtml } from "../image/compose.js";
import { releaseCanvas } from "../image/ops.js";
import { el, toast, copyText, formatBytes, announce } from "../ui.js";
import * as tray from "../tray.js";

const $ = (id) => document.getElementById(id);
let urls = [];

async function start() {
  const tool = await setupImageTool({
    toolId: "icon-generator",
    toolLabel: "Icon",
    fileToken: "icon",
    singleFile: true,
    onFilesChanged: (files) => check(files[0]),
    buildJob: async () => ({ op: "noop" }),
    ownRun: true
  });

  $("transparent").addEventListener("change", () => {
    $("background").disabled = $("transparent").checked;
  });
  $("background").disabled = $("transparent").checked;
  $("run-button").addEventListener("click", () => run(tool));
}

function check(record) {
  const host = $("extra-host");
  clearUrls();
  host.textContent = "";
  if (!record) return;

  const notes = [];
  if (record.width && record.height) {
    if (record.width !== record.height) {
      notes.push(
        `This picture is ${record.width} by ${record.height}, which is not square. ` +
        `Icons are square, so it will be fitted inside with space around it. Crop it ` +
        `square first for a better result.`
      );
    }
    if (Math.min(record.width, record.height) < 512) {
      notes.push(
        `It is ${Math.min(record.width, record.height)} pixels on its shortest side. ` +
        `The largest icon needed is 512, so this will be enlarged and look soft. ` +
        `Start from something at least 512 square.`
      );
    }
  }

  if (notes.length) {
    host.append(
      el("div", { class: "note note-warn" }, [
        el("strong", { class: "note-title", text: "Worth knowing before you start" }),
        ...notes.map((n) => el("p", { class: "mb-0", text: n }))
      ])
    );
  }
}

function clearUrls() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
}

async function run(tool) {
  const button = $("run-button");
  const files = tool.getFiles();
  button.disabled = true;

  try {
    if (!files.length) {
      toast("Choose a picture first.", { kind: "warn", timeout: 4000 });
      return;
    }
    const record = files[0];
    const canvas = await toCanvas(record.blob, record.format);
    const background = $("transparent").checked ? null : $("background").value;

    const icons = await makeIcons(canvas, { background });
    let maskable = [];
    if ($("maskable").checked) {
      maskable = (await makeIcons(canvas, { background: background || "#ffffff", maskable: true }))
        .filter((i) => i.size >= 192)
        .map((i) => ({ ...i, name: `icon-maskable-${i.size}.png`, note: "Maskable, for Android" }));
    }
    releaseCanvas(canvas);

    const all = icons.concat(maskable);
    for (const icon of all) {
      await tray.addResult({ blob: icon.blob, name: icon.name, fromTool: "Icon", fromFile: record.name });
    }

    clearUrls();
    const host = $("extra-host");
    host.textContent = "";

    const grid = el("div", { class: "page-grid" });
    for (const icon of all) {
      const url = URL.createObjectURL(icon.blob);
      urls.push(url);
      grid.append(
        el("div", { class: "page-card" }, [
          el("img", { src: url, alt: `${icon.size} pixel icon`, width: String(Math.min(icon.size, 96)) }),
          el("span", { class: "page-number", text: `${icon.size}px · ${formatBytes(icon.blob.size)}` }),
          el("span", { class: "field-hint", text: icon.note })
        ])
      );
    }

    const snippet = `${faviconHtml()}\n\nIn your manifest:\n  ${manifestSnippet()}`;

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `${all.length} icons made, all in the results tray` }),
        grid,
        el("h3", { text: "The code to reference them" }),
        el("pre", {}, el("code", { text: snippet })),
        el("div", { class: "btn-row" }, [
          el("button", {
            class: "btn btn-sm",
            type: "button",
            onclick: async () => {
              const ok = await copyText(snippet);
              toast(ok ? "Copied." : "Your browser would not let us copy.", {
                kind: ok ? "ok" : "warn", timeout: 3000
              });
            }
          }, "Copy the code")
        ])
      ])
    );

    toast(`${all.length} icons made and waiting in the results tray.`, { kind: "ok", title: "Done" });
    announce(`${all.length} icons made.`);
  } catch (err) {
    toast(err && err.message ? err.message : String(err), { kind: "error", timeout: 0 });
  } finally {
    button.disabled = false;
    tool.refreshRunButton();
  }
}

window.addEventListener("pagehide", clearUrls);
start().catch((err) => console.error("[On Device] The icon tool failed to start:", err));
