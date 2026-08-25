/* On Device - the Trust page */

import { initPage } from "./app.js";
import {
  el,
  formatBytes,
  formatTime,
  toast,
  confirmDestructive,
  announce
} from "./ui.js";
import * as idb from "./idb.js";
import * as store from "./store.js";
import * as workspace from "./workspace.js";
import * as tray from "./tray.js";
import { t } from "./i18n.js";

const guard = window.OnDeviceNetGuard;

/* ---- The three numbers ---------------------------------- */
function renderStats(snapshot) {
  const host = document.getElementById("monitor-stats");
  if (!host) return;
  host.textContent = "";

  const external = snapshot.externalRequests;
  const blocked = snapshot.blockedAttempts;

  host.append(
    el("div", { class: "stat", dataset: { tone: external === 0 ? "ok" : "bad" } }, [
      el("span", { class: "stat-value", text: String(external) }),
      el("span", { class: "stat-label", text: t("trust.stat.external") })
    ]),
    el("div", { class: "stat", dataset: { tone: blocked === 0 ? "ok" : "bad" } }, [
      el("span", { class: "stat-value", text: String(blocked) }),
      el("span", {
        class: "stat-label",
        text: snapshot.testAttempts
          ? t("trust.stat.blocked") + ` (not counting ${snapshot.testAttempts} you triggered with the button below)`
          : t("trust.stat.blocked")
      })
    ]),
    el("div", { class: "stat" }, [
      el("span", { class: "stat-value", text: String(snapshot.ownRequests) }),
      el("span", { class: "stat-label", text: t("trust.stat.own") })
    ]),
    el("div", { class: "stat" }, [
      el("span", {
        class: "stat-value",
        text: snapshot.bytes === 0 && snapshot.ownRequests > 0 ? "none" : formatBytes(snapshot.bytes)
      }),
      el("span", {
        class: "stat-label",
        text: snapshot.bytes === 0 && snapshot.ownRequests > 0
          ? "Downloaded since you opened this page — every file came from the copy already on this device"
          : "Downloaded from this site since you opened this page"
      })
    ])
  );
}

/* ---- The full log --------------------------------------- */
function renderLog(snapshot) {
  const body = document.getElementById("log-body");
  const note = document.getElementById("log-note");
  if (!body) return;
  body.textContent = "";

  if (!snapshot.resources.length) {
    body.append(
      el("tr", {}, el("td", { colspan: "4", class: "muted", text: t("trust.log.empty") }))
    );
  }

  for (const r of snapshot.resources) {
    body.append(
      el("tr", {}, [
        el("td", { class: "mono", text: r.shortUrl }),
        el("td", { text: r.type }),
        el("td", { text: r.bytes ? formatBytes(r.bytes) : "from cache" }),
        el("td", {}, el("span", {
          class: "origin-tag",
          dataset: { external: String(r.external) },
          text: r.external ? t("trust.log.external") : t("trust.log.own")
        }))
      ])
    );
  }

  for (const b of snapshot.blocked) {
    body.append(
      el("tr", {}, [
        el("td", { class: "mono", text: b.url }),
        el("td", { text: b.kind }),
        el("td", { text: b.deliberate ? "your test" : "blocked" }),
        el("td", {}, el("span", {
          class: "origin-tag",
          dataset: { external: "true" },
          text: b.deliberate ? "REFUSED (your test)" : "REFUSED"
        }))
      ])
    );
  }

  if (note) {
    note.textContent =
      `${snapshot.resources.length} item${snapshot.resources.length === 1 ? "" : "s"} loaded, ` +
      `all from this site. Watching since ${formatTime(snapshot.startedAt)}. ` +
      `A size of "from cache" means the file did not travel at all - it was already on this device.`;
  }
}

function refresh() {
  if (!guard) return;
  const snapshot = guard.snapshot();
  renderStats(snapshot);
  renderLog(snapshot);
}

/* ---- The deliberate outbound test ----------------------- */
function wireTest() {
  const button = document.getElementById("test-outbound");
  const result = document.getElementById("test-result");
  if (!button || !result || !guard) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    result.textContent = "";
    result.append(el("p", { class: "muted", text: "Attempting…" }));

    const outcome = await guard.testOutbound("https://example.com/on-device-test");

    result.textContent = "";
    if (outcome.wasBlocked || outcome.how !== "allowed") {
      result.append(
        el("div", { class: "note note-ok" }, [
          el("strong", { class: "note-title", text: "Refused, exactly as it should be" }),
          el("p", { text: `The request to ${outcome.attempted} never left this device.` }),
          el("p", { class: "mb-0 text-sm mono", text: outcome.message })
        ])
      );
      announce("The test request was refused.");
    } else {
      result.append(
        el("div", { class: "note note-danger" }, [
          el("strong", { class: "note-title", text: "The request was NOT refused" }),
          el("p", { class: "mb-0", text: t("trust.test.allowed") })
        ])
      );
      announce("The test request was allowed. That is a bug.", true);
    }
    button.disabled = false;
    refresh();
  });
}

/* ---- Is the site actually saved for offline use? -------- */
async function reportOfflineState() {
  const node = document.getElementById("offline-state");
  if (!node) return;

  if (location.protocol === "file:") {
    node.textContent =
      "You are running this straight from a folder on your disk, so there is nothing " +
      "to cache — the files are already here. It works offline by definition.";
    return;
  }

  if (!("serviceWorker" in navigator)) {
    node.textContent =
      "This browser does not support offline caching, so the site will need a connection " +
      "to load. Your files are still never uploaded — that part does not depend on caching.";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const cacheNames = ("caches" in window) ? await caches.keys() : [];
    const ours = cacheNames.filter((n) => n.startsWith("ondevice-"));

    if (reg && ours.length) {
      let count = 0;
      for (const name of ours) {
        const cache = await caches.open(name);
        count += (await cache.keys()).length;
      }
      node.textContent =
        `This site is saved on your device: ${count} files are already stored here. ` +
        `Switch off your internet and reload — it will work.`;
    } else if (reg) {
      node.textContent =
        "The offline helper is registered but has not finished saving the site yet. " +
        "Give it a moment and reload this page.";
    } else {
      node.textContent =
        "Not saved for offline use yet. It usually happens within a few seconds of your " +
        "first visit; reload the page if it stays this way.";
    }
  } catch (err) {
    node.textContent =
      "Could not check the offline state: " + (err && err.message ? err.message : err);
    console.error("[On Device] Offline state check failed:", err);
  }
}

/* ---- Storage usage and wiping --------------------------- */
async function reportStorage() {
  const node = document.getElementById("storage-usage");
  if (!node) return;
  const use = await idb.usage();
  if (use.known) {
    node.textContent =
      `This site is currently using about ${formatBytes(use.bytes)} on this device` +
      (use.quota ? ` (your browser would allow up to about ${formatBytes(use.quota)}).` : ".");
  } else {
    node.textContent = t("settings.storageUnknown");
  }
}

function wireWipe() {
  const filesBtn = document.getElementById("wipe-files");
  const allBtn = document.getElementById("wipe-everything");

  if (filesBtn) {
    filesBtn.addEventListener("click", async () => {
      const ok = await confirmDestructive({
        title: "Delete loaded files and results",
        body: "Every file you have loaded and every finished result is removed from this device. Your settings are kept. This cannot be undone.",
        confirmLabel: "Delete them"
      });
      if (!ok) return;
      await workspace.clearAll();
      await tray.clearResults();
      toast("Files and results deleted from this device.", { kind: "ok" });
      await reportStorage();
    });
  }

  if (allBtn) {
    allBtn.addEventListener("click", async () => {
      const ok = await confirmDestructive({
        title: "Delete absolutely everything",
        body: "This removes your files, your results, every setting, every pinned tool, and the offline copy of the site. The next visit starts completely fresh. This cannot be undone.",
        confirmLabel: "Delete everything"
      });
      if (!ok) return;

      const removed = [];
      try {
        await workspace.clearAll();
        await tray.clearResults();
        removed.push("files and results");
      } catch (err) {
        console.error("[On Device] Could not clear stored files:", err);
      }

      try {
        const keys = store.resetAll();
        removed.push(`${keys.length} saved settings entries`);
      } catch (err) {
        console.error("[On Device] Could not clear settings:", err);
      }

      if ("caches" in window) {
        try {
          const names = await caches.keys();
          for (const name of names) {
            if (name.startsWith("ondevice-")) await caches.delete(name);
          }
          removed.push("the offline copy of the site");
        } catch (err) {
          console.error("[On Device] Could not clear the offline cache:", err);
        }
      }

      if ("serviceWorker" in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) await reg.unregister();
          removed.push("the offline helper");
        } catch (err) {
          console.error("[On Device] Could not remove the offline helper:", err);
        }
      }

      toast(`Removed: ${removed.join(", ")}. Reload to start fresh.`, {
        kind: "ok",
        title: "Everything deleted",
        timeout: 0
      });
      await reportStorage();
      await reportOfflineState();
    });
  }
}

/* ---- Start ---------------------------------------------- */
async function start() {
  await initPage({ pathPrefix: "" });

  if (!guard) {
    const host = document.getElementById("monitor-stats");
    if (host) {
      host.append(
        el("div", { class: "note note-danger" }, [
          el("strong", { class: "note-title", text: "The monitor did not load" }),
          el("p", {
            class: "mb-0",
            text: "netguard.js did not run, so this page cannot show you the live counts. " +
                  "That is a bug in the site, not evidence of anything being sent. Please report it."
          })
        ])
      );
    }
    return;
  }

  refresh();
  guard.onChange(refresh);
  window.setInterval(refresh, 2000);

  wireTest();
  wireWipe();
  await reportOfflineState();
  await reportStorage();
}

start().catch((err) => {
  console.error("[On Device] The trust page failed to start:", err);
});
