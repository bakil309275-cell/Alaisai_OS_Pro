/* مستكشف الملفات والإضافات + بيئة التجربة (iframe معزول) */
(function () {
  const E = UI.esc;
  const Explorer = {
    el: null, nav: { view: 'root' },
    crumbs(folder, dir) { // شريط المسار: الإضافة / مجلد / مجلد
      const parts = dir ? dir.split('/') : [];
      let acc = '', h = `<button class="btn btn-sm" data-ex="root">⬅ الرجوع</button> <span class="ltr" dir="ltr" style="display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center"><button class="btn btn-sm" data-ex="opendir" data-dir="">/${E(folder)}</button>`;
      parts.forEach((p) => { acc += (acc ? '/' : '') + p; h += ` / <button class="btn btn-sm" data-ex="opendir" data-dir="${E(acc)}">${E(p)}</button>`; });
      return h + '</span>';
    },

    data() { return Store.db.explorer; },
    files(folder) { return folder === 'system' ? this.data().system : Addons.get(folder)?.files; },
    size(c) { const b = new Blob([c]).size; return b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB'; },

    mount(el) {
      this.el = el; this.nav = { view: 'root' };
      el.onclick = (e) => { const b = e.target.closest('[data-ex]'); if (b) this.act(b.dataset.ex, b.dataset); };
      el.onkeydown = (e) => { const b = e.target.closest('[role=button][data-ex]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.act(b.dataset.ex, b.dataset); } };
      this.render();
    },

    render() {
      Viewer.unmount();
      const n = this.nav, d = this.data();
      let h = '';
      if (n.view === 'root') {
        h = `<div class="cards-2">
          <div class="cardbtn" role="button" tabindex="0" data-ex="open" data-folder="system"><div class="big">📁</div><b>ملفات النظام</b><p class="badge">${d.system.length} ملف</p></div>
          <div class="cardbtn" role="button" tabindex="0" data-ex="newaddon"><div class="big">➕</div><b>إضافة جديدة</b><p class="badge">${d.addons.length} إضافة</p></div>
          <div class="cardbtn" role="button" tabindex="0" data-ex="importaddon"><div class="big">📥</div><b>استيراد إضافة</b><p class="badge">ملف .alaisai-addon.json</p></div>
          <div class="cardbtn" role="button" tabindex="0" data-ex="store"><div class="big">🛍️</div><b>متجر الإضافات</b><p class="badge">تثبيت بنقرة</p></div></div>
          <div class="panel" style="margin-top:12px"><h4>🧩 الإضافات</h4>${d.addons.length ? d.addons.map((a) => {
            const m = Addons.manifest(a).manifest;
            return `<div class="file-item"><span class="name" role="button" tabindex="0" data-ex="open" data-folder="${E(a.name)}">${E(m ? m.icon : '🧩')} ${E(m ? m.name : a.name)}
              <span class="badge">v${E(m ? m.version : '?')}</span> ${Addons.isInstalled(a.name) ? '<span class="badge">🖥 على سطح المكتب</span>' : ''}</span></div>`; }).join('') :
            '<p style="color:var(--muted)">لا توجد إضافات بعد. أنشئ واحدة أو ثبّت من المتجر.</p>'}</div>
          <div class="notice ok">🧩 <b>الإضافة</b> مجلد ملفات (manifest.json وindex.html وmain.js وstyle.css) يتحوّل عند «تثبيت على سطح المكتب» إلى تطبيق حقيقي يعمل داخل بيئة معزولة، ويستطيع استخدام واجهة <code>Alaisai</code> للتخزين والإشعارات. أما «إضافة تطبيق جديد» في تبويب التطبيقات فهي لتطبيق من صفحة واحدة.</div>`;
      } else if (n.view === 'folder') {
        const files = this.files(n.folder) || [], isAddon = n.folder !== 'system', dir = n.dir || '';
        const addon = isAddon ? Addons.get(n.folder) : null, mr = addon ? Addons.manifest(addon) : null;
        const ls = Addons.listDir(files, dir), up = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
        h = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">${this.crumbs(n.folder, dir)}</div>
          ${mr && !dir ? (mr.error ? `<div class="notice danger">⚠️ ${E(mr.error)}</div>` : `<div class="notice ok">${E(mr.manifest.icon)} <b>${E(mr.manifest.name)}</b> — الإصدار ${E(mr.manifest.version)}${mr.manifest.description ? ' — ' + E(mr.manifest.description) : ''}</div>`) : ''}
          ${isAddon && !dir ? `<div class="panel"><button class="btn btn-primary" data-ex="preview">▶️ معاينة</button>
            ${Addons.isInstalled(n.folder) ? '<button class="btn" data-ex="uninstall">🗑 إزالة من سطح المكتب</button>' : '<button class="btn btn-success" data-ex="install">🖥 تثبيت على سطح المكتب</button>'}
            <button class="btn" data-ex="exportaddon">📤 تصدير</button><div class="lab-out" id="addon-preview" hidden style="height:380px"></div></div>` : ''}
          <div class="panel">
            ${dir ? `<div class="file-item"><span class="name" role="button" tabindex="0" data-ex="opendir" data-dir="${E(up)}">⤴️ ..</span></div>` : ''}
            ${ls.dirs.map((d2) => { const full = (dir ? dir + '/' : '') + d2, cnt = files.filter((f) => f.name.startsWith(full + '/') && f.name.split('/').pop() !== Addons.KEEP).length;
              return `<div class="file-item"><span class="name" dir="auto" role="button" tabindex="0" data-ex="opendir" data-dir="${E(full)}">📁 ${E(d2)}</span><span class="badge">${cnt} ملف</span>
              <button class="btn btn-sm btn-danger" data-ex="deldir" data-dir="${E(full)}" aria-label="حذف المجلد ${E(d2)}">🗑</button></div>`; }).join('')}
            ${ls.files.map((f) => { const base = f.name.slice(dir ? dir.length + 1 : 0);
              return `<div class="file-item"><span class="name" dir="auto" role="button" tabindex="0" data-ex="edit" data-file="${E(f.name)}">📄 ${E(base)}</span>
              <span class="badge">${this.size(f.content)}</span>
              <button class="btn btn-sm" data-ex="edit" data-file="${E(f.name)}">✏️ تعديل</button>
              <button class="btn btn-sm btn-danger" data-ex="delfile" data-file="${E(f.name)}" aria-label="حذف ${E(base)}">🗑</button></div>`; }).join('')}
            ${!ls.dirs.length && !ls.files.length ? '<p style="color:var(--muted)">📭 المجلد فارغ</p>' : ''}
            <div style="margin-top:10px"><button class="btn btn-primary" data-ex="newfile">➕ ملف جديد</button> <button class="btn btn-primary" data-ex="newdir">📁 مجلد جديد</button>
            ${isAddon && !dir ? '<button class="btn btn-danger" data-ex="deladdon">🗑 حذف الإضافة</button>' : ''}</div>
            <p style="color:var(--muted);margin-top:8px;font-size:.9rem">يمكنك كتابة مسار كامل عند الإنشاء، مثل <code dir="ltr">src/bridge/Adapter.js</code>، فتُنشأ المجلدات تلقائياً.</p></div>${dir ? '' : this.labHtml()}`;
      } else if (n.view === 'file') {
        h = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button class="btn btn-sm" data-ex="opendir" data-dir="${E(n.file.includes('/') ? n.file.slice(0, n.file.lastIndexOf('/')) : '')}">⬅ رجوع</button><h3 dir="ltr" class="ltr">✏️ ${E(n.file)}</h3></div>
          <div class="panel"><textarea id="ex-editor" class="field code-editor" style="min-height:360px" aria-label="محتوى الملف" spellcheck="false"></textarea>
          <div style="margin-top:10px"><button class="btn btn-success" data-ex="savefile">💾 حفظ</button>
          <button class="btn" data-ex="tolab">🧪 نسخ إلى بيئة التجربة</button>
          <button class="btn" data-ex="opendir" data-dir="${E(n.file.includes('/') ? n.file.slice(0, n.file.lastIndexOf('/')) : '')}">❌ إلغاء</button></div></div>`;
      }
      this.el.innerHTML = h;
      if (n.view === 'file') this.el.querySelector('#ex-editor').value = this.files(n.folder).find((f) => f.name === n.file)?.content || '';
      const lab = this.el.querySelector('#lab-code'); if (lab) lab.value = d.labCode || '<h1>مرحباً</h1>\n<script>\n  document.body.append("الوقت: " + new Date().toLocaleTimeString());\n<\/script>';
    },

    // يتحقق من مسار جديد (ملف أو مجلد) ويعيد نص الخطأ أو ''
    checkNew(full, folder, isDir) {
      if (!Addons.FILE_RE.test(full)) return 'مسار غير صالح: لا يُسمح بـ \\ : * ? " < > | ولا بـ .. ولا بأكثر من 8 مستويات';
      const arr = this.files(folder) || [], parts = full.split('/');
      if (arr.filter((f) => f.name.split('/').pop() !== Addons.KEEP).length >= 100) return 'بلغت الحد الأقصى للملفات (100)';
      for (let i = 1; i < parts.length; i++) if (arr.some((f) => f.name === parts.slice(0, i).join('/'))) return 'لا يمكن إنشاء مجلد باسم ملف موجود: ' + parts.slice(0, i).join('/');
      if (arr.some((f) => f.name === full)) return 'الاسم موجود مسبقاً كملف';
      if (arr.some((f) => f.name.startsWith(full + '/'))) return 'الاسم موجود مسبقاً كمجلد';
      return '';
    },
    // عند إنشاء ملف/مجلد داخل مجلد فيه ملف حفظ مؤقت (.gitkeep) نحذفه لأن المجلد لم يعد فارغاً
    dropKeeps(arr, full) {
      const parts = full.split('/'); parts.pop();
      for (let i = 1; i <= parts.length; i++) { const k = parts.slice(0, i).join('/') + '/' + Addons.KEEP; const j = arr.findIndex((f) => f.name === k); if (j >= 0) arr.splice(j, 1); }
    },
    // إن صار مجلد أب فارغاً بعد حذف نُبقيه بملف حفظ كي لا يختفي من المستودع
    keepIfEmpty(arr, removed) {
      const dir = removed.includes('/') ? removed.slice(0, removed.lastIndexOf('/')) : ''; if (!dir) return;
      if (!arr.some((f) => f.name.startsWith(dir + '/'))) arr.push({ name: dir + '/' + Addons.KEEP, content: '' });
    },

    labHtml() {
      return `<div class="panel"><h4>🧪 بيئة التجربة المعزولة</h4>
        <textarea id="lab-code" class="field code-editor" aria-label="كود التجربة" spellcheck="false"></textarea>
        <div style="margin-top:8px"><button class="btn btn-success" data-ex="run">▶️ تشغيل</button><button class="btn btn-danger" data-ex="clearlab">🗑 مسح</button></div>
        <div class="lab-out" id="lab-out"></div>
        <p class="notice ok">⚡ يعمل الكود داخل iframe معزول (sandbox) بلا وصول لبيانات النظام.</p></div>`;
    },

    async act(a, ds) {
      const d = this.data(), n = this.nav;
      try {
        if (a === 'root') { this.nav = { view: 'root' }; this.render(); }
        else if (a === 'store') { Catalog.open(); }
        else if (a === 'open') { this.nav = { view: 'folder', folder: ds.folder, dir: '' }; this.render(); }
        else if (a === 'opendir') { this.nav = { view: 'folder', folder: n.folder, dir: ds.dir || '' }; this.render(); }
        else if (a === 'edit') { this.nav = { view: 'file', folder: n.folder, file: ds.file }; this.render(); }
        else if (a === 'savefile') {
          const f = this.files(n.folder).find((x) => x.name === n.file); if (!f) return;
          f.content = this.el.querySelector('#ex-editor').value.slice(0, 500000); Store.save();
          if (n.folder !== 'system' && n.file === 'manifest.json') Addons.syncRegistry(n.folder);
          UI.toast('✅ تم حفظ الملف', 'success');
        } else if (a === 'newfile' || a === 'newdir') {
          // المسار مجرد أمثلة (src/bridge/Adapter.js): «/» بين الأسماء تعني مجلداً داخل مجلد، والاسم المنتهي بـ «/» يُنشأ مجلداً
          const dir = n.dir || '', asDir = (name) => a === 'newdir' || /\/\s*$/.test(name);
          const clean = (name) => name.trim().replace(/\/+\s*$/, '');
          const v = await UI.dialog({ title: a === 'newdir' ? 'مجلد جديد' : 'ملف جديد', okText: 'إنشاء', fields: [{ id: 'name', label: (a === 'newdir' ? 'اسم المجلد' : 'اسم الملف (مع الامتداد)') + ' — اكتب مساراً كاملاً بـ / لإنشاء مجلدات داخل مجلدات', value: a === 'newdir' ? 'src' : 'newfile.js', required: true, maxlength: 120 }],
            validate: (x) => this.checkNew((dir ? dir + '/' : '') + clean(x.name), n.folder, asDir(x.name)) });
          if (!v) return;
          const isDir = asDir(v.name), full = (dir ? dir + '/' : '') + clean(v.name), arr = this.files(n.folder);
          this.dropKeeps(arr, full); // أول ملف في مجلد يزيل ملف الحفظ المؤقت
          arr.push({ name: isDir ? full + '/' + Addons.KEEP : full, content: isDir ? '' : '// ملف جديد\n' }); Store.save(); this.render();
        } else if (a === 'delfile') {
          if (!(await UI.confirm(`حذف الملف ${ds.file}؟`, { okText: 'حذف' }))) return;
          const arr = this.files(n.folder); arr.splice(arr.findIndex((f) => f.name === ds.file), 1); this.keepIfEmpty(arr, ds.file); Store.save(); this.render();
        } else if (a === 'deldir') {
          const arr = this.files(n.folder), inside = arr.filter((f) => f.name.startsWith(ds.dir + '/'));
          if (!(await UI.confirm(`حذف المجلد «${ds.dir}» وكل ما بداخله (${inside.filter((f) => f.name.split('/').pop() !== Addons.KEEP).length} ملف)؟`, { okText: 'حذف' }))) return;
          const left = arr.filter((f) => !f.name.startsWith(ds.dir + '/')); arr.length = 0; arr.push(...left); this.keepIfEmpty(arr, ds.dir); Store.save(); this.render();
        } else if (a === 'newaddon') {
          const v = await UI.dialog({ title: 'إضافة جديدة', okText: 'إنشاء', fields: [{ id: 'name', label: 'اسم الإضافة (عربي أو إنجليزي، أي اسم)', value: 'إضافتي', required: true, maxlength: 60 }],
            validate: (x) => !Addons.NAME_RE.test(x.name) ? 'اسم غير صالح: لا يُسمح بـ / \\ : * ? " < > | ولا نقطة أو مسافة في البداية أو النهاية' : Addons.get(x.name) ? 'الاسم موجود مسبقاً' : '' });
          if (!v) return;
          Addons.put({ name: v.name, files: Addons.template(v.name) }, 'local');
          this.nav = { view: 'folder', folder: v.name, dir: '' }; this.render(); UI.toast('✅ أُنشئت الإضافة. جرّب «معاينة» ثم «تثبيت على سطح المكتب»', 'success', 5000);
        } else if (a === 'importaddon') {
          const name = await Addons.importFile();
          if (name) { this.nav = { view: 'folder', folder: name, dir: '' }; this.render(); UI.toast('✅ تم استيراد الإضافة', 'success'); }
        } else if (a === 'deladdon') {
          if (!(await UI.confirm(`حذف الإضافة ${n.folder} وكل ملفاتها وبياناتها وأيقونتها؟`, { okText: 'حذف' }))) return;
          Addons.remove(n.folder); OS.renderDesktop(); this.nav = { view: 'root' }; this.render();
        } else if (a === 'install') { Addons.install(n.folder); this.render(); UI.toast('✅ ظهرت الإضافة على سطح المكتب', 'success'); }
        else if (a === 'uninstall') { Addons.uninstall(n.folder); this.render(); UI.toast('أُزيلت الأيقونة من سطح المكتب (الملفات باقية)'); }
        else if (a === 'exportaddon') { Addons.export(n.folder); UI.toast('✅ تم التصدير', 'success'); }
        else if (a === 'preview') {
          const box = this.el.querySelector('#addon-preview'); box.hidden = false; box.textContent = '';
          Viewer.unmount();
          Viewer.addon({ name: n.folder, content: n.folder }, box);
        } else if (a === 'tolab') {
          d.labCode = this.el.querySelector('#ex-editor').value.slice(0, 500000); Store.save(); UI.toast('✅ نُسخ إلى بيئة التجربة', 'success');
          this.nav = { view: 'folder', folder: n.folder, dir: n.file.includes('/') ? n.file.slice(0, n.file.lastIndexOf('/')) : '' }; this.render();
        } else if (a === 'run') {
          const code = this.el.querySelector('#lab-code').value; d.labCode = code.slice(0, 500000); Store.save();
          const out = this.el.querySelector('#lab-out'); out.innerHTML = '';
          const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.title = 'نتيجة التجربة'; f.srcdoc = code; out.appendChild(f);
        } else if (a === 'clearlab') {
          d.labCode = ''; Store.save(); this.el.querySelector('#lab-code').value = ''; this.el.querySelector('#lab-out').innerHTML = '';
        }
      } catch (e) { console.error(e); UI.toast('❌ ' + e.message, 'error'); }
    },
  };
  window.Explorer = Explorer;
})();
