/* On Device - Markdown preview

   The preview is cleaned by DOMPurify before anything is shown, so
   markdown containing a <script> tag or an onclick attribute cannot
   run anything. That matters because the markdown may have come
   from somewhere the visitor does not control. */

import { initPage } from "../app.js";
import * as tray from "../tray.js";
import * as workspace from "../workspace.js";
import { el, icon, toast, announce, copyText } from "../ui.js";

const $ = (id) => document.getElementById(id);
let area = null;
let preview = null;
let marked = null;
let purify = null;

const STARTER = `# A heading

Write **markdown** on the left and it appears on the right as you type.

## What works

- Lists like this one
- **Bold**, *italic*, \`code\`
- [Links](#) and lists

> Quotes look like this.

\`\`\`
Code blocks look like this.
\`\`\`

| A table | Second column |
|---------|---------------|
| works   | like this     |
`;

async function loadEngine() {
  if (marked && purify) return;
  const [m, d] = await Promise.all([
    import("../../vendor/marked/marked.esm.js"),
    import("../../vendor/dompurify/purify.es.mjs")
  ]);
  marked = m.marked || m.default;
  purify = d.default || d;
}

async function start() {
  await initPage({ pathPrefix: "../", handlesOwnDrops: true });

  area = el("textarea", {
    id: "md-input",
    rows: "24",
    spellcheck: "false",
    "aria-label": "Markdown source",
    placeholder: "Write markdown here…"
  });
  area.value = STARTER;
  area.addEventListener("input", render);

  preview = el("div", { class: "md-preview", id: "md-preview", "aria-live": "off" });

  const input = el("input", {
    type: "file",
    class: "sr-only",
    accept: ".md,.markdown,.txt,text/*",
    id: "md-file",
    /* Off-screen but reachable by keyboard and read out, so it
       needs a name of its own. */
    "aria-label": "Choose a markdown file",
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) await load(f);
    }
  });

  $("files-host").textContent = "";
  $("files-host").append(
    el("div", { class: "flex-row mb-4" }, [
      el("button", { class: "btn btn-sm", type: "button", onclick: () => input.click() },
        [icon("upload", 15), document.createTextNode(" Open a markdown file")]),
      input
    ])
  );

  $("extra-host").textContent = "";
  $("extra-host").append(
    el("div", { class: "md-split", id: "md-split" }, [
      el("div", { class: "md-pane" }, [
        el("span", { class: "mark-page-label", text: "Markdown" }),
        area
      ]),
      el("div", { class: "md-pane" }, [
        el("span", { class: "mark-page-label", text: "Preview" }),
        preview
      ])
    ])
  );

  for (const btn of $("view-mode").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      for (const other of $("view-mode").querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      $("md-split").dataset.view = btn.dataset.view;
    });
  }

  $("copy-html").addEventListener("click", async () => {
    const ok = await copyText(preview.innerHTML);
    toast(ok ? "The HTML has been copied." : "Your browser would not let us copy.", {
      kind: ok ? "ok" : "warn",
      timeout: 4000
    });
  });

  $("print-preview").addEventListener("click", () => {
    document.body.dataset.printing = "preview";
    window.print();
    window.setTimeout(() => delete document.body.dataset.printing, 500);
  });

  $("run-button").addEventListener("click", exportPage);
  $("run-button").disabled = false;

  window.addEventListener("drop", async (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await load(f);
  }, true);

  await render();

  async function load(file) {
    const { added, problems } = await workspace.add([file]);
    for (const p of problems) toast(p.message, { kind: "warn", timeout: 8000 });
    if (!added[0]) return;
    area.value = await added[0].blob.text();
    await render();
    announce(`${added[0].name} opened.`);
  }
}

async function render() {
  try {
    await loadEngine();
  } catch (err) {
    preview.textContent = "";
    preview.append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "The markdown engine did not load" }),
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
      ])
    );
    return;
  }

  const source = area.value;
  let html;
  try {
    html = marked.parse(source, { breaks: false, gfm: true });
  } catch (err) {
    preview.textContent = `That markdown could not be read: ${err && err.message ? err.message : err}`;
    return;
  }

  /* Cleaned before it is shown. Nothing in the markdown can run. */
  preview.innerHTML = purify.sanitize(html, { USE_PROFILES: { html: true } });

  const words = source.trim() ? source.trim().split(/\s+/).length : 0;
  $("md-stats").textContent =
    `${source.length.toLocaleString()} characters · ${words.toLocaleString()} words · ` +
    `${source.split("\n").length.toLocaleString()} lines`;
}

async function exportPage() {
  await loadEngine();
  const body = purify.sanitize(marked.parse(area.value, { gfm: true }), {
    USE_PROFILES: { html: true }
  });

  /* A self-contained page: the styles are written in, so it looks the
     same anywhere and needs nothing from us. */
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Document</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         line-height: 1.65; max-width: 44rem; margin: 3rem auto; padding: 0 1.25rem;
         color: #1a1a1a; background: #fff; }
  h1, h2, h3 { line-height: 1.25; margin-top: 2rem; }
  code { background: #f2f2f2; padding: 0.1em 0.35em; border-radius: 3px;
         font-family: ui-monospace, Consolas, monospace; font-size: 0.92em; }
  pre { background: #f6f6f6; padding: 1rem; overflow-x: auto; border-radius: 6px; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1rem; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; }
  img { max-width: 100%; height: auto; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
${body}
</body>
</html>
`;

  const blob = new Blob([page], { type: "text/html;charset=utf-8" });
  await tray.addResult({ blob, name: "document.html", fromTool: "Markdown" });
  toast(
    "Exported as a self-contained web page. Open it and use your browser's Print " +
    "to save it as a PDF.",
    { kind: "ok", title: "Done", timeout: 9000 }
  );
}

start().catch((err) => console.error("[On Device] The markdown tool failed to start:", err));
