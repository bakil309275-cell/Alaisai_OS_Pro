/* متجر الإضافات: كتالوج يُنشر مع التطبيق (catalog/index.json)، فتصل الإضافات الجديدة والتحديثات لكل المستخدمين */
(function () {
  const E = UI.esc;
  const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
  const PATH_RE = /^addons\/[\w.-]{1,90}\.alaisai-addon\.json$/;

  const Catalog = {
    index: null,
    // إضافات حُذفت نهائياً: تُخفى من متجر هذا الجهاز كي لا تعود قابلة للتثبيت (محلي، غير مُزامَن)
    hidden: new Set(),
    async loadHidden() { try { const v = await Store.get('hidden_addons'); this.hidden = new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []); } catch (_) {} },
    isHidden(n) { return this.hidden.has(n); },
    async hide(n) { this.hidden.add(n); try { await Store.set('hidden_addons', [...this.hidden]); } catch (_) {} },
    async unhideAll() { this.hidden.clear(); try { await Store.set('hidden_addons', []); } catch (_) {} },

    async fetchIndex() {
      const r = await fetch('catalog/index.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('تعذّر تحميل الكتالوج (' + r.status + ')');
      const j = await r.json();
      if (!j || j.format !== 'alaisai-catalog' || j.version !== 1 || !Array.isArray(j.addons)) throw new Error('كتالوج غير صالح');
      this.index = j.addons.filter((a) => a && Addons.NAME_RE.test(a.id || '') && PATH_RE.test(a.file || '') && /^\d+\.\d+\.\d+$/.test(a.version || '') && /^[0-9a-f]{64}$/.test(a.sha256 || ''))
        .map((a) => ({ id: a.id, name: String(a.name || a.id).slice(0, 60), icon: String(a.icon || '🧩').slice(0, 8), version: a.version,
          description: String(a.description || '').slice(0, 200), author: String(a.author || '').slice(0, 60), file: a.file, sha256: a.sha256 }));
      return this.index;
    },

    async fetchPackage(entry) {
      const r = await fetch('catalog/' + entry.file, { cache: 'no-cache' });
      if (!r.ok) throw new Error('تعذّر تنزيل الإضافة (' + r.status + ')');
      const text = await r.text();
      if (hex(Sec.sha256(new TextEncoder().encode(text))) !== entry.sha256) throw new Error('فشل التحقق من سلامة الملف (البصمة لا تطابق). أعد المحاولة.');
      return JSON.parse(text);
    },

    installed(id) { return Addons.get(id); },
    installedVersion(id) { const a = Addons.get(id); const m = a && Addons.manifest(a).manifest; return m ? m.version : null; },
    state(entry) {
      const v = this.installedVersion(entry.id);
      if (!Addons.get(entry.id)) return 'new';
      if (v && Addons.cmpVer(entry.version, v) > 0) return 'update';
      return 'current';
    },

    async install(entry, { silent = false } = {}) {
      const pkg = await this.fetchPackage(entry);
      if (pkg.id !== entry.id) throw new Error('الحزمة لا تطابق الكتالوج');
      let name;
      if (silent) { const { addon } = Addons.validatePackage(pkg); Addons.put(addon, 'catalog'); name = addon.name; }
      else name = await Addons.installPackage(pkg, 'catalog');
      if (name && !Addons.isInstalled(name)) Addons.install(name);
      return name;
    },

    // تحديثات الإضافات المثبّتة من المتجر (تُستدعى عند التشغيل)
    async checkUpdates() {
      if (!navigator.onLine) return [];
      try {
        const idx = await this.fetchIndex();
        return idx.filter((e) => { const a = Addons.get(e.id); return a && a.source === 'catalog' && this.state(e) === 'update'; });
      } catch (_) { return []; }
    },
    async updateAll(list) {
      let n = 0;
      for (const e of list) { try { if (await this.install(e, { silent: true })) n++; } catch (err) { UI.toast('❌ ' + e.name + ': ' + err.message, 'error'); } }
      OS.renderDesktop(); return n;
    },

    // ---------- الواجهة ----------
    open() { OS.openSystem('🛍️ متجر الإضافات', (el) => this.mount(el)); },
    async mount(el) {
      await this.loadHidden();
      el.innerHTML = '<div class="sys-pad"><div class="panel"><input class="field" type="search" id="cat-q" placeholder="🔍 ابحث في الإضافات" aria-label="بحث في الإضافات"></div><div id="cat-list" aria-live="polite"><p style="color:var(--muted)">⏳ جارٍ تحميل الكتالوج…</p></div></div>';
      const list = el.querySelector('#cat-list'), q = el.querySelector('#cat-q');
      const rows = () => {
        const cat = (this.index || []).filter((e) => !this.isHidden(e.id)), ids = new Set(cat.map((e) => e.id));
        const repo = (window.RepoAddons ? RepoAddons.items : []).filter((it) => !ids.has(it.name) && !this.isHidden(it.name));
        const out = cat.map((e) => ({ kind: 'cat', id: e.id, name: e.name, icon: e.icon, version: e.version, description: e.description, state: this.state(e) }));
        repo.forEach((it) => {
          const a = Addons.get(it.name), m = a && Addons.manifest(a).manifest;
          const meta = m || it.meta || {};
          out.push({ kind: 'repo', id: it.name, name: (meta && meta.name) || it.name, icon: (meta && meta.icon) || '🧩', version: (meta && meta.version) || '', description: (meta && meta.description) || 'من مستودعك: addons/' + it.name,
            state: it.state === 'new' ? 'new' : it.state === 'gone' ? 'gone' : it.state === 'current' || it.state === 'localnewer' ? 'current' : 'update' });
        });
        const known = new Set(out.map((x) => x.id));
        Addons.list().filter((a) => !known.has(a.name) && !this.isHidden(a.name)).forEach((a) => {
          const m = Addons.manifest(a).manifest || { name: a.name, icon: '🧩', version: '', description: '' };
          out.push({ kind: 'local', id: a.name, name: m.name, icon: m.icon, version: m.version, description: m.description || 'إضافة على هذا الجهاز', state: 'current' });
        });
        return out;
      };
      const draw = () => {
        const s = q.value.trim().toLowerCase();
        const items = rows().filter((e) => !s || (e.name + ' ' + e.description).toLowerCase().includes(s));
        list.innerHTML = items.length ? items.map((e) => {
          const inst = Addons.isInstalled(e.id);
          const act = e.state === 'gone' ? `<button class="btn btn-sm" data-republish="${E(e.id)}">↻ إعادة نشر</button>` : e.state === 'current' ? '' : `<button class="btn btn-sm ${e.state === 'update' ? 'btn-primary' : 'btn-success'}" data-${e.kind}="${E(e.id)}">${e.state === 'update' ? '⬆ تحديث' : '⬇ تثبيت'}</button>`;
          const tail = e.state === 'gone' ? '' : e.state === 'current' ? (inst ? '<span class="badge">✔ مثبّتة</span> ' : `<button class="btn btn-sm btn-success" data-${e.kind === 'local' ? 'local' : e.kind}="${E(e.id)}">⬇ تثبيت</button> `) : '';
          const un = inst ? `<button class="btn btn-sm" data-uninst="${E(e.id)}" aria-label="حذف ${E(e.name)} من سطح المكتب">🗑 حذف</button>` : '';
          const del = `<button class="btn btn-sm btn-danger" data-del="${E(e.id)}" aria-label="حذف ${E(e.name)} نهائياً">⛔ حذف نهائي</button>`;
          return `<div class="admin-row cat-row"><span class="ico" aria-hidden="true">${E(e.icon)}</span><span class="grow"><b>${E(e.name)}</b> ${e.version ? `<span class="badge">v${E(e.version)}</span>` : ''}${e.kind === 'repo' ? ' <span class="badge">مستودعك</span>' : ''}${e.state === 'new' ? ' <span class="badge">جديد</span>' : ''}${e.state === 'gone' ? ' <span class="badge">محذوفة من المستودع</span>' : ''}<br><small style="color:var(--muted)">${E(e.description)}</small></span><span class="actions">${tail}${act}${un}${del}</span></div>`;
        }).join('') : `<div class="notice ok" role="status">${s ? 'لا نتائج' : '🧩 لا توجد إضافات في المتجر بعد. ستظهر هنا الإضافات التي تُنشر في مجلد <code>addons/</code> بالمستودع، أو تنشئها من «الملفات والإضافات» في لوحة الإدارة.'}</div>`;
        if (this.hidden.size) list.insertAdjacentHTML('beforeend', `<p style="margin-top:12px"><button class="btn btn-sm" data-unhide="1">♻️ إظهار الإضافات المحذوفة نهائياً (${this.hidden.size})</button></p>`);
      };
      q.addEventListener('input', draw);
      list.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-cat],[data-repo],[data-local],[data-del],[data-uninst],[data-republish],[data-unhide]'); if (!b) return;
        try {
          if (b.dataset.unhide) {
            await this.unhideAll(); UI.toast('♻️ أُعيد إظهار الإضافات المحذوفة في المتجر', 'success');
          } else if (b.dataset.republish) {
            b.disabled = true; await RepoAddons.republish(b.dataset.republish); UI.toast('↻ أُعيد نشر الإضافة في المستودع', 'success');
          } else if (b.dataset.uninst) {
            Addons.uninstall(b.dataset.uninst); // إزالة الأيقونة فقط: الإضافة وملفاتها وبياناتها تبقى وتُثبَّت متى شئت
            UI.toast('🗑 أُزيلت من سطح المكتب. ما زالت في المتجر ويمكنك تثبيتها مجدداً', 'success', 4500);
          } else if (b.dataset.local) {
            Addons.install(b.dataset.local); UI.toast('✅ تم التثبيت وظهرت الإضافة على سطح المكتب', 'success');
          } else if (b.dataset.del) {
            const name = b.dataset.del, remote = window.RepoAddons && RepoAddons.enabled();
            const scope = remote ? ' ومن مجلد addons/ ومن متجر الإضافات العام في مستودعك' : '';
            const sure = await UI.dialog({ title: '⛔ حذف نهائي', okText: 'نعم، احذف نهائياً', cancelText: 'تراجع', danger: true,
              message: `هل أنت متأكد من حذف الإضافة «${name}» نهائياً؟\nستُحذف مع ملفاتها وبياناتها من هذا الجهاز${scope}، ولن تعود قابلة للتثبيت.` + (remote ? '' : '\n(لحذفها من المستودع والمتجر لكل المستخدمين فعّل المزامنة بصلاحية المالك، أو احذف مجلدها من GitHub.)') + '\nلا يمكن التراجع عن هذا الإجراء.' });
            if (!sure) return;
            if (remote && !(await Admin.authenticate())) return;
            const r = await RepoAddons.purge(name);
            UI.toast(r.remoteError ? '⛔ حُذفت من هذا الجهاز. تعذّر الحذف من المستودع: ' + r.remoteError : '⛔ حُذفت نهائياً' + (r.remote ? ' من الجهاز والمستودع والمتجر' : ' من هذا الجهاز'), r.remoteError ? 'warn' : 'success', r.remoteError ? 8000 : 4000);
          } else if (b.dataset.cat) {
            const entry = this.index.find((x) => x.id === b.dataset.cat); if (!entry) return;
            b.disabled = true; b.textContent = '⏳';
            if (await this.install(entry)) UI.toast('✅ تم التثبيت وظهرت الإضافة على سطح المكتب', 'success');
          } else {
            b.disabled = true; b.textContent = '⏳';
            if (await RepoAddons.install(b.dataset.repo)) UI.toast('✅ تم التثبيت من مستودعك', 'success');
          }
        } catch (e) { UI.toast('❌ ' + e.message, 'error', 5000); }
        draw();
      });
      if (window.RepoAddons && RepoAddons.enabled()) RepoAddons.scan().then(draw);
      try { await this.fetchIndex(); draw(); }
      catch (e) { list.innerHTML = `<div class="notice danger">⚠️ ${E(navigator.onLine ? e.message : 'لا يوجد اتصال بالإنترنت. يعمل المتجر عند توفر الاتصال أو بعد فتحه مرة سابقاً.')}</div>`; }
    },
  };
  window.Catalog = Catalog;
})();
