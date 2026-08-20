/* ============================================================
   On Device - colour helpers

   Used to derive the hover, soft and text shades from whichever
   accent colour the visitor picks, and to check that the result
   is still readable.
   ============================================================ */

export function hexToRgb(hex) {
  const clean = String(hex).replace("#", "").trim();
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

export function rgbToHex({ r, g, b }) {
  const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/* Parse whatever a computed CSS value gives us: #hex or rgb(). */
export function parseColour(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (text.startsWith("#")) return hexToRgb(text);
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

/* Relative luminance, as defined by the accessibility guidelines. */
export function luminance({ r, g, b }) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/* How far apart two colours are, from 1 (identical) to 21. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function mix(a, b, amount) {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount
  };
}

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

/* Given an accent and the page background, work out the whole set
   of accent variables so a custom colour never leaves unreadable
   text behind. */
export function accentSet(accentHex, backgroundHex) {
  const accent = hexToRgb(accentHex);
  if (!accent) return null;
  const bg = parseColour(backgroundHex) || WHITE;
  const bgIsDark = luminance(bg) < 0.4;

  /* Text sitting on top of the accent: whichever of white or near-black
     is further from it. */
  const nearBlack = { r: 8, g: 14, b: 24 };
  const onAccent = contrastRatio(accent, WHITE) >= contrastRatio(accent, nearBlack)
    ? WHITE
    : nearBlack;

  const hover = bgIsDark ? mix(accent, WHITE, 0.22) : mix(accent, BLACK, 0.2);
  const soft = mix(bg, accent, bgIsDark ? 0.16 : 0.1);
  const line = mix(bg, accent, bgIsDark ? 0.42 : 0.32);

  return {
    accent: rgbToHex(accent),
    accentHover: rgbToHex(hover),
    accentFg: rgbToHex(onAccent),
    accentSoft: rgbToHex(soft),
    accentLine: rgbToHex(line),
    /* Reported so the Settings page can warn about a poor choice. */
    contrastOnBackground: contrastRatio(accent, bg),
    contrastOnAccent: contrastRatio(accent, onAccent)
  };
}
