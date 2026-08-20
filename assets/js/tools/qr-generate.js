/* On Device - Make a QR code */

import { initPage } from "../app.js";
import * as tray from "../tray.js";
import { encodeQr, qrToCanvas, qrToSvg, wifiString, contactString, emailString } from "../qr.js";
import { contrastRatio, hexToRgb } from "../colour.js";
import { el, toast, announce } from "../ui.js";

const $ = (id) => document.getElementById(id);
let currentCode = null;
let currentText = "";

async function start() {
  await initPage({ pathPrefix: "../" });

  /* This tool needs no file, so the file area explains itself instead. */
  $("files-host").innerHTML = "";
  $("files-host").append(
    el("div", { class: "note note-accent" }, [
      el("strong", { class: "note-title", text: "No file needed" }),
      el("p", {
        class: "mb-0",
        text:
          "Type what the code should contain and it appears below as you go. " +
          "Nothing is sent anywhere — the code is drawn here."
      })
    ])
  );

  const inputs = [
    "kind", "value", "wifi-ssid", "wifi-password", "wifi-security",
    "c-name", "c-phone", "c-email", "c-org",
    "e-to", "e-subject", "e-body",
    "level", "scale", "margin", "dark", "light"
  ];
  for (const id of inputs) {
    const node = $(id);
    if (!node) continue;
    node.addEventListener("input", refresh);
    node.addEventListener("change", refresh);
  }

  $("kind").addEventListener("change", syncKind);
  $("save-png").addEventListener("click", savePng);
  $("save-svg").addEventListener("click", saveSvg);
  $("run-button").addEventListener("click", savePng);

  syncKind();
  refresh();
}

function syncKind() {
  const kind = $("kind").value;
  for (const group of document.querySelectorAll("[data-kind]")) {
    const kinds = group.dataset.kind.split(" ");
    group.hidden = !kinds.includes(kind);
  }
  const labels = {
    text: "Contents", url: "The web address", phone: "The phone number"
  };
  const label = document.querySelector('[data-kind~="text"] label');
  if (label && labels[kind]) label.textContent = labels[kind];
  refresh();
}

function buildText() {
  const kind = $("kind").value;
  if (kind === "wifi") {
    return wifiString({
      ssid: $("wifi-ssid").value,
      password: $("wifi-password").value,
      security: $("wifi-security").value
    });
  }
  if (kind === "contact") {
    return contactString({
      name: $("c-name").value,
      phone: $("c-phone").value,
      email: $("c-email").value,
      organisation: $("c-org").value
    });
  }
  if (kind === "email") {
    return emailString({
      to: $("e-to").value,
      subject: $("e-subject").value,
      body: $("e-body").value
    });
  }
  if (kind === "phone") {
    const v = $("value").value.trim();
    return v ? `tel:${v}` : "";
  }
  if (kind === "url") {
    const v = $("value").value.trim();
    if (!v) return "";
    /* A bare domain is almost never what someone means. */
    return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  }
  return $("value").value;
}

function refresh() {
  const host = $("extra-host");
  const text = buildText();
  currentText = text;

  const dark = $("dark").value;
  const light = $("light").value;
  const ratio = contrastRatio(hexToRgb(dark) || { r: 0, g: 0, b: 0 }, hexToRgb(light) || { r: 255, g: 255, b: 255 });
  $("contrast-warning").textContent = ratio < 4
    ? `These two colours are only ${ratio.toFixed(1)} to 1 apart. Scanners need strong ` +
      `contrast and many will refuse this. Aim for at least 4 to 1, and keep the dark ` +
      `colour genuinely dark.`
    : `Contrast ${ratio.toFixed(1)} to 1 — plenty for a scanner.`;

  if (!text.trim()) {
    host.textContent = "";
    host.append(el("p", { class: "muted", text: "Type something and the code appears here." }));
    currentCode = null;
    $("run-button").disabled = true;
    $("size-hint").textContent = "";
    return;
  }

  try {
    const code = encodeQr(text, { level: $("level").value });
    currentCode = code;

    const scale = Number($("scale").value);
    const margin = Number($("margin").value);
    const canvas = document.createElement("canvas");
    qrToCanvas(code, { scale, margin, dark, light, canvas });
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `QR code containing: ${text.slice(0, 80)}`);
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.imageRendering = "pixelated";

    $("size-hint").textContent =
      `${canvas.width} by ${canvas.height} pixels. Version ${code.version}, ` +
      `${code.size} modules across.`;

    host.textContent = "";
    host.append(
      el("div", { class: "panel" }, [
        el("h2", { class: "h-lg", text: "Your code" }),
        canvas,
        el("p", {
          class: "field-hint",
          text:
            `${code.byteLength} bytes encoded at error-correction level ${code.level}. ` +
            `Point a phone camera at it to check it before you use it — that is the ` +
            `only test that counts.`
        }),
        el("details", {}, [
          el("summary", { text: "What is actually in the code" }),
          el("pre", {}, el("code", { text: text }))
        ])
      ])
    );
    $("run-button").disabled = false;
  } catch (err) {
    host.textContent = "";
    host.append(
      el("div", { class: "note note-warn" }, [
        el("strong", { class: "note-title", text: "That will not fit" }),
        el("p", { class: "mb-0", text: err && err.message ? err.message : String(err) })
      ])
    );
    currentCode = null;
    $("run-button").disabled = true;
  }
}

async function savePng() {
  if (!currentCode) return;
  const canvas = document.createElement("canvas");
  qrToCanvas(currentCode, {
    scale: Number($("scale").value),
    margin: Number($("margin").value),
    dark: $("dark").value,
    light: $("light").value,
    canvas
  });
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  await tray.addResult({ blob, name: makeName("png"), fromTool: "QR code" });
  toast("Saved to the results tray. Scan it with a phone to check it before you use it.", {
    kind: "ok",
    title: "Done",
    timeout: 9000
  });
  announce("QR code saved.");
}

async function saveSvg() {
  if (!currentCode) return;
  const svg = qrToSvg(currentCode, {
    margin: Number($("margin").value),
    dark: $("dark").value,
    light: $("light").value
  });
  const blob = new Blob([svg], { type: "image/svg+xml" });
  await tray.addResult({ blob, name: makeName("svg"), fromTool: "QR code" });
  toast("Saved as SVG, which stays sharp at any size.", { kind: "ok", title: "Done" });
}

function makeName(extension) {
  const kind = $("kind").value;
  const base = kind === "wifi"
    ? ($("wifi-ssid").value || "wifi")
    : kind === "contact"
      ? ($("c-name").value || "contact")
      : currentText.replace(/^https?:\/\//, "").slice(0, 24) || "qr-code";
  return `${base.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "qr-code"}.${extension}`;
}

start().catch((err) => {
  console.error("[On Device] The QR tool failed to start:", err);
});
