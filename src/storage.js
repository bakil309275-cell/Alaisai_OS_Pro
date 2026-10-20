/* التخزين: IndexedDB + إصدار للبنية + تحقق/ترحيل + نسخ احتياطي دوّار */
(function () {
  const SCHEMA = 2;
  const MAX_CONTENT = 2_000_000, MAX_APPS = 200, MAX_NOTES = 2000, MAX_BACKUPS = 5;
  const TYPES = ['html', 'url', 'notes', 'addon'];
  const MAX_APPDATA = 256 * 1024; // لكل تطبيق/إضافة
  const rid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);

  const WELCOME = '<div style="padding:20px;text-align:center;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:15px;color:white;font-family:system-ui"><h1>أهلاً بك</h1><p>نظام العيسائي الاحترافي جاهز للعمل.</p><button onclick="alert(\'مرحباً!\')" style="padding:10px 20px;border:none;border-radius:8px;background:#4ade80;color:#04200f;cursor:pointer;margin-top:10px">انقر هنا</button></div>';

  const Store = {
    SCHEMA, db: null, useLS: false, recovered: false, _conn: null, _timer: null, _pending: null,

    // ---------- طبقة IndexedDB (مع احتياطي localStorage) ----------
    _open() {
      if (this._conn) return this._conn;
      this._conn = new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('no-idb'));
        const r = indexedDB.open('alaisai_os', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return this._conn;
    },
    async get(k) {
      if (this.useLS) { try { return JSON.parse(localStorage.getItem('alaisai_kv_' + k)); } catch (_) { return null; } }
      const db = await this._open();
      return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result ?? null); q.onerror = () => rej(q.error); });
    },
    async set(k, v) {
      if (this.useLS) { localStorage.setItem('alaisai_kv_' + k, JSON.stringify(v)); return; }
      const db = await this._open();
      return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k);
        tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
    },
    async del(k) {
      if (this.useLS) { localStorage.removeItem('alaisai_kv_' + k); return; }
      const db = await this._open();
      return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k);
        tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
    },

    // ---------- البيانات الافتراضية ----------
    defaults() {
      return {
        version: SCHEMA,
        config: { passHash: null, mustChange: false, visits: 0, lock: { fails: 0, until: 0 } },
        settings: { theme: 'auto', seenVersion: '' },
        registry: [
          { id: 'app_1', name: 'الترحيب', icon: '✨', type: 'html', content: WELCOME, order: 0 },
          { id: 'app_2', name: 'المتصفح', icon: '🌐', type: 'url', content: 'https://www.bing.com', order: 1 },
          { id: 'app_3', name: 'الملاحظات', icon: '📝', type: 'notes', content: '', order: 2 },
        ],
        notes: [], reports: [], appData: {},
        explorer: {
          system: [
            { name: 'config.json', content: '{\n  "version": "2.0.0",\n  "name": "Alaisai System"\n}' },
            { name: 'manifest.json', content: '{\n  "short_name": "AlaisaiPro",\n  "name": "المنظومة الاحترافية"\n}' },
          ],
          addons: [], labCode: '',
        },
      };
    },

    // ---------- التحقق والترحيل (يقبل صيغة v1 القديمة وv2 وملفات النسخ الاحتياطي) ----------
    async migrate(raw, extras = {}) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('بنية الملف غير صالحة');
      if (raw.encrypted) throw new Error('الملف مشفّر');
      if (raw.format === 'alaisai-backup' && raw.data) raw = raw.data;
      else if (raw.timestamp && raw.data && raw.data.registry) raw = raw.data; // نسخة تلقائية قديمة
      if (!Array.isArray(raw.registry)) throw new Error('الملف لا يحتوي قائمة تطبيقات (registry)');
      if (!raw.config || typeof raw.config !== 'object') throw new Error('الملف لا يحتوي الإعدادات (config)');
      if (Number(raw.version) > SCHEMA) throw new Error('الملف من إصدار أحدث من هذا التطبيق');

      const d = this.defaults();
      const cfg = raw.config;

      // كلمة المرور: لا نحتفظ أبداً بنص صريح
      let passHash = Sec.isHashRecord(cfg.passHash) ? cfg.passHash : null;
      let mustChange = !!cfg.mustChange;
      if (!passHash && typeof cfg.pass === 'string' && cfg.pass) {
        passHash = await Sec.hash(cfg.pass);
        if (Sec.passwordIssue(cfg.pass)) mustChange = true;
      }
      const visits = Math.max(0, Math.min(1e9, Math.floor(Number(cfg.visits ?? cfg.downloads) || 0)));

      const seen = new Set();
      const registry = raw.registry.filter((a) => a && typeof a === 'object').slice(0, MAX_APPS).map((a, i) => {
        let id = typeof a.id === 'string' && /^[\w-]{1,64}$/.test(a.id) ? a.id : rid();
        while (seen.has(id)) id = rid();
        seen.add(id);
        let type = TYPES.includes(a.type) ? a.type : null;
        let content = str(a.content, MAX_CONTENT);
        if (!type) { // تطبيقات الإصدار القديم
          const m = content.match(/^\s*<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>\s*<\/iframe>\s*$/i);
          if (a.id === 'app_3' || /id=["']note-area["']/.test(content)) { type = 'notes'; content = ''; }
          else if (m) { type = 'url'; content = m[1]; }
          else type = 'html';
        }
        if (type === 'addon' && !/^[\w-]{1,40}$/.test(content)) type = 'html';
        return { id, name: str(a.name, 60, 'بدون اسم') || 'بدون اسم', icon: str(a.icon, 8, '📦') || '📦',
          type, content, order: Number.isFinite(a.order) ? a.order : i };
      }).sort((x, y) => x.order - y.order).map((a, i) => ({ ...a, order: i }));

      const notes = (Array.isArray(raw.notes) ? raw.notes : []).filter((n) => n && typeof n === 'object')
        .slice(0, MAX_NOTES).map((n) => ({ id: str(n.id, 64) || rid(), title: str(n.title, 120), body: str(n.body, MAX_CONTENT),
          updated: Number(n.updated) || Date.now() }));
      if (extras.legacyNote && !notes.length) notes.push({ id: rid(), title: 'ملاحظتي', body: str(extras.legacyNote, MAX_CONTENT), updated: Date.now() });

      const reports = (Array.isArray(cfg.reports) ? cfg.reports : Array.isArray(raw.reports) ? raw.reports : [])
        .filter((r) => r && typeof r === 'object').slice(0, 500)
        .map((r) => ({ id: r.id || rid(), email: str(r.email, 200), text: str(r.text, 5000), ts: Number(r.ts) || Number(r.id) || Date.now() }));

      const fileList = (arr) => (Array.isArray(arr) ? arr : []).filter((f) => f && typeof f.name === 'string' && f.name.length <= 80)
        .slice(0, 200).map((f) => ({ name: f.name, content: str(f.content, 500000) }));
      const ex = raw.explorer && typeof raw.explorer === 'object' ? raw.explorer : extras.explorer || {};
      const explorer = {
        system: Array.isArray(ex.system) ? fileList(ex.system) : d.explorer.system,
        addons: (() => {
          const names = new Set();
          return (Array.isArray(ex.addons) ? ex.addons : []).filter((a) => a && /^[\w-]{1,40}$/.test(a.name || '') && !names.has(a.name) && names.add(a.name))
            .slice(0, 100).map((a) => ({ name: a.name, source: ['catalog', 'import', 'local'].includes(a.source) ? a.source : 'local',
              files: fileList(a.files).slice(0, 30) }));
        })(),
        labCode: str(ex.labCode, 500000),
      };

      // بيانات التطبيقات/الإضافات (يكتبها جسر Alaisai.storage)
      const appData = {};
      if (raw.appData && typeof raw.appData === 'object' && !Array.isArray(raw.appData)) {
        Object.keys(raw.appData).slice(0, 400).forEach((ns) => {
          if (!/^(addon:)?[\w-]{1,64}$/.test(ns) || ns === '__proto__') return;
          const src = raw.appData[ns]; if (!src || typeof src !== 'object') return;
          const out = Object.create(null); let size = 0;
          Object.keys(src).slice(0, 200).forEach((k) => {
            if (!/^[\w.:-]{1,64}$/.test(k) || typeof src[k] !== 'string') return;
            if (size + k.length + src[k].length > MAX_APPDATA) return;
            size += k.length + src[k].length; out[k] = src[k];
          });
          appData[ns] = Object.assign({}, out);
        });
      }

      const theme = ['auto', 'dark', 'light'].includes(raw.settings?.theme) ? raw.settings.theme : 'auto';
      const seenVersion = /^[\d.]{1,20}$/.test(raw.settings?.seenVersion || '') ? raw.settings.seenVersion : '';
      return { version: SCHEMA, config: { passHash, mustChange, visits, lock: { fails: 0, until: 0 } },
        settings: { theme, seenVersion }, registry, notes, reports, appData, explorer };
    },

    // ---------- التحميل (مع ترحيل بيانات localStorage القديمة) ----------
    async load() {
      try { await this._open(); } catch (_) { this.useLS = true; }
      let raw = null, legacy = false;
      try { raw = await this.get('db'); } catch (_) { this.useLS = true; }
      const ls = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
      if (!raw) { try { const j = JSON.parse(ls('alaisai_ultra_db')); if (j) { raw = j; legacy = true; } } catch (_) {} }

      const extras = {};
      if (legacy) {
        extras.legacyNote = ls('saved_note') || '';
        try { const s = JSON.parse(ls('alaisai_storage_isolation'));
          if (s && s.system) extras.explorer = { system: s.system.files, addons: s.addons?.folders, labCode: ls('isolated_lab_code') || '' };
        } catch (_) {}
      }

      let db;
      if (raw) {
        try { db = await this.migrate(raw, extras); }
        catch (e) {
          console.error('Alaisai: بيانات تالفة، حُفظت نسخة منها', e);
          try { await this.set('corrupt_' + Date.now(), raw); } catch (_) {}
          db = this.defaults(); this.recovered = true;
        }
      } else db = this.defaults();

      this.db = db;
      await this.flush();
      if (legacy && !this.recovered) { // حذف البيانات القديمة (فيها كلمة المرور نصاً) بعد التحقق من نجاح الحفظ
        const back = await this.get('db');
        if (back && back.version === SCHEMA) {
          try { Object.keys(localStorage).filter((k) => /^(alaisai_ultra_db|alaisai_auto_backup|saved_note|alaisai_storage_isolation|isolated_lab_|file_backup_|addon_.*_isolated)/.test(k))
            .forEach((k) => localStorage.removeItem(k)); } catch (_) {}
        }
      }
      try { navigator.storage?.persist?.(); } catch (_) {}
      return db;
    },

    // ---------- الحفظ ----------
    listeners: [],
    save() { // مؤجَّل 300ms، يعيد Promise يُحلّ بعد الكتابة
      this.listeners.forEach((f) => { try { f(); } catch (_) {} });
      if (!this._pending) {
        this._pending = new Promise((res) => { this._resolve = res; });
      }
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.flush(), 300);
      return this._pending;
    },
    async flush() {
      clearTimeout(this._timer);
      const res = this._resolve; this._pending = null; this._resolve = null;
      try { await this.set('db', JSON.parse(JSON.stringify(this.db))); }
      catch (e) { console.error('Alaisai: فشل الحفظ', e); window.UI?.toast('⚠️ تعذّر حفظ البيانات (المساحة ممتلئة؟)', 'error'); }
      if (res) res();
    },

    // ---------- النسخ الاحتياطي الدوّار ----------
    async listBackups() { return (await this.get('backups')) || []; },
    async addBackup(label = 'auto') {
      const list = await this.listBackups();
      const snap = JSON.parse(JSON.stringify(this.db)); snap.config.lock = { fails: 0, until: 0 };
      if (label === 'auto' && list[0] && JSON.stringify(list[0].data) === JSON.stringify(snap)) return false; // لا تغيير
      list.unshift({ id: rid(), ts: Date.now(), label, data: snap });
      list.length = Math.min(list.length, MAX_BACKUPS);
      await this.set('backups', list);
      return true;
    },
    async removeBackup(id) { await this.set('backups', (await this.listBackups()).filter((b) => b.id !== id)); },

    exportPayload() {
      const data = JSON.parse(JSON.stringify(this.db)); data.config.lock = { fails: 0, until: 0 };
      return { format: 'alaisai-backup', version: SCHEMA, exportedAt: new Date().toISOString(), data };
    },

    async replaceAll(raw, extras, label = 'pre-restore') { // يستبدل البيانات بعد التحقق ثم يحفظ
      const next = await this.migrate(raw, extras);
      await this.addBackup(label);
      this.db = next; await this.flush();
    },

    // ---------- تخزين التطبيقات (جسر Alaisai.storage) ----------
    appNs(app) { return app.type === 'addon' ? 'addon:' + app.content : app.id; },
    appDataSize(ns) { const d = this.db.appData[ns] || {}; return Object.keys(d).reduce((n, k) => n + k.length + d[k].length, 0); },

    async wipeAll() { // إعادة ضبط المصنع: يمسح كل شيء بما فيه أسرار المزامنة
      for (const k of ['db', 'backups', 'errlog', 'sync', 'secrets', 'devkey']) { try { await this.del(k); } catch (_) {} }
    },

    MAX_APPDATA, TYPES,
    rid,
  };

  window.Store = Store;
})();
