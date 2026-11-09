/* GitFlash: نافذة إدارة مستودع GitHub من داخل التطبيق: اتصال، شجرة بالطيّ، رفع ملفات ومجلدات، إنشاء، نقل وتسمية، تعديل نص، حذف.
 * كل تعديل = commit واحد ذرّي (Git Data API) دون force-push. الرمز يُحفظ مشفّراً على الجهاز ولا يدخل النسخ الاحتياطية. */
(function () {
  const E = UI.esc, K = 'gfcfg', API = 'https://api.github.com';
  const MAX_VIEW = 1024 * 1024, IMG = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const okPath = (p) => !!p && p.length < 250 && !/^\/|\/$|\/\/|\\|[\u0000-\u001f]/.test(p) && !p.split('/').some((x) => x === '.' || x === '..' || x === '.git');
  const size = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
  const b64 = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.slice(r.result.indexOf(',') + 1)); r.onerror = () => no(r.error); r.readAsDataURL(f); });
  const txt64 = (t) => { const u = new TextEncoder().encode(t); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };

  const GitFlash = {
    st: { cfg: null, tree: [], open: new Set(), q: '', busy: false },
    async loadCfg() { try { const k = await Sync.deviceKey(false), s = await Store.get(K); if (k && s) return JSON.parse(await Sec.open(k, s)); } catch (_) { /* لا شيء */ } return null; },
    async saveCfg(c) { const k = await Sync.deviceKey(true); if (!k) throw new Error('التخزين المشفّر غير متاح في هذا المتصفح'); await Store.set(K, await Sec.seal(k, JSON.stringify(c))); },

    /** لوحة تبويب الإدارة: وصف وزر فتح النافذة */
    panel(v) {
      v.innerHTML = `<div class="panel-card"><h3>⚡ GitFlash: رفع وإدارة المستودع</h3><p class="muted">نافذة واحدة لربط مستودع GitHub، واستعراض ملفاته بالطيّ، ورفع ملفات أو مجلد كامل بـ commit واحد، وإنشاء ونقل وتعديل وحذف، دون أي تطبيق إضافي.</p>
        <button class="btn btn-primary" data-gf="open" style="width:100%">⚡ فتح GitFlash</button></div>`;
      v.querySelector('[data-gf=open]').onclick = () => this.open();
    },

    // ---------- الاتصال بـ GitHub ----------
    async api(path, o = {}) {
      const c = this.st.cfg, url = API + path; let tries = 0;
      for (;;) {
        let res;
        try { res = await fetch(url, { method: o.method || 'GET', headers: Object.assign({ Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json' }, o.body ? { 'Content-Type': 'application/json' } : {}), body: o.body ? JSON.stringify(o.body) : undefined }); }
        catch (_) { if (++tries > 5) throw new Error('تعذّر الاتصال بالإنترنت'); this.log('warn', 'انقطع الاتصال، إعادة المحاولة ' + tries + '/5…'); await new Promise((r) => setTimeout(r, 2500)); continue; }
        if (res.status >= 500 && ++tries <= 3) { await new Promise((r) => setTimeout(r, 2000)); continue; }
        if (!res.ok) { const e = new Error(res.status + ': ' + ((await res.text()).slice(0, 160))); e.status = res.status; throw e; }
        return res.status === 204 ? null : res.json();
      }
    },
    log(type, msg) { const l = this.el && this.el.querySelector('.gf-log'); if (!l) return; const d = document.createElement('div'); d.className = type; d.textContent = new Date().toLocaleTimeString('en-GB') + '  ' + msg; l.appendChild(d); l.scrollTop = l.scrollHeight; },
    repo() { const c = this.st.cfg; return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`; },
    set(txt, bad) { const s = this.el.querySelector('.gf-status'); s.textContent = txt; s.className = 'gf-status' + (bad ? ' bad' : ''); },
    bar(p) { const b = this.el.querySelector('.gf-bar i'); b.style.width = p + '%'; },

    async connect(c) {
      if (!/^[\w.-]{1,100}$/.test(c.owner) || !/^[\w.-]{1,100}$/.test(c.repo) || !/^[\w./-]{1,100}$/.test(c.branch) || !/^[\w-]{20,255}$/.test(c.token)) throw new Error('تحقق من اسم المالك والمستودع والفرع والرمز');
      this.st.cfg = c; await this.api(this.repo());
      await this.saveCfg(c); this.set('✅ متصل: ' + c.owner + '/' + c.repo + ' (' + c.branch + ')'); this.log('ok', 'تم الاتصال');
      await this.loadTree();
    },
    async head() {
      try { const r = await this.api(`${this.repo()}/git/ref/heads/${enc(this.st.cfg.branch)}`), c = await this.api(`${this.repo()}/git/commits/${r.object.sha}`); return { sha: r.object.sha, tree: c.tree.sha }; }
      catch (e) { if (e.status === 404 || e.status === 409) return null; throw e; }
    },
    async loadTree() {
      const box = this.el.querySelector('.gf-tree'); box.textContent = 'جاري التحميل…';
      try {
        const h = await this.head(); if (!h) { this.st.tree = []; box.textContent = 'المستودع أو الفرع فارغ. ارفع أول ملفاتك.'; return; }
        const t = await this.api(`${this.repo()}/git/trees/${h.tree}?recursive=1`);
        this.st.tree = (t.tree || []).filter((x) => x.type === 'blob'); if (t.truncated) this.log('warn', 'المستودع كبير: عُرض جزء من الشجرة');
        this.drawTree();
      } catch (e) { box.textContent = '❌ ' + e.message; }
    },

    /** commit واحد لعدة تغييرات. entries: [{path, sha|null, content?(base64)}]. يعيد false إن لم يتغير شيء */
    async commit(entries, message, prog) {
      const base = this.repo(), br = this.st.cfg.branch;
      const blobs = entries.filter((e) => e.content != null); let done = 0;
      const q = blobs.slice(); const conc = Math.max(1, Math.min(30, +this.el.querySelector('[name=conc]').value || 10));
      await Promise.all(Array.from({ length: Math.min(conc, q.length) }, async () => {
        for (let e; (e = q.shift());) { const r = await this.api(base + '/git/blobs', { method: 'POST', body: { content: e.content, encoding: 'base64' } }); e.sha = r.sha; delete e.content; if (prog) prog(++done, blobs.length); }
      }));
      for (let attempt = 0; attempt < 3; attempt++) {
        const h = await this.head();
        const list = entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha }));
        const body = { tree: list }; if (h) body.base_tree = h.tree;
        let tree;
        try { tree = await this.api(base + '/git/trees', { method: 'POST', body }); }
        catch (e) {
          if (e.status === 404 && list.some((x) => x.path.startsWith('.github/'))) { this.log('warn', 'رُفض مجلد .github (الرمز بلا صلاحية workflow)، يُكمَل بدونه'); body.tree = list.filter((x) => !x.path.startsWith('.github/')); if (!body.tree.length) throw new Error('كل الملفات داخل .github ولا تُرفع بهذا الرمز'); tree = await this.api(base + '/git/trees', { method: 'POST', body }); }
          else throw e;
        }
        if (h && tree.sha === h.tree) return false;
        const cm = await this.api(base + '/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: h ? [h.sha] : [] } });
        try { await this.api(`${base}/git/refs${h ? '/heads/' + enc(br) : ''}`, h ? { method: 'PATCH', body: { sha: cm.sha, force: false } } : { method: 'POST', body: { ref: 'refs/heads/' + br, sha: cm.sha } }); return true; }
        catch (e) { if (e.status !== 422 || attempt === 2) throw e; this.log('warn', 'تغيّر الفرع أثناء العمل، إعادة المحاولة…'); }
      }
    },
    async run(label, fn) {
      if (this.st.busy) return UI.toast('انتظر انتهاء العملية الجارية', 'warn');
      this.st.busy = true; this.el.classList.add('busy');
      try { this.log('info', label + '…'); const r = await fn(); this.log('ok', r === false ? 'لا تغيير: الملفات مطابقة لما في المستودع' : '✅ تم'); this.bar(100); await this.loadTree(); }
      catch (e) { this.log('err', '❌ ' + e.message); }
      finally { this.st.busy = false; this.el.classList.remove('busy'); setTimeout(() => this.bar(0), 2500); }
    },

    // ---------- العمليات ----------
    async upload(files) {
      const root = this.el.querySelector('[name=root]').value.trim().replace(/^\/+|\/+$/g, ''), msg = this.el.querySelector('[name=msg]').value.trim() || 'رفع عبر العيسائي برو';
      const bad = files.find((f) => !okPath(f.path)); if (bad) return UI.toast('مسار غير صالح: ' + bad.path, 'error');
      if (root && !okPath(root)) return UI.toast('مسار الجذر غير صالح', 'error');
      const total = files.reduce((t, f) => t + f.file.size, 0);
      await this.run('رفع ' + files.length + ' ملف (' + size(total) + ')', async () => {
        const entries = []; for (const f of files) entries.push({ path: root ? root + '/' + f.path : f.path, content: await b64(f.file) });
        return this.commit(entries, msg, (d, n) => { this.bar(Math.round(d / n * 80)); if (d % 5 === 0 || d === n) this.log('info', d + '/' + n); });
      });
    },
    async create(base, isDir) {
      const name = await UI.prompt(isDir ? 'اسم المجلد الجديد' : 'اسم الملف الجديد', { label: 'داخل «' + (base || 'الجذر') + '»', okText: 'إنشاء' }); if (!name) return;
      const p = (base ? base + '/' : '') + name.trim().replace(/^\/+|\/+$/g, '') + (isDir ? '/.gitkeep' : '');
      if (!okPath(p)) return UI.toast('اسم غير صالح', 'error'); if (this.st.tree.some((x) => x.path === p)) return UI.toast('موجود مسبقاً', 'warn');
      await this.run('إنشاء ' + p, () => this.commit([{ path: p, content: '' }], 'إنشاء ' + p));
    },
    async rename(path, isDir) {
      const np = (await UI.prompt('المسار الجديد', { value: path, label: 'من: ' + path, okText: 'نقل' }) || '').trim(); if (!np || np === path) return;
      if (!okPath(np)) return UI.toast('مسار غير صالح', 'error');
      const mv = this.st.tree.filter((x) => (isDir ? x.path.startsWith(path + '/') : x.path === path)); if (!mv.length) return;
      const out = mv.map((x) => ({ path: isDir ? np + x.path.slice(path.length) : np, sha: x.sha }));
      if (out.some((o) => this.st.tree.some((x) => x.path === o.path && !mv.includes(x)))) return UI.toast('الوجهة موجودة فعلاً', 'error');
      await this.run('نقل ' + path + ' ← ' + np, () => this.commit(out.concat(mv.map((x) => ({ path: x.path, sha: null }))), 'نقل ' + path + ' إلى ' + np));
    },
    async remove(path, isDir) {
      const del = this.st.tree.filter((x) => (isDir ? x.path.startsWith(path + '/') : x.path === path)); if (!del.length) return;
      if (!(await UI.confirm('حذف «' + path + '»' + (isDir ? ' (' + del.length + ' ملف)' : '') + ' من المستودع؟', { okText: 'حذف' }))) return;
      await this.run('حذف ' + path, () => this.commit(del.map((x) => ({ path: x.path, sha: null })), 'حذف ' + path));
    },
    async view(path) {
      const f = this.st.tree.find((x) => x.path === path); if (!f) return;
      try {
        const r = await this.api(`${this.repo()}/git/blobs/${f.sha}`), bin = Uint8Array.from(atob(r.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
        const ov = document.createElement('div'); ov.className = 'dialog-overlay'; ov.style.zIndex = 1300;
        let body;
        if (IMG.test(path)) { const u = URL.createObjectURL(new Blob([bin], { type: path.endsWith('.svg') ? 'image/svg+xml' : 'image/' + path.split('.').pop().toLowerCase().replace('jpg', 'jpeg') })); body = `<img class="gf-img" src="${u}" alt="">`; setTimeout(() => URL.revokeObjectURL(u), 60000); }
        else {
          let text = null; if (bin.length <= MAX_VIEW) { try { text = new TextDecoder('utf-8', { fatal: true }).decode(bin); } catch (_) { /* ثنائي */ } }
          body = text == null ? `<p class="muted">الملف ثنائي أو كبير (${size(bin.length)}) ولا يُعرض هنا.</p>` : `<textarea class="gf-edit" spellcheck="false" dir="ltr"></textarea>`;
          ov.dataset.text = text == null ? '' : '1'; ov._text = text;
        }
        ov.innerHTML = `<div class="dialog gf-view" role="dialog" aria-modal="true" aria-label="${E(path)}"><h3 dir="ltr">${E(path)}</h3>${body}<div class="dialog-actions">${ov.dataset.text ? '<button class="btn btn-success" data-v="save">💾 حفظ التعديل</button>' : ''}<span class="grow"></span><button class="btn" data-v="x">إغلاق</button></div></div>`;
        document.getElementById('dialog-root').appendChild(ov);
        const ta = ov.querySelector('textarea'); if (ta) ta.value = ov._text;
        ov.addEventListener('click', async (e) => {
          if (e.target === ov || e.target.dataset.v === 'x') return ov.remove();
          if (e.target.dataset.v === 'save') { const t = ta.value; ov.remove(); await this.run('حفظ ' + path, () => this.commit([{ path, content: txt64(t) }], 'تعديل ' + path)); }
        });
      } catch (e) { this.log('err', '❌ ' + e.message); }
    },
    async createRepo() {
      const n = await UI.prompt('إنشاء مستودع جديد', { label: 'اسم المستودع', okText: 'إنشاء' }); if (!n || !n.trim()) return;
      const f = this.el.querySelector('form.gf-conn'), c = { owner: f.owner.value.trim(), repo: n.trim(), branch: f.branch.value.trim() || 'main', token: f.token.value.trim() };
      try {
        this.st.cfg = c; const r = await this.api('/user/repos', { method: 'POST', body: { name: c.repo, private: true, auto_init: true } });
        c.owner = r.owner.login; f.owner.value = c.owner; f.repo.value = c.repo; await this.connect(c);
      } catch (e) { this.log('err', '❌ ' + e.message); }
    },

    // ---------- الواجهة ----------
    drawTree() {
      const box = this.el.querySelector('.gf-tree'), q = this.st.q.trim().toLowerCase();
      const root = {}; this.st.tree.forEach((f) => { if (q && !f.path.toLowerCase().includes(q)) return; let n = root; const ps = f.path.split('/'); ps.forEach((p, i) => { n.c = n.c || {}; n = n.c[p] = n.c[p] || { name: p, path: ps.slice(0, i + 1).join('/'), file: i === ps.length - 1 ? f : null }; }); });
      const rows = [], walk = (nodes, d) => Object.values(nodes || {}).sort((a, b) => (!!a.file - !!b.file) || a.name.localeCompare(b.name)).forEach((n) => {
        const dir = !n.file, op = q || this.st.open.has(n.path);
        rows.push(`<div class="gf-row" style="--lv:${d}" data-p="${E(n.path)}" data-d="${dir ? 1 : 0}">${dir ? `<button type="button" class="gf-tg${op ? ' o' : ''}" data-g="tg" aria-label="${op ? 'طيّ' : 'فتح'} ${E(n.name)}">◂</button><span class="gf-i">📁</span>` : '<span class="gf-tg0"></span><span class="gf-i">📄</span>'}<span class="gf-n" dir="ltr">${E(n.name)}</span>
          <span class="gf-a">${dir ? `<button type="button" data-g="new" aria-label="إنشاء داخل ${E(n.name)}">＋</button>` : '<button type="button" data-g="view" aria-label="عرض">👁</button>'}<button type="button" data-g="ren" aria-label="نقل أو تسمية">✏️</button><button type="button" data-g="del" aria-label="حذف">🗑</button></span></div>`);
        if (dir && op) walk(n.c, d + 1);
      });
      walk(root.c, 0); box.innerHTML = rows.join('') || '<p class="muted">لا ملفات' + (q ? ' مطابقة' : '') + '.</p>';
    },
    async open() {
      const cfg = (await this.loadCfg()) || {}, sc = (window.Sync && Sync.cfg) || {};
      const ov = document.createElement('div'); ov.className = 'dialog-overlay'; this.el = ov; this.st.cfg = null; this.st.tree = []; this.st.q = '';
      ov.innerHTML = `<div class="dialog gf-dlg" role="dialog" aria-modal="true" aria-label="GitFlash"><h3>⚡ GitFlash</h3>
        <form class="gf-conn" autocomplete="off"><div class="gf-g"><label>المالك<input name="owner" dir="ltr" value="${E(cfg.owner || sc.owner || '')}" placeholder="username"></label><label>المستودع<input name="repo" dir="ltr" value="${E(cfg.repo || sc.repo || '')}" placeholder="repo-name"></label>
          <label>الفرع<input name="branch" dir="ltr" value="${E(cfg.branch || sc.branch || 'main')}"></label><label>الرمز (Token)<input name="token" type="password" dir="ltr" value="${E(cfg.token || '')}" placeholder="github_pat_…"></label></div>
          <div class="gf-btns"><button class="btn btn-primary" type="submit">🔗 اتصال</button><button class="btn" type="button" data-g="mk">➕ إنشاء مستودع</button></div><p class="gf-status muted">غير متصل. الرمز يُحفظ مشفّراً على جهازك فقط.</p></form>
        <section class="gf-up"><h4>⬆ رفع إلى المستودع</h4><div class="gf-g"><label>مسار الجذر (اختياري)<input name="root" dir="ltr" placeholder="مثال: addons"></label><label>ملفات بالتوازي<input name="conc" type="number" min="1" max="30" value="10"></label></div>
          <label>رسالة الـ commit<input name="msg" value="رفع عبر العيسائي برو"></label><button class="btn btn-success" type="button" data-g="add" style="width:100%;margin-top:8px">➕ إضافة ملفات أو مجلد</button><div class="gf-bar"><i></i></div><div class="gf-log" dir="ltr" aria-live="polite"></div></section>
        <section><h4>📂 ملفات المستودع</h4><div class="gf-btns"><button class="btn btn-sm" data-g="rf">🔄 تحديث</button><button class="btn btn-sm" data-g="xa">فتح الكل</button><button class="btn btn-sm" data-g="ca">طيّ الكل</button><button class="btn btn-sm" data-g="nf">＋ ملف</button><button class="btn btn-sm" data-g="nd">＋ مجلد</button><button class="btn btn-sm" data-g="zip">⬇ ZIP</button></div>
          <input class="gf-q" type="search" placeholder="ابحث في المسارات…" aria-label="بحث"><div class="gf-tree" role="tree"><p class="muted">اتصل بالمستودع أولاً.</p></div></section>
        <div class="dialog-actions"><span class="grow"></span><button class="btn" data-g="x">إغلاق</button></div></div>`;
      document.getElementById('dialog-root').appendChild(ov);
      const ready = () => this.st.cfg || (UI.toast('اتصل بالمستودع أولاً', 'warn'), false);
      ov.querySelector('form.gf-conn').addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target;
        try { await this.connect({ owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || 'main', token: f.token.value.trim() }); }
        catch (err) { this.st.cfg = null; this.set('❌ ' + err.message, true); this.log('err', err.message); }
      });
      ov.querySelector('.gf-q').addEventListener('input', (e) => { this.st.q = e.target.value; this.drawTree(); });
      ov.addEventListener('click', async (e) => {
        if (e.target === ov) return ov.remove();
        const b = e.target.closest('[data-g]'); if (!b) return; const g = b.dataset.g, row = b.closest('.gf-row'), p = row && row.dataset.p, dir = row && row.dataset.d === '1';
        if (g === 'x') ov.remove();
        else if (g === 'mk') this.createRepo();
        else if (g === 'tg') { this.st.open.has(p) ? this.st.open.delete(p) : this.st.open.add(p); this.drawTree(); }
        else if (!ready()) return;
        else if (g === 'add') { const ch = await Uploader.choose({ title: '➕ إضافة إلى المستودع' }); if (!ch) return; if (ch.create) return this.create('', ch.create === 'dir'); this.upload(ch.files); }
        else if (g === 'rf') this.loadTree();
        else if (g === 'xa') { this.st.tree.forEach((f) => f.path.split('/').slice(0, -1).reduce((a, s) => { a = a ? a + '/' + s : s; this.st.open.add(a); return a; }, '')); this.drawTree(); }
        else if (g === 'ca') { this.st.open.clear(); this.drawTree(); }
        else if (g === 'nf' || g === 'nd') this.create('', g === 'nd');
        else if (g === 'zip') { const c = this.st.cfg; window.open(`https://github.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/archive/refs/heads/${enc(c.branch)}.zip`, '_blank', 'noopener'); }
        else if (g === 'new') this.create(p, false);
        else if (g === 'view') this.view(p);
        else if (g === 'ren') this.rename(p, dir);
        else if (g === 'del') this.remove(p, dir);
      });
      ov.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('.dialog-overlay ~ .dialog-overlay')) ov.remove(); });
      if (cfg.token) ov.querySelector('form.gf-conn').requestSubmit();
    },
  };
  window.GitFlash = GitFlash;
})();
