// Local-first storage on the phone (IndexedDB).
// recs: every record (entries, plans, categories...), keyed by id
// kv:   settings and small app state
//
// The app keeps all records in memory; every change is written here first,
// marked `_pendente` so stage 2 can send it to the Google Sheets.

const DB_NAME = 'gabi-e-yuri';
const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recs')) db.createObjectStore('recs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let result;
    Promise.resolve(fn(store)).then(r => { result = r; }, reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const recs = {
  all: () => tx('recs', 'readonly', s => wrap(s.getAll())),
  put: (rec) => tx('recs', 'readwrite', s => wrap(s.put(rec))),
  putMany: (list) => tx('recs', 'readwrite', s => Promise.all(list.map(r => wrap(s.put(r))))),
  deleteMany: (ids) => tx('recs', 'readwrite', s => Promise.all(ids.map(id => wrap(s.delete(id))))),
  clear: () => tx('recs', 'readwrite', s => wrap(s.clear())),
};

export const kv = {
  get: (key) => tx('kv', 'readonly', s => wrap(s.get(key))),
  set: (key, value) => tx('kv', 'readwrite', s => wrap(s.put(value, key))),
};

// Ask iOS to treat this data as something the user wants kept, not a cache.
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* not supported */ }
  return false;
}
