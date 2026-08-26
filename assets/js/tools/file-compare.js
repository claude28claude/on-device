/* On Device - Compare two files */

import { initPage } from "../app.js";
import * as workspace from "../workspace.js";
import { compareFiles } from "../hash.js";
import { el, icon, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);
let chosen = [];

async function start() {
  await initPage({ pathPrefix: "../" });

  const input = el("input", {
    type: "file",
    multiple: true,
    class: "sr-only",
    id: "cmp-input",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. */
    "aria-label": "Choose the two files to compare",
    onchange: async (e) => {
      const f = e.target.files;
      e.target.value = "";
      if (f && f.length) await accept(f);
    }
  });
  render(input);

  $("run-button").addEventListener("click", run);
  window.addEventListener("drop", async (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      await accept(e.dataTransfer.files);
    }
  }, true);

  async function accept(list) {
    const { added, problems } = await workspace.add(list);
    for (const p of problems) {
      if (p.kind === "unknown") continue;
      toast(p.message, { kind: "warn", title: "About that file", timeout: 8000 });
    }
    chosen = chosen.concat(added).slice(-2);
    render(input);
    update();
  }

  function render(fileInput) {
    const host = $("files-host");
    host.textContent = "";
    host.append(
      el("div", { class: "dropzone" }, [
        icon("compare", 26),
        el("h2", { class: "h-lg", text: "Choose two files" }),
        el("p", {
          text: chosen.length === 2
            ? "Two chosen. Press Compare."
            : `${chosen.length} of 2 chosen.`
        }),
        el("div", { class: "btn-row" }, [
          el(
            "button",
            { class: "btn btn-primary", type: "button", onclick: () => fileInput.click() },
            [icon("upload", 17), document.createTextNode(" Choose files")]
          ),
          chosen.length
            ? el(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onclick: () => {
                    chosen = [];
                    render(fileInput);
                    update();
                    $("extra-host").textContent = "";
                  }
                },
                "Clear"
              )
            : null
        ]),
        fileInput
      ])
    );

    $("compare-readout").textContent = chosen.length
      ? chosen.map((c) => `${c.name} (${formatBytes(c.size)})`).join("   vs   ")
      : "No files chosen yet.";
  }

  function update() {
    $("run-button").disabled = chosen.length !== 2;
  }
  window.__updateCompare = update;
  update();
}

async function run() {
  const button = $("run-button");
  button.disabled = true;
  const host = $("extra-host");
  const bar = el("div", { class: "progress" }, el("i"));
  host.textContent = "";
  host.append(
    el("div", { class: "panel" }, [el("p", { class: "muted", text: "Comparing…" }), bar])
  );

  try {
    const [a, b] = chosen;
    const result = await compareFiles(a.blob, b.blob, (f) => {
      bar.querySelector("i").style.width = `${Math.round(f * 100)}%`;
    });

    host.textContent = "";
    host.append(
      el("div", { class: result.identical ? "note note-ok" : "note note-warn" }, [
        el("strong", {
          class: "note-title",
          text: result.identical ? "Identical" : "Not identical"
        }),
        el("p", { text: result.message }),
        el("p", { class: "mb-0 text-sm muted", text: `${a.name}   vs   ${b.name}` })
      ])
    );
    announce(result.identical ? "The files are identical." : "The files differ.");
  } catch (err) {
    host.textContent = "";
    host.append(
      el("div", { class: "note note-danger" },
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) }))
    );
  } finally {
    if (window.__updateCompare) window.__updateCompare();
  }
}

start().catch((err) => console.error("[On Device] The compare tool failed to start:", err));
