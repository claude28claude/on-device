/* On Device - Remove a background */

import { setupImageTool } from "../tool-page.js";
import * as cutout from "../image/cutout.js";
import { toCanvas } from "../image/compose.js";
import { makeCanvas, releaseCanvas, toBlob } from "../image/ops.js";
import * as tray from "../tray.js";
import { el, toast, announce, formatBytes } from "../ui.js";

const $ = (id) => document.getElementById(id);

/* Everything the visitor has decided, in one place. */
const state = {
  mode: "touching",
  brush: "off",
  output: "transparent",
  samples: [],
  strokes: []
};

let current = null;      /* { record, canvas } - the picture at full size */
let preview = null;      /* the small canvas actually on screen */
let scale = 1;           /* preview pixels per full-size pixel */
let redrawTimer = null;

/* The preview is deliberately small. Every change of a slider
   re-runs the whole calculation, and doing that on a 12-megapixel
   photograph for every mouse move would make the page unusable.
   The finished file is always produced at full size. */
const PREVIEW_MAX = 520;

async function start() {
  await setupImageTool({
    toolId: "background-remover",
    toolLabel: "Cut out",
    fileToken: "cutout",
    singleFile: true,
    onFilesChanged: (files) => load(files[0]),
    buildJob: async () => ({ op: "noop" }),
    ownRun: true
  });

  wireControls();

  /* "ownRun" above means the shared scaffolding still looks after
     enabling and labelling this button, but leaves what it does to
     us. Replacing the button outright would break that: the
     scaffolding keeps a reference to the original. */
  $("run-button").addEventListener("click", () => run());
}

/* ---- Controls -------------------------------------------- */
function segmented(id, key, after) {
  const host = $(id);
  const attr = { mode: "mode", "brush-mode": "brush", output: "output" }[id];
  for (const btn of host.querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      state[key] = btn.dataset[attr === "brush" ? "brush" : attr];
      for (const other of host.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      if (after) after(state[key]);
      schedule();
    });
  }
}

function wireControls() {
  segmented("mode", "mode", (value) => {
    $("mode-hint").textContent = value === "touching"
      ? "Spreads inwards from the edges, so an enclosed area of the same colour — the hole in a letter O, a gap under an arm — is kept."
      : "Removes every matching pixel wherever it is, including enclosed ones. Right for a logo on white; wrong for a white shirt on a white background.";
  });

  segmented("brush-mode", "brush", (value) => {
    if (preview) preview.dataset.brush = value;
  });

  segmented("output", "output", (value) => {
    $("bg-colour-field").hidden = value !== "colour";
    $("output-hint").textContent = value === "colour"
      ? "The subject is blended onto this colour, so the soft edge blends with it rather than with nothing."
      : "See-through backgrounds are saved as PNG, because JPEG cannot store them.";
  });

  $("tolerance").addEventListener("input", () => {
    $("tolerance-hint").textContent =
      `${$("tolerance").value} out of 60. Higher removes more shades of the background, ` +
      `and eventually starts eating the subject.`;
    schedule();
  });

  $("softness").addEventListener("input", () => {
    const n = Number($("softness").value);
    $("softness-hint").textContent = n === 0 ? "A hard edge." : `${n} pixel${n === 1 ? "" : "s"}.`;
    schedule();
  });

  $("edge-shift").addEventListener("input", () => {
    const n = Number($("edge-shift").value);
    $("edge-shift-hint").textContent =
      n === 0 ? "The edge is left exactly where the colours change."
      : n < 0 ? `Pulls the edge in by ${-n} pixel${n === -1 ? "" : "s"}, which removes the halo of old background colour that otherwise clings to the subject.`
      : `Pushes the edge out by ${n} pixel${n === 1 ? "" : "s"}, keeping a little more around the subject.`;
    schedule();
  });

  $("tidy").addEventListener("change", schedule);
  $("bg-colour").addEventListener("input", schedule);

  $("brush-size").addEventListener("input", () => {
    if (preview) preview.style.setProperty("--brush", `${Number($("brush-size").value)}px`);
  });

  $("clear-samples").addEventListener("click", () => {
    state.samples = [];
    paintSamples();
    schedule();
    announce("Background colours forgotten. The colour is guessed from the edges again.");
  });

  $("undo-stroke").addEventListener("click", () => {
    if (!state.strokes.length) return;
    /* One drag is many little dots; undo the whole drag. */
    const last = state.strokes[state.strokes.length - 1].group;
    while (state.strokes.length && state.strokes[state.strokes.length - 1].group === last) {
      state.strokes.pop();
    }
    schedule();
  });

  $("clear-strokes").addEventListener("click", () => {
    state.strokes = [];
    schedule();
  });
}

/* ---- Loading a picture ----------------------------------- */
async function load(record) {
  $("extra-host").textContent = "";
  current = null;
  state.samples = [];
  state.strokes = [];
  paintSamples();

  if (!record) return;

  try {
    const canvas = await toCanvas(record.blob, record.format);
    current = { record, canvas };

    scale = Math.min(1, PREVIEW_MAX / Math.max(canvas.width, canvas.height));
    const small = makeCanvas(
      Math.max(1, Math.round(canvas.width * scale)),
      Math.max(1, Math.round(canvas.height * scale))
    );
    small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
    current.small = small;

    buildStage(record, canvas);
    schedule();
  } catch (err) {
    $("extra-host").append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "That picture could not be opened" }),
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
      ])
    );
  }
}

function buildStage(record, full) {
  const host = $("extra-host");

  /* An honest verdict before anything else, based on the picture
     itself rather than on hope. */
  const edges = cutout.sampleEdges(
    current.small.getContext("2d").getImageData(0, 0, current.small.width, current.small.height)
  );
  const verdict = cutout.assess(edges);

  preview = el("canvas", {
    class: "cutout-canvas",
    width: current.small.width,
    height: current.small.height,
    dataset: { brush: state.brush },
    "aria-label": `Preview of ${record.name} with the background removed`
  });
  preview.style.setProperty("--brush", `${Number($("brush-size").value)}px`);

  const stage = el("div", { class: "cutout-stage" }, preview);
  wirePointer(preview);

  host.append(
    el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: record.name }),
      el("p", {
        class: "field-hint",
        text:
          `${full.width} × ${full.height} pixels. The preview below is smaller so the ` +
          `sliders stay quick; the file you get is full size.`
      }),
      el("div", {
        class: "note " + (verdict.level === "good" ? "note-ok" : verdict.level === "mixed" ? "note-warn" : "note-danger")
      }, [
        el("strong", {
          class: "note-title",
          text: verdict.level === "good" ? "This should work well"
            : verdict.level === "mixed" ? "This will need some help"
            : "This is not a picture this tool can do on its own"
        }),
        el("p", { class: "mb-0", text: verdict.text })
      ]),
      stage,
      el("p", { class: "field-hint mb-0", id: "cutout-readout" })
    ])
  );
}

/* ---- Pointing and painting -------------------------------- */
function wirePointer(canvas) {
  let painting = false;
  let group = 0;

  const at = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * canvas.height)
    };
  };

  const paint = (event) => {
    const { x, y } = at(event);
    /* The brush is sized in preview pixels, which is what the
       visitor sees; it is scaled up with everything else later. */
    state.strokes.push({
      x, y,
      radius: Number($("brush-size").value) / 2,
      keep: state.brush === "restore",
      group
    });
    schedule();
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    if (state.brush === "off") {
      /* Pointing at the background rather than painting. */
      const { x, y } = at(event);
      const px = current.small.getContext("2d").getImageData(
        Math.max(0, Math.min(current.small.width - 1, x)),
        Math.max(0, Math.min(current.small.height - 1, y)),
        1, 1
      ).data;
      state.samples.push([px[0], px[1], px[2]]);
      paintSamples();
      schedule();
      announce(`Added a background colour. ${state.samples.length} in use.`);
      return;
    }

    painting = true;
    group++;
    paint(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!painting) return;
    paint(event);
  });

  const stop = () => { painting = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);
}

function paintSamples() {
  const host = $("samples");
  host.textContent = "";
  if (!state.samples.length) {
    host.append(el("span", { class: "field-hint", text: "None — guessing from the edges." }));
    return;
  }
  state.samples.forEach((s, i) => {
    const swatch = el("button", {
      class: "sample-dot",
      type: "button",
      "aria-label": `Forget the colour red ${s[0]}, green ${s[1]}, blue ${s[2]}`,
      onclick: () => {
        state.samples.splice(i, 1);
        paintSamples();
        schedule();
      }
    });
    swatch.style.background = `rgb(${s[0]},${s[1]},${s[2]})`;
    host.append(swatch);
  });
}

/* ---- The live preview ------------------------------------ */
/* Re-run after a short pause, so dragging a slider does not queue
   up twenty full calculations. */
function schedule() {
  if (!current) return;
  window.clearTimeout(redrawTimer);
  redrawTimer = window.setTimeout(redraw, 90);
}

function redraw() {
  if (!current) return;
  const readout = $("cutout-readout");

  try {
    const result = cutout.cutOut(current.small, {
      samples: state.samples,
      tolerance: Number($("tolerance").value),
      mode: state.mode,
      softness: Number($("softness").value),
      tidy: $("tidy").checked,
      edgeShift: Number($("edge-shift").value),
      strokes: state.strokes,
      background: state.output === "colour" ? hexToRgb($("bg-colour").value) : null
    });

    const ctx = preview.getContext("2d");
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.drawImage(result.canvas, 0, 0);
    releaseCanvas(result.canvas);

    const percent = Math.round(result.removedFraction * 100);
    const judged = cutout.judgeResult(result.removedFraction);
    if (readout) {
      readout.textContent = judged.ok
        ? `${percent}% of the picture is being removed.`
        : `${percent}% removed. ${judged.text}`;
    }
  } catch (err) {
    if (readout) readout.textContent = `The preview could not be drawn: ${err && err.message ? err.message : err}`;
    console.error("[On Device] Background preview failed:", err);
  }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/* ---- Doing it for real ----------------------------------- */
async function run() {
  const button = $("run-button");
  button.disabled = true;

  try {
    if (!current) {
      toast("Choose a picture first.", { kind: "warn", timeout: 4000 });
      return;
    }

    /* Everything the visitor set was set against the preview, so the
       brush strokes and the edge work have to be scaled back up to
       the real picture, or a stroke would land in the wrong place. */
    const up = 1 / scale;
    const strokes = state.strokes.map((s) => ({
      x: s.x * up,
      y: s.y * up,
      radius: s.radius * up,
      keep: s.keep
    }));

    const result = cutout.cutOut(current.canvas, {
      samples: state.samples,
      tolerance: Number($("tolerance").value),
      mode: state.mode,
      softness: Math.round(Number($("softness").value) * up),
      tidy: $("tidy").checked,
      edgeShift: Math.round(Number($("edge-shift").value) * up),
      strokes,
      background: state.output === "colour" ? hexToRgb($("bg-colour").value) : null
    });

    const transparent = state.output !== "colour";
    const format = transparent ? "png" : "png";
    const blob = await toBlob(result.canvas, format, 92);
    releaseCanvas(result.canvas);

    const base = current.record.name.replace(/\.[^.]+$/, "");
    const name = `${base}-cutout.${format}`;
    await tray.addResult({
      blob,
      name,
      fromTool: "Cut out",
      fromFile: current.record.name
    });

    const judged = cutout.judgeResult(result.removedFraction);
    const percent = Math.round(result.removedFraction * 100);

    toast(
      `Saved as “${name}” (${formatBytes(blob.size)}), with ${percent}% of the picture ` +
      `${transparent ? "made see-through" : "replaced"}.` +
      (judged.ok ? "" : ` ${judged.text}`),
      { kind: judged.ok ? "ok" : "warn", title: "Done", timeout: judged.ok ? 9000 : 13000 }
    );
    announce("The background has been removed.");
  } catch (err) {
    toast(err && err.message ? err.message : String(err), {
      kind: "error",
      title: "That did not work",
      timeout: 12000
    });
    console.error("[On Device] Background removal failed:", err);
  } finally {
    button.disabled = false;
  }
}

start().catch((err) => {
  console.error("[On Device] The background remover failed to start:", err);
});
