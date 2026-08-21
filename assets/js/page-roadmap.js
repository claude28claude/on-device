/* On Device - the "what is built" page.
   Everything here is generated from the same tool list the rest of
   the site uses, so this page cannot quietly go out of date. */

import { initPage } from "./app.js";
import { TOOLS, CATEGORIES } from "./tools.js";
import { el, icon } from "./ui.js";
import { t } from "./i18n.js";

const PHASES = [
  { n: 0,  title: "Plan",                 covers: "The plan, the name, the honest warnings.",                      state: "done" },
  { n: 1,  title: "The shell",            covers: "Homepage, drop zone, results tray, settings, offline, trust page.", state: "done" },
  { n: 2,  title: "Images core",          covers: "Resize, convert, compress, crop, rotate, metadata view and strip.", state: "done" },
  { n: 3,  title: "PDF core",             covers: "Merge, split, organise, images to PDF, PDF to images, rotate and crop.", state: "done" },
  { n: 4,  title: "PDF advanced",         covers: "Compress, watermark, page numbers, metadata, passwords, flatten, booklets.", state: "done" },
  { n: 5,  title: "Privacy specials",     covers: "True redaction, blur and pixelate, fill and sign, lock a file.", state: "done" },
  { n: 6,  title: "Text, data, utilities", covers: "QR codes, text workbench, spreadsheets, markdown, zip, checksum, compare.", state: "done" },
  { n: 7,  title: "Extraction",           covers: "PDF text extraction and offline text recognition.", state: "done" },
  { n: 8,  title: "Recipes",              covers: "Saved chains of steps, batch pipelines, rebindable shortcuts, import and export.", state: "done" },
  { n: 9,  title: "Customisation",        covers: "Every theme and default, renaming, reordering and hiding tools, the sidebar, the second language.", state: "done" },
  { n: 10, title: "Hardening",            covers: "Accessibility checks, the phone pass, error messages, background-tab rendering, help content.", state: "done" },
  { n: 11, title: "Optional extras",      covers: "Video and audio, background removal - only if everything else is perfect." }
];

function renderStats() {
  const host = document.getElementById("roadmap-stats");
  if (!host) return;
  const built = TOOLS.filter((x) => x.built).length;
  host.append(
    el("div", { class: "stat" }, [
      el("span", { class: "stat-value", text: String(built) }),
      el("span", { class: "stat-label", text: "tools built and tested" })
    ]),
    el("div", { class: "stat" }, [
      el("span", { class: "stat-value", text: String(TOOLS.length - built) }),
      el("span", { class: "stat-label", text: "tools still to build" })
    ]),
    el("div", { class: "stat", dataset: { tone: "ok" } }, [
      el("span", {
        class: "stat-value",
        text: `${PHASES.filter((p) => p.state === "done").length} of ${PHASES.length}`
      }),
      el("span", { class: "stat-label", text: "phases finished" })
    ])
  );
}

function renderPhases() {
  const host = document.getElementById("phase-table");
  if (!host) return;
  for (const phase of PHASES) {
    const badge =
      phase.state === "done"
        ? el("span", { class: "badge badge-ready", text: "Finished" })
        : phase.state === "next"
        ? el("span", { class: "badge badge-warn", text: "Next" })
        : el("span", { class: "badge badge-soon", text: "Planned" });
    host.append(
      el("tr", {}, [
        el("td", { text: `${phase.n}. ${phase.title}` }),
        el("td", { text: phase.covers }),
        el("td", {}, badge)
      ])
    );
  }
}

function renderTools() {
  const host = document.getElementById("tool-table");
  if (!host) return;

  for (const cat of CATEGORIES) {
    const inCat = TOOLS.filter((x) => x.cat === cat.id);
    if (!inCat.length) continue;

    const rows = el("tbody");
    for (const tool of inCat.slice().sort((a, b) => a.phase - b.phase)) {
      rows.append(
        el("tr", {}, [
          el("td", {}, [
            el("span", { class: "flex-row" }, [
              icon(tool.icon, 16),
              el("span", { text: t(`tool.${tool.id}.name`) })
            ])
          ]),
          el("td", { class: "muted", text: t(`tool.${tool.id}.desc`) }),
          el("td", {}, tool.built
            ? el("span", { class: "badge badge-ready", text: t("tool.ready") })
            : el("span", { class: "badge badge-soon", text: t("tool.phase", { n: tool.phase }) }))
        ])
      );
    }

    host.append(
      el("section", { class: "tool-section" }, [
        el("div", { class: "tool-section-head" }, [
          el("h3", { text: t(`cat.${cat.id}`) }),
          el("span", { class: "count", text: t("cat.count", { n: inCat.length }) })
        ]),
        el("table", { class: "status-table" }, [
          el("thead", {}, el("tr", {}, [
            el("th", { scope: "col", text: "Tool" }),
            el("th", { scope: "col", text: "What it does" }),
            el("th", { scope: "col", text: "State" })
          ])),
          rows
        ])
      ])
    );
  }
}

async function start() {
  await initPage({ pathPrefix: "" });
  renderStats();
  renderPhases();
  renderTools();
}

start().catch((err) => {
  console.error("[On Device] The roadmap page failed to start:", err);
});
