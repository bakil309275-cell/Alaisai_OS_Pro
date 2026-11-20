/* مركز التخزين الموحّد: مساحة واحدة من مصادر غير محدودة العدد.
 * المصادر: محلي (خزنة الجهاز) • روابط (درايف/دروب بوكس/أي رابط) • WebDAV (نكست كلاود وغيره) • Google Drive • مجلد على جهازك (File System Access).
 * كلمات المرور ومعرّفات الوصول تُحفظ مشفّرة بمفتاح الجهاز وخارج النسخ الاحتياطية. الملفات نفسها تبقى عند مزوّدها. */
(function () {
  const E = UI.esc, K_SRC = 'cloud', K_SEC = 'cloudsec', K_IDX = 'poolidx', K_H = 'cloudfs';
  const FOLDER = 'AlaisaiPro', GFOLDER = 'العيسائي برو';
  const TYPES = { local: ['📱', 'هذا الجهاز'], link: ['🔗', 'مكتبة روابط'], webdav: ['🌐', 'WebDAV'], gdrive: ['🟢', 'Google Drive'], fsa: ['💽', 'مجلد على جهازك'] };
  const rid = () => 's' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
  const fmtSize = (n) => (n == null ? '—' : n < 1024 ? n + ' ب' : n < 1048576 ? Math.round(n / 1024) + ' ك.ب' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' م.ب' : (n / 1073741824).toFixed(2) + ' غ.ب');
  const b64 = (t) => btoa(unescape(encodeURIComponent(t)));
  const safe = (s) => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'ملف';
  const norm = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (_) { return ''; } };

  /** يحوّل روابط المشاركة الشائعة إلى رابط تنزيل مباشر عند الإمكان */
  function direct(url) {
    try {
      const u = new URL(url), h = u.hostname;
      if (/(^|\.)drive\.google\.com$/.test(h)) { const m = /\/d\/([\w-]{10,})/.exec(u.pathname) || [null, u.searchParams.get('id')]; if (m[1]) return 'https://drive.google.com/uc?export=download&id=' + m[1]; }
      if (/(^|\.)dropbox\.com$/.test(h)) { u.searchParams.set('dl', '1'); return u.href; }
      if (/(^|\.)1drv\.ms$|onedrive\.live\.com$/.test(h)) return url;
    } catch (_) { /* لا شيء */ }
    return url;
  }

  // ---------- المزوّدون: list / put / get / del / quota ----------
  const dav = (s, sec) => {
    const base = s.url.replace(/\/+$/, '') + '/' + FOLDER + '/', auth = { Authorization: 'Basic ' + b64(s.user + ':' + (sec.pass || '')) };
    const rq = (url, o = {}) => fetch(url, Object.assign({ cache: 'no-store' }, o, { headers: Object.assign({}, auth, o.headers || {}) }));
    let ready = false; const ensure = async () => { if (ready) return; const r = await rq(base, { method: 'MKCOL' }); if (![201, 405, 301, 200].includes(r.status) && r.status !== 409) { if (r.status === 401) throw new Error('بيانات الدخول غير صحيحة'); } ready = true; };
    return {
      async list() {
        await ensure(); const r = await rq(base, { method: 'PROPFIND', headers: { Depth: '1', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/><d:resourcetype/></d:prop></d:propfind>' });
        if (r.status === 401) throw new Error('بيانات الدخول غير صحيحة'); if (r.status >= 400) throw new Error('تعذّر قراءة المجلد (' + r.status + ')');
        const x = new DOMParser().parseFromString(await r.text(), 'application/xml'), out = [];
        Array.from(x.getElementsByTagNameNS('DAV:', 'response')).forEach((n) => {
          const href = decodeURIComponent((n.getElementsByTagNameNS('DAV:', 'href')[0] || {}).textContent || ''), name = href.replace(/\/+$/, '').split('/').pop();
          if (!name || name === FOLDER || n.getElementsByTagNameNS('DAV:', 'collection').length) return;
          const g = (t) => (n.getElementsByTagNameNS('DAV:', t)[0] || {}).textContent;
          out.push({ ref: name, name, size: +g('getcontentlength') || 0, type: g('getcontenttype') || '', t: Date.parse(g('getlastmodified')) || 0 });
        });
        return out;
      },
      async put(name, blob) { await ensure(); const n = safe(name), r = await rq(base + encodeURIComponent(n), { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } }); if (!r.ok) throw new Error(r.status === 507 ? 'امتلأت المساحة' : 'فشل الرفع (' + r.status + ')'); return { ref: n, size: blob.size }; },
      async get(ref) { const r = await rq(base + encodeURIComponent(ref)); if (!r.ok) throw new Error('الملف غير موجود'); return r.blob(); },
      async del(ref) { const r = await rq(base + encodeURIComponent(ref), { method: 'DELETE' }); if (!r.ok && r.status !== 404) throw new Error('فشل الحذف'); },
      async quota() { try { const r = await rq(base, { method: 'PROPFIND', headers: { Depth: '0', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:quota-available-bytes/><d:quota-used-bytes/></d:prop></d:propfind>' }); const x = new DOMParser().parseFromString(await r.text(), 'application/xml'); const a = +((x.getElementsByTagNameNS('DAV:', 'quota-available-bytes')[0] || {}).textContent), u = +((x.getElementsByTagNameNS('DAV:', 'quota-used-bytes')[0] || {}).textContent); return a >= 0 && u >= 0 ? { used: u, total: u + a } : null; } catch (_) { return null; } },
    };
  };

  let gsi = null;
  const loadGsi = () => gsi || (gsi = new Promise((res, rej) => { if (window.google && google.accounts && google.accounts.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('تعذّر تحميل تسجيل الدخول من Google (لا إنترنت؟)')); document.head.appendChild(s); }));
  const gtoks = {};
  async function gtoken(clientId, interactive) {
    const c = gtoks[clientId]; if (c && c.exp > Date.now() + 60000) return c.t;
    await loadGsi();
    return new Promise((res, rej) => {
      const tc = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: (r) => { if (r && r.access_token) { gtoks[clientId] = { t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }; res(r.access_token); } else rej(new Error('لم يكتمل تسجيل الدخول')); }, error_callback: () => rej(new Error('أُلغي تسجيل الدخول')) });
      tc.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    });
  }
  const gdrive = (s) => {
    const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3'; let fid = s.folder || null;
    const rq = async (url, o = {}) => { const t = await gtoken(s.clientId, false); const r = await fetch(url, Object.assign({}, o, { headers: Object.assign({ Authorization: 'Bearer ' + t }, o.headers || {}) })); if (r.status === 401) { delete gtoks[s.clientId]; throw new Error('انتهت الجلسة، أعد الربط'); } return r; };
    const folder = async () => {
      if (fid) return fid;
      const q = encodeURIComponent(`name='${GFOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`), r = await rq(`${API}/files?q=${q}&fields=files(id)`), j = await r.json();
      if (j.files && j.files[0]) fid = j.files[0].id; else { const c = await rq(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: GFOLDER, mimeType: 'application/vnd.google-apps.folder' }) }); fid = (await c.json()).id; }
      s.folder = fid; return fid;
    };
    return {
      async list() { const f = await folder(), q = encodeURIComponent(`'${f}' in parents and trashed=false`), r = await rq(`${API}/files?q=${q}&pageSize=1000&fields=files(id,name,size,mimeType,modifiedTime)`); if (!r.ok) throw new Error('تعذّر قراءة المجلد (' + r.status + ')'); return ((await r.json()).files || []).map((x) => ({ ref: x.id, name: x.name, size: +x.size || 0, type: x.mimeType || '', t: Date.parse(x.modifiedTime) || 0 })); },
      async put(name, blob) {
        const f = await folder(), bd = 'ab' + rid(), meta = JSON.stringify({ name: safe(name), parents: [f] });
        const body = new Blob([`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${bd}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${bd}--`]);
        const r = await rq(`${UP}/files?uploadType=multipart&fields=id,size`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body });
        if (!r.ok) throw new Error(r.status === 403 ? 'امتلأت مساحة Google Drive أو لا صلاحية' : 'فشل الرفع (' + r.status + ')'); const j = await r.json(); return { ref: j.id, size: +j.size || blob.size };
      },
      async get(ref) { const r = await rq(`${API}/files/${encodeURIComponent(ref)}?alt=media`); if (!r.ok) throw new Error('الملف غير موجود'); return r.blob(); },
      async del(ref) { const r = await rq(`${API}/files/${encodeURIComponent(ref)}`, { method: 'DELETE' }); if (!r.ok && r.status !== 404) throw new Error('فشل الحذف'); },
      async quota() { try { const r = await rq(`${API}/about?fields=storageQuota`), q = (await r.json()).storageQuota; return q && q.limit ? { used: +q.usage, total: +q.limit } : q ? { used: +q.usage, total: null } : null; } catch (_) { return null; } },
    };
  };

  const fsa = (s, handle) => {
    const perm = async () => { if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('لم يُسمح بالوصول للمجلد'); };
    return {
      async list() { await perm(); const out = []; for await (const [n, h] of handle.entries()) { if (h.kind !== 'file') continue; const f = await h.getFile(); out.push({ ref: n, name: n, size: f.size, type: f.type, t: f.lastModified }); } return out; },
      async put(name, blob) { await perm(); const n = safe(name), fh = await handle.getFileHandle(n, { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close(); return { ref: n, size: blob.size }; },
      async get(ref) { await perm(); return (await (await handle.getFileHandle(ref)).getFile()); },
      async del(ref) { await perm(); try { await handle.removeEntry(ref); } catch (e) { if (e.name !== 'NotFoundError') throw e; } },
      async quota() { return null; },
    };
  };

  const local = () => ({
    async list() { return (await Vault.list('cloud:local')).map((x) => ({ ref: x.key, name: x.name, size: x.size, type: x.type, t: x.t })); },
    async put(name, blob, ref) { const k = ref || 'f' + rid(); await Vault.put('cloud:local', k, safe(name), blob.type, await blob.arrayBuffer()); return { ref: k, size: blob.size }; },
    async get(ref) { const r = await Vault.get('cloud:local', ref); if (!r) throw new Error('الملف غير موجود'); return new Blob([r.data], { type: r.type }); },
    async del(ref) { await Vault.del('cloud:local', ref); },
    async quota() { try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, total: e.quota || null }; } catch (_) { return null; } },
  });

  const Cloud = {
    sources: [], sec: {}, idx: {}, handles: {}, def: 'auto', cfg: null,
    TYPES, direct, fmtSize,
    async init() {
      try { const c = (await Store.get(K_SRC)) || {}; this.sources = Array.isArray(c.sources) ? c.sources : []; this.def = c.def || 'auto'; } catch (_) { /* لا شيء */ }
      try { this.idx = (await Store.get(K_IDX)) || {}; } catch (_) { /* لا شيء */ }
      try { const k = await Sync.deviceKey(false), s = await Store.get(K_SEC); if (k && s) for (const id of Object.keys(s)) { try { this.sec[id] = JSON.parse(await Sec.open(k, s[id])); } catch (_) { /* لا شيء */ } } } catch (_) { /* لا شيء */ }
      try { this.handles = (await Store.get(K_H)) || {}; } catch (_) { this.handles = {}; }
    },
    async save() { await Store.set(K_SRC, { sources: this.sources, def: this.def }); },
    async saveIdx() { await Store.set(K_IDX, this.idx); },
    async saveSec() { const k = await Sync.deviceKey(true); if (!k) throw new Error('التخزين المشفّر غير متاح في هذا المتصفح'); const o = {}; for (const id of Object.keys(this.sec)) o[id] = await Sec.seal(k, JSON.stringify(this.sec[id])); await Store.set(K_SEC, o); },
    all() { return [{ id: 'local', type: 'local', name: 'هذا الجهاز' }].concat(this.sources); },
    get(id) { return this.all().find((s) => s.id === id); },
    prov(s) {
      if (s.type === 'local') return local();
      if (s.type === 'webdav') return dav(s, this.sec[s.id] || {});
      if (s.type === 'gdrive') return gdrive(s);
      if (s.type === 'fsa') { const h = this.handles[s.id]; if (!h) throw new Error('انقطع الوصول للمجلد، أعد ربطه'); return fsa(s, h); }
      return null;
    },
    /** إضافة مصدر. data: {type,name,...}. للروابط لا حاجة لمزوّد. */
    async addSource(data, secret, handle) {
      const s = Object.assign({ id: rid() }, data); this.sources.push(s);
      if (secret) { this.sec[s.id] = secret; await this.saveSec(); }
      if (handle) { this.handles[s.id] = handle; await Store.set(K_H, this.handles); }
      await this.save(); return s;
    },
    async removeSource(id) {
      this.sources = this.sources.filter((s) => s.id !== id); delete this.sec[id]; delete this.handles[id];
      Object.keys(this.idx).forEach((ns) => Object.keys(this.idx[ns]).forEach((k) => { if (this.idx[ns][k].src === id) delete this.idx[ns][k]; }));
      await this.save(); await this.saveIdx(); try { await this.saveSec(); await Store.set(K_H, this.handles); } catch (_) { /* لا شيء */ }
    },
    // ---------- الروابط ----------
    links(id) { const s = this.get(id); return (s && s.links) || []; },
    async addLink(id, name, url) { const s = this.get(id), u = norm(url); if (!s || !u) throw new Error('رابط غير صالح'); (s.links = s.links || []).push({ id: rid(), name: String(name || u).slice(0, 120), url: u, t: Date.now() }); await this.save(); },
    async delLink(id, lid) { const s = this.get(id); if (s) { s.links = (s.links || []).filter((l) => l.id !== lid); await this.save(); } },
    // ---------- الملفات ----------
    async list(id) { const s = this.get(id); if (!s) throw new Error('مصدر غير موجود'); if (s.type === 'link') return this.links(id).map((l) => ({ ref: l.id, name: l.name, size: null, type: 'link', t: l.t, url: l.url })); return this.prov(s).list(); },
    async quotaOf(id) { const s = this.get(id); try { const p = s && this.prov(s); return p ? await p.quota() : null; } catch (_) { return null; } },
    /** يختار مصدر الكتابة: المحدد، أو تلقائي = الجهاز ثم المصادر بترتيبها عند امتلاء الجهاز */
    writable() { return this.all().filter((s) => s.type !== 'link'); },
    async put(name, blob, opt = {}) {
      const order = opt.src ? [opt.src] : this.def !== 'auto' && this.get(this.def) ? [this.def] : this.writable().map((s) => s.id); let last = null;
      for (const id of order) {
        const s = this.get(id); if (!s || s.type === 'link') continue;
        try { const r = await this.prov(s).put(name, blob, opt.ref); return Object.assign({ src: id }, r); } catch (e) { last = e; if (opt.src || (e && e.name !== 'QuotaExceededError' && !/امتلأ/.test(e.message))) { if (opt.src) throw e; } }
      }
      throw last || new Error('لا توجد مساحة متاحة');
    },
    async getBlob(src, ref) { const s = this.get(src); if (!s) throw new Error('المصدر غير موجود'); return this.prov(s).get(ref); },
    async del(src, ref) { const s = this.get(src); if (!s) return; if (s.type === 'link') return this.delLink(src, ref); return this.prov(s).del(ref); },
    /** كل الملفات من كل المصادر (الفاشل منها يُبلَّغ عنه ولا يُسقط الباقي) */
    async listAll() {
      const out = [], errs = [];
      await Promise.all(this.all().map(async (s) => { try { (await this.list(s.id)).forEach((f) => out.push(Object.assign({ src: s.id, srcName: s.name }, f))); } catch (e) { errs.push({ src: s.id, name: s.name, msg: e.message }); } }));
      return { files: out.sort((a, b) => (b.t || 0) - (a.t || 0)), errs };
    },
    async totals() {
      let used = 0, total = 0, unknown = 0;
      await Promise.all(this.all().map(async (s) => { if (s.type === 'link') return; const q = await this.quotaOf(s.id); if (q) { used += q.used || 0; if (q.total) total += q.total; else unknown++; } else unknown++; }));
      return { used, total, unknown, count: this.all().length };
    },
    // ---------- فهرس الإضافات (Alaisai.pool) ----------
    async poolPut(ns, key, blob, name, src) {
      const old = (this.idx[ns] || {})[key]; const r = await this.put(name || key, blob, { src: src || undefined });
      if (old && (old.src !== r.src || old.ref !== r.ref)) { try { await this.del(old.src, old.ref); } catch (_) { /* لا شيء */ } }
      (this.idx[ns] = this.idx[ns] || {})[key] = { src: r.src, ref: r.ref, name: String(name || key).slice(0, 120), size: blob.size, type: blob.type || '', t: Date.now() }; await this.saveIdx(); return true;
    },
    async poolGet(ns, key) { const e = (this.idx[ns] || {})[key]; if (!e) return null; const b = await this.getBlob(e.src, e.ref); return { name: e.name, type: e.type, size: e.size, blob: b }; },
    async poolDel(ns, key) { const e = (this.idx[ns] || {})[key]; if (!e) return true; try { await this.del(e.src, e.ref); } catch (_) { /* لا شيء */ } delete this.idx[ns][key]; await this.saveIdx(); return true; },
    async poolClear(ns) { const m = this.idx[ns] || {}; for (const k of Object.keys(m)) { try { await this.del(m[k].src, m[k].ref); } catch (_) { /* لا شيء */ } } delete this.idx[ns]; await this.saveIdx(); },
    poolList(ns) { return Object.entries(this.idx[ns] || {}).map(([key, e]) => ({ key, name: e.name, size: e.size, type: e.type, t: e.t, src: e.src })); },

    // ---------- الواجهة ----------
    open() { OS.openSystem('💽 مساحات التخزين', (vp) => this.ui(vp)); },
    async ui(vp) {
      vp.innerHTML = '<div class="sys-pad hub"><p class="muted">اربط عدداً غير محدود من المصادر لتجتمع في مساحة واحدة: جهازك، درايف، WebDAV، مجلد على القرص، أو مكتبة روابط. الملفات تبقى عند مزوّدها، والأسرار مشفّرة على جهازك فقط.</p><div id="hub-sum" class="hub-sum"></div><div class="ctl-bar"><button class="btn btn-primary" data-h="add">＋ ربط مصدر</button><button class="btn" data-h="all">🗂 كل الملفات</button><button class="btn" data-h="def">⚙️ الكتابة الافتراضية</button></div><div id="hub-list"></div><div id="hub-view"></div></div>';
      vp.onclick = (e) => { const b = e.target.closest('[data-h]'); if (b) this.act(b.dataset.h, b.dataset, vp); };
      this.draw(vp);
    },
    async draw(vp) {
      const L = vp.querySelector('#hub-list'), S = vp.querySelector('#hub-sum'); if (!L) return;
      L.innerHTML = this.all().map((s) => `<div class="admin-row hub-src" data-id="${E(s.id)}"><span class="ico">${TYPES[s.type][0]}</span><span class="grow">${E(s.name)} <span class="badge">${TYPES[s.type][1]}</span><small class="muted" data-q="${E(s.id)}"></small></span><button class="btn btn-sm" data-h="browse" data-id="${E(s.id)}">تصفّح</button>${s.type !== 'link' ? `<button class="btn btn-sm" data-h="up" data-id="${E(s.id)}">⬆️ رفع</button>` : `<button class="btn btn-sm" data-h="addlink" data-id="${E(s.id)}">＋ رابط</button>`}${s.type !== 'local' ? `<button class="btn btn-sm btn-danger" data-h="rm" data-id="${E(s.id)}" aria-label="فصل">🗑</button>` : ''}</div>`).join('');
      S.textContent = 'جارٍ حساب المساحة…';
      this.all().forEach(async (s) => { if (s.type === 'link') { const n = this.links(s.id).length, el = L.querySelector(`[data-q="${s.id}"]`); if (el) el.textContent = ' • ' + n + ' رابط'; return; } const q = await this.quotaOf(s.id), el = L.querySelector(`[data-q="${s.id}"]`); if (el && q) el.textContent = ' • ' + fmtSize(q.used) + (q.total ? ' من ' + fmtSize(q.total) : ''); });
      const t = await this.totals(); if (!S.isConnected) return;
      S.innerHTML = `<div class="ctl-stats"><div><b>${t.count}</b><span>مصدر</span></div><div><b>${fmtSize(t.used)}</b><span>مستخدَم</span></div><div><b>${t.total ? fmtSize(t.total) : '—'}</b><span>السعة المعروفة${t.unknown ? ' +' + t.unknown + ' غير محدّد' : ''}</span></div></div>`;
    },
    pickFiles() { return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.onchange = () => res(Array.from(i.files)); i.click(); }); },
    async act(a, ds, vp) {
      const view = vp.querySelector('#hub-view');
      try {
        if (a === 'add') return this.addDialog(vp);
        if (a === 'def') {
          const v = await UI.dialog({ title: 'مصدر الكتابة الافتراضي', message: 'تلقائي: يُحفظ على الجهاز أولاً، وعند امتلائه ينتقل للمصدر التالي.', okText: 'حفظ', fields: [{ id: 'd', label: 'المصدر', type: 'select', value: this.def, options: [['auto', 'تلقائي (الجهاز ثم الباقي)']].concat(this.writable().map((s) => [s.id, s.name])) }] });
          if (v) { this.def = v.d; await this.save(); UI.toast('تم الحفظ', 'success'); } return;
        }
        if (a === 'rm') { const s = this.get(ds.id); if (!(await UI.confirm('فصل «' + s.name + '» عن العيسائي برو؟ لا تُحذف ملفاتك من هناك.', { okText: 'فصل' }))) return; await this.removeSource(ds.id); return this.draw(vp); }
        if (a === 'up') { const fl = await this.pickFiles(); if (!fl.length) return; let ok = 0; for (const f of fl) { try { await this.put(f.name, f, { src: ds.id }); ok++; } catch (e) { UI.toast(f.name + ': ' + e.message, 'error'); } } UI.toast('رُفع ' + ok + ' من ' + fl.length, ok ? 'success' : 'error'); this.draw(vp); if (view.dataset.src === ds.id) this.browse(vp, ds.id); return; }
        if (a === 'addlink') { const v = await UI.dialog({ title: 'إضافة رابط', okText: 'حفظ', fields: [{ id: 'n', label: 'الاسم', required: true, maxlength: 120 }, { id: 'u', label: 'الرابط (درايف، دروب بوكس، أي رابط)', required: true, maxlength: 600 }], validate: (x) => (norm(x.u.trim()) ? '' : 'رابط http/https غير صالح') }); if (!v) return; await this.addLink(ds.id, v.n.trim(), v.u.trim()); this.draw(vp); if (view.dataset.src === ds.id) this.browse(vp, ds.id); return; }
        if (a === 'browse') return this.browse(vp, ds.id);
        if (a === 'all') return this.browseAll(vp);
        if (a === 'open' || a === 'dl' || a === 'rmf') {
          const src = ds.src, ref = ds.ref, s = this.get(src);
          if (a === 'rmf') { if (!(await UI.confirm('حذف هذا الملف من «' + s.name + '»؟', { okText: 'حذف' }))) return; await this.del(src, ref); UI.toast('حُذف', 'success'); return view.dataset.src === 'all' ? this.browseAll(vp) : this.browse(vp, src); }
          if (s.type === 'link') { const l = this.links(src).find((x) => x.id === ref); return l && (a === 'dl' ? window.open(direct(l.url), '_blank', 'noopener') : window.open(l.url, '_blank', 'noopener')); }
          const blob = await this.getBlob(src, ref), url = URL.createObjectURL(blob), n = ds.name || 'ملف';
          if (a === 'open' && /^(image|video|audio)\/|pdf$/.test(blob.type)) { window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
          const x = document.createElement('a'); x.href = url; x.download = n; document.body.appendChild(x); x.click(); setTimeout(() => { URL.revokeObjectURL(url); x.remove(); }, 500);
        }
      } catch (e) { UI.toast(String(e.message || 'تعذّر تنفيذ العملية'), 'error'); }
    },
    fileRow(f) { const lk = f.type === 'link'; return `<div class="admin-row"><span class="ico">${lk ? '🔗' : /^image\//.test(f.type) ? '🖼' : /pdf/.test(f.type) ? '📕' : '📄'}</span><span class="grow">${E(f.name)} <small class="muted">${lk ? '' : fmtSize(f.size) + ' • '}${E(f.srcName || '')} ${f.t ? '• ' + new Date(f.t).toLocaleDateString('ar') : ''}</small></span><button class="btn btn-sm" data-h="open" data-src="${E(f.src)}" data-ref="${E(f.ref)}" data-name="${E(f.name)}">فتح</button><button class="btn btn-sm" data-h="dl" data-src="${E(f.src)}" data-ref="${E(f.ref)}" data-name="${E(f.name)}">⬇️</button><button class="btn btn-sm btn-danger" data-h="rmf" data-src="${E(f.src)}" data-ref="${E(f.ref)}" aria-label="حذف">🗑</button></div>`; },
    async browse(vp, id) {
      const v = vp.querySelector('#hub-view'), s = this.get(id); v.dataset.src = id; v.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
      try { const fl = (await this.list(id)).map((f) => Object.assign({ src: id, srcName: s.name }, f)); v.innerHTML = `<h4>${TYPES[s.type][0]} ${E(s.name)}</h4>` + (fl.length ? fl.map((f) => this.fileRow(f)).join('') : '<p class="muted">لا توجد ملفات هنا بعد.</p>'); }
      catch (e) { v.innerHTML = `<p class="muted">تعذّر القراءة: ${E(e.message)}</p>`; }
    },
    async browseAll(vp) {
      const v = vp.querySelector('#hub-view'); v.dataset.src = 'all'; v.innerHTML = '<p class="muted">جارٍ جمع الملفات من كل المصادر…</p>';
      const { files, errs } = await this.listAll();
      v.innerHTML = '<h4>🗂 كل الملفات (' + files.length + ')</h4><input class="field" type="search" data-hq placeholder="🔍 بحث" aria-label="بحث في الملفات">' + errs.map((x) => `<p class="muted">⚠️ ${E(x.name)}: ${E(x.msg)}</p>`).join('') + '<div data-hl>' + (files.map((f) => this.fileRow(f)).join('') || '<p class="muted">لا توجد ملفات.</p>') + '</div>';
      v.querySelector('[data-hq]').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); v.querySelector('[data-hl]').innerHTML = files.filter((f) => !q || f.name.toLowerCase().includes(q)).map((f) => this.fileRow(f)).join(''); };
    },
    async addDialog(vp) {
      const opts = [['link', '🔗 مكتبة روابط (درايف/دروب بوكس/أي رابط)'], ['webdav', '🌐 WebDAV (نكست كلاود، NAS…)'], ['gdrive', '🟢 Google Drive']].concat(window.showDirectoryPicker ? [['fsa', '💽 مجلد على جهازك']] : []);
      const t = await UI.dialog({ title: 'ربط مصدر تخزين', okText: 'التالي', fields: [{ id: 't', label: 'النوع', type: 'select', options: opts }] }); if (!t) return;
      if (t.t === 'link') { const v = await UI.dialog({ title: 'مكتبة روابط', message: 'اجمع روابط ملفاتك من أي سحابة في مكان واحد. لا تُنقل الملفات؛ تُفتح من مزوّدها.', okText: 'إنشاء', fields: [{ id: 'n', label: 'الاسم', value: 'روابطي', required: true, maxlength: 60 }] }); if (!v) return; await this.addSource({ type: 'link', name: v.n.trim(), links: [] }); return this.draw(vp); }
      if (t.t === 'webdav') {
        const v = await UI.dialog({ title: 'ربط WebDAV', message: 'مثال نكست كلاود: https://مزودك/remote.php/dav/files/اسمك . استخدم «كلمة مرور تطبيق». يلزم أن يسمح الخادم بطلبات CORS من هذا الموقع.', okText: 'اختبار وربط', fields: [{ id: 'n', label: 'الاسم', value: 'سحابتي', required: true, maxlength: 60 }, { id: 'u', label: 'رابط WebDAV', required: true, maxlength: 300 }, { id: 'user', label: 'المستخدم', required: true, maxlength: 80, autocomplete: 'off' }, { id: 'p', label: 'كلمة المرور', type: 'password', required: true, autocomplete: 'off' }], validate: (x) => (norm(x.u.trim()) ? '' : 'رابط غير صالح') });
        if (!v) return; const s = { type: 'webdav', name: v.n.trim(), url: norm(v.u.trim()), user: v.user.trim() };
        try { await dav(s, { pass: v.p }).list(); } catch (e) { return UI.toast('تعذّر الاتصال: ' + (e.message === 'Failed to fetch' ? 'الخادم لا يسمح بـ CORS أو لا اتصال' : e.message), 'error'); }
        await this.addSource(s, { pass: v.p }); UI.toast('تم الربط', 'success'); return this.draw(vp);
      }
      if (t.t === 'gdrive') {
        const def = (window.Control && Control.ch && Control.ch.gdriveClient) || '';
        const v = await UI.dialog({ title: 'ربط Google Drive', message: 'يصل التطبيق فقط إلى مجلد «' + GFOLDER + '» الذي ينشئه في درايفك. يلزم Client ID من Google Cloud (OAuth، تطبيق ويب، ويضاف هذا الموقع في Authorized JavaScript origins). إن وفّره المالك يظهر تلقائياً.', okText: 'تسجيل الدخول', fields: [{ id: 'n', label: 'الاسم', value: 'Google Drive', required: true, maxlength: 60 }, { id: 'c', label: 'Client ID', value: def, required: true, maxlength: 200 }], validate: (x) => (/^[\w.-]+\.apps\.googleusercontent\.com$/.test(x.c.trim()) ? '' : 'صيغة Client ID غير صحيحة') });
        if (!v) return; const s = { type: 'gdrive', name: v.n.trim(), clientId: v.c.trim() };
        try { await gtoken(s.clientId, true); await gdrive(s).list(); } catch (e) { return UI.toast('تعذّر الربط: ' + e.message, 'error'); }
        await this.addSource(s); UI.toast('تم الربط', 'success'); return this.draw(vp);
      }
      if (t.t === 'fsa') {
        let h; try { h = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (_) { return; }
        await this.addSource({ type: 'fsa', name: '💽 ' + h.name }, null, h); return this.draw(vp);
      }
    },
  };
  window.Cloud = Cloud;
})();
