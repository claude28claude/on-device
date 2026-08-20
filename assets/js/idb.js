/* ============================================================
   On Device - local file storage

   A very small wrapper around IndexedDB, the browser's own
   on-device database. It is used to remember the files you have
   loaded so a refresh does not lose your work.

   This database lives on this machine. There is no server copy.
   The "Clear everything now" button empties it completely.
   ============================================================ */

const DB_NAME = "ondevice";
const DB_VERSION = 1;
const STORES = ["workspace", "results"];

let dbPromise = null;

export function idbAvailable() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error("This browser does not provide on-device storage (IndexedDB)."));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new Error(
        "On-device storage could not be opened: " + (err && err.message ? err.message : err)
      ));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error(
        "On-device storage was refused by the browser. This is normal in some private " +
        "windows. Files will still work, they just will not survive a refresh. " +
        (request.error && request.error.message ? request.error.message : "")
      ));
    request.onblocked = () =>
      reject(new Error("On-device storage is locked by another tab of this site. Close the other tab and try again."));
  });
  return dbPromise;
}

function run(storeName, mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;
        try {
          result = work(store);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
        tx.onerror = () => reject(tx.error || new Error("Storage transaction failed."));
        tx.onabort = () => reject(tx.error || new Error("Storage transaction was aborted."));
      })
  );
}

export function put(storeName, record) {
  return run(storeName, "readwrite", (store) => store.put(record));
}

export function remove(storeName, id) {
  return run(storeName, "readwrite", (store) => store.delete(id));
}

export function clear(storeName) {
  return run(storeName, "readwrite", (store) => store.clear());
}

export function getAll(storeName) {
  return run(storeName, "readonly", (store) => store.getAll());
}

export async function clearEverything() {
  const cleared = [];
  for (const name of STORES) {
    try {
      await clear(name);
      cleared.push(name);
    } catch (err) {
      console.error(`[On Device] Could not clear “${name}”:`, err);
      throw err;
    }
  }
  return cleared;
}

/* How much space is this site using on this device? */
export async function usage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return { bytes: est.usage || 0, quota: est.quota || 0, known: true };
    } catch (err) {
      return { bytes: 0, quota: 0, known: false };
    }
  }
  return { bytes: 0, quota: 0, known: false };
}
