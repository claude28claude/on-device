/* ============================================================
   On Device - network guard
   ============================================================

   This file runs before any other script on every page.

   It does two jobs:

   1. WATCH. It keeps a complete list of every network request the
      page makes, using the browser's own Performance API, and
      labels each one "this site" or "somewhere else".

   2. BLOCK. It replaces the browser's outbound-request functions
      (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon)
      with versions that refuse any address that is not this site,
      loudly, before the request is made.

   The Content Security Policy in every page already tells the
   browser to refuse these requests. This file is a second,
   independent lock, and it is what makes the counter on the
   Trust page real rather than decorative.

   It is deliberately written to be readable by anyone who wants
   to check it. No minification, no cleverness.
   ============================================================ */

(function () {
  "use strict";

  var SAME_ORIGIN = location.origin;
  var IS_FILE = location.protocol === "file:";

  var state = {
    /* Requests that were attempted to somewhere other than this site. */
    blocked: [],
    /* Every resource the browser actually loaded, from the Performance API. */
    resources: [],
    startedAt: Date.now(),
    listeners: []
  };

  function notify() {
    for (var i = 0; i < state.listeners.length; i++) {
      try {
        state.listeners[i](publicApi.snapshot());
      } catch (err) {
        /* A broken listener must never break the guard. Report, don't swallow. */
        console.error("[On Device] A network-monitor listener threw:", err);
      }
    }
  }

  /* ---------------------------------------------------------
     Is this URL on our own site?
     --------------------------------------------------------- */
  function isSameOrigin(rawUrl) {
    if (rawUrl === undefined || rawUrl === null) return true;

    var url = String(rawUrl);

    /* Blob and data URLs never touch the network. */
    if (url.indexOf("blob:") === 0 || url.indexOf("data:") === 0) return true;

    /* When opened straight from a folder on disk, origin is "null".
       Relative paths are still local files, so allow them. */
    if (IS_FILE) {
      return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.indexOf("file:") === 0;
    }

    try {
      var resolved = new URL(url, location.href);
      return resolved.origin === SAME_ORIGIN;
    } catch (err) {
      /* If we cannot understand the address, we refuse it. */
      return false;
    }
  }

  /* Set only while the Trust page runs its deliberate demonstration, so
     a refusal the visitor asked for is not reported as a fault. */
  var expectingTest = false;

  function record(kind, url, detail) {
    var deliberate = expectingTest;
    var entry = {
      kind: kind,
      url: String(url),
      detail: detail || "",
      deliberate: deliberate,
      at: Date.now(),
      stack: (new Error().stack || "").split("\n").slice(2, 5).join("\n")
    };
    state.blocked.push(entry);
    if (deliberate) {
      console.info(
        "[On Device] Refused the deliberate test request to " + entry.url +
        ", which is exactly what should happen. Nothing left this device."
      );
    } else {
      console.error(
        "[On Device] BLOCKED an outbound " + kind + " request to " + entry.url +
        ". Nothing left this device. Please report this - it is a bug."
      );
    }
    try {
      window.dispatchEvent(new CustomEvent("ondevice:blocked", { detail: entry }));
    } catch (err) { /* CustomEvent is available everywhere we support. */ }
    notify();
    return entry;
  }

  function refusal(kind, url) {
    return new Error(
      "On Device blocked a " + kind + " request to “" + url + "”. " +
      "This site is only allowed to load its own files. Nothing was sent."
    );
  }

  /* ---------------------------------------------------------
     fetch
     --------------------------------------------------------- */
  if (typeof window.fetch === "function") {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = (input && typeof input === "object" && "url" in input) ? input.url : input;
      if (!isSameOrigin(url)) {
        record("fetch", url);
        return Promise.reject(refusal("fetch", url));
      }
      return nativeFetch.apply(this, arguments);
    };
  }

  /* ---------------------------------------------------------
     XMLHttpRequest
     --------------------------------------------------------- */
  if (typeof window.XMLHttpRequest === "function") {
    var nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (!isSameOrigin(url)) {
        record("XMLHttpRequest", url, String(method || ""));
        throw refusal("XMLHttpRequest", url);
      }
      return nativeOpen.apply(this, arguments);
    };
  }

  /* ---------------------------------------------------------
     WebSocket
     --------------------------------------------------------- */
  if (typeof window.WebSocket === "function") {
    var NativeWebSocket = window.WebSocket;
    var GuardedWebSocket = function (url, protocols) {
      if (!isSameOrigin(String(url).replace(/^ws/, "http"))) {
        record("WebSocket", url);
        throw refusal("WebSocket", url);
      }
      return protocols === undefined
        ? new NativeWebSocket(url)
        : new NativeWebSocket(url, protocols);
    };
    GuardedWebSocket.prototype = NativeWebSocket.prototype;
    GuardedWebSocket.CONNECTING = 0;
    GuardedWebSocket.OPEN = 1;
    GuardedWebSocket.CLOSING = 2;
    GuardedWebSocket.CLOSED = 3;
    window.WebSocket = GuardedWebSocket;
  }

  /* ---------------------------------------------------------
     EventSource
     --------------------------------------------------------- */
  if (typeof window.EventSource === "function") {
    var NativeEventSource = window.EventSource;
    var GuardedEventSource = function (url, config) {
      if (!isSameOrigin(url)) {
        record("EventSource", url);
        throw refusal("EventSource", url);
      }
      return config === undefined
        ? new NativeEventSource(url)
        : new NativeEventSource(url, config);
    };
    GuardedEventSource.prototype = NativeEventSource.prototype;
    window.EventSource = GuardedEventSource;
  }

  /* ---------------------------------------------------------
     sendBeacon - this exists only to send data away silently,
     so it is refused for every address without exception.
     --------------------------------------------------------- */
  if (navigator && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon = function (url) {
      record("sendBeacon", url, "sendBeacon is never permitted on this site");
      return false;
    };
  }

  /* ---------------------------------------------------------
     Watch everything the browser actually loads.
     --------------------------------------------------------- */
  function classify(entry) {
    var url = entry.name;
    var external = !isSameOrigin(url);
    var shortUrl = url;
    try {
      var u = new URL(url, location.href);
      shortUrl = u.pathname + (u.search || "");
      if (external) shortUrl = u.href;
    } catch (err) { /* keep the raw string */ }
    return {
      url: url,
      shortUrl: shortUrl,
      type: entry.initiatorType || "other",
      bytes: entry.transferSize || 0,
      ms: Math.round(entry.duration || 0),
      external: external,
      at: Math.round(entry.startTime || 0)
    };
  }

  function takeEntries(list) {
    var items = list.getEntries ? list.getEntries() : list;
    for (var i = 0; i < items.length; i++) {
      if (items[i].entryType !== "resource") continue;
      var row = classify(items[i]);
      state.resources.push(row);
      if (row.external) {
        record("resource", row.url, "loaded as a " + row.type);
      }
    }
    notify();
  }

  if (typeof PerformanceObserver === "function") {
    try {
      var observer = new PerformanceObserver(takeEntries);
      observer.observe({ type: "resource", buffered: true });
    } catch (err) {
      /* Older Safari does not support buffered entries; fall back. */
      try {
        var observer2 = new PerformanceObserver(takeEntries);
        observer2.observe({ entryTypes: ["resource"] });
        if (performance.getEntriesByType) takeEntries(performance.getEntriesByType("resource"));
      } catch (err2) {
        console.warn("[On Device] This browser cannot list loaded resources:", err2);
      }
    }
  } else if (performance && performance.getEntriesByType) {
    takeEntries(performance.getEntriesByType("resource"));
  }

  /* Catch anything the Content Security Policy refuses, so the Trust
     page can show it too. */
  window.addEventListener("securitypolicyviolation", function (e) {
    var entry = {
      kind: "blocked by security policy",
      url: e.blockedURI || "(inline)",
      detail: e.violatedDirective || "",
      at: Date.now(),
      stack: (e.sourceFile || "") + (e.lineNumber ? ":" + e.lineNumber : "")
    };
    state.blocked.push(entry);
    console.error("[On Device] The browser's security policy refused:", entry);
    notify();
  });

  /* ---------------------------------------------------------
     Public reading interface, used by the Trust page.
     --------------------------------------------------------- */
  var publicApi = {
    snapshot: function () {
      var external = 0;
      var bytes = 0;
      for (var i = 0; i < state.resources.length; i++) {
        if (state.resources[i].external) external++;
        bytes += state.resources[i].bytes;
      }
      /* A refusal the visitor deliberately triggered on the Trust page is
         counted separately, so the "blocked attempts" figure only ever
         means "something tried to reach out on its own". */
      var real = 0;
      var tests = 0;
      for (var j = 0; j < state.blocked.length; j++) {
        if (state.blocked[j].deliberate) tests++;
        else real++;
      }
      return {
        startedAt: state.startedAt,
        ownRequests: state.resources.length - external,
        externalRequests: external,
        blockedAttempts: real,
        testAttempts: tests,
        bytes: bytes,
        resources: state.resources.slice(),
        blocked: state.blocked.slice()
      };
    },
    onChange: function (fn) {
      state.listeners.push(fn);
      return function () {
        var i = state.listeners.indexOf(fn);
        if (i >= 0) state.listeners.splice(i, 1);
      };
    },
    /* Used by the Trust page's "prove it" button. */
    testOutbound: function (url) {
      var target = url || "https://example.com/on-device-test";
      return new Promise(function (resolve) {
        var before = state.blocked.length;
        expectingTest = true;
        var settled = function (how, message) {
          expectingTest = false;
          resolve({
            attempted: target,
            wasBlocked: state.blocked.length > before,
            how: how,
            message: message
          });
        };
        try {
          window.fetch(target)
            .then(function () { settled("allowed", "The request went through. That is a bug."); })
            .catch(function (err) { settled("rejected", err && err.message ? err.message : String(err)); });
        } catch (err) {
          settled("threw", err && err.message ? err.message : String(err));
        }
      });
    }
  };

  window.OnDeviceNetGuard = publicApi;
})();
