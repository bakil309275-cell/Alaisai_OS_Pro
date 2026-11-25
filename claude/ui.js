/* نافذة «كلود» — مساعد العيسائي برو. تُحمَّل عند أول نقرة فقط من claude/ui.js (لا تثقل التطبيق).
 * تتحدث مع الخادم: POST /v1/claude/ask و /v1/claude/escalate. لا تحمل أي معرفة بنفسها؛ المعرفة والقواعد في المستودع/الخادم. */
(function () {
  'use strict';
  if (window.ClaudeAI) return;
  const CSS = `.cl-win{position:fixed;inset-inline:0;bottom:0;margin-inline:auto;width:100%;max-width:520px;height:min(80vh,640px);z-index:1100;display:flex;flex-direction:column;background:var(--panel,#fff);color:var(--text,#111);border:1px solid var(--border,#ccc);border-bottom:0;border-radius:18px 18px 0 0;box-shadow:0 -10px 34px rgba(0,0,0,.3);direction:rtl;font-family:inherit}
.cl-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border,#ddd)}.cl-head b{font-size:1.05rem}.cl-head small{opacity:.7}.cl-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;font-size:1.1rem}
.cl-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.cl-m{max-width:88%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:.95rem}.cl-m.a{background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.25);align-self:flex-start;border-end-start-radius:4px}.cl-m.u{background:var(--accent,#2563eb);color:#fff;align-self:flex-end;border-end-end-radius:4px}
.cl-m img{max-width:100%;max-height:140px;border-radius:8px;display:block;margin-top:6px}
.cl-chips{display:flex;flex-wrap:wrap;gap:6px}.cl-chip,.cl-btn{border:1px solid var(--border,#ccc);background:transparent;color:inherit;border-radius:999px;padding:6px 12px;cursor:pointer;font:inherit;font-size:.85rem}.cl-chip:hover,.cl-btn:hover{background:rgba(124,58,237,.12)}
.cl-foot{border-top:1px solid var(--border,#ddd);padding:8px 10px;display:flex;flex-direction:column;gap:6px}.cl-row{display:flex;gap:6px;align-items:flex-end}
.cl-in{flex:1;min-height:42px;max-height:110px;resize:none;border:1px solid var(--border,#ccc);border-radius:12px;padding:9px 12px;background:transparent;color:inherit;font:inherit}
.cl-ic{width:42px;height:42px;border-radius:12px;border:1px solid var(--border,#ccc);background:transparent;color:inherit;cursor:pointer;font-size:1.1rem}.cl-send{background:var(--accent,#2563eb);color:#fff;border-color:transparent}.cl-ic:disabled{opacity:.5}
.cl-att{display:flex;align-items:center;gap:8px;font-size:.8rem}.cl-att img{height:38px;border-radius:6px}
.cl-dots i{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:currentColor;opacity:.4;animation:cl-b 1s infinite}.cl-dots i:nth-child(2){animation-delay:.15s}.cl-dots i:nth-child(3){animation-delay:.3s}@keyframes cl-b{50%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.cl-dots i{animation:none}}`;
  const CHIPS = ['كيف أنشئ حساباً؟', 'كيف أنشر منشوراً؟', 'كيف أرفع فيديو؟', 'كيف أطلب اشتراكاً؟', 'كيف أحذف حسابي؟', 'دخلت من جهاز جديد'];
  const st = { win: null, hist: [], shot: '', busy: false, lastQ: '' };
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

  /** يضغط صورة إلى JPEG صغير (≤ ~120KB) لإرفاقها بطلب المساعدة */
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let q = 0.7, d = c.toDataURL('image/jpeg', q); while (d.length > 150000 && q > 0.25) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } d.length > 190000 ? rej(new Error('الصورة كبيرة')) : res(d); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('تعذّر قراءة الصورة')); }; im.src = url;
    });
  }
  const call = (path, body) => (window.Community ? Community.call(path, { method: 'POST', body }) : Promise.resolve(null));

  function add(role, text, extra) {
    const b = st.win.querySelector('.cl-body'), m = el('div', 'cl-m ' + role, text); if (extra && extra.shot) { const i = el('img'); i.alt = 'لقطة شاشة مرفقة'; i.src = extra.shot; m.appendChild(i); }
    b.appendChild(m); b.scrollTop = b.scrollHeight; return m;
  }
  function actions(items) {
    const b = st.win.querySelector('.cl-body'), w = el('div', 'cl-chips');
    for (const [label, fn] of items) { const x = el('button', 'cl-btn', label); x.type = 'button'; x.onclick = () => { w.remove(); fn(); }; w.appendChild(x); }
    b.appendChild(w); b.scrollTop = b.scrollHeight;
  }
  async function ask(q) {
    q = q.trim(); if (!q || st.busy) return; st.busy = true; st.lastQ = q; const sendBtn = st.win.querySelector('.cl-send'); sendBtn.disabled = true;
    st.win.querySelectorAll('.cl-chips').forEach((x) => x.remove());
    add('u', q, { shot: st.shot }); const dots = add('a', ''); dots.innerHTML = '<span class="cl-dots" aria-label="كلود يكتب"><i></i><i></i><i></i></span>';
    const r = await call('/v1/claude/ask', { q, h: st.hist.slice(-4) });
    dots.remove();
    if (!r || r._s >= 500 || r.error) add('a', r && r.error ? r.error : 'تعذّر الاتصال بخادم المنصة الآن. تأكد من الإنترنت ثم أعد المحاولة، أو حوّل سؤالك للمالك.'), actions([['👤 تحويل للمالك', escalate]]);
    else {
      st.hist.push({ r: 'u', t: q }, { r: 'a', t: r.a.slice(0, 300) }); add('a', r.a);
      if (r.gap || r.limited) actions([['👤 تحويل للمالك', escalate]]); else if (r.refused) actions(CHIPS.slice(0, 3).map((c) => [c, () => ask(c)]));
    }
    st.busy = false; sendBtn.disabled = false; st.win.querySelector('.cl-in').focus();
  }
  async function escalate() {
    if (st.busy) return; const note = (st.win.querySelector('.cl-in').value.trim() || st.lastQ);
    if (!note && !st.shot) return add('a', 'اكتب مشكلتك أو سؤالك أولاً ثم اضغط «تحويل للمالك».');
    const convo = st.hist.map((m) => (m.r === 'u' ? 'المستخدم: ' : 'كلود: ') + m.t).join('\n').slice(-1200);
    st.busy = true; const r = await call('/v1/claude/escalate', { text: (note + (convo ? '\n\n— المحادثة —\n' + convo : '')).slice(0, 2000), shot: st.shot || undefined });
    st.busy = false;
    if (r && r.ok) { add('a', 'تم إرسال طلبك إلى المالك مع المحادثة' + (st.shot ? ' ولقطة الشاشة' : '') + ' 💚 سيصلك رد عبر «القناة» أو وسيلة التواصل المسجّلة.'); st.shot = ''; refreshAtt(); st.win.querySelector('.cl-in').value = ''; }
    else add('a', r && r._s === 429 ? 'أرسلتَ عدة طلبات مؤخراً، انتظر قليلاً ثم أعد المحاولة 🙏' : 'تعذّر الإرسال الآن، حاول لاحقاً.');
  }
  function refreshAtt() {
    const a = st.win.querySelector('.cl-att'); a.replaceChildren(); a.hidden = !st.shot; if (!st.shot) return;
    const i = el('img'); i.alt = 'اللقطة المرفقة'; i.src = st.shot; const x = el('button', 'cl-btn', '✕ إزالة'); x.type = 'button'; x.onclick = () => { st.shot = ''; refreshAtt(); }; a.append(i, el('span', '', 'ستُرسل مع طلبك للمالك'), x);
  }
  function build() {
    if (!document.getElementById('cl-css')) { const s = el('style'); s.id = 'cl-css'; s.textContent = CSS; document.head.appendChild(s); }
    const w = el('section', 'cl-win'); w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'كلود، مساعد العيسائي برو'); w.setAttribute('aria-modal', 'false');
    const head = el('header', 'cl-head'); const av = el('span', 'cl-av', '🤖'); av.setAttribute('aria-hidden', 'true'); const t = el('div'); t.append(el('b', '', 'كلود'), el('br'), el('small', '', 'مساعد العيسائي برو'));
    const cl = el('button', 'cl-ic', '✕'); cl.type = 'button'; cl.setAttribute('aria-label', 'إغلاق'); cl.style.marginInlineStart = 'auto'; cl.onclick = close; head.append(av, t, cl);
    const body = el('div', 'cl-body'); body.setAttribute('aria-live', 'polite'); body.tabIndex = -1;
    const foot = el('div', 'cl-foot'), att = el('div', 'cl-att'), row = el('div', 'cl-row'); att.hidden = true;
    const ta = el('textarea', 'cl-in'); ta.rows = 1; ta.maxLength = 500; ta.placeholder = 'اكتب سؤالك عن استخدام العيسائي برو…'; ta.setAttribute('aria-label', 'سؤالك');
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = ta.value; ta.value = ''; ask(v); } if (e.key === 'Escape') close(); };
    const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true; file.onchange = async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { st.shot = await shrink(f); refreshAtt(); } catch (e) { add('a', e.message || 'تعذّر إرفاق الصورة'); } };
    const pic = el('button', 'cl-ic', '📷'); pic.type = 'button'; pic.setAttribute('aria-label', 'إرفاق لقطة شاشة'); pic.title = 'إرفاق لقطة شاشة (تُرسل للمالك مع طلب المساعدة)'; pic.onclick = () => file.click();
    const send = el('button', 'cl-ic cl-send', '➤'); send.type = 'button'; send.setAttribute('aria-label', 'إرسال'); send.onclick = () => { const v = ta.value; ta.value = ''; ask(v); };
    row.append(pic, ta, send, file);
    const esc = el('button', 'cl-btn', '👤 تحويل للمالك'); esc.type = 'button'; esc.onclick = escalate; esc.style.alignSelf = 'flex-start';
    foot.append(att, row, esc); w.append(head, body, foot); document.body.appendChild(w); st.win = w;
    const name = window.Community && Community.st && Community.st.user ? Community.st.user.name : '';
    add('a', name ? 'مرحباً ' + name + ' 👋 بماذا تود أن أساعدك في العيسائي برو؟' : 'مرحباً بك 👋 أنا كلود، مساعد العيسائي برو. بماذا تود أن أساعدك؟');
    actions(CHIPS.map((c) => [c, () => ask(c)])); ta.focus();
  }
  function close() { if (st.win) { st.win.remove(); st.win = null; } }
  async function open() {
    if (st.win) return close();
    try { if (!window.Community) await UI.loadScript('src/community.js'); await Community.init(); } catch (_) { /* نعمل بدونها */ }
    build();
  }
  window.ClaudeAI = { open, close, ask, version: 1 };
})();
