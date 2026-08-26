/* ============================================================
   On Device - shared interface pieces

   Icons, toasts, dialogs, screen-reader announcements, and the
   small formatting helpers used everywhere.
   ============================================================ */

import { t } from "./i18n.js";

/* ---- Element helper ------------------------------------- */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/* ---- Icons ---------------------------------------------- */
/* Simple line drawings, written here rather than downloaded, so
   there is no icon font and no request to anyone else. */
const ICON_PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4",
  x: "M6 6l12 12M18 6L6 18",
  check: "M4 12.5l5 5L20 6.5",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  "arrow-right": "M4 12h15M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  download: "M12 3v12M7 11l5 5 5-5M4 20h16",
  upload: "M12 21V9M7 13l5-5 5 5M4 4h16",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  pin: "M9 3h6l-1 6 4 4H6l4-4z M12 13v8",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7.6v.4",
  alert: "M12 3l9 17H3zM12 9v5M12 17.2v.3",
  "wifi-off": "M3 3l18 18M8.5 15.5a5 5 0 0 1 5.6-.9M5 11.5a10 10 0 0 1 4-2.3M2 8a15 15 0 0 1 5-3.1M17 9.6a10 10 0 0 1 2 1.9M13.6 5a15 15 0 0 1 8.4 3M12 20v.01",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M4.5 12l-1.4-1 1.2-3.4 1.7.3 1.6-1.7-.3-1.7L10.6 3l1 1.4h2.8l1-1.4 3.3 1.5-.3 1.7 1.6 1.7 1.7-.3 1.2 3.4-1.4 1v2l1.4 1-1.2 3.4-1.7-.3-1.6 1.7.3 1.7-3.3 1.5-1-1.4h-2.8l-1 1.4-3.3-1.5.3-1.7-1.6-1.7-1.7.3L3.1 15l1.4-1z",
  "file-text": "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  "file-plus": "M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  "layers-flat": "M3 8l9-5 9 5-9 5zM3 13h18M3 17h18",
  scissors: "M7 5l10 12M17 5L7 17M6 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M18 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  columns: "M4 4h7v16H4zM13 4h7v16h-7z",
  minimize: "M9 4v5H4M15 20v-5h5M4 15h5v5M20 9h-5V4",
  image: "M4 5h16v14H4zM4 16l4.5-4.5L13 16M14 12l2.5-2.5L20 13M9.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  rotate: "M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4",
  hash: "M6 9h13M5 15h13M10 4l-2 16M17 4l-2 16",
  droplet: "M12 3s6 6.4 6 10.4A6 6 0 1 1 6 13.4C6 9.4 12 3 12 3",
  pen: "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14.5 6.5l3 3",
  "square-fill": "M4 5h16v14H4z",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  unlock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1",
  key: "M14.5 5a4.5 4.5 0 1 1-3.2 7.7L4 20H3v-3l1.5-1.5L6 17l2-2-1.5-1.5 4.8-4.8A4.5 4.5 0 0 1 14.5 5",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
  scan: "M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M7 12h10",
  resize: "M4 4h8v8H4zM12 12h8v8h-8zM12 12l8-8M20 4v4M20 4h-4",
  shuffle: "M4 7h4l8 10h4M4 17h4l3-3.5M16 7h4M18 5l2 2-2 2M18 15l2 2-2 2",
  crop: "M7 3v14h14M3 7h14v14",
  "map-pin": "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  "eye-off": "M3 3l18 18M10.6 6.3A9 9 0 0 1 12 6c6 0 9 6 9 6a15 15 0 0 1-3.3 4M6.3 8.3A15 15 0 0 0 3 12s3 6 9 6a9.7 9.7 0 0 0 4-.85M9.9 9.9a3 3 0 0 0 4.2 4.2",
  app: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13v7M13 16.5h7",
  palette: "M12 3a9 9 0 0 0 0 18c1.4 0 2-.9 2-1.8 0-1.4-1.4-1.8-1.4-3 0-.8.7-1.4 1.6-1.4H16a5 5 0 0 0 5-5c0-3.7-4-6.8-9-6.8M7.5 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0M9.9 7.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0M14.3 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  frame: "M3 7h18M3 17h18M7 3v18M17 3v18",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  camera: "M4 7h3.5l1.5-2h6l1.5 2H20v12H4zM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4",
  table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  markdown: "M3 6h18v12H3zM6 15V9l3 3 3-3v6M17 9v5M14.6 12.5L17 15l2.4-2.5",
  package: "M12 3l8 4.2v9.6L12 21l-8-4.2V7.2zM4 7.2l8 4.3 8-4.3M12 11.5V21",
  fingerprint: "M12 4a8 8 0 0 0-8 8v2M20 12a8 8 0 0 0-4-6.9M8 20a12 12 0 0 0 1-5v-3a3 3 0 0 1 6 0v3c0 1.4.2 2.8.6 4M12 12v3.5c0 1.7-.3 3.4-1 5M16.5 18.5A16 16 0 0 0 17 15v-3",
  compare: "M12 3v18M7 7L3 12l4 5M17 7l4 5-4 5",
  film: "M3 5h18v14H3zM3 9h4M3 13h4M17 9h4M17 13h4M7 5v14M17 5v14",
  eraser: "M8 20h12M4.5 15.5l6-6 6 6-4.5 4.5H9zM10.5 9.5l3.5-3.5a2.1 2.1 0 0 1 3 0l3 3a2.1 2.1 0 0 1 0 3l-3.5 3.5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z",
  shield: "M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6zM9 12l2 2 4-4"
};

export function icon(name, size = 18) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const d = ICON_PATHS[name] || ICON_PATHS.info;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  if (name === "square-fill") {
    path.setAttribute("fill", "currentColor");
    path.setAttribute("stroke", "none");
  }
  svg.append(path);
  return svg;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name);
}

/* ---- Screen-reader announcements ------------------------ */
let politeRegion = null;
let assertiveRegion = null;

/* These two empty boxes are what a screen reader watches in order to
   read out something that happened without the page changing around
   it - "3 files finished", "that password was wrong".

   They have to EXIST, and be empty, before the text is put into
   them. A region that appears with its message already inside is
   frequently not announced at all: the screen reader has nothing to
   compare it against and treats it as ordinary new content. That is
   why this is now called once as the page starts rather than at the
   moment of the first announcement. */
export function ensureRegions() {
  if (politeRegion) return;
  politeRegion = el("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
  assertiveRegion = el("div", { class: "sr-only", role: "alert", "aria-live": "assertive", "aria-atomic": "true" });
  document.body.append(politeRegion, assertiveRegion);
}

export function announce(message, urgent = false) {
  ensureRegions();
  const region = urgent ? assertiveRegion : politeRegion;
  /* Clearing first makes screen readers repeat an identical message. */
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 40);
}

/* ---- Toasts --------------------------------------------- */
let toastStack = null;

function ensureToastStack() {
  if (toastStack && document.body.contains(toastStack)) return toastStack;
  toastStack = el("div", { class: "toast-stack" });
  document.body.append(toastStack);
  return toastStack;
}

export function toast(message, { kind = "info", title = "", timeout = 6000 } = {}) {
  const stack = ensureToastStack();
  const closeBtn = el(
    "button",
    { class: "t-close", type: "button", "aria-label": t("action.close") },
    icon("x", 16)
  );
  const node = el("div", { class: "toast", dataset: { kind } }, [
    icon(kind === "error" || kind === "warn" ? "alert" : kind === "ok" ? "check" : "info", 18),
    el("div", { class: "t-text" }, [
      title ? el("strong", { class: "t-title", text: title }) : null,
      el("span", { text: message })
    ]),
    closeBtn
  ]);
  const remove = () => {
    if (node.parentNode) node.remove();
  };
  closeBtn.addEventListener("click", remove);
  stack.append(node);
  announce(title ? `${title}. ${message}` : message, kind === "error");
  if (timeout > 0) window.setTimeout(remove, timeout);
  return remove;
}

/* ---- Dialogs -------------------------------------------- */
export function dialogSupported() {
  return typeof HTMLDialogElement === "function" &&
    typeof HTMLDialogElement.prototype.showModal === "function";
}

/* A modal with a title, body and buttons. Returns a promise that
   resolves with the id of the button pressed, or null if dismissed. */
export function openDialog({ title, body, buttons = [], onClose } = {}) {
  const dlg = el("dialog", { class: "modal", "aria-labelledby": "dlg-title" });
  const closeBtn = el(
    "button",
    { class: "modal-close", type: "button", "aria-label": t("action.close") },
    icon("x", 18)
  );

  const bodyNode = el("div", { class: "modal-body" });
  if (typeof body === "string") bodyNode.append(el("p", { text: body }));
  else if (body) bodyNode.append(body);

  const foot = el("div", { class: "modal-foot" });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      if (dlg.open) dlg.close();
      window.setTimeout(() => dlg.remove(), 0);
      if (onClose) onClose(value);
    };

    for (const b of buttons) {
      foot.append(
        el(
          "button",
          {
            type: "button",
            class: "btn " + (b.class || ""),
            onclick: () => finish(b.id)
          },
          b.label
        )
      );
    }

    closeBtn.addEventListener("click", () => finish(null));
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(null);
    });
    dlg.addEventListener("close", () => finish(null));

    dlg.append(
      el("div", { class: "modal-head" }, [
        el("h2", { id: "dlg-title", text: title }),
        closeBtn
      ]),
      bodyNode,
      buttons.length ? foot : null
    );

    document.body.append(dlg);

    if (dialogSupported()) {
      dlg.showModal();
    } else {
      /* Very old browser: show it inline rather than trapping the visitor. */
      dlg.setAttribute("open", "");
      console.warn("[On Device] This browser has no modal dialog support; showing inline.");
    }

    const firstButton = foot.querySelector("button") || closeBtn;
    firstButton.focus();
  });
}

export async function confirmDestructive({ title, body, confirmLabel, danger = true }) {
  const answer = await openDialog({
    title,
    body,
    buttons: [
      { id: "cancel", label: t("action.cancel"), class: "" },
      { id: "ok", label: confirmLabel || t("action.confirm"), class: danger ? "btn-danger" : "btn-primary" }
    ]
  });
  return answer === "ok";
}

/* ---- Clipboard ------------------------------------------ */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error("Clipboard API unavailable");
  } catch (err) {
    console.warn("[On Device] Copy failed:", err);
    return false;
  }
}

/* ---- Formatting ----------------------------------------- */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* How long something took, as somebody would say it out loud.
   Deliberately separate from formatTime above, which turns a moment
   into a clock reading - passing a duration to that gives you a
   time of day, which is nonsense dressed up as an answer. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms));
  if (total < 1000) return `${total} ms`;
  const seconds = total / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)} seconds`;
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${rest} second${rest === 1 ? "" : "s"}`;
}

/* Escape a string for safe display. We never use innerHTML with
   anything that came from a file or from the visitor, but this is
   here for the rare places a string is put into an attribute. */
export function safeText(value) {
  return String(value === undefined || value === null ? "" : value);
}
