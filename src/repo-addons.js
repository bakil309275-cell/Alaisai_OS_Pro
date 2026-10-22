/* ربط الإضافات بمستودع GitHub في الاتجاهين، بملفات عادية قابلة للقراءة في مجلد addons/<الاسم>/:
 *  - التطبيق ← المستودع: بعد كل رفع ناجح تُنشر ملفات الإضافات التي أنشأتَها أو استوردتَها (mirror).
 *  - المستودع ← التطبيق: أي مجلد جديد داخل addons/ يظهر في المتجر ليُثبَّت، والمحدَّث منه يصل تلقائياً
 *    إلى الإضافات الموجودة عندك ما لم تكن عدّلتها محلياً (وإلا يُسأل المستخدم).
 * يعتمد على رمز المزامنة نفسه (Sync). لا يعمل بدون إعداد المزامنة. */
(function () {
  const DIR = 'addons';
  const enc = encodeURIComponent;
  const encPath = (p) => p.split('/').map(enc).join('/');
  const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

  const RepoAddons = {
    items: [], scanned: 0, _scanning: null,

    enabled() { return !!(Sync.cfg && Sync.token && Sync.cfg.mirror !== false); },
    tracked() { return (Sync.cfg.addonShas = Sync.cfg.addonShas || {}); },

    // بصمة Git blob لنص: sha1("blob <len>\0" + bytes) لنقارن مع ما في المستودع دون تنزيله
    async blobSha(text) {
      const body = new TextEncoder().encode(text), head = new TextEncoder().encode('blob ' + body.length + '\0');
      const all = new Uint8Array(head.length + body.length); all.set(head); all.set(body, head.length);
      return hex(new Uint8Array(await crypto.subtle.digest('SHA-1', all)));
    },
    async localShas(addon) { const o = {}; for (const f of addon.files) o[f.name] = await this.blobSha(f.content); return o; },
    same(a, b) { const ka = Object.keys(a || {}), kb = Object.keys(b || {}); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); },

    // شجرة المستودع تحت addons/: { name: { file: {sha, path} } }
    async remoteTree() {
      const r = await Sync.gh(`${Sync.base()}/git/trees/${enc(Sync.cfg.branch)}?recursive=1`);
      if (r.status === 404 || r.status === 409) return {};
      if (!r.ok) throw new Sync.SyncError('http', 'GitHub أعاد الخطأ ' + r.status);
      const j = await r.json(), out = {};
      for (const t of j.tree || []) {
        if (t.type !== 'blob') continue;
        const m = /^addons\/([^/]+)\/([^/]+)$/.exec(t.path);
        if (!m || !Addons.NAME_RE.test(m[1]) || !Addons.FILE_RE.test(m[2])) continue;
        (out[m[1]] = out[m[1]] || {})[m[2]] = { sha: t.sha, path: t.path };
      }
      return out;
    },
    shaMap(files) { const o = {}; for (const k of Object.keys(files)) o[k] = files[k].sha; return o; },

    // يفحص المستودع ويحدّث this.items. الحالات: new / update / conflict / current
    async scan({ quiet = true } = {}) {
      if (!this.enabled() || !navigator.onLine) return this.items;
      if (this._scanning) return this._scanning;
      await Catalog.loadHidden();
      this._scanning = (async () => {
        try {
          const tree = await this.remoteTree(), t = this.tracked(), items = [];
          let changed = false, auto = 0;
          for (const name of Object.keys(tree).sort()) {
            const files = tree[name];
            if (!files['manifest.json']) continue;
            const remoteMap = this.shaMap(files), local = Addons.get(name);
            let state = 'new';
            if (local) {
              const lm = await this.localShas(local);
              if (this.same(lm, remoteMap)) { state = 'current'; if (!this.same(t[name], remoteMap)) { t[name] = remoteMap; changed = true; } }
              else if (t[name] && this.same(t[name], remoteMap)) state = 'localnewer'; // تعديل محلي سيُنشر عند الرفع
              else if (t[name] && this.same(t[name], lm)) state = 'update';           // تغيّر في المستودع فقط
              else state = 'conflict';
            }
            const it = { name, files, remoteMap, state };
            if (state === 'new' || state === 'update') { try { it.meta = JSON.parse(await this.fetchFile(files['manifest.json'].path)); } catch (_) { it.meta = {}; } }
            items.push(it);
          }
          for (const a of Addons.list()) if (a.source !== 'catalog' && t[a.name] && !tree[a.name]) items.push({ name: a.name, files: {}, remoteMap: {}, state: 'gone' });
          this.items = items; this.scanned = Date.now();
          if (changed) await Sync.saveCfg();
          // تحديث صامت لما لم يُعدَّل محلياً
          for (const it of items.filter((x) => x.state === 'update')) { try { await this.fetchInto(it, { keepDesktop: true }); auto++; } catch (_) {} }
          if (auto) { items.forEach((x) => { if (x.state === 'update') x.state = 'current'; }); if (!quiet) UI.toast(`⬇ وصلت تحديثات ${auto} إضافة من المستودع`, 'success'); }
          this.seen = this.seen || [];
          const fresh = items.filter((x) => x.state === 'new' && !this.seen.includes(x.name) && !Catalog.isHidden(x.name));
          if (fresh.length) { this.seen.push(...fresh.map((x) => x.name)); UI.toast(`🧩 إضافات جديدة في مستودعك: ${fresh.map((x) => x.name).join('، ')} — افتح المتجر لتثبيتها`, 'info', 7000); }
          return this.items;
        } catch (e) { console.warn('RepoAddons.scan', e); return this.items; }
        finally { this._scanning = null; }
      })();
      return this._scanning;
    },

    async fetchFile(path) {
      const r = await Sync.gh(`${Sync.base()}/contents/${encPath(path)}?ref=${enc(Sync.cfg.branch)}`, { accept: 'application/vnd.github.raw+json' });
      if (!r.ok) throw new Error('تعذّر تنزيل ' + path + ' (' + r.status + ')');
      return r.text();
    },

    // ينزّل إضافة المستودع إلى المستكشف (ويثبّتها على سطح المكتب إن طُلب)
    async fetchInto(it, { install = false, keepDesktop = false } = {}) {
      const files = [];
      for (const n of Object.keys(it.files)) files.push({ name: n, content: await this.fetchFile(it.files[n].path) });
      const { addon } = Addons.validatePackage({ format: 'alaisai-addon', version: 1, id: it.name, files });
      Addons.put(addon, 'repo');
      this.tracked()[it.name] = it.remoteMap; await Sync.saveCfg();
      if (install && !Addons.isInstalled(it.name)) Addons.install(it.name);
      return it.name;
    },

    async install(name) {
      const it = this.items.find((x) => x.name === name); if (!it) throw new Error('الإضافة لم تعد في المستودع');
      if (it.state === 'conflict' && !(await UI.confirm(`الإضافة «${name}» تغيّرت في المستودع وعدّلتَها هنا أيضاً. اعتماد نسخة المستودع واستبدال تعديلاتك؟`, { title: 'تعارض', okText: 'اعتماد نسخة المستودع' }))) return null;
      const n = await this.fetchInto(it, { install: true });
      const it2 = this.items.find((x) => x.name === name); if (it2) it2.state = 'current';
      return n;
    },

    async putFile(path, text, sha) {
      const r = await Sync.gh(`${Sync.base()}/contents/${encPath(path)}`, { method: 'PUT',
        body: { message: 'Alaisai: ' + path, content: Sec.textToB64(text), branch: Sync.cfg.branch, ...(sha ? { sha } : {}) } });
      if (!r.ok) throw new Sync.SyncError('http', 'تعذّر نشر ' + path + ' (' + r.status + ')');
    },
    async delFile(path, sha) {
      // قائمة بيضاء: لا يُحذف أي شيء إلا ملفات إضافة واحدة بعينها (مصدرها أو حزمتها المبنية)
      if (!/^(addons\/[\w-]{1,40}\/[\w.\- ]{1,80}|catalog\/src\/[\w-]{1,40}\/[\w.\- ]{1,80}|catalog\/addons\/[\w-]{1,40}\.alaisai-addon\.json)$/.test(path)) throw new Error('مسار غير مسموح بحذفه');
      const r = await Sync.gh(`${Sync.base()}/contents/${encPath(path)}`, { method: 'DELETE', body: { message: 'Alaisai: حذف ' + path, sha, branch: Sync.cfg.branch } });
      if (!r.ok && r.status !== 404) throw new Sync.SyncError('http', 'تعذّر حذف ' + path + ' (' + r.status + ')');
    },

    async getFile(path) { // {sha, text} أو null
      const r = await Sync.gh(`${Sync.base()}/contents/${encPath(path)}?ref=${enc(Sync.cfg.branch)}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Sync.SyncError('http', 'GitHub أعاد الخطأ ' + r.status);
      const j = await r.json(); if (Array.isArray(j) || j.type !== 'file') return null;
      return { sha: j.sha, text: Sec.b64ToText(j.content.replace(/\s/g, '')) };
    },
    // ملفات الإضافة كلها في المستودع: المصدر (addons/ وcatalog/src/) والحزمة المبنية، ثم إزالتها من فهرس المتجر العام
    async purgeRemote(name) {
      const r = await Sync.gh(`${Sync.base()}/git/trees/${enc(Sync.cfg.branch)}?recursive=1`);
      if (!r.ok && r.status !== 404 && r.status !== 409) throw new Sync.SyncError('http', 'GitHub أعاد الخطأ ' + r.status);
      const blobs = r.ok ? ((await r.json()).tree || []).filter((t) => t.type === 'blob') : [];
      const mine = blobs.filter((t) => t.path.startsWith(`${DIR}/${name}/`) || t.path.startsWith(`catalog/src/${name}/`) || t.path === `catalog/addons/${name}.alaisai-addon.json`);
      let n = 0;
      for (const t of mine) { await this.delFile(t.path, t.sha); n++; }
      let index = false;
      if (blobs.some((t) => t.path === 'catalog/index.json')) {
        const f = await this.getFile('catalog/index.json');
        if (f) {
          const j = JSON.parse(f.text);
          if (j && Array.isArray(j.addons) && j.addons.some((a) => a && a.id === name)) {
            j.addons = j.addons.filter((a) => !(a && a.id === name));
            await this.putFile('catalog/index.json', JSON.stringify(j, null, 2) + '\n', f.sha); index = true;
          }
        }
      }
      delete this.tracked()[name]; await Sync.saveCfg();
      return { files: n, index };
    },

    // حذف نهائي: من هذا الجهاز (أيقونة وملفات وبيانات)، ومن المستودع والمتجر العام إن كان لك صلاحية المزامنة،
    // وتُخفى من متجر هذا الجهاز كي لا تعود قابلة للتثبيت. فشل الجزء البعيد لا يُعيد الإضافة محلياً.
    async purge(name) {
      if (!Addons.NAME_RE.test(name)) throw new Error('اسم غير صالح');
      const res = { local: false, remote: 0, index: false, remoteError: '', remoteTried: this.enabled() };
      if (Addons.get(name)) { Addons.remove(name); OS.renderDesktop(); res.local = true; }
      await Catalog.hide(name);
      if (this.enabled() && navigator.onLine) {
        try { const r = await this.purgeRemote(name); res.remote = r.files; res.index = r.index; }
        catch (e) { res.remoteError = e.message; }
      } else if (this.enabled()) res.remoteError = 'لا يوجد اتصال؛ لم تُحذف من المستودع بعد';
      this.items = this.items.filter((x) => x.name !== name);
      return res;
    },
    // إعادة نشر إضافة حُذفت من المستودع وما زالت عندك
    async republish(name) { delete this.tracked()[name]; await Sync.saveCfg(); this.items = this.items.filter((x) => x.name !== name); await this.mirror(); await this.scan(); },

    // ينشر ملفات الإضافات المحلية في addons/<الاسم>/ ويحذف ما حُذف محلياً. لا يمس ما تغيّر في المستودع.
    async mirror() {
      if (!this.enabled()) return { skipped: true };
      const tree = await this.remoteTree(), t = this.tracked();
      let wrote = 0, removed = 0;
      const put = async (path, text, sha) => { await this.putFile(path, text, sha); wrote++; };
      const del = async (path, sha) => { await this.delFile(path, sha); removed++; };
      for (const addon of Addons.list()) {
        if (addon.source === 'catalog') continue; // الكتالوج العام مصدره المستودع أصلاً
        const rf = tree[addon.name] || {}, rm = this.shaMap(rf), lm = await this.localShas(addon);
        if (this.same(lm, rm)) { t[addon.name] = rm; continue; }
        if (t[addon.name] && !Object.keys(rm).length) continue; // حُذفت من المستودع بعد نشرها: لا نعيد رفعها (تظهر في المتجر «محذوفة من المستودع»)
        if (t[addon.name] && !this.same(t[addon.name], rm)) continue; // تغيّر في المستودع: لا نكتب فوقه
        for (const f of addon.files) if (lm[f.name] !== (rf[f.name] || {}).sha) await put(`${DIR}/${addon.name}/${f.name}`, f.content, (rf[f.name] || {}).sha);
        for (const n of Object.keys(rf)) if (!(n in lm)) await del(rf[n].path, rf[n].sha);
        t[addon.name] = lm;
      }
      for (const name of Object.keys(t)) { // إضافات حُذفت محلياً بعد أن نشرناها
        if (Addons.get(name)) continue;
        const rf = tree[name];
        if (rf && this.same(this.shaMap(rf), t[name])) for (const n of Object.keys(rf)) await del(rf[n].path, rf[n].sha);
        delete t[name];
      }
      await Sync.saveCfg();
      return { wrote, removed };
    },
  };
  window.RepoAddons = RepoAddons;
})();
