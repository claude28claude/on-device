/* ============================================================
   On Device - the Credits page

   The list of borrowed libraries is built here, at the moment you
   look, from assets/vendor/VENDOR.json - the same file that
   scripts/check-vendor.mjs re-hashes before every commit.

   It used to be typed out by hand. Within two phases it was
   claiming that zip.js, SheetJS, tesseract.js and the markdown
   libraries were "planned" while they were already shipping. On a
   page whose entire job is to be straight about what is inside
   this site, that is the worst possible thing to get wrong, so it
   is no longer written down twice.
   ============================================================ */

import { initPage } from "./app.js";
import { el } from "./ui.js";

async function build() {
  const listHost = document.getElementById("bundled-list");
  const fingerprintHost = document.getElementById("fingerprint-list");
  if (!listHost) return;

  let record;
  try {
    const response = await fetch("assets/vendor/VENDOR.json");
    if (!response.ok) throw new Error(`the file could not be read (${response.status})`);
    record = await response.json();
  } catch (err) {
    listHost.textContent = "";
    listHost.append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "The list of libraries could not be read" }),
        el("p", {
          class: "mb-0",
          text:
            "This page builds its list from assets/vendor/VENDOR.json so it cannot go " +
            "stale, and that file did not load: " + (err.message || String(err)) + ". " +
            "Rather than show you a list typed out by hand that might be wrong, it shows " +
            "you nothing and says so."
        })
      ])
    );
    return;
  }

  const sources = Array.isArray(record.sources) ? record.sources : [];

  /* ---- What is bundled ----------------------------------- */
  const table = el("table", { class: "mb-4" }, [
    el("thead", {}, el("tr", {}, [
      el("th", { scope: "col", text: "Library" }),
      el("th", { scope: "col", text: "Version" }),
      el("th", { scope: "col", text: "Licence" }),
      el("th", { scope: "col", text: "Used for" })
    ]))
  ]);

  const body = el("tbody", {});
  let fileCount = 0;

  for (const source of sources) {
    fileCount += (source.files || []).length;
    body.append(el("tr", {}, [
      el("td", { text: source.name }),
      el("td", {}, el("span", { class: "mono", text: source.version })),
      el("td", { text: source.licence }),
      el("td", { text: source.purpose })
    ]));
  }

  table.append(body);
  listHost.textContent = "";
  listHost.append(
    table,
    el("p", { class: "muted" }, [
      document.createTextNode(
        `${sources.length} librar${sources.length === 1 ? "y" : "ies"}, listing ` +
        `${fileCount} main file${fileCount === 1 ? "" : "s"}. Every one is permissively ` +
        "licensed, stored inside this site, and served from the same address as this page."
      )
    ])
  );

  /* ---- Fingerprints -------------------------------------- */
  if (fingerprintHost && record.fingerprints) {
    const fpTable = el("table", { class: "mb-4" }, [
      el("thead", {}, el("tr", {}, [
        el("th", { scope: "col", text: "File" }),
        el("th", { scope: "col", text: "SHA-256 (first 32 characters)" })
      ]))
    ]);
    const fpBody = el("tbody", {});

    for (const [file, details] of Object.entries(record.fingerprints)) {
      const hash = typeof details === "string" ? details : details.sha256;
      fpBody.append(el("tr", {}, [
        el("td", {}, el("span", { class: "mono", text: file })),
        el("td", {}, el("span", { class: "mono", text: String(hash || "").slice(0, 32) }))
      ]));
    }

    fpTable.append(fpBody);
    fingerprintHost.textContent = "";
    fingerprintHost.append(
      el("div", { class: "log-scroll" }, fpTable),
      el("p", { class: "field-hint", text:
        `All ${Object.keys(record.fingerprints).length} borrowed files, not a selection. ` +
        "Run node scripts/check-vendor.mjs to re-hash them all and compare." })
    );
  }
}

initPage({ pathPrefix: "" })
  .then(build)
  .catch((err) => {
    console.error("[On Device] The credits page failed to start:", err);
  });
