/* On Device - Merge PDFs */

import { setupPdfTool, toolError, describeWithPassword } from "../pdf-tool-page.js";
import { merge } from "../pdf/edit.js";
import { el, icon, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);

let order = [];

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-merge",
    toolLabel: "Merged",
    fileToken: "merged",
    accepts: "pdf+images",
    onFilesChanged: (files) => {
      order = files.slice();
      renderOrder();
    }
  });

  $("run-button").addEventListener("click", () => run(tool));

  function renderOrder() {
    const host = $("extra-host");
    host.textContent = "";
    if (!order.length) return;

    const list = el("ul", { class: "file-list" });
    order.forEach((record, index) => {
      list.append(
        el("li", {}, [
          el("span", { class: "file-thumb", text: String(index + 1) }),
          el("span", { class: "file-main" }, [
            el("span", { class: "file-name", text: record.name }),
            el("span", {
              class: "file-meta",
              text: `${record.label} · ${formatBytes(record.size)}` +
                (record.pageCount ? ` · ${record.pageCount} pages` : "")
            })
          ]),
          el("button", {
            class: "btn btn-sm btn-quiet",
            type: "button",
            "aria-label": `Move ${record.name} up`,
            disabled: index === 0,
            onclick: () => move(index, -1)
          }, "↑"),
          el("button", {
            class: "btn btn-sm btn-quiet",
            type: "button",
            "aria-label": `Move ${record.name} down`,
            disabled: index === order.length - 1,
            onclick: () => move(index, 1)
          }, "↓"),
          el("button", {
            class: "btn btn-sm btn-quiet",
            type: "button",
            "aria-label": `Remove ${record.name}`,
            onclick: () => {
              order.splice(index, 1);
              tool.setFiles(order.slice());
              renderOrder();
            }
          }, icon("x", 15))
        ])
      );
    });

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "The order they will be joined" }),
        list,
        el("p", {
          class: "field-hint",
          text: "The finished document follows this order from top to bottom."
        })
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

    if (order.length < 2) {
      toast("Choose at least two files to merge.", { kind: "warn", timeout: 5000 });
      return;
    }

    /* Anything that needs a password has to be dealt with before we start,
       so the visitor is not interrupted halfway through. */
    const sources = [];
    for (const record of order) {
      if (record.kind === "pdf") {
        const opened = await describeWithPassword(record);
        if (!opened) {
          toast(`Skipped “${record.name}” — no password given.`, { kind: "warn", timeout: 6000 });
          continue;
        }
        sources.push({
          kind: "pdf",
          file: record.blob,
          name: record.name,
          password: opened.password
        });
      } else {
        sources.push({
          kind: "image",
          file: record.blob,
          name: record.name,
          format: record.format
        });
      }
    }

    if (sources.length < 2) {
      toast("Fewer than two files could be opened, so there is nothing to merge.", {
        kind: "error",
        timeout: 9000
      });
      return;
    }

    const { doc, notes } = await merge(sources, {
      imagePageSize: $("image-size").value,
      imageMargin: Number($("image-margin").value) || 0
    });

    const name = await tool.deliver(doc, order[0].name);
    const pages = doc.getPageCount();
    toast(
      `Merged ${sources.length} files into ${pages} pages. “${name}” is in the results tray.`,
      { kind: "ok", title: "Done" }
    );
    for (const note of notes) toast(note, { kind: "warn", timeout: 9000 });
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
