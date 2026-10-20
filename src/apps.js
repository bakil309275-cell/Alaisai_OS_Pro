/* عارض التطبيقات: html معزول، متصفح، ودفتر ملاحظات متعدد */
(function () {
  const Viewer = {};

  // ---- جسر Alaisai: واجهة آمنة بين التطبيقات المعزولة والنظام (postMessage) ----
  Viewer.cleanups = [];
  Viewer.unmount = () => { Viewer.cleanups.splice(0).forEach((f) => { try { f(); } catch (_) {} }); };

  // يُحقن داخل الإطار المعزول: window.Alaisai = { toast, get, set, remove, keys, env }
  Viewer.preamble = (env) => '(function(){var p={},n=0;addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||!d.alaisai||!p[d.id])return;var x=p[d.id];delete p[d.id];d.ok?x[0](d.result):x[1](new Error(d.error))});' +
    'function c(o,a){return new Promise(function(r,j){var i=++n;p[i]=[r,j];parent.postMessage({alaisai:1,id:i,op:o,args:a},"*")})}' +
    'window.Alaisai={version:1,env:' + JSON.stringify(env).replace(/</g, '\\u003c') + ',toast:function(m){return c("toast",[String(m)])},' +
    'get:function(k){return c("get",[k]).then(function(v){return v==null?null:JSON.parse(v)})},set:function(k,v){return c("set",[k,JSON.stringify(v)])},' +
    'remove:function(k){return c("remove",[k])},keys:function(){return c("keys",[])}};' +
    'addEventListener("keydown",function(e){if(e.key==="Escape")setTimeout(function(){if(!e.defaultPrevented)c("escape",[])},0)})})();';

  Viewer.bridge = (frame, ns, label) => {
    let last = 0, burst = 0;
    const ok = (id, result) => frame.contentWindow && frame.contentWindow.postMessage({ alaisai: 1, id, ok: true, result }, '*');
    const fail = (id, error) => frame.contentWindow && frame.contentWindow.postMessage({ alaisai: 1, id, ok: false, error }, '*');
    const KEY = /^[\w.:-]{1,64}$/, BAD = ['__proto__', 'constructor', 'prototype'];
    const bucket = () => { const d = Store.db.appData; if (!Object.prototype.hasOwnProperty.call(d, ns)) d[ns] = {}; return d[ns]; };
    const handler = (e) => {
      if (e.source !== frame.contentWindow) return;
      const m = e.data;
      if (!m || m.alaisai !== 1 || typeof m.op !== 'string' || !Number.isInteger(m.id)) return;
      const a = Array.isArray(m.args) ? m.args : [];
      try {
        if (m.op === 'toast') {
          const now = Date.now(); if (now - last > 1000) { last = now; burst = 0; }
          if (++burst > 3) return fail(m.id, 'كثرة الإشعارات');
          UI.toast(String(a[0] || '').slice(0, 200), 'info'); return ok(m.id, true);
        }
        if (m.op === 'escape') { if (!document.querySelector('#dialog-root .dialog')) OS.closeStage(); return ok(m.id, true); }
        if (m.op === 'keys') return ok(m.id, Object.keys(Store.db.appData[ns] || {}));
        const key = a[0];
        if (typeof key !== 'string' || !KEY.test(key) || BAD.includes(key)) return fail(m.id, 'مفتاح غير صالح');
        if (m.op === 'get') { const d = Store.db.appData[ns]; return ok(m.id, d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : null); }
        if (m.op === 'remove') { const d = Store.db.appData[ns]; if (d) { delete d[key]; Store.save(); } return ok(m.id, true); }
        if (m.op === 'set') {
          const val = a[1];
          if (typeof val !== 'string') return fail(m.id, 'قيمة غير صالحة');
          const d = bucket(), old = Object.prototype.hasOwnProperty.call(d, key) ? d[key] : '';
          if (Store.appDataSize(ns) - old.length + val.length + (old ? 0 : key.length) > Store.MAX_APPDATA) return fail(m.id, 'تجاوزت مساحة التخزين المسموحة (256KB)');
          if (!old && Object.keys(d).length >= 200) return fail(m.id, 'عدد المفاتيح كبير');
          d[key] = val; Store.save(); return ok(m.id, true);
        }
        fail(m.id, 'عملية غير معروفة');
      } catch (err) { fail(m.id, 'خطأ داخلي'); }
    };
    window.addEventListener('message', handler);
    Viewer.cleanups.push(() => window.removeEventListener('message', handler));
  };

  // يشغّل مستنداً كاملاً داخل iframe معزول (بلا allow-same-origin) مع الجسر
  Viewer.runDoc = (el, { title, doc, ns }) => {
    const f = document.createElement('iframe');
    f.className = 'app-frame';
    f.title = title;
    f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads');
    f.referrerPolicy = 'no-referrer';
    f.srcdoc = doc;
    el.appendChild(f);
    Viewer.bridge(f, ns, title);
    return f;
  };

  Viewer.env = () => ({ theme: document.documentElement.dataset.theme || 'dark', lang: 'ar', dir: 'rtl' });
  const HEAD = (extra = '') => '<!doctype html><html lang="ar" dir="rtl" data-theme="' + Viewer.env().theme + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">' +
    '<script>' + Viewer.preamble(Viewer.env()) + '<\/script>' +
    '<style>body{font-family:system-ui,sans-serif;color:#222}</style>' + extra + '</head>';
  Viewer.head = HEAD;

  // ---- كود HTML من المستخدم: معزول تماماً ----
  Viewer.html = (app, el) => {
    Viewer.runDoc(el, { title: app.name, ns: app.id, doc: HEAD() + '<body>' + app.content + '</body></html>' });
  };

  // ---- المتصفح ----
  Viewer.normalizeUrl = (s) => {
    s = String(s || '').trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    let u; try { u = new URL(s); } catch (_) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.origin === location.origin) return null; // لا نضمّن موقعنا نفسه
    return u.href;
  };

  Viewer.url = (app, el) => {
    el.innerHTML = '<div class="browser"><form class="browser-bar"><input class="field" type="text" inputmode="url" aria-label="العنوان" placeholder="https://example.com">' +
      '<button class="btn btn-primary" type="submit">اذهب</button><a class="btn" target="_blank" rel="noopener noreferrer" data-ext>↗ فتح في تبويب</a></form>' +
      '<div class="browser-hint">ملاحظة: كثير من المواقع (مثل Bing وGoogle) تمنع عرضها داخل إطار؛ استخدم «فتح في تبويب» إن ظهرت الصفحة فارغة.</div>' +
      '<div style="flex:1;min-height:0"></div></div>';
    const form = el.querySelector('form'), input = form.querySelector('input'), ext = form.querySelector('[data-ext]');
    const holder = el.querySelector('.browser > div:last-child');
    const go = (raw) => {
      const url = Viewer.normalizeUrl(raw);
      if (!url) { UI.toast('رابط غير صالح (يُسمح بـ http/https فقط)', 'error'); return; }
      input.value = url; ext.href = url;
      holder.innerHTML = '';
      const f = document.createElement('iframe');
      f.className = 'app-frame'; f.title = app.name; f.referrerPolicy = 'no-referrer'; f.loading = 'lazy';
      // الموقع الخارجي بأصل مختلف عن أصلنا، لذا allow-same-origin آمن هنا
      f.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-same-origin allow-downloads allow-modals');
      f.src = url;
      holder.appendChild(f);
      if (app.content !== url) { app.content = url; Store.save(); }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); go(input.value); });
    go(app.content || 'https://www.wikipedia.org');
  };

  // ---- دفتر الملاحظات (متعدد + بحث + حفظ تلقائي) ----
  Viewer.notes = (app, el) => {
    const db = Store.db;
    let curId = null, q = '', saveTimer = null;
    el.innerHTML = '<div class="notes"><aside class="notes-side"><div class="notes-tools">' +
      '<input class="field" type="search" data-q placeholder="🔍 بحث في الملاحظات" aria-label="بحث"><button class="btn btn-primary btn-sm" data-new>➕ جديدة</button></div>' +
      '<ul class="notes-list" role="listbox" aria-label="الملاحظات"></ul></aside>' +
      '<section class="notes-main"><input class="field note-title" data-title placeholder="العنوان" maxlength="120" aria-label="عنوان الملاحظة">' +
      '<textarea class="field note-body" data-body placeholder="اكتب ملاحظاتك هنا..." aria-label="نص الملاحظة"></textarea>' +
      '<div class="notes-foot"><span data-state></span><span class="sp"></span><span data-count></span>' +
      '<button class="btn btn-danger btn-sm" data-del>🗑 حذف</button></div></section></div>';
    const $ = (s) => el.querySelector(s);
    const list = $('.notes-list'), title = $('[data-title]'), body = $('[data-body]'), state = $('[data-state]');

    const cur = () => db.notes.find((n) => n.id === curId);
    const label = (n) => n.title.trim() || n.body.trim().split('\n')[0].slice(0, 40) || 'ملاحظة فارغة';
    const fmt = (t) => new Date(t).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });

    function renderList() {
      const s = q.trim().toLowerCase();
      const items = db.notes.filter((n) => !s || (n.title + '\n' + n.body).toLowerCase().includes(s)).sort((a, b) => b.updated - a.updated);
      list.innerHTML = items.length ? '' : `<li style="cursor:default;color:var(--muted)">${s ? 'لا نتائج' : 'لا توجد ملاحظات بعد'}</li>`;
      items.forEach((n) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option'); li.tabIndex = 0;
        li.setAttribute('aria-selected', n.id === curId);
        li.innerHTML = '<span class="t"></span><small></small>';
        li.firstChild.textContent = label(n); li.lastChild.textContent = fmt(n.updated);
        const open = () => select(n.id);
        li.addEventListener('click', open);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        list.appendChild(li);
      });
    }
    function select(id) {
      curId = id; const n = cur();
      title.disabled = body.disabled = !n;
      title.value = n ? n.title : ''; body.value = n ? n.body : '';
      $('[data-del]').disabled = !n; state.textContent = '';
      $('[data-count]').textContent = n ? `${n.body.length} حرف` : '';
      renderList();
    }
    function touch() {
      const n = cur(); if (!n) return;
      n.title = title.value; n.body = body.value; n.updated = Date.now();
      $('[data-count]').textContent = `${n.body.length} حرف`;
      state.textContent = '⏳ جارٍ الحفظ…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => Store.save().then(() => { state.textContent = '✅ تم الحفظ'; renderList(); }), 500);
    }
    title.addEventListener('input', touch); body.addEventListener('input', touch);
    $('[data-q]').addEventListener('input', (e) => { q = e.target.value; renderList(); });
    $('[data-new]').addEventListener('click', () => {
      if (db.notes.length >= 2000) return UI.toast('بلغت الحد الأقصى للملاحظات', 'warn');
      const n = { id: Store.rid(), title: '', body: '', updated: Date.now() };
      db.notes.push(n); Store.save(); select(n.id); title.focus();
    });
    $('[data-del]').addEventListener('click', async () => {
      const n = cur(); if (!n) return;
      if (!(await UI.confirm(`حذف الملاحظة «${label(n)}» نهائياً؟`, { okText: 'حذف' }))) return;
      db.notes = db.notes.filter((x) => x.id !== n.id); Store.save();
      select(db.notes.slice().sort((a, b) => b.updated - a.updated)[0]?.id || null);
    });
    const first = db.notes.slice().sort((a, b) => b.updated - a.updated)[0];
    select(first ? first.id : null);
  };

  Viewer.mount = (app, el) => { Viewer.unmount(); return ({ html: Viewer.html, url: Viewer.url, notes: Viewer.notes, addon: Viewer.addon }[app.type] || Viewer.html)(app, el); };
  window.Viewer = Viewer;
})();
