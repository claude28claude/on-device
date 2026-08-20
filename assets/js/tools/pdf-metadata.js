/* On Device - PDF metadata */

import { setupPdfTool, toolError } from "../pdf-tool-page.js";
import { readMetadata, writeMetadata } from "../pdf/stamp.js";
import { el, toast, announce, confirmDestructive } from "../ui.js";

const $ = (id) => document.getElementById(id);
const FIELDS = ["title", "author", "subject", "keywords", "creator", "producer"];
let current = null;

async function start() {
  const tool = await setupPdfTool({
    toolId: "pdf-metadata",
    toolLabel: "Metadata edited",
    fileToken: "info",
    singleFile: true,
    onFilesChanged: (files) => load(tool, files[0])
  });

  $("wipe-all").addEventListener("click", () => wipe(tool));
  $("run-button").addEventListener("click", () => run(tool, false));
}

async function load(tool, record) {
  current = null;
  $("extra-host").textContent = "";
  for (const f of FIELDS) $(f).value = "";
  if (!record) return;

  try {
    await tool.ensureEngine();
    const info = await readMetadata(record.blob, { name: record.name });
    current = { record, info };

    for (const f of FIELDS) {
      if (info[f] !== undefined) $(f).value = info[f];
    }

    const rows = el("tbody");
    const add = (label, value) => {
      rows.append(
        el("tr", {}, [
          el("td", { text: label }),
          el("td", { text: value || "— empty —" })
        ])
      );
    };
    add("Title", info.title);
    add("Author", info.author);
    add("Subject", info.subject);
    add("Keywords", info.keywords);
    add("Created with", info.creator);
    add("Produced by", info.producer);
    add("Created", info.creationDate);
    add("Last modified", info.modificationDate);
    add("Pages", String(info.pageCount));

    const anything = FIELDS.some((f) => info[f]);

    $("extra-host").append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: `What “${record.name}” says about itself` }),
        anything
          ? null
          : el("p", {
              class: "muted",
              text: "This document carries no title, author or software details."
            }),
        el("table", { class: "meta-table" }, rows),
        el("p", {
          class: "field-hint",
          text:
            "“Produced by” is often the software that made the file, which can say more " +
            "about you than you expect — the program, and sometimes its version."
        })
      ])
    );
    announce("Document details loaded.");
  } catch (err) {
    toolError(err);
  }
}

async function wipe(tool) {
  const ok = await confirmDestructive({
    title: "Erase every detail",
    body:
      "This clears the title, author, subject, keywords and software fields, and sets " +
      "both dates to a fixed moment so they no longer show when you worked on the " +
      "document. A new file is saved to the results tray; the original is untouched.",
    confirmLabel: "Erase them"
  });
  if (!ok) return;
  await run(tool, true);
}

async function run(tool, wipeAll) {
  const button = $("run-button");
  button.disabled = true;
  try {
    const files = tool.getFiles();
    if (!files.length) {
      toast("Choose a PDF first.", { kind: "warn", timeout: 4000 });
      return;
    }
    await tool.ensureEngine();

    const record = files[0];
    const values = {};
    for (const f of FIELDS) values[f] = $(f).value;

    const doc = await writeMetadata(record.blob, values, {
      name: record.name,
      wipe: wipeAll
    });

    const name = await tool.deliver(doc, record.name);

    if (wipeAll) {
      for (const f of FIELDS) $(f).value = "";
      toast(
        `Every detail erased. “${name}” is in the results tray. ` +
        `Note that a few PDFs keep a second copy of these details in an XMP block, ` +
        `which this does not yet rewrite.`,
        { kind: "ok", title: "Erased", timeout: 12000 }
      );
    } else {
      toast(`Saved as “${name}”.`, { kind: "ok", title: "Done" });
    }
  } catch (err) {
    toolError(err);
  } finally {
    button.disabled = false;
    tool.refresh();
  }
}

start().catch(toolError);
