/* On Device - homepage start-up */

import { initPage } from "./app.js";
import { mountHome } from "./home.js";

async function start() {
  await initPage({
    pathPrefix: "",
    withDropPanel: document.getElementById("dropzone-host")
  });

  mountHome({
    grid: document.getElementById("tool-grid"),
    chips: document.getElementById("filter-chips"),
    search: document.getElementById("tool-search"),
    viewToggle: document.getElementById("view-toggle"),
    countLabel: document.getElementById("tool-count")
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
