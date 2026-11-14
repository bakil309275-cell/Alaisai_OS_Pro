/* منصة العيسائي: شبكة تواصل لمستخدمي العيسائي برو داخل التطبيق (تُحمَّل عند الضغط على 💬 فقط).
 * نافذة سفلية تُسحب لتكبر، وفي أسفلها تبويبات: الموجز، القناة، اشتراكي، حسابي، والمالك (للمالك فقط).
 * البيانات على «الخادم السحابي الخاص» (Cloudflare Worker). وبدونه تعرض إعلانات القناة للقراءة فقط.
 * لا يُحقن أي نص قادم من الشبكة كـ HTML: كل شيء يمرّ عبر UI.esc، والروابط https فقط. */
(function () {
  const E = UI.esc, K = 'comm', MAXW = 960;
  const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? 'الآن' : s < 3600 ? Math.round(s / 60) + ' د' : s < 86400 ? Math.round(s / 3600) + ' س' : Math.round(s / 86400) + ' يوم'; };
  const okUrl = (u) => /^https:\/\/[^\s"'<>]{4,300}$/.test(u || '');
  const day = (t) => new Date(t).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
  const TABS = [['feed', '🏠', 'الموجز'], ['chan', '📣', 'القناة'], ['mine', '🔑', 'اشتراكي'], ['me', '👤', 'حسابي']];
  const Community = {
    st: { token: '', user: null }, sheet: null, feed: [], draft: { text: '', link: '', media: [] }, view: 'feed', post: null, conn: 'load', filter: 'all', owner: null, ready: null,
    init() { return this.ready || (this.ready = Store.get(K).then((s) => { if (s && typeof s === 'object') this.st = Object.assign(this.st, s); }).catch(() => {})); },
    save() { return Store.set(K, this.st).catch(() => {}); },
    api() { return Control.api(); },
    channels() { return ((Control.ch && Control.ch.channels) || []).filter((x) => x && x.name && okUrl(x.url)).slice(0, 6); },
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
    async open() {
      if (this.sheet) { this.close(); return; }
      await this.init(); this.owner = await Control.ownerKeyApi();
      const s = document.createElement('section'); s.className = 'comm-sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'منصة العيسائي');
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
      s.addEventListener('click', (e) => { const r = e.target.closest('[data-a="react"]'); if (r) return this.act('react', { id: String(r.dataset.id).replace(/^p/, ''), k: r.dataset.k, raw: r.dataset.id }); const b = e.target.closest('[data-c]'); if (b) this.act(b.dataset.c, b.dataset); });
      this.view = 'feed'; this.nav(); this.render(); this.load();
    },
    setH(v) { this.h = Math.max(20, Math.min(95, v)); if (this.sheet) { this.sheet.style.setProperty('--h', this.h + 'vh'); this.sheet.querySelector('.comm-grab').setAttribute('aria-valuenow', Math.round(this.h)); } },
    close() { if (this.sheet) this.sheet.remove(); this.sheet = null; },
    go(v) { this.view = v; this.nav(); this.render(); const b = document.getElementById('comm-body'); if (b) b.scrollTop = 0; },
    nav() {
      const n = document.getElementById('comm-nav'); if (!n) return; const main = { compose: 'feed', comments: 'feed' }[this.view] || this.view;
      const tabs = TABS.concat(this.owner ? [['owner', '🛡', 'المالك']] : []);
      n.innerHTML = tabs.map(([k, i, l]) => `<button type="button" class="comm-tab" data-c="go" data-v="${k}" aria-current="${k === main}">${i}<span>${l}</span></button>`).join('');
      const c = document.getElementById('comm-chip'); if (c) { const m = { ok: ['🟢 متصل', 'ok'], err: ['🔴 غير متصل', 'err'], off: ['⚪ غير مفعّلة', 'off'], load: ['⏳ جارٍ الاتصال', 'off'] }[this.conn]; c.textContent = m[0]; c.dataset.s = m[1]; }
    },
    // ---------- البيانات ----------
    async load(more) {
      if (!this.api()) { this.conn = 'off'; this.feed = []; this.nav(); return this.render(); }
      if (!more) { this.conn = 'load'; this.nav(); }
      const r = await this.call('/v1/posts' + (more && this.feed.length ? '?before=' + this.feed[this.feed.length - 1].id : ''));
      if (!r || !r.posts) { this.conn = 'err'; this.nav(); return this.render(); }
      this.conn = 'ok'; this.feed = more ? this.feed.concat(r.posts) : r.posts; this.more = r.posts.length >= 20; this.nav(); this.render();
      Control.loadCounts(this.feed.map((p) => 'p' + p.id)).then((ok) => { if (ok && this.sheet && this.view === 'feed') this.render(); });
    },
    // ---------- مكوّنات العرض ----------
    media(m) {
      if (m.t === 'img') return `<img class="comm-img" loading="lazy" decoding="async" alt="صورة المنشور" src="${E(m.d)}">`;
      if (!okUrl(m.u)) return '';
      return /\.(mp4|webm|ogg)(\?|$)/i.test(m.u) ? `<video class="comm-vid" controls preload="none" playsinline src="${E(m.u)}"></video>` : `<a class="btn btn-sm" href="${E(m.u)}" target="_blank" rel="noopener noreferrer">▶ فتح الفيديو</a>`;
    },
    card(p, full) {
      const me = this.st.user, ini = (p.author.name || '؟').trim().slice(0, 1);
      return `<article class="ctl-card comm-post${p.official ? ' official' : ''}"><header class="comm-ph"><span class="comm-av" aria-hidden="true">${p.official ? '⭐' : E(ini)}</span><span class="grow"><strong>${E(p.author.name)}</strong>${p.official ? ' <span class="badge">رسمي</span>' : ''}${p.pin ? ' <span class="badge">📌 مثبّت</span>' : ''}<small>${ago(p.ts)}</small></span></header>`
        + (p.text ? `<p class="comm-tx">${E(p.text)}</p>` : '') + (p.media || []).map((m) => this.media(m)).join('') + (okUrl(p.link) ? `<p><a href="${E(p.link)}" target="_blank" rel="noopener noreferrer">${E(p.link)}</a></p>` : '')
        + Control.rxBar({ id: 'p' + p.id }) + `<footer>${full ? '' : `<button class="btn btn-sm" data-c="comments" data-id="${p.id}">💬 ${p.comments || 0}</button>`}<button class="btn btn-sm" data-c="share" data-id="${p.id}">📤 مشاركة</button><button class="btn btn-sm" data-c="copy" data-id="${p.id}">📋 نسخ</button>`
        + (me && p.mine ? `<button class="btn btn-sm" data-c="del" data-id="${p.id}">🗑 حذف</button>` : '') + (me && !p.mine && !p.official ? `<button class="btn btn-sm" data-c="report" data-id="${p.id}">🚩 بلاغ</button>` : '')
        + (this.owner ? `<button class="btn btn-sm" data-c="mod" data-op="pin" data-id="${p.id}">${p.pin ? '📍 إلغاء التثبيت' : '📌 تثبيت'}</button><button class="btn btn-sm" data-c="mod" data-op="hide" data-id="${p.id}">🙈 إخفاء</button>${p.author.id ? `<button class="btn btn-sm btn-danger" data-c="mod" data-op="ban" data-id="${p.author.id}">🚫 حظر</button>` : ''}` : '') + '</footer></article>';
    },
    skel() { return '<div class="comm-sk" aria-hidden="true"></div><div class="comm-sk"></div><div class="comm-sk"></div>'; },
    empty(ico, t, d, btn) { return `<div class="comm-empty"><div class="ico" aria-hidden="true">${ico}</div><strong>${E(t)}</strong><p class="muted">${E(d)}</p>${btn || ''}</div>`; },
    render() {
      const b = document.getElementById('comm-body'); if (!b) return;
      const f = { feed: this.feedView, compose: this.composeView, comments: this.commentsView, chan: this.chanView, mine: this.mineView, me: this.meView, owner: this.ownerView }[this.view];
      f.call(this, b);
    },
    feedView(b) {
      const me = this.st.user; let h = '';
      h += `<div class="comm-teaser"><span class="comm-av" aria-hidden="true">${me ? E(me.name.slice(0, 1)) : '👤'}</span><button class="comm-say" type="button" data-c="compose">${me ? 'بماذا تفكر يا ' + E(me.name) + '؟' : 'سجّل دخولك لتنشر وتعلّق'}</button></div>`;
      h += '<div class="comm-filters" role="group" aria-label="تصفية">' + [['all', 'الكل'], ['official', '⭐ الرسمي'], ['img', '🖼 بالصور']].map(([k, l]) => `<button type="button" class="chip${this.filter === k ? ' on' : ''}" data-c="filter" data-k="${k}" aria-pressed="${this.filter === k}">${l}</button>`).join('') + '</div>';
      if (this.conn === 'off') {
        h += this.empty('🌐', 'المنصة التفاعلية غير مفعّلة بعد', 'لم يربط المالك الخادم السحابي. تجد إعلانات المالك في تبويب «القناة».', '<button class="btn btn-primary" data-c="go" data-v="chan">📣 فتح القناة</button>');
      } else if (this.conn === 'err') {
        h += this.empty('📡', 'تعذّر الاتصال بالخادم', 'تحقق من الشبكة ثم أعد المحاولة. إن استمر فالخادم غير منشور أو الرابط غير صحيح.', '<button class="btn btn-primary" data-c="reload">🔄 إعادة المحاولة</button> <button class="btn" data-c="go" data-v="chan">📣 القناة</button>');
      } else if (this.conn === 'load' && !this.feed.length) h += this.skel();
      else {
        const list = this.feed.filter((p) => this.filter === 'all' || (this.filter === 'official' ? p.official : (p.media || []).some((m) => m.t === 'img')));
        h += list.length ? list.map((p) => this.card(p)).join('') + (this.more && this.filter === 'all' ? '<div class="comm-bar"><button class="btn" data-c="more">عرض المزيد</button></div>' : '') : this.empty('📝', 'لا منشورات هنا بعد', 'كن أول من ينشر في منصة العيسائي.', '<button class="btn btn-primary" data-c="compose">✏️ منشور جديد</button>');
      }
      b.innerHTML = h;
    },
    composeView(b) {
      if (!this.st.user) return this.go('me');
      const d = this.draft, ch = this.channels();
      b.innerHTML = `<form class="comm-form" data-f="post"><h3>✏️ منشور جديد</h3><textarea class="field" name="text" rows="5" maxlength="3000" placeholder="اكتب منشورك…" aria-label="نص المنشور">${E(d.text)}</textarea>
        <label class="lbl" for="cm-link">رابط (اختياري)</label><input id="cm-link" class="field" name="link" dir="ltr" maxlength="300" value="${E(d.link)}" placeholder="https://">
        <div class="comm-bar"><label class="btn btn-sm">🖼 إضافة صورة<input type="file" accept="image/*" name="img" hidden></label><button type="button" class="btn btn-sm" data-c="addvid">🎬 رابط فيديو</button></div>
        <div class="comm-thumbs">${d.media.map((m, i) => `<span class="comm-th">${m.t === 'img' ? `<img alt="" src="${E(m.d)}">` : '🎬 ' + E(m.u.slice(8, 40))}<button type="button" class="btn btn-sm" data-c="rmmedia" data-i="${i}" aria-label="حذف المرفق">✕</button></span>`).join('')}</div>
        <fieldset class="comm-dest"><legend>أين يُنشر؟</legend><label><input type="checkbox" name="d_plat" checked> منصة العيسائي برو</label>${ch.map((c, i) => `<label><input type="checkbox" name="d_${i}"> ${E(c.name)} <small>(يُنسخ النص ويُفتح الرابط)</small></label>`).join('')}<label><input type="checkbox" name="d_share"> مشاركة (فيسبوك، واتساب، إلخ)</label></fieldset>
        <div class="comm-bar"><button class="btn btn-primary" type="submit">🚀 نشر</button><button type="button" class="btn" data-c="go" data-v="feed">إلغاء</button></div></form>`;
      const f = b.querySelector('form'), keep = () => { d.text = f.elements.text.value; d.link = f.elements.link.value; };
      f.elements.img.onchange = async () => { keep(); const fl = f.elements.img.files[0]; if (!fl) return; if (d.media.length >= 3) return UI.toast('الحد 3 مرفقات', 'warn'); try { d.media.push({ t: 'img', d: await this.compress(fl) }); } catch (_) { UI.toast('تعذّرت معالجة الصورة', 'error'); } this.render(); };
      f.onsubmit = async (e) => {
        e.preventDefault(); keep(); const t = d.text.trim(), l = d.link.trim(), x = f.elements; if (!t && !d.media.length) return UI.toast('اكتب نصاً أو أضف صورة', 'warn'); if (l && !okUrl(l)) return UI.toast('الرابط يبدأ بـ https://', 'warn');
        if (x.d_plat.checked) { const r = await this.call('/v1/posts', { method: 'POST', body: { text: t, link: l, media: d.media } }); if (!r || !r.ok) return UI.toast(r && r.error ? (r.error === 'rate' ? 'تجاوزت حد النشر، حاول لاحقاً' : r.error) : 'تعذّر النشر: لا اتصال بالخادم', 'error'); }
        const txt = t + (l ? '\n' + l : '') + d.media.filter((m) => m.t === 'vid').map((m) => '\n' + m.u).join('');
        ch.forEach((c, i) => { if (x['d_' + i].checked) { try { navigator.clipboard.writeText(txt); } catch (_) { /* لا شيء */ } window.open(c.url, '_blank', 'noopener'); } });
        if (x.d_share.checked) await Control.share(txt);
        this.draft = { text: '', link: '', media: [] }; UI.toast('تم النشر', 'success'); this.go('feed'); this.load();
      };
    },
    async commentsView(b) {
      const p = this.feed.find((x) => x.id === this.post); if (!p) return this.go('feed');
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
      if (me) { b.innerHTML = `<div class="ctl-card comm-me"><span class="comm-av big" aria-hidden="true">${E(me.name.slice(0, 1))}</span><strong>${E(me.name)}</strong><p class="muted sm">حسابك في منصة العيسائي</p><div class="comm-bar"><button class="btn btn-primary" data-c="compose">✏️ منشور جديد</button><button class="btn" data-c="logout">خروج</button></div></div>`; return; }
      b.innerHTML = `<form class="comm-form" data-f="auth"><h3>${this.reg ? '📝 إنشاء حساب' : '👤 تسجيل الدخول'}</h3>${this.api() ? '' : '<p class="muted">المنصة غير مفعّلة بعد، لذا لا يمكن إنشاء حساب الآن.</p>'}${this.reg ? '<label class="lbl" for="au-n">الاسم الظاهر</label><input id="au-n" class="field" name="name" maxlength="40" autocomplete="name">' : ''}<label class="lbl" for="au-i">بريد أو هاتف أو اسم مستخدم</label><input id="au-i" class="field" name="ident" maxlength="60" dir="ltr" autocomplete="username"><label class="lbl" for="au-p">كلمة المرور (8 أحرف فأكثر)</label><input id="au-p" class="field" name="password" type="password" maxlength="100" dir="ltr" autocomplete="${this.reg ? 'new-password' : 'current-password'}"><div class="comm-bar"><button class="btn btn-primary" type="submit">${this.reg ? 'إنشاء الحساب' : 'دخول'}</button><button type="button" class="btn" data-c="regtoggle">${this.reg ? 'لدي حساب' : 'حساب جديد'}</button></div></form>`;
      b.querySelector('form').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target.elements, r = await this.call(this.reg ? '/v1/auth/register' : '/v1/auth/login', { method: 'POST', body: { name: f.name ? f.name.value : '', ident: f.ident.value, password: f.password.value, did: Control.st.did } });
        if (!r || !r.token) return UI.toast(r && r.error ? r.error : 'تعذّر الاتصال بالخادم', 'error');
        this.st.token = r.token; this.st.user = r.user; await this.save(); UI.toast('أهلاً ' + r.user.name, 'success'); this.go('feed');
      };
    },
    async ownerView(b) {
      if (!this.owner) return this.go('feed');
      b.innerHTML = '<p class="muted">جارٍ التحميل…</p>'; const key = this.owner, base = this.api();
      const [st, us] = await Promise.all([Control.call('/v1/admin/stats', { base, key }), Control.call('/v1/admin/users', { base, key })]);
      if (!this.sheet || this.view !== 'owner') return;
      b.innerHTML = `<div class="ctl-card"><strong>🛡 أدوات المالك</strong><p class="muted sm">ظاهرة لك فقط لأن مفتاح المالك محفوظ مشفّراً على هذا الجهاز.</p>${st ? `<p>👥 ${st.users || 0} مستخدم • 🟢 ${st.online || 0} متصل</p>` : '<p class="muted">تعذّر جلب الإحصاءات.</p>'}</div>`
        + `<form class="comm-form" data-f="official"><h3>⭐ منشور رسمي</h3><textarea class="field" name="text" rows="3" maxlength="3000" placeholder="يظهر باسم العيسائي برو" aria-label="نص المنشور الرسمي"></textarea><label><input type="checkbox" name="pin"> تثبيت في الأعلى</label><div class="comm-bar"><button class="btn btn-primary" type="submit">نشر رسمي</button><button type="button" class="btn" data-c="subs">📨 طلبات الاشتراك</button></div></form>`
        + '<h4>الحسابات</h4>' + (us && us.users.length ? us.users.slice(0, 40).map((u) => `<div class="admin-row"><span class="grow">${E(u.name)} <small dir="ltr">${E(u.ident)}</small> ${u.banned ? '<span class="badge">محظور</span>' : ''}</span><button class="btn btn-sm" data-c="mod" data-op="${u.banned ? 'unban' : 'ban'}" data-id="${u.id}">${u.banned ? 'رفع الحظر' : '🚫 حظر'}</button></div>`).join('') : '<p class="muted">لا حسابات.</p>')
        + (us && us.reports.length ? '<h4>منشورات عليها بلاغات</h4>' + us.reports.map((r) => `<div class="admin-row"><span class="grow">منشور #${r.post} — ${r.n} بلاغ</span><button class="btn btn-sm" data-c="mod" data-op="hide" data-id="${r.post}">🙈 إخفاء</button></div>`).join('') : '');
      const f = b.querySelector('form'); f.onsubmit = async (e) => { e.preventDefault(); const t = f.elements.text.value.trim(); if (!t) return; const r = await Control.call('/v1/admin/post', { method: 'POST', base, key, body: { text: t, pin: f.elements.pin.checked } }); if (!r || !r.ok) return UI.toast('تعذّر النشر', 'error'); UI.toast('تم النشر الرسمي', 'success'); this.go('feed'); this.load(); };
    },
    async compress(file) {
      const bm = await createImageBitmap(file), k = Math.min(1, MAXW / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      for (const q of [0.78, 0.6, 0.45, 0.3]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 240000) return d; } throw new Error('big');
    },
    keepDraft() { const f = this.sheet && this.sheet.querySelector('form[data-f=post]'); if (f) { this.draft.text = f.elements.text.value; this.draft.link = f.elements.link.value; } },
    postText(p) { return p.author.name + ': ' + p.text + (p.link ? '\n' + p.link : ''); },
    async act(a, ds) {
      if (a === 'addvid' || a === 'rmmedia') this.keepDraft();
      if (a === 'close') return this.close();
      if (a === 'reload') { this.go('feed'); return this.load(); }
      if (a === 'go') return this.go(ds.v);
      if (a === 'more') return this.load(true);
      if (a === 'filter') { this.filter = ds.k; return this.render(); }
      if (a === 'regtoggle') { this.reg = !this.reg; return this.render(); }
      if (a === 'logout') { this.st = { token: '', user: null }; await this.save(); return this.render(); }
      if (a === 'contact') return Control.contact({ kind: 'inq' });
      if (a === 'shareapp') return Control.share('العيسائي برو — نظام تشغيل مصغّر بالعربية\n' + location.origin + location.pathname);
      if (a === 'shareitem') { const i = Control.visible().find((x) => x.id === ds.id); if (i) Control.share(i.title + (i.body ? '\n\n' + i.body : '') + (i.link ? '\n' + i.link : '')); return; }
      if (a === 'compose') return this.st.user ? this.go('compose') : (UI.toast('سجّل دخولك أولاً', 'warn'), this.go('me'));
      if (a === 'addvid') { const v = await UI.prompt('رابط الفيديو', { label: 'رابط https لفيديو (يوتيوب أو ملف mp4)', placeholder: 'https://' }); if (v && okUrl(v.trim())) this.draft.media.push({ t: 'vid', u: v.trim() }); else if (v) UI.toast('الرابط يبدأ بـ https://', 'warn'); return this.render(); }
      if (a === 'rmmedia') { this.draft.media.splice(+ds.i, 1); return this.render(); }
      if (a === 'comments') { this.post = +ds.id; return this.go('comments'); }
      if (a === 'share' || a === 'copy') { const p = this.feed.find((x) => x.id === +ds.id); if (!p) return; if (a === 'share') return Control.share(this.postText(p)); try { await navigator.clipboard.writeText(this.postText(p)); UI.toast('تم النسخ', 'success'); } catch (_) { UI.toast('تعذّر النسخ', 'error'); } return; }
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
      if (a === 'mod') {
        const base = this.api(), key = this.owner, op = ds.op, id = ds.id; if (!base || !key) return;
        if ((op === 'hide' || op === 'ban') && !(await UI.confirm(op === 'ban' ? 'حظر هذا الحساب؟' : 'إخفاء هذا المنشور؟', { okText: op === 'ban' ? 'حظر' : 'إخفاء' }))) return;
        const path = op === 'pin' ? '/v1/admin/pin/' : op === 'hide' ? '/v1/admin/hide/' : '/v1/admin/ban/', off = op === 'unban' || (op === 'pin' && (this.feed.find((x) => x.id === +id) || {}).pin);
        const r = await Control.call(path + id, { method: 'POST', base, key, body: { off: !!off } }); UI.toast(r && r.ok ? 'تم' : 'تعذّر التنفيذ', r && r.ok ? 'success' : 'error');
        if (this.view === 'owner') return this.render(); return this.load();
      }
    },
  };
  window.Community = Community;
})();
