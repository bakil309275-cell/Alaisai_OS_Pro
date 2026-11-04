/* مركز التحكم: قناة المالك ← جميع المستخدمين (بلا خادم).
 * المالك ينشر ملفاً ثابتاً control/channel.json (إعلانات، منشورات، سياسة كل إضافة، رمز اشتراك موقَّع)،
 * والتطبيق عند كل مستخدم يجلبه ويطبّقه. التخزين المحلي عند المستخدمين لا يُمسّ أبداً.
 * الأسرار (رمز GitHub، مفتاح توقيع الاشتراكات) تُحفظ مشفّرة بمفتاح الجهاز وخارج النسخ الاحتياطية. */
(function () {
  const E = UI.esc, Sec = window.Sec;
  const CH_URL = 'control/channel.json', K_CH = 'channel', K_CTRL = 'ctrl', K_DRAFT = 'chdraft', K_OWN = 'ownerkey', K_TOK = 'ctrlsec';
  const DAY = 864e5, b64u = (u8) => Sec.b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => Sec.unb64(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
  const b64uText = (s) => new TextDecoder().decode(unb64u(s)), enc = new TextEncoder(), ECDSA = { name: 'ECDSA', namedCurve: 'P-256' }, SIGN = { name: 'ECDSA', hash: 'SHA-256' };
  const LV = { info: ['ℹ️', 'إعلان'], warn: ['⚠️', 'تنبيه'], urgent: ['🚨', 'عاجل'] };
  const KIND = { ann: 'إعلان', post: 'منشور' };
  const emptyCh = () => ({ format: 'alaisai-channel', version: 1, seq: 0, updated: 0, contact: { whatsapp: '', telegram: '', email: '', facebook: '', note: '' }, pub: null, revoked: [], retain: { archiveDays: 60, deleteDays: 240 }, addons: {}, items: [] });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const fmt = (t) => (t ? new Date(t).toLocaleDateString('ar', { dateStyle: 'medium' }) : '—');
  const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

  /* منطق التنظيف: يطابق tools/prune-channel.mjs الذي يعمل أسبوعياً في GitHub Actions */
  function prune(ch, now = Date.now()) {
    const r = ch.retain || {}, ad = +r.archiveDays || 60, dd = +r.deleteDays || 240; let del = 0, arch = 0;
    ch.items = (ch.items || []).filter((i) => { const gone = (i.expires && i.expires < now) || now - (i.created || 0) > dd * DAY; if (gone) del++; return !gone; });
    ch.items.forEach((i) => { if (!i.arch && now - (i.created || 0) > ad * DAY) { i.arch = true; delete i.body; arch++; } });
    return { del, arch };
  }

  const Control = {
    ch: null, st: { seen: {}, acct: null, subs: {} }, _busy: false,

    // ---------- العميل ----------
    async init() {
      try { this.ch = await Store.get(K_CH); } catch (_) { this.ch = null; }
      try { this.st = Object.assign({ seen: {}, acct: null, subs: {} }, await Store.get(K_CTRL)); } catch (_) { /* لا شيء */ }
      this.badge();
      this.fetch(true);
      setInterval(() => { if (!document.hidden) this.fetch(); }, 600000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.fetch(); });
    },
    async saveSt() { try { await Store.set(K_CTRL, this.st); } catch (_) { /* لا شيء */ } },
    async fetch(first) {
      try {
        const r = await fetch(CH_URL + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
        const j = await r.json(); if (!j || j.format !== 'alaisai-channel' || !Array.isArray(j.items)) return;
        if (this.ch && (this.ch.seq || 0) > (j.seq || 0)) return; // لا نرجع لنسخة أقدم
        this.ch = j; await Store.set(K_CH, j); this.badge();
        if (first) this.alertUrgent();
      } catch (_) { /* دون اتصال: نبقى على آخر نسخة محفوظة */ }
    },
    installedAddons() { return (Store.db.registry || []).filter((a) => a.type === 'addon').map((a) => ({ id: a.content, name: a.name })); },
    visible() {
      const now = Date.now(), have = new Set(this.installedAddons().map((a) => a.id)), mine = new Set(Object.values(this.st.subs || {}).map((c) => { try { return JSON.parse(b64uText(String(c).split('.')[0])).i; } catch (_) { return null; } }));
      return ((this.ch && this.ch.items) || []).filter((i) => {
        if (i.expires && i.expires < now) return false;
        const a = String(i.aud || 'all');
        if (a === 'all') return true;
        if (a.indexOf('addon:') === 0) return have.has(a.slice(6));
        if (a.indexOf('sub:') === 0) return mine.has(a.slice(4));
        return false;
      }).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.created || 0) - (a.created || 0));
    },
    unread() { return this.visible().filter((i) => !this.st.seen[i.id]).length; },
    badge() {
      const b = document.getElementById('news-btn'); if (!b) return;
      const n = this.unread(), any = this.visible().length;
      b.hidden = !any; b.querySelector('[data-n]').textContent = n ? String(n) : ''; b.querySelector('[data-n]').hidden = !n;
      b.setAttribute('aria-label', 'الإعلانات والمنشورات' + (n ? ' (' + n + ' جديد)' : ''));
    },
    async alertUrgent() {
      const u = this.visible().find((i) => i.level === 'urgent' && !this.st.seen[i.id]); if (!u) return;
      this.st.seen[u.id] = 1; await this.saveSt(); this.badge();
      UI.dialog({ title: '🚨 ' + u.title, message: u.body || '', okText: 'حسناً', hideCancel: true });
    },
    open() { OS.openSystem('الإعلانات والمنشورات', (vp) => this.news(vp)); },
    news(vp) {
      const items = this.visible(), c = (this.ch && this.ch.contact) || {};
      vp.innerHTML = '<div class="sys-pad ctl"><div class="ctl-bar"><button class="btn" data-a="contact">💬 تواصل مع المالك</button></div>' +
        (items.length ? items.map((i) => `<article class="ctl-card lv-${E(i.level || 'info')}${this.st.seen[i.id] ? '' : ' new'}"><header><span>${(LV[i.level] || LV.info)[0]}</span><strong>${E(i.title)}</strong>${i.pin ? '<span class="badge">مثبّت</span>' : ''}<small>${fmt(i.created)}</small></header>` +
          (i.body ? `<p>${E(i.body)}</p>` : (i.arch ? '<p class="muted">منشور مؤرشف: بقي عنوانه فقط.</p>' : '')) +
          `<footer>${i.link ? `<a class="btn btn-sm" href="${E(i.link)}" target="_blank" rel="noopener noreferrer">فتح الرابط</a>` : ''}<button class="btn btn-sm" data-a="share" data-id="${E(i.id)}">مشاركة</button></footer></article>`).join('') : '<p class="muted">لا توجد إعلانات حالياً.</p>') +
        (c.note ? `<p class="muted">${E(c.note)}</p>` : '') + '</div>';
      vp.onclick = (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'contact') return this.contact({ kind: 'inq' });
        if (b.dataset.a === 'share') { const i = items.find((x) => x.id === b.dataset.id); if (i) this.share(i.title + (i.body ? '\n\n' + i.body : '') + (i.link ? '\n' + i.link : '')); }
      };
      items.forEach((i) => { this.st.seen[i.id] = 1; }); this.saveSt(); this.badge();
    },
    async share(text) {
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(text); UI.toast('تم نسخ النص', 'success'); } catch (_) { UI.toast('تعذّر النسخ', 'error'); }
    },

    // ---------- سياسة الإضافات ----------
    policy(id) { const a = (this.ch && this.ch.addons) || {}; return a[id] || a['*'] || null; },
    async verifyCode(code, addon) {
      try {
        const pub = this.ch && this.ch.pub; if (!pub) return { ok: false, why: 'الاشتراك غير مفعّل لدى المالك بعد' };
        const [p, s] = String(code || '').trim().split('.'); if (!p || !s) return { ok: false, why: 'الرمز غير صحيح' };
        const key = await crypto.subtle.importKey('jwk', pub, ECDSA, false, ['verify']);
        if (!(await crypto.subtle.verify(SIGN, key, unb64u(s), enc.encode(p)))) return { ok: false, why: 'الرمز غير صحيح' };
        const d = JSON.parse(b64uText(p));
        if (d.a !== '*' && d.a !== addon) return { ok: false, why: 'هذا الرمز لإضافة أخرى' };
        if (d.e && d.e < Date.now()) return { ok: false, why: 'انتهت صلاحية الرمز' };
        if ((this.ch.revoked || []).includes(d.i)) return { ok: false, why: 'أوقفه المالك' };
        return { ok: true, d };
      } catch (_) { return { ok: false, why: 'الرمز غير صحيح' }; }
    },
    /** يُستدعى قبل فتح أي إضافة؛ يعيد true للسماح */
    async gate(id) {
      const pol = this.policy(id); if (!pol) return true;
      const msg = pol.msg || '';
      if (pol.state === 'off') { await UI.dialog({ title: '⛔ الإضافة موقوفة', message: msg || 'أوقف المالك هذه الإضافة مؤقتاً.', okText: 'حسناً', cancelText: 'تواصل', hideCancel: false }).then((v) => { if (!v) this.contact({ kind: 'inq', addon: id, subject: 'استفسار عن إيقاف إضافة' }); }); return false; }
      if (pol.state === 'warn' && msg) await UI.dialog({ title: '⚠️ تنبيه', message: msg, okText: 'متابعة', hideCancel: true });
      if (pol.account && !this.st.acct) {
        const v = await UI.dialog({ title: 'تسجيل حساب', message: 'هذه الإضافة تتطلب تسجيل اسمك ورقمك للمتابعة. يبقيان على جهازك ويُرسلان للمالك بطلبك فقط.', okText: 'حفظ ومتابعة', fields: [{ id: 'name', label: 'الاسم', required: true, maxlength: 60 }, { id: 'phone', label: 'رقم الهاتف (واتساب)', required: true, maxlength: 25, autocomplete: 'tel' }] });
        if (!v) return false; this.st.acct = { name: v.name.trim(), phone: v.phone.trim(), t: Date.now() }; await this.saveSt();
      }
      if (pol.sub) {
        const cur = this.st.subs[id] || this.st.subs['*'];
        if (cur && (await this.verifyCode(cur, id)).ok) return true;
        for (;;) {
          const v = await UI.dialog({ title: '🔑 اشتراك مطلوب', message: 'أدخل رمز الاشتراك الذي أرسله لك المالك. وإن لم يكن لديك رمز فاضغط «طلب اشتراك».', okText: 'تفعيل', cancelText: 'طلب اشتراك', fields: [{ id: 'code', label: 'رمز الاشتراك', mono: true, required: true }] });
          if (!v) { this.contact({ kind: 'sub', addon: id, subject: 'طلب اشتراك' }); return false; }
          const r = await this.verifyCode(v.code, id);
          if (r.ok) { this.st.subs[r.d.a === '*' ? '*' : id] = v.code.trim(); await this.saveSt(); UI.toast('✅ تم التفعيل', 'success'); this.badge(); return true; }
          UI.toast(r.why, 'error');
        }
      }
      return true;
    },

    // ---------- نافذة التواصل (طلب/استفسار/إرسال ملفات إلى المالك) ----------
    contact(o = {}) {
      const c = (this.ch && this.ch.contact) || {}, a = this.st.acct || {}, KINDS = [['inq', 'استفسار'], ['req', 'طلب'], ['sub', 'طلب اشتراك'], ['post', 'طلب نشر منشور'], ['bug', 'مشكلة'], ['oth', 'أخرى']];
      const root = document.getElementById('dialog-root'), ov = document.createElement('div'); ov.className = 'dialog-overlay';
      ov.innerHTML = `<form class="dialog ctl-contact" role="dialog" aria-modal="true" aria-label="التواصل"><h3>💬 تواصل مع المالك</h3>
        <label class="lbl">الاسم</label><input class="field" name="name" maxlength="60" value="${E(a.name || '')}">
        <label class="lbl">رقم الهاتف</label><input class="field" name="phone" maxlength="25" dir="ltr" value="${E(a.phone || '')}">
        <label class="lbl">النوع</label><select class="field" name="kind">${KINDS.map(([v, l]) => `<option value="${v}"${v === (o.kind || 'inq') ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <label class="lbl">الموضوع</label><input class="field" name="subject" maxlength="100" value="${E(o.subject || '')}">
        <label class="lbl">الرسالة</label><textarea class="field" name="text" rows="5" maxlength="4000">${E(o.text || '')}</textarea>
        <label class="lbl">إرفاق ملفات أو صور (من مدير الملفات)</label><input class="field" type="file" name="files" multiple>
        <p class="muted sm" data-fi></p>
        <div class="ctl-send">
          <button type="button" class="btn" data-s="share">📤 مشاركة مع الملفات</button>
          ${c.whatsapp ? '<button type="button" class="btn" data-s="wa">واتساب</button>' : ''}
          ${c.telegram ? '<button type="button" class="btn" data-s="tg">تيليجرام</button>' : ''}
          ${c.email ? '<button type="button" class="btn" data-s="mail">بريد</button>' : ''}
          ${c.facebook ? '<button type="button" class="btn" data-s="fb">فيسبوك</button>' : ''}
          <button type="button" class="btn" data-s="copy">نسخ</button></div>
        ${c.whatsapp || c.telegram || c.email || c.facebook ? '' : '<p class="muted sm">لم يحدّد المالك وسائل التواصل بعد؛ استخدم «مشاركة» أو «نسخ».</p>'}
        <div class="dialog-actions"><button type="button" class="btn" data-s="x">إغلاق</button></div></form>`;
      root.appendChild(ov); const form = ov.querySelector('form'), fi = form.querySelector('[data-fi]');
      const body = () => { const f = form.elements; return `📩 ${KINDS.find((k) => k[0] === f.kind.value)[1]}${f.subject.value ? ' — ' + f.subject.value : ''}\nالاسم: ${f.name.value}\nالهاتف: ${f.phone.value}${o.addon ? '\nالإضافة: ' + o.addon : ''}\n\n${f.text.value}\n\n— العيسائي برو v${window.APP_VERSION || ''}`; };
      const files = () => Array.from(form.elements.files.files || []);
      form.elements.files.addEventListener('change', () => { fi.textContent = files().length ? files().map((f) => f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' ك.ب)').join('، ') : ''; });
      const remember = async () => { const f = form.elements; if (f.name.value.trim() && f.phone.value.trim()) { this.st.acct = { name: f.name.value.trim(), phone: f.phone.value.trim(), t: Date.now() }; await this.saveSt(); } };
      const digits = (s) => String(s).replace(/[^\d]/g, '');
      form.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-s]'); if (!b) return; const s = b.dataset.s, t = body();
        if (s === 'x') return ov.remove();
        if (!form.elements.text.value.trim() && !files().length) return UI.toast('اكتب رسالتك أو أرفق ملفاً', 'warn');
        await remember();
        if (s === 'wa') return window.open('https://wa.me/' + digits(c.whatsapp) + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
        if (s === 'mail') return window.open('mailto:' + encodeURIComponent(c.email) + '?subject=' + encodeURIComponent(form.elements.subject.value || 'العيسائي برو') + '&body=' + encodeURIComponent(t), '_self');
        if (s === 'tg' || s === 'fb') { try { await navigator.clipboard.writeText(t); UI.toast('نُسخت الرسالة، الصقها في المحادثة', 'success'); } catch (_) { /* لا شيء */ } return window.open(s === 'tg' ? 'https://t.me/' + String(c.telegram).replace(/^@/, '') : 'https://m.me/' + String(c.facebook).replace(/^.*\//, ''), '_blank', 'noopener'); }
        if (s === 'copy') { try { await navigator.clipboard.writeText(t); UI.toast('تم النسخ', 'success'); } catch (_) { UI.toast('تعذّر النسخ', 'error'); } return; }
        if (s === 'share') {
          const fl = files(); try { if (fl.length && navigator.canShare && navigator.canShare({ files: fl })) return await navigator.share({ text: t, files: fl }); if (navigator.share) { if (fl.length) UI.toast('هذا الجهاز لا يشارك الملفات من هنا؛ أُرسلت الرسالة دون ملفات', 'warn'); return await navigator.share({ text: t }); } } catch (er) { if (er && er.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(t); UI.toast('المشاركة غير متاحة هنا؛ نُسخت الرسالة', 'warn'); } catch (_) { UI.toast('تعذّرت المشاركة', 'error'); }
        }
      });
      ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); ov.remove(); } });
      form.querySelector('[name=text]').focus();
    },

    // ---------- لوحة المالك (داخل ترس الإدارة) ----------
    sub: 'items', draft: null,
    async panel(v) {
      this.pv = v;
      if (!this.draft) { try { this.draft = await Store.get(K_DRAFT); } catch (_) { /* لا شيء */ } if (!this.draft) this.draft = this.ch ? clone(this.ch) : emptyCh(); this.draft.pubset = this.draft.pubset || { owner: 'bakil309275-cell', repo: 'Alaisai_OS_Pro', branch: 'main', path: 'control/channel.json' }; }
      const tabs = [['items', '📣 الإعلانات والمنشورات'], ['addons', '🧩 الإضافات'], ['subs', '🔑 الاشتراكات'], ['contact', '💬 التواصل'], ['pub', '🚀 النشر والتنظيف']];
      v.innerHTML = `<div class="ctl-owner"><p class="muted">كل تعديل هنا مسودة على جهازك حتى تضغط «نشر»؛ عندها يصل لجميع المستخدمين خلال دقائق.</p>
        <div class="tabs sub" role="tablist">${tabs.map(([k, l]) => `<button class="btn" role="tab" aria-selected="${k === this.sub}" data-c="sub" data-k="${k}">${l}</button>`).join('')}</div><div id="ctl-body"></div>
        <div class="ctl-bar"><button class="btn btn-primary" data-c="publish">🚀 نشر للجميع</button><span class="muted sm">${this.draft.seq ? 'آخر نشر: ' + fmt(this.draft.updated) + ' (رقم ' + this.draft.seq + ')' : 'لم يُنشر شيء بعد'}</span></div></div>`;
      v.onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) this.act(b.dataset.c, b.dataset); };
      this.body();
    },
    async saveDraft() { try { await Store.set(K_DRAFT, this.draft); } catch (_) { /* لا شيء */ } },
    body() {
      const h = document.getElementById('ctl-body'); if (!h) return; const d = this.draft;
      if (this.sub === 'items') {
        h.innerHTML = '<div class="ctl-bar"><button class="btn" data-c="newitem">＋ إعلان أو منشور</button></div>' + (d.items.length ? d.items.slice().sort((a, b) => b.created - a.created).map((i) => `<div class="admin-row"><span class="ico">${(LV[i.level] || LV.info)[0]}</span><span class="grow">${E(i.title)} <span class="badge">${KIND[i.kind] || 'إعلان'}</span> <span class="badge">${E(i.aud === 'all' ? 'للجميع' : i.aud)}</span>${i.arch ? ' <span class="badge">مؤرشف</span>' : ''}</span><button class="btn btn-sm" data-c="edititem" data-id="${E(i.id)}">✏️</button><button class="btn btn-sm btn-danger" data-c="delitem" data-id="${E(i.id)}" aria-label="حذف">🗑</button></div>`).join('') : '<p class="muted">لا توجد عناصر بعد.</p>');
      } else if (this.sub === 'addons') {
        const ids = new Map([['*', 'كل الإضافات (افتراضي)']]); this.installedAddons().forEach((a) => ids.set(a.id, a.name)); Object.keys(d.addons).forEach((k) => { if (!ids.has(k)) ids.set(k, k); });
        h.innerHTML = '<p class="muted">اضبط حالة كل إضافة: متاحة، تنبيه، أو موقوفة، مع فرض تسجيل حساب أو اشتراك. سياسة إضافة بعينها تغلب سياسة «الكل».</p>' + [...ids].map(([id, nm]) => { const p = d.addons[id]; return `<div class="admin-row"><span class="grow">${E(nm)} ${p ? `<span class="badge">${{ on: 'متاحة', off: 'موقوفة', warn: 'تنبيه' }[p.state]}</span>${p.account ? ' <span class="badge">حساب</span>' : ''}${p.sub ? ' <span class="badge">اشتراك</span>' : ''}` : '<span class="badge">بلا سياسة</span>'}</span><button class="btn btn-sm" data-c="editpol" data-id="${E(id)}">✏️ ضبط</button>${p ? `<button class="btn btn-sm btn-danger" data-c="delpol" data-id="${E(id)}" aria-label="إزالة">🗑</button>` : ''}</div>`; }).join('') +
          '<div class="ctl-bar"><button class="btn" data-c="addpol">＋ سياسة لإضافة أخرى بمعرّفها</button></div>';
      } else if (this.sub === 'subs') {
        const have = !!d.pub;
        h.innerHTML = `<p class="muted">الاشتراك برمز موقَّع يتحقق منه التطبيق دون خادم. أصدر رمزاً لكل مشترك، وإن أوقفته يصل الإيقاف للجميع عند النشر التالي.</p>` +
          (have ? '<div class="ctl-bar"><button class="btn btn-primary" data-c="issue">＋ إصدار رمز اشتراك</button><button class="btn" data-c="keyexp">⬇️ نسخة احتياطية من المفتاح</button><button class="btn" data-c="keyimp">⬆️ استيراد مفتاح</button></div>' : '<div class="ctl-bar"><button class="btn btn-primary" data-c="keygen">🔑 إنشاء مفتاح الاشتراكات</button><button class="btn" data-c="keyimp">⬆️ استيراد مفتاح</button></div>') +
          '<h4>الرموز الصادرة</h4><div id="ctl-issued"></div>';
        this.issued();
      } else if (this.sub === 'contact') {
        const c = d.contact; h.innerHTML = `<p class="muted">وسائل التواصل التي تظهر للمستخدمين في «تواصل مع المالك».</p><div class="admin-row"><span class="grow">واتساب: ${E(c.whatsapp || '—')}</span></div><div class="admin-row"><span class="grow">تيليجرام: ${E(c.telegram || '—')}</span></div><div class="admin-row"><span class="grow">البريد: ${E(c.email || '—')}</span></div><div class="admin-row"><span class="grow">فيسبوك: ${E(c.facebook || '—')}</span></div><div class="admin-row"><span class="grow">ملاحظة: ${E(c.note || '—')}</span></div><div class="ctl-bar"><button class="btn" data-c="editcontact">✏️ تعديل</button><button class="btn" data-c="testcontact">معاينة نافذة التواصل</button></div>`;
      } else {
        const p = d.pubset, r = d.retain; h.innerHTML = `<h4>النشر</h4><p class="muted">النشر المباشر يكتب الملف في مستودع الموقع (${E(p.owner)}/${E(p.repo)} فرع ${E(p.branch)}) برمز GitHub محفوظ مشفّراً على جهازك. أو نزّل الملف وارفعه يدوياً إلى <code dir="ltr">${E(p.path)}</code>.</p><div class="ctl-bar"><button class="btn" data-c="pubset">⚙️ إعدادات النشر</button><button class="btn" data-c="settoken">🔐 رمز GitHub</button><button class="btn" data-c="download">⬇️ تنزيل channel.json</button></div>
          <h4>التنظيف التلقائي</h4><p class="muted">الإعلانات والمنشورات تُؤرشف بعد ${+r.archiveDays} يوماً (يبقى العنوان فقط)، وتُحذف من الموقع بعد ${+r.deleteDays} يوماً أو عند انتهاء مدتها. هذا لا يمسّ ما نُزّل على أجهزة المستخدمين. يعمل التنظيف عند كل نشر، وأسبوعياً تلقائياً عبر GitHub Actions.</p><div class="ctl-bar"><button class="btn" data-c="retain">⚙️ مدد الأرشفة والحذف</button><button class="btn" data-c="pruneNow">🧹 نظّف الآن</button></div>`;
      }
    },
    issued() {
      const h = document.getElementById('ctl-issued'); if (!h) return; const L = (this.draft.issued || []).slice().reverse(), rv = this.draft.revoked || [];
      h.innerHTML = L.length ? L.map((x) => `<div class="admin-row"><span class="grow">${E(x.u)} — ${E(x.a === '*' ? 'كل الإضافات' : x.a)} <span class="badge">${x.e ? 'حتى ' + fmt(x.e) : 'مفتوح'}</span>${rv.includes(x.i) ? ' <span class="badge">موقوف</span>' : ''}</span><button class="btn btn-sm" data-c="showcode" data-id="${E(x.i)}">رمز</button><button class="btn btn-sm" data-c="${rv.includes(x.i) ? 'unrevoke' : 'revoke'}" data-id="${E(x.i)}">${rv.includes(x.i) ? 'إعادة' : 'إيقاف'}</button></div>`).join('') : '<p class="muted">لم تُصدر رموزاً بعد.</p>';
    },
    async act(a, ds) {
      const d = this.draft;
      if (a === 'sub') { this.sub = ds.k; return this.panel(this.pv); }
      if (a === 'publish') return this.publish();
      if (a === 'newitem' || a === 'edititem') {
        const o = a === 'edititem' ? d.items.find((x) => x.id === ds.id) : null;
        const addons = this.installedAddons(), audOpts = [['all', 'للجميع (عام)']].concat(addons.map((x) => ['addon:' + x.id, 'مستخدمو: ' + x.name])).concat([['sub:', 'خاص بمشترك (أدخل معرّف الرمز أدناه)']]);
        const v = await UI.dialog({ title: o ? 'تعديل' : 'إعلان أو منشور جديد', okText: 'حفظ', fields: [
          { id: 'kind', label: 'النوع', type: 'select', options: [['ann', 'إعلان'], ['post', 'منشور']], value: o ? o.kind : 'ann' },
          { id: 'title', label: 'العنوان', required: true, maxlength: 120, value: o ? o.title : '' },
          { id: 'body', label: 'النص', type: 'textarea', rows: 5, value: o && o.body || '' },
          { id: 'link', label: 'رابط (اختياري)', maxlength: 300, value: o && o.link || '' },
          { id: 'aud', label: 'الجمهور', type: 'select', options: audOpts, value: o ? (String(o.aud).indexOf('sub:') === 0 ? 'sub:' : o.aud) : 'all' },
          { id: 'subid', label: 'معرّف رمز المشترك (للخاص فقط)', maxlength: 20, value: o && String(o.aud).indexOf('sub:') === 0 ? o.aud.slice(4) : '' },
          { id: 'level', label: 'الأهمية', type: 'select', options: [['info', 'عادي'], ['warn', 'تنبيه'], ['urgent', 'عاجل (يظهر كنافذة عند الفتح)']], value: o ? o.level : 'info' },
          { id: 'days', label: 'مدة الظهور بالأيام (0 = بلا انتهاء)', value: o ? String(o.expires ? Math.max(1, Math.round((o.expires - o.created) / DAY)) : 0) : '30', maxlength: 4 },
          { id: 'pin', label: 'تثبيت في الأعلى', type: 'select', options: [['0', 'لا'], ['1', 'نعم']], value: o && o.pin ? '1' : '0' }],
          validate: (x) => (x.link && !/^https?:\/\//i.test(x.link.trim()) ? 'الرابط يبدأ بـ https://' : (x.aud === 'sub:' && !x.subid.trim() ? 'أدخل معرّف الرمز' : '')) });
        if (!v) return;
        const days = Math.max(0, parseInt(v.days, 10) || 0), created = o ? o.created : Date.now();
        const it = { id: o ? o.id : rid(), kind: v.kind, title: v.title.trim(), body: v.body.trim(), link: v.link.trim(), aud: v.aud === 'sub:' ? 'sub:' + v.subid.trim() : v.aud, level: v.level, created, expires: days ? created + days * DAY : 0, pin: v.pin === '1' };
        if (o) Object.assign(o, it, { arch: false }); else d.items.push(it);
        await this.saveDraft(); return this.body();
      }
      if (a === 'delitem') { if (!(await UI.confirm('حذف هذا العنصر؟ يختفي من الموقع عند النشر التالي.', { okText: 'حذف' }))) return; d.items = d.items.filter((x) => x.id !== ds.id); await this.saveDraft(); return this.body(); }
      if (a === 'editpol' || a === 'addpol') {
        let id = ds.id; if (a === 'addpol') { id = await UI.prompt('معرّف الإضافة', { label: 'اسم الإضافة كما في المتجر (id)', placeholder: 'مثال: الطب والأدوية' }); if (!id) return; id = id.trim(); }
        const p = d.addons[id] || { state: 'on', msg: '', account: false, sub: false };
        const v = await UI.dialog({ title: 'سياسة: ' + (id === '*' ? 'كل الإضافات' : id), okText: 'حفظ', fields: [
          { id: 'state', label: 'الحالة', type: 'select', options: [['on', 'متاحة'], ['warn', 'متاحة مع تنبيه'], ['off', 'موقوفة']], value: p.state },
          { id: 'msg', label: 'الرسالة للمستخدم', type: 'textarea', rows: 3, value: p.msg || '' },
          { id: 'account', label: 'فرض تسجيل حساب (اسم ورقم)', type: 'select', options: [['0', 'لا'], ['1', 'نعم']], value: p.account ? '1' : '0' },
          { id: 'sub', label: 'فرض اشتراك (رمز موقَّع)', type: 'select', options: [['0', 'لا'], ['1', 'نعم']], value: p.sub ? '1' : '0' }] });
        if (!v) return; if (v.sub === '1' && !d.pub) UI.toast('أنشئ مفتاح الاشتراكات أولاً من تبويب الاشتراكات', 'warn');
        d.addons[id] = { state: v.state, msg: v.msg.trim(), account: v.account === '1', sub: v.sub === '1' }; await this.saveDraft(); return this.body();
      }
      if (a === 'delpol') { delete d.addons[ds.id]; await this.saveDraft(); return this.body(); }
      if (a === 'editcontact') {
        const c = d.contact, v = await UI.dialog({ title: 'وسائل التواصل', okText: 'حفظ', fields: [
          { id: 'whatsapp', label: 'واتساب (رقم دولي بلا +)', value: c.whatsapp, maxlength: 20 }, { id: 'telegram', label: 'تيليجرام (اسم المستخدم)', value: c.telegram, maxlength: 40 },
          { id: 'email', label: 'البريد', value: c.email, maxlength: 80 }, { id: 'facebook', label: 'فيسبوك (اسم الصفحة)', value: c.facebook, maxlength: 80 }, { id: 'note', label: 'ملاحظة تظهر للمستخدمين', value: c.note, maxlength: 200 }] });
        if (!v) return; d.contact = { whatsapp: v.whatsapp.trim(), telegram: v.telegram.trim(), email: v.email.trim(), facebook: v.facebook.trim(), note: v.note.trim() }; await this.saveDraft(); return this.body();
      }
      if (a === 'testcontact') { const old = this.ch; this.ch = Object.assign({}, this.ch || emptyCh(), { contact: d.contact }); this.contact({}); this.ch = old; return; }
      if (a === 'retain') {
        const r = d.retain, v = await UI.dialog({ title: 'مدد التنظيف', okText: 'حفظ', fields: [{ id: 'a', label: 'الأرشفة بعد (أيام)', value: String(r.archiveDays), required: true, maxlength: 4 }, { id: 'd', label: 'الحذف من الموقع بعد (أيام)', value: String(r.deleteDays), required: true, maxlength: 4 }], validate: (x) => ((parseInt(x.a, 10) || 0) < 1 || (parseInt(x.d, 10) || 0) <= (parseInt(x.a, 10) || 0) ? 'مدة الحذف يجب أن تكون أكبر من مدة الأرشفة' : '') });
        if (!v) return; d.retain = { archiveDays: parseInt(v.a, 10), deleteDays: parseInt(v.d, 10) }; await this.saveDraft(); return this.body();
      }
      if (a === 'pruneNow') { const r = prune(d); await this.saveDraft(); UI.toast(`أُرشف ${r.arch} وحُذف ${r.del} (انشر ليصل الموقع)`, 'success'); return this.body(); }
      if (a === 'pubset') {
        const p = d.pubset, v = await UI.dialog({ title: 'إعدادات النشر', okText: 'حفظ', fields: [{ id: 'owner', label: 'مالك المستودع', value: p.owner, required: true }, { id: 'repo', label: 'المستودع', value: p.repo, required: true }, { id: 'branch', label: 'الفرع', value: p.branch, required: true }, { id: 'path', label: 'مسار الملف', value: p.path, required: true }], validate: (x) => (/^[\w.-]+$/.test(x.owner) && /^[\w.-]+$/.test(x.repo) && /^[\w./-]+$/.test(x.branch) && /^[\w][\w./-]*\.json$/.test(x.path) ? '' : 'قيمة غير صالحة') });
        if (!v) return; d.pubset = { owner: v.owner.trim(), repo: v.repo.trim(), branch: v.branch.trim(), path: v.path.trim() }; await this.saveDraft(); return this.body();
      }
      if (a === 'settoken') return this.setToken();
      if (a === 'download') return this.download();
      if (a === 'keygen') return this.keygen();
      if (a === 'keyexp') return this.keyExport();
      if (a === 'keyimp') return this.keyImport();
      if (a === 'issue') return this.issue();
      if (a === 'showcode') { const x = (d.issued || []).find((q) => q.i === ds.id); return x && this.showCode(x); }
      if (a === 'revoke') { d.revoked = (d.revoked || []).concat(ds.id); await this.saveDraft(); return this.issued(); }
      if (a === 'unrevoke') { d.revoked = (d.revoked || []).filter((i) => i !== ds.id); await this.saveDraft(); return this.issued(); }
    },

    // ---------- المفاتيح والرموز ----------
    async ownerKey() { try { const k = await Sync.deviceKey(false), s = await Store.get(K_OWN); if (k && s) return JSON.parse(await Sec.open(k, s)); } catch (_) { /* لا شيء */ } return null; },
    async storeOwnerKey(jwk) { const k = await Sync.deviceKey(true); if (!k) throw new Error('التخزين المشفّر غير متاح في هذا المتصفح'); await Store.set(K_OWN, await Sec.seal(k, JSON.stringify(jwk))); },
    async keygen() {
      if (!(await UI.confirm('إنشاء مفتاح اشتراكات جديد؟ إن كان لديك مفتاح سابق فستبطل كل الرموز الصادرة به.', { okText: 'إنشاء', danger: false }))) return;
      try {
        const kp = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
        await this.storeOwnerKey(await crypto.subtle.exportKey('jwk', kp.privateKey));
        const pub = await crypto.subtle.exportKey('jwk', kp.publicKey); delete pub.key_ops; delete pub.ext; this.draft.pub = pub; this.draft.issued = []; this.draft.revoked = [];
        await this.saveDraft(); UI.toast('تم إنشاء المفتاح. انشر ثم احتفظ بنسخة احتياطية منه', 'success'); this.body();
      } catch (e) { UI.toast(String(e.message || 'تعذّر الإنشاء'), 'error'); }
    },
    async keyExport() {
      const j = await this.ownerKey(); if (!j) return UI.toast('لا يوجد مفتاح على هذا الجهاز', 'warn');
      if (!(await UI.confirm('هذا الملف سري: من يملكه يستطيع إصدار رموز اشتراك. احفظه في مكان آمن ولا تشاركه. متابعة؟', { okText: 'تنزيل', danger: false }))) return;
      this.save('alaisai-subscription-key.json', JSON.stringify({ format: 'alaisai-subkey', private: j, pub: this.draft.pub }));
    },
    async keyImport() {
      const f = await this.pick('.json,application/json'); if (!f) return;
      try { const j = JSON.parse(await f.text()); if (j.format !== 'alaisai-subkey' || !j.private || !j.pub) throw 0; await this.storeOwnerKey(j.private); this.draft.pub = j.pub; await this.saveDraft(); UI.toast('تم استيراد المفتاح', 'success'); this.body(); } catch (_) { UI.toast('ملف مفتاح غير صالح', 'error'); }
    },
    async issue() {
      const k = await this.ownerKey(); if (!k) return UI.toast('مفتاح الاشتراكات غير موجود على هذا الجهاز', 'warn');
      const addons = [['*', 'كل الإضافات']].concat(this.installedAddons().map((a) => [a.id, a.name]));
      const v = await UI.dialog({ title: 'إصدار رمز اشتراك', okText: 'إصدار', fields: [{ id: 'u', label: 'اسم المشترك', required: true, maxlength: 60 }, { id: 'a', label: 'الإضافة', type: 'select', options: addons }, { id: 'days', label: 'المدة بالأيام (0 = مفتوح)', value: '30', required: true, maxlength: 5 }] });
      if (!v) return;
      const days = Math.max(0, parseInt(v.days, 10) || 0), pl = { i: rid(), a: v.a, u: v.u.trim(), e: days ? Date.now() + days * DAY : 0, t: Date.now() };
      const p = b64u(enc.encode(JSON.stringify(pl))), key = await crypto.subtle.importKey('jwk', k, ECDSA, false, ['sign']), s = b64u(new Uint8Array(await crypto.subtle.sign(SIGN, key, enc.encode(p))));
      pl.code = p + '.' + s; (this.draft.issued = this.draft.issued || []).push(pl); await this.saveDraft(); this.body(); this.showCode(pl);
    },
    showCode(x) {
      UI.dialog({ title: 'رمز ' + x.u, message: 'معرّف الرمز: ' + x.i + '\nأرسل الرمز للمشترك ليلصقه عند فتح الإضافة.', okText: 'نسخ ومشاركة', cancelText: 'إغلاق', fields: [{ id: 'c', type: 'textarea', rows: 5, mono: true, value: x.code }] }).then((r) => { if (r) this.share('رمز اشتراكك في العيسائي برو:\n' + x.code); });
    },

    // ---------- النشر ----------
    async publish() {
      if (this._busy) return; this._busy = true;
      try {
        const d = this.draft; const r = prune(d); d.seq = (d.seq || 0) + 1; d.updated = Date.now();
        const out = this.out();
        const tok = await this.getToken();
        if (!tok) { this.save('channel.json', JSON.stringify(out, null, 1)); await this.saveDraft(); this.panel(this.pv); return UI.toast('نُزّل الملف. ارفعه إلى ' + d.pubset.path + ' في المستودع (أو أدخل رمز GitHub للنشر المباشر)', 'info'); }
        const p = d.pubset, base = 'https://api.github.com/repos/' + p.owner + '/' + p.repo + '/contents/' + p.path.split('/').map(encodeURIComponent).join('/');
        const H = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok, 'X-GitHub-Api-Version': '2022-11-28' };
        let sha; const g = await fetch(base + '?ref=' + encodeURIComponent(p.branch), { headers: H, cache: 'no-store' });
        if (g.ok) sha = (await g.json()).sha; else if (g.status !== 404) throw new Error(g.status === 401 ? 'رمز GitHub غير صالح' : 'تعذّر الوصول للمستودع (' + g.status + ')');
        const put = await fetch(base, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify({ message: 'channel: seq ' + d.seq, branch: p.branch, sha, content: Sec.textToB64(JSON.stringify(out, null, 1)) }) });
        if (!put.ok) throw new Error(put.status === 403 || put.status === 404 ? 'الرمز لا يملك صلاحية الكتابة على المستودع' : 'فشل النشر (' + put.status + ')');
        this.ch = clone(out); await Store.set(K_CH, this.ch); await this.saveDraft(); this.badge(); this.panel(this.pv);
        UI.toast(`🚀 نُشر (أُرشف ${r.arch}، حُذف ${r.del}). يصل المستخدمين خلال دقائق`, 'success');
      } catch (e) { this.draft.seq = Math.max(0, (this.draft.seq || 1) - 1); UI.toast(String(e.message || 'فشل النشر'), 'error'); } finally { this._busy = false; }
    },
    out() { const d = this.draft, o = clone(d); delete o.pubset; delete o.issued; return o; },
    download() { this.save('channel.json', JSON.stringify(this.out(), null, 1)); },
    async getToken() { try { const k = await Sync.deviceKey(false), s = await Store.get(K_TOK); if (k && s) return await Sec.open(k, s); } catch (_) { /* لا شيء */ } return null; },
    async setToken() {
      const v = await UI.dialog({ title: 'رمز GitHub للنشر', message: 'رمز بصلاحية الكتابة على مستودع الموقع فقط. يُحفظ مشفّراً على هذا الجهاز ولا يظهر ولا يدخل النسخ الاحتياطية. اتركه فارغاً لحذفه.', okText: 'حفظ', fields: [{ id: 't', label: 'الرمز', type: 'password', autocomplete: 'off' }] });
      if (!v) return;
      if (!v.t.trim()) { await Store.del(K_TOK); return UI.toast('حُذف الرمز', 'success'); }
      if (!/^[\w-]{20,255}$/.test(v.t.trim())) return UI.toast('صيغة الرمز غير صحيحة', 'error');
      try { const k = await Sync.deviceKey(true); if (!k) return UI.toast('التخزين المشفّر غير متاح في هذا المتصفح', 'error'); await Store.set(K_TOK, await Sec.seal(k, v.t.trim())); UI.toast('تم حفظ الرمز مشفّراً', 'success'); } catch (_) { UI.toast('تعذّر الحفظ', 'error'); }
    },
    save(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); },
    pick(accept) { return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); }); },
    prune,
  };
  window.Control = Control;
})();
