/* منصة العيسائي: شبكة تواصل لمستخدمي العيسائي برو داخل التطبيق (تُحمَّل عند الضغط على 💬 فقط).
 * نافذة سفلية تُسحب لتكبر، وفي أسفلها تبويبات: الموجز، القناة، اشتراكي، حسابي، والمالك (للمالك فقط).
 * البيانات على «الخادم السحابي الخاص» (Cloudflare Worker). وبدونه تعرض إعلانات القناة للقراءة فقط.
 * لا يُحقن أي نص قادم من الشبكة كـ HTML: كل شيء يمرّ عبر UI.esc، والروابط https فقط. */
(function () {
  const E = UI.esc, K = 'comm', MAXW = 960;
  const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? 'الآن' : s < 3600 ? Math.round(s / 60) + ' د' : s < 86400 ? Math.round(s / 3600) + ' س' : Math.round(s / 86400) + ' يوم'; };
  const okUrl = (u) => /^https:\/\/[^\s"'<>]{4,300}$/.test(u || '');
  const day = (t) => new Date(t).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
  const KIND_L = { business: '🏪 تاجر', company: '🏢 شركة', pro: '👨‍⚕️ مختص' };
  const PAGE_T = [['facebook', 'فيسبوك'], ['whatsapp', 'واتساب'], ['telegram', 'تلغرام'], ['instagram', 'انستغرام'], ['x', 'إكس'], ['youtube', 'يوتيوب'], ['tiktok', 'تيك توك'], ['site', 'موقع أو صفحة أخرى']];
  const TABS = [['feed', '🏠', 'الموجز'], ['chan', '📣', 'القناة'], ['mine', '🔑', 'اشتراكي'], ['me', '👤', 'حسابي']];
  const Community = {
    st: { token: '', user: null, pages: [] }, sheet: null, feed: [], pfeed: [], scope: 'platform', ctx: null, groups: [], invites: [], q: '', searching: false, draft: { text: '', link: '', media: [], dest: [] }, view: 'feed', post: null, conn: 'load', filter: 'all', owner: null, ready: null,
    init() { return this.ready || (this.ready = Store.get(K).then((s) => { if (s && typeof s === 'object') this.st = Object.assign(this.st, s); if (!Array.isArray(this.st.pages)) this.st.pages = []; }).catch(() => {})); },
    save() { return Store.set(K, this.st).catch(() => {}); },
    api() { return Control.api(); },
    channels() { return ((Control.ch && Control.ch.channels) || []).filter((x) => x && x.name && okUrl(x.url)).slice(0, 6); },
    async call(path, o = {}) {
      if (!this.api()) return null;
      const x = await Control.fetchApi(path, { method: o.method || 'GET', headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, this.st.token ? { Authorization: 'Bearer ' + this.st.token } : {}), body: o.body ? JSON.stringify(o.body) : undefined }, 12000);
      if (!x) return null; const r = x.r, j = await r.json().catch(() => ({}));
      if (r.status === 401 && this.st.token && j.error !== 'بيانات الدخول غير صحيحة') { this.st.token = ''; this.st.user = null; this.save(); }
      return Object.assign({ _s: r.status }, j);
    },
    // ---------- النافذة السفلية القابلة للسحب ----------
    /** open() يفتح المنصة العامة؛ open({scope:'addon:<معرّف>', name}) يفتحها بنافذة تفاعل الإضافة (من شريط نافذة الإضافة) */
    async open(o) {
      if (this.sheet) { this.close(); if (!o) return; }
      await this.init(); this.owner = await Control.ownerKeyApi();
      this.ctx = o && o.scope ? { id: String(o.scope).slice(6), name: o.name || String(o.scope).slice(6) } : null; this.scope = this.ctx ? o.scope : 'platform';
      this.feed = []; this.filter = 'all'; this.q = ''; this.searching = false; this.loadGroups();
      const s = document.createElement('section'); s.className = 'comm-sheet'; if (!document.getElementById('stage-overlay').classList.contains('hidden')) s.classList.add('over'); s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'منصة العيسائي');
      s.innerHTML = '<div class="comm-grab" tabindex="0" role="slider" aria-label="حجم النافذة: اسحب أو استخدم الأسهم" aria-valuemin="20" aria-valuemax="95"><i></i></div>'
        + '<header class="comm-head"><strong>💬 منصة العيسائي</strong><span class="comm-chip" id="comm-chip"></span><span class="grow"></span><button class="btn btn-sm" data-c="reload" aria-label="تحديث">🔄</button><button class="btn btn-sm" data-c="close" aria-label="إغلاق">✕</button></header>'
        + '<div class="comm-body" id="comm-body" tabindex="-1"></div><nav class="comm-nav" id="comm-nav" aria-label="أقسام المنصة"></nav>';
      document.body.appendChild(s); this.sheet = s; this.setH(70);
      const g = s.querySelector('.comm-grab'); let y0 = 0, h0 = 0, drag = false;
      g.addEventListener('pointerdown', (e) => { drag = true; y0 = e.clientY; h0 = this.h; g.setPointerCapture(e.pointerId); s.classList.add('dragging'); });
      g.addEventListener('pointermove', (e) => { if (drag) this.setH(h0 + (y0 - e.clientY) / innerHeight * 100); });
      g.addEventListener('pointerup', () => { drag = false; s.classList.remove('dragging'); if (this.h < 30) this.close(); else this.setH(this.h < 52 ? 40 : this.h < 82 ? 70 : 95); });
      g.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') this.setH(this.h + 10); if (e.key === 'ArrowDown') this.setH(this.h - 10); });
      s.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
      s.addEventListener('click', (e) => { if (!e.target.closest('.comm-dd')) s.querySelectorAll('.comm-ddp:not([hidden])').forEach((x) => { x.hidden = true; }); const r = e.target.closest('[data-a="react"]'); if (r) return this.act('react', { id: String(r.dataset.id).replace(/^p/, ''), k: r.dataset.k, raw: r.dataset.id }); const b = e.target.closest('[data-c]'); if (b) this.act(b.dataset.c, b.dataset); });
      this.view = 'feed'; this.nav(); this.render(); this.load();
    },
    setH(v) { this.h = Math.max(20, Math.min(95, v)); if (this.sheet) { this.sheet.style.setProperty('--h', this.h + 'vh'); this.sheet.querySelector('.comm-grab').setAttribute('aria-valuenow', Math.round(this.h)); } },
    close() { if (this.sheet) this.sheet.remove(); this.sheet = null; if (window.Nav) Nav.sync('comm-view', false); },
    go(v) { this.view = v; if (window.Nav) Nav.sync('comm-view', v !== 'feed', () => this.go('feed')); this.nav(); this.render(); const b = document.getElementById('comm-body'); if (b) b.scrollTop = 0; },
    nav() {
      const n = document.getElementById('comm-nav'); if (!n) return; const main = { compose: 'feed', comments: 'feed', sent: 'feed', grp: 'feed', prof: this.pback === 'me' ? 'me' : 'feed', edit: 'me' }[this.view] || this.view;
      const tabs = TABS.concat(this.owner ? [['owner', '🛡', 'المالك']] : []);
      n.innerHTML = tabs.map(([k, i, l]) => `<button type="button" class="comm-tab" data-c="go" data-v="${k}" aria-current="${k === main}">${i}<span>${l}</span></button>`).join('');
      const hd = this.sheet && this.sheet.querySelector('.comm-head strong'); if (hd) hd.textContent = this.ctx ? '💬 مجتمع ' + this.ctx.name : '💬 منصة العيسائي';
      const c = document.getElementById('comm-chip'); if (c) { const m = { ok: ['🟢 متصل', 'ok'], err: ['🔴 غير متصل', 'err'], off: ['⚪ غير مفعّلة', 'off'], load: ['⏳ جارٍ الاتصال', 'off'] }[this.conn]; c.textContent = m[0]; c.dataset.s = m[1]; }
    },
    // ---------- البيانات ----------
    async load(more) {
      if (!this.api() && Control.chp) { this.conn = 'load'; this.render(); await Promise.race([Control.chp, new Promise((r) => setTimeout(r, 6000))]); } // جهاز جديد: انتظر وصول القناة بدل «غير مفعّلة»
      if (!this.api()) { this.conn = Control.ch ? 'off' : 'err'; this.feed = []; this.nav(); return this.render(); }
      if (!more) { this.conn = 'load'; this.nav(); }
      const qs = []; if (more && this.feed.length) qs.push('before=' + this.feed[this.feed.length - 1].id); if (this.scope !== 'platform') qs.push('scope=' + encodeURIComponent(this.scope));
      if (this.filter === 'following' && this.st.user) qs.push('feed=following'); if (this.q.trim()) qs.push('q=' + encodeURIComponent(this.q.trim()));
      const r = await this.call('/v1/posts' + (qs.length ? '?' + qs.join('&') : ''));
      if (!r || !r.posts) { this.conn = 'err'; this.nav(); return this.render(); }
      this.conn = 'ok'; this.feed = more ? this.feed.concat(r.posts) : r.posts; this.more = r.posts.length >= 20; this.nav(); this.render();
      Control.loadCounts(this.feed.map((p) => 'p' + p.id)).then((ok) => { if (ok && this.sheet && this.view === 'feed') this.list(); });
    },
    // ---------- مكوّنات العرض ----------
    media(m) {
      if (m.t === 'img') return `<img class="comm-img" loading="lazy" decoding="async" alt="صورة المنشور" src="${E(m.d)}">`;
      if (m.t === 'file') return this.fileCard(m);
      if (!okUrl(m.u)) return '';
      return /\.(mp4|webm|ogg)(\?|$)/i.test(m.u) ? `<video class="comm-vid" controls preload="none" playsinline src="${E(m.u)}"></video>` : `<a class="btn btn-sm" href="${E(m.u)}" target="_blank" rel="noopener noreferrer">▶ فتح الفيديو</a>`;
    },
    base() { return Control.api() || ''; },
    // ---------- الملفات المرفوعة (أي نوع: صور أصلية، فيديو، صوت، PDF، مستندات، أرشيفات…) ----------
    fsize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب'; },
    fkind(m) { const t = m.type || ''; return /^image\/(jpeg|png|webp|gif)$/.test(t) ? 'img' : /^video\/(mp4|webm|ogg)$/.test(t) ? 'vid' : /^audio\/(mpeg|ogg|wav|webm|mp4|aac)$/.test(t) ? 'aud' : t === 'application/pdf' ? 'pdf' : 'file'; },
    fileCard(m) {
      if (!/^[0-9a-f]{32}$/.test(m.id || '')) return '';
      const k = this.fkind(m), ic = { img: '🖼', vid: '🎬', aud: '🎵', pdf: '📄', file: '📎' }[k], u = this.base() + '/v1/files/' + m.id;
      const dir = m.mode === 'r2' && this.base();
      if (k === 'vid') return `<div class="comm-vp" role="button" tabindex="0" aria-label="تشغيل الفيديو ${E(m.name)}" data-c="fplay" data-id="${E(m.id)}" data-mode="${E(m.mode)}" data-size="${+m.size || 0}" data-type="${E(m.type)}" data-name="${E(m.name)}" style="${m.ar ? 'aspect-ratio:' + (+m.ar) + ';' : 'aspect-ratio:9/16;'}">${/^data:image\/jpeg;base64,/.test(m.poster || '') ? `<img alt="" src="${E(m.poster)}">` : '<span class="comm-vph" aria-hidden="true">🎬</span>'}<span class="comm-play" aria-hidden="true">▶</span><small class="comm-vsz">${this.fsize(m.size)}</small></div>`;
      if (dir && k === 'img') return `<img class="comm-img" loading="lazy" decoding="async" alt="${E(m.name)}" src="${E(u)}">`;
      if (dir && k === 'aud') return `<audio controls preload="none" src="${E(u)}" style="width:100%"></audio>`;
      return `<div class="comm-file" data-fid="${E(m.id)}"><span aria-hidden="true">${ic}</span><span class="grow"><b dir="auto">${E(m.name)}</b><small class="muted"> ${this.fsize(m.size)}</small></span>${k === 'file' || k === 'pdf' ? '' : `<button class="btn btn-sm" data-c="fview" data-id="${E(m.id)}">▶ عرض</button>`}<button class="btn btn-sm btn-primary" data-c="fdl" data-id="${E(m.id)}">⬇ تنزيل</button></div>`;
    },
    /** صورة غلاف مصغّرة للفيديو (JPEG صغير) وأبعاده، من الملف المحلي قبل الرفع */
    posterOf(file) {
      return new Promise((res) => {
        const v = document.createElement('video'), url = URL.createObjectURL(file); let done = false;
        const fin = (o) => { if (done) return; done = true; URL.revokeObjectURL(url); res(o); };
        v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url; setTimeout(() => fin(null), 8000);
        v.onerror = () => fin(null);
        v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 4); } catch (_) { fin(null); } };
        v.onseeked = () => { try { const w = Math.min(360, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(v, 0, 0, w, h); let q = 0.7, d = c.toDataURL('image/jpeg', q); while (d.length > 40000 && q > 0.2) { q -= 0.15; d = c.toDataURL('image/jpeg', q); } fin(d.length <= 44000 ? { poster: d, ar: Math.round(v.videoWidth / v.videoHeight * 1000) / 1000 } : { ar: Math.round(v.videoWidth / v.videoHeight * 1000) / 1000 }); } catch (_) { fin(null); } };
      });
    },
    vcache: new Map(),
    /** يشغّل فيديو بطاقة: مباشرة (R2) أو بتجميع القطع (D1)؛ muted للتشغيل التلقائي */
    async vstart(el, auto) {
      if (!el || el.dataset.busy || el.dataset.on) return; el.dataset.busy = '1'; const id = el.dataset.id, size = +el.dataset.size;
      const lab = el.querySelector('.comm-vsz'); if (lab) lab.textContent = '⏳';
      try {
        let src = this.vcache.get(id);
        if (!src) { if (el.dataset.mode === 'r2' && this.base()) src = this.base() + '/v1/files/' + id; else { const bl = await this.fetchFile(id, { mode: 'd1', chunks: Math.ceil(size / 262144), type: el.dataset.type }); src = URL.createObjectURL(bl); } this.vcache.set(id, src); }
        if (!el.isConnected) return;
        const v = document.createElement('video'); v.className = 'comm-vid'; v.playsInline = true; v.loop = true; v.muted = !!auto; v.controls = !auto; v.preload = 'auto'; v.src = src; v.dataset.id = id; v.setAttribute('aria-label', el.dataset.name || 'فيديو'); v.style.aspectRatio = el.style.aspectRatio;
        v.addEventListener('click', () => { if (v.muted) { v.muted = false; v.controls = true; if (v.paused) v.play().catch(() => {}); } });
        el.replaceWith(v); const pl = v.play(); if (pl) pl.catch(() => { v.controls = true; });
      } catch (_) { UI.toast('تعذّر تحميل الفيديو', 'error'); if (lab) lab.textContent = this.fsize(size); }
      delete el.dataset.busy;
    },
    /** تشغيل تلقائي صامت أثناء التمرير (يتوقف الباقي)، مثل الحالات وتيك توك */
    vwatch() {
      if (!('IntersectionObserver' in window)) return; if (this._vio) this._vio.disconnect();
      const auto = (el) => el.dataset.mode === 'r2' || +el.dataset.size <= 3 * 1048576;
      this._vio = new IntersectionObserver((es) => { for (const en of es) { const t = en.target;
        if (t.tagName === 'VIDEO') { if (en.intersectionRatio < 0.4) { if (!t.paused) t.pause(); } else if (t.paused && t.muted) t.play().catch(() => {}); continue; }
        if (en.intersectionRatio >= 0.5 && auto(t) && !(navigator.connection && navigator.connection.saveData)) { document.querySelectorAll('video.comm-vid').forEach((x) => { if (x !== t && !x.paused) x.pause(); }); this.vstart(t, true).then(() => { const v = document.querySelector('video.comm-vid[data-id="' + t.dataset.id + '"]'); if (v) this._vio.observe(v); }); } } }, { threshold: [0, 0.4, 0.5] });
      document.querySelectorAll('.comm-vp, video.comm-vid[data-id]').forEach((x) => this._vio.observe(x));
    },
    /** يجلب ملفاً مرفوعاً كاملاً كـ Blob (قطعاً في وضع D1 أو دفعة واحدة في R2) */
    async fetchFile(id, meta) {
      const parts = [];
      if (meta.mode === 'r2') { const x = await Control.fetchApi('/v1/files/' + id, {}, 120000); if (!x || !x.r.ok) throw new Error('تعذّر التحميل'); return x.r.blob(); }
      for (let n = 0; n < meta.chunks; n++) { let ok = null; for (let t = 0; t < 3 && !ok; t++) { const x = await Control.fetchApi('/v1/files/' + id + '/' + n, {}, 30000); if (x && x.r.ok) ok = await x.r.arrayBuffer(); } if (!ok) throw new Error('تعذّر التحميل'); parts.push(ok); }
      return new Blob(parts, { type: meta.type });
    },
    async fileMeta(id) { const x = await Control.fetchApi('/v1/files/' + id + '?meta=1', {}, 15000); if (!x || !x.r.ok) return null; return x.r.json().catch(() => null); },
    /** يرفع ملفاً: init ثم قطع (D1) أو رفع مباشر (R2). يعيد وصف المرفق أو يرمي خطأً مقروءاً */
    async upload(file, onp) {
      const init = await this.call('/v1/files', { method: 'POST', body: { name: file.name || 'file', type: file.type || 'application/octet-stream', size: file.size } });
      if (!init) throw new Error('لا اتصال بالخادم'); if (!init.ok) throw new Error(init.error || 'تعذّر الرفع');
      const hd = { Authorization: 'Bearer ' + this.st.token };
      if (init.mode === 'r2') {
        const x = await Control.fetchApi('/v1/files/' + init.id + '/up', { method: 'POST', headers: hd, body: file }, 600000); const j = x ? await x.r.json().catch(() => ({})) : null;
        if (!j || !j.ok) throw new Error((j && j.error) || 'انقطع الرفع'); onp && onp(1); return Object.assign({ t: 'file' }, j.file);
      }
      for (let n = 0; n < init.chunks; n++) {
        const part = file.slice(n * init.chunk, (n + 1) * init.chunk); let ok = false;
        for (let t = 0; t < 3 && !ok; t++) { const x = await Control.fetchApi('/v1/files/' + init.id + '/' + n, { method: 'POST', headers: hd, body: part }, 60000); ok = !!(x && x.r.ok); }
        if (!ok) { this.call('/v1/files/' + init.id, { method: 'DELETE' }); throw new Error('انقطع الرفع، أعد المحاولة'); } onp && onp((n + 1) / init.chunks);
      }
      const d = await this.call('/v1/files/' + init.id + '/done', { method: 'POST' }); if (!d || !d.ok) throw new Error((d && d.error) || 'تعذّر إنهاء الرفع'); return Object.assign({ t: 'file' }, d.file);
    },
    async loadGroups() {
      if (!this.st.user) { this.groups = []; this.invites = []; return; }
      const r = await this.call('/v1/groups'); if (r && r.groups) { this.groups = r.groups; this.invites = r.invites || []; if (this.sheet && this.view === 'me') this.grpList(); }
    },
    grpList() {
      const h = document.getElementById('comm-grp'); if (!h) return;
      h.innerHTML = `<div class="ctl-card"><strong>🔒 المجموعات الخاصة (${this.groups.length})</strong>${this.invites.length ? '<h4>دعوات</h4>' + this.invites.map((g) => `<div class="admin-row"><span class="grow">🔒 ${E(g.name)}</span><button class="btn btn-sm btn-primary" data-c="gop" data-op="accept" data-id="${g.id}">قبول</button><button class="btn btn-sm" data-c="gop" data-op="decline" data-id="${g.id}">رفض</button></div>`).join('') : ''}`
        + (this.groups.length ? this.groups.map((g) => `<div class="admin-row"><span class="grow comm-lnk" data-c="scope" data-k="group:${g.id}">🔒 ${E(g.name)} <small class="muted">${g.members} عضو${g.role === 'o' ? ' • مالك' : ''}</small></span><button class="btn btn-sm" data-c="grp" data-id="${g.id}">⚙️</button></div>`).join('') : '<p class="muted sm">أنشئ مجموعة مغلقة لأصدقائك أو فريقك أو عملائك، لا يراها غيرهم.</p>')
        + '<div class="comm-bar"><button class="btn btn-primary btn-sm" data-c="gnew">➕ مجموعة جديدة</button></div></div>';
    },
    av(a, big) {
      const cls = 'comm-av' + (big ? ' big' : ''), ini = ((a && a.name) || '؟').trim().slice(0, 1);
      return a && a.av && this.base() ? `<img class="${cls}" alt="" loading="lazy" src="${E(this.base() + '/v1/u/' + a.id + '/av?v=' + a.av)}">` : `<span class="${cls}" aria-hidden="true">${E(ini)}</span>`;
    },
    findPost(id) { return this.feed.concat(this.pfeed || []).find((x) => x.id === id); },
    destName(k) { if (k === 'platform') return 'المنصة'; if (k.startsWith('group:')) { const g = this.groups.find((x) => 'group:' + x.id === k); return g ? g.name : 'مجموعة خاصة'; } const a = (Store.db.registry || []).find((x) => x.type === 'addon' && 'addon:' + x.content === k); return a ? a.name : (this.ctx && 'addon:' + this.ctx.id === k ? this.ctx.name : String(k).slice(6)); },
    card(p, full) {
      const me = this.st.user, au = p.author, link = au.id ? ` data-c="prof" data-id="${au.id}"` : '';
      const tags = (p.scopes || []).filter((k) => k !== 'platform').map((k) => `<button type="button" class="comm-tag" data-c="scope" data-k="${E(k)}" title="فتح هذه الجهة">${k.startsWith('group:') ? '🔒' : '📍'} ${E(this.destName(k))}</button>`).join('');
      return `<article class="ctl-card comm-post${p.official ? ' official' : ''}"><header class="comm-ph"><button type="button" class="comm-avb"${link} aria-label="صفحة ${E(au.name)}">${p.official ? '<span class="comm-av" aria-hidden="true">⭐</span>' : this.av(au)}</button><span class="grow"><strong${link} class="${au.id ? 'comm-lnk' : ''}">${E(au.name)}</strong>${KIND_L[au.kind] ? ` <span class="badge">${KIND_L[au.kind]}</span>` : ''}${p.official ? ' <span class="badge">رسمي</span>' : ''}${p.pin ? ' <span class="badge">📌 مثبّت</span>' : ''}<small>${ago(p.ts)}</small></span></header>`
        + (p.text ? `<p class="comm-tx">${E(p.text)}</p>` : '') + (p.media || []).map((m) => this.media(m)).join('') + (okUrl(p.link) ? `<p><a href="${E(p.link)}" target="_blank" rel="noopener noreferrer">${E(p.link)}</a></p>` : '')
        + (tags ? `<div class="comm-tags">${tags}</div>` : '')
        + Control.rxBar({ id: 'p' + p.id }) + `<footer>${full ? '' : `<button class="btn btn-sm" data-c="comments" data-id="${p.id}">💬 ${p.comments || 0}</button>`}<button class="btn btn-sm" data-c="share" data-id="${p.id}">📤 مشاركة</button><button class="btn btn-sm" data-c="copy" data-id="${p.id}">📋 نسخ</button>`
        + (me && p.mine ? `<button class="btn btn-sm" data-c="del" data-id="${p.id}">🗑 حذف</button>` : '') + (me && !p.mine && !p.official ? `<button class="btn btn-sm" data-c="report" data-id="${p.id}">🚩 بلاغ</button>` : '')
        + (this.owner ? `<button class="btn btn-sm" data-c="mod" data-op="pin" data-id="${p.id}">${p.pin ? '📍 إلغاء التثبيت' : '📌 تثبيت'}</button><button class="btn btn-sm" data-c="mod" data-op="hide" data-id="${p.id}">🙈 إخفاء</button><button class="btn btn-sm btn-danger" data-c="mod" data-op="delpost" data-id="${p.id}">🗑 حذف</button>${au.id ? `<button class="btn btn-sm btn-danger" data-c="mod" data-op="ban" data-id="${au.id}">🚫 حظر</button>` : ''}` : '') + '</footer></article>';
    },
    skel() { return '<div class="comm-sk" aria-hidden="true"></div><div class="comm-sk"></div><div class="comm-sk"></div>'; },
    empty(ico, t, d, btn) { return `<div class="comm-empty"><div class="ico" aria-hidden="true">${ico}</div><strong>${E(t)}</strong><p class="muted">${E(d)}</p>${btn || ''}</div>`; },
    render() {
      const b = document.getElementById('comm-body'); if (!b) return;
      const f = { feed: this.feedView, compose: this.composeView, sent: this.sentView, comments: this.commentsView, grp: this.grpView, chan: this.chanView, mine: this.mineView, me: this.meView, edit: this.editView, prof: this.profView, owner: this.ownerView }[this.view];
      f.call(this, b); this.vwatch();
    },
    /** الشريط العلوي: ثابت لا يختفي مع تمرير المنشورات، ويُمرَّر أفقياً (دائرة الحساب، حقل التفكير، بحث، ثم المرشِّحات) */
    bar() {
      const me = this.st.user, ch = [['all', 'الكل'], ['official', '⭐ الرسمي'], ['img', '🖼 الصور']].concat(me ? [['following', '👥 المتابَعون']] : []);
      const chip = (k, l) => `<button type="button" class="chip${this.filter === k ? ' on' : ''}" data-c="filter" data-k="${k}" aria-pressed="${this.filter === k}">${l}</button>`;
      let h = '<div class="comm-fbar" role="toolbar" aria-label="شريط المنشورات"><div class="comm-fscroll">';
      h += me ? `<button type="button" class="comm-avb" data-c="go" data-v="me" aria-label="حسابي">${this.av(me)}</button>` : '<button type="button" class="comm-avb" data-c="go" data-v="me" aria-label="تسجيل الدخول"><span class="comm-av" aria-hidden="true">👤</span></button>';
      h += `<button class="comm-say" type="button" data-c="compose">${me ? 'بماذا تفكر يا ' + E(me.name) + '؟' : 'سجّل دخولك لتنشر وتعلّق'}</button>`;
      h += this.searching ? `<input class="comm-search" id="comm-q" type="search" maxlength="60" placeholder="ابحث في المنشورات…" aria-label="بحث في المنشورات" value="${E(this.q)}"><button type="button" class="chip" data-c="search" aria-label="إغلاق البحث">✕</button>` : `<button type="button" class="chip comm-sbtn" data-c="search" aria-label="بحث">🔍 بحث</button>`;
      h += ch.map(([k, l]) => chip(k, l)).join('');
      const ak = this.ctx ? 'addon:' + this.ctx.id : this.scope !== 'platform' ? this.scope : '';
      if (ak) h += `<button type="button" class="chip${this.scope !== 'platform' ? ' on' : ''}" data-c="scope" data-k="${E(ak)}">${ak.startsWith('group:') ? '🔒' : '📍'} ${E(this.destName(ak))}</button>${ak.startsWith('group:') ? `<button type="button" class="chip" data-c="grp" data-id="${E(ak.slice(6))}">⚙️ المجموعة</button>` : ''}<button type="button" class="chip${this.scope === 'platform' ? ' on' : ''}" data-c="scope" data-k="platform">🌐 المنصة</button>`;
      return h + '</div></div>';
    },
    feedView(b) {
      b.innerHTML = this.bar() + '<div id="comm-list"></div>'; this.list();
      const q = b.querySelector('#comm-q');
      if (q) { q.oninput = () => { this.q = q.value; this.list(); }; q.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.feed = []; this.load(); } }; if (this.focusQ) { q.focus(); this.focusQ = false; } }
    },
    list() {
      const el = document.getElementById('comm-list'); if (!el) return; let h = '';
      if (this.conn === 'off') {
        h += this.empty('🌐', 'المنصة التفاعلية غير مفعّلة بعد', 'لم يربط المالك الخادم السحابي. تجد إعلانات المالك في تبويب «القناة».', '<button class="btn btn-primary" data-c="go" data-v="chan">📣 فتح القناة</button>');
      } else if (this.conn === 'err') {
        h += this.empty('📡', 'تعذّر الاتصال بالخادم', 'تحقق من الشبكة ثم أعد المحاولة. إن استمر فالخادم غير منشور أو الرابط غير صحيح.', '<button class="btn btn-primary" data-c="reload">🔄 إعادة المحاولة</button> <button class="btn" data-c="diag">🩺 تشخيص الاتصال</button> <button class="btn" data-c="go" data-v="chan">📣 القناة</button>');
      } else if (this.conn === 'load' && !this.feed.length) h += this.skel();
      else {
        const k = this.q.trim().toLowerCase();
        const list = this.feed.filter((p) => (this.filter === 'official' ? p.official : this.filter === 'img' ? (p.media || []).some((m) => m.t === 'img') : true) && (!k || (p.text + ' ' + p.author.name).toLowerCase().includes(k)));
        h += list.length ? list.map((p) => this.card(p)).join('') + (this.more ? '<div class="comm-bar"><button class="btn" data-c="more">عرض المزيد</button></div>' : '') : this.empty(k ? '🔍' : '📝', k ? 'لا نتائج مطابقة' : 'لا منشورات هنا بعد', k ? 'جرّب كلمة أخرى، أو اضغط Enter للبحث في الخادم.' : (this.scope === 'platform' ? 'كن أول من ينشر في منصة العيسائي.' : 'كن أول من ينشر في مجتمع هذه الإضافة.'), '<button class="btn btn-primary" data-c="compose">✏️ منشور جديد</button>');
      }
      el.innerHTML = h;
    },
    /** كل الوجهات الممكنة: المنصة، إضافاتك المثبّتة، وصفحاتك الخارجية */
    dests() {
      const l = [{ k: 'platform', n: '🌐 منصة العيسائي برو' }];
      (Store.db.registry || []).filter((a) => a.type === 'addon').forEach((a) => l.push({ k: 'addon:' + a.content, n: (a.icon || '🧩') + ' ' + a.name }));
      if (this.ctx && !l.some((x) => x.k === 'addon:' + this.ctx.id)) l.push({ k: 'addon:' + this.ctx.id, n: '🧩 ' + this.ctx.name });
      this.groups.forEach((g) => l.push({ k: 'group:' + g.id, n: '🔒 ' + g.name }));
      (this.st.pages || []).forEach((g) => l.push({ k: 'page:' + g.id, n: '🔗 ' + g.name, u: g.u }));
      return l;
    },
    composeView(b) {
      if (!this.st.user) return this.go('me');
      const d = this.draft, all = this.dests(), pages = this.st.pages;
      d.dest = (d.dest || []).filter((k) => all.some((x) => x.k === k)); if (!d.dest.length) d.dest = [this.scope === 'platform' || all.some((x) => x.k === this.scope) ? this.scope : 'platform'];
      b.innerHTML = `<form class="comm-form" data-f="post"><h3>✏️ منشور جديد</h3><textarea class="field" name="text" rows="5" maxlength="3000" placeholder="اكتب منشورك…" aria-label="نص المنشور">${E(d.text)}</textarea>
        <label class="lbl" for="cm-link">رابط (اختياري)</label><input id="cm-link" class="field" name="link" dir="ltr" maxlength="300" value="${E(d.link)}" placeholder="https://">
        <div class="comm-bar"><label class="btn btn-sm">🖼 إضافة صورة<input type="file" accept="image/*" name="img" hidden></label><label class="btn btn-sm">📎 ملف أو فيديو<input type="file" name="file" hidden></label><button type="button" class="btn btn-sm" data-c="addvid">🎬 رابط فيديو</button></div><p class="muted sm" id="cm-up" role="status" hidden></p>
        <div class="comm-thumbs">${d.media.map((m, i) => `<span class="comm-th">${m.t === 'img' ? `<img alt="" src="${E(m.d)}">` : m.t === 'file' ? (m.poster ? `<img alt="" src="${E(m.poster)}">` : '') + '📎 ' + E(m.name.slice(0, 24)) + ' (' + this.fsize(m.size) + ')' : '🎬 ' + E(m.u.slice(8, 40))}<button type="button" class="btn btn-sm" data-c="rmmedia" data-i="${i}" aria-label="حذف المرفق">✕</button></span>`).join('')}</div>
        <div class="comm-dd"><button type="button" class="btn comm-ddb" data-ddt="dest" aria-haspopup="listbox" aria-expanded="false">📍 أين يُنشر؟ اختر الجهات ▾</button>
          <div class="comm-ddp" role="listbox" aria-label="جهات النشر" hidden>${all.map((x) => `<label class="comm-ddi"><input type="checkbox" data-dk="${E(x.k)}"${d.dest.includes(x.k) ? ' checked' : ''}> ${E(x.n)}</label>`).join('')}</div></div>
        <div class="comm-dchips" id="cm-chips" aria-live="polite"></div>
        <div class="comm-dd"><button type="button" class="btn comm-ddb" data-ddt="pages" aria-haspopup="true" aria-expanded="false">🔗 صفحاتي الخارجية (فيسبوك، واتساب…) ▾</button>
          <div class="comm-ddp" hidden>${pages.length ? pages.map((g) => `<div class="comm-ddi"><span class="grow">🔗 ${E(g.name)} <small dir="ltr">${E(g.u.slice(8, 38))}</small></span><button type="button" class="btn btn-sm" data-pdel="${E(g.id)}" aria-label="حذف ${E(g.name)}">🗑</button></div>`).join('') : '<p class="muted sm">لم تضف صفحات بعد.</p>'}
            <div class="comm-padd"><select class="field" name="ptype" aria-label="نوع الصفحة">${PAGE_T.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><input class="field" name="pname" maxlength="30" placeholder="اسم الصفحة (اختياري)" aria-label="اسم الصفحة"><input class="field" name="purl" dir="ltr" maxlength="300" placeholder="https://facebook.com/صفحتك" aria-label="رابط الصفحة"><button type="button" class="btn btn-primary btn-sm" data-padd>＋ إضافة إلى الوجهات</button></div></div></div>
        <p class="muted sm">المنصة والإضافات تصلها نسخة واحدة فوراً. الصفحات الخارجية تفتح بعد النشر بزر لكل صفحة مع نسخ النص (المتصفح لا يسمح بالنشر المباشر لمواقع الغير؛ التطبيق المغلَّف يتصل مباشرة بعد ربط حساباتك).</p>
        <div class="comm-bar"><button class="btn btn-primary" type="submit">🚀 نشر</button><button type="button" class="btn" data-c="go" data-v="feed">إلغاء</button></div></form>`;
      const f = b.querySelector('form'), keep = () => { d.text = f.elements.text.value; d.link = f.elements.link.value; };
      const closeAll = () => f.querySelectorAll('.comm-ddp').forEach((x) => { x.hidden = true; }), chips = () => {
        const c = f.querySelector('#cm-chips'), cur = this.dests();
        c.innerHTML = d.dest.length ? d.dest.map((k) => { const x = cur.find((y) => y.k === k); return x ? `<button type="button" class="comm-dchip" data-rm="${E(k)}" title="إزالة">✓ ${E(x.n)}</button>` : ''; }).join('') : '<span class="muted sm">اختر جهة نشر واحدة على الأقل</span>';
        f.querySelectorAll('input[data-dk]').forEach((i) => { i.checked = d.dest.includes(i.dataset.dk); });
      }; chips();
      f.addEventListener('click', (e) => {
        const t = e.target.closest('[data-ddt]'), rm = e.target.closest('[data-rm]'), del = e.target.closest('[data-pdel]');
        if (t) { const p = t.nextElementSibling, was = !p.hidden; closeAll(); p.hidden = was; t.setAttribute('aria-expanded', String(!was)); return; }
        if (rm) { d.dest = d.dest.filter((k) => k !== rm.dataset.rm); chips(); return; }
        if (del) { this.st.pages = this.st.pages.filter((g) => g.id !== del.dataset.pdel); d.dest = d.dest.filter((k) => k !== 'page:' + del.dataset.pdel); this.save(); this.pushLinks(); keep(); this.render(); const bt = document.querySelector('[data-ddt=pages]'); if (bt) bt.click(); return; }
        if (e.target.closest('[data-padd]')) {
          const x = f.elements, u = x.purl.value.trim(); if (!okUrl(u)) return UI.toast('رابط الصفحة يبدأ بـ https://', 'warn');
          if (this.st.pages.length >= 8) return UI.toast('الحد 8 صفحات', 'warn');
          const tl = (PAGE_T.find((y) => y[0] === x.ptype.value) || [0, 'صفحة'])[1], g = { id: 'g' + Date.now().toString(36), name: x.pname.value.trim().slice(0, 30) || tl, u };
          this.st.pages.push(g); d.dest.push('page:' + g.id); this.save(); this.pushLinks(); keep(); this.render(); UI.toast('أُضيفت الصفحة إلى جهات النشر', 'success');
        }
      });
      f.addEventListener('change', (e) => { const i = e.target.closest('input[data-dk]'); if (!i) return; d.dest = d.dest.filter((k) => k !== i.dataset.dk); if (i.checked) d.dest.push(i.dataset.dk);
        if (i.checked) { const gk = i.dataset.dk.startsWith('group:'); d.dest = d.dest.filter((k) => k === i.dataset.dk || (gk ? false : !k.startsWith('group:'))); if (gk) UI.toast('منشور المجموعة الخاصة لا يُنشر في غيرها', 'info'); }
        chips(); closeAll(); f.querySelector('[data-ddt=dest]').setAttribute('aria-expanded', 'false'); });
      f.elements.img.onchange = async () => { keep(); const fl = f.elements.img.files[0]; if (!fl) return; if (d.media.length >= 4) return UI.toast('الحد 4 مرفقات', 'warn'); try { d.media.push({ t: 'img', d: await this.compress(fl) }); } catch (_) { UI.toast('تعذّرت معالجة الصورة', 'error'); } this.render(); };
      f.elements.file.onchange = async () => {
        keep(); const fl = f.elements.file.files[0]; f.elements.file.value = ''; if (!fl) return;
        if (d.media.length >= 4) return UI.toast('الحد 4 مرفقات', 'warn'); if (!this.st.user) return UI.toast('سجّل الدخول لرفع الملفات', 'warn');
        const st = document.getElementById('cm-up'); st.hidden = false; st.textContent = '⏳ جارٍ رفع «' + fl.name + '» 0%'; this.uploading = true;
        try { const pst = /^video\//.test(fl.type) ? await this.posterOf(fl) : null; const att = await this.upload(fl, (x) => { st.textContent = '⏳ جارٍ رفع «' + fl.name + '» ' + Math.round(x * 100) + '%'; }); if (pst) Object.assign(att, pst); d.media.push(att); UI.toast('✅ تم رفع الملف', 'success'); }
        catch (er) { UI.toast(er.message || 'تعذّر الرفع', 'error', 6000); } this.uploading = false; if (this.sheet && this.view === 'compose') this.render();
      };
      f.onsubmit = async (e) => {
        e.preventDefault(); if (this.uploading) return UI.toast('انتظر اكتمال رفع الملف', 'warn'); keep(); const t = d.text.trim(), l = d.link.trim(); if (!t && !d.media.length) return UI.toast('اكتب نصاً أو أضف صورة', 'warn'); if (l && !okUrl(l)) return UI.toast('الرابط يبدأ بـ https://', 'warn');
        if (!d.dest.length) return UI.toast('اختر جهة نشر واحدة على الأقل', 'warn');
        const sc = d.dest.filter((k) => k === 'platform' || k.startsWith('addon:') || k.startsWith('group:')), ext = d.dest.filter((k) => k.startsWith('page:')).map((k) => this.st.pages.find((g) => 'page:' + g.id === k)).filter(Boolean);
        if (sc.length) { const r = await this.call('/v1/posts', { method: 'POST', body: { text: t, link: l, media: d.media, scopes: sc } }); if (!r || !r.ok) return UI.toast(r && r.error ? (r.error === 'rate' ? 'تجاوزت حد النشر، حاول لاحقاً' : r.error) : 'تعذّر النشر: لا اتصال بالخادم', 'error'); }
        const txt = t + (l ? '\n' + l : '') + d.media.filter((m) => m.t === 'vid').map((m) => '\n' + m.u).join('');
        this.sent = { names: sc.map((k) => this.destName(k)), ext, txt }; this.draft = { text: '', link: '', media: [], dest: [] }; this.go('sent'); this.load();
      };
    },
    /** نتيجة النشر: ما وصل فعلاً، وأزرار الصفحات الخارجية (نسخ النص ثم فتح الصفحة) */
    sentView(b) {
      const r = this.sent; if (!r) return this.go('feed');
      b.innerHTML = `<div class="ctl-card comm-me"><div class="ico" aria-hidden="true" style="font-size:2.2rem">✅</div><strong>تم النشر</strong>${r.names.length ? `<p>وصل إلى: ${r.names.map((n) => `<span class="comm-dchip">✓ ${E(n)}</span>`).join(' ')}</p>` : ''}</div>`
        + (r.ext.length ? `<div class="ctl-card"><strong>صفحاتك الخارجية</strong><p class="muted sm">يُنسخ النص ثم تُفتح الصفحة، فألصقه وانشر.</p>${r.ext.map((g, i) => `<div class="admin-row"><span class="grow">🔗 ${E(g.name)}</span><button class="btn btn-sm btn-primary" data-c="ext" data-i="${i}">📋 انسخ وافتح</button></div>`).join('')}</div>` : '')
        + '<div class="comm-bar"><button class="btn" data-c="sharesent">📤 مشاركة عبر تطبيقات الجهاز</button><button class="btn btn-primary" data-c="go" data-v="feed">عودة للموجز</button></div>';
    },
    async commentsView(b) {
      const p = this.findPost(this.post); if (!p) return this.go('feed');
      b.innerHTML = '<button class="btn btn-sm" data-c="go" data-v="feed">→ رجوع</button>' + this.card(p, true) + '<div id="comm-cm"><p class="muted">جارٍ التحميل…</p></div>' + (this.st.user ? '<form class="comm-form" data-f="cm"><textarea class="field" name="text" rows="2" maxlength="800" placeholder="اكتب تعليقاً" aria-label="تعليق"></textarea><div class="comm-bar"><button class="btn btn-primary" type="submit">إرسال</button></div></form>' : '<div class="comm-bar"><button class="btn" data-c="go" data-v="me">سجّل الدخول للتعليق</button></div>');
      const show = async () => { const r = await this.call('/v1/posts/' + p.id + '/comments'), h = document.getElementById('comm-cm'); if (h) h.innerHTML = r && r.comments ? (r.comments.length ? r.comments.map((c) => `<div class="comm-cm"><strong>${E(c.author.name)}</strong> <small>${ago(c.ts)}</small><p>${E(c.text)}</p></div>`).join('') : '<p class="muted">لا تعليقات بعد.</p>') : '<p class="muted">تعذّر التحميل.</p>'; };
      show(); const f = b.querySelector('form');
      if (f) f.onsubmit = async (e) => { e.preventDefault(); const v = f.elements.text.value.trim(); if (!v) return; const r = await this.call('/v1/posts/' + p.id + '/comments', { method: 'POST', body: { text: v } }); if (!r || !r.ok) return UI.toast('تعذّر الإرسال', 'error'); f.elements.text.value = ''; p.comments = (p.comments || 0) + 1; show(); };
    },
    chanView(b) {
      const items = Control.visible().slice(0, 30), ch = this.channels(), c = (Control.ch && Control.ch.contact) || {};
      let h = '<div class="comm-bar"><button class="btn" data-c="contact">📩 تواصل مع المالك</button><button class="btn" data-c="shareapp">📤 شارك العيسائي برو</button></div>';
      if (ch.length) h += '<div class="ctl-card"><strong>صفحات المالك وقنواته</strong><div class="comm-bar">' + ch.map((x) => `<a class="btn btn-sm" href="${E(x.url)}" target="_blank" rel="noopener noreferrer">${E(x.name)}</a>`).join('') + '</div></div>';
      h += items.length ? items.map((i) => `<article class="ctl-card"><header><strong>${E(i.title)}</strong>${i.pin ? ' <span class="badge">📌</span>' : ''}</header>${i.body ? `<p class="comm-tx">${E(i.body)}</p>` : ''}${Control.rxBar(i)}<footer>${i.link ? `<a class="btn btn-sm" href="${E(i.link)}" target="_blank" rel="noopener noreferrer">فتح الرابط</a>` : ''}<button class="btn btn-sm" data-c="shareitem" data-id="${E(i.id)}">📤 مشاركة</button></footer></article>`).join('') : this.empty('📣', 'لا إعلانات الآن', 'ستظهر هنا إعلانات المالك وتحديثاته.');
      if (c.note) h += `<p class="muted">${E(c.note)}</p>`; b.innerHTML = h;
      Control.loadCounts(items.map((i) => i.id)).then((ok) => { if (ok && this.view === 'chan' && this.sheet) { const y = b.scrollTop; this.chanView(b); b.scrollTop = y; } });
    },
    plan(code) { try { const p = JSON.parse(decodeURIComponent(escape(atob(code.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))))); return p && typeof p === 'object' ? p : null; } catch (_) { return null; } },
    mineView(b) {
      const aid = Control.st.aid, subs = Object.entries(Control.st.subs || {}), pay = (Control.ch && Control.ch.pay) || [], rq = Control.st.rq || [];
      b.innerHTML = `<div class="ctl-card"><strong>معرّف حسابك</strong><p><code dir="ltr">${E(aid)}</code> <button class="btn btn-sm" data-c="copyaid">📋 نسخ</button></p><p class="muted sm">رمز الاشتراك الذي يرسله لك المالك مربوط بهذا المعرّف فلا يعمل عند غيرك.</p></div>`
        + '<div class="comm-bar"><button class="btn btn-primary" data-c="subreq">📨 طلب اشتراك</button><button class="btn" data-c="entercode">🔑 إدخال رمز</button></div>'
        + (rq.length ? `<div class="ctl-card"><strong>⏳ طلبات بانتظار موافقة المالك (${rq.length})</strong><p class="muted sm">يُفعَّل الاشتراك تلقائياً عند القبول.</p><button class="btn btn-sm" data-c="syncq">🔄 تحقق الآن</button></div>` : '')
        + '<h4>اشتراكاتي</h4>' + (subs.length ? subs.map(([a, code]) => { const p = this.plan(code) || {}, exp = p.e ? p.e < Date.now() : false; return `<div class="ctl-card"><header><strong>${E(a === '*' ? 'كل الإضافات' : a)}</strong> <span class="badge">${exp ? '⛔ منتهٍ' : '✅ فعّال'}</span></header><p class="muted sm">${p.e ? (exp ? 'انتهى في ' : 'ينتهي في ') + day(p.e) : 'مدة مفتوحة'}</p>${exp ? `<button class="btn btn-sm btn-primary" data-c="subreq" data-a="${E(a)}">جدّد</button>` : ''}</div>`; }).join('') : this.empty('🔑', 'لا اشتراكات فعّالة', 'الإضافات المجانية تعمل دون اشتراك. اطلب اشتراكاً للإضافات المدفوعة.'))
        + (pay.length ? '<h4>طرق الدفع</h4><div class="ctl-card">' + pay.map((x) => `<p><b>${E(x.name)}:</b> <span dir="ltr">${E(x.details)}</span></p>`).join('') + '</div>' : '');
    },
    meView(b) {
      const me = this.st.user;
      if (me) {
        b.innerHTML = `<div class="ctl-card comm-me">${this.av(me, true)}<strong>${E(me.name)}</strong>${KIND_L[me.kind] ? ` <span class="badge">${KIND_L[me.kind]}</span>` : ''}${me.bio ? `<p class="comm-tx muted">${E(me.bio)}</p>` : '<p class="muted sm">أضف نبذة عنك من «تعديل الملف الشخصي».</p>'}<div class="comm-bar"><button class="btn btn-primary" data-c="compose">✏️ منشور جديد</button><button class="btn" data-c="edit">⚙️ تعديل الملف الشخصي</button></div><div class="comm-bar"><button class="btn" data-c="prof" data-id="${me.id}" data-from="me">👁 صفحتي العامة</button><button class="btn" data-c="logout">خروج</button></div></div>`
          + '<div id="comm-fr"></div><div id="comm-grp"></div>'; this.grpList(); this.loadGroups();
        this.call('/v1/friends').then((r) => {
          const h = document.getElementById('comm-fr'); if (!h || !r || !r.friends) return;
          const row = (u, ex) => `<div class="admin-row"><button type="button" class="comm-avb" data-c="prof" data-id="${u.id}" data-from="me">${this.av(u)}</button><span class="grow comm-lnk" data-c="prof" data-id="${u.id}" data-from="me">${E(u.name)}</span>${ex || ''}</div>`;
          h.innerHTML = `<div class="ctl-card"><strong>🤝 الأصدقاء (${r.friends.length})</strong>${r.incoming.length ? `<h4>طلبات صداقة (${r.incoming.length})</h4>` + r.incoming.map((u) => row(u, `<button class="btn btn-sm btn-primary" data-c="fr" data-op="accept" data-id="${u.id}">قبول</button><button class="btn btn-sm" data-c="fr" data-op="remove" data-id="${u.id}">رفض</button>`)).join('') : ''}${r.friends.length ? r.friends.map((u) => row(u)).join('') : '<p class="muted sm">لا أصدقاء بعد. افتح صفحة أي حساب من المنشورات وأرسل له طلباً.</p>'}</div>`;
        });
        return;
      }
      b.innerHTML = `<form class="comm-form" data-f="auth"><h3>${this.reg ? '📝 إنشاء حساب' : '👤 تسجيل الدخول'}</h3>${this.api() ? '' : '<p class="muted">المنصة غير مفعّلة بعد، لذا لا يمكن إنشاء حساب الآن.</p>'}${this.reg ? '<label class="lbl" for="au-n">الاسم الظاهر</label><input id="au-n" class="field" name="name" maxlength="40" autocomplete="name">' : ''}<label class="lbl" for="au-i">بريد أو هاتف أو اسم مستخدم</label><input id="au-i" class="field" name="ident" maxlength="60" dir="ltr" autocomplete="username"><label class="lbl" for="au-p">كلمة المرور (8 أحرف فأكثر)</label><input id="au-p" class="field" name="password" type="password" maxlength="100" dir="ltr" autocomplete="${this.reg ? 'new-password' : 'current-password'}"><div class="comm-bar"><button class="btn btn-primary" type="submit">${this.reg ? 'إنشاء الحساب' : 'دخول'}</button><button type="button" class="btn" data-c="regtoggle">${this.reg ? 'لدي حساب' : 'حساب جديد'}</button></div></form>`;
      b.querySelector('form').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target.elements, r = await this.call(this.reg ? '/v1/auth/register' : '/v1/auth/login', { method: 'POST', body: { name: f.name ? f.name.value : '', ident: f.ident.value, password: f.password.value, did: Control.st.did } });
        if (!r || !r.token) return UI.toast(r && r.error ? r.error : 'تعذّر الاتصال بالخادم', 'error');
        this.st.token = r.token; this.st.user = r.user; if (Array.isArray(r.user.links) && r.user.links.length && !this.st.pages.length) this.st.pages = r.user.links.slice(0, 8).map((g, i) => ({ id: 'g' + i + Date.now().toString(36), name: g.n, u: g.u }));
        await this.save(); UI.toast('أهلاً ' + r.user.name, 'success'); this.loadGroups(); this.go('feed'); this.feed = []; this.load();
      };
    },
    /** إدارة مجموعة: الأعضاء، دعوة الأصدقاء (للمالك)، المغادرة أو الحذف */
    async grpView(b) {
      const id = this.gid, back = '<button class="btn btn-sm" data-c="back">→ رجوع</button>'; b.innerHTML = back + '<p class="muted">جارٍ التحميل…</p>';
      const [r, fr] = await Promise.all([this.call('/v1/groups/' + id), this.call('/v1/friends')]);
      if (!this.sheet || this.view !== 'grp' || this.gid !== id) return;
      if (!r || !r.group || r.invited) { b.innerHTML = back + '<p class="muted">لا تملك صلاحية عرض هذه المجموعة.</p>'; return; }
      const g = r.group, ids = new Set(r.members.map((m) => m.id).concat(r.pending.map((m) => m.id))), cand = ((fr && fr.friends) || []).filter((u) => !ids.has(u.id));
      b.innerHTML = back + `<div class="ctl-card"><strong>🔒 ${E(g.name)}</strong>${g.descr ? `<p class="muted">${E(g.descr)}</p>` : ''}<p class="muted sm">مجموعة خاصة: منشوراتها وتعليقاتها للأعضاء فقط.</p><div class="comm-bar"><button class="btn btn-primary" data-c="scope" data-k="group:${g.id}">💬 فتح موجز المجموعة</button>${r.mine ? `<button class="btn btn-danger" data-c="gop" data-op="delete" data-id="${g.id}">🗑 حذف المجموعة</button>` : `<button class="btn" data-c="gop" data-op="leave" data-id="${g.id}">مغادرة</button>`}</div></div>`
        + `<div class="ctl-card"><strong>👥 الأعضاء (${r.members.length})</strong>${r.members.map((u) => `<div class="admin-row"><button type="button" class="comm-avb" data-c="prof" data-id="${u.id}" data-from="grp">${this.av(u)}</button><span class="grow">${E(u.name)}${u.role === 'o' ? ' <span class="badge">مالك</span>' : ''}</span>${r.mine && u.role !== 'o' ? `<button class="btn btn-sm" data-c="gop" data-op="kick" data-id="${g.id}" data-uid="${u.id}">إزالة</button>` : ''}</div>`).join('')}</div>`
        + (r.mine ? `<div class="ctl-card"><strong>➕ دعوة أصدقائك</strong>${r.pending.length ? `<p class="muted sm">بانتظار القبول: ${r.pending.map((u) => E(u.name)).join('، ')}</p>` : ''}${cand.length ? cand.map((u) => `<div class="admin-row"><span class="grow">${E(u.name)}</span><button class="btn btn-sm btn-primary" data-c="gop" data-op="invite" data-id="${g.id}" data-uid="${u.id}">دعوة</button></div>`).join('') : '<p class="muted sm">تُدعى من بين أصدقائك فقط. أرسل طلبات صداقة من صفحات الحسابات أولاً.</p>'}</div>` : '');
    },
    /** تعديل الملف الشخصي: صورة، اسم، بريد، هاتف، نبذة، ونوع الحساب (شخصي/تاجر/شركة/مختص) */
    editView(b) {
      const me = this.st.user; if (!me) return this.go('me'); this.edit = { av: undefined };
      b.innerHTML = `<form class="comm-form" data-f="edit"><h3>⚙️ تعديل الملف الشخصي</h3>
        <div class="comm-avedit"><span id="ed-prev">${this.av(me, true)}</span><div><label class="btn btn-sm">🖼 اختيار صورة<input type="file" accept="image/*" name="img" hidden></label> <button type="button" class="btn btn-sm" data-rmav>إزالة الصورة</button><p class="muted sm">دائرة الحساب تعرض صورتك، وبدونها أول حرف من اسمك.</p></div></div>
        <label class="lbl" for="ed-n">الاسم الظاهر</label><input id="ed-n" class="field" name="name" maxlength="40" value="${E(me.name)}" required>
        <label class="lbl" for="ed-k">نوع الحساب</label><select id="ed-k" class="field" name="kind"><option value="person">👤 شخصي</option><option value="business">🏪 تاجر / نشاط تجاري</option><option value="company">🏢 شركة أو مؤسسة</option><option value="pro">👨‍⚕️ مختص (طبيب، محامٍ، مهندس…)</option></select>
        <label class="lbl" for="ed-e">البريد الإلكتروني</label><input id="ed-e" class="field" name="email" type="email" dir="ltr" maxlength="80" value="${E(me.email || '')}" autocomplete="email">
        <label class="lbl" for="ed-p">رقم الهاتف</label><input id="ed-p" class="field" name="phone" type="tel" dir="ltr" maxlength="25" value="${E(me.phone || '')}" autocomplete="tel">
        <label class="comm-ddi"><input type="checkbox" name="showc"${me.showc ? ' checked' : ''}> إظهار البريد والهاتف في صفحتي العامة (للعملاء)</label>
        <label class="lbl" for="ed-b">نبذة / سيرة / قصة</label><textarea id="ed-b" class="field" name="bio" rows="5" maxlength="600" placeholder="عرّف الناس بك أو بنشاطك ومنتجاتك وخدماتك">${E(me.bio || '')}</textarea>
        <div class="comm-bar"><button class="btn btn-primary" type="submit">💾 حفظ</button><button type="button" class="btn" data-c="go" data-v="me">إلغاء</button></div>
        <div class="ctl-card" style="border-color:var(--danger)"><strong>🗑 حذف الحساب</strong><p class="muted sm">يحذف حسابك نهائياً مع منشوراتك وتعليقاتك وملفاتك ومجموعاتك وصداقاتك من الخادم. لا يمكن التراجع.</p><button type="button" class="btn btn-danger" data-c="delacc">🗑 حذف حسابي نهائياً</button></div></form>`;
      const f = b.querySelector('form'); f.elements.kind.value = me.kind || 'person';
      f.elements.img.onchange = async () => { const fl = f.elements.img.files[0]; if (!fl) return; try { this.edit.av = await this.compress(fl, 192, 60000, true); document.getElementById('ed-prev').innerHTML = `<img class="comm-av big" alt="" src="${E(this.edit.av)}">`; } catch (_) { UI.toast('تعذّرت معالجة الصورة', 'error'); } };
      f.querySelector('[data-rmav]').onclick = () => { this.edit.av = ''; document.getElementById('ed-prev').innerHTML = `<span class="comm-av big">${E(f.elements.name.value.trim().slice(0, 1) || '؟')}</span>`; };
      f.onsubmit = async (e) => {
        e.preventDefault(); const x = f.elements, body = { name: x.name.value, email: x.email.value, phone: x.phone.value, bio: x.bio.value, kind: x.kind.value, showc: x.showc.checked }; if (this.edit.av !== undefined) body.av = this.edit.av;
        const r = await this.call('/v1/me', { method: 'POST', body }); if (!r || !r.ok) return UI.toast(r && r.error ? r.error : 'تعذّر الحفظ: لا اتصال بالخادم', 'error');
        this.st.user = r.user; await this.save(); this.edit = null; UI.toast('تم حفظ الملف الشخصي', 'success'); this.go('me');
      };
    },
    /** صفحة حساب عامة (تاجر/شركة/مختص/شخص): نبذة، تواصل، روابط، متابعة وصداقة، ومنشوراته */
    async profView(b) {
      const id = this.profId, back = '<button class="btn btn-sm" data-c="back">→ رجوع</button>'; b.innerHTML = back + '<p class="muted">جارٍ التحميل…</p>';
      const [ur, pr] = await Promise.all([this.call('/v1/u/' + id), this.call('/v1/posts?author=' + id)]);
      if (!this.sheet || this.view !== 'prof' || this.profId !== id) return;
      if (!ur || !ur.user) { b.innerHTML = back + '<p class="muted">تعذّر تحميل الصفحة.</p>'; return; }
      this.profU = ur.user; this.pfeed = (pr && pr.posts) || []; this.profPaint(b);
      Control.loadCounts(this.pfeed.map((p) => 'p' + p.id)).then((ok) => { if (ok && this.view === 'prof' && this.sheet && this.profId === id) { const y = b.scrollTop; this.profPaint(b); b.scrollTop = y; } });
    },
    profPaint(b) {
      const u = this.profU, me = this.st.user, self = me && me.id === u.id, back = '<button class="btn btn-sm" data-c="back">→ رجوع</button>';
      const dig = (u.phone || '').replace(/\D/g, ''), fs = { none: ['🤝 طلب صداقة', 'send'], incoming: ['✅ قبول الصداقة', 'accept'], sent: ['⏳ أُرسل الطلب (إلغاء)', 'remove'], friends: ['✓ أصدقاء (إزالة)', 'remove'] }[u.friend || 'none'];
      b.innerHTML = back + `<div class="ctl-card comm-me">${this.av(u, true)}<strong>${E(u.name)}</strong>${KIND_L[u.kind] ? ` <span class="badge">${KIND_L[u.kind]}</span>` : ''}${u.bio ? `<p class="comm-tx">${E(u.bio)}</p>` : ''}<p class="muted sm">👥 ${u.followers} متابع • 📝 ${u.posts} منشور</p>`
        + (u.phone || u.email ? '<div class="comm-bar">' + (dig ? `<a class="btn btn-sm" href="tel:+${dig}">📞 اتصال</a><a class="btn btn-sm" href="https://wa.me/${dig}" target="_blank" rel="noopener noreferrer">واتساب</a>` : '') + (/^[^\s@<>"']+@[^\s@<>"']+$/.test(u.email || '') ? `<a class="btn btn-sm" href="mailto:${E(u.email)}">✉️ بريد</a>` : '') + '</div>' : '')
        + (u.links.length ? '<div class="comm-bar">' + u.links.map((g) => `<a class="btn btn-sm" href="${E(g.u)}" target="_blank" rel="noopener noreferrer">🔗 ${E(g.n)}</a>`).join('') + '</div>' : '')
        + (self ? '<div class="comm-bar"><button class="btn" data-c="edit">⚙️ تعديل الملف الشخصي</button></div>' : `<div class="comm-bar"><button class="btn ${u.following ? '' : 'btn-primary'}" data-c="follow" data-id="${u.id}" data-off="${u.following ? 1 : ''}">${u.following ? '✓ تتابعه' : '➕ متابعة'}</button><button class="btn" data-c="fr" data-op="${fs[1]}" data-id="${u.id}">${fs[0]}</button><button class="btn" data-c="shareprof" data-id="${u.id}">📤 مشاركة</button></div>`) + '</div>'
        + '<h4>منشوراته وعروضه</h4>' + (this.pfeed.length ? this.pfeed.map((p) => this.card(p)).join('') : this.empty('📝', 'لا منشورات بعد', 'ستظهر هنا منشورات هذا الحساب وعروضه.'));
    },
    async ownerView(b) {
      if (!this.owner) return this.go('feed');
      b.innerHTML = '<p class="muted">جارٍ التحميل…</p>'; const key = this.owner, base = this.api();
      const [st, us] = await Promise.all([Control.call('/v1/admin/stats', { base, key }), Control.call('/v1/admin/users', { base, key })]);
      if (!this.sheet || this.view !== 'owner') return;
      b.innerHTML = `<div class="ctl-card"><strong>🛡 أدوات المالك</strong><p class="muted sm">ظاهرة لك فقط لأن مفتاح المالك محفوظ مشفّراً على هذا الجهاز.</p>${st ? `<p>👥 ${st.users || 0} مستخدم • 🟢 ${st.online || 0} متصل</p>` : '<p class="muted">تعذّر جلب الإحصاءات.</p>'}</div>`
        + '<div class="ctl-card" id="own-stor"><strong>💾 تخزين الملفات والفيديو</strong><p class="muted sm">جارٍ الفحص…</p></div>'
        + `<form class="comm-form" data-f="official"><h3>⭐ منشور رسمي</h3><textarea class="field" name="text" rows="3" maxlength="3000" placeholder="يظهر باسم العيسائي برو" aria-label="نص المنشور الرسمي"></textarea><label><input type="checkbox" name="pin"> تثبيت في الأعلى</label><div class="comm-bar"><button class="btn btn-primary" type="submit">نشر رسمي</button><button type="button" class="btn" data-c="subs">📨 طلبات الاشتراك</button></div></form>`
        + '<h4>الحسابات</h4>' + (us && us.users.length ? us.users.slice(0, 40).map((u) => `<div class="admin-row"><span class="grow">${E(u.name)} <small dir="ltr">${E(u.ident)}</small> ${u.banned ? '<span class="badge">محظور</span>' : ''}</span><button class="btn btn-sm" data-c="mod" data-op="${u.banned ? 'unban' : 'ban'}" data-id="${u.id}">${u.banned ? 'رفع الحظر' : '🚫 حظر'}</button><button class="btn btn-sm btn-danger" data-c="mod" data-op="deluser" data-id="${u.id}">🗑 حذف</button></div>`).join('') : '<p class="muted">لا حسابات.</p>')
        + (us && us.reports.length ? '<h4>منشورات عليها بلاغات</h4>' + us.reports.map((r) => `<div class="admin-row"><span class="grow">منشور #${r.post} — ${r.n} بلاغ</span><button class="btn btn-sm" data-c="mod" data-op="hide" data-id="${r.post}">🙈 إخفاء</button><button class="btn btn-sm btn-danger" data-c="mod" data-op="delpost" data-id="${r.post}">🗑 حذف</button></div>`).join('') : '');
      const paintStor = async (set) => {
        const box = b.querySelector('#own-stor'); if (!box) return; const s = await Control.call('/v1/admin/storage', Object.assign({ base, key }, set === undefined ? {} : { method: 'POST', body: { on: set } }));
        if (!s || s.error) { if (set !== undefined) UI.toast(s && s.error ? s.error : 'تعذّر الحفظ', 'error', 6000); if (set === undefined) box.innerHTML = '<strong>💾 تخزين الملفات والفيديو</strong><p class="muted sm">حدّث الخادم (worker.js 2.13) لتظهر الإعدادات.</p>'; return; }
        box.innerHTML = `<strong>💾 تخزين الملفات والفيديو</strong><p class="sm">الوضع الحالي: <b>${s.on ? 'R2 (حتى ' + s.limitMB.r2 + ' ميغابايت للملف، بث مباشر)' : 'قاعدة البيانات D1 (حتى ' + s.limitMB.d1 + ' ميغابايت للملف)'}</b></p><p class="muted sm">${s.bound ? '✅ حاوية R2 مربوطة بالخادم.' : 'حاوية R2 غير مربوطة بعد (Cloudflare ← Worker ← Bindings ← R2 باسم FILES).'} الملفات المرفوعة سابقاً تبقى تعمل في الوضعين.</p><button class="btn ${s.on ? '' : 'btn-primary'}" ${s.bound ? '' : 'disabled'} data-stor="${s.on ? 0 : 1}">${s.on ? 'العودة إلى D1' : '⚡ تفعيل R2'}</button>`;
        const bt = box.querySelector('[data-stor]'); if (bt) bt.onclick = () => paintStor(bt.dataset.stor === '1');
      }; paintStor();
      const f = b.querySelector('form[data-f="official"]'); f.onsubmit = async (e) => { e.preventDefault(); const t = f.elements.text.value.trim(); if (!t) return; const r = await Control.call('/v1/admin/post', { method: 'POST', base, key, body: { text: t, pin: f.elements.pin.checked } }); if (!r || !r.ok) return UI.toast('تعذّر النشر', 'error'); UI.toast('تم النشر الرسمي', 'success'); this.go('feed'); this.load(); };
    },
    async compress(file, max = MAXW, lim = 240000, square = false) {
      const bm = await createImageBitmap(file), c = document.createElement('canvas'), g = c.getContext('2d');
      if (square) { const m = Math.min(bm.width, bm.height); c.width = c.height = Math.min(max, m); g.drawImage(bm, (bm.width - m) / 2, (bm.height - m) / 2, m, m, 0, 0, c.width, c.height); }
      else { const k = Math.min(1, max / Math.max(bm.width, bm.height)); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); g.drawImage(bm, 0, 0, c.width, c.height); }
      for (const q of [0.82, 0.7, 0.55, 0.4, 0.3]) { const d = c.toDataURL('image/jpeg', q); if (d.length < lim) return d; } throw new Error('big');
    },
    /** يدفع روابط صفحاتك الخارجية لملفك العام ليراها عملاؤك (محاولة بلا إزعاج) */
    pushLinks() { if (this.st.user && this.api()) this.call('/v1/me', { method: 'POST', body: { links: this.st.pages.map((g) => ({ n: g.name, u: g.u })) } }).then((r) => { if (r && r.ok) { this.st.user = r.user; this.save(); } }); },
    keepDraft() { const f = this.sheet && this.sheet.querySelector('form[data-f=post]'); if (f) { this.draft.text = f.elements.text.value; this.draft.link = f.elements.link.value; } },
    postText(p) { return p.author.name + ': ' + p.text + (p.link ? '\n' + p.link : ''); },
    async act(a, ds) {
      if (a === 'addvid' || a === 'rmmedia') this.keepDraft();
      if (a === 'close') return this.close();
      if (a === 'reload') { this.go('feed'); return this.load(); }
      if (a === 'go') return this.go(ds.v);
      if (a === 'more') return this.load(true);
      if (a === 'filter') { const rl = (ds.k === 'following') !== (this.filter === 'following'); this.filter = ds.k; if (rl) { this.feed = []; this.conn = 'load'; this.render(); return this.load(); } return this.render(); }
      if (a === 'search') { this.searching = !this.searching; if (!this.searching && this.q) { this.q = ''; this.feed = []; this.focusQ = false; this.render(); return this.load(); } this.focusQ = this.searching; return this.render(); }
      if (a === 'scope') { if (this.scope === ds.k && this.view === 'feed') return; this.scope = ds.k; this.feed = []; this.conn = 'load'; if (this.view !== 'feed') this.go('feed'); else this.render(); return this.load(); }
      if (a === 'diag') {
        UI.toast('جارٍ فحص الاتصال…', 'info'); const r = await Control.diagnose();
        const msg = r.length ? r.map((x) => (x.ok ? '🟢 ' : '🔴 ') + x.base.replace('https://', '') + (x.ok ? ' (' + x.ms + ' م.ث)' : ' — لا استجابة')).join('\n') + (r.some((x) => x.ok) ? '\n\nالخادم يعمل. أعد المحاولة.' : '\n\nلا استجابة من أي رابط: غالباً شبكتك أو مزوّد الإنترنت يحجب نطاق الخادم (workers.dev). جرّب بيانات الجوال أو شبكة أخرى، أو اطلب من المالك رابطاً بديلاً بنطاق خاص.') : (Control.ch ? 'لم يضبط المالك رابط الخادم في القناة.' : 'تعذّر تحميل إعدادات الموقع (control/channel.json). تحقق من الإنترنت، فقد يكون الموقع نفسه محجوباً في شبكتك.');
        await UI.dialog({ title: 'تشخيص الاتصال', message: msg, okText: 'حسناً', hideCancel: true }); return;
      }
      if (a === 'grp') { this.gid = +ds.id; this.pback = this.view === 'grp' ? this.pback : this.view; return this.go('grp'); }
      if (a === 'gnew') {
        const v = await UI.dialog({ title: 'مجموعة خاصة جديدة', message: 'لا يراها إلا من تدعوهم من أصدقائك.', okText: 'إنشاء', fields: [{ id: 'n', label: 'اسم المجموعة', maxlength: 40 }, { id: 'd', label: 'وصف (اختياري)', maxlength: 200 }], validate: (x) => (x.n.trim().length >= 2 ? '' : 'الاسم حرفان فأكثر') });
        if (!v) return; const r = await this.call('/v1/groups', { method: 'POST', body: { name: v.n, descr: v.d } }); if (!r || !r.ok) return UI.toast(r && r.error ? r.error : 'تعذّر الإنشاء', 'error');
        UI.toast('أُنشئت المجموعة', 'success'); await this.loadGroups(); this.grpList(); return;
      }
      if (a === 'gop') {
        if (ds.op === 'delete' || ds.op === 'leave') { const ok = await UI.dialog({ title: ds.op === 'delete' ? 'حذف المجموعة' : 'مغادرة المجموعة', message: ds.op === 'delete' ? 'تُحذف المجموعة بمنشوراتها نهائياً.' : 'لن ترى منشورات المجموعة بعد المغادرة.', okText: ds.op === 'delete' ? 'حذف' : 'مغادرة', danger: true }); if (!ok) return; }
        const r = await this.call('/v1/groups/' + ds.id, { method: 'POST', body: { op: ds.op, uid: +ds.uid || 0 } }); if (!r || !r.ok) return UI.toast(r && r.error ? r.error : 'تعذّر التنفيذ', 'error');
        await this.loadGroups(); if (ds.op === 'delete' || ds.op === 'leave') { if (this.scope === 'group:' + ds.id) { this.scope = 'platform'; this.feed = []; } this.pback = 'me'; return this.go('me'); }
        if (ds.op === 'invite') UI.toast('أُرسلت الدعوة', 'success'); return this.render();
      }
      if (a === 'edit') return this.go('edit');
      if (a === 'back') return this.go(this.pback || 'feed');
      if (a === 'prof') { if (!(+ds.id > 0)) return; this.profId = +ds.id; this.pback = ds.from || (this.view === 'prof' ? this.pback : this.view); return this.go('prof'); }
      if (a === 'follow') { const r = await this.call('/v1/follow/' + ds.id, { method: 'POST', body: { off: !!ds.off } }); if (!r || !r.ok) return UI.toast(r && r.error === 'سجّل الدخول أولاً' ? 'سجّل دخولك أولاً' : 'تعذّر التنفيذ', 'error'); return this.render(); }
      if (a === 'fr') { const r = await this.call('/v1/friend/' + ds.id, { method: 'POST', body: { op: ds.op } }); if (!r || !r.ok) return UI.toast(r && r.error === 'rate' ? 'تجاوزت الحد اليومي' : 'تعذّر التنفيذ', 'error'); if (ds.op === 'send') UI.toast('أُرسل طلب الصداقة', 'success'); return this.render(); }
      if (a === 'shareprof') { const u = this.profU; if (u) Control.share(u.name + (u.bio ? '\n' + u.bio : '') + '\n' + u.links.map((g) => g.u).join('\n') + '\nعلى منصة العيسائي برو'); return; }
      if (a === 'ext') { const g = this.sent && this.sent.ext[+ds.i]; if (!g) return; let cp; try { cp = navigator.clipboard.writeText(this.sent.txt).then(() => true, () => false); } catch (_) { cp = Promise.resolve(false); } window.open(g.u, '_blank', 'noopener'); cp.then((ok) => UI.toast(ok ? 'نُسخ النص، ألصقه في الصفحة' : 'انسخ النص يدوياً ثم الصقه في الصفحة', ok ? 'success' : 'warn')); return; }
      if (a === 'sharesent') { if (this.sent) Control.share(this.sent.txt); return; }
      if (a === 'regtoggle') { this.reg = !this.reg; return this.render(); }
      if (a === 'logout') { this.st = { token: '', user: null, pages: this.st.pages || [] }; this.filter = 'all'; this.groups = []; this.invites = []; if (/^group:/.test(this.scope)) { this.scope = 'platform'; this.feed = []; } await this.save(); return this.render(); }
      if (a === 'contact') return Control.contact({ kind: 'inq' });
      if (a === 'shareapp') return Control.share('العيسائي برو — نظام تشغيل مصغّر بالعربية\n' + location.origin + location.pathname);
      if (a === 'shareitem') { const i = Control.visible().find((x) => x.id === ds.id); if (i) Control.share(i.title + (i.body ? '\n\n' + i.body : '') + (i.link ? '\n' + i.link : '')); return; }
      if (a === 'compose') return this.st.user ? this.go('compose') : (UI.toast('سجّل دخولك أولاً', 'warn'), this.go('me'));
      if (a === 'addvid') { const v = await UI.prompt('رابط الفيديو', { label: 'رابط https لفيديو (يوتيوب أو ملف mp4)', placeholder: 'https://' }); if (v && okUrl(v.trim())) this.draft.media.push({ t: 'vid', u: v.trim() }); else if (v) UI.toast('الرابط يبدأ بـ https://', 'warn'); return this.render(); }
      if (a === 'rmmedia') { const x = this.draft.media.splice(+ds.i, 1)[0]; if (x && x.t === 'file') this.call('/v1/files/' + x.id, { method: 'DELETE' }); return this.render(); }
      if (a === 'fplay') { const el = this.sheet.querySelector('.comm-vp[data-id="' + ds.id + '"]'); if (el) await this.vstart(el, false); return; }
      if (a === 'fdl' || a === 'fview') {
        const card = this.sheet && this.sheet.querySelector('[data-fid="' + ds.id + '"]'); let m = this.feed.concat(this.pfeed).flatMap((p) => p.media || []).find((x) => x.id === ds.id); if (m) m = Object.assign({ chunks: Math.ceil(m.size / 262144) }, m); else m = await this.fileMeta(ds.id);
        if (!m) return UI.toast('تعذّر تحميل الملف', 'error'); UI.toast('⏳ جارٍ التحميل…', 'info');
        try {
          const bl = await this.fetchFile(ds.id, Object.assign({ mode: 'd1' }, m)), url = URL.createObjectURL(bl), k = this.fkind(m);
          if (a === 'fview' && card && k !== 'file') { const el = document.createElement(k === 'vid' ? 'video' : k === 'aud' ? 'audio' : 'img'); el.src = url; if (k === 'img') { el.className = 'comm-img'; el.alt = m.name; } else { el.controls = true; el.className = k === 'vid' ? 'comm-vid' : ''; el.style.width = '100%'; } card.replaceWith(el); return; }
          const x = document.createElement('a'); x.href = url; x.download = m.name || 'file'; document.body.appendChild(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch (er) { UI.toast(er.message || 'تعذّر التحميل', 'error'); }
        return;
      }
      if (a === 'comments') { this.post = +ds.id; return this.go('comments'); }
      if (a === 'share' || a === 'copy') { const p = this.findPost(+ds.id); if (!p) return; if (a === 'share') return Control.share(this.postText(p)); try { await navigator.clipboard.writeText(this.postText(p)); UI.toast('تم النسخ', 'success'); } catch (_) { UI.toast('تعذّر النسخ', 'error'); } return; }
      if (a === 'react') { Control.react(ds.raw, ds.k).then(() => { const el = this.sheet && this.sheet.querySelector(`[data-a="react"][data-id="${ds.raw}"]`); if (el) el.closest('.ctl-rx').outerHTML = Control.rxBar({ id: ds.raw }); }); return; }
      if (a === 'del') { if (!(await UI.confirm('حذف منشورك؟', { okText: 'حذف' }))) return; await this.call('/v1/posts/' + ds.id, { method: 'DELETE' }); this.go('feed'); return this.load(); }
      if (a === 'report') { if (!(await UI.confirm('الإبلاغ عن هذا المنشور للمالك؟', { okText: 'إبلاغ', danger: false }))) return; const r = await this.call('/v1/report', { method: 'POST', body: { post: +ds.id } }); return UI.toast(r && r.ok ? 'وصل بلاغك' : 'تعذّر الإرسال', r && r.ok ? 'success' : 'error'); }
      if (a === 'copyaid') { try { await navigator.clipboard.writeText(Control.st.aid); UI.toast('تم النسخ', 'success'); } catch (_) { UI.toast('تعذّر النسخ', 'error'); } return; }
      if (a === 'subreq') return Control.subRequest({ addon: ds.a || '' });
      if (a === 'syncq') { await Control.syncCodes(); return this.render(); }
      if (a === 'entercode') {
        const v = await UI.dialog({ title: '🔑 تفعيل رمز اشتراك', okText: 'تفعيل', fields: [{ id: 'code', label: 'الرمز الذي أرسله المالك', type: 'textarea', rows: 3, mono: true, required: true }] }); if (!v) return;
        const p = this.plan(v.code.trim()), id = p && p.a; if (!id) return UI.toast('رمز غير صالح', 'error'); const r = await Control.verifyCode(v.code, id);
        if (!r.ok) return UI.toast(r.why, 'error'); Control.st.subs[id] = v.code.trim(); await Control.saveSt(); Control.badge(); UI.toast('✅ تم التفعيل', 'success'); return this.render();
      }
      if (a === 'subs') { UI.toast('طلبات الاشتراك في الإدارة ← المنصة ← الاشتراكات', 'info', 5000); return; }
      if (a === 'delacc') {
        if (!(await UI.confirm('حذف حسابك نهائياً مع كل منشوراتك وملفاتك وبياناتك على الخادم؟ لا يمكن التراجع.', { okText: 'متابعة', danger: true }))) return;
        const v = await UI.dialog({ title: '🗑 تأكيد حذف الحساب', okText: 'احذف حسابي نهائياً', danger: true, fields: [{ id: 'p', label: 'أدخل كلمة المرور للتأكيد', type: 'password', required: true, autocomplete: 'current-password' }] }); if (!v) return;
        const r = await this.call('/v1/me/delete', { method: 'POST', body: { password: v.p } }); if (!r || !r.ok) return UI.toast(r && r.error ? r.error : 'تعذّر الحذف: لا اتصال بالخادم', 'error');
        this.edit = null; await this.act('logout', {}); UI.toast('تم حذف حسابك وبياناتك نهائياً', 'success', 5000); return this.go('me');
      }
      if (a === 'mod') {
        const base = this.api(), key = this.owner, op = ds.op, id = ds.id; if (!base || !key) return;
        const ask = { ban: ['حظر هذا الحساب؟', 'حظر'], hide: ['إخفاء هذا المنشور؟', 'إخفاء'], delpost: ['حذف هذا المنشور نهائياً مع ملفاته وتعليقاته؟', 'حذف'], deluser: ['حذف هذا الحساب نهائياً مع كل منشوراته وملفاته؟ لا يمكن التراجع.', 'حذف الحساب'] }[op];
        if (ask && !(await UI.confirm(ask[0], { okText: ask[1], danger: true }))) return;
        const path = { pin: '/v1/admin/pin/', hide: '/v1/admin/hide/', delpost: '/v1/admin/delpost/', deluser: '/v1/admin/deluser/' }[op] || '/v1/admin/ban/', off = op === 'unban' || (op === 'pin' && (this.findPost(+id) || {}).pin);
        const r = await Control.call(path + id, { method: 'POST', base, key, body: { off: !!off } }); UI.toast(r && r.ok ? 'تم' : 'تعذّر التنفيذ', r && r.ok ? 'success' : 'error');
        if (this.view === 'owner') return this.render(); return this.load();
      }
    },
  };
  window.Community = Community;
})();
