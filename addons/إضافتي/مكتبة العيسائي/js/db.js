/* قاعدة البيانات المحلية (IndexedDB) — كل بيانات المكتبة تُحفظ هنا على الجهاز */
const DB_NAME = 'alaisai_library_v2';
const DB_VER = 1;
const STORES = { items: 'id', blobs: 'id', log: 'id', kv: 'key' };

let dbp = null;
export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      }
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
    rq.onblocked = () => reject(new Error('قاعدة البيانات محجوبة بسبب تبويب آخر مفتوح'));
  });
  return dbp;
}

async function run(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    const rq = fn(tx.objectStore(store));
    if (rq) rq.onsuccess = () => { result = rq.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('تم إلغاء العملية'));
  });
}

const store = (name) => ({
  all: () => run(name, 'readonly', (s) => s.getAll()),
  get: (k) => run(name, 'readonly', (s) => s.get(k)),
  put: (v) => run(name, 'readwrite', (s) => s.put(v)),
  del: (k) => run(name, 'readwrite', (s) => s.delete(k)),
  clear: () => run(name, 'readwrite', (s) => s.clear()),
});

export const items = store('items');
export const blobs = store('blobs');
export const log = store('log');
const kvStore = store('kv');
export const kv = {
  async get(key, fallback = null) {
    const r = await kvStore.get(key);
    return r === undefined ? fallback : r.value;
  },
  set: (key, value) => kvStore.put({ key, value }),
  del: (key) => kvStore.del(key),
};

export async function wipeAll() {
  await Promise.all([items.clear(), blobs.clear(), log.clear(), kvStore.clear()]);
}

export const uid = (p = 'x') =>
  p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
