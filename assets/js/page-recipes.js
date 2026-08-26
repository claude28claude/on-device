/* ============================================================
   On Device - the Recipes page

   Builds the list of saved recipes, the editor for one of them,
   and the panel that runs a recipe over whatever files are
   loaded.

   Nothing here knows how to perform a step - that lives in
   recipes/steps.js. This file is only the interface.
   ============================================================ */

import { initPage } from "./app.js";
import * as store from "./recipes/store.js";
import * as runner from "./recipes/run.js";
import { STEPS, NOT_STEPS, getStep, defaultOptions, secretKeys } from "./recipes/steps.js";
import { getTool } from "./tools.js";
import * as workspace from "./workspace.js";
import * as dropzone from "./dropzone.js";
import * as tray from "./tray.js";
import { el, icon, toast, announce, openDialog, confirmDestructive, formatBytes, formatDuration } from "./ui.js";
import { t } from "./i18n.js";

const $ = (id) => document.getElementById(id);

/* The recipe currently open in the editor. Null means the editor is
   closed and the list is all there is. */
let editing = null;
let dirty = false;
let running = false;
let stopRequested = false;

/* ---- Start ----------------------------------------------- */
async function start() {
  await initPage({ pathPrefix: "" });

  if (!store.canSave) {
    $("storage-warning").append(
      el("div", { class: "note note-warn" }, [
        el("strong", { class: "note-title", text: "Recipes cannot be saved in this window" }),
        el("p", {
          class: "mb-0",
          text:
            "This browser will not let the site store anything on this device — usually " +
            "because it is a private window, or storage is switched off for this site. " +
            "You can still build a recipe and run it now, but it will be gone when you " +
            "close the tab, and Export will not have anything to write."
        })
      ])
    );
  }

  const loadError = store.getLoadError();
  if (loadError) {
    $("storage-warning").append(
      el("div", { class: "note note-danger" }, [
        el("strong", { class: "note-title", text: "Your saved recipes could not be read" }),
        el("p", {
          class: "mb-0",
          text:
            "What was stored on this device is damaged and has been left alone rather " +
            "than overwritten: " + (loadError.message || String(loadError)) +
            ". Nothing has been deleted. Saving a new recipe will replace the damaged store."
        })
      ])
    );
  }

  mountDropPanel();
  renderList();
  renderCannot();
  renderRunPanel();

  store.onChange(() => {
    renderList();
    renderRunPanel();
  });
  workspace.onChange(() => {
    renderFileList();
    renderRunPanel();
  });

  $("new-recipe").addEventListener("click", () => openEditor(store.blank()));
  $("close-editor").addEventListener("click", closeEditor);
  $("save-recipe").addEventListener("click", saveCurrent);
  $("add-step").addEventListener("click", chooseStep);
  $("run-button").addEventListener("click", runNow);
  $("stop-button").addEventListener("click", () => {
    stopRequested = true;
    $("stop-button").disabled = true;
    $("stop-button").textContent = "Stopping after this step…";
  });
  $("export-recipes").addEventListener("click", exportAll);
  $("import-recipes").addEventListener("click", importFile);

  /* Leaving with unsaved changes is easy to do by accident. */
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  renderFileList();

  /* Arriving from the command palette with a particular recipe in mind. */
  const wanted = new URLSearchParams(location.search).get("open");
  if (wanted) {
    const found = store.get(wanted);
    if (found) {
      openEditor(found);
    } else {
      toast(
        "That recipe is not on this device. A link to a recipe only works on the " +
        "device the recipe was saved on — recipes travel as files, not as links.",
        { kind: "warn", timeout: 10000 }
      );
    }
  }
}

/* ---- Files to run on ------------------------------------- */
function mountDropPanel() {
  const host = $("drop-host");
  const input = el("input", {
    type: "file",
    multiple: true,
    class: "sr-only",
    id: "recipe-input",
    /* Off-screen but reachable by keyboard and read out, so it needs
       a name of its own rather than borrowing the button's. */
    "aria-label": "Choose files to run the recipe on",
    onchange: (e) => {
      const chosen = e.target.files;
      e.target.value = "";
      if (chosen && chosen.length) dropzone.handleFiles(chosen);
    }
  });

  const panel = el("div", { class: "dropzone", dataset: { over: "false" } }, [
    icon("upload", 30),
    el("h2", { text: "Drop the files here" }),
    el("p", { text: "Or anywhere on this page. They stay on this device — there is nowhere to send them." }),
    el("div", { class: "btn-row" }, [
      el("button", { class: "btn btn-primary", type: "button", onclick: () => input.click() },
        [icon("upload", 17), document.createTextNode(" Choose files")])
    ]),
    input
  ]);

  panel.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    panel.dataset.over = "true";
  });
  panel.addEventListener("dragleave", () => { panel.dataset.over = "false"; });
  panel.addEventListener("drop", () => { panel.dataset.over = "false"; });

  host.append(panel);
}

function renderFileList() {
  const host = $("files-host");
  host.textContent = "";
  const items = workspace.list();
  if (!items.length) return;

  const head = el("div", { class: "flex-row mb-4" }, [
    el("h3", { class: "mb-0 h-lg", text: `${items.length} file${items.length === 1 ? "" : "s"} loaded` }),
    el("button", {
      class: "btn btn-sm btn-quiet",
      type: "button",
      onclick: async () => {
        await workspace.clearAll();
        renderFileList();
        renderRunPanel();
      }
    }, [icon("trash", 15), document.createTextNode(" Clear them")])
  ]);

  const ul = el("ul", { class: "file-list" });
  for (const f of items) {
    ul.append(el("li", {}, [
      el("span", { class: "file-thumb", text: (f.format || "?").slice(0, 4) }),
      el("span", { class: "file-main" }, [
        el("span", { class: "file-name", text: f.name }),
        el("span", { class: "file-meta", text: `${f.label} · ${formatBytes(f.size)}` })
      ]),
      el("button", {
        class: "btn btn-sm btn-quiet",
        type: "button",
        "aria-label": `Remove ${f.name}`,
        onclick: async () => {
          await workspace.removeFile(f.id);
          renderFileList();
          renderRunPanel();
        }
      }, icon("x", 15))
    ]));
  }

  host.append(head, ul);
}

/* ---- The list of saved recipes --------------------------- */
function renderList() {
  const host = $("recipe-list");
  host.textContent = "";
  const all = store.list();

  if (!all.length) {
    host.append(el("div", { class: "empty-state" }, [
      icon("sparkle", 26),
      el("h3", { text: "No recipes yet" }),
      el("p", {
        text:
          "A recipe is a chain of steps with a name. Make one for something you do " +
          "often — “shrink the photos and strip the location”, or “join the scans, " +
          "number the pages and lock it” — and then it is one drop and one click."
      }),
      el("button", { class: "btn btn-primary", type: "button", onclick: () => openEditor(store.blank()) },
        "Build your first recipe"),
      el("button", { class: "btn", type: "button", onclick: offerExamples }, "Start from an example")
    ]));
    return;
  }

  const list = el("div", { class: "recipe-list" });
  for (const r of all) {
    const chain = r.steps
      .map((s) => (getStep(s.stepId) || {}).label || s.stepId)
      .join(" → ");

    list.append(el("article", { class: "recipe-card" }, [
      el("div", { class: "recipe-card-main" }, [
        el("h3", { class: "recipe-card-name", text: r.name }),
        el("p", { class: "recipe-card-chain", text: chain }),
        r.note ? el("p", { class: "field-hint mb-0", text: r.note }) : null,
        r.steps.some((s) => secretKeys(s.stepId).length)
          ? el("p", { class: "field-hint mb-0", text: "Asks for a password when it runs." })
          : null
      ]),
      el("div", { class: "recipe-card-actions" }, [
        el("button", {
          class: "btn btn-sm btn-primary", type: "button",
          onclick: () => { openEditor(r); scrollToRun(); }
        }, "Open"),
        el("button", {
          class: "btn btn-sm", type: "button",
          onclick: () => {
            const copy = store.duplicate(r.id);
            if (copy) toast(`Copied as “${copy.name}”.`, { kind: "ok" });
          }
        }, "Duplicate"),
        el("button", {
          class: "btn btn-sm", type: "button",
          onclick: () => downloadText(store.exportOne(r.id), fileNameFor(r.name))
        }, "Export"),
        el("button", {
          class: "btn btn-sm btn-quiet", type: "button",
          onclick: async () => {
            const yes = await confirmDestructive({
              title: `Delete “${r.name}”?`,
              body: "The recipe is removed from this device. Files you have already made with it are untouched.",
              confirmLabel: "Delete it"
            });
            if (!yes) return;
            store.remove(r.id);
            if (editing && editing.id === r.id) closeEditor(true);
            announce("Recipe deleted.");
          }
        }, icon("trash", 15))
      ])
    ]));
  }

  host.append(list);
}

/* ---- The editor ------------------------------------------ */
function openEditor(recipe) {
  editing = {
    id: recipe.id,
    name: recipe.name || "",
    note: recipe.note || "",
    steps: (recipe.steps || []).map((s) => ({ stepId: s.stepId, options: { ...s.options } })),
    createdAt: recipe.createdAt
  };
  dirty = false;
  $("editor-section").hidden = false;
  $("recipe-name").value = editing.name;
  $("recipe-note").value = editing.note;
  $("recipe-name").oninput = (e) => { editing.name = e.target.value; dirty = true; };
  $("recipe-note").oninput = (e) => { editing.note = e.target.value; dirty = true; };
  renderSteps();
  renderRunPanel();
  $("recipe-name").focus();
}

async function closeEditor(force = false) {
  if (dirty && force !== true) {
    const answer = await openDialog({
      title: "Close without saving?",
      body: "This recipe has changes that have not been saved to this device.",
      buttons: [
        { id: "cancel", label: "Keep editing" },
        { id: "save", label: "Save and close", class: "btn-primary" },
        { id: "discard", label: "Discard the changes", class: "btn-danger" }
      ]
    });
    if (answer === "cancel" || answer === null) return;
    if (answer === "save") {
      const ok = saveCurrent();
      if (!ok) return;
    }
  }
  editing = null;
  dirty = false;
  $("editor-section").hidden = true;
  renderRunPanel();
}

function saveCurrent() {
  if (!editing) return false;
  const name = String(editing.name || "").trim();
  if (!name) {
    toast("Give the recipe a name first — that is how you will find it again.", { kind: "warn" });
    $("recipe-name").focus();
    return false;
  }
  if (!editing.steps.length) {
    toast("A recipe with no steps would do nothing. Add at least one step.", { kind: "warn" });
    return false;
  }
  try {
    const saved = store.save({ ...editing, name });
    editing.id = saved.id;
    dirty = false;
    toast(`“${saved.name}” saved on this device.`, { kind: "ok" });
    announce("Recipe saved.");
    return true;
  } catch (err) {
    toast(err.message || String(err), { kind: "warn", title: "Could not save", timeout: 12000 });
    return false;
  }
}

function renderSteps() {
  const host = $("steps-host");
  host.textContent = "";
  if (!editing) return;

  if (!editing.steps.length) {
    host.append(el("p", { class: "muted", text: "No steps yet. Add the first one below." }));
    renderCheck();
    return;
  }

  const list = el("ol", { class: "recipe-steps" });

  editing.steps.forEach((entry, index) => {
    const def = getStep(entry.stepId);

    if (!def) {
      list.append(el("li", { class: "recipe-step" }, [
        el("div", { class: "note note-danger mb-0" }, [
          el("strong", { class: "note-title", text: "A step this version does not have" }),
          el("p", { text: `The recipe refers to “${entry.stepId}”, which does not exist here. It was probably made by a newer version of On Device.` }),
          el("button", {
            class: "btn btn-sm btn-danger", type: "button",
            onclick: () => { editing.steps.splice(index, 1); dirty = true; renderSteps(); renderRunPanel(); }
          }, "Remove it")
        ])
      ]));
      return;
    }

    const body = el("div", { class: "recipe-step-options" });
    for (const opt of def.options) {
      body.append(optionField(def, entry, opt, index));
    }

    list.append(el("li", { class: "recipe-step" }, [
      el("div", { class: "recipe-step-head" }, [
        el("span", { class: "recipe-step-icon" }, icon(def.icon, 18)),
        el("div", { class: "grow min0" }, [
          el("h3", { class: "recipe-step-title", text: def.label }),
          el("p", { class: "field-hint mb-0", text: def.blurb })
        ]),
        el("div", { class: "btn-row" }, [
          el("button", {
            class: "btn btn-sm btn-quiet", type: "button", "aria-label": "Move this step earlier",
            disabled: index === 0,
            onclick: () => move(index, -1)
          }, "↑"),
          el("button", {
            class: "btn btn-sm btn-quiet", type: "button", "aria-label": "Move this step later",
            disabled: index === editing.steps.length - 1,
            onclick: () => move(index, 1)
          }, "↓"),
          el("button", {
            class: "btn btn-sm btn-quiet", type: "button", "aria-label": `Remove ${def.label}`,
            onclick: () => { editing.steps.splice(index, 1); dirty = true; renderSteps(); renderRunPanel(); }
          }, icon("x", 15))
        ])
      ]),
      def.options.length ? body : el("p", { class: "field-hint mb-0", text: "Nothing to set — this step does one thing." }),
      fanNote(def)
    ]));
  });

  host.append(list);
  renderCheck();
}

function fanNote(def) {
  if (def.fan === "n:1") {
    return el("p", { class: "field-hint mb-0", text: "Everything reaching this step becomes a single file." });
  }
  if (def.fan === "1:n") {
    return el("p", { class: "field-hint mb-0", text: "Each file reaching this step becomes several." });
  }
  return null;
}

function move(index, by) {
  const to = index + by;
  if (to < 0 || to >= editing.steps.length) return;
  const [item] = editing.steps.splice(index, 1);
  editing.steps.splice(to, 0, item);
  dirty = true;
  renderSteps();
  renderRunPanel();
}

/* One option, drawn according to its declared type. */
function optionField(def, entry, opt, index) {
  const id = `opt-${index}-${opt.key}`;
  const value = entry.options[opt.key];

  const setValue = (v) => {
    entry.options[opt.key] = v;
    dirty = true;
    renderCheck();
    renderRunPanel();
  };

  if (opt.type === "secret") {
    return el("div", { class: "field" }, [
      el("span", { class: "field-label", text: opt.label }),
      el("p", { class: "field-hint mb-0", text: opt.hint || "Asked for each time the recipe runs." })
    ]);
  }

  if (opt.type === "toggle") {
    const input = el("input", {
      type: "checkbox", id,
      checked: value === undefined ? Boolean(opt.default) : Boolean(value),
      onchange: (e) => setValue(e.target.checked)
    });
    return el("div", { class: "field" }, [
      el("label", { class: "check-row", for: id }, [input, el("span", { text: opt.label })]),
      opt.hint ? el("p", { class: "field-hint mb-0", text: opt.hint }) : null
    ]);
  }

  if (opt.type === "select") {
    const select = el("select", { id, onchange: (e) => {
      const chosen = opt.options.find((o) => String(o.value) === e.target.value);
      setValue(chosen ? chosen.value : e.target.value);
    } });
    for (const o of opt.options) {
      select.append(el("option", {
        value: String(o.value),
        selected: String(value === undefined ? opt.default : value) === String(o.value)
      }, o.label));
    }
    return el("div", { class: "field" }, [
      el("label", { for: id, text: opt.label }),
      select,
      opt.hint ? el("p", { class: "field-hint mb-0", text: opt.hint }) : null
    ]);
  }

  if (opt.type === "number") {
    return el("div", { class: "field" }, [
      el("label", { for: id, text: opt.label }),
      el("input", {
        type: "number", id,
        min: opt.min, max: opt.max, step: opt.step,
        value: String(value === undefined ? opt.default : value),
        oninput: (e) => setValue(e.target.value === "" ? "" : Number(e.target.value))
      }),
      opt.hint ? el("p", { class: "field-hint mb-0", text: opt.hint }) : null
    ]);
  }

  if (opt.type === "colour") {
    return el("div", { class: "field" }, [
      el("label", { for: id, text: opt.label }),
      el("input", {
        type: "color", id,
        value: String(value === undefined ? opt.default : value),
        oninput: (e) => setValue(e.target.value)
      }),
      opt.hint ? el("p", { class: "field-hint mb-0", text: opt.hint }) : null
    ]);
  }

  return el("div", { class: "field" }, [
    el("label", { for: id, text: opt.label }),
    el("input", {
      type: "text", id, autocomplete: "off", spellcheck: "false",
      placeholder: opt.placeholder || "",
      value: String(value === undefined ? opt.default : value),
      oninput: (e) => setValue(e.target.value)
    }),
    opt.hint ? el("p", { class: "field-hint mb-0", text: opt.hint }) : null
  ]);
}

/* ---- Checking the chain before anybody runs it ----------- */
function startingKinds() {
  const kinds = new Set();
  for (const f of workspace.list()) kinds.add(f.kind);
  return [...kinds];
}

function renderCheck() {
  const host = $("check-host");
  host.textContent = "";
  if (!editing || !editing.steps.length) return;

  const problems = runner.check(editing.steps, startingKinds());
  if (!problems.length) {
    const files = workspace.list().length;
    host.append(el("div", { class: "note note-ok" }, [
      el("strong", { class: "note-title", text: "This recipe looks runnable" }),
      el("p", {
        class: "mb-0",
        text: files
          ? `Checked against the ${files} file${files === 1 ? "" : "s"} you have loaded.`
          : "Load some files and it will be checked against those too."
      })
    ]));
    return;
  }

  host.append(el("div", { class: "note note-warn" }, [
    el("strong", { class: "note-title", text: problems.length === 1 ? "One problem" : `${problems.length} problems` }),
    el("ul", { class: "mb-0" }, problems.map((p) => el("li", { text: p })))
  ]));
}

/* ---- Choosing a step to add ------------------------------ */
async function chooseStep() {
  if (!editing) return;

  const body = el("div", {});
  const groups = [
    { id: "image", label: "Pictures" },
    { id: "pdf", label: "PDFs" },
    { id: "files", label: "Any file" }
  ];

  let chosen = null;

  for (const group of groups) {
    const inGroup = STEPS.filter((s) => s.cat === group.id);
    if (!inGroup.length) continue;
    body.append(el("h3", { class: "h-lg", text: group.label }));
    const list = el("div", { class: "step-picker" });
    for (const step of inGroup) {
      list.append(el("button", {
        class: "btn step-pick", type: "button",
        onclick: () => {
          chosen = step.id;
          const dlg = document.querySelector("dialog.modal[open]");
          if (dlg) dlg.close();
        }
      }, [
        icon(step.icon, 18),
        el("span", { class: "step-pick-body" }, [
          el("strong", { text: step.label }),
          el("span", { class: "field-hint", text: step.blurb })
        ])
      ]));
    }
    body.append(list);
  }

  await openDialog({
    title: "Add a step",
    body,
    buttons: [{ id: "cancel", label: "Cancel" }]
  });

  if (!chosen) return;
  editing.steps.push({ stepId: chosen, options: defaultOptions(chosen) });
  dirty = true;
  renderSteps();
  renderRunPanel();
  announce(`${getStep(chosen).label} added as step ${editing.steps.length}.`);
}

/* ---- Running --------------------------------------------- */
function renderRunPanel() {
  const summary = $("run-summary");
  summary.textContent = "";
  const button = $("run-button");

  if (running) {
    button.disabled = true;
    return;
  }

  const files = workspace.list();
  const steps = editing ? editing.steps : [];

  if (!editing) {
    summary.append(el("p", { class: "field-hint", text: "Open a recipe, or make one, and it will run from here." }));
    button.disabled = true;
    return;
  }

  const problems = runner.check(steps, files.map((f) => f.kind));

  summary.append(el("ul", { class: "stat-row" }, [
    el("li", { class: "stat" }, [
      el("strong", { text: String(files.length) }),
      el("span", { text: files.length === 1 ? " file loaded" : " files loaded" })
    ]),
    el("li", { class: "stat" }, [
      el("strong", { text: String(steps.length) }),
      el("span", { text: steps.length === 1 ? " step" : " steps" })
    ])
  ]));

  const blocked = !files.length || !steps.length || problems.length > 0;
  button.disabled = blocked;

  if (!files.length) {
    summary.append(el("p", { class: "field-hint mb-0", text: "Drop some files in to run this on." }));
  } else if (!steps.length) {
    summary.append(el("p", { class: "field-hint mb-0", text: "Add at least one step." }));
  } else if (problems.length) {
    summary.append(el("p", { class: "field-hint mb-0", text: "Fix the problems listed above first." }));
  }
}

function scrollToRun() {
  const section = $("editor-section");
  if (section && section.scrollIntoView) section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Passwords are asked for here, held in a local variable for the
   length of the run, and never written anywhere. */
async function askForSecrets(steps) {
  const wanted = [];
  steps.forEach((entry, index) => {
    const def = getStep(entry.stepId);
    if (!def) return;
    for (const opt of def.options) {
      if (opt.type === "secret") wanted.push({ index, def, opt });
    }
  });

  if (!wanted.length) return {};

  const inputs = new Map();
  const body = el("div", {});
  body.append(el("p", {
    text:
      "This recipe has a step that needs a password. It is used for this run only and " +
      "is not saved on this device or written into an exported recipe."
  }));

  for (const w of wanted) {
    const id = `secret-${w.index}-${w.opt.key}`;
    const input = el("input", { type: "password", id, autocomplete: "new-password" });
    inputs.set(`${w.index}.${w.opt.key}`, input);
    body.append(el("div", { class: "field" }, [
      el("label", { for: id, text: `Step ${w.index + 1}, ${w.def.label}: ${w.opt.label}` }),
      input,
      w.opt.hint ? el("p", { class: "field-hint mb-0", text: w.opt.hint }) : null
    ]));
  }

  const answer = await openDialog({
    title: "Password needed",
    body,
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "ok", label: "Run", class: "btn-primary" }
    ]
  });

  if (answer !== "ok") return null;

  const secrets = {};
  for (const [key, input] of inputs) secrets[key] = input.value;
  return secrets;
}

async function runNow() {
  if (!editing || running) return;

  const files = workspace.list();
  if (!files.length) return;

  const secrets = await askForSecrets(editing.steps);
  if (secrets === null) return;

  running = true;
  stopRequested = false;
  $("run-button").disabled = true;
  $("stop-button").hidden = false;
  $("stop-button").disabled = false;
  $("stop-button").textContent = "Stop";

  const host = $("run-host");
  host.textContent = "";
  const bar = el("div", { class: "progress" }, el("i"));
  const line = el("p", { class: "field-hint mb-0", text: "Starting…" });
  const log = el("ol", { class: "recipe-log" });
  host.append(el("div", { class: "panel" }, [
    el("h2", { class: "h-lg", text: "Running" }),
    bar, line, log
  ]));

  const total = editing.steps.length;
  const fill = bar.querySelector("i");

  const onEvent = (event) => {
    if (event.type === "step-start") {
      line.textContent = `Step ${event.index + 1} of ${total}: ${event.label} — ${event.incoming} file${event.incoming === 1 ? "" : "s"} in`;
    } else if (event.type === "progress") {
      const overall = (event.index + event.fraction) / total;
      fill.style.width = `${Math.round(overall * 100)}%`;
      if (event.name) {
        line.textContent = `Step ${event.index + 1} of ${total}: ${event.name}`;
      }
    } else if (event.type === "step-done") {
      log.append(el("li", { text: `${event.label} — ${event.outgoing} file${event.outgoing === 1 ? "" : "s"} out` }));
      fill.style.width = `${Math.round(((event.index + 1) / total) * 100)}%`;
    }
  };

  try {
    const input = files.map((f) => ({ blob: f.blob, name: f.name, format: f.format, kind: f.kind }));
    const result = await runner.run(input, editing.steps, {
      secrets,
      onEvent,
      shouldStop: () => stopRequested
    });

    for (const item of result.items) {
      await tray.addResult({
        blob: item.blob,
        name: item.name,
        fromTool: editing.name || "Recipe",
        note: `Made by the recipe “${editing.name || "untitled"}”.`
      });
    }

    fill.style.width = "100%";
    line.textContent =
      `Finished in ${formatDuration(result.ms)}. ${result.items.length} file` +
      `${result.items.length === 1 ? "" : "s"} in the results tray.`;

    toast(
      `“${editing.name || "The recipe"}” finished: ${files.length} in, ${result.items.length} out.`,
      { kind: "ok", title: "Done", timeout: 10000 }
    );
    announce(`Recipe finished. ${result.items.length} files ready in the results tray.`, true);
  } catch (err) {
    const cancelled = err && err.cancelled;
    fill.style.width = "0%";
    line.textContent = "";
    host.textContent = "";
    host.append(el("div", { class: cancelled ? "note note-warn" : "note note-danger" }, [
      el("strong", { class: "note-title", text: cancelled ? "Stopped" : "The recipe did not finish" }),
      el("p", { text: err && err.message ? err.message : String(err) }),
      el("p", {
        class: "mb-0",
        text: cancelled
          ? "Nothing was added to the results tray. Your loaded files are untouched."
          : "Nothing was added to the results tray for the step that failed, and your " +
            "original files have not been changed — On Device never writes over what you gave it."
      })
    ]));
    if (!cancelled) console.error("[On Device] Recipe failed:", err);
    announce(cancelled ? "Recipe stopped." : "The recipe did not finish.", true);
  } finally {
    running = false;
    stopRequested = false;
    $("stop-button").hidden = true;
    renderRunPanel();
  }
}

/* ---- Import and export ----------------------------------- */
function fileNameFor(name) {
  const safe = String(name || "recipe").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-");
  return `${safe || "recipe"}.ondevice-recipe.json`;
}

function downloadText(text, name) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportAll() {
  if (!store.count()) {
    toast("There are no recipes to export yet.", { kind: "warn" });
    return;
  }
  downloadText(store.exportAll(), "on-device-recipes.json");
  toast(`${store.count()} recipe${store.count() === 1 ? "" : "s"} written to a file.`, { kind: "ok" });
}

function importFile() {
  const input = el("input", {
    type: "file",
    accept: "application/json,.json",
    class: "sr-only",
    "aria-label": "Choose a recipe file to import",
    onchange: async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const result = store.importFrom(text);
        let message = `${result.imported} recipe${result.imported === 1 ? "" : "s"} added.`;
        if (result.droppedSteps.length) {
          message += ` Some steps were left out because this version does not have them: ${result.droppedSteps.join(", ")}.`;
        }
        if (result.skipped.length) {
          message += ` ${result.skipped.length} recipe${result.skipped.length === 1 ? "" : "s"} had nothing usable left and were not added.`;
        }
        toast(message, { kind: "ok", title: "Imported", timeout: 12000 });
        announce(message, true);
      } catch (err) {
        toast(err.message || String(err), { kind: "warn", title: "Could not import", timeout: 12000 });
      }
    }
  });
  document.body.append(input);
  input.click();
  window.setTimeout(() => input.remove(), 0);
}

/* ---- Examples -------------------------------------------- */
/* Three recipes that answer the questions people actually have.
   They are added as ordinary recipes, editable like any other. */
const EXAMPLES = [
  {
    name: "Photos for email",
    note: "Shrink to 1600px, strip the location, save as JPEG.",
    steps: [
      { stepId: "image-resize", options: { ...defaultOptions("image-resize"), mode: "longest", value: 1600, format: "jpg", quality: 82 } },
      { stepId: "image-strip", options: defaultOptions("image-strip") }
    ]
  },
  {
    name: "Scans into one numbered PDF",
    note: "Join the pictures into a PDF and number the pages.",
    steps: [
      { stepId: "images-to-pdf", options: { ...defaultOptions("images-to-pdf"), name: "scans.pdf" } },
      { stepId: "pdf-page-numbers", options: { ...defaultOptions("pdf-page-numbers"), format: "{n}" } }
    ]
  },
  {
    name: "Send this PDF safely",
    note: "Wipe the document details, stamp it, then put it in a zip.",
    steps: [
      { stepId: "pdf-metadata-wipe", options: {} },
      { stepId: "pdf-watermark", options: { ...defaultOptions("pdf-watermark"), text: "CONFIDENTIAL" } },
      { stepId: "zip", options: { ...defaultOptions("zip"), name: "documents.zip" } }
    ]
  }
];

async function offerExamples() {
  const body = el("div", {});
  body.append(el("p", { text: "These are ordinary recipes — add one and change it however you like." }));
  let picked = null;
  const list = el("div", { class: "step-picker" });
  for (const ex of EXAMPLES) {
    list.append(el("button", {
      class: "btn step-pick", type: "button",
      onclick: () => {
        picked = ex;
        const dlg = document.querySelector("dialog.modal[open]");
        if (dlg) dlg.close();
      }
    }, [
      icon("sparkle", 18),
      el("span", { class: "step-pick-body" }, [
        el("strong", { text: ex.name }),
        el("span", { class: "field-hint", text: ex.note })
      ])
    ]));
  }
  body.append(list);

  await openDialog({ title: "Start from an example", body, buttons: [{ id: "cancel", label: "Cancel" }] });
  if (!picked) return;

  openEditor({ ...store.blank(), name: picked.name, note: picked.note, steps: picked.steps });
  dirty = true;
  toast("Loaded as a new recipe. Change anything you like, then Save.", { kind: "ok" });
}

/* ---- What cannot be a step ------------------------------- */
function renderCannot() {
  const host = $("cannot-host");
  const list = el("ul", { class: "cannot-list" });
  for (const entry of NOT_STEPS) {
    const tool = getTool(entry.tool);
    const name = tool ? t(`tool.${tool.id}.name`) : entry.tool;
    list.append(el("li", {}, [
      el("strong", { text: name }),
      document.createTextNode(" — " + entry.why)
    ]));
  }
  host.append(list);
}

start();
