/* On Device - Resize images */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import * as store from "../store.js";
import { el, formatBytes } from "../ui.js";
import { targetSize } from "../image/ops.js";

const $ = (id) => document.getElementById(id);

/* Kept at the top level rather than inside start(), because the
   picture can be shown before start() has finished running - a file
   carried over from another page arrives that early. */
let shownUrls = [];
let resultsShown = 0;

/* What each "job" preset means, in the boxes the tool already has.
   These are the sizes people actually ask for, rather than round
   numbers for their own sake. */
const JOBS = {
  email:  { mode: "longest", value: 1600, format: "jpg", limitKb: 1024, sharpen: 20,
            says: "1600 across, saved as JPEG and kept under 1 MB, which nearly every mail server accepts." },
  web:    { mode: "longest", value: 1600, format: "webp", quality: 82, sharpen: 25,
            says: "1600 across as WebP: about a third the size of a JPEG at the same quality." },
  thumb:  { mode: "pixels", width: 400, height: 400, fit: "cover", format: "jpg", quality: 80, sharpen: 35,
            says: "A 400 square, filled and cropped from the middle." },
  avatar: { mode: "pixels", width: 512, height: 512, fit: "cover", format: "jpg", quality: 85, sharpen: 30,
            says: "A 512 square, filled and cropped from the middle." },
  square: { mode: "pixels", width: 1080, height: 1080, fit: "cover", format: "jpg", quality: 85,
            says: "1080 square, filled and cropped from the middle." },
  story:  { mode: "pixels", width: 1080, height: 1920, fit: "cover", format: "jpg", quality: 85,
            says: "1080 by 1920, upright, filled and cropped from the middle." },
  wide:   { mode: "pixels", width: 1200, height: 630, fit: "cover", format: "jpg", quality: 85,
            says: "1200 by 630, the shape most sites use for a link preview." },
  hd:     { mode: "longest", value: 1920, format: "keep", sharpen: 15,
            says: "Longest side 1920, which is Full HD." },
  fourk:  { mode: "longest", value: 3840, format: "keep",
            says: "Longest side 3840, which is 4K. Pictures already smaller are left alone unless you allow enlarging." },
  print:  { mode: "longest", value: 3000, format: "jpg", quality: 92,
            says: "Longest side 3000, which is about 10 inches at 300 dots per inch." }
};

const FIT_HINTS = {
  contain: "The whole picture is kept. The space left over is filled with the colour below, so nothing is cut off and nothing is squashed.",
  cover: "The picture fills the whole rectangle and whatever hangs over the edges is cut off. Nothing is squashed, but something is lost.",
  keep: "The shape is kept, so the result fits inside these measurements rather than matching them exactly.",
  stretch: "The picture is squashed or pulled to the exact shape. Nothing is lost and nothing is cropped, and it will look wrong."
};


const LABELS = {
  longest: ["Longest side", "Pictures larger than this are scaled down."],
  shortest: ["Shortest side", "Pictures larger than this are scaled down."],
  percent: ["Percentage", "100 leaves the picture as it is. 50 halves it."],
  width: ["Width in pixels", "The height follows, keeping the shape."],
  height: ["Height in pixels", "The width follows, keeping the shape."],
  pixels: ["Exact size", "Both measurements are set below."]
};

async function start() {
  const tool = await setupImageTool({
    toolId: "image-resize",
    toolLabel: "Resize",
    fileToken: "resized",
    onFilesChanged: (files) => { showChosen(files); previewSizes(); },
    onResult: (record, result) => showResult(record, result),
    buildJob: async () => buildJob()
  });

  pruneFormatOptions($("format"), tool.capabilities);

  /* Remembered defaults from Settings. */
  $("quality").value = String(store.get("defaults.imageQuality", 85));
  $("format").value = store.get("defaults.imageFormat", "keep");
  paintQuality();
  syncMode();

  $("mode").addEventListener("change", () => {
    syncMode();
    previewSizes();
  });
  $("value").addEventListener("input", previewSizes);
  $("exact-width").addEventListener("input", previewSizes);
  $("exact-height").addEventListener("input", previewSizes);
  $("keep-aspect").addEventListener("change", previewSizes);
  $("allow-grow").addEventListener("change", previewSizes);

  $("quality").addEventListener("input", () => {
    paintQuality();
    store.set("defaults.imageQuality", Number($("quality").value));
  });

  $("format").addEventListener("change", () => {
    store.set("defaults.imageFormat", $("format").value);
    syncQualityVisibility();
    /* The size-limit hint says something different for PNG, so it has
       to be repainted when the format changes and not only when the
       limit is switched on. */
    if ($("use-limit").checked) paintLimit();
  });

  for (const btn of document.querySelectorAll("[data-preset]")) {
    btn.addEventListener("click", () => {
      $("value").value = btn.dataset.preset;
      previewSizes();
    });
  }

  $("job-preset").addEventListener("change", applyJob);
  $("fit").addEventListener("change", () => { syncFit(); previewSizes(); });
  $("pad-colour").addEventListener("input", previewSizes);
  $("sharpen").addEventListener("input", paintSharpen);
  $("use-limit").addEventListener("change", syncLimit);
  $("limit-kb").addEventListener("input", paintLimit);

  syncQualityVisibility();
  syncFit();
  syncLimit();
  paintSharpen();

  /* ---- The new controls ---------------------------------- */
  function applyJob() {
    const job = JOBS[$("job-preset").value];
    if (!job) { $("job-preset-hint").textContent = "Each one sets the boxes below. You can change anything afterwards."; return; }

    $("mode").value = job.mode;
    if (job.value) $("value").value = String(job.value);
    if (job.width) $("exact-width").value = String(job.width);
    if (job.height) $("exact-height").value = String(job.height);
    if (job.fit) $("fit").value = job.fit;
    if (job.format) $("format").value = job.format;
    if (job.quality) $("quality").value = String(job.quality);
    $("sharpen").value = String(job.sharpen || 0);

    if (job.limitKb) {
      $("use-limit").checked = true;
      $("limit-kb").value = String(job.limitKb);
    } else {
      $("use-limit").checked = false;
    }

    $("job-preset-hint").textContent = job.says;
    syncMode();
    syncFit();
    syncLimit();
    syncQualityVisibility();
    paintQuality();
    paintSharpen();
    previewSizes();
  }

  function syncFit() {
    const fit = $("fit").value;
    $("fit-hint").textContent = FIT_HINTS[fit] || "";
    /* Only "contain" leaves space that needs filling. */
    $("pad-field").hidden = fit !== "contain";
    /* "Keep the shape" is the old behaviour, expressed properly. */
    $("keep-aspect").closest(".check-row").hidden = $("mode").value === "pixels";
  }

  function syncLimit() {
    const on = $("use-limit").checked;
    $("limit-value-field").hidden = !on;
    /* One place decides whether the quality slider is shown. */
    syncQualityVisibility();
    if (on) paintLimit();
  }

  function paintLimit() {
    const format = $("format").value;
    $("limit-hint").textContent = format === "png"
      ? "PNG has no quality to trade away, so a limit cannot be aimed for. Choose JPEG or WebP."
      : "Kilobytes. The quality is lowered only as far as it needs to be, and the tool says what it settled on.";
  }

  function paintSharpen() {
    const v = Number($("sharpen").value);
    $("sharpen-hint").textContent =
      v === 0 ? "Off. Making a picture smaller always softens it a little; this puts some of the bite back."
      : v <= 30 ? `${v} out of 100 — a light touch, which suits most photographs.`
      : v <= 60 ? `${v} out of 100 — noticeable. Good for pictures that went down a long way.`
      : `${v} out of 100 — strong. This can leave pale outlines along high-contrast edges.`;
    $("sharpen").setAttribute("aria-valuetext", v === 0 ? "off" : `${v} out of 100`);
  }

  function paintQuality() {
    const v = $("quality").value;
    $("quality-hint").textContent = `${v} out of 100.`;
    $("quality").setAttribute("aria-valuetext", `${v} out of 100`);
  }

  function syncQualityVisibility() {
    const format = $("format").value;
    /* Two reasons to hide the quality slider, and both have to be
       considered together here. Deciding it in two places meant
       whichever ran last won, and choosing a preset with a size
       limit left the slider on screen pretending to be in charge.

       PNG has no quality dial - it is lossless.
       A size limit picks the quality for you. */
    const lossless = format === "png";
    const limited = $("use-limit") && $("use-limit").checked;
    $("quality-field").hidden = lossless || limited;
  }

  function syncMode() {
    const mode = $("mode").value;
    const [label, hint] = LABELS[mode] || LABELS.longest;
    $("value-field").hidden = mode === "pixels";
    $("exact-field").hidden = mode !== "pixels";
    $("preset-field").hidden = mode === "percent" || mode === "pixels";
    const labelEl = $("value-field").querySelector("label");
    if (labelEl) labelEl.textContent = label;
    $("value-hint").textContent = hint;
    if ($("fit")) syncFit();
    if (mode === "percent" && Number($("value").value) > 400) $("value").value = "50";
    if (mode !== "percent" && Number($("value").value) < 16) $("value").value = "1600";
  }

  function readOptions() {
    const mode = $("mode").value;
    const fit = $("fit").value;
    return {
      mode,
      value: Number($("value").value) || 1600,
      targetWidth: Number($("exact-width").value) || undefined,
      targetHeight: Number($("exact-height").value) || undefined,
      /* At an exact size the fit control decides the shape question,
         so the old tick box only applies to the other modes. */
      keepAspect: mode === "pixels" ? fit !== "stretch" : $("keep-aspect").checked,
      allowGrow: $("allow-grow").checked,
      fit: mode === "pixels" ? fit : undefined
    };
  }

  function buildJob() {
    const limitOn = $("use-limit").checked;
    return {
      op: "resize",
      resize: readOptions(),
      format: $("format").value,
      quality: Number($("quality").value),
      sharpen: Number($("sharpen").value) || 0,
      background: $("pad-colour").value,
      targetBytes: limitOn ? Math.max(1, Number($("limit-kb").value)) * 1024 : undefined
    };
  }

  /* Show what will actually happen, before it happens. */
  function previewSizes() {
    const host = $("extra-host");
    host.textContent = "";
    const files = tool.getFiles();
    if (!files.length) return;

    const options = readOptions();
    const rows = el("tbody");
    let anyUnchanged = false;

    for (const record of files.slice(0, 12)) {
      const w = record.width;
      const h = record.height;
      if (!w || !h) continue;
      let after;
      let note = "";
      if (options.mode === "pixels" && options.fit && options.fit !== "keep") {
        /* These three always produce exactly the rectangle asked for;
           what differs is what happens to the picture inside it. */
        after = `${options.targetWidth} × ${options.targetHeight}`;

        /* A picture smaller than the rectangle is only enlarged if
           that is allowed. If it is not, nothing is cropped however
           the fit is set - it is placed at its own size and padded -
           and the preview has to say that rather than a percentage
           that will never happen. */
        const wouldGrow = w < options.targetWidth || h < options.targetHeight;
        const heldBack = wouldGrow && !options.allowGrow;

        if (heldBack && options.fit !== "stretch") {
          note = "left at its own size and padded";
        } else if (options.fit === "cover") {
          const scale = Math.max(options.targetWidth / w, options.targetHeight / h);
          const lostW = Math.round(w * scale - options.targetWidth);
          const lostH = Math.round(h * scale - options.targetHeight);
          if (lostW > 1 || lostH > 1) {
            note = lostW > lostH
              ? `${Math.round((lostW / (w * scale)) * 100)}% cut off the sides`
              : `${Math.round((lostH / (h * scale)) * 100)}% cut off the top and bottom`;
          }
        } else if (options.fit === "contain") {
          note = "padded";
        } else if (options.fit === "stretch") {
          note = heldBack ? "stretched, which cannot avoid enlarging" : "proportions changed";
        }
      } else {
        const size = targetSize(w, h, options);
        if (size.unchanged) anyUnchanged = true;
        after = size.unchanged ? "unchanged" : `${size.width} × ${size.height}`;
      }

      rows.append(
        el("tr", {}, [
          el("td", { text: record.name }),
          el("td", { text: `${w} × ${h}` }),
          el("td", { text: after }),
          el("td", { text: note })
        ])
      );
    }

    if (!rows.children.length) return;

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "What will happen" }),
        el("table", {}, [
          el("thead", {}, el("tr", {}, [
            el("th", { scope: "col", text: "File" }),
            el("th", { scope: "col", text: "Now" }),
            el("th", { scope: "col", text: "After" }),
            el("th", { scope: "col", text: "" })
          ])),
          rows
        ]),
        files.length > 12
          ? el("p", { class: "field-hint", text: `Showing the first 12 of ${files.length}.` })
          : null,
        anyUnchanged
          ? el("p", {
              class: "field-hint",
              text: "Some pictures are already smaller than the target, so they are left alone. Switch on “Allow enlarging” to change that."
            })
          : null
      ])
    );
  }

  /* ---- Showing the picture itself --------------------------
     This tool could always tell you the numbers. It could not show
     you the picture, and the two are not the same thing: "1080 x 810"
     does not tell you whether "fill the space" has taken somebody off
     the edge of the photograph. */

  function releaseShown() {
    for (const url of shownUrls) URL.revokeObjectURL(url);
    shownUrls = [];
  }

  /* Every URL made here is remembered so it can be handed back. A
     picture held open this way stays in memory until it is released,
     and these are full-size photographs. */
  function urlFor(blob) {
    const url = URL.createObjectURL(blob);
    shownUrls.push(url);
    return url;
  }

  function pane(title, blob, caption, alt) {
    return el("figure", { class: "compare-pane" }, [
      el("figcaption", {}, [
        el("span", { text: title }),
        el("span", { class: "mono", text: caption })
      ]),
      el("img", { class: "pane-image", src: urlFor(blob), alt, loading: "lazy" })
    ]);
  }

  function sizeCaption(w, h, bytes) {
    return w && h ? `${w} \u00d7 ${h} \u00b7 ${formatBytes(bytes)}` : formatBytes(bytes);
  }

  /* Before anything has been done: the picture you chose. */
  function showChosen(files) {
    const host = $("preview-host");
    if (!host) return;
    releaseShown();
    resultsShown = 0;
    host.textContent = "";
    if (!files || !files.length) return;

    const first = files[0];
    if (!first || !first.blob) return;

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "The picture you chose" }),
        el("div", { class: "compare-grid" }, [
          pane(first.name, first.blob,
               sizeCaption(first.width, first.height, first.blob.size),
               `The picture you chose, ${first.name}`)
        ]),
        files.length > 1
          ? el("p", {
              class: "field-hint mb-0",
              text: `Showing the first of ${files.length}. All ${files.length} will be resized.`
            })
          : null
      ])
    );
  }

  /* After the work: the same picture, before and after, side by side. */
  function showResult(record, result) {
    const host = $("preview-host");
    if (!host || !record || !result || !result.blob) return;

    resultsShown++;
    if (resultsShown > 1) {
      /* The comparison stays on the first picture rather than being
         rebuilt for every file in a batch, which would leave it
         flickering through forty photographs. The rest are counted. */
      const more = $("more-resized");
      const others = resultsShown - 1;
      if (more) {
        more.textContent =
          others === 1
            ? "One other picture was resized as well. Both are in Results below."
            : `${others} other pictures were resized as well. All of them are in Results below.`;
      }
      return;
    }

    releaseShown();
    host.textContent = "";

    const beforeW = result.originalWidth || record.width;
    const beforeH = result.originalHeight || record.height;

    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "Before and after" }),
        el("div", { class: "compare-grid" }, [
          pane("Before", record.blob,
               sizeCaption(beforeW, beforeH, record.blob.size),
               `${record.name} before resizing`),
          pane("After", result.blob,
               sizeCaption(result.width, result.height, result.blob.size),
               `${record.name} after resizing`)
        ]),
        el("p", { class: "field-hint mb-0", id: "more-resized", text: "" })
      ])
    );
  }

  /* A picture held open costs memory, so hand it back when the page
     goes rather than waiting for the tab to close. */
  window.addEventListener("pagehide", releaseShown);
}

start().catch((err) => {
  console.error("[On Device] The resize tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    box.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box);
  }
});
