/* On Device - Crop images

   The selection is held as fractions of the picture rather than
   pixels, so the same framing can be applied to several images at
   once even when they are different sizes. */

import { setupImageTool, pruneFormatOptions } from "../tool-page.js";
import { el, toast, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);

/* x, y, w, h as fractions from 0 to 1. */
let box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
let ratio = null;          /* width / height, or null for freehand */
let idPreset = null;       /* { mmW, mmH, dpi } */
let current = null;        /* the record being shown */
let previewUrl = null;

async function start() {
  const tool = await setupImageTool({
    toolId: "image-crop",
    toolLabel: "Cropped",
    fileToken: "cropped",
    onFilesChanged: (files) => showStage(files),
    buildJob: async (record) => {
      const w = record.width;
      const h = record.height;
      if (!w || !h) {
        throw new Error(
          `The size of “${record.name}” could not be read from its header, so it cannot be ` +
          `cropped by proportion. Convert it to JPEG or PNG first.`
        );
      }
      const cropPixels = {
        x: Math.round(box.x * w),
        y: Math.round(box.y * h),
        width: Math.round(box.w * w),
        height: Math.round(box.h * h)
      };

      const job = {
        op: "crop",
        crop: cropPixels,
        format: $("format").value,
        quality: Number($("quality").value)
      };

      /* An official photo has to come out at an exact pixel size. */
      if (idPreset) {
        const px = mmToPixels(idPreset);
        job.resize = {
          mode: "pixels",
          targetWidth: px.width,
          targetHeight: px.height,
          keepAspect: false,
          allowGrow: true
        };
      }
      return job;
    }
  });

  pruneFormatOptions($("format"), tool.capabilities);

  $("ratio").addEventListener("change", () => {
    const value = $("ratio").value;
    if (value === "free") {
      ratio = null;
    } else {
      const [a, b] = value.split(":").map(Number);
      ratio = a / b;
      applyRatio();
    }
    $("id-preset").value = "";
    idPreset = null;
    paint();
  });

  $("id-preset").addEventListener("change", () => {
    const value = $("id-preset").value;
    if (!value) {
      idPreset = null;
      $("id-hint").textContent = "Sets the shape and the exact output size.";
      paint();
      return;
    }
    const [size, dpi] = value.split("|");
    const [mmW, mmH] = size.split("x").map(Number);
    idPreset = { mmW, mmH, dpi: Number(dpi) };
    ratio = mmW / mmH;
    $("ratio").value = "free";
    applyRatio();
    const px = mmToPixels(idPreset);
    $("id-hint").textContent =
      `Output will be exactly ${px.width} × ${px.height} pixels ` +
      `(${mmW} × ${mmH} mm at ${idPreset.dpi} dots per inch).`;
    paint();
  });

  $("reset-crop").addEventListener("click", () => {
    box = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
    if (ratio) applyRatio();
    paint();
    announce("Selection reset.");
  });

  $("centre-crop").addEventListener("click", () => {
    box.x = (1 - box.w) / 2;
    box.y = (1 - box.h) / 2;
    paint();
    announce("Selection centred.");
  });

  $("format").addEventListener("change", () => {
    $("quality-field").hidden = $("format").value === "png";
  });
  $("quality").addEventListener("input", () => {
    $("quality-hint").textContent = `${$("quality").value} out of 100.`;
  });

  function showStage(files) {
    const host = $("extra-host");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    host.textContent = "";
    if (!files || !files.length) {
      current = null;
      $("crop-readout").textContent = "Choose an image first.";
      return;
    }

    current = files[0];

    if (files.length > 1) {
      host.append(
        el("div", { class: "note" }, [
          el("strong", { class: "note-title", text: `Cropping ${files.length} images together` }),
          el("p", {
            class: "mb-0",
            text:
              "The selection below is stored as a proportion of the picture, so the same " +
              "framing is applied to every image even where they are different sizes. " +
              "The first image is shown."
          })
        ])
      );
    }

    if (!current.width || !current.height) {
      host.append(
        el("div", { class: "note note-warn" }, [
          el("p", {
            class: "mb-0",
            text:
              `The size of “${current.name}” could not be read from its header, so it cannot ` +
              `be shown here. Convert it to JPEG or PNG first.`
          })
        ])
      );
      return;
    }

    previewUrl = URL.createObjectURL(current.blob);
    const img = el("img", {
      src: previewUrl,
      alt: `Preview of ${current.name}`,
      id: "crop-image"
    });

    const cropBox = el("div", { class: "crop-box", id: "crop-box", tabindex: "0", role: "application",
      "aria-label": "Crop selection. Use the arrow keys to move it, and hold Shift to resize." });
    for (const corner of ["nw", "ne", "sw", "se"]) {
      cropBox.append(el("div", { class: "crop-handle", dataset: { corner } }));
    }

    const stage = el("div", { class: "crop-stage", id: "crop-stage" }, [img, cropBox]);
    host.append(el("div", { class: "panel" }, [
      el("h2", { class: "h-lg", text: "Drag to choose the area" }),
      stage,
      el("p", {
        class: "field-hint",
        text: "Drag inside the box to move it, or drag a corner to resize. With the box focused, the arrow keys move it and Shift with the arrow keys resizes it."
      })
    ]));

    wireDragging(stage, cropBox);
    paint();
  }

  function paint() {
    const cropBox = document.getElementById("crop-box");
    if (!cropBox) return;
    cropBox.style.left = `${box.x * 100}%`;
    cropBox.style.top = `${box.y * 100}%`;
    cropBox.style.width = `${box.w * 100}%`;
    cropBox.style.height = `${box.h * 100}%`;

    if (current && current.width) {
      const px = {
        w: Math.round(box.w * current.width),
        h: Math.round(box.h * current.height),
        x: Math.round(box.x * current.width),
        y: Math.round(box.y * current.height)
      };
      let text = `${px.w} × ${px.h} pixels, starting at ${px.x}, ${px.y}`;
      if (idPreset) {
        const out = mmToPixels(idPreset);
        text += ` → saved as ${out.width} × ${out.height}`;
        if (px.w < out.width || px.h < out.height) {
          text += " (enlarged, so it will look soft)";
        }
      }
      $("crop-readout").textContent = text;
      cropBox.setAttribute("aria-valuetext", text);
    }
  }

  /* The selection is stored as fractions of the width and of the
     height, which are different lengths. A shape of 35 by 45
     millimetres is a ratio in PIXELS, so it has to be converted
     before it can be applied to the fractions - otherwise the
     selection comes out the wrong shape and the face inside it ends
     up stretched. */
  function fractionRatio() {
    if (!ratio) return null;
    if (!current || !current.width || !current.height) return ratio;
    return ratio * (current.height / current.width);
  }

  function applyRatio() {
    const fr = fractionRatio();
    if (!fr) return;
    /* Keep the centre, fit the new shape inside the picture. */
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    let w = box.w;
    let h = w / fr;
    if (h > 1) {
      h = 1;
      w = h * fr;
    }
    if (w > 1) {
      w = 1;
      h = w / fr;
    }
    box.w = w;
    box.h = h;
    box.x = Math.min(Math.max(cx - w / 2, 0), 1 - w);
    box.y = Math.min(Math.max(cy - h / 2, 0), 1 - h);
  }

  function wireDragging(stage, cropBox) {
    let mode = null;
    let startPointer = null;
    let startBox = null;

    const rectOf = () => stage.getBoundingClientRect();

    const begin = (e, which) => {
      mode = which;
      startPointer = { x: e.clientX, y: e.clientY };
      startBox = { ...box };
      cropBox.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };

    cropBox.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("crop-handle")) {
        begin(e, e.target.dataset.corner);
      } else {
        begin(e, "move");
      }
    });

    const move = (e) => {
      if (!mode) return;
      const rect = rectOf();
      const dx = (e.clientX - startPointer.x) / rect.width;
      const dy = (e.clientY - startPointer.y) / rect.height;

      if (mode === "move") {
        box.x = clamp(startBox.x + dx, 0, 1 - startBox.w);
        box.y = clamp(startBox.y + dy, 0, 1 - startBox.h);
      } else {
        resizeBy(mode, startBox, dx, dy);
      }
      paint();
      e.preventDefault();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", () => {
      mode = null;
    });

    /* Keyboard, so this works without a mouse. */
    cropBox.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.02 : 0.01;
      let handled = true;
      if (e.key === "ArrowLeft") {
        if (e.shiftKey) resizeTo(box.w - step, box.h);
        else box.x = clamp(box.x - step, 0, 1 - box.w);
      } else if (e.key === "ArrowRight") {
        if (e.shiftKey) resizeTo(box.w + step, box.h);
        else box.x = clamp(box.x + step, 0, 1 - box.w);
      } else if (e.key === "ArrowUp") {
        if (e.shiftKey) resizeTo(box.w, box.h - step);
        else box.y = clamp(box.y - step, 0, 1 - box.h);
      } else if (e.key === "ArrowDown") {
        if (e.shiftKey) resizeTo(box.w, box.h + step);
        else box.y = clamp(box.y + step, 0, 1 - box.h);
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        paint();
      }
    });
  }

  function resizeTo(w, h) {
    const fr = fractionRatio();
    let nw = clamp(w, 0.02, 1);
    let nh = fr ? nw / fr : clamp(h, 0.02, 1);
    if (fr && nh > 1) {
      nh = 1;
      nw = nh * fr;
    }
    box.w = clamp(nw, 0.02, 1 - box.x);
    box.h = clamp(nh, 0.02, 1 - box.y);
  }

  function resizeBy(corner, start, dx, dy) {
    let { x, y, w, h } = start;

    if (corner.includes("e")) w = start.w + dx;
    if (corner.includes("w")) { w = start.w - dx; x = start.x + dx; }
    if (corner.includes("s")) h = start.h + dy;
    if (corner.includes("n")) { h = start.h - dy; y = start.y + dy; }

    w = Math.max(0.02, w);
    h = Math.max(0.02, h);

    const fr = fractionRatio();
    if (fr) {
      /* Keep the requested shape, driven by whichever edge moved most. */
      if (Math.abs(dx) > Math.abs(dy)) h = w / fr;
      else w = h * fr;
      if (corner.includes("w")) x = start.x + start.w - w;
      if (corner.includes("n")) y = start.y + start.h - h;
    }

    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > 1) w = 1 - x;
    if (y + h > 1) h = 1 - y;

    box = { x, y, w: Math.max(0.02, w), h: Math.max(0.02, h) };
  }
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function mmToPixels({ mmW, mmH, dpi }) {
  return {
    width: Math.round((mmW / 25.4) * dpi),
    height: Math.round((mmH / 25.4) * dpi)
  };
}

start().catch((err) => {
  console.error("[On Device] The crop tool failed to start:", err);
  const host = document.getElementById("tool-status");
  if (host) {
    const box2 = document.createElement("div");
    box2.className = "note note-danger";
    box2.textContent = "This tool did not start: " + (err && err.message ? err.message : String(err));
    host.append(box2);
  }
});

window.addEventListener("pagehide", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
