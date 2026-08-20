/* ============================================================
   On Device - the homepage tool grid
   ============================================================ */

import { TOOLS, CATEGORIES, getTool } from "./tools.js";
import * as store from "./store.js";
import { el, icon, announce } from "./ui.js";
import { t } from "./i18n.js";
import { matchScore } from "./search-terms.js";
import { showNotBuilt } from "./app.js";

let query = "";
let filter = "all";          /* all | pinned | recent | ready | <category id> */
let gridHost = null;
let searchInput = null;

/* ---- Matching ------------------------------------------- */
function matches(tool) {
  if (!query) return true;
  return matchScore(query, {
    name: t(`tool.${tool.id}.name`),
    desc: t(`tool.${tool.id}.desc`),
    keys: t(`tool.${tool.id}.keys`),
    extra: t(`cat.${tool.cat}`)
  }) > 0;
}

function visibleTools() {
  const hidden = store.get("layout.hidden", []);
  const pinned = store.get("layout.pinned", []);
  const recent = store.getRecent();

  let list = TOOLS.filter((tool) => !hidden.includes(tool.id)).filter(matches);

  if (filter === "pinned") list = list.filter((x) => pinned.includes(x.id));
  else if (filter === "recent") list = list.filter((x) => recent.includes(x.id));
  else if (filter === "ready") list = list.filter((x) => x.built);
  else if (filter !== "all") list = list.filter((x) => x.cat === filter);

  return list;
}

/* ---- One card ------------------------------------------- */
function toolCard(tool) {
  const name = t(`tool.${tool.id}.name`);
  const renamed = store.get("layout.renames", {})[tool.id];
  const label = renamed || name;
  const pinned = store.isPinned(tool.id);

  const body = el("span", { class: "tool-body" }, [
    el("span", { class: "tool-icon" }, icon(tool.icon, 17)),
    el("span", { class: "min0" }, [
      el("span", { class: "tool-name", text: label }),
      el("span", { class: "tool-desc", text: t(`tool.${tool.id}.desc`) })
    ])
  ]);

  const foot = el("span", { class: "tool-foot" }, [
    tool.built
      ? el("span", { class: "badge badge-ready", text: t("tool.ready") })
      : el("span", { class: "badge badge-soon" }, [
          document.createTextNode(t("tool.notBuilt") + " · " + t("tool.phase", { n: tool.phase }))
        ]),
    tool.optional ? el("span", { class: "badge", text: "Optional" }) : null
  ]);

  const card = tool.built
    ? el(
        "a",
        {
          class: "tool-card",
          href: `tools/${tool.id}.html`,
          dataset: { built: "yes" },
          onclick: () => store.noteUsed(tool.id)
        },
        [body, foot]
      )
    : el(
        "button",
        {
          class: "tool-card",
          type: "button",
          dataset: { built: "no" },
          onclick: () => showNotBuilt(tool.id)
        },
        [body, foot]
      );

  const pin = el(
    "button",
    {
      class: "pin-btn",
      type: "button",
      "aria-pressed": String(pinned),
      "aria-label": pinned ? t("tool.unpin", { name: label }) : t("tool.pin", { name: label }),
      onclick: (e) => {
        e.stopPropagation();
        const nowPinned = store.togglePin(tool.id);
        announce(nowPinned ? `${label} pinned.` : `${label} unpinned.`);
        render();
      }
    },
    icon("pin", 15)
  );

  return el("li", { class: "tool-item" }, [card, pin]);
}

/* ---- Sections ------------------------------------------- */
function section(titleText, tools, countText) {
  if (!tools.length) return null;
  const ul = el("ul", { class: "tool-grid" });
  for (const tool of tools) ul.append(toolCard(tool));
  return el("section", { class: "tool-section" }, [
    el("div", { class: "tool-section-head" }, [
      el("h2", { text: titleText }),
      el("span", { class: "count", text: countText || t("cat.count", { n: tools.length }) })
    ]),
    ul
  ]);
}

/* ---- Render --------------------------------------------- */
export function render() {
  if (!gridHost) return;
  const list = visibleTools();
  gridHost.textContent = "";

  if (!list.length) {
    gridHost.append(
      el("div", { class: "empty-state" }, [
        el("p", { text: t("home.empty.title") }),
        el("p", { class: "text-sm", text: t("home.empty.body") }),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: () => {
              query = "";
              filter = "all";
              if (searchInput) searchInput.value = "";
              syncChips();
              render();
              if (searchInput) searchInput.focus();
            }
          },
          t("home.empty.clear")
        )
      ])
    );
    announce(t("home.empty.title"));
    return;
  }

  const pinnedIds = store.get("layout.pinned", []);
  const recentIds = store.getRecent();
  const showExtras = filter === "all" && !query;

  if (showExtras) {
    const pinnedTools = pinnedIds.map(getTool).filter(Boolean);
    const pinnedSection = section(t("home.section.pinned"), pinnedTools);
    if (pinnedSection) gridHost.append(pinnedSection);

    const recentTools = recentIds.map(getTool).filter(Boolean).slice(0, 6);
    const recentSection = section(t("home.section.recent"), recentTools);
    if (recentSection) gridHost.append(recentSection);
  }

  for (const cat of CATEGORIES) {
    const inCat = list.filter((x) => x.cat === cat.id);
    const node = section(t(`cat.${cat.id}`), inCat);
    if (node) gridHost.append(node);
  }

  announce(`${list.length} tools shown.`);
}

/* ---- Chips ---------------------------------------------- */
let chipHost = null;

function syncChips() {
  if (!chipHost) return;
  for (const btn of chipHost.querySelectorAll(".chip")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.filter === filter));
  }
}

function buildChips() {
  const options = [
    { id: "all", label: t("home.filter.all") },
    { id: "ready", label: t("home.filter.ready") },
    { id: "pinned", label: t("home.filter.pinned") },
    { id: "recent", label: t("home.filter.recent") },
    ...CATEGORIES.map((c) => ({ id: c.id, label: t(`cat.${c.id}`) }))
  ];
  chipHost.textContent = "";
  for (const opt of options) {
    chipHost.append(
      el(
        "button",
        {
          class: "chip",
          type: "button",
          "aria-pressed": String(filter === opt.id),
          dataset: { filter: opt.id },
          onclick: () => {
            filter = opt.id;
            syncChips();
            render();
          }
        },
        opt.label
      )
    );
  }
}

/* ---- Set-up --------------------------------------------- */
export function mountHome({ grid, chips, search, viewToggle, countLabel }) {
  gridHost = grid;
  chipHost = chips;
  searchInput = search;

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim();
      render();
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && searchInput.value) {
        e.preventDefault();
        searchInput.value = "";
        query = "";
        render();
      }
    });
  }

  if (chipHost) buildChips();

  if (viewToggle) {
    const current = store.get("layout.view", "grid");
    document.documentElement.setAttribute("data-view", current);
    for (const btn of viewToggle.querySelectorAll("button")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.view === current));
      btn.addEventListener("click", () => {
        store.set("layout.view", btn.dataset.view);
        document.documentElement.setAttribute("data-view", btn.dataset.view);
        for (const other of viewToggle.querySelectorAll("button")) {
          other.setAttribute("aria-pressed", String(other === btn));
        }
        announce(btn.dataset.view === "grid" ? t("home.view.grid") : t("home.view.list"));
      });
    }
  }

  if (countLabel) {
    const built = TOOLS.filter((x) => x.built).length;
    countLabel.textContent = t("home.count", { built, total: TOOLS.length });
  }

  /* Open to pinned tools if that is what the visitor chose. */
  if (store.get("layout.homeOpensTo", "all") === "favourites" &&
      store.get("layout.pinned", []).length) {
    filter = "pinned";
    syncChips();
  }

  render();
}
