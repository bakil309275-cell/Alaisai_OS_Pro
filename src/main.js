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
    query: '', dragId: null, sec: '',
    secCollapsed() { try { return localStorage.getItem('alaisai_secbar') === '0'; } catch (_) { return false; } },
    /** شريط الأقسام: صفّ للجذور ثم صفّ لأبناء كل عقدة في مسار المحدّد (حتى 5 مستويات) */
    renderSections() {
      const bar = document.getElementById('sec-bar'); if (!bar) return;
      const S = Store.db.sections || [], reg = Store.db.registry;
      if (this.sec && !Tree.find(S, this.sec)) this.sec = '';
      const cnt = (n) => { const ids = new Set(Tree.ids(n)); return reg.filter((a) => ids.has(a.sec)).length; };
      const sel = this.sec ? Tree.find(S, this.sec) : null, chain = [];
      if (sel) { let arr = S; sel.path.forEach((nm) => { const n = arr.find((x) => x.name === nm); chain.push(n); arr = n.c; }); }
      const rows = [S].concat(chain.filter((n) => n.c.length).map((n) => n.c)), selIds = new Set(chain.map((n) => n.id));
      const collapsed = this.secCollapsed();
      bar.textContent = '';
      const mk = (cls, txt, attrs) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = txt; Object.entries(attrs || {}).forEach(([k, v]) => b.setAttribute(k, v)); return b; };
      const top = document.createElement('div'); top.className = 'sec-row';
      if (S.length) { const tg = mk('sec-tg' + (collapsed ? '' : ' o'), '◂', { 'aria-label': collapsed ? 'فتح شريط الأقسام' : 'طيّ شريط الأقسام', 'aria-expanded': String(!collapsed), 'data-sec': '#tg' }); top.appendChild(tg); }
      if (!collapsed || !S.length) {
        const all = mk('chip' + (!this.sec ? ' on' : ''), 'الكل ' + reg.length, { 'data-sec': '' }); all.dataset.drop = ''; top.appendChild(all);
        (rows[0] || []).forEach((n) => { const c = mk('chip' + (selIds.has(n.id) ? ' on' : ''), n.name + (n.c.length ? ' ▾' : '') + ' ' + cnt(n), { 'data-sec': n.id }); c.dataset.drop = n.id; top.appendChild(c); });
      }
      top.appendChild(mk('chip sec-manage', S.length ? '⚙ الأقسام' : '＋ أقسام', { 'data-sec': '#manage', 'aria-label': 'إدارة الأقسام' }));
      bar.appendChild(top);
      if (!collapsed) rows.slice(1).forEach((arr, i) => { const r = document.createElement('div'); r.className = 'sec-row sub'; r.style.setProperty('--lv', i + 1); arr.forEach((n) => { const c = mk('chip' + (selIds.has(n.id) ? ' on' : ''), n.name + (n.c.length ? ' ▾' : '') + ' ' + cnt(n), { 'data-sec': n.id }); c.dataset.drop = n.id; r.appendChild(c); }); bar.appendChild(r); });
      if (!bar._bound) {
        bar._bound = true;
        bar.addEventListener('click', (e) => {
          const b = e.target.closest('[data-sec]'); if (!b) return; const v = b.dataset.sec;
          if (v === '#tg') { try { localStorage.setItem('alaisai_secbar', this.secCollapsed() ? '1' : '0'); } catch (_) { /* لا شيء */ } return this.renderSections(); }
          if (v === '#manage') return this.manageSections();
          const S2 = Store.db.sections;
          if (!v) this.sec = '';
          else if (this.sec === v) { const r = Tree.find(S2, v), par = r && Tree.flat(S2).find((x) => x.node.c.includes(r.node)); this.sec = par ? par.node.id : ''; } // الضغط على المحدّد يرفعه درجة
          else this.sec = v;
          this.renderSections(); this.renderDesktop();
        });
        bar.addEventListener('dragover', (e) => { const b = e.target.closest('[data-drop]'); if (b && this.dragId) { e.preventDefault(); b.classList.add('drag-over'); } });
        bar.addEventListener('dragleave', (e) => { const b = e.target.closest('[data-drop]'); if (b) b.classList.remove('drag-over'); });
        bar.addEventListener('drop', (e) => {
          const b = e.target.closest('[data-drop]'); if (!b || !this.dragId) return; e.preventDefault();
          const a = Store.db.registry.find((x) => x.id === this.dragId); this.dragId = null; if (!a) return; a.sec = b.dataset.drop; Store.save(); this.renderSections(); this.renderDesktop();
          UI.toast(a.sec ? '📂 نُقل «' + a.name + '» إلى ' + Tree.label(Store.db.sections, a.sec) : 'أُخرج «' + a.name + '» من الأقسام', 'success');
        });
      }
    },
    manageSections() {
      const S = Store.db.sections;
      Tree.manage({ title: '📂 أقسام التطبيقات', nodes: S,
        count: (n) => Store.db.registry.filter((a) => a.sec === n.id).length,
        onDelete: (n, ids) => Store.db.registry.forEach((a) => { if (ids.includes(a.sec)) a.sec = ''; }),
        onChange: () => { Store.save(); this.renderSections(); this.renderDesktop(); },
        select: (n) => { this.sec = n.id; this.renderSections(); this.renderDesktop(); } });
    },
    renderDesktop() {
      const grid = document.getElementById('app-grid'); if (!grid) return;
      grid.textContent = ''; this.renderSections();
      const q = this.query.trim().toLowerCase();
      const secIds = !q && this.sec ? new Set(Tree.ids(Tree.find(Store.db.sections, this.sec).node)) : null;
      const apps = Store.db.registry.filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!secIds || secIds.has(a.sec)));
      if (!apps.length) {
        const d = document.createElement('div'); d.className = 'empty-state';
        d.textContent = q ? 'لا توجد تطبيقات مطابقة' : this.sec ? 'لا توجد تطبيقات في هذا القسم. اسحب تطبيقاً إلى القسم أو عيّنه من ⚙️ ← التطبيقات ← تعديل.' : 'لا توجد تطبيقات. افتح ⚙️ لإضافة تطبيق.'; grid.appendChild(d); return;
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
