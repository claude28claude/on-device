/* ============================================================
   On Device - what a recipe step can be

   A recipe is a list of steps. This file is the catalogue of the
   steps that exist, and the only place that knows how to actually
   perform one.

   Every step here works without a screen: it takes files in,
   returns files out, and asks no questions while it runs. That is
   what makes a saved recipe possible - a chain of steps can be
   replayed on forty files without anybody clicking anything.

   Tools that genuinely need a human mid-way - drawing a crop box,
   marking words to redact, placing a signature - cannot be steps,
   and are listed at the bottom as unavailable, with the reason, so
   the interface can say why rather than silently omitting them.
   ============================================================ */

import * as runner from "../image/runner.js";
import { resolveFormat, extensionFor, baseName } from "../image/pipeline.js";
import { toCanvas, watermarkCanvas } from "../image/compose.js";
import { toBlob, releaseCanvas } from "../image/ops.js";

import * as edit from "../pdf/edit.js";
import * as stamp from "../pdf/stamp.js";
import * as compress from "../pdf/compress.js";
import * as password from "../pdf/password.js";
import { save as savePdf, parsePageRange, openForWriting } from "../pdf/doc.js";
import { pagesToImages, extractText } from "../pdf/render.js";

/* ---- The thing that flows through a recipe --------------- */
/* One item is one file on its way through the chain:
   { blob, name, format, kind }. "format" is the specific type
   ("jpg", "pdf"); "kind" is the family ("image", "pdf", "text"). */

export function makeItem(blob, name, format, kind) {
  return { blob, name, format, kind };
}

const KIND_OF = {
  pdf: "pdf", jpg: "image", png: "image", webp: "image", avif: "image",
  gif: "image", bmp: "image", tiff: "image", heic: "heic",
  txt: "text", md: "text", csv: "csv", json: "json", zip: "zip"
};

function kindFor(format) {
  return KIND_OF[format] || "any";
}

/* Rename a file, keeping it obvious which step produced it. */
function renamed(name, suffix, extension) {
  const base = baseName(name);
  const tail = extension ? `.${extension}` : name.slice(base.length);
  return suffix ? `${base}-${suffix}${tail}` : `${base}${tail}`;
}

/* A file object the PDF and image code can read. Blob is enough for
   everything we call, but a name makes error messages readable. */
function asFile(item) {
  if (item.blob instanceof File) return item.blob;
  return new File([item.blob], item.name, { type: item.blob.type || "" });
}

async function pdfOut(doc, name, suffix) {
  const { blob } = await savePdf(doc, { name });
  return makeItem(blob, renamed(name, suffix, "pdf"), "pdf", "pdf");
}

/* An image is only an image to these steps once it is a format the
   browser can actually decode. HEIC counts, because the browser may
   be able to; if it cannot, decoding says so plainly. */
function isImage(item) {
  return item.kind === "image" || item.kind === "heic";
}

function requireAll(items, test, what) {
  const wrong = items.filter((i) => !test(i));
  if (wrong.length) {
    const names = wrong.slice(0, 3).map((i) => `“${i.name}”`).join(", ");
    throw new Error(
      `This step only works on ${what}. ${names}` +
      (wrong.length > 3 ? ` and ${wrong.length - 3} more` : "") +
      ` ${wrong.length === 1 ? "is" : "are"} not. Move the step, or take that file out.`
    );
  }
}

/* ---- Option types the editor knows how to draw ----------- */
/* type: select | number | text | toggle | colour | secret
   A "secret" is never written to storage. See store.js. */

const QUALITY = {
  key: "quality", type: "number", label: "Quality", min: 30, max: 100, step: 1,
  default: 82, hint: "Higher keeps more detail and makes a bigger file. 82 is a good balance."
};

const IMAGE_FORMAT = {
  key: "format", type: "select", label: "Save as", default: "keep",
  options: [
    { value: "keep", label: "Keep the original format" },
    { value: "jpg", label: "JPEG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WebP" },
    { value: "avif", label: "AVIF" }
  ]
};

/* ---- The catalogue --------------------------------------- */
/* fan tells the editor how the file count changes:
   "1:1" each file becomes one file
   "n:1" every file becomes one file together
   "1:n" each file becomes several                            */

export const STEPS = [
  /* ---------- Images ---------- */
  {
    id: "image-resize",
    tool: "image-resize",
    cat: "image",
    icon: "resize",
    fan: "1:1",
    accepts: "image",
    label: "Resize the picture",
    blurb: "Make every picture fit within a size you choose.",
    options: [
      {
        key: "mode", type: "select", label: "Fit by", default: "longest",
        options: [
          { value: "longest", label: "Longest side" },
          { value: "width", label: "Width" },
          { value: "height", label: "Height" },
          { value: "percent", label: "Percentage of the original" }
        ]
      },
      { key: "value", type: "number", label: "Size", min: 1, max: 20000, step: 1, default: 1600,
        hint: "Pixels, or a percentage if you chose percentage." },
      { key: "allowGrow", type: "toggle", label: "Enlarge pictures that are already smaller", default: false,
        hint: "Off by default: making a small picture bigger invents detail that was never there." },
      { key: "sharpen", type: "number", label: "Sharpen afterwards", min: 0, max: 100, step: 5, default: 0,
        hint: "Out of 100. Making a picture smaller softens it; this puts some of the bite back. Above 60 can leave pale outlines." },
      { key: "limitKb", type: "number", label: "Keep each one under (kilobytes)", min: 0, max: 20000, step: 10, default: 0,
        hint: "0 means no limit. Otherwise the quality is lowered only as far as it needs to be. Has no effect on PNG, which has no quality to trade." },
      IMAGE_FORMAT,
      QUALITY
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const result = await runner.run(asFile(item), item.format, {
          op: "process",
          resize: { mode: o.mode, value: Number(o.value), allowGrow: Boolean(o.allowGrow) },
          sharpen: Number(o.sharpen) || 0,
          targetBytes: Number(o.limitKb) > 0 ? Number(o.limitKb) * 1024 : undefined,
          format: o.format,
          quality: Number(o.quality)
        });
        out.push(makeItem(
          result.blob,
          renamed(item.name, "resized", extensionFor(result.format)),
          result.format,
          "image"
        ));
      }
      return out;
    }
  },

  {
    id: "image-convert",
    tool: "image-convert",
    cat: "image",
    icon: "shuffle",
    fan: "1:1",
    accepts: "image",
    label: "Change the picture format",
    blurb: "Turn HEIC, PNG, WebP and the rest into whichever format you need.",
    options: [
      { ...IMAGE_FORMAT, default: "jpg" },
      QUALITY,
      { key: "background", type: "colour", label: "Fill see-through areas with", default: "#ffffff",
        hint: "Only used when saving as JPEG, which cannot store transparency." }
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const result = await runner.run(asFile(item), item.format, {
          op: "process",
          format: o.format,
          quality: Number(o.quality),
          background: o.background
        });
        out.push(makeItem(
          result.blob,
          renamed(item.name, "", extensionFor(result.format)),
          result.format,
          "image"
        ));
      }
      return out;
    }
  },

  {
    id: "image-compress",
    tool: "image-compress",
    cat: "image",
    icon: "minimize",
    fan: "1:1",
    accepts: "image",
    label: "Make the picture smaller",
    blurb: "Re-save at a lower quality to cut the file size, keeping the same dimensions.",
    options: [
      { ...QUALITY, default: 70 },
      IMAGE_FORMAT
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const result = await runner.run(asFile(item), item.format, {
          op: "process",
          format: o.format,
          quality: Number(o.quality)
        });
        out.push(makeItem(
          result.blob,
          renamed(item.name, "smaller", extensionFor(result.format)),
          result.format,
          "image"
        ));
      }
      return out;
    }
  },

  {
    id: "image-rotate",
    tool: "image-rotate",
    cat: "image",
    icon: "rotate",
    fan: "1:1",
    accepts: "image",
    label: "Turn or mirror the picture",
    blurb: "Rotate by a quarter turn, or flip left-to-right.",
    options: [
      { key: "degrees", type: "select", label: "Turn", default: 90,
        options: [
          { value: 0, label: "Not at all" },
          { value: 90, label: "A quarter turn clockwise" },
          { value: 180, label: "Upside down" },
          { value: 270, label: "A quarter turn anticlockwise" }
        ] },
      { key: "flipH", type: "toggle", label: "Mirror left to right", default: false },
      { key: "flipV", type: "toggle", label: "Mirror top to bottom", default: false },
      IMAGE_FORMAT,
      QUALITY
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const result = await runner.run(asFile(item), item.format, {
          op: "process",
          rotate: { degrees: Number(o.degrees), flipH: Boolean(o.flipH), flipV: Boolean(o.flipV) },
          format: o.format,
          quality: Number(o.quality)
        });
        out.push(makeItem(
          result.blob,
          renamed(item.name, "turned", extensionFor(result.format)),
          result.format,
          "image"
        ));
      }
      return out;
    }
  },

  {
    id: "image-strip",
    tool: "image-metadata",
    cat: "image",
    icon: "map-pin",
    fan: "1:1",
    accepts: "image",
    label: "Remove hidden information",
    blurb: "Strip the location, camera and timestamps out of a photo. On JPEG and PNG this does not touch the picture itself.",
    options: [
      { key: "keepColourProfile", type: "toggle", label: "Keep the colour profile", default: true,
        hint: "The colour profile is not personal information, and removing it can shift the colours." }
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const result = await runner.run(asFile(item), item.format, {
          op: "strip",
          keepColourProfile: o.keepColourProfile !== false,
          format: "keep"
        });
        out.push(makeItem(
          result.blob,
          renamed(item.name, "clean", extensionFor(result.format)),
          result.format,
          "image"
        ));
      }
      return out;
    }
  },

  {
    id: "image-watermark",
    tool: "image-watermark",
    cat: "image",
    icon: "droplet",
    fan: "1:1",
    accepts: "image",
    label: "Stamp text on the picture",
    blurb: "Write your name, a date or a warning across every picture.",
    options: [
      { key: "text", type: "text", label: "Text", default: "", placeholder: "© Your name" },
      { key: "position", type: "select", label: "Where", default: "bottom-right",
        options: [
          { value: "bottom-right", label: "Bottom right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "top-right", label: "Top right" },
          { value: "top-left", label: "Top left" },
          { value: "centre", label: "Middle" }
        ] },
      { key: "tile", type: "toggle", label: "Repeat across the whole picture", default: false },
      { key: "opacity", type: "number", label: "Strength", min: 5, max: 100, step: 5, default: 35,
        hint: "Out of 100. Lower is fainter." },
      { key: "size", type: "number", label: "Text size", min: 2, max: 20, step: 1, default: 6,
        hint: "As a percentage of the picture's shorter side, so it scales with the photo." },
      { key: "colour", type: "colour", label: "Colour", default: "#ffffff" },
      { key: "rotation", type: "number", label: "Angle", min: -90, max: 90, step: 15, default: 0 },
      IMAGE_FORMAT,
      QUALITY
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      if (!String(o.text || "").trim()) {
        throw new Error("The watermark has no text in it, so it would stamp nothing. Type something to stamp.");
      }
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        /* Watermarking has to happen on a canvas here rather than in the
           background thread, because the drawing code lives on the page. */
        const canvas = await toCanvas(asFile(item), item.format);
        try {
          watermarkCanvas(canvas, {
            text: String(o.text),
            position: o.position,
            tile: Boolean(o.tile),
            opacity: Number(o.opacity) / 100,
            size: Number(o.size) / 100,
            colour: o.colour,
            rotation: Number(o.rotation)
          });
          const format = await resolveFormat(o.format, item.format);
          const blob = await toBlob(canvas, format, Number(o.quality));
          out.push(makeItem(
            blob,
            renamed(item.name, "stamped", extensionFor(format)),
            format,
            "image"
          ));
        } finally {
          releaseCanvas(canvas);
        }
      }
      return out;
    }
  },

  /* ---------- PDFs ---------- */
  {
    id: "pdf-merge",
    tool: "pdf-merge",
    cat: "pdf",
    icon: "layers",
    fan: "n:1",
    accepts: "pdf-or-image",
    label: "Join everything into one PDF",
    blurb: "Every file reaching this step becomes one document, in the order shown.",
    options: [
      { key: "name", type: "text", label: "Name the result", default: "joined.pdf", placeholder: "joined.pdf" }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf" || isImage(i), "PDFs and pictures");
      ctx.progress(0.1, "");
      const sources = items.map((i) => ({
        kind: isImage(i) ? "image" : "pdf",
        file: asFile(i),
        name: i.name,
        format: i.format
      }));
      const { doc } = await edit.merge(sources, { onProgress: (p) => ctx.progress(p, "") });
      const name = String(o.name || "joined.pdf").replace(/(\.pdf)?$/i, ".pdf");
      const { blob } = await savePdf(doc, { name });
      return [makeItem(blob, name, "pdf", "pdf")];
    }
  },

  {
    id: "pdf-split",
    tool: "pdf-split",
    cat: "pdf",
    icon: "scissors",
    fan: "1:n",
    accepts: "pdf",
    label: "Split the PDF up",
    blurb: "Break each document into single pages, or into equal chunks.",
    options: [
      { key: "mode", type: "select", label: "How", default: "burst",
        options: [
          { value: "burst", label: "One file per page" },
          { value: "every", label: "Every N pages" }
        ] },
      { key: "everyN", type: "number", label: "N", min: 1, max: 500, step: 1, default: 10 }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const { results } = await edit.split(asFile(item), {
          mode: o.mode,
          everyN: Number(o.everyN),
          name: item.name
        });
        for (let g = 0; g < results.length; g++) {
          const group = results[g];
          const label = group.pages.length === 1
            ? `p${group.pages[0]}`
            : `p${group.pages[0]}-${group.pages[group.pages.length - 1]}`;
          out.push(await pdfOut(group.doc, item.name, label));
        }
      }
      return out;
    }
  },

  {
    id: "pdf-pages",
    tool: "pdf-organise",
    cat: "pdf",
    icon: "grid",
    fan: "1:1",
    accepts: "pdf",
    label: "Keep only some pages",
    blurb: "Pull out a range such as 1-3, 7, 12- and throw the rest away.",
    options: [
      { key: "range", type: "text", label: "Pages to keep", default: "1-", placeholder: "1-3, 7, 12-",
        hint: "A dash with nothing after it means “to the end”." }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const file = asFile(item);
        /* The page count has to come from the document itself, because a
           range like "12-" means something different in every file. */
        const opened = await openForWriting(file, { name: item.name });
        const total = opened.getPageCount();
        const { pages, problems } = parsePageRange(o.range, total);
        if (problems && problems.length) {
          throw new Error(
            `The page range “${o.range}” does not work for “${item.name}”, which has ` +
            `${total} page${total === 1 ? "" : "s"}: ${problems.join(" ")}`
          );
        }
        const result = await edit.extractPages(file, pages, { name: item.name });
        out.push(await pdfOut(result, item.name, "pages"));
      }
      return out;
    }
  },

  {
    id: "pdf-rotate",
    tool: "pdf-rotate-crop",
    cat: "pdf",
    icon: "rotate",
    fan: "1:1",
    accepts: "pdf",
    label: "Turn every page",
    blurb: "Rotate all pages by a quarter turn, useful for scans that came out sideways.",
    options: [
      { key: "degrees", type: "select", label: "Turn", default: 90,
        options: [
          { value: 90, label: "A quarter turn clockwise" },
          { value: 180, label: "Upside down" },
          { value: 270, label: "A quarter turn anticlockwise" }
        ] }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const doc = await edit.rotatePages(asFile(item), {
          degrees: Number(o.degrees),
          name: item.name
        });
        out.push(await pdfOut(doc, item.name, "turned"));
      }
      return out;
    }
  },

  {
    id: "pdf-page-numbers",
    tool: "pdf-page-numbers",
    cat: "pdf",
    icon: "hash",
    fan: "1:1",
    accepts: "pdf",
    label: "Add page numbers",
    blurb: "Number the pages, with an optional heading alongside.",
    options: [
      { key: "format", type: "text", label: "Pattern", default: "{n}", placeholder: "Page {n} of {total}",
        hint: "{n} is the page number, {total} the number of pages." },
      { key: "position", type: "select", label: "Where", default: "bottom-centre",
        options: [
          { value: "bottom-centre", label: "Bottom, middle" },
          { value: "bottom-right", label: "Bottom right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "top-centre", label: "Top, middle" },
          { value: "top-right", label: "Top right" },
          { value: "top-left", label: "Top left" }
        ] },
      { key: "startAt", type: "number", label: "Start counting at", min: 0, max: 10000, step: 1, default: 1 },
      { key: "skipFirst", type: "toggle", label: "Leave the first page unnumbered", default: false,
        hint: "Usual for a cover page." },
      { key: "headerText", type: "text", label: "Heading on the opposite edge", default: "", placeholder: "optional" },
      { key: "fontSize", type: "number", label: "Text size", min: 6, max: 36, step: 1, default: 11 },
      { key: "colour", type: "colour", label: "Colour", default: "#333333" }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const doc = await stamp.addPageNumbers(asFile(item), {
          name: item.name,
          format: o.format,
          startAt: Number(o.startAt),
          skipFirst: Boolean(o.skipFirst),
          position: o.position,
          fontSize: Number(o.fontSize),
          colour: o.colour,
          headerText: o.headerText
        });
        out.push(await pdfOut(doc, item.name, "numbered"));
      }
      return out;
    }
  },

  {
    id: "pdf-watermark",
    tool: "pdf-watermark",
    cat: "pdf",
    icon: "droplet",
    fan: "1:1",
    accepts: "pdf",
    label: "Stamp text on every page",
    blurb: "Write DRAFT, CONFIDENTIAL or anything else across the pages.",
    options: [
      { key: "text", type: "text", label: "Text", default: "DRAFT", placeholder: "DRAFT" },
      { key: "position", type: "select", label: "Where", default: "centre",
        options: [
          { value: "centre", label: "Middle" },
          { value: "top", label: "Top" },
          { value: "bottom", label: "Bottom" },
          { value: "top-left", label: "Top left" },
          { value: "top-right", label: "Top right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-right", label: "Bottom right" }
        ] },
      { key: "tile", type: "toggle", label: "Repeat across the whole page", default: false },
      { key: "fontSize", type: "number", label: "Text size", min: 8, max: 200, step: 2, default: 48 },
      { key: "opacity", type: "number", label: "Strength", min: 5, max: 100, step: 5, default: 25,
        hint: "Out of 100. Lower is fainter." },
      { key: "rotation", type: "number", label: "Angle", min: -90, max: 90, step: 15, default: 45 },
      { key: "colour", type: "colour", label: "Colour", default: "#ff0000" }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      if (!String(o.text || "").trim()) {
        throw new Error("The watermark has no text in it, so it would stamp nothing. Type something to stamp.");
      }
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const doc = await stamp.watermark(asFile(item), {
          name: item.name,
          text: String(o.text),
          fontSize: Number(o.fontSize),
          colour: o.colour,
          opacity: Number(o.opacity) / 100,
          rotation: Number(o.rotation),
          position: o.position,
          tile: Boolean(o.tile)
        });
        out.push(await pdfOut(doc, item.name, "stamped"));
      }
      return out;
    }
  },

  {
    id: "pdf-metadata-wipe",
    tool: "pdf-metadata",
    cat: "pdf",
    icon: "info",
    fan: "1:1",
    accepts: "pdf",
    label: "Wipe the document's details",
    blurb: "Clear the title, author, software and dates a PDF carries around with it.",
    options: [],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const doc = await stamp.writeMetadata(asFile(item), {}, { name: item.name, wipe: true });
        out.push(await pdfOut(doc, item.name, "clean"));
      }
      return out;
    }
  },

  {
    id: "pdf-flatten",
    tool: "pdf-flatten",
    cat: "pdf",
    icon: "layers-flat",
    fan: "1:1",
    accepts: "pdf",
    label: "Freeze the form fields",
    blurb: "Turn a fillable form into ordinary page content, so nobody can change the answers.",
    options: [],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const { doc } = await stamp.flatten(asFile(item), { name: item.name });
        out.push(await pdfOut(doc, item.name, "flat"));
      }
      return out;
    }
  },

  {
    id: "pdf-nup",
    tool: "pdf-nup",
    cat: "pdf",
    icon: "columns",
    fan: "1:1",
    accepts: "pdf",
    label: "Several pages on one sheet",
    blurb: "Fit two or four pages onto each sheet, to save paper.",
    options: [
      { key: "perSheet", type: "select", label: "Pages per sheet", default: 2,
        options: [{ value: 2, label: "Two" }, { value: 4, label: "Four" }] },
      { key: "sheetSize", type: "select", label: "Sheet size", default: "a4",
        options: [
          { value: "a4", label: "A4" },
          { value: "letter", label: "Letter" },
          { value: "a3", label: "A3" }
        ] },
      { key: "orientation", type: "select", label: "Orientation", default: "landscape",
        options: [
          { value: "landscape", label: "Landscape" },
          { value: "portrait", label: "Portrait" }
        ] }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const { doc } = await stamp.nUp(asFile(item), {
          name: item.name,
          perSheet: Number(o.perSheet),
          sheetSize: o.sheetSize,
          orientation: o.orientation
        });
        out.push(await pdfOut(doc, item.name, `${o.perSheet}up`));
      }
      return out;
    }
  },

  {
    id: "pdf-tidy",
    tool: "pdf-compress",
    cat: "pdf",
    icon: "minimize",
    fan: "1:1",
    accepts: "pdf",
    label: "Tidy the PDF up",
    blurb: "Rewrite the file more efficiently. Nothing is re-drawn, so nothing gets blurrier — but the saving is modest.",
    options: [],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        ctx.progress(i / items.length, items[i].name);
        const item = items[i];
        const result = await compress.tidy(asFile(item), { name: item.name });
        out.push(makeItem(result.blob, renamed(item.name, "tidied", "pdf"), "pdf", "pdf"));
      }
      return out;
    }
  },

  {
    id: "pdf-to-images",
    tool: "pdf-to-images",
    cat: "pdf",
    icon: "image",
    fan: "1:n",
    accepts: "pdf",
    label: "Turn pages into pictures",
    blurb: "Every page becomes its own picture file.",
    options: [
      { key: "dpi", type: "number", label: "Resolution", min: 36, max: 600, step: 6, default: 150,
        hint: "Dots per inch. 150 is fine on screen; 300 is print quality and much larger." },
      { key: "format", type: "select", label: "Save as", default: "png",
        options: [{ value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }] },
      QUALITY
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const pages = await pagesToImages(asFile(item), {
          dpi: Number(o.dpi),
          format: o.format,
          quality: Number(o.quality),
          onProgress: (p) => ctx.progress((i + p) / items.length, item.name)
        });
        for (const page of pages) {
          out.push(makeItem(
            page.blob,
            renamed(item.name, `p${page.number}`, o.format),
            o.format,
            "image"
          ));
        }
      }
      return out;
    }
  },

  {
    id: "images-to-pdf",
    tool: "images-to-pdf",
    cat: "pdf",
    icon: "file-plus",
    fan: "n:1",
    accepts: "image",
    label: "Make one PDF from the pictures",
    blurb: "Each picture becomes a page, in the order shown.",
    options: [
      { key: "name", type: "text", label: "Name the result", default: "pictures.pdf", placeholder: "pictures.pdf" },
      { key: "imagePageSize", type: "select", label: "Page size", default: "a4",
        options: [
          { value: "a4", label: "A4" },
          { value: "letter", label: "Letter" },
          { value: "match", label: "Match each picture" }
        ] },
      { key: "imageOrientation", type: "select", label: "Orientation", default: "auto",
        options: [
          { value: "auto", label: "Follow the picture" },
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" }
        ] },
      { key: "imageMargin", type: "number", label: "Margin", min: 0, max: 144, step: 6, default: 0,
        hint: "In points — 72 to the inch." }
    ],
    async run(items, o, ctx) {
      requireAll(items, isImage, "pictures");
      ctx.progress(0.1, "");
      const sources = items.map((i) => ({ file: asFile(i), name: i.name, format: i.format }));
      const { doc } = await edit.imagesToPdf(sources, {
        imagePageSize: o.imagePageSize,
        imageOrientation: o.imageOrientation,
        imageMargin: Number(o.imageMargin),
        onProgress: (p) => ctx.progress(p, "")
      });
      const name = String(o.name || "pictures.pdf").replace(/(\.pdf)?$/i, ".pdf");
      const { blob } = await savePdf(doc, { name });
      return [makeItem(blob, name, "pdf", "pdf")];
    }
  },

  {
    id: "pdf-extract-text",
    tool: "pdf-extract-text",
    cat: "pdf",
    icon: "type",
    fan: "1:1",
    accepts: "pdf",
    label: "Pull the text out",
    blurb: "Save the words in a PDF as a plain text file. Only works where the PDF really has text; a scan has none.",
    options: [
      { key: "separator", type: "toggle", label: "Mark where each page starts", default: true }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const pages = await extractText(asFile(item), {
          onProgress: (p) => ctx.progress((i + p) / items.length, item.name)
        });
        const body = pages
          .map((p) => (o.separator ? `--- page ${p.number} ---\n${p.text}` : p.text))
          .join("\n\n");
        if (!body.trim()) {
          throw new Error(
            `“${item.name}” has no text in it that can be copied. It is almost certainly ` +
            `a scan — a picture of a page. Use the scanned-document tool on it instead.`
          );
        }
        out.push(makeItem(
          new Blob([body], { type: "text/plain;charset=utf-8" }),
          renamed(item.name, "", "txt"),
          "txt",
          "text"
        ));
      }
      return out;
    }
  },

  {
    id: "pdf-password-add",
    tool: "pdf-password-add",
    cat: "pdf",
    icon: "lock",
    fan: "1:1",
    accepts: "pdf",
    label: "Put a password on it",
    blurb: "Encrypt each document so it cannot be opened without the password.",
    secret: "userPassword",
    options: [
      { key: "userPassword", type: "secret", label: "Password",
        hint: "Never saved with the recipe. You will be asked for it each time the recipe runs." },
      { key: "allowPrinting", type: "toggle", label: "Allow printing", default: true },
      { key: "allowCopying", type: "toggle", label: "Allow copying text out", default: false }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const result = await password.addPassword(asFile(item), {
          userPassword: o.userPassword,
          allowPrinting: Boolean(o.allowPrinting),
          allowCopying: Boolean(o.allowCopying),
          onProgress: (p) => ctx.progress((i + p) / items.length, item.name)
        });
        out.push(makeItem(result.blob, renamed(item.name, "locked", "pdf"), "pdf", "pdf"));
      }
      return out;
    }
  },

  {
    id: "pdf-password-remove",
    tool: "pdf-password-remove",
    cat: "pdf",
    icon: "unlock",
    fan: "1:1",
    accepts: "pdf",
    label: "Take the password off",
    blurb: "Remove the encryption from documents you already know the password to.",
    secret: "password",
    options: [
      { key: "password", type: "secret", label: "The document's current password",
        hint: "Never saved with the recipe. You will be asked for it each time the recipe runs." }
    ],
    async run(items, o, ctx) {
      requireAll(items, (i) => i.kind === "pdf", "PDFs");
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const result = await password.removePassword(asFile(item), {
          password: o.password,
          onProgress: (p) => ctx.progress((i + p) / items.length, item.name)
        });
        out.push(makeItem(result.blob, renamed(item.name, "open", "pdf"), "pdf", "pdf"));
      }
      return out;
    }
  },

  /* ---------- Anything at all ---------- */
  {
    id: "rename",
    tool: "",
    cat: "files",
    icon: "type",
    fan: "1:1",
    accepts: "any",
    label: "Rename the files",
    blurb: "Give every file a consistent name.",
    options: [
      { key: "pattern", type: "text", label: "Pattern", default: "{name}", placeholder: "{name}-{n}",
        hint: "{name} is the name it already has, {n} its number in the batch, {date} today's date. The extension is kept." }
    ],
    async run(items, o, ctx) {
      const stamp2 = new Date();
      const date = `${stamp2.getFullYear()}-${String(stamp2.getMonth() + 1).padStart(2, "0")}-${String(stamp2.getDate()).padStart(2, "0")}`;
      return items.map((item, i) => {
        ctx.progress(i / items.length, item.name);
        const ext = (item.name.match(/\.[^.]+$/) || [""])[0];
        const next = String(o.pattern || "{name}")
          .replace(/\{name\}/g, baseName(item.name))
          .replace(/\{n\}/g, String(i + 1))
          .replace(/\{date\}/g, date);
        return makeItem(item.blob, /\.[a-z0-9]+$/i.test(next) ? next : next + ext, item.format, item.kind);
      });
    }
  },

  {
    id: "zip",
    tool: "zip",
    cat: "files",
    icon: "package",
    fan: "n:1",
    accepts: "any",
    label: "Bundle into a zip",
    blurb: "Put everything reaching this step into one zip file. Usually the last step.",
    secret: "password",
    options: [
      { key: "name", type: "text", label: "Name the zip", default: "files.zip", placeholder: "files.zip" },
      { key: "level", type: "select", label: "Compression", default: 5,
        options: [
          { value: 0, label: "None — fastest" },
          { value: 5, label: "Normal" },
          { value: 9, label: "Hardest — slowest" }
        ] },
      { key: "password", type: "secret", label: "Password (optional)",
        hint: "Never saved with the recipe. Leave empty for an ordinary zip." }
    ],
    async run(items, o, ctx) {
      const zip = await import("../../vendor/zipjs/zip.min.js");
      if (zip.configure) zip.configure({ useWebWorkers: true });
      const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"), {
        password: o.password || undefined,
        level: Number(o.level),
        encryptionStrength: 3
      });
      /* Two files with the same name would quietly overwrite each other
         inside the archive, so a repeat gets a number. */
      const used = new Set();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        ctx.progress(i / items.length, item.name);
        let name = item.name;
        let n = 2;
        while (used.has(name)) {
          const ext = (item.name.match(/\.[^.]+$/) || [""])[0];
          name = `${baseName(item.name)} (${n})${ext}`;
          n++;
        }
        used.add(name);
        await writer.add(name, new zip.BlobReader(item.blob));
      }
      const blob = await writer.close();
      const name = String(o.name || "files.zip").replace(/(\.zip)?$/i, ".zip");
      return [makeItem(blob, name, "zip", "zip")];
    }
  }
];

export const STEPS_BY_ID = new Map(STEPS.map((s) => [s.id, s]));

export function getStep(id) {
  return STEPS_BY_ID.get(id) || null;
}

/* Default options for a freshly added step. */
export function defaultOptions(stepId) {
  const step = getStep(stepId);
  if (!step) return {};
  const out = {};
  for (const opt of step.options) {
    if (opt.type === "secret") continue;
    out[opt.key] = opt.default;
  }
  return out;
}

/* Which option keys must never be written to storage. */
export function secretKeys(stepId) {
  const step = getStep(stepId);
  if (!step) return [];
  return step.options.filter((o) => o.type === "secret").map((o) => o.key);
}

/* ---- Tools that cannot be recipe steps, and why ---------- */
/* Being explicit beats a shorter list with no explanation. The
   recipe page shows this so nobody hunts for a step that is
   missing on purpose. */
export const NOT_STEPS = [
  { tool: "image-crop", why: "Cropping needs you to drag a box on the picture, which cannot be replayed on a file it has never seen." },
  { tool: "image-blur", why: "Blurring needs you to mark the areas to hide, which is different on every picture." },
  { tool: "pdf-redact", why: "Redaction needs you to mark what to remove. Guessing at that is exactly how a redaction fails." },
  { tool: "pdf-fill-sign", why: "Filling a form and placing a signature is done by hand on the page." },
  { tool: "pdf-ocr", why: "Reading a scan is slow and its settings depend on the document, so it stays a tool you drive yourself. It also cannot run in a background tab." },
  { tool: "image-combine", why: "Combining pictures into one needs a layout chosen for the pictures in front of you." },
  { tool: "icon-generator", why: "Produces a fixed set of files rather than something a later step could work on." },
  { tool: "colour-palette", why: "Reports colours; it does not produce a file to pass on." },
  { tool: "screenshot-polish", why: "The framing is judged by eye." },
  { tool: "checksum", why: "Reports a fingerprint; it does not produce a file to pass on." },
  { tool: "file-compare", why: "Compares two files and reports; there is no file to pass on." },
  { tool: "file-lock", why: "Locking is deliberately a slow, deliberate, one-file-at-a-time act, with a password you should type each time." },
  { tool: "qr-generate", why: "Makes a code from text you type, not from a file arriving in a chain." },
  { tool: "text-workbench", why: "Interactive by nature — you watch the text change as you choose." },
  { tool: "spreadsheet", why: "Interactive by nature — you pick sheets and columns as you go." },
  { tool: "markdown", why: "Interactive by nature — you read the preview as you write." }
];
