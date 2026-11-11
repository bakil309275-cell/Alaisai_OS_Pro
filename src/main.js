/* النواة: تشغيل النظام وسطح المكتب والمسرح */
(function () {
  const OS = {
    errors: [], installPrompt: null, lastFocus: null,

    logError(msg) {
      const m = String(msg || 'خطأ غير معروف').slice(0, 300);
      console.warn('🛡️ Alaisai Shield:', m);
      this.errors.unshift({ ts: Date.now(), msg: m });
      this.errors.length = Math.min(this.errors.length, 30);
      try { Store.set('errlog', this.errors); } catch (_) {}
    },

    async init() {
      window.addEventListener('error', (e) => this.logError(e.message));
      window.addEventListener('unhandledrejection', (e) => this.logError(e.reason && e.reason.message || e.reason));
      try { this.errors = (await Store.get('errlog')) || []; } catch (_) {}

      try { await Store.load(); }
      catch (e) { document.body.innerHTML = '<p style="padding:30px">تعذّر تشغيل النظام: ' + UI.esc(e.message) + '</p>'; throw e; }
      UI.applyTheme(Store.db.settings.theme);
      if (Store.recovered) UI.toast('⚠️ كانت البيانات تالفة؛ بدأ النظام ببيانات افتراضية وحُفظت نسخة من التالف.', 'warn', 8000);
      Store.db.config.visits++; Store.save();

      this.bind();
      this.renderDesktop();
      this.startClock();
      this.checkNetwork();
      this.registerServiceWorker();
      this.initSyncBadge();
      Sync.init().catch((e) => this.logError(e.message));
      Control.init().catch((e) => this.logError(e.message));
      Community.init().catch((e) => this.logError(e.message));
      // اطلب تخزيناً دائماً كي لا يمسح المتصفح بيانات التطبيق (الإضافات والخزنة) عند ضيق المساحة
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) { /* لا شيء */ }
      Cloud.init().catch((e) => this.logError(e.message));
      this.handleDeepLink();
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.alaisai === 'news') Control.open(); });
      this.whatsNew();
      setTimeout(() => this.checkAddonUpdates(), 4000);

      // نسخ احتياطي تلقائي (فقط عند وجود تغييرات) كل 5 دقائق، وحفظ فوري عند الإخفاء
      setInterval(() => Store.addBackup('auto').catch(() => {}), 300000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(); });
      window.addEventListener('pagehide', () => Store.flush());
    },

    bind() {
      document.getElementById('admin-gate').addEventListener('click', () => Admin.open());
      document.getElementById('close-stage').addEventListener('click', () => this.closeStage());
      document.getElementById('theme-toggle').addEventListener('click', () => {
        const order = ['auto', 'dark', 'light'], cur = Store.db.settings.theme;
        const next = order[(order.indexOf(cur) + 1) % 3];
        Store.db.settings.theme = next; UI.applyTheme(next); Store.save();
        UI.toast({ auto: '🖥 المظهر: تلقائي', dark: '🌙 المظهر: داكن', light: '☀️ المظهر: فاتح' }[next]);
      });
      document.getElementById('store-btn').addEventListener('click', () => Catalog.open());
      document.getElementById('news-btn').addEventListener('click', () => Control.open());
      document.getElementById('comm-btn').addEventListener('click', () => Community.open());
      document.getElementById('hub-btn').addEventListener('click', () => Cloud.open());
      document.getElementById('share-btn').addEventListener('click', () => Share.open());
      document.getElementById('sync-badge').addEventListener('click', () => Sync.open());
      document.getElementById('install-btn').addEventListener('click', () => this.install());
      document.getElementById('app-search').addEventListener('input', (e) => { this.query = e.target.value; this.renderDesktop(); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('stage-overlay').classList.contains('hidden')) this.closeStage();
      });
      window.addEventListener('online', () => this.checkNetwork());
      window.addEventListener('offline', () => this.checkNetwork());
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.installPrompt = e; this.updateInstallBtn(); });
      window.addEventListener('appinstalled', () => { this.installPrompt = null; this.updateInstallBtn(); UI.toast('✅ تم تثبيت التطبيق', 'success'); });
      this.updateInstallBtn();
    },

    // ---------- سطح المكتب (بناء عبر DOM بلا innerHTML للبيانات) ----------
    query: '', dragId: null,
    /** سطح مكتب فارغ: دعوة لتصفّح المتجر مع قائمة الإضافات الجاهزة وتثبيت بنقرة */
    renderStart(grid) {
      const box = document.createElement('div'); box.className = 'start-card';
      const h = document.createElement('h2'); h.textContent = 'مرحباً بك في العيسائي برو';
      const p = document.createElement('p'); p.textContent = 'إضافاتك الحقيقية في المتجر. اختر ما يناسب عملك وثبّته بنقرة، فيظهر هنا على سطح المكتب.';
      const list = document.createElement('div'); list.className = 'start-list'; list.setAttribute('role', 'list');
      const open = document.createElement('button'); open.type = 'button'; open.className = 'btn btn-primary start-open'; open.textContent = '🛍️ تصفّح متجر الإضافات';
      open.addEventListener('click', () => Catalog.open());
      box.append(h, p, list, open); grid.appendChild(box);
      Catalog.fetchIndex().then((idx) => {
        if (!box.isConnected) return;
        idx.slice(0, 12).forEach((e) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'start-item'; b.setAttribute('role', 'listitem');
          const i = document.createElement('span'); i.className = 'ico'; i.setAttribute('aria-hidden', 'true'); i.textContent = e.icon;
          const n = document.createElement('b'); n.textContent = e.name;
          const d = document.createElement('small'); d.textContent = e.description;
          const t = document.createElement('span'); t.className = 'btn btn-sm btn-success'; t.textContent = 'تثبيت';
          b.append(i, n, d, t);
          b.addEventListener('click', async () => {
            b.disabled = true; t.textContent = '⏳';
            try { if (await Catalog.install(e, { silent: true })) UI.toast('✅ ثُبّتت «' + e.name + '» وظهرت على سطح المكتب', 'success'); }
            catch (err) { UI.toast('❌ ' + err.message, 'error', 5000); b.disabled = false; t.textContent = 'تثبيت'; }
            this.renderDesktop();
          });
          list.appendChild(b);
        });
      }).catch(() => { list.textContent = navigator.onLine ? '' : 'لا يوجد اتصال. افتح المتجر عند توفر الإنترنت.'; });
    },
    renderDesktop() {
      const grid = document.getElementById('app-grid'); if (!grid) return;
      grid.textContent = '';
      const q = this.query.trim().toLowerCase();
      const apps = Store.db.registry.filter((a) => (!q || a.name.toLowerCase().includes(q)));
      document.getElementById('store-btn').classList.toggle('pulse', !Store.db.registry.length);
      if (!apps.length) {
        if (q || Store.db.registry.length) { const d = document.createElement('div'); d.className = 'empty-state'; d.textContent = 'لا توجد تطبيقات مطابقة'; grid.appendChild(d); }
        else this.renderStart(grid);
        return;
      }
      apps.forEach((app) => {
        const card = document.createElement('div');
        card.className = 'app-card'; card.setAttribute('role', 'button'); card.tabIndex = 0; card.dataset.id = app.id;
        card.draggable = !q;
        const box = document.createElement('div'); box.className = 'icon-box'; box.textContent = app.icon;
        const name = document.createElement('span'); name.className = 'app-name'; name.textContent = app.name;
        card.append(box, name);
        card.addEventListener('click', () => this.openApp(app));
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openApp(app); } });
        card.addEventListener('dragstart', (e) => { this.dragId = app.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', app.id); } catch (_) {} });
        card.addEventListener('dragend', () => { card.classList.remove('dragging'); grid.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); });
        card.addEventListener('dragover', (e) => { if (this.dragId) { e.preventDefault(); card.classList.add('drag-over'); } });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', (e) => {
          e.preventDefault(); card.classList.remove('drag-over');
          const reg = Store.db.registry, a = reg.findIndex((x) => x.id === this.dragId), b = reg.findIndex((x) => x.id === app.id);
          this.dragId = null; if (a < 0 || b < 0 || a === b) return;
          reg.splice(b, 0, reg.splice(a, 1)[0]); reg.forEach((x, i) => (x.order = i));
          Store.save(); this.renderDesktop();
        });
        grid.appendChild(card);
      });
    },

    // ---------- المسرح ----------
    _open(title, appMode) {
      const stage = document.getElementById('stage-overlay'), vp = document.getElementById('stage-viewport');
      this.lastFocus = document.activeElement;
      document.getElementById('active-app-title').textContent = title;
      vp.textContent = ''; vp.classList.toggle('app-mode', appMode);
      stage.classList.remove('hidden');
      document.getElementById('close-stage').focus();
      return vp;
    },
    async openApp(app) {
      if (app.type === 'addon' && window.Control) { let ok = true; try { ok = await Control.gate(app.content); } catch (_) { ok = true; } if (!ok) return; }
      const vp = this._open(app.name, app.type !== 'notes');
      try { Viewer.mount(app, vp); } catch (e) { this.logError(e.message); UI.toast('تعذّر فتح التطبيق', 'error'); }
    },
    openSystem(title, build) { build(this._open(title, false)); },
    closeStage() {
      Viewer.unmount();
      document.getElementById('stage-overlay').classList.add('hidden');
      document.getElementById('stage-viewport').textContent = '';
      Store.flush();
      if (this.lastFocus && this.lastFocus.focus) try { this.lastFocus.focus(); } catch (_) {}
    },

    // ---------- شارة المزامنة ----------
    initSyncBadge() {
      const b = document.getElementById('sync-badge');
      const upd = (st, label) => {
        b.hidden = st === 'off';
        b.dataset.state = st; b.title = label; b.setAttribute('aria-label', 'المزامنة: ' + label);
        b.querySelector('[data-glyph]').textContent = { idle: '✓', dirty: '●', syncing: '↻', behind: '⬇', conflict: '⚠', error: '✖', offline: '⛔', locked: '🔒' }[st] || '';
      };
      Sync.subs.push(upd); upd(Sync.state, Sync.label());
    },

    // ---------- التثبيت ----------
    isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; },
    isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
    updateInstallBtn() { document.getElementById('install-btn').hidden = this.isStandalone() || !(this.installPrompt || this.isIOS()); },
    async install() {
      if (this.installPrompt) { const p = this.installPrompt; this.installPrompt = null; this.updateInstallBtn(); p.prompt(); await p.userChoice; }
      else if (this.isIOS()) UI.dialog({ title: '📲 التثبيت على iPhone / iPad', hideCancel: true, okText: 'حسناً',
        message: 'افتح الموقع في Safari ثم اضغط زر المشاركة ⬆️ واختر «إضافة إلى الشاشة الرئيسية».' });
    },

    // ---------- روابط مباشرة: ?app=notes | ?store=1 ----------
    handleDeepLink() {
      const q = new URLSearchParams(location.search);
      if (q.get('store')) return Catalog.open();
      if (q.get('news')) return Control.open();
      const key = (q.get('app') || '').toLowerCase(); if (!key) return;
      const app = Store.db.registry.find((a) => a.id.toLowerCase() === key || a.type === key || a.name.toLowerCase() === key || (a.type === 'addon' && a.content.toLowerCase() === key));
      if (app) this.openApp(app);
    },

    // ---------- ما الجديد / حول ----------
    about() {
      const log = APP_CHANGELOG.map((c) => `<h4>الإصدار ${UI.esc(c.v)} <small style="color:var(--muted)">${UI.esc(c.date)}</small></h4><ul style="margin:6px 22px 14px;line-height:1.9">${c.items.map((i) => `<li>${UI.esc(i)}</li>`).join('')}</ul>`).join('');
      this.openSystem('ℹ️ حول العيسائي برو', (el) => {
        el.innerHTML = `<div class="sys-pad"><div class="panel"><h3>العيسائي برو <span class="badge">v${UI.esc(APP_VERSION)}</span></h3>
          <p style="margin:8px 0">سطح مكتب تطبيقات يعمل في المتصفح ودون اتصال، بياناتك عندك وحدك.</p>
          <a class="btn" href="privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a><a class="btn" href="terms.html" target="_blank" rel="noopener">الشروط والأحكام</a>
          <a class="btn" href="https://github.com/Bakil309275-cell/Alaisai_OS_Pro" target="_blank" rel="noopener noreferrer">المستودع على GitHub</a></div>
          <div class="panel"><h3>ما الجديد</h3>${log}</div></div>`;
      });
    },
    whatsNew() {
      const seen = Store.db.settings.seenVersion;
      if (seen === APP_VERSION) return;
      Store.db.settings.seenVersion = APP_VERSION; Store.save();
      if (!seen) return; // أول تشغيل: لا داعي لعرض سجل التغييرات
      const t = UI.toast('🎉 تم التحديث إلى الإصدار ' + APP_VERSION, 'success', 15000);
      if (t) { const b = document.createElement('button'); b.className = 'btn btn-sm'; b.textContent = 'ما الجديد'; b.onclick = () => this.about(); t.appendChild(b); }
    },
    async checkAddonUpdates() {
      const list = await Catalog.checkUpdates(); if (!list.length) return;
      const t = UI.toast(`🧩 تحديثات متاحة لـ ${list.length} إضافة`, 'info', 20000);
      if (t) { const b = document.createElement('button'); b.className = 'btn btn-sm btn-primary'; b.textContent = 'تحديث';
        b.onclick = async () => { b.disabled = true; const n = await Catalog.updateAll(list); UI.toast(`✅ حُدّثت ${n} إضافة`, 'success'); }; t.appendChild(b); }
    },

    startClock() {
      const el = document.getElementById('digital-clock');
      const tick = () => { el.textContent = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); };
      tick(); setInterval(tick, 10000);
    },
    checkNetwork() {
      const dot = document.getElementById('sync-indicator'); if (!dot) return;
      dot.classList.toggle('online', navigator.onLine);
      dot.title = navigator.onLine ? 'متصل بالإنترنت' : 'غير متصل - وضع العمل دون اتصال نشط';
    },

    registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        setInterval(() => reg.update().catch(() => {}), 3600000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
        const offer = (w) => { const t = UI.toast('🔄 يتوفر إصدار جديد', 'info', 20000);
          if (t) { const b = document.createElement('button'); b.className = 'btn btn-sm btn-primary'; b.textContent = 'تحديث';
            b.onclick = () => w.postMessage('SKIP_WAITING'); t.appendChild(b); } };
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => { const w = reg.installing;
          w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
      }).catch((e) => console.warn('PWA: فشل تسجيل الخدمة', e));
      // إعادة التحميل فقط عند تبديل نسخة قديمة بجديدة، لا عند أول تثبيت (حتى لا تُغلق نافذة يعمل عليها المستخدم)
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    },
  };

  window.OS = OS;
  document.addEventListener('DOMContentLoaded', () => OS.init());
})();
