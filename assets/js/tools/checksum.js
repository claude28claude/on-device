/* On Device - Checksum a file */

import { initPage } from "../app.js";
import * as workspace from "../workspace.js";
import { hashFile, ALGORITHMS } from "../hash.js";
import { el, icon, toast, announce, copyText, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);
let chosen = [];

async function start() {
  await initPage({ pathPrefix: "../" });

  const input = el("input", {
    type: "file",
    multiple: true,
    class: "sr-only",
    id: "cs-input",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. */
    "aria-label": "Choose files to fingerprint",
    onchange: async (e) => {
      const f = e.target.files;
      e.target.value = "";
      if (f && f.length) await accept(f);
    }
  });
  renderChooser(input);

  $("algorithm").addEventListener("change", paintNote);
  $("run-button").addEventListener("click", run);
  window.addEventListener("drop", async (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      await accept(e.dataTransfer.files);
    }
  }, true);

  paintNote();
  update();

  async function accept(list) {
    const { added, problems } = await workspace.add(list);
    for (const p of problems) {
      if (p.kind === "unknown") continue;
      toast(p.message, {
        kind: p.kind === "empty" ? "error" : "warn",
        title: "About that file",
        timeout: 9000
      });
    }
    if (added.length) {
      chosen = added;
      renderChooser(input);
      update();
    }
  }

  function renderChooser(fileInput) {
    const host = $("files-host");
    host.textContent = "";
    host.append(
      el("div", { class: "dropzone" }, [
        icon("fingerprint", 26),
        el("h2", { class: "h-lg", text: chosen.length ? "Add more files" : "Choose any files" }),
        el("p", {
          text: chosen.length
            ? `${chosen.length} selected.`
            : "Any kind of file. They stay on this device."
        }),
        el("div", { class: "btn-row" }, [
          el(
            "button",
            { class: "btn btn-primary", type: "button", onclick: () => fileInput.click() },
            [icon("upload", 17), document.createTextNode(" Choose files")]
          )
        ]),
        fileInput
      ])
    );
  }

  function update() {
    const b = $("run-button");
    b.disabled = !chosen.length;
    b.textContent = chosen.length
      ? `Work out ${chosen.length} checksum${chosen.length === 1 ? "" : "s"}`
      : "Work out the checksum";
  }
  window.__updateChecksum = update;

  function paintNote() {
    const info = ALGORITHMS[$("algorithm").value];
    $("algorithm-note").textContent = info ? info.note : "";
  }
}

async function run() {
  const button = $("run-button");
  button.disabled = true;
  const host = $("queue-host");
  host.textContent = "";
  const algorithm = $("algorithm").value;
  const expected = $("expected").value.trim().toLowerCase();

  const list = el("ul", { class: "file-list" });
  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: `${algorithm} fingerprints` }),
      list
    ])
  );

  try {
    for (const record of chosen) {
      const bar = el("div", { class: "progress" }, el("i"));
      const value = el("span", { class: "file-meta mono", text: "Working…" });
      const row = el("li", {}, [
        el("span", { class: "file-thumb", text: (record.format || "?").slice(0, 4) }),
        el("span", { class: "file-main" }, [
          el("span", { class: "file-name", text: `${record.name} · ${formatBytes(record.size)}` }),
          value,
          bar
        ]),
        el(
          "button",
          {
            class: "btn btn-sm",
            type: "button",
            onclick: async () => {
              const ok = await copyText(value.textContent);
              toast(ok ? "Copied." : "Your browser would not let us copy.", {
                kind: ok ? "ok" : "warn",
                timeout: 3000
              });
            }
          },
          "Copy"
        )
      ]);
      list.append(row);

      try {
        const digest = await hashFile(record.blob, algorithm, (f) => {
          bar.querySelector("i").style.width = `${Math.round(f * 100)}%`;
        });
        value.textContent = digest;
        bar.remove();

        if (expected) {
          const matches = digest === expected;
          row.dataset.state = matches ? "done" : "error";
          row.querySelector(".file-main").append(
            el("span", {
              class: matches ? "file-meta" : "q-error",
              text: matches
                ? "Matches the value you pasted. The file is exactly what was published."
                : "Does NOT match the value you pasted. The file differs from what was " +
                  "published — it may be corrupted, a different version, or tampered with."
            })
          );
          announce(matches ? "Checksum matches." : "Checksum does not match.", !matches);
        } else {
          row.dataset.state = "done";
        }
      } catch (err) {
        value.textContent = "";
        bar.remove();
        row.dataset.state = "error";
        row.querySelector(".file-main").append(
          el("span", { class: "q-error", text: err && err.message ? err.message : String(err) })
        );
      }
    }
  } finally {
    button.disabled = false;
    if (window.__updateChecksum) window.__updateChecksum();
  }
}

start().catch((err) => {
  console.error("[On Device] The checksum tool failed to start:", err);
});
