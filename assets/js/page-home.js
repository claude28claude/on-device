/* On Device - homepage start-up */

import { initPage } from "./app.js";
import { mountHome } from "./home.js";
import * as store from "./store.js";
import { getTool } from "./tools.js";

/* Somebody who only ever uses one tool can have the homepage step
   out of the way. It happens before anything else is drawn, so there
   is no flash of a page they did not want.

   It fires ONCE per browser session, and that matters: this site
   sends no referrer by design, so there is no way to tell "I typed
   the address" from "I pressed Tools in the menu". Without the
   once-only rule, pressing Tools would bounce you straight back into
   the tool and you could never reach the homepage again to turn the
   setting off. Coming back to the homepage a second time is taken as
   meaning you wanted the homepage. */
const JUMPED_KEY = "ondevice.jumpedHome";

function openStraightIntoTool() {
  if (store.get("layout.homeOpensTo", "all") !== "tool") return false;

  const id = store.get("layout.homeTool", "");
  const tool = getTool(id);
  if (!tool || !tool.built) return false;

  /* An explicit "let me see the homepage" always wins. */
  if (new URLSearchParams(location.search).has("stay")) return false;

  try {
    if (window.sessionStorage.getItem(JUMPED_KEY)) return false;
    window.sessionStorage.setItem(JUMPED_KEY, "1");
  } catch (err) {
    /* No session storage means no way to remember that we already
       jumped, and a jump we cannot undo is a trap. So we do not
       jump at all. */
    console.warn("[On Device] Cannot remember the homepage jump, so it is skipped.", err);
    return false;
  }

  location.replace(`tools/${tool.id}.html`);
  return true;
}

async function start() {
  if (openStraightIntoTool()) return;

  await initPage({
    pathPrefix: "",
    withDropPanel: document.getElementById("dropzone-host")
  });

  mountHome({
    grid: document.getElementById("tool-grid"),
    chips: document.getElementById("filter-chips"),
    search: document.getElementById("tool-search"),
    viewToggle: document.getElementById("view-toggle"),
    countLabel: document.getElementById("tool-count"),
    sidebar: document.getElementById("tool-sidebar")
  });
}

start().catch((err) => {
  console.error("[On Device] The homepage failed to start:", err);
  const host = document.querySelector("main .wrap");
  if (host) {
    const box = document.createElement("div");
    box.className = "note note-danger";
    const title = document.createElement("strong");
    title.className = "note-title";
    title.textContent = "This page did not start correctly";
    const body = document.createElement("p");
    body.textContent =
      "The error was: " + (err && err.message ? err.message : String(err)) +
      ". Nothing was sent anywhere. Reloading may fix it; if not, please report it.";
    box.append(title, body);
    host.prepend(box);
  }
});
