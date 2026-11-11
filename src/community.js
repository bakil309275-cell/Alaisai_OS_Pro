/* منصة العيسائي: شبكة تواصل لمستخدمي العيسائي برو داخل التطبيق.
 * تُفتح من زر 💬 في الشريط العلوي كنافذة سفلية تُسحب لتكبر فوق التطبيقات.
 * المنشورات والحسابات على «الخادم السحابي الخاص» (Cloudflare Worker) إن ضبطه المالك؛ وبدونه تعرض إعلانات القناة للقراءة فقط.
 * لا يُحقن أي نص قادم من الشبكة كـ HTML: كل شيء يمرّ عبر UI.esc، والروابط https فقط. */
(function () {
  const E = UI.esc, K = 'comm', MAXW = 960;
  const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? 'الآن' : s < 3600 ? Math.round(s / 60) + ' د' : s < 86400 ? Math.round(s / 3600) + ' س' : Math.round(s / 86400) + ' يوم'; };
  const okUrl = (u) => /^https:\/\/[^\s"'<>]{4,300}$/.test(u || '');
  const Community = {
    st: { token: '', user: null }, sheet: null, feed: [], draft: { text: '', link: '', media: [] }, view: 'feed', post: null,
    async init() { try { const s = await Store.get(K); if (s && typeof s === 'object') this.st = Object.assign(this.st, s); } catch (_) { /* لا شيء */ } },
    save() { return Store.set(K, this.st).catch(() => {}); },
    api() { return window.Control ? Control.api() : ''; },
    channels() { const c = (Control.ch && Control.ch.channels) || []; return c.filter((x) => x && x.name && okUrl(x.url)).slice(0, 6); },
    async call(path, o = {}) {
      const base = this.api(); if (!base) return null;
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
      try {
        const r = await fetch(base + path, { method: o.method || 'GET', signal: ac.signal, cache: 'no-store', headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, this.st.token ? { Authorization: 'Bearer ' + this.st.token } : {}), body: o.body ? JSON.stringify(o.body) : undefined });
        const j = await r.json().catch(() => ({})); if (r.status === 401 && this.st.token && j.error !== 'بيانات الدخول غير صحيحة') { this.st.token = ''; this.st.user = null; this.save(); }
        return Object.assign({ _s: r.status }, j);
      } catch (_) { return null; } finally { clearTimeout(t); }
    },
    // ---------- النافذة السفلية القابلة للسحب ----------
    open() {
      if (this.sheet) return this.sheet.remove(), (this.sheet = null);
      const s = document.createElement('section'); s.className = 'comm-sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'منصة العيسائي');
      s.innerHTML = '<div class="comm-grab" tabindex="0" role="slider" aria-label="حجم النافذة (اسحب أو استخدم الأسهم)" aria-valuemin="30" aria-valuemax="95"><i></i></div><header class="comm-head"><strong>💬 منصة العيسائي</strong><span class="grow"></span><button class="btn btn-sm" data-c="reload" aria-label="تحديث">🔄</button><button class="btn btn-sm" data-c="close" aria-label="إغلاق">✕</button></header><div class="comm-body" id="comm-body"></div>';
      document.body.appendChild(s); this.sheet = s; this.setH(58);
      const g = s.querySelector('.comm-grab'); let y0 = 0, h0 = 0, drag = false;
      g.addEventListener('pointerdown', (e) => { drag = true; y0 = e.clientY; h0 = this.h; g.setPointerCapture(e.pointerId); });
      g.addEventListener('pointermove', (e) => { if (drag) this.setH(h0 + (y0 - e.clientY) / innerHeight * 100); });
      g.addEventListener('pointerup', () => { drag = false; if (this.h < 24) this.close(); else this.setH(this.h < 44 ? 36 : this.h < 78 ? 58 : 95); });
      g.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') this.setH(this.h + 10); if (e.key === 'ArrowDown') this.setH(this.h - 10); });
      s.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
      s.addEventListener('click', (e) => { const r = e.target.closest('[data-a="react"]'); if (r) return this.act('react', { id: String(r.dataset.id).replace(/^p/, ''), k: r.dataset.k }); const b = e.target.closest('[data-c]'); if (b) this.act(b.dataset.c, b.dataset); });
      this.view = 'feed'; this.render(); this.load();
    },
    setH(v) { this.h = Math.max(20, Math.min(95, v)); if (this.sheet) { this.sheet.style.setProperty('--h', this.h + 'vh'); this.sheet.querySelector('.comm-grab').setAttribute('aria-valuenow', Math.round(this.h)); } },
    close() { if (this.sheet) this.sheet.remove(); this.sheet = null; },
    // ---------- البيانات ----------
    async load(more) {
      const body = more && this.feed.length ? '?before=' + this.feed[this.feed.length - 1].id : '';
      if (!this.api()) { this.feed = null; return this.render(); }
      const r = await this.call('/v1/posts' + body); if (!r || !r.posts) { if (!more) this.err = true; return this.render(); }
      this.err = false; this.feed = more ? this.feed.concat(r.posts) : r.posts; this.more = r.posts.length >= 20; this.render();
      Control.loadCounts(this.feed.map((p) => 'p' + p.id)).then((ok) => { if (ok && this.sheet) this.render(); });
    },
    // ---------- العرض ----------
    media(m) {
      if (m.t === 'img') return `<img class="comm-img" loading="lazy" alt="صورة المنشور" src="${E(m.d)}">`;
      if (!okUrl(m.u)) return '';
      return /\.(mp4|webm|ogg)(\?|$)/i.test(m.u) ? `<video class="comm-vid" controls preload="none" playsinline src="${E(m.u)}"></video>` : `<a class="btn btn-sm" href="${E(m.u)}" target="_blank" rel="noopener noreferrer">▶ فتح الفيديو</a>`;
    },
    card(p) {
      const me = this.st.user, fake = { id: 'p' + p.id };
      return `<article class="ctl-card comm-post${p.official ? ' official' : ''}"><header><strong>${E(p.author.name)}</strong>${p.official ? ' <span class="badge">رسمي</span>' : ''}${p.pin ? ' <span class="badge">📌 مثبّت</span>' : ''}<small>${ago(p.ts)}</small></header>`
        + (p.text ? `<p>${E(p.text)}</p>` : '') + (p.media || []).map((m) => this.media(m)).join('') + (okUrl(p.link) ? `<p><a href="${E(p.link)}" target="_blank" rel="noopener noreferrer">${E(p.link)}</a></p>` : '')
        + Control.rxBar(fake) + `<footer><button class="btn btn-sm" data-c="comments" data-id="${p.id}">💬 ${p.comments || 0}</button><button class="btn btn-sm" data-c="share" data-id="${p.id}">📤 مشاركة</button>`
        + (me && p.mine ? `<button class="btn btn-sm" data-c="del" data-id="${p.id}">🗑 حذف</button>` : '') + (me && !p.mine && !p.official ? `<button class="btn btn-sm" data-c="report" data-id="${p.id}">🚩 بلاغ</button>` : '') + '</footer></article>';
    },
    render() {
      const b = document.getElementById('comm-body'); if (!b) return; const me = this.st.user, ch = this.channels();
      if (this.view === 'auth') return this.authView(b);
      if (this.view === 'compose') return this.composeView(b);
      if (this.view === 'comments') return this.commentsView(b);
      let h = '<div class="comm-bar">' + (me ? `<button class="btn btn-primary" data-c="compose">✏️ منشور جديد</button><span class="muted sm">${E(me.name)}</span><button class="btn btn-sm" data-c="logout">خروج</button>` : '<button class="btn btn-primary" data-c="auth">👤 دخول / إنشاء حساب</button>') + '<button class="btn btn-sm" data-c="contact">📩 المالك</button></div>';
      if (this.feed === null) {
        const it = Control.visible().slice(0, 20);
        h += '<p class="muted">المنصة التفاعلية لم تُفعَّل بعد من المالك. هذه إعلانات ومنشورات المالك للقراءة فقط.</p>' + (it.length ? it.map((i) => `<article class="ctl-card"><header><strong>${E(i.title)}</strong></header>${i.body ? `<p>${E(i.body)}</p>` : ''}</article>`).join('') : '<p class="muted">لا يوجد شيء بعد.</p>');
      } else if (this.err) h += '<p class="muted">تعذّر الاتصال بالخادم. تحقق من الشبكة ثم اضغط 🔄.</p>';
      else if (this.feed.length) h += this.feed.map((p) => this.card(p)).join('') + (this.more ? '<div class="comm-bar"><button class="btn" data-c="more">عرض المزيد</button></div>' : '');
      else h += '<p class="muted">لا منشورات بعد. كن أول من ينشر.</p>';
      b.innerHTML = h;
    },
    authView(b) {
      b.innerHTML = `<form class="comm-form" data-f="auth"><h3>${this.reg ? 'إنشاء حساب' : 'تسجيل الدخول'}</h3>${this.reg ? '<label class="lbl">الاسم الظاهر</label><input class="field" name="name" maxlength="40" autocomplete="name">' : ''}<label class="lbl">البريد أو رقم الهاتف أو اسم مستخدم</label><input class="field" name="ident" maxlength="60" dir="ltr" autocomplete="username"><label class="lbl">كلمة المرور (8 أحرف فأكثر)</label><input class="field" name="password" type="password" maxlength="100" dir="ltr" autocomplete="${this.reg ? 'new-password' : 'current-password'}"><div class="comm-bar"><button class="btn btn-primary" type="submit">${this.reg ? 'إنشاء الحساب' : 'دخول'}</button><button type="button" class="btn" data-c="regtoggle">${this.reg ? 'لدي حساب' : 'حساب جديد'}</button><button type="button" class="btn" data-c="back">رجوع</button></div></form>`;
      b.querySelector('form').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target.elements, r = await this.call(this.reg ? '/v1/auth/register' : '/v1/auth/login', { method: 'POST', body: { name: f.name ? f.name.value : '', ident: f.ident.value, password: f.password.value, did: Control.st.did } });
        if (!r || !r.token) return UI.toast(r && r.error ? r.error : 'تعذّر الاتصال', 'error');
        this.st.token = r.token; this.st.user = r.user; await this.save(); UI.toast('أهلاً ' + r.user.name, 'success'); this.view = 'feed'; this.render();
      };
    },
    composeView(b) {
      const d = this.draft, ch = this.channels();
      b.innerHTML = `<form class="comm-form" data-f="post"><h3>منشور جديد</h3><textarea class="field" name="text" rows="5" maxlength="3000" placeholder="اكتب منشورك…">${E(d.text)}</textarea>
        <label class="lbl">رابط (اختياري)</label><input class="field" name="link" dir="ltr" maxlength="300" value="${E(d.link)}" placeholder="https://">
        <div class="comm-bar"><label class="btn btn-sm">🖼 إضافة صورة<input type="file" accept="image/*" name="img" hidden></label><button type="button" class="btn btn-sm" data-c="addvid">🎬 رابط فيديو</button></div>
        <div class="comm-thumbs">${d.media.map((m, i) => `<span class="comm-th">${m.t === 'img' ? `<img alt="" src="${E(m.d)}">` : '🎬 ' + E(m.u.slice(8, 40))}<button type="button" class="btn btn-sm" data-c="rmmedia" data-i="${i}" aria-label="حذف">✕</button></span>`).join('')}</div>
        <fieldset class="comm-dest"><legend>أين يُنشر؟</legend><label><input type="checkbox" name="d_plat" checked> منصة العيسائي برو</label>${ch.map((c, i) => `<label><input type="checkbox" name="d_${i}"> ${E(c.name)} (يفتح ويُنسخ النص)</label>`).join('')}<label><input type="checkbox" name="d_share"> مشاركة (فيسبوك، واتساب، إلخ)</label></fieldset>
        <div class="comm-bar"><button class="btn btn-primary" type="submit">نشر</button><button type="button" class="btn" data-c="back">رجوع</button></div></form>`;
      const f = b.querySelector('form');
      const keep = () => { d.text = f.elements.text.value; d.link = f.elements.link.value; };
      f.elements.img.onchange = async () => { keep(); const fl = f.elements.img.files[0]; if (!fl) return; if (d.media.length >= 3) return UI.toast('الحد 3 مرفقات', 'warn'); try { d.media.push({ t: 'img', d: await this.compress(fl) }); } catch (_) { UI.toast('تعذّرت معالجة الصورة', 'error'); } this.render(); };
      f.onsubmit = async (e) => {
        e.preventDefault(); keep(); const t = d.text.trim(), l = d.link.trim(); if (!t && !d.media.length) return UI.toast('اكتب نصاً أو أضف صورة', 'warn'); if (l && !okUrl(l)) return UI.toast('الرابط يبدأ بـ https://', 'warn');
        const x = f.elements;
        if (x.d_plat.checked) { const r = await this.call('/v1/posts', { method: 'POST', body: { text: t, link: l, media: d.media } }); if (!r || !r.ok) return UI.toast(r && r.error ? (r.error === 'rate' ? 'تجاوزت حد النشر، حاول لاحقاً' : r.error) : 'تعذّر النشر', 'error'); }
        const txt = t + (l ? '\n' + l : '') + d.media.filter((m) => m.t === 'vid').map((m) => '\n' + m.u).join('');
        ch.forEach((c, i) => { if (x['d_' + i].checked) { try { navigator.clipboard.writeText(txt); } catch (_) { /* لا شيء */ } window.open(c.url, '_blank', 'noopener'); } });
        if (x.d_share.checked) await Control.share(txt);
        this.draft = { text: '', link: '', media: [] }; this.view = 'feed'; UI.toast('تم', 'success'); this.load();
      };
    },
    async commentsView(b) {
      const p = this.feed.find((x) => x.id === this.post); if (!p) { this.view = 'feed'; return this.render(); }
      b.innerHTML = this.card(p) + '<div id="comm-cm"><p class="muted">جارٍ التحميل…</p></div>' + (this.st.user ? '<form class="comm-form" data-f="cm"><textarea class="field" name="text" rows="2" maxlength="800" placeholder="اكتب تعليقاً"></textarea><div class="comm-bar"><button class="btn btn-primary" type="submit">إرسال</button><button type="button" class="btn" data-c="back">رجوع</button></div></form>' : '<div class="comm-bar"><button class="btn" data-c="auth">سجّل الدخول للتعليق</button><button class="btn" data-c="back">رجوع</button></div>');
      const show = async () => { const r = await this.call('/v1/posts/' + p.id + '/comments'), h = document.getElementById('comm-cm'); if (h) h.innerHTML = r && r.comments ? (r.comments.length ? r.comments.map((c) => `<div class="comm-cm"><strong>${E(c.author.name)}</strong> <small>${ago(c.ts)}</small><p>${E(c.text)}</p></div>`).join('') : '<p class="muted">لا تعليقات بعد.</p>') : '<p class="muted">تعذّر التحميل.</p>'; };
      show(); const f = b.querySelector('form');
      if (f) f.onsubmit = async (e) => { e.preventDefault(); const v = f.elements.text.value.trim(); if (!v) return; const r = await this.call('/v1/posts/' + p.id + '/comments', { method: 'POST', body: { text: v } }); if (!r || !r.ok) return UI.toast('تعذّر الإرسال', 'error'); f.elements.text.value = ''; p.comments = (p.comments || 0) + 1; show(); };
    },
    async compress(file) {
      const bm = await createImageBitmap(file), k = Math.min(1, MAXW / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      for (const q of [0.78, 0.6, 0.45, 0.3]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 240000) return d; } throw new Error('big');
    },
    keepDraft() { const f = this.sheet && this.sheet.querySelector('form[data-f=post]'); if (f) { this.draft.text = f.elements.text.value; this.draft.link = f.elements.link.value; } },
    async act(a, ds) {
      if (a === 'addvid' || a === 'rmmedia') this.keepDraft();
      if (a === 'close') return this.close();
      if (a === 'reload') { this.view = 'feed'; return this.load(); }
      if (a === 'more') return this.load(true);
      if (a === 'back') { this.view = 'feed'; return this.render(); }
      if (a === 'auth') { this.view = 'auth'; return this.render(); }
      if (a === 'regtoggle') { this.reg = !this.reg; return this.render(); }
      if (a === 'logout') { this.st = { token: '', user: null }; await this.save(); return this.render(); }
      if (a === 'contact') return Control.contact({ kind: 'inq' });
      if (a === 'compose') { if (!this.st.user) { this.view = 'auth'; return this.render(); } this.view = 'compose'; return this.render(); }
      if (a === 'addvid') { const v = await UI.prompt('رابط الفيديو', { label: 'رابط https لفيديو (يوتيوب أو ملف mp4)', placeholder: 'https://' }); if (v && okUrl(v.trim())) { this.draft.media.push({ t: 'vid', u: v.trim() }); } else if (v) UI.toast('الرابط يبدأ بـ https://', 'warn'); return this.render(); }
      if (a === 'rmmedia') { this.draft.media.splice(+ds.i, 1); return this.render(); }
      if (a === 'comments') { this.view = 'comments'; this.post = +ds.id; return this.render(); }
      if (a === 'share') { const p = this.feed.find((x) => x.id === +ds.id); if (p) Control.share(p.author.name + ': ' + p.text + (p.link ? '\n' + p.link : '')); return; }
      if (a === 'react') { Control.react('p' + ds.id, ds.k).then(() => { const p = this.feed.find((x) => x.id === +ds.id), el = this.sheet.querySelector(`[data-a="react"][data-id="p${ds.id}"]`); if (p && el) el.closest('.ctl-rx').outerHTML = Control.rxBar({ id: 'p' + p.id }); }); return; }
      if (a === 'del') { if (!(await UI.confirm('حذف منشورك؟', { okText: 'حذف' }))) return; await this.call('/v1/posts/' + ds.id, { method: 'DELETE' }); return this.load(); }
      if (a === 'report') { if (!(await UI.confirm('الإبلاغ عن هذا المنشور للمالك؟', { okText: 'إبلاغ', danger: false }))) return; const r = await this.call('/v1/report', { method: 'POST', body: { post: +ds.id } }); UI.toast(r && r.ok ? 'وصل بلاغك' : 'تعذّر الإرسال', r && r.ok ? 'success' : 'error'); }
    },
  };
  window.Community = Community;
})();
