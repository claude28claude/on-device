/* ============================================================
   On Device - the tool registry

   One entry per tool. Names and descriptions are NOT here - they
   live in the language files so they can be translated. This file
   holds only what the app needs to reason about: which category a
   tool belongs to, which kinds of file it accepts, which build
   phase it arrives in, and whether it is actually finished.

   "built: false" means the tool is not written yet. The homepage
   says so plainly rather than pretending.
   ============================================================ */

export const CATEGORIES = [
  { id: "pdf", icon: "file-text" },
  { id: "image", icon: "image" },
  { id: "data", icon: "table" },
  { id: "files", icon: "package" }
];

/* File kinds used for matching a dropped file to the tools that
   can handle it. See sniff.js for how a file is identified. */
export const KINDS = ["pdf", "image", "heic", "zip", "text", "csv", "json", "sheet", "audio", "video", "any"];

export const TOOLS = [
  /* ---- PDF ---------------------------------------------- */
  { id: "pdf-merge",           cat: "pdf",   phase: 3, built: true , icon: "layers",      accepts: ["pdf", "image"] },
  { id: "pdf-split",           cat: "pdf",   phase: 3, built: true , icon: "scissors",    accepts: ["pdf"] },
  { id: "pdf-organise",        cat: "pdf",   phase: 3, built: true , icon: "grid",        accepts: ["pdf"] },
  { id: "pdf-compress",        cat: "pdf",   phase: 4, built: true , icon: "minimize",    accepts: ["pdf"] },
  { id: "pdf-to-images",       cat: "pdf",   phase: 3, built: true , icon: "image",       accepts: ["pdf"] },
  { id: "images-to-pdf",       cat: "pdf",   phase: 3, built: true , icon: "file-plus",   accepts: ["image", "heic"] },
  { id: "pdf-rotate-crop",     cat: "pdf",   phase: 3, built: true , icon: "rotate",      accepts: ["pdf"] },
  { id: "pdf-page-numbers",    cat: "pdf",   phase: 4, built: true , icon: "hash",        accepts: ["pdf"] },
  { id: "pdf-watermark",       cat: "pdf",   phase: 4, built: true , icon: "droplet",     accepts: ["pdf"] },
  { id: "pdf-fill-sign",       cat: "pdf",   phase: 5, built: false, icon: "pen",         accepts: ["pdf"] },
  { id: "pdf-redact",          cat: "pdf",   phase: 5, built: false, icon: "square-fill", accepts: ["pdf"] },
  { id: "pdf-metadata",        cat: "pdf",   phase: 4, built: true , icon: "info",        accepts: ["pdf"] },
  { id: "pdf-password-add",    cat: "pdf",   phase: 4, built: true , icon: "lock",        accepts: ["pdf"] },
  { id: "pdf-password-remove", cat: "pdf",   phase: 4, built: true , icon: "unlock",      accepts: ["pdf"] },
  { id: "pdf-extract-text",    cat: "pdf",   phase: 7, built: false, icon: "type",        accepts: ["pdf"] },
  { id: "pdf-ocr",             cat: "pdf",   phase: 7, built: false, icon: "scan",        accepts: ["pdf", "image"] },
  { id: "pdf-nup",             cat: "pdf",   phase: 4, built: true , icon: "columns",     accepts: ["pdf"] },
  { id: "pdf-flatten",         cat: "pdf",   phase: 4, built: true , icon: "layers-flat", accepts: ["pdf"] },

  /* ---- Images ------------------------------------------- */
  { id: "image-resize",        cat: "image", phase: 2, built: true , icon: "resize",      accepts: ["image", "heic"] },
  { id: "image-convert",       cat: "image", phase: 2, built: true , icon: "shuffle",     accepts: ["image", "heic"] },
  { id: "image-compress",      cat: "image", phase: 2, built: true , icon: "minimize",    accepts: ["image", "heic"] },
  { id: "image-crop",          cat: "image", phase: 2, built: true , icon: "crop",        accepts: ["image", "heic"] },
  { id: "image-rotate",        cat: "image", phase: 2, built: true , icon: "rotate",      accepts: ["image", "heic"] },
  { id: "image-metadata",      cat: "image", phase: 2, built: true , icon: "map-pin",     accepts: ["image", "heic"] },
  { id: "image-blur",          cat: "image", phase: 5, built: false, icon: "eye-off",     accepts: ["image", "heic"] },
  { id: "image-watermark",     cat: "image", phase: 4, built: false, icon: "droplet",     accepts: ["image", "heic"] },
  { id: "image-combine",       cat: "image", phase: 6, built: false, icon: "grid",        accepts: ["image", "heic"] },
  { id: "icon-generator",      cat: "image", phase: 6, built: false, icon: "app",         accepts: ["image"] },
  { id: "colour-palette",      cat: "image", phase: 6, built: false, icon: "palette",     accepts: ["image", "heic"] },
  { id: "screenshot-polish",   cat: "image", phase: 6, built: false, icon: "frame",       accepts: ["image"] },

  /* ---- Documents, data and text ------------------------- */
  { id: "qr-generate",         cat: "data",  phase: 6, built: false, icon: "qr",          accepts: [] },
  { id: "qr-read",             cat: "data",  phase: 6, built: false, icon: "camera",      accepts: ["image"] },
  { id: "text-workbench",      cat: "data",  phase: 6, built: false, icon: "type",        accepts: ["text"] },
  { id: "spreadsheet",         cat: "data",  phase: 6, built: false, icon: "table",       accepts: ["csv", "json", "sheet"] },
  { id: "markdown",            cat: "data",  phase: 6, built: false, icon: "markdown",    accepts: ["text"] },

  /* ---- File utilities ----------------------------------- */
  { id: "zip",                 cat: "files", phase: 6, built: false, icon: "package",     accepts: ["any"] },
  { id: "checksum",            cat: "files", phase: 6, built: false, icon: "fingerprint", accepts: ["any"] },
  { id: "file-lock",           cat: "files", phase: 5, built: false, icon: "key",         accepts: ["any"] },
  { id: "file-compare",        cat: "files", phase: 6, built: false, icon: "compare",     accepts: ["any"] },

  /* ---- Optional, last ----------------------------------- */
  { id: "media-toolkit",       cat: "files", phase: 11, built: false, icon: "film",       accepts: ["audio", "video"], optional: true },
  { id: "background-remover",  cat: "image", phase: 11, built: false, icon: "eraser",     accepts: ["image"], optional: true }
];

export const TOOLS_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

export function getTool(id) {
  return TOOLS_BY_ID.get(id) || null;
}

/* Where a tool's page lives. Tools that are not built yet have no page. */
export function toolHref(tool, fromRoot = true) {
  if (!tool.built) return null;
  return (fromRoot ? "tools/" : "") + tool.id + ".html";
}

/* Which tools can handle a file of this kind? */
export function toolsForKind(kind) {
  if (!kind) return [];
  return TOOLS.filter((t) => {
    if (!t.accepts.length) return false;
    if (t.accepts.includes("any")) return true;
    if (t.accepts.includes(kind)) return true;
    /* A HEIC photo is still a photo: image tools accept it. */
    if (kind === "heic" && t.accepts.includes("image")) return true;
    /* CSV and JSON are text as far as the text tools are concerned. */
    if ((kind === "csv" || kind === "json") && t.accepts.includes("text")) return true;
    return false;
  });
}

export const BUILT_COUNT = TOOLS.filter((t) => t.built).length;
export const TOTAL_COUNT = TOOLS.length;
