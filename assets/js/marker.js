/* ============================================================
   On Device - marking areas by dragging

   Shared by the redaction tool and the blur tool. Areas are kept
   as fractions of the image, so they mean the same thing however
   the picture is scaled on screen and whatever resolution the
   output is produced at.

   Works with a mouse, a finger, and the keyboard.
   ============================================================ */

import { el, announce } from "./ui.js";

export class Marker {
  constructor({ host, onChange, label = "Marked area" }) {
    this.host = host;
    this.onChange = onChange || (() => {});
    this.label = label;
    this.boxes = [];
    this.stage = null;
    this.surface = null;
  }

  /* Attach to an <img> or <canvas> already inside a positioned box. */
  attach(stage) {
    this.stage = stage;
    this.surface = el("div", { class: "mark-surface" });
    stage.append(this.surface);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let preview = null;

    const point = (e) => {
      const rect = this.stage.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      };
    };

    this.surface.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      const p = point(e);
      startX = p.x;
      startY = p.y;
      preview = el("div", { class: "mark-box mark-preview" });
      this.surface.append(preview);
      this.surface.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    this.surface.addEventListener("pointermove", (e) => {
      if (!dragging || !preview) return;
      const p = point(e);
      const box = normalise(startX, startY, p.x, p.y);
      place(preview, box);
      e.preventDefault();
    });

    const finish = (e) => {
      if (!dragging) return;
      dragging = false;
      const p = point(e);
      const box = normalise(startX, startY, p.x, p.y);
      if (preview) preview.remove();
      preview = null;

      /* Ignore an accidental click that marked nothing. */
      if (box.w < 0.005 || box.h < 0.005) return;

      this.add(box);
    };

    this.surface.addEventListener("pointerup", finish);
    this.surface.addEventListener("pointercancel", () => {
      dragging = false;
      if (preview) preview.remove();
      preview = null;
    });
  }

  add(box) {
    this.boxes.push(box);
    this.render();
    this.onChange(this.boxes);
    announce(`${this.label} added. ${this.boxes.length} in total.`);
  }

  /* Keyboard route: adds a box in the middle that can then be nudged. */
  addByKeyboard() {
    this.add({ x: 0.35, y: 0.45, w: 0.3, h: 0.1 });
  }

  undo() {
    if (!this.boxes.length) return;
    this.boxes.pop();
    this.render();
    this.onChange(this.boxes);
    announce(`Last ${this.label.toLowerCase()} removed. ${this.boxes.length} left.`);
  }

  clear() {
    const n = this.boxes.length;
    this.boxes = [];
    this.render();
    this.onChange(this.boxes);
    announce(`${n} removed.`);
  }

  setBoxes(boxes) {
    this.boxes = boxes.slice();
    this.render();
    this.onChange(this.boxes);
  }

  render() {
    if (!this.surface) return;
    for (const node of this.surface.querySelectorAll(".mark-box:not(.mark-preview)")) {
      node.remove();
    }

    this.boxes.forEach((box, index) => {
      const node = el("div", {
        class: "mark-box",
        tabindex: "0",
        role: "button",
        "aria-label":
          `${this.label} ${index + 1}. Arrow keys move it, Shift with arrows resizes, ` +
          `Delete removes it.`
      });
      place(node, box);

      node.addEventListener("keydown", (e) => {
        const step = 0.01;
        let handled = true;
        if (e.key === "Delete" || e.key === "Backspace") {
          this.boxes.splice(index, 1);
          this.render();
          this.onChange(this.boxes);
          announce(`${this.label} removed.`);
          return;
        }
        if (e.key === "ArrowLeft") {
          if (e.shiftKey) box.w = Math.max(0.01, box.w - step);
          else box.x = Math.max(0, box.x - step);
        } else if (e.key === "ArrowRight") {
          if (e.shiftKey) box.w = Math.min(1 - box.x, box.w + step);
          else box.x = Math.min(1 - box.w, box.x + step);
        } else if (e.key === "ArrowUp") {
          if (e.shiftKey) box.h = Math.max(0.01, box.h - step);
          else box.y = Math.max(0, box.y - step);
        } else if (e.key === "ArrowDown") {
          if (e.shiftKey) box.h = Math.min(1 - box.y, box.h + step);
          else box.y = Math.min(1 - box.h, box.y + step);
        } else {
          handled = false;
        }
        if (handled) {
          e.preventDefault();
          place(node, box);
          this.onChange(this.boxes);
        }
      });

      this.surface.append(node);
    });
  }

  /* Boxes for a particular page, tagged as they are added. */
  boxesForPage(pageNumber) {
    return this.boxes
      .filter((b) => (b.page || 1) === pageNumber)
      .map((b) => ({ ...b, page: pageNumber }));
  }
}

function normalise(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1)
  };
}

function place(node, box) {
  node.style.left = `${box.x * 100}%`;
  node.style.top = `${box.y * 100}%`;
  node.style.width = `${box.w * 100}%`;
  node.style.height = `${box.h * 100}%`;
}
