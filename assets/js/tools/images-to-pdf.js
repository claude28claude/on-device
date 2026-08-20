/* On Device - Images to PDF */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { imagesToPdf } from "../pdf/edit.js";
import { el, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);
let order = [];

async function start() {
  const tool = await setupPdfTool({
    toolId: "images-to-pdf",
    toolLabel: "Images to PDF",
    fileToken: "document",
    accepts: "pdf+images",
    onFilesChanged: (files) => {
      order = files.filter((f) => f.kind === "image" || f.kind === "heic");
      const rejected = files.length - order.length;
      if (rejected > 0) {
        toast(
          `${rejected} file${rejected === 1 ? " is" : "s are"} not pictures and will be ignored.`,
          { kind: "warn", timeout: 7000 }
        );
      }
      renderOrder();
    }
  });

  $("page-size").addEventListener("change", () => {
    $("orientation-field").hidden = $("page-size").value === "match";
  });
  $("run-button").addEventListener("click", () => run(tool));

  function renderOrder() {
    const host = $("extra-host");
    host.textContent = "";
    if (!order.length) return;

    const unsupported = order.filter((r) => r.format !== "jpg" && r.format !== "png");
    if (unsupported.length) {
      const kinds = [...new Set(unsupported.map((u) => String(u.format).toUpperCase()))].join(", ");
      host.append(
        el("div", { class: "note note-warn" }, [
          el("strong", {
            class: "note-title",
            text:
              `${unsupported.length} picture${unsupported.length === 1 ? "" : "s"} ` +
              `cannot go straight into a PDF`
          }),
          el("p", {
            class: "mb-0",
            text:
              `A PDF carries only JPEG and PNG directly. These are ${kinds}: ` +
              unsupported.map((u) => u.name).join(", ") +
              `. Convert them first, which the Convert tool does on this device, then come back.`
          })
        ])
      );
    }

    const list = el("ul", { class: "file-list" });
    order.forEach((record, index) => {
      list.append(
        el("li", {}, [
          el("span", { class: "file-thumb", text: String(index + 1) }),
          el("span", { class: "file-main" }, [
            el("span", { class: "file-name", text: record.name }),
            el("span", {
              class: "file-meta",
              text:
                `${record.label} · ${formatBytes(record.size)}` +
                (record.width ? ` · ${record.width} × ${record.height}` : "")
            })
          ]),
          el(
            "button",
            {
              class: "btn btn-sm btn-quiet",
              type: "button",
              disabled: index === 0,
              "aria-label": `Move ${record.name} up`,
              onclick: () => move(index, -1)
            },
            "↑"
          ),
          el(
            "button",
            {
              class: "btn btn-sm btn-quiet",
              type: "button",
              disabled: index === order.length - 1,
              "aria-label": `Move ${record.name} down`,
              onclick: () => move(index, 1)
            },
            "↓"
          )
        ])
      );
    });

    host.append(
      el("div", { class: "panel" }, [
        el("h2", {
          class: "h-lg",
          text: `${order.length} picture${order.length === 1 ? "" : "s"}, one per page`
        }),
        list
      ])
    );
  }

  function move(index, by) {
    const target = index + by;
    if (target < 0 || target >= order.length) return;
    const [item] = order.splice(index, 1);
    order.splice(target, 0, item);
    renderOrder();
    announce(`${item.name} moved to position ${target + 1}.`);
  }
}

async function run(tool) {
  const button = $("run-button");
  button.disabled = true;
  try {
    await tool.ensureEngine();
    const usable = order.filter((r) => r.format === "jpg" || r.format === "png");
    if (!usable.length) {
      toast(
        "None of these pictures can go into a PDF directly. Convert them to JPEG or PNG first.",
        { kind: "error", timeout: 10000 }
      );
      return;
    }

    const { doc, notes } = await imagesToPdf(
      usable.map((r) => ({ file: r.blob, name: r.name, format: r.format })),
      {
        imagePageSize: $("page-size").value,
        imageOrientation: $("orientation").value,
        imageMargin: Number($("margin").value) || 0
      }
    );

    const name = await tool.deliver(doc, usable[0].name);
    toast(`Made a ${doc.getPageCount()}-page PDF, “${name}”.`, { kind: "ok", title: "Done" });
    for (const n of notes) toast(n, { kind: "warn", timeout: 9000 });
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
