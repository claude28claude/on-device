/* ============================================================
   On Device - the universal drop zone

   Drag a file anywhere onto any page of this site. We read it
   here, work out what it is, and offer the tools that can handle
   it. There is no upload step because there is nothing to upload
   to.

   There is a tap-based alternative to dragging on every page, so
   this works on a phone as well as a desktop.
   ============================================================ */

import * as workspace from "./workspace.js";
import { toolsForKind } from "./tools.js";
import { el, icon, toast, announce, formatBytes } from "./ui.js";
import { t, tn } from "./i18n.js";

let veil = null;
let dragDepth = 0;
let panelNode = null;
let listNode = null;
let matchNode = null;
let pathPrefix = "";

/* Pages inside tools/ need "../" in front of links back to the root. */
export function setPathPrefix(prefix) {
  pathPrefix = prefix || "";
}

/* ---- The full-window veil ------------------------------- */
function ensureVeil() {
  if (veil) return veil;
  veil = el("div", { class: "drop-veil", dataset: { active: "false" }, "aria-hidden": "true" }, [
    el("div", { class: "veil-card" }, [
      icon("upload", 34),
      el("h2", { text: t("drop.veil.title") }),
      el("p", { text: t("drop.veil.body") })
    ])
  ]);
  document.body.append(veil);
  return veil;
}

function showVeil(on) {
  ensureVeil().dataset.active = String(on);
}

function hasFiles(e) {
  if (!e.dataTransfer) return false;
  const types = e.dataTransfer.types;
  if (!types) return false;
  return Array.prototype.indexOf.call(types, "Files") >= 0;
}

/* ---- Window-wide drag and drop -------------------------- */
export function installWindowDrop(onFiles) {
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    showVeil(true);
  });

  window.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) showVeil(false);
  });

  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    showVeil(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length) onFiles(dropped);
  });

  /* A dropped file outside the window must never navigate the page
     away and lose the visitor's work. */
  window.addEventListener("dragover", (e) => e.preventDefault(), false);
}

/* ---- The visible panel ---------------------------------- */
export function mountPanel(container, { onFiles } = {}) {
  const input = el("input", {
    type: "file",
    multiple: true,
    class: "sr-only",
    id: "dz-input",
    /* Off-screen but still reachable by keyboard and still read out,
       so it needs a name of its own - the visible button beside it is
       a separate element and does not lend it one. */
    "aria-label": t("drop.choose"),
    onchange: (e) => {
      const chosen = e.target.files;
      if (chosen && chosen.length) onFiles(chosen);
      /* Reset so choosing the same file twice still fires. */
      e.target.value = "";
    }
  });

  const chooseBtn = el(
    "button",
    { class: "btn btn-primary", type: "button", onclick: () => input.click() },
    [icon("upload", 17), document.createTextNode(" " + t("drop.choose"))]
  );

  panelNode = el(
    "div",
    { class: "dropzone", dataset: { over: "false" } },
    [
      icon("upload", 30),
      el("h2", { text: t("drop.title") }),
      el("p", { text: t("drop.body") }),
      el("div", { class: "btn-row" }, [chooseBtn]),
      input
    ]
  );

  panelNode.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    panelNode.dataset.over = "true";
  });
  panelNode.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    panelNode.dataset.over = "true";
  });
  panelNode.addEventListener("dragleave", () => {
    panelNode.dataset.over = "false";
  });
  panelNode.addEventListener("drop", () => {
    panelNode.dataset.over = "false";
  });

  listNode = el("div", { class: "mb-4" });
  matchNode = el("div", {});

  container.append(panelNode, listNode, matchNode);
  renderFiles();
  return panelNode;
}

/* ---- Reporting problems honestly ------------------------ */
export function reportProblems(problems) {
  for (const p of problems) {
    const kind = (p.kind === "mismatch" || p.kind === "large" || p.kind === "unknown")
      ? "warn" : "error";
    const title =
      p.kind === "mismatch" ? "The filename does not match the contents"
      : p.kind === "large" ? "This file is large for this device"
      : p.kind === "empty" ? "That file is empty"
      : p.kind === "unknown" ? "We could not identify this file"
      : p.kind === "storage" ? "Could not be saved for later"
      : "That file could not be read";
    toast(p.message, { kind, title, timeout: 12000 });
  }
}

/* ---- Rendering the loaded files ------------------------- */
export function renderFiles() {
  if (!listNode) return;
  const items = workspace.list();

  listNode.textContent = "";
  matchNode.textContent = "";

  if (!items.length) return;

  const head = el("div", { class: "flex-row mb-4" }, [
    el("h2", { class: "mb-0 h-lg", text: tn("drop.added", items.length, { n: items.length }) }),
    el(
      "button",
      {
        class: "btn btn-sm btn-quiet",
        type: "button",
        onclick: async () => {
          await workspace.clearAll();
          renderFiles();
          announce("All loaded files cleared.");
        }
      },
      [icon("trash", 15), document.createTextNode(" " + t("drop.clearAll"))]
    )
  ]);

  const ul = el("ul", { class: "file-list" });
  for (const f of items) {
    ul.append(
      el("li", {}, [
        el("span", { class: "file-thumb", text: (f.format || "?").slice(0, 4) }),
        el("span", { class: "file-main" }, [
          el("span", { class: "file-name", text: f.name }),
          el("span", {
            class: "file-meta",
            text: `${f.label} · ${formatBytes(f.size)}` +
                  (f.width && f.height ? ` · ${f.width} × ${f.height}` : "")
          }),
          f.mismatch
            ? el("span", {
                class: "badge badge-warn",
                text: `named .${f.mismatch.claimed}, actually ${f.mismatch.actual}`
              })
            : null
        ]),
        el(
          "button",
          {
            class: "btn btn-sm btn-quiet",
            type: "button",
            "aria-label": t("file.remove", { name: f.name }),
            onclick: async () => {
              await workspace.removeFile(f.id);
              renderFiles();
            }
          },
          icon("x", 15)
        )
      ])
    );
  }

  listNode.append(head, ul);
  renderMatches(items);
}

function renderMatches(items) {
  const kinds = new Set(items.map((f) => f.kind));
  const matched = new Map();
  for (const kind of kinds) {
    for (const tool of toolsForKind(kind)) matched.set(tool.id, tool);
  }

  const ready = Array.from(matched.values()).filter((x) => x.built);
  const soon = Array.from(matched.values()).filter((x) => !x.built);

  const section = el("div", { class: "panel" });
  section.append(el("h2", { class: "h-lg", text: t("drop.matched.title") }));

  if (!matched.size) {
    section.append(el("p", { class: "muted mb-0", text: t("drop.matched.none") }));
    matchNode.append(section);
    return;
  }

  if (ready.length) {
    const ul = el("ul", { class: "match-list mb-4" });
    for (const tool of ready) {
      ul.append(
        el("li", {}, [
          el("a", { class: "match-btn", href: `${pathPrefix}tools/${tool.id}.html` }, [
            icon(tool.icon, 20),
            el("span", {}, [
              el("span", { class: "m-name", text: t(`tool.${tool.id}.name`) }),
              el("span", { class: "m-desc", text: t(`tool.${tool.id}.desc`) })
            ])
          ])
        ])
      );
    }
    section.append(ul);
  }

  if (soon.length) {
    section.append(
      el("p", { class: "text-sm muted" }, [
        document.createTextNode(
          ready.length
            ? "These would also apply, but are not built yet: "
            : "Tools for this kind of file are planned but not built yet: "
        ),
        document.createTextNode(soon.map((x) => t(`tool.${x.id}.name`)).join(", ") + ".")
      ])
    );
    section.append(
      el("p", { class: "text-sm mb-0" }, [
        el("a", { href: `${pathPrefix}roadmap.html`, text: "See what is built and what is coming" })
      ])
    );
  }

  matchNode.append(section);
}

/* ---- The whole flow ------------------------------------- */
export async function handleFiles(fileList) {
  announce(`Reading ${fileList.length} file${fileList.length === 1 ? "" : "s"}…`);
  let result;
  try {
    result = await workspace.add(fileList);
  } catch (err) {
    console.error("[On Device] Adding files failed:", err);
    toast(
      `Those files could not be read: ${err && err.message ? err.message : err}`,
      { kind: "error", title: "Could not read the files", timeout: 0 }
    );
    return;
  }
  reportProblems(result.problems);
  renderFiles();
  if (result.added.length) {
    announce(tn("drop.added", result.added.length, { n: result.added.length }));
  }
}
