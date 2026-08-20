/* ============================================================
   On Device - the picture tools that build something new

   Watermarking, stitching several images together, generating the
   whole set of icon sizes a site or app needs, pulling the main
   colours out of a picture, and tidying up a screenshot.

   All canvas work, all on this device.
   ============================================================ */

import { makeCanvas, toBlob, releaseCanvas, normalise } from "./ops.js";
import { decodeImage } from "./decode.js";

/* Decode a file straight to a canvas the right way up. */
export async function toCanvas(file, format) {
  const decoded = await decodeImage(file, format);
  try {
    return normalise(decoded.bitmap, decoded.orientation, decoded.orientationApplied);
  } finally {
    decoded.bitmap.close();
  }
}

/* ---- Watermark ------------------------------------------ */
export function watermarkCanvas(canvas, {
  text = "",
  logo = null,
  opacity = 0.35,
  size = 0.06,
  colour = "#ffffff",
  position = "bottom-right",
  rotation = 0,
  tile = false,
  margin = 0.03
} = {}) {
  const ctx = canvas.getContext("2d");
  const shortest = Math.min(canvas.width, canvas.height);
  const pad = shortest * margin;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.02, opacity));

  const drawAt = (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);

    if (logo) {
      const width = shortest * size * 6;
      const height = (logo.height / logo.width) * width;
      ctx.drawImage(logo, -width / 2, -height / 2, width, height);
    } else {
      const fontSize = shortest * size;
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillStyle = colour;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      /* A dark outline so pale text stays readable on a pale photo. */
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeText(text, 0, 0);
      ctx.fillText(text, 0, 0);
    }
    ctx.restore();
  };

  if (tile) {
    const stepX = canvas.width / 3;
    const stepY = canvas.height / 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        drawAt(stepX * (col + 0.5), stepY * (row + 0.5));
      }
    }
  } else {
    const spots = {
      centre: [canvas.width / 2, canvas.height / 2],
      "top-left": [pad + shortest * size * 2, pad + shortest * size],
      "top-right": [canvas.width - pad - shortest * size * 2, pad + shortest * size],
      "bottom-left": [pad + shortest * size * 2, canvas.height - pad - shortest * size],
      "bottom-right": [canvas.width - pad - shortest * size * 2, canvas.height - pad - shortest * size]
    };
    const [x, y] = spots[position] || spots["bottom-right"];
    drawAt(x, y);
  }

  ctx.restore();
  return canvas;
}

/* ---- Combining several pictures -------------------------- */
/* layout: "grid" | "row" | "column" */
export function combine(canvases, {
  layout = "grid",
  columns = 0,
  gap = 12,
  background = "#ffffff",
  cellWidth = 0
} = {}) {
  if (!canvases.length) throw new Error("There are no pictures to combine.");

  /* Everything is scaled to a common width so the sheet looks tidy. */
  const target = cellWidth || Math.min(...canvases.map((c) => c.width));
  const scaled = canvases.map((c) => ({
    canvas: c,
    width: target,
    height: Math.round((c.height / c.width) * target)
  }));

  let cols;
  if (layout === "row") cols = scaled.length;
  else if (layout === "column") cols = 1;
  else cols = columns || Math.ceil(Math.sqrt(scaled.length));

  const rows = Math.ceil(scaled.length / cols);

  /* Each row is as tall as its tallest picture. */
  const rowHeights = [];
  for (let r = 0; r < rows; r++) {
    const slice = scaled.slice(r * cols, (r + 1) * cols);
    rowHeights.push(slice.length ? Math.max(...slice.map((s) => s.height)) : 0);
  }

  const width = cols * target + gap * (cols + 1);
  const height = rowHeights.reduce((n, h) => n + h, 0) + gap * (rows + 1);

  const out = makeCanvas(width, height);
  const ctx = out.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";

  let y = gap;
  for (let r = 0; r < rows; r++) {
    let x = gap;
    for (let c = 0; c < cols; c++) {
      const item = scaled[r * cols + c];
      if (!item) break;
      ctx.drawImage(item.canvas, x, y, item.width, item.height);
      x += target + gap;
    }
    y += rowHeights[r] + gap;
  }

  return out;
}

/* ---- Icons ---------------------------------------------- */
export const ICON_SIZES = [
  { size: 16, note: "Browser tab" },
  { size: 32, note: "Browser tab, sharper screens" },
  { size: 48, note: "Windows" },
  { size: 64, note: "General" },
  { size: 128, note: "General" },
  { size: 180, note: "Apple touch icon" },
  { size: 192, note: "Android home screen" },
  { size: 256, note: "General" },
  { size: 512, note: "App stores and splash screens" }
];

export async function makeIcons(canvas, { background = null, maskable = false } = {}) {
  const out = [];
  for (const { size, note } of ICON_SIZES) {
    const target = makeCanvas(size, size);
    const ctx = target.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }

    /* Maskable icons get cropped to a circle by some launchers, so the
       artwork sits inside the middle 80%. */
    const inset = maskable ? size * 0.1 : 0;
    const box = size - inset * 2;
    const scale = Math.min(box / canvas.width, box / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    ctx.drawImage(canvas, (size - w) / 2, (size - h) / 2, w, h);

    const blob = await toBlob(target, "png");
    releaseCanvas(target);
    out.push({ size, note, blob, name: `icon-${size}.png` });
  }
  return out;
}

export function manifestSnippet() {
  const icons = ICON_SIZES.filter((i) => i.size >= 192).map((i) =>
    `    { "src": "icon-${i.size}.png", "sizes": "${i.size}x${i.size}", "type": "image/png" }`
  );
  return `"icons": [\n${icons.join(",\n")}\n  ]`;
}

export function faviconHtml() {
  return [
    '<link rel="icon" href="icon-32.png" sizes="32x32">',
    '<link rel="icon" href="icon-192.png" sizes="192x192">',
    '<link rel="apple-touch-icon" href="icon-180.png">'
  ].join("\n");
}

/* ---- Pulling out the main colours ------------------------ */
/* Groups similar colours together and reports the biggest groups.
   Deliberately simple and predictable rather than clever. */
export function extractPalette(canvas, { count = 6 } = {}) {
  const width = Math.min(canvas.width, 240);
  const height = Math.max(1, Math.round((canvas.height / canvas.width) * width));
  const small = makeCanvas(width, height);
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  /* Round each colour into a coarse bucket so near-identical shades
     count as the same colour. */
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { r: 0, g: 0, b: 0, n: 0 };
      buckets.set(key, bucket);
    }
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n++;
  }

  releaseCanvas(small);

  const total = Array.from(buckets.values()).reduce((n, b) => n + b.n, 0) || 1;
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((b) => {
      const r = Math.round(b.r / b.n);
      const g = Math.round(b.g / b.n);
      const bl = Math.round(b.b / b.n);
      const hex = `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      return {
        hex,
        rgb: `rgb(${r}, ${g}, ${bl})`,
        share: Math.round((b.n / total) * 1000) / 10,
        r,
        g,
        b: bl
      };
    });

  return sorted;
}

/* ---- Screenshot polish ---------------------------------- */
export function polish(canvas, {
  padding = 0.08,
  radius = 0.02,
  shadow = true,
  background = "#e9edf5",
  gradient = false,
  gradientTo = "#c7d4ee"
} = {}) {
  const shortest = Math.min(canvas.width, canvas.height);
  const pad = Math.round(shortest * padding);
  const width = canvas.width + pad * 2;
  const height = canvas.height + pad * 2;

  const out = makeCanvas(width, height);
  const ctx = out.getContext("2d");

  if (gradient) {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, background);
    g.addColorStop(1, gradientTo);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = background;
  }
  ctx.fillRect(0, 0, width, height);

  const r = Math.round(shortest * radius);

  if (shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(15, 20, 35, 0.34)";
    ctx.shadowBlur = Math.round(pad * 0.7);
    ctx.shadowOffsetY = Math.round(pad * 0.22);
    roundedPath(ctx, pad, pad, canvas.width, canvas.height, r);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundedPath(ctx, pad, pad, canvas.width, canvas.height, r);
  ctx.clip();
  ctx.drawImage(canvas, pad, pad);
  ctx.restore();

  return out;
}

function roundedPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
