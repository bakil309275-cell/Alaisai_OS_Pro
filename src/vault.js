/* خزنة ملفات الإضافات: ملفات كبيرة (صور، PDF، مستندات) لكل إضافة، محلية على الجهاز فقط (IndexedDB منفصلة) */
(() => {
  'use strict';
  const MAX_FILE = 1024 * 1024 * 1024; /* لا سقف للمجموع ولا للعدد: الحد هو سعة الجهاز نفسها */
  let conn = null;
  const open = () => conn || (conn = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('التخزين غير متاح في هذا المتصفح'));
    const r = indexedDB.open('alaisai_vault', 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore('f', { keyPath: 'id' }); s.createIndex('ns', 'ns'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('f', mode); let out; try { out = fn(t.objectStore('f')); } catch (e) { return rej(e); } t.oncomplete = () => res(out && 'result' in out ? out.result : out); t.onerror = t.onabort = () => rej(t.error || new Error('فشل التخزين')); }); };
  /* قراءة وصف الملفات بمؤشر (سجلاً سجلاً) بدل تحميلها كلها دفعة واحدة في الذاكرة */
  const all = async (ns) => { const db = await open(); return new Promise((res, rej) => { const out = [], c = db.transaction('f', 'readonly').objectStore('f').index('ns').openCursor(IDBKeyRange.only(ns)); c.onsuccess = () => { const k = c.result; if (!k) return res(out); const v = k.value; out.push({ id: v.id, key: v.key, name: v.name, type: v.type, size: v.size, t: v.t }); k.continue(); }; c.onerror = () => rej(c.error); }); };
  const Vault = {
    MAX_FILE,
    async list(ns) { return (await all(ns)).map((r) => ({ key: r.key, name: r.name, type: r.type, size: r.size, t: r.t })); },
    async usage(ns) { const l = await all(ns); return { count: l.length, bytes: l.reduce((a, r) => a + r.size, 0) }; },
    async put(ns, key, name, type, data) {
      if (!(data instanceof ArrayBuffer)) throw new Error('بيانات غير صالحة');
      if (data.byteLength > MAX_FILE) throw new Error('الملف أكبر من 1 غيغابايت');
      const rec = { id: ns + '\u0001' + key, ns, key, name: String(name || key).slice(0, 120), type: String(type || 'application/octet-stream').slice(0, 100), size: data.byteLength, t: Date.now(), data };
      try { await tx('readwrite', (s) => s.put(rec)); } catch (e) { throw new Error(e && e.name === 'QuotaExceededError' ? 'امتلأت مساحة الجهاز: احذف ملفات أو حرّر مساحة' : String(e && e.message || e)); } return true;
    },
    async get(ns, key) { const r = await tx('readonly', (s) => s.get(ns + '\u0001' + key)); return r ? { name: r.name, type: r.type, size: r.size, data: r.data } : null; },
    async del(ns, key) { await tx('readwrite', (s) => s.delete(ns + '\u0001' + key)); return true; },
    async clear(ns) { try { const l = await all(ns); await tx('readwrite', (s) => l.forEach((r) => s.delete(r.id))); } catch (_) { /* لا شيء */ } },
  };
  window.Vault = Vault;
})();
