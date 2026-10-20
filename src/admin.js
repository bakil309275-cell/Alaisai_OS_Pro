/* لوحة الإدارة: دخول آمن، إدارة التطبيقات، السجلات، النسخ الاحتياطي، المظهر */
(function () {
  const E = UI.esc;
  const TYPE_LABEL = { html: 'كود HTML/JS', url: 'موقع', notes: 'ملاحظات', addon: 'إضافة' };
  const NEW_TYPES = ['html', 'url', 'notes'];
  const fmtDate = (t) => new Date(t).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
  const errMsg = (e) => (e && e.message === 'secure-context-required')
    ? 'هذه الميزة تتطلب اتصالاً آمناً (HTTPS أو localhost)' : (e && e.message) || 'حدث خطأ غير متوقع';

  const Admin = {
    tab: 'apps', el: null, view: null, dragId: null,

    // ---------- الدخول ----------
    _authUntil: 0,
    // يتحقق من المالك (أو ينشئ كلمة المرور في أول مرة). صالح 5 دقائق بعد النجاح.
    async authenticate() {
      const cfg = Store.db.config, now = Date.now();
      if (this._authUntil > now) return true;
      if (cfg.lock.until > now) { UI.toast(`محاولات كثيرة. انتظر ${Math.ceil((cfg.lock.until - now) / 1000)} ثانية`, 'error'); return false; }

      if (!cfg.passHash) { // أول استخدام: إنشاء كلمة مرور
        if (!(await this.setPasswordFlow('إنشاء كلمة مرور المالك', 'لا توجد كلمة مرور بعد. أنشئ كلمة مرور قوية لحماية لوحة التحكم.', true))) return false;
      } else {
        const v = await UI.dialog({ title: '🔐 دخول المالك', okText: 'دخول',
          fields: [{ id: 'p', label: 'كلمة المرور', type: 'password', required: true, autocomplete: 'current-password' }] });
        if (!v) return false;
        let ok = false;
        try { ok = await Sec.verify(v.p, cfg.passHash); } catch (e) { UI.toast(errMsg(e), 'error'); return false; }
        if (!ok) {
          cfg.lock.fails++;
          if (cfg.lock.fails >= 5) cfg.lock.until = now + Math.min(30 * 2 ** (cfg.lock.fails - 5), 3600) * 1000;
          Store.save(); UI.toast('❌ كلمة مرور خاطئة', 'error'); return false;
        }
        cfg.lock = { fails: 0, until: 0 }; Store.save();
        if (cfg.mustChange) {
          UI.toast('كلمة المرور الحالية ضعيفة، يجب تغييرها الآن', 'warn');
          if (!(await this.setPasswordFlow('تغيير كلمة المرور', 'اختر كلمة مرور جديدة وقوية.', false))) return false;
        }
      }
      this._authUntil = Date.now() + 300000;
      return true;
    },
    async open() {
      if (!(await this.authenticate())) return;
      OS.openSystem('🛠 لوحة التحكم المركزية', (el) => this.mount(el));
    },

    async setPasswordFlow(title, message, firstTime) {
      const v = await UI.dialog({ title, message, okText: 'حفظ',
        fields: [
          { id: 'p1', label: 'كلمة المرور الجديدة', type: 'password', required: true, autocomplete: 'new-password' },
          { id: 'p2', label: 'تأكيد كلمة المرور', type: 'password', required: true, autocomplete: 'new-password' }],
        validate: (x) => Sec.passwordIssue(x.p1) || (x.p1 !== x.p2 ? 'كلمتا المرور غير متطابقتين' : '') });
      if (!v) return false;
      try { Store.db.config.passHash = await Sec.hash(v.p1); } catch (e) { UI.toast(errMsg(e), 'error'); return false; }
      Store.db.config.mustChange = false; Store.db.config.lock = { fails: 0, until: 0 };
      await Store.flush(); UI.toast('✅ تم حفظ كلمة المرور', 'success');
      return true;
    },

    // ---------- الهيكل ----------
    mount(host) {
      // حاوية جديدة في كل فتح، فلا تتكرر المستمعات على عنصر المسرح الثابت
      host.textContent = '';
      const el = document.createElement('div'); host.appendChild(el); this.el = el;
      el.innerHTML = '<div class="sys-pad"><div class="tabs" role="tablist"></div><div id="admin-view"></div></div>';
      this.view = el.querySelector('#admin-view');
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) this.act(b.dataset.act, b.dataset); });
      el.addEventListener('dragstart', (e) => { const r = e.target.closest?.('.admin-row[data-id]'); if (r) { this.dragId = r.dataset.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.dataset.id); } catch (_) {} } });
      el.addEventListener('dragover', (e) => { if (e.target.closest?.('.admin-row[data-id]')) e.preventDefault(); });
      el.addEventListener('drop', (e) => { const r = e.target.closest?.('.admin-row[data-id]'); if (r && this.dragId) { e.preventDefault(); this.moveTo(this.dragId, r.dataset.id); } this.dragId = null; });
      this.setTab(this.tab);
    },
    setTab(t) {
      this.tab = t;
      const tabs = [['apps', '📱 التطبيقات'], ['logs', '📩 السجلات'], ['system', '⚙️ النظام'], ['backup', '💾 النسخ'], ['sync', '☁️ المزامنة'], ['storage', '📁 الملفات والإضافات']];
      this.el.querySelector('.tabs').innerHTML = tabs.map(([k, l]) =>
        `<button class="btn" role="tab" aria-selected="${k === t}" data-act="tab" data-tab="${k}">${l}</button>`).join('');
      this.render();
    },
    async render() {
      const v = this.view; if (!v) return;
      if (this.tab === 'apps') this.renderApps(v);
      else if (this.tab === 'logs') this.renderLogs(v);
      else if (this.tab === 'system') this.renderSystem(v);
      else if (this.tab === 'backup') await this.renderBackup(v);
      else if (this.tab === 'sync') Sync.panel(v);
      else if (this.tab === 'storage') Explorer.mount(v);
    },

    // ---------- التطبيقات ----------
    renderApps(v) {
      const reg = Store.db.registry;
      v.innerHTML = '<p style="color:var(--muted);margin-bottom:8px">اسحب الصفوف أو استخدم الأسهم لإعادة الترتيب.</p>' +
        reg.map((a, i) => `<div class="admin-row" draggable="true" data-id="${E(a.id)}">
          <span class="ico">${E(a.icon)}</span><span class="grow">${E(a.name)} <span class="badge">${TYPE_LABEL[a.type] || a.type}</span></span>
          <button class="btn btn-sm" data-act="up" data-id="${E(a.id)}" aria-label="أعلى" ${i === 0 ? 'disabled' : ''}>⬆</button>
          <button class="btn btn-sm" data-act="down" data-id="${E(a.id)}" aria-label="أسفل" ${i === reg.length - 1 ? 'disabled' : ''}>⬇</button>
          <button class="btn btn-sm" data-act="edit" data-id="${E(a.id)}">✏️ تعديل</button>
          <button class="btn btn-sm btn-danger" data-act="delapp" data-id="${E(a.id)}" aria-label="حذف">🗑</button></div>`).join('') +
        '<button class="btn btn-success" style="width:100%;margin-top:10px" data-act="add">➕ إضافة تطبيق جديد</button>';
    },
    refresh() { Store.save(); OS.renderDesktop(); this.render(); },
    moveTo(fromId, toId) {
      const reg = Store.db.registry, a = reg.findIndex((x) => x.id === fromId), b = reg.findIndex((x) => x.id === toId);
      if (a < 0 || b < 0 || a === b) return;
      reg.splice(b, 0, reg.splice(a, 1)[0]); reg.forEach((x, i) => (x.order = i)); this.refresh();
    },
    async editApp(id) {
      const reg = Store.db.registry, app = id ? reg.find((a) => a.id === id) : null;
      if (!app && reg.length >= 200) return UI.toast('بلغت الحد الأقصى للتطبيقات (200)', 'warn');
      const isAddon = app && app.type === 'addon';
      const fields = [
        { id: 'name', label: 'الاسم', value: app?.name || '', required: true, maxlength: 60 },
        { id: 'icon', label: 'الأيقونة (إيموجي)', value: app?.icon || '📦', maxlength: 8 }];
      if (!isAddon) fields.push(
        { id: 'type', label: 'النوع', type: 'select', value: app?.type || 'html', options: NEW_TYPES.map((k) => [k, TYPE_LABEL[k]]) },
        { id: 'content', label: 'المحتوى (كود HTML/JS أو الرابط؛ لا يلزم للملاحظات)', type: 'textarea', value: app?.content || '', mono: true, rows: 8 });
      const v = await UI.dialog({ title: app ? 'تعديل التطبيق' : 'تطبيق جديد', okText: 'حفظ',
        message: isAddon ? 'هذه أيقونة إضافة. عدّل ملفاتها من تبويب «الملفات والإضافات».' : '',
        fields,
        validate: (x) => {
          if (isAddon) return '';
          if (x.content.length > 2_000_000) return 'المحتوى كبير جداً (الحد 2MB)';
          if (x.type === 'url' && !Viewer.normalizeUrl(x.content)) return 'أدخل رابط http/https صالحاً';
          if (x.type === 'html' && !x.content.trim()) return 'أدخل كود التطبيق';
          return '';
        } });
      if (!v) return;
      const data = { name: v.name.trim(), icon: v.icon.trim() || '📦' };
      if (!isAddon) Object.assign(data, { type: v.type, content: v.type === 'notes' ? '' : v.type === 'url' ? Viewer.normalizeUrl(v.content) : v.content });
      if (app) Object.assign(app, data);
      else reg.push({ id: 'app_' + Store.rid(), ...data, order: reg.length });
      this.refresh();
    },

    // ---------- السجلات ----------
    renderLogs(v) {
      const cfg = Store.db.config, reports = Store.db.reports, errs = OS.errors;
      v.innerHTML = `<div class="panel"><h4>📊 الإحصاءات</h4><span class="stat">${cfg.visits}</span> مرة تشغيل للنظام</div>
        <div class="panel"><h4>🐞 أخطاء النظام (${errs.length})</h4>
          <div style="max-height:200px;overflow:auto">${errs.length ? errs.map((e) => `<div class="log-line"><small>${fmtDate(e.ts)}</small><br>${E(e.msg)}</div>`).join('') : '<p style="color:var(--muted)">لا أخطاء 🎉</p>'}</div>
          ${errs.length ? '<button class="btn btn-sm" data-act="clearerrs">مسح السجل</button>' : ''}</div>
        <div class="panel"><h4>📝 البلاغات والملاحظات (${reports.length})</h4>
          <div style="max-height:220px;overflow:auto">${reports.length ? reports.map((r) => `<div class="log-line"><small>${fmtDate(r.ts)} ${E(r.email)}</small>
            ${/^[^@\s]+@[^@\s]+$/.test(r.email) ? `<a class="btn btn-sm" href="mailto:${E(encodeURIComponent(r.email))}">✉️ رد</a>` : ''}
            <button class="btn btn-sm btn-danger" data-act="delreport" data-id="${E(r.id)}">🗑</button><br>${E(r.text)}</div>`).join('') : '<p style="color:var(--muted)">لا توجد بلاغات</p>'}</div>
          <button class="btn btn-sm btn-primary" data-act="addreport">➕ إضافة بلاغ</button></div>`;
    },
    async addReport() {
      const v = await UI.dialog({ title: 'بلاغ جديد', okText: 'إضافة', fields: [
        { id: 'email', label: 'البريد (اختياري)', type: 'email', maxlength: 200 },
        { id: 'text', label: 'النص', type: 'textarea', required: true, maxlength: 5000 }] });
      if (!v) return;
      Store.db.reports.unshift({ id: Store.rid(), email: v.email.trim(), text: v.text.trim(), ts: Date.now() }); Store.save(); this.render();
    },

    // ---------- النظام ----------
    renderSystem(v) {
      const t = Store.db.settings.theme;
      v.innerHTML = `<div class="panel"><h4>🎨 المظهر</h4>${[['auto', '🖥 تلقائي'], ['dark', '🌙 داكن'], ['light', '☀️ فاتح']].map(([k, l]) =>
        `<button class="btn ${t === k ? 'btn-primary' : ''}" data-act="theme" data-theme="${k}">${l}</button>`).join('')}</div>
        <div class="panel"><h4>🔐 الأمان</h4><button class="btn" data-act="changepass">تغيير كلمة المرور</button></div>
        <div class="panel"><h4>💾 البيانات</h4>
          <button class="btn" data-act="export">📥 تصدير نسخة</button>
          <button class="btn" data-act="exportenc">🔒 تصدير نسخة مشفّرة</button>
          <button class="btn" data-act="import">📤 استيراد نسخة</button>
          <button class="btn btn-danger" data-act="reset">🔄 إعادة ضبط المصنع</button></div>
        <div class="panel"><h4>ℹ️ حول</h4><button class="btn" data-act="about">حول التطبيق وما الجديد</button>
          <a class="btn" href="privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a><a class="btn" href="terms.html" target="_blank" rel="noopener">الشروط</a></div>
        ${OS.installPrompt ? '<div class="panel"><h4>📲 التثبيت</h4><button class="btn btn-primary" data-act="install">تثبيت التطبيق على جهازك</button></div>' : ''}`;
    },

    download(name, text) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    async exportData(encrypted) {
      const day = new Date().toISOString().slice(0, 10);
      const payload = Store.exportPayload();
      if (!encrypted) { this.download(`alaisai_backup_${day}.json`, JSON.stringify(payload, null, 2)); return UI.toast('✅ تم التصدير', 'success'); }
      const v = await UI.dialog({ title: 'تشفير النسخة', message: 'احفظ عبارة المرور؛ لا يمكن استعادة النسخة بدونها.', okText: 'تصدير',
        fields: [{ id: 'p1', label: 'عبارة المرور', type: 'password', required: true, autocomplete: 'new-password' },
                 { id: 'p2', label: 'تأكيد العبارة', type: 'password', required: true, autocomplete: 'new-password' }],
        validate: (x) => x.p1.length < 6 ? 'العبارة يجب ألا تقل عن 6 أحرف' : x.p1 !== x.p2 ? 'العبارتان غير متطابقتين' : '' });
      if (!v) return;
      try { this.download(`alaisai_backup_${day}.enc.json`, JSON.stringify(await Sec.encrypt(JSON.stringify(payload), v.p1))); UI.toast('✅ تم التصدير المشفّر', 'success'); }
      catch (e) { UI.toast(errMsg(e), 'error'); }
    },
    importData() {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
      input.onchange = async () => {
        const file = input.files[0]; if (!file) return;
        if (file.size > 20_000_000) return UI.toast('الملف كبير جداً', 'error');
        try {
          let raw = JSON.parse(await file.text());
          if (raw && raw.encrypted) {
            const v = await UI.dialog({ title: 'ملف مشفّر', okText: 'فك التشفير', fields: [{ id: 'p', label: 'عبارة المرور', type: 'password', required: true }] });
            if (!v) return;
            try { raw = JSON.parse(await Sec.decrypt(raw, v.p)); }
            catch (e) { return UI.toast(e.message === 'secure-context-required' ? errMsg(e) : '❌ عبارة مرور خاطئة أو ملف تالف', 'error'); }
          }
          const preview = await Store.migrate(raw); // يتحقق من الصحة قبل أي استبدال
          if (!(await UI.confirm(`سيتم استبدال البيانات الحالية بالنسخة (${preview.registry.length} تطبيق، ${preview.notes.length} ملاحظة). تُحفظ نسخة من الوضع الحالي تلقائياً.`, { title: 'استيراد نسخة', okText: 'استيراد' }))) return;
          await Store.replaceAll(raw); UI.toast('✅ تم الاستيراد، جارٍ إعادة التحميل', 'success'); setTimeout(() => location.reload(), 800);
        } catch (e) { UI.toast('❌ ' + (e instanceof SyntaxError ? 'الملف ليس JSON صالحاً' : errMsg(e)), 'error'); }
      };
      input.click();
    },
    async resetSystem() {
      if (!(await UI.confirm('سيتم حذف جميع التطبيقات والملاحظات وكلمة المرور نهائياً. يُنصح بتصدير نسخة أولاً. متابعة؟', { title: '⚠️ إعادة ضبط المصنع', okText: 'حذف كل شيء' }))) return;
      await Store.wipeAll();
      try { localStorage.removeItem('alaisai_theme'); } catch (_) {}
      Store.db = null; location.reload();
    },

    // ---------- النسخ الاحتياطي ----------
    async renderBackup(v) {
      const list = await Store.listBackups();
      v.innerHTML = `<div class="panel"><h4>💾 النسخ الاحتياطية المحلية (آخر ${list.length} من 5)</h4>
        <p style="color:var(--muted);margin-bottom:8px">تُنشأ نسخة تلقائياً كل 5 دقائق عند وجود تغييرات، وقبل أي استبدال للبيانات.</p>
        ${list.map((b) => `<div class="admin-row"><span class="grow">${fmtDate(b.ts)} <span class="badge">${b.label === 'auto' ? 'تلقائية' : b.label === 'manual' ? 'يدوية' : 'قبل الاستعادة'}</span>
          <span class="badge">${b.data.registry.length} تطبيق</span></span>
          <button class="btn btn-sm" data-act="restore" data-id="${E(b.id)}">↩️ استعادة</button>
          <button class="btn btn-sm btn-danger" data-act="delbackup" data-id="${E(b.id)}">🗑</button></div>`).join('') || '<p style="color:var(--muted)">لا توجد نسخ بعد</p>'}
        <button class="btn btn-primary" style="margin-top:8px" data-act="backupnow">➕ إنشاء نسخة الآن</button></div>`;
    },

    // ---------- موزّع الأوامر ----------
    async act(a, ds) {
      try {
        if (a === 'tab') this.setTab(ds.tab);
        else if (a === 'up' || a === 'down') {
          const reg = Store.db.registry, i = reg.findIndex((x) => x.id === ds.id), j = a === 'up' ? i - 1 : i + 1;
          if (j >= 0 && j < reg.length) this.moveTo(ds.id, reg[j].id);
        }
        else if (a === 'add') await this.editApp(null);
        else if (a === 'edit') await this.editApp(ds.id);
        else if (a === 'delapp') {
          const app = Store.db.registry.find((x) => x.id === ds.id);
          if (app && await UI.confirm(`حذف التطبيق «${app.name}» نهائياً؟`, { okText: 'حذف' })) {
            Store.db.registry = Store.db.registry.filter((x) => x.id !== ds.id); Store.db.registry.forEach((x, i) => (x.order = i)); this.refresh();
          }
        }
        else if (a === 'clearerrs') { OS.errors.length = 0; Store.set('errlog', []).catch(() => {}); this.render(); }
        else if (a === 'addreport') await this.addReport();
        else if (a === 'delreport') { Store.db.reports = Store.db.reports.filter((r) => String(r.id) !== ds.id); Store.save(); this.render(); }
        else if (a === 'theme') { Store.db.settings.theme = ds.theme; UI.applyTheme(ds.theme); Store.save(); this.render(); }
        else if (a === 'changepass') await this.setPasswordFlow('تغيير كلمة المرور', 'اختر كلمة مرور جديدة وقوية.', false);
        else if (a === 'export') await this.exportData(false);
        else if (a === 'exportenc') await this.exportData(true);
        else if (a === 'import') this.importData();
        else if (a === 'reset') await this.resetSystem();
        else if (a === 'about') OS.about();
        else if (a === 'install') { const p = OS.installPrompt; OS.installPrompt = null; p.prompt(); await p.userChoice; this.render(); }
        else if (a === 'backupnow') { await Store.addBackup('manual'); UI.toast('✅ تم إنشاء نسخة', 'success'); this.render(); }
        else if (a === 'delbackup') { await Store.removeBackup(ds.id); this.render(); }
        else if (a === 'restore') {
          const b = (await Store.listBackups()).find((x) => x.id === ds.id);
          if (b && await UI.confirm(`استعادة نسخة ${fmtDate(b.ts)}؟ ستُحفظ نسخة من الوضع الحالي أولاً.`, { title: 'استعادة', okText: 'استعادة', danger: false })) {
            await Store.replaceAll(b.data); UI.toast('✅ تمت الاستعادة', 'success'); setTimeout(() => location.reload(), 600);
          }
        }
      } catch (e) { console.error(e); UI.toast('❌ ' + errMsg(e), 'error'); }
    },
  };

  window.Admin = Admin;
})();
