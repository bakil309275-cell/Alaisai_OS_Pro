/* متجر الإضافات: كتالوج يُنشر مع التطبيق (catalog/index.json)، فتصل الإضافات الجديدة والتحديثات لكل المستخدمين */
(function () {
  const E = UI.esc;
  const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
  const PATH_RE = /^addons\/[\w-]{1,40}\.alaisai-addon\.json$/;

  const Catalog = {
    index: null,

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
      el.innerHTML = '<div class="sys-pad"><div class="panel"><input class="field" type="search" id="cat-q" placeholder="🔍 ابحث في الإضافات" aria-label="بحث في الإضافات"></div><div id="cat-list" aria-live="polite"><p style="color:var(--muted)">⏳ جارٍ تحميل الكتالوج…</p></div></div>';
      const list = el.querySelector('#cat-list'), q = el.querySelector('#cat-q');
      const draw = () => {
        const s = q.value.trim().toLowerCase();
        const items = (this.index || []).filter((e) => !s || (e.name + ' ' + e.description).toLowerCase().includes(s));
        list.innerHTML = items.length ? items.map((e) => {
          const st = this.state(e);
          return `<div class="admin-row"><span class="ico" aria-hidden="true">${E(e.icon)}</span><span class="grow" style="white-space:normal"><b>${E(e.name)}</b> <span class="badge">v${E(e.version)}</span><br><small style="color:var(--muted)">${E(e.description)}</small></span>
            ${st === 'current' ? '<span class="badge">✔ مثبّتة</span>' : `<button class="btn btn-sm ${st === 'update' ? 'btn-primary' : 'btn-success'}" data-cat="${E(e.id)}">${st === 'update' ? '⬆ تحديث' : '⬇ تثبيت'}</button>`}</div>`; }).join('')
          : '<p style="color:var(--muted)">لا نتائج</p>';
      };
      q.addEventListener('input', draw);
      list.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-cat]'); if (!b) return;
        const entry = this.index.find((x) => x.id === b.dataset.cat); if (!entry) return;
        b.disabled = true; b.textContent = '⏳';
        try { const name = await this.install(entry); if (name) UI.toast('✅ تم التثبيت وظهرت الإضافة على سطح المكتب', 'success'); }
        catch (e) { UI.toast('❌ ' + e.message, 'error', 5000); }
        draw();
      });
      try { await this.fetchIndex(); draw(); }
      catch (e) { list.innerHTML = `<div class="notice danger">⚠️ ${E(navigator.onLine ? e.message : 'لا يوجد اتصال بالإنترنت. يعمل المتجر عند توفر الاتصال أو بعد فتحه مرة سابقاً.')}</div>`; }
    },
  };
  window.Catalog = Catalog;
})();
