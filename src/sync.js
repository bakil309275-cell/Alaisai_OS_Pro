/* مزامنة GitHub: نسخة مشفّرة (AES-GCM بعبارة تعرفها أنت وحدك) في مستودع خاص عبر Contents API.
 * الرمز يُحفظ مشفّراً بمفتاح الجهاز غير القابل للاستخراج. الإعدادات والأسرار خارج النسخ الاحتياطية.
 * ما يُزامَن: التطبيقات والملاحظات والبلاغات وبيانات الإضافات والملفات. لا يُزامَن: كلمة المرور والمظهر وعدّاد التشغيل. */
(function () {
  const E = UI.esc;
  const API = 'https://api.github.com';
  const CFG = 'sync', SEC = 'secrets', DEV = 'devkey';
  const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, REPO_RE = /^[\w.-]{1,100}$/;
  const BRANCH_RE = /^[\w./-]{1,100}$/, PATH_RE = /^[\w][\w./-]{0,149}$/, TOKEN_RE = /^[\w-]{20,255}$/;
  const STATES = {
    off: ['☁️', 'المزامنة غير مفعّلة'], idle: ['☁️', 'متزامن'], dirty: ['☁️', 'تغييرات لم تُرفع بعد'], syncing: ['☁️', 'جارٍ المزامنة…'],
    behind: ['☁️', 'توجد نسخة أحدث في السحابة'], conflict: ['☁️', 'تعارض: السحابة وهذا الجهاز تغيّرا'], error: ['☁️', 'خطأ في المزامنة'], offline: ['☁️', 'غير متصل'], locked: ['☁️', 'يلزم إدخال الرمز/العبارة'],
  };
  class SyncError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  const fmtDate = (t) => (t ? new Date(t).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

  const Sync = {
    cfg: null, state: 'off', error: '', token: null, pass: null, memOnly: false,
    _busy: false, _tFp: null, _tAuto: null, _tRetry: null, _fp: '',

    // ---------- التهيئة ----------
    async init() {
      this.cfg = await Store.get(CFG).catch(() => null);
      if (!this.cfg || !this.cfg.owner) { this.cfg = null; this.setState('off'); return; }
      await this.loadSecrets();
      this._fp = await this.fingerprint();
      this.setState(this.token && this.pass ? (this._fp === this.cfg.lastFp ? 'idle' : 'dirty') : 'locked');
      this.hook();
      window.addEventListener('online', () => this.check());
      window.addEventListener('offline', () => this.setState('offline'));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
      setInterval(() => { if (!document.hidden) this.check(); }, 600000);
      if (this.state === 'dirty' && this.cfg.auto) this.scheduleAuto(5000);
      this.check();
    },
    configured() { return !!this.cfg; },
    subs: [],
    setState(s, err = '') {
      this.state = s; this.error = err;
      this.subs = this.subs.filter((f) => !f.dead);
      this.subs.forEach((f) => { try { f(s, this.label()); } catch (_) {} });
    },
    hook() { if (this._hooked) return; this._hooked = true; Store.listeners.push(() => this.markDirty()); },
    label() { const [, t] = STATES[this.state] || STATES.off; return t + (this.error ? ': ' + this.error : ''); },
    async saveCfg() { await Store.set(CFG, this.cfg); },

    // ---------- الأسرار ----------
    async deviceKey(create) {
      if (Store.useLS || !Sec.subtle) return null;
      let k = await Store.get(DEV).catch(() => null);
      if (!k && create) { k = await Sec.newDeviceKey(); await Store.set(DEV, k); }
      return k;
    },
    async loadSecrets() {
      try {
        const k = await this.deviceKey(false), s = await Store.get(SEC);
        if (k && s && s.token && s.pass) { this.token = await Sec.open(k, s.token); this.pass = await Sec.open(k, s.pass); }
      } catch (e) { console.warn('Sync: تعذّر فكّ الأسرار', e); this.token = this.pass = null; }
    },
    async saveSecrets(token, pass) {
      this.token = token; this.pass = pass;
      const k = await this.deviceKey(true);
      if (!k) { this.memOnly = true; return; } // بلا مفتاح جهاز: الأسرار في الذاكرة لهذه الجلسة فقط
      this.memOnly = false;
      await Store.set(SEC, { token: await Sec.seal(k, token), pass: await Sec.seal(k, pass) });
    },
    async disconnect() {
      clearTimeout(this._tAuto); clearTimeout(this._tRetry);
      for (const k of [CFG, SEC]) { try { await Store.del(k); } catch (_) {} }
      this.cfg = null; this.token = this.pass = null; this.setState('off');
    },

    // ---------- GitHub API ----------
    async gh(path, { method = 'GET', body, accept } = {}) {
      if (!this.token) throw new SyncError('locked', 'رمز الوصول غير متاح');
      let res;
      try {
        res = await fetch(API + path, { method, cache: 'no-store', body: body ? JSON.stringify(body) : undefined,
          headers: { Accept: accept || 'application/vnd.github+json', Authorization: 'Bearer ' + this.token, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) } });
      } catch (_) { throw new SyncError('offline', 'تعذّر الاتصال بـ GitHub (لا إنترنت أو الطلب محجوب)'); }
      if (res.status === 401) throw new SyncError('auth', 'رمز الوصول غير صالح أو منتهي');
      if (res.status === 403 || res.status === 429) {
        const rem = res.headers.get('x-ratelimit-remaining');
        throw new SyncError(rem === '0' || res.status === 429 ? 'rate' : 'forbidden', rem === '0' || res.status === 429 ? 'تجاوزت حدّ الطلبات، حاول لاحقاً' : 'الرمز لا يملك صلاحية Contents: Read and write على هذا المستودع');
      }
      return res;
    },
    base() { const c = this.cfg; return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`; },

    async repoInfo() {
      const r = await this.gh(this.base());
      if (r.status === 404) throw new SyncError('repo', 'المستودع غير موجود أو الرمز لا يصل إليه');
      if (!r.ok) throw new SyncError('http', 'GitHub أعاد الخطأ ' + r.status);
      return r.json();
    },

    // محتوى الملف البعيد: null إن لم يوجد
    async remote() {
      const r = await this.gh(`${this.base()}/contents/${encPath(this.cfg.path)}?ref=${encodeURIComponent(this.cfg.branch)}`);
      if (r.status === 404) { await this.repoInfo(); return null; } // يرمي إن كان المستودع نفسه غير متاح
      if (!r.ok) throw new SyncError('http', 'GitHub أعاد الخطأ ' + r.status);
      const j = await r.json();
      if (Array.isArray(j) || j.type !== 'file') throw new SyncError('path', 'المسار المحدد مجلد وليس ملفاً');
      let text;
      if (j.encoding === 'base64' && j.content) text = Sec.b64ToText(j.content.replace(/\s/g, ''));
      else { const raw = await this.gh(`${this.base()}/contents/${encPath(this.cfg.path)}?ref=${encodeURIComponent(this.cfg.branch)}`, { accept: 'application/vnd.github.raw+json' }); text = await raw.text(); }
      return { sha: j.sha, text };
    },

    // ---------- حمولة المزامنة ----------
    payload() {
      const p = Store.exportPayload();
      p.data = { version: p.data.version, registry: p.data.registry, notes: p.data.notes, reports: p.data.reports, appData: p.data.appData, explorer: p.data.explorer, config: {}, settings: {} };
      return p;
    },
    async fingerprint() { const u = new TextEncoder().encode(JSON.stringify(this.payload().data)); return [...Sec.sha256(u)].map((b) => b.toString(16).padStart(2, '0')).join(''); },
    async markDirty() {
      if (!this.cfg) return;
      clearTimeout(this._tFp);
      this._tFp = setTimeout(async () => {
        if (this._busy) return;
        this._fp = await this.fingerprint();
        if (this._fp === this.cfg.lastFp) { if (this.state === 'dirty') this.setState('idle'); return; }
        if (['idle', 'dirty'].includes(this.state)) this.setState('dirty');
        if (this.cfg.auto && this.state === 'dirty') this.scheduleAuto(45000);
      }, 3000);
    },
    scheduleAuto(ms) {
      clearTimeout(this._tAuto);
      if (!this.cfg || !this.cfg.auto || !this.token || !this.pass) return;
      this._tAuto = setTimeout(() => { if (navigator.onLine && !document.hidden) this.push({ auto: true }); else if (navigator.onLine) this.scheduleAuto(60000); }, ms);
    },

    // ---------- العمليات ----------
    async test() {
      const info = await this.repoInfo();
      const warn = [];
      if (!info.private) warn.push('المستودع عام! النسخة مشفّرة لكن يُنصح بمستودع خاص.');
      if (info.permissions && !info.permissions.push) throw new SyncError('forbidden', 'الرمز يقرأ فقط: يلزم Contents: Read and write');
      const rb = await this.gh(`${this.base()}/branches/${encodeURIComponent(this.cfg.branch)}`);
      if (rb.status === 404) throw new SyncError('branch', `الفرع «${this.cfg.branch}» غير موجود. أنشئه أولاً (يكفي إضافة ملف README عند إنشاء المستودع).`);
      return { full: info.full_name, private: !!info.private, warn };
    },

    async check() {
      if (!this.cfg || !this.token || this._busy) return;
      if (!navigator.onLine) return this.setState('offline');
      try {
        const rem = await this.remote();
        this._fp = await this.fingerprint();
        const local = this._fp !== this.cfg.lastFp;
        if (!rem) this.setState(local || !this.cfg.lastSha ? 'dirty' : 'idle');
        else if (rem.sha === this.cfg.lastSha) this.setState(local ? 'dirty' : 'idle');
        else this.setState(local ? 'conflict' : 'behind');
        if (this.state === 'dirty' && this.cfg.auto) this.scheduleAuto(15000);
      } catch (e) { this.fail(e, true); }
    },
    fail(e, quiet) {
      console.warn('Sync:', e);
      if (e.code === 'offline') return this.setState('offline');
      if (e.code === 'locked') return this.setState('locked');
      this.setState('error', e.message || 'خطأ غير متوقع');
      if (!quiet) UI.toast('❌ ' + (e.message || 'فشلت المزامنة'), 'error', 6000);
      if (['http', 'rate'].includes(e.code) && this.cfg && this.cfg.auto) { clearTimeout(this._tRetry); this._tRetry = setTimeout(() => this.scheduleAuto(1000), 300000); }
    },

    // يعيد {ok:true} أو {conflict:true, remote}
    async push({ auto = false, force = false } = {}) {
      if (!this.cfg) throw new SyncError('off', 'المزامنة غير مُعدّة');
      if (!this.token || !this.pass) { this.setState('locked'); throw new SyncError('locked', 'أعد إدخال الرمز وعبارة التشفير من إعدادات المزامنة'); }
      if (this._busy) return { busy: true };
      this._busy = true; this.setState('syncing');
      try {
        const rem = await this.remote();
        if (rem && !force && rem.sha !== this.cfg.lastSha) { this.setState('conflict'); return { conflict: true, remote: rem }; }
        await Store.flush();
        const fp = await this.fingerprint();
        const doc = { format: 'alaisai-cloud', version: 1, updatedAt: new Date().toISOString(), appVersion: window.APP_VERSION, enc: await Sec.encrypt(JSON.stringify(this.payload()), this.pass) };
        const body = { message: 'Alaisai backup ' + doc.updatedAt, content: Sec.textToB64(JSON.stringify(doc)), branch: this.cfg.branch };
        if (rem) body.sha = rem.sha;
        const r = await this.gh(`${this.base()}/contents/${encPath(this.cfg.path)}`, { method: 'PUT', body });
        if (r.status === 409 || r.status === 422) { this.setState('conflict'); return { conflict: true }; }
        if (r.status === 404) throw new SyncError('branch', 'تعذّر الكتابة: تحقق من اسم الفرع والمستودع');
        if (!r.ok) throw new SyncError('http', 'GitHub أعاد الخطأ ' + r.status);
        const j = await r.json();
        Object.assign(this.cfg, { lastSha: j.content.sha, lastSync: Date.now(), lastFp: fp });
        await this.saveCfg(); this._fp = fp;
        this.setState('idle');
        if (!auto) UI.toast('✅ رُفعت نسخة مشفّرة إلى GitHub', 'success');
        return { ok: true };
      } catch (e) { this.fail(e, auto); throw e; }
      finally { this._busy = false; }
    },

    // يجلب ويفكّ التشفير ويتحقق، دون تطبيق
    async fetchRemote() {
      if (!this.token || !this.pass) throw new SyncError('locked', 'أعد إدخال الرمز وعبارة التشفير');
      const rem = await this.remote();
      if (!rem) throw new SyncError('none', 'لا توجد نسخة في السحابة بعد');
      let doc; try { doc = JSON.parse(rem.text); } catch (_) { throw new SyncError('bad', 'ملف السحابة تالف'); }
      if (!doc || doc.format !== 'alaisai-cloud' || !doc.enc) throw new SyncError('bad', 'الملف في المستودع ليس نسخة Alaisai');
      let raw; try { raw = JSON.parse(await Sec.decrypt(doc.enc, this.pass)); } catch (e) { throw new SyncError('pass', e.message === 'secure-context-required' ? 'يتطلب HTTPS' : 'عبارة التشفير خاطئة أو الملف تالف'); }
      const preview = await Store.migrate(raw);
      return { rem, doc, raw, preview };
    },
    async applyRemote(res) { // يستبدل بيانات هذا الجهاز (محفوظ منها نسخة) ويحتفظ بإعدادات الجهاز وكلمة المرور
      const raw = res.raw.data ? res.raw : { data: res.raw };
      raw.data.config = JSON.parse(JSON.stringify(Store.db.config));
      raw.data.settings = JSON.parse(JSON.stringify(Store.db.settings));
      this._busy = true;
      try {
        await Store.replaceAll(raw, undefined, 'pre-sync-pull');
        this._fp = await this.fingerprint();
        Object.assign(this.cfg, { lastSha: res.rem.sha, lastSync: Date.now(), lastFp: this._fp });
        await this.saveCfg();
      } finally { this._busy = false; }
    },

    // ---------- الواجهة ----------
    async setup() {
      const c = this.cfg || {};
      const first = !this.cfg;
      const v = await UI.dialog({ title: '☁️ إعداد مزامنة GitHub', okText: 'حفظ واختبار',
        message: 'أنشئ مستودعاً خاصاً (Private) ورمز وصول دقيقاً (Fine-grained) بصلاحية Contents: Read and write لذلك المستودع وحده. ترك الرمز أو العبارة فارغين يُبقي المحفوظ.',
        fields: [
          { id: 'owner', label: 'اسم المستخدم/المنظمة (Owner)', value: c.owner || '', required: true, maxlength: 39, autocomplete: 'off' },
          { id: 'repo', label: 'اسم المستودع', value: c.repo || '', required: true, maxlength: 100, autocomplete: 'off' },
          { id: 'branch', label: 'الفرع (يجب أن يكون موجوداً)', value: c.branch || 'main', required: true, maxlength: 100 },
          { id: 'path', label: 'مسار الملف', value: c.path || 'alaisai-backup.json', required: true, maxlength: 150 },
          { id: 'token', label: first ? 'رمز الوصول (Token)' : 'رمز الوصول (اتركه فارغاً للإبقاء)', type: 'password', required: first || !this.token, autocomplete: 'off' },
          { id: 'pass', label: first ? 'عبارة تشفير النسخة (8 أحرف فأكثر، احفظها جيداً)' : 'عبارة التشفير (اتركها فارغة للإبقاء)', type: 'password', required: first || !this.pass, autocomplete: 'new-password' },
        ],
        validate: (x) => {
          if (!OWNER_RE.test(x.owner)) return 'اسم المستخدم غير صالح';
          if (!REPO_RE.test(x.repo) || x.repo === '.' || x.repo === '..') return 'اسم المستودع غير صالح';
          if (!BRANCH_RE.test(x.branch) || x.branch.includes('..') || x.branch.startsWith('/') || x.branch.endsWith('/')) return 'اسم الفرع غير صالح';
          if (!PATH_RE.test(x.path) || x.path.includes('..') || x.path.endsWith('/')) return 'مسار الملف غير صالح';
          if (x.token && !TOKEN_RE.test(x.token.trim())) return 'صيغة الرمز غير صحيحة';
          if (x.pass && x.pass.length < 8) return 'عبارة التشفير يجب ألا تقل عن 8 أحرف';
          return '';
        } });
      if (!v) return false;
      const keepLast = this.cfg && this.cfg.owner === v.owner && this.cfg.repo === v.repo && this.cfg.branch === v.branch && this.cfg.path === v.path;
      this.cfg = { owner: v.owner, repo: v.repo, branch: v.branch, path: v.path, auto: !!c.auto,
        lastSha: keepLast ? c.lastSha || '' : '', lastSync: keepLast ? c.lastSync || 0 : 0, lastFp: keepLast ? c.lastFp || '' : '' };
      try { await this.saveSecrets(v.token ? v.token.trim() : this.token, v.pass || this.pass); }
      catch (e) { UI.toast('❌ ' + e.message, 'error'); return false; }
      await this.saveCfg();
      this.hook();
      try {
        const r = await this.test();
        UI.toast('✅ الاتصال ناجح: ' + r.full + (r.private ? ' (خاص)' : ''), 'success', 4000);
        r.warn.forEach((w) => UI.toast('⚠️ ' + w, 'warn', 8000));
        if (this.memOnly) UI.toast('ℹ️ هذا المتصفح لا يدعم حفظ الأسرار؛ ستُطلب مجدداً عند كل تشغيل.', 'warn', 8000);
        this._fp = await this.fingerprint(); this.setState('dirty'); await this.check();
      } catch (e) { this.fail(e); }
      return true;
    },

    async resolveConflict(rem) {
      const v = await UI.dialog({ title: '⚠️ تعارض في المزامنة', okText: 'تنفيذ',
        message: 'تغيّرت النسخة في السحابة (من جهاز آخر غالباً) منذ آخر مزامنة لهذا الجهاز، وتغيّرت بيانات هذا الجهاز أيضاً. اختر ما يُعتمد:',
        fields: [{ id: 'c', type: 'select', label: 'القرار', value: 'pull', options: [['pull', 'اعتماد نسخة السحابة (يُستبدل ما في هذا الجهاز، وتُحفظ نسخة احتياطية)'], ['push', 'اعتماد نسخة هذا الجهاز (تُستبدل نسخة السحابة)']] }] });
      if (!v) return;
      if (v.c === 'push') await this.push({ force: true }); else await this.pullFlow();
    },

    async pushFlow() {
      try {
        const r = await this.push();
        if (r && r.conflict) await this.resolveConflict(r.remote);
      } catch (_) { /* أُبلغ المستخدم داخل fail() */ }
    },
    async pullFlow() {
      if (!(await Admin.authenticate())) return;
      try {
        this.setState('syncing');
        const res = await this.fetchRemote();
        const p = res.preview;
        const ok = await UI.confirm(`نسخة السحابة (${fmtDate(res.doc.updatedAt)}): ${p.registry.length} تطبيق، ${p.notes.length} ملاحظة، ${p.explorer.addons.length} إضافة.\nسيُستبدل محتوى هذا الجهاز بها (تُحفظ نسخة احتياطية قبل ذلك)، وتبقى كلمة المرور وإعدادات هذا الجهاز كما هي.`,
          { title: 'سحب من السحابة', okText: 'سحب واستبدال', danger: false });
        if (!ok) { await this.check(); return; }
        await this.applyRemote(res);
        UI.toast('✅ تم السحب، جارٍ إعادة التحميل', 'success'); setTimeout(() => location.reload(), 800);
      } catch (e) { this.fail(e); }
    },

    open() { OS.openSystem('☁️ مزامنة GitHub', (el) => { const wrap = document.createElement('div'); wrap.className = 'sys-pad'; el.appendChild(wrap); this.panel(wrap); }); },

    panel(el) {
      const draw = () => {
        const c = this.cfg, [icon] = STATES[this.state] || STATES.off;
        el.innerHTML = `<div class="panel"><h4>${icon} حالة المزامنة</h4>
          <p><span class="badge" data-state="${E(this.state)}">${E(this.label())}</span></p>
          ${c ? `<p class="ltr" style="margin:8px 0">${E(c.owner)}/${E(c.repo)} @ ${E(c.branch)} : ${E(c.path)}</p>
          <p>آخر مزامنة: <b>${E(fmtDate(c.lastSync))}</b> — المزامنة التلقائية: <b>${c.auto ? 'مفعّلة' : 'متوقفة'}</b></p>` :
          '<p>لم تُعدّ المزامنة بعد. يحفظ التطبيق نسخة <b>مشفّرة</b> من بياناتك في مستودع GitHub خاص بك، فتستعيدها على أي جهاز.</p>'}
          <div style="margin-top:10px">
            ${c ? `<button class="btn btn-primary" data-sy="push">⬆ رفع الآن</button><button class="btn" data-sy="pull">⬇ سحب من السحابة</button><button class="btn" data-sy="test">🔌 اختبار الاتصال</button>
            <button class="btn" data-sy="auto">${c.auto ? '⏸ إيقاف التلقائية' : '🔁 تفعيل التلقائية'}</button><button class="btn" data-sy="setup">⚙️ تعديل الإعداد</button><button class="btn btn-danger" data-sy="off">❌ فصل</button>`
            : '<button class="btn btn-primary" data-sy="setup">⚙️ إعداد المزامنة</button>'}</div></div>
          <details class="panel"><summary><b>كيف أُعدّها؟ (دقيقتان)</b></summary><ol style="margin:10px 22px;line-height:2">
            <li>أنشئ مستودعاً جديداً على GitHub واجعله <b>Private</b> مع ملف README (ليوجد فرع main).</li>
            <li>من <b>Settings ← Developer settings ← Personal access tokens ← Fine-grained tokens</b> أنشئ رمزاً: <i>Repository access: Only select repositories</i> واختر ذلك المستودع، و<i>Permissions ← Contents: Read and write</i>.</li>
            <li>اضغط «إعداد المزامنة»، الصق الرمز، واختر <b>عبارة تشفير</b> لا تفقدها (لا يمكن استعادة النسخة بدونها).</li>
            <li>على جهاز جديد: أعدّ المزامنة بنفس البيانات ثم «سحب من السحابة».</li></ol></details>
          <div class="notice">🔐 الرمز يُحفظ مشفّراً بمفتاح غير قابل للاستخراج داخل هذا المتصفح، والنسخة المرفوعة مشفّرة بعبارتك فلا يقرؤها أحد حتى لو كان المستودع عاماً. مع ذلك: أي شيفرة تعمل داخل هذا الموقع يمكنها استخدام الرمز، فاجعل صلاحياته لهذا المستودع وحده، وألغِه من GitHub عند الشك.</div>`;
      };
      const sub = () => { if (el.isConnected) draw(); else sub.dead = true; };
      this.subs.push(sub);
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-sy]'); if (!b) return;
        const act = b.dataset.sy;
        try {
          if (act === 'push') await this.pushFlow();
          else if (act === 'test') { const r = await this.test(); UI.toast('✅ الاتصال ناجح: ' + r.full + (r.private ? ' (خاص)' : ' (عام!)'), 'success'); r.warn.forEach((w) => UI.toast('⚠️ ' + w, 'warn', 7000)); }
          else if (act === 'pull') await this.pullFlow();
          else if (act === 'setup') { if (await Admin.authenticate()) await this.setup(); }
          else if (act === 'auto') { if (!(await Admin.authenticate())) return; this.cfg.auto = !this.cfg.auto; await this.saveCfg(); if (this.cfg.auto && this.state === 'dirty') this.scheduleAuto(3000); UI.toast(this.cfg.auto ? '🔁 فُعّلت المزامنة التلقائية' : '⏸ أُوقفت المزامنة التلقائية'); }
          else if (act === 'off') { if (await Admin.authenticate() && await UI.confirm('فصل المزامنة وحذف الرمز والعبارة من هذا الجهاز؟ لا تُحذف نسخة السحابة.', { okText: 'فصل' })) await this.disconnect(); }
        } catch (err) { if (!(err instanceof SyncError)) UI.toast('❌ ' + err.message, 'error'); else UI.toast('❌ ' + err.message, 'error', 6000); }
        draw();
      });
      draw();
    },
  };
  Sync.SyncError = SyncError; Sync.STATES = STATES;
  window.Sync = Sync;
})();
