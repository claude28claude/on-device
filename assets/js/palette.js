/* ============================================================
   On Device - the command palette

   Ctrl+K (or Cmd+K) opens a search box that finds any tool by
   name, by description, or by what you would actually say -
   "make smaller", "remove location", "iphone photo".
   ============================================================ */

import { TOOLS, getTool } from "./tools.js";
import { el, icon, dialogSupported, announce } from "./ui.js";
import { t } from "./i18n.js";
import * as store from "./store.js";
import { matchScore } from "./search-terms.js";
import { listNames } from "./recipes/names.js";

let dlg = null;
let input = null;
let resultsList = null;
let items = [];
let activeIndex = 0;
let pathPrefix = "";
let openerElement = null;

export function setPathPrefix(prefix) {
  pathPrefix = prefix || "";
}

/* ---- What can be found ---------------------------------- */
function buildIndex() {
  const entries = [];

  for (const tool of TOOLS) {
    entries.push({
      id: tool.id,
      group: "tools",
      name: t(`tool.${tool.id}.name`),
      desc: t(`tool.${tool.id}.desc`),
      keys: t(`tool.${tool.id}.keys`),
      icon: tool.icon,
      built: tool.built,
      phase: tool.phase,
      href: tool.built ? `${pathPrefix}tools/${tool.id}.html` : null
    });
  }

  const pages = [
    { id: "page-home", name: t("nav.tools"), desc: t("home.lede"), icon: "grid", href: `${pathPrefix}index.html`, keys: "home tools start index everything list" },
    { id: "page-trust", name: t("nav.trust"), desc: "The live network monitor and how to check for yourself.", icon: "shield", href: `${pathPrefix}trust.html`, keys: "trust privacy proof network offline check verify safe secure upload prove evidence" },
    { id: "page-settings", name: t("nav.settings"), desc: "Themes, defaults, shortcuts, language.", icon: "settings", href: `${pathPrefix}settings.html`, keys: "settings theme dark light mode preferences options language reset font size accent" },
    { id: "page-roadmap", name: t("nav.roadmap"), desc: "Which tools exist and which are still to come.", icon: "info", href: `${pathPrefix}roadmap.html`, keys: "roadmap progress status phases plan built coming soon what works" },
    { id: "page-help", name: t("nav.help"), desc: "Plain answers to the common questions.", icon: "info", href: `${pathPrefix}help.html`, keys: "help faq questions support guide keyboard shortcuts phone mobile" },
    { id: "page-credits", name: t("nav.credits"), desc: "Every bundled library and its licence.", icon: "package", href: `${pathPrefix}credits.html`, keys: "credits licences libraries open source attribution mit apache" },
    { id: "page-privacy", name: t("nav.privacy"), desc: "We collect nothing. There is no we.", icon: "shield", href: `${pathPrefix}privacy.html`, keys: "privacy policy data collection cookies tracking analytics" },
    { id: "page-recipes", name: t("nav.recipes"), desc: t("recipes.lede"), icon: "sparkle", href: `${pathPrefix}recipes.html`, keys: "recipes recipe chain batch steps automate repeat pipeline bulk many files at once workflow" }
  ];
  for (const p of pages) entries.push({ ...p, group: "pages", built: true });

  /* Your own saved recipes, so a recipe is as findable as a tool. */
  for (const recipe of listNames()) {
    entries.push({
      id: `recipe-${recipe.id}`,
      group: "pages",
      built: true,
      icon: "sparkle",
      name: recipe.name,
      desc: recipe.note ||
        `Your recipe — ${recipe.stepCount} step${recipe.stepCount === 1 ? "" : "s"}.`,
      keys: "recipe saved chain steps run batch",
      href: `${pathPrefix}recipes.html?open=${encodeURIComponent(recipe.id)}`
    });
  }

  return entries;
}

/* ---- Matching ------------------------------------------- */
function score(entry, query) {
  if (!query) return entry.group === "tools" && entry.built ? 2 : 1;
  return matchScore(query, {
    name: entry.name,
    desc: entry.desc,
    keys: entry.keys,
    extra: entry.group === "tools" ? "tool" : "page"
  });
}

function search(query) {
  const all = buildIndex();
  const scored = all
    .map((entry) => ({ entry, s: score(entry, query) }))
    .filter((x) => x.s > 0);
  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    /* Finished tools before unfinished ones. */
    if (a.entry.built !== b.entry.built) return a.entry.built ? -1 : 1;
    return a.entry.name.localeCompare(b.entry.name);
  });
  return scored.slice(0, 40).map((x) => x.entry);
}

/* ---- Rendering ------------------------------------------ */
function render(query) {
  items = search(query);
  activeIndex = 0;
  resultsList.textContent = "";

  if (!items.length) {
    resultsList.append(el("li", { class: "palette-empty", text: t("palette.empty", { q: query }) }));
    input.setAttribute("aria-activedescendant", "");
    return;
  }

  items.forEach((entry, i) => {
    const id = `pal-item-${i}`;
    const node = el(
      entry.href ? "a" : "button",
      {
        class: "p-item",
        id,
        role: "option",
        "aria-selected": i === 0 ? "true" : "false",
        type: entry.href ? null : "button",
        href: entry.href || null,
        onclick: (e) => {
          if (!entry.href) {
            e.preventDefault();
            choose(entry);
          } else {
            recordUse(entry);
          }
        }
      },
      [
        icon(entry.icon, 18),
        el("span", { class: "min0" }, [
          el("span", { class: "p-name", text: entry.name }),
          el("span", { class: "p-desc", text: entry.desc })
        ]),
        entry.built === false
          ? el("span", { class: "badge badge-soon p-cat", text: t("tool.phase", { n: entry.phase }) })
          : el("span", { class: "badge p-cat", text: entry.group === "tools" ? t("tool.ready") : "Page" })
      ]
    );
    resultsList.append(el("li", {}, node));
  });

  input.setAttribute("aria-activedescendant", "pal-item-0");
  announce(`${items.length} result${items.length === 1 ? "" : "s"}.`);
}

function setActive(next) {
  if (!items.length) return;
  const nodes = resultsList.querySelectorAll(".p-item");
  if (!nodes.length) return;
  nodes[activeIndex]?.setAttribute("aria-selected", "false");
  activeIndex = (next + items.length) % items.length;
  const active = nodes[activeIndex];
  active.setAttribute("aria-selected", "true");
  active.scrollIntoView({ block: "nearest" });
  input.setAttribute("aria-activedescendant", active.id);
}

function recordUse(entry) {
  if (entry.group === "tools" && entry.built) store.noteUsed(entry.id);
}

function choose(entry) {
  if (entry.href) {
    recordUse(entry);
    window.location.href = entry.href;
    return;
  }
  /* A tool that is not built yet. Say so rather than doing nothing. */
  close();
  window.dispatchEvent(new CustomEvent("ondevice:show-not-built", { detail: { id: entry.id } }));
}

/* ---- Open and close ------------------------------------- */
export function open() {
  if (!dlg) mount();
  openerElement = document.activeElement;
  input.value = "";
  render("");
  if (dialogSupported()) dlg.showModal();
  else dlg.setAttribute("open", "");
  input.focus();
}

export function close() {
  if (!dlg) return;
  if (dlg.open && dialogSupported()) dlg.close();
  else dlg.removeAttribute("open");
  if (openerElement && document.contains(openerElement)) openerElement.focus();
}

export function isOpen() {
  return Boolean(dlg && dlg.open);
}

function mount() {
  input = el("input", {
    type: "text",
    role: "combobox",
    "aria-expanded": "true",
    "aria-controls": "palette-results",
    "aria-autocomplete": "list",
    "aria-label": t("palette.placeholder"),
    placeholder: t("palette.placeholder"),
    autocomplete: "off",
    spellcheck: "false"
  });

  resultsList = el("ul", { class: "palette-results", id: "palette-results", role: "listbox", "aria-label": t("palette.open") });

  input.addEventListener("input", () => render(input.value.trim()));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(activeIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(items.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[activeIndex]) choose(items[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  dlg = el("dialog", { class: "palette", "aria-label": t("palette.open") }, [
    el("div", { class: "palette-input-row" }, [icon("search", 18), input]),
    resultsList,
    el("div", { class: "palette-foot" }, [
      el("span", {}, [el("kbd", { text: "↑" }), document.createTextNode(" "), el("kbd", { text: "↓" }), document.createTextNode(" " + t("palette.hint.move"))]),
      el("span", {}, [el("kbd", { text: "Enter" }), document.createTextNode(" " + t("palette.hint.choose"))]),
      el("span", {}, [el("kbd", { text: "Esc" }), document.createTextNode(" " + t("palette.hint.close"))])
    ])
  ]);

  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener("click", (e) => {
    /* Clicking the dimmed area outside the box closes it. */
    if (e.target === dlg) close();
  });

  document.body.append(dlg);
}

/* ---- The shortcut --------------------------------------- */
/* The configurable combination lives in shortcuts.js, which owns
   every key the visitor can change. This handles only "/", which is
   fixed, because a single key with no modifier is not something
   worth letting people rebind onto something else. */
export function installShortcut() {
  window.addEventListener("keydown", (e) => {
    const pressedModifier = e.ctrlKey || e.metaKey;
    /* "/" opens it, unless the visitor is typing in a field. */
    if (e.key === "/" && !pressedModifier) {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (document.activeElement && document.activeElement.isContentEditable);
      if (!editing) {
        e.preventDefault();
        open();
      }
    }
  });
}
