/* On Device - what your photo is hiding */

import { setupImageTool } from "../tool-page.js";
import { metadata as readMeta } from "../image/runner.js";
import { canStripLosslessly } from "../image/strip.js";
import { el, icon, copyText, toast, formatBytes, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);

async function start() {
  const tool = await setupImageTool({
    toolId: "image-metadata",
    toolLabel: "Metadata removed",
    fileToken: "clean",
    onFilesChanged: showReports,
    buildJob: async () => ({
      op: "strip",
      keepColourProfile: $("keep-profile").checked
    })
  });

  async function showReports(files) {
    const host = $("extra-host");
    host.textContent = "";
    if (!files || !files.length) return;

    const loading = el("p", { class: "muted", text: `Reading ${files.length} file${files.length === 1 ? "" : "s"}…` });
    host.append(loading);

    const reports = [];
    for (const record of files) {
      try {
        const { report } = await readMeta(record.blob, record.format);
        reports.push({ record, report });
      } catch (err) {
        reports.push({ record, error: err && err.message ? err.message : String(err) });
      }
    }

    host.textContent = "";

    /* The blunt part first: anything with a location. */
    const located = reports.filter((r) => r.report && r.report.gps);
    if (located.length) {
      host.append(buildGpsWarning(located));
    }

    const unreadable = reports.filter((r) => r.report && r.report.unreadable);
    if (unreadable.length) {
      host.append(
        el("div", { class: "note note-warn" }, [
          el("strong", { class: "note-title", text: `Cannot check ${unreadable.length} file${unreadable.length === 1 ? "" : "s"}` }),
          el("p", { class: "mb-0", text: unreadable[0].report.unreadableReason })
        ])
      );
    }

    const clean = reports.filter((r) => r.report && r.report.hasAnything === false && !r.report.unreadable);
    if (clean.length === reports.length && reports.length) {
      host.append(
        el("div", { class: "note note-ok" }, [
          el("strong", { class: "note-title", text: "Nothing hidden found" }),
          el("p", {
            class: "mb-0",
            text:
              reports.length === 1
                ? "This picture carries no camera details, no date and no location. There is nothing to remove."
                : `None of these ${reports.length} pictures carry camera details, dates or locations. There is nothing to remove.`
          })
        ])
      );
    }

    for (const entry of reports) {
      host.append(buildReportPanel(entry));
    }

    /* Only offer stripping where it can be done without harming the picture. */
    const strippable = files.filter((f) => canStripLosslessly(f.format));
    const runButton = $("run-button");
    if (runButton) {
      if (!strippable.length) {
        runButton.disabled = true;
        runButton.textContent = "Cannot strip these formats losslessly";
      } else {
        runButton.dataset.label = "Strip metadata from";
        tool.refreshRunButton();
      }
    }

    announce(
      located.length
        ? `Warning: ${located.length} of these photos contain your location.`
        : `${reports.length} file${reports.length === 1 ? "" : "s"} checked.`,
      located.length > 0
    );
  }
}

function buildGpsWarning(located) {
  const box = el("div", { class: "gps-callout" });
  box.append(
    el("h3", {}, [icon("map-pin", 20), document.createTextNode(
      located.length === 1
        ? " This photo records where it was taken"
        : ` ${located.length} of these photos record where they were taken`
    )])
  );

  for (const { record, report } of located) {
    const coords = report.gps.text;
    box.append(
      el("div", { class: "mb-4" }, [
        el("strong", { text: record.name }),
        el("span", { class: "gps-coords", text: coords }),
        report.gps.altitude !== null
          ? el("p", { class: "text-sm mb-0", text: `Altitude: ${report.gps.altitude} metres.` })
          : null,
        el("div", { class: "btn-row" }, [
          el(
            "button",
            {
              class: "btn btn-sm",
              type: "button",
              onclick: async () => {
                const ok = await copyText(coords);
                toast(ok ? "Coordinates copied." : "Your browser would not let us copy. Select the numbers and copy them by hand.", {
                  kind: ok ? "ok" : "warn",
                  timeout: 4000
                });
              }
            },
            "Copy the coordinates"
          )
        ])
      ])
    );
  }

  box.append(
    el("p", { class: "mb-0" }, [
      el("strong", { text: "What this means: " }),
      document.createTextNode(
        "those numbers are a spot on the map, accurate to a few metres. If this photo was " +
        "taken at home, anyone you send it to can find your front door. Paste the numbers " +
        "into any map to see for yourself — that is a decision for you to make, which is " +
        "why this page does not load a map and quietly tell a mapping company where you live."
      )
    ])
  );

  return box;
}

function buildReportPanel({ record, report, error }) {
  const panel = el("div", { class: "panel mb-4" });
  panel.append(
    el("div", { class: "flex-row mb-4" }, [
      el("h2", { class: "h-lg mb-0", text: record.name }),
      el("span", { class: "badge", text: `${record.label} · ${formatBytes(record.size)}` })
    ])
  );

  if (error) {
    panel.append(el("div", { class: "note note-danger" }, el("p", { class: "mb-0", text: error })));
    return panel;
  }

  if (report.unreadable || report.unsupported) {
    panel.append(el("p", { class: "muted mb-0", text: report.unreadableReason }));
    return panel;
  }

  if (!report.hasAnything) {
    panel.append(el("p", { class: "muted mb-0", text: "No hidden information found in this file." }));
    return panel;
  }

  const section = (title, rows) => {
    if (!rows.length) return null;
    const body = el("tbody");
    for (const row of rows) {
      body.append(
        el("tr", {}, [
          el("td", { text: row.label }),
          el("td", {}, [
            document.createTextNode(row.value),
            row.note ? el("span", { class: "field-hint", text: row.note }) : null
          ])
        ])
      );
    }
    return el("div", { class: "meta-section" }, [
      el("h3", { text: title }),
      el("table", { class: "meta-table" }, body)
    ]);
  };

  panel.append(
    section("Camera and software", report.camera),
    section("When", report.when),
    section("Camera settings", report.settings)
  );

  if (report.orientation) {
    panel.append(
      section("How it is stored", [
        { label: "Rotation flag", value: report.orientation.text }
      ])
    );
  }

  if (report.gps) {
    panel.append(
      section("Location", [
        { label: "Coordinates", value: report.gps.text, note: "Accurate to a few metres." },
        report.gps.altitude !== null ? { label: "Altitude", value: `${report.gps.altitude} m` } : null,
        report.gps.dateStamp ? { label: "GPS date", value: String(report.gps.dateStamp) } : null
      ].filter(Boolean))
    );
  }

  /* Everything, for people who want everything. */
  if (report.everythingElse.length) {
    const details = el("details", { class: "mb-0" });
    details.append(el("summary", { text: `Show all ${report.everythingElse.length} recorded values` }));
    const body = el("tbody");
    for (const row of report.everythingElse) {
      body.append(el("tr", {}, [el("td", { text: row.label }), el("td", { text: row.value })]));
    }
    details.append(el("table", { class: "meta-table" }, body));
    panel.append(details);
  }

  if (!canStripLosslessly(record.format)) {
    panel.append(
      el("p", {
        class: "field-hint",
        text:
          `This is a ${record.format.toUpperCase()} file. Its hidden information cannot be cut ` +
          `out without re-saving the picture, so this tool will not offer to. Convert it to ` +
          `JPEG or PNG first — the converted copy carries none of this across.`
      })
    );
  }

  return panel;
}

start().catch((err) => {
  console.error("[On Device] The metadata tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
