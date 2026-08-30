/* ============================================================
   On Device - the batch queue

   Any tool that can handle one file can handle forty. This runs
   them one after another, shows honest progress for each, and
   lets you cancel, skip or retry any of them.

   One at a time, deliberately. Photographs are memory-hungry, and
   four large ones decoded at once is how a browser tab dies. A
   steady queue that finishes beats a fast one that crashes.
   ============================================================ */

import { el, announce, formatBytes } from "./ui.js";
import { isCancellation, cancelEverything } from "./image/runner.js";
import { t, tn } from "./i18n.js";

/* Looked up at the moment it is drawn rather than when this file is
   loaded, so that changing the language updates a queue already on
   screen instead of leaving it in the language it started in. */
export function stateLabel(state) {
  return t(`queue.state.${state}`);
}

export class Queue {
  constructor({ host, onItemDone, worker, toolName }) {
    this.host = host;
    this.items = [];
    this.running = false;
    this.stopRequested = false;
    this.worker = worker;          /* async (item, onProgress) => result */
    this.onItemDone = onItemDone || (() => {});
    this.toolName = toolName || "tool";
    this.nextId = 1;
  }

  setFiles(records) {
    this.items = records.map((record) => ({
      id: `q${this.nextId++}`,
      record,
      state: "waiting",
      progress: 0,
      result: null,
      error: null
    }));
    this.render();
  }

  get pendingCount() {
    return this.items.filter((i) => i.state === "waiting").length;
  }

  get doneCount() {
    return this.items.filter((i) => i.state === "done").length;
  }

  get failedCount() {
    return this.items.filter((i) => i.state === "error").length;
  }

  /* ---- Running ------------------------------------------ */
  async run() {
    if (this.running) return;
    this.running = true;
    this.stopRequested = false;
    this.render();

    for (const item of this.items) {
      if (this.stopRequested) {
        if (item.state === "waiting") item.state = "cancelled";
        continue;
      }
      if (item.state !== "waiting") continue;

      item.state = "running";
      item.progress = 0;
      item.error = null;
      this.render();

      try {
        const result = await this.worker(item, (value) => {
          item.progress = value;
          this.updateItem(item);
        });
        if (this.stopRequested) {
          item.state = "cancelled";
        } else {
          item.state = "done";
          item.progress = 1;
          item.result = result;
          this.onItemDone(item, result);
        }
      } catch (err) {
        if (isCancellation(err)) {
          item.state = "cancelled";
        } else {
          item.state = "error";
          item.error = err && err.message ? err.message : String(err);
          console.error(`[On Device] ${item.record.name} failed:`, err);
        }
      }
      this.render();
    }

    this.running = false;
    this.stopRequested = false;
    this.render();

    const done = this.doneCount;
    const failed = this.failedCount;
    announce(
      failed
        ? `Finished. ${done} succeeded, ${failed} failed.`
        : `Finished. ${done} file${done === 1 ? "" : "s"} ready in the results tray.`,
      failed > 0
    );
    return { done, failed };
  }

  stop() {
    this.stopRequested = true;
    cancelEverything();
    for (const item of this.items) {
      if (item.state === "waiting") item.state = "cancelled";
    }
    this.render();
    announce(t("queue.stopped"));
  }

  skip(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.state !== "waiting") return;
    item.state = "skipped";
    this.render();
  }

  retry(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.state = "waiting";
    item.error = null;
    item.progress = 0;
    this.render();
    if (!this.running) this.run();
  }

  retryAllFailed() {
    let n = 0;
    for (const item of this.items) {
      if (item.state === "error") {
        item.state = "waiting";
        item.error = null;
        item.progress = 0;
        n++;
      }
    }
    this.render();
    if (n && !this.running) this.run();
    return n;
  }

  reset() {
    for (const item of this.items) {
      item.state = "waiting";
      item.progress = 0;
      item.result = null;
      item.error = null;
    }
    this.render();
  }

  /* ---- Drawing ------------------------------------------ */
  updateItem(item) {
    if (!item.node) return;
    const bar = item.node.querySelector(".progress > i");
    if (bar) bar.style.width = `${Math.round(item.progress * 100)}%`;
    const state = item.node.querySelector(".q-state");
    if (state) state.textContent = `${stateLabel(item.state)} ${Math.round(item.progress * 100)}%`;
  }

  render() {
    if (!this.host) return;
    this.host.textContent = "";
    if (!this.items.length) return;

    const summary = el("div", { class: "flex-row mb-4" }, [
      el("strong", {
        text: this.running
          ? t("queue.progress", { done: this.doneCount, total: this.items.length })
          : tn("queue.count", this.items.length)
      }),
      this.running
        ? el("button", { class: "btn btn-sm btn-danger", type: "button", onclick: () => this.stop() }, t("queue.stop"))
        : null,
      !this.running && this.failedCount
        ? el(
            "button",
            { class: "btn btn-sm", type: "button", onclick: () => this.retryAllFailed() },
            t("queue.retryFailed", { n: this.failedCount })
          )
        : null
    ]);

    const list = el("ul", { class: "file-list" });
    for (const item of this.items) {
      list.append(this.renderItem(item));
    }

    this.host.append(summary, list);
  }

  renderItem(item) {
    const { record } = item;
    const bar = el("div", { class: "progress" }, el("i"));
    bar.querySelector("i").style.width = `${Math.round(item.progress * 100)}%`;

    let sizeText = formatBytes(record.size);
    if (item.result && item.result.blob) {
      const after = item.result.blob.size;
      const percent = record.size > 0 ? Math.round((1 - after / record.size) * 100) : 0;
      sizeText = `${formatBytes(record.size)} → ${formatBytes(after)}`;
      if (percent > 0) sizeText += ` (${percent}% smaller)`;
      else if (percent < 0) sizeText += ` (${Math.abs(percent)}% larger)`;
      else if (after !== record.size) {
        const diff = record.size - after;
        sizeText += diff > 0 ? ` (${diff} bytes smaller)` : ` (${Math.abs(diff)} bytes larger)`;
      } else sizeText += " (same size)";
    }

    const node = el("li", { dataset: { state: item.state } }, [
      el("span", { class: "file-thumb", text: (record.format || "?").slice(0, 4) }),
      el("span", { class: "file-main" }, [
        el("span", { class: "file-name", text: record.name }),
        el("span", { class: "file-meta", text: sizeText }),
        item.state === "running" ? bar : null,
        item.error
          ? el("span", { class: "q-error", text: item.error })
          : null,
        item.result && item.result.notes && item.result.notes.length
          ? el("span", { class: "file-meta", text: item.result.notes.join(" ") })
          : null
      ]),
      el("span", {
        class: "badge " + badgeClass(item.state),
        text: item.state === "running"
          ? `${stateLabel(item.state)} ${Math.round(item.progress * 100)}%`
          : stateLabel(item.state)
      }),
      item.state === "waiting" && this.running
        ? el(
            "button",
            { class: "btn btn-sm btn-quiet", type: "button", onclick: () => this.skip(item.id) },
            t("queue.skip")
          )
        : null,
      item.state === "error" || item.state === "cancelled" || item.state === "skipped"
        ? el(
            "button",
            { class: "btn btn-sm", type: "button", onclick: () => this.retry(item.id) },
            t("queue.retry")
          )
        : null
    ]);

    /* The state badge is also the live progress readout. */
    const badge = node.querySelector(".badge");
    if (badge) badge.classList.add("q-state");

    item.node = node;
    return node;
  }
}

function badgeClass(state) {
  if (state === "done") return "badge-ready";
  if (state === "error") return "badge-warn";
  return "badge-soon";
}
