/* مستكشف الملفات والإضافات + بيئة التجربة (iframe معزول) */
(function () {
  const E = UI.esc;
  const Explorer = {
    el: null, nav: { view: 'root' },

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
        const files = this.files(n.folder) || [], isAddon = n.folder !== 'system';
        const addon = isAddon ? Addons.get(n.folder) : null, mr = addon ? Addons.manifest(addon) : null;
        h = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button class="btn btn-sm" data-ex="root">⬅ رجوع</button><h3 class="ltr">/${E(n.folder)}</h3></div>
          ${mr ? (mr.error ? `<div class="notice danger">⚠️ ${E(mr.error)}</div>` : `<div class="notice ok">${E(mr.manifest.icon)} <b>${E(mr.manifest.name)}</b> — الإصدار ${E(mr.manifest.version)}${mr.manifest.description ? ' — ' + E(mr.manifest.description) : ''}</div>`) : ''}
          ${isAddon ? `<div class="panel"><button class="btn btn-primary" data-ex="preview">▶️ معاينة</button>
            ${Addons.isInstalled(n.folder) ? '<button class="btn" data-ex="uninstall">🗑 إزالة من سطح المكتب</button>' : '<button class="btn btn-success" data-ex="install">🖥 تثبيت على سطح المكتب</button>'}
            <button class="btn" data-ex="exportaddon">📤 تصدير</button><div class="lab-out" id="addon-preview" hidden style="height:380px"></div></div>` : ''}
          <div class="panel">${files.length ? files.map((f) => `<div class="file-item"><span class="name ltr" role="button" tabindex="0" data-ex="edit" data-file="${E(f.name)}">📄 ${E(f.name)}</span>
            <span class="badge">${this.size(f.content)}</span>
            <button class="btn btn-sm" data-ex="edit" data-file="${E(f.name)}">✏️ تعديل</button>
            <button class="btn btn-sm btn-danger" data-ex="delfile" data-file="${E(f.name)}" aria-label="حذف ${E(f.name)}">🗑</button></div>`).join('') :
            '<p style="color:var(--muted)">📭 لا توجد ملفات</p>'}
            <div style="margin-top:10px"><button class="btn btn-primary" data-ex="newfile">➕ ملف جديد</button>
            ${isAddon ? '<button class="btn btn-danger" data-ex="deladdon">🗑 حذف الإضافة</button>' : ''}</div></div>${this.labHtml()}`;
      } else if (n.view === 'file') {
        h = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button class="btn btn-sm" data-ex="open" data-folder="${E(n.folder)}">⬅ رجوع</button><h3 class="ltr">✏️ ${E(n.file)}</h3></div>
          <div class="panel"><textarea id="ex-editor" class="field code-editor" style="min-height:360px" aria-label="محتوى الملف" spellcheck="false"></textarea>
          <div style="margin-top:10px"><button class="btn btn-success" data-ex="savefile">💾 حفظ</button>
          <button class="btn" data-ex="tolab">🧪 نسخ إلى بيئة التجربة</button>
          <button class="btn" data-ex="open" data-folder="${E(n.folder)}">❌ إلغاء</button></div></div>`;
      }
      this.el.innerHTML = h;
      if (n.view === 'file') this.el.querySelector('#ex-editor').value = this.files(n.folder).find((f) => f.name === n.file)?.content || '';
      const lab = this.el.querySelector('#lab-code'); if (lab) lab.value = d.labCode || '<h1>مرحباً</h1>\n<script>\n  document.body.append("الوقت: " + new Date().toLocaleTimeString());\n<\/script>';
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
        else if (a === 'open') { this.nav = { view: 'folder', folder: ds.folder }; this.render(); }
        else if (a === 'edit') { this.nav = { view: 'file', folder: n.folder, file: ds.file }; this.render(); }
        else if (a === 'savefile') {
          const f = this.files(n.folder).find((x) => x.name === n.file); if (!f) return;
          f.content = this.el.querySelector('#ex-editor').value.slice(0, 500000); Store.save();
          if (n.folder !== 'system' && n.file === 'manifest.json') Addons.syncRegistry(n.folder);
          UI.toast('✅ تم حفظ الملف', 'success');
        } else if (a === 'newfile') {
          const v = await UI.dialog({ title: 'ملف جديد', okText: 'إنشاء', fields: [{ id: 'name', label: 'اسم الملف (مع الامتداد)', value: 'newfile.js', required: true, maxlength: 80 }],
            validate: (x) => !Addons.FILE_RE.test(x.name) ? 'اسم غير صالح (حروف إنجليزية وأرقام ونقطة وشرطة)' : this.files(n.folder).some((f) => f.name === x.name) ? 'الاسم موجود مسبقاً' : this.files(n.folder).length >= 30 ? 'بلغت الحد الأقصى للملفات (30)' : '' });
          if (!v) return;
          this.files(n.folder).push({ name: v.name, content: '// ملف جديد\n' }); Store.save(); this.render();
        } else if (a === 'delfile') {
          if (!(await UI.confirm(`حذف الملف ${ds.file}؟`, { okText: 'حذف' }))) return;
          const arr = this.files(n.folder); arr.splice(arr.findIndex((f) => f.name === ds.file), 1); Store.save(); this.render();
        } else if (a === 'newaddon') {
          const v = await UI.dialog({ title: 'إضافة جديدة', okText: 'إنشاء', fields: [{ id: 'name', label: 'اسم الإضافة (إنجليزي)', value: 'my-addon', required: true, maxlength: 40 }],
            validate: (x) => !Addons.NAME_RE.test(x.name) ? 'استخدم أحرفاً إنجليزية وأرقاماً و - _ فقط' : Addons.get(x.name) ? 'الاسم موجود مسبقاً' : '' });
          if (!v) return;
          Addons.put({ name: v.name, files: Addons.template(v.name) }, 'local');
          this.nav = { view: 'folder', folder: v.name }; this.render(); UI.toast('✅ أُنشئت الإضافة. جرّب «معاينة» ثم «تثبيت على سطح المكتب»', 'success', 5000);
        } else if (a === 'importaddon') {
          const name = await Addons.importFile();
          if (name) { this.nav = { view: 'folder', folder: name }; this.render(); UI.toast('✅ تم استيراد الإضافة', 'success'); }
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
          this.nav = { view: 'folder', folder: n.folder }; this.render();
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
