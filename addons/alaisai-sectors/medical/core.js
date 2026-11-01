/* AlCore — النواة المشتركة لإضافات قطاعات العيسائي برو
 * بلا اعتماديات. تعمل داخل صندوق الإضافات (iframe) عبر جسر Alaisai،
 * ومع بديل في الذاكرة عند التشغيل خارج التطبيق (للتجربة والاختبار).
 */
(function (root) {
  'use strict';

  /* ---------- أدوات نصية ورقمية ---------- */
  const DIAC = /[\u064B-\u065F\u0670\u0640]/g;
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(DIAC, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d))
      .replace(/\s+/g, ' ')
      .trim();
  }

  function num(x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    const t = String(x == null ? '' : x)
      .replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d))
      .replace(/[٬,\s]/g, '')
      .replace(/٫/g, '.');
    const n = parseFloat(t);
    return isFinite(n) ? n : 0;
  }

  function fmt(n) {
    return num(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- حساب مالي: المتفق عليه / المدفوع / المتبقي ---------- */
  function finance(agreed, paid) {
    const a = num(agreed), p = num(paid), r = Math.round((a - p) * 100) / 100;
    return { agreed: a, paid: p, remaining: r, state: r === 0 ? 'settled' : r < 0 ? 'over' : 'due' };
  }

  function sumFinance(rows) {
    return rows.reduce((t, x) => {
      const f = finance(x.agreed, x.paid);
      t.agreed += f.agreed; t.paid += f.paid; t.remaining += f.remaining;
      return t;
    }, { agreed: 0, paid: 0, remaining: 0 });
  }

  /* ---------- بحث عربي ذكي (يتجاهل التشكيل والهمزات والتاء المربوطة) ---------- */
  function matches(haystack, query) {
    const q = norm(query);
    if (!q) return true;
    const h = norm(haystack);
    return q.split(' ').every(t => h.includes(t));
  }

  function search(items, query, textFn) {
    return items.filter(it => matches(textFn(it), query));
  }

  /* ---------- DOM ---------- */
  const D = root.document;

  function h(tag, attrs, ...kids) {
    const el = D.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled') el[k] = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    (function add(list) {
      list.forEach(c => {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.append(c.nodeType ? c : D.createTextNode(String(c)));
      });
    })(kids);
    return el;
  }

  function toast(msg) {
    const B = root.Alaisai;
    if (B && B.toast) { try { B.toast(msg); return; } catch (e) { /* fall through */ } }
    D.querySelectorAll('.al-toast').forEach(x => x.remove());
    const t = h('div', { class: 'al-toast', role: 'status', text: msg });
    D.body.append(t);
    setTimeout(() => t.remove(), 2400);
  }

  function modal(title, body, buttons) {
    const ov = h('div', { class: 'al-ov', onclick: e => { if (e.target === ov) close(); } });
    function close() { ov.remove(); }
    const foot = h('div', { class: 'al-mf' }, (buttons || []).map(b =>
      h('button', {
        class: 'al-btn ' + (b.cls || ''), type: 'button', text: b.text,
        onclick: async () => { if (b.fn) { const r = await b.fn(); if (r === false) return; } close(); }
      })));
    const box = h('div', { class: 'al-modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'al-mh' }, h('b', { text: title }),
        h('button', { class: 'al-x', type: 'button', 'aria-label': 'إغلاق', onclick: close, text: '✕' })),
      h('div', { class: 'al-mb' }, body),
      (buttons && buttons.length) ? foot : null);
    ov.append(box);
    D.body.append(ov);
    return { close, el: box };
  }

  function confirmBox(msg) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (!done) { done = true; res(v); } };
      const m = modal('تأكيد', h('p', { text: msg }), [
        { text: 'نعم', cls: 'danger', fn: () => fin(true) },
        { text: 'إلغاء', cls: 'ghost', fn: () => fin(false) }
      ]);
      m.el.parentNode.addEventListener('click', e => { if (e.target === m.el.parentNode) fin(false); });
    });
  }

  /* ---------- مشاركة / نسخ / طباعة ---------- */
  async function copyText(text) {
    try { await root.navigator.clipboard.writeText(text); toast('تم النسخ'); return true; }
    catch (e) {
      try {
        const ta = h('textarea', { value: text, style: 'position:fixed;opacity:0' });
        D.body.append(ta); ta.select(); D.execCommand('copy'); ta.remove(); toast('تم النسخ'); return true;
      } catch (e2) { toast('تعذّر النسخ'); return false; }
    }
  }

  async function shareText(title, text) {
    const n = root.navigator;
    if (n && n.share) { try { await n.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    await copyText(text);
  }

  function printHtml(title, bodyHtml) {
    const old = D.getElementById('al-print'); if (old) old.remove();
    const area = h('div', { id: 'al-print', dir: 'rtl' });
    area.innerHTML = '<h2>' + esc(title) + '</h2>' + bodyHtml; // المحتوى مُهرَّب بـ esc من جهتنا
    D.body.append(area);
    D.body.classList.add('al-printing');
    const clean = () => { D.body.classList.remove('al-printing'); area.remove(); };
    try { root.addEventListener('afterprint', clean, { once: true }); root.print(); setTimeout(clean, 1500); }
    catch (e) { clean(); toast('الطباعة غير متاحة هنا'); }
  }

  /* ---------- الصور ---------- */
  function pickImage(max) {
    return new Promise((res, rej) => {
      const inp = h('input', { type: 'file', accept: 'image/*' });
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return res(null);
        const fr = new root.FileReader();
        fr.onload = () => {
          const im = new root.Image();
          im.onload = () => {
            const s = Math.min(1, (max || 512) / Math.max(im.width, im.height));
            const c = D.createElement('canvas');
            c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            res(c.toDataURL('image/jpeg', 0.8));
          };
          im.onerror = () => rej(new Error('bad image'));
          im.src = fr.result;
        };
        fr.readAsDataURL(f);
      };
      inp.click();
    });
  }

  function avatar(rec, size) {
    const s = size || 44;
    const st = 'width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s / 2.4) + 'px';
    if (rec && rec.avatar) return h('img', { class: 'al-av', src: rec.avatar, alt: '', style: st });
    return h('span', { class: 'al-av', style: st, text: ((rec && rec.name) || '؟').trim().charAt(0) });
  }

  function splash(imgSrc, title, ms) {
    const ov = h('div', { class: 'al-splash' }, h('img', { src: imgSrc, alt: '' }), title ? h('h2', { text: title }) : null);
    D.body.append(ov);
    const go = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 500); };
    ov.addEventListener('click', go);
    setTimeout(go, ms || 2600);
  }

  /* ---------- التخزين (جسر Alaisai مع بديل الذاكرة) ---------- */
  function makeStore(ns) {
    const mem = {};
    let chain = Promise.resolve();
    const key = k => ns + '.' + k;

    async function rd(k) {
      const B = root.Alaisai; let v;
      if (B && B.get) v = await B.get(key(k)); else v = mem[k];
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* نص عادي */ } }
      return v;
    }
    async function wr(k, v) {
      const B = root.Alaisai;
      if (B && B.set) await B.set(key(k), JSON.stringify(v)); else mem[k] = JSON.parse(JSON.stringify(v));
    }
    function queue(fn) { const p = chain.then(fn); chain = p.catch(() => { }); return p; }

    return {
      async list(kind) { const v = await rd(kind); return Array.isArray(v) ? v : []; },
      save(kind, rec) {
        return queue(async () => {
          const all = await this.list(kind);
          const now = Date.now();
          if (rec.id) {
            const i = all.findIndex(x => x.id === rec.id);
            rec.updated = now;
            if (i >= 0) all[i] = rec; else all.push(rec);
          } else { rec.id = uid(); rec.created = now; rec.updated = now; all.push(rec); }
          await wr(kind, all);
          return rec;
        });
      },
      remove(kind, id) {
        return queue(async () => { const all = (await this.list(kind)).filter(x => x.id !== id); await wr(kind, all); });
      },
      get: rd,
      set(k, v) { return queue(() => wr(k, v)); }
    };
  }

  /* ---------- النماذج الديناميكية ---------- */
  const CONTACT_KINDS = [
    ['phone', 'هاتف'], ['whatsapp', 'واتساب'], ['email', 'بريد إلكتروني'],
    ['bank', 'حساب بنكي'], ['facebook', 'فيسبوك'], ['telegram', 'تيليجرام'], ['link', 'رابط آخر']
  ];

  function contactHref(c) {
    const v = String(c.value || '').trim();
    if (c.kind === 'phone') return 'tel:' + v.replace(/[^\d+]/g, '');
    if (c.kind === 'whatsapp') return 'https://wa.me/' + v.replace(/[^\d]/g, '');
    if (c.kind === 'email') return 'mailto:' + v;
    if (c.kind === 'telegram') return /^https?:/i.test(v) ? v : 'https://t.me/' + v.replace(/^@/, '');
    if (c.kind === 'facebook' || c.kind === 'link') return /^https?:\/\//i.test(v) ? v : (v ? 'https://' + v : '');
    return '';
  }

  function contactsWidget(initial) {
    const rows = h('div', { class: 'al-crows' });
    function addRow(c) {
      const sel = h('select', { 'aria-label': 'النوع' }, CONTACT_KINDS.map(k => h('option', { value: k[0], text: k[1] })));
      sel.value = (c && c.kind) || 'phone';
      const inp = h('input', { type: 'text', value: (c && c.value) || '', placeholder: 'القيمة', dir: 'auto', 'aria-label': 'القيمة' });
      const row = h('div', { class: 'al-crow' }, sel, inp,
        h('button', { type: 'button', class: 'al-ib', 'aria-label': 'حذف', text: '🗑', onclick: () => row.remove() }));
      row._get = () => ({ kind: sel.value, value: inp.value.trim() });
      rows.append(row);
    }
    (initial && initial.length ? initial : []).forEach(addRow);
    const el = h('div', { class: 'al-contacts' }, rows,
      h('button', { type: 'button', class: 'al-btn ghost sm', text: '＋ إضافة وسيلة تواصل', onclick: () => addRow() }));
    return { el, get: () => [...rows.children].map(r => r._get()).filter(c => c.value) };
  }

  function imageWidget(initial, max, round) {
    let val = initial || '';
    const prev = h('div', { class: 'al-imgprev' + (round ? ' round' : '') });
    const paint = () => { prev.replaceChildren(val ? h('img', { src: val, alt: '' }) : h('span', { text: 'لا توجد صورة' })); };
    paint();
    const el = h('div', { class: 'al-img' }, prev, h('div', { class: 'al-imgbtns' },
      h('button', {
        type: 'button', class: 'al-btn ghost sm', text: 'اختيار صورة',
        onclick: async () => { try { const v = await pickImage(max); if (v) { val = v; paint(); } } catch (e) { toast('تعذّر قراءة الصورة'); } }
      }),
      h('button', { type: 'button', class: 'al-btn ghost sm', text: 'إزالة', onclick: () => { val = ''; paint(); } })));
    return { el, get: () => val };
  }

  /* schema: [{key,label,type,options,req,wide,compute,max,round}]
     types: text|textarea|number|date|datetime-local|select|checkbox|image|contacts|computed */
  function form(schema, vals) {
    vals = vals || {};
    const getters = {}, computed = [];
    const box = h('div', { class: 'al-form' });
    const read = () => { const o = {}; for (const k in getters) o[k] = getters[k](); return o; };
    const refresh = () => { const cur = read(); computed.forEach(c => { c.el.textContent = c.fn(cur); }); };

    schema.forEach(f => {
      const lab = h('span', { class: 'al-lab', text: f.label + (f.req ? ' *' : '') });
      const wideCls = f.wide ? ' wide' : '';
      if (f.type === 'contacts') {
        const w = contactsWidget(vals[f.key]); getters[f.key] = w.get;
        box.append(h('div', { class: 'al-row wide' }, lab, w.el)); return;
      }
      if (f.type === 'image') {
        const w = imageWidget(vals[f.key], f.max, f.round); getters[f.key] = w.get;
        box.append(h('div', { class: 'al-row wide' }, lab, w.el)); return;
      }
      if (f.type === 'computed') {
        const out = h('output', { class: 'al-computed' });
        computed.push({ el: out, fn: f.compute });
        box.append(h('div', { class: 'al-row' + wideCls }, lab, out)); return;
      }
      let input;
      if (f.type === 'select') {
        const opts = (typeof f.options === 'function' ? f.options() : f.options) || [];
        input = h('select', {}, opts.map(o => { const a = Array.isArray(o) ? o : [o, o]; return h('option', { value: a[0], text: a[1] }); }));
        const first = opts.length ? (Array.isArray(opts[0]) ? opts[0][0] : opts[0]) : '';
        input.value = vals[f.key] != null ? vals[f.key] : first;
        getters[f.key] = () => input.value;
      } else if (f.type === 'textarea') {
        input = h('textarea', { rows: 3, value: vals[f.key] || '' });
        getters[f.key] = () => input.value.trim();
      } else if (f.type === 'checkbox') {
        input = h('input', { type: 'checkbox', checked: !!vals[f.key] });
        getters[f.key] = () => input.checked;
      } else if (f.type === 'number') {
        input = h('input', { type: 'text', inputmode: 'decimal', value: vals[f.key] != null && vals[f.key] !== '' ? String(vals[f.key]) : '' });
        getters[f.key] = () => (input.value.trim() === '' ? '' : num(input.value));
      } else {
        input = h('input', { type: f.type || 'text', value: vals[f.key] || '', dir: 'auto' });
        getters[f.key] = () => input.value.trim();
      }
      input.addEventListener('input', refresh);
      input.addEventListener('change', refresh);
      box.append(h('label', { class: 'al-row' + wideCls + (f.type === 'checkbox' ? ' chk' : '') }, lab, input));
    });
    refresh();
    return {
      el: box,
      get: read,
      missing() { return schema.filter(f => f.req && (getters[f.key]() === '' || getters[f.key]() == null)).map(f => f.label); }
    };
  }

  /* ---------- عرض سجل كنص (للنسخ والمشاركة والطباعة) ---------- */
  function fieldValueText(f, v) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
    if (f.type === 'image' || f.type === 'computed') return '';
    if (f.type === 'checkbox') return v ? 'نعم' : 'لا';
    if (f.type === 'select') {
      const opts = (typeof f.options === 'function' ? f.options() : f.options) || [];
      const m = opts.find(o => (Array.isArray(o) ? o[0] : o) === v);
      return m ? (Array.isArray(m) ? m[1] : m) : String(v);
    }
    if (f.type === 'contacts') {
      return v.map(c => (CONTACT_KINDS.find(k => k[0] === c.kind) || [0, c.kind])[1] + ': ' + c.value).join(' | ');
    }
    if (f.type === 'number') return fmt(v);
    return String(v);
  }

  function recordLines(schema, rec) {
    const out = [];
    schema.forEach(f => {
      if (f.type === 'computed') { const t = f.compute(rec); if (t) out.push([f.label, t]); return; }
      const t = fieldValueText(f, rec[f.key]);
      if (t) out.push([f.label, t]);
    });
    return out;
  }

  /* ---------- مجموعة سجلات كاملة (قائمة + إضافة/عرض/تعديل/حذف + قائمة ⋮) ----------
     cfg: {store, kind, label, singular, schema, card(rec)->{title,sub,badge,lines[]},
           filterKey, filterOptions, onChange(list), emptyText} */
  function collection(cfg) {
    let items = [], query = '', filter = '';
    const listEl = h('div', { class: 'al-list' });
    const countEl = h('span', { class: 'al-count' });
    const fsel = cfg.filterKey ? h('select', { class: 'al-filter', 'aria-label': 'تصفية', onchange: e => { filter = e.target.value; render(); } },
      h('option', { value: '', text: 'الكل' }), cfg.filterOptions.map(o => h('option', { value: o[0], text: o[1] }))) : null;
    const el = h('section', { class: 'al-coll' },
      h('div', { class: 'al-tb' }, h('b', { text: cfg.label }), countEl, fsel,
        h('button', { type: 'button', class: 'al-btn', text: '＋ ' + cfg.singular, onclick: () => edit() })),
      listEl);

    const textOf = r => [recordLines(cfg.schema, r).map(x => x[1]).join(' '), cfg.extraText ? cfg.extraText(r) : ''].join(' ');
    const recText = r => cfg.singular + '\n' + recordLines(cfg.schema, r).map(x => x[0] + ': ' + x[1]).join('\n');
    const visible = () => items
      .filter(r => (!filter || r[cfg.filterKey] === filter) && matches(textOf(r), query))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));

    async function load() { items = await cfg.store.list(cfg.kind); render(); if (cfg.onChange) cfg.onChange(items); }

    function view(r) {
      const lines = recordLines(cfg.schema, r);
      const body = h('div', { class: 'al-view' },
        r.avatar ? h('div', { class: 'al-vtop' }, avatar(r, 72)) : null,
        h('dl', {}, lines.map(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])));
      (cfg.schema.filter(f => f.type === 'image' && r[f.key])).forEach(f => {
        if (f.round) return;
        body.append(h('p', { class: 'al-lab', text: f.label }), h('img', { class: 'al-bigimg', src: r[f.key], alt: '' }));
      });
      (cfg.schema.filter(f => f.type === 'contacts')).forEach(f => {
        const cs = (r[f.key] || []).filter(c => contactHref(c));
        if (cs.length) body.append(h('div', { class: 'al-links' }, cs.map(c =>
          h('a', { class: 'al-btn ghost sm', href: contactHref(c), target: '_blank', rel: 'noopener', text: (CONTACT_KINDS.find(k => k[0] === c.kind) || [0, c.kind])[1] }))));
      });
      if (cfg.mapKey && r[cfg.mapKey]) {
        body.append(h('div', { class: 'al-links' }, h('a', { class: 'al-btn ghost sm', href: r[cfg.mapKey], target: '_blank', rel: 'noopener', text: '📍 فتح الخريطة' })));
      }
      modal(cfg.singular, body, [{ text: 'إغلاق', cls: 'ghost' }]);
    }

    function edit(r) {
      const isNew = !r;
      const f = form(cfg.schema, r || (cfg.defaults ? cfg.defaults() : {}));
      modal((isNew ? 'إضافة ' : 'تعديل ') + cfg.singular, f.el, [
        {
          text: 'حفظ', fn: async () => {
            const miss = f.missing();
            if (miss.length) { toast('أكمل الحقول: ' + miss.join('، ')); return false; }
            const rec = Object.assign({}, r || { vis: 'private', hidden: false }, f.get());
            await cfg.store.save(cfg.kind, rec); await load(); toast('تم الحفظ');
          }
        },
        { text: 'إلغاء', cls: 'ghost' }]);
    }

    async function del(r) {
      if (!(await confirmBox('حذف هذا العنصر نهائياً؟'))) return;
      await cfg.store.remove(cfg.kind, r.id); await load(); toast('تم الحذف');
    }

    async function patch(r, p) { await cfg.store.save(cfg.kind, Object.assign({}, r, p)); await load(); }

    function menu(r, anchor) {
      const old = D.querySelector('.al-menu'); if (old) old.remove();
      const close = () => m.remove();
      const item = (t, fn) => h('button', { type: 'button', text: t, onclick: () => { close(); fn(); } });
      const m = h('div', { class: 'al-menu' },
        item('📋 نسخ', () => copyText(recText(r))),
        item('🖨 طباعة', () => printHtml(cfg.singular, '<dl>' + recordLines(cfg.schema, r).map(x => '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>').join('') + '</dl>')),
        item('📤 مشاركة', () => shareText(cfg.singular, recText(r))),
        item(r.vis === 'public' ? '🔒 جعله خاصاً' : '🌐 نشر عام', () => patch(r, { vis: r.vis === 'public' ? 'private' : 'public' })),
        item(r.hidden ? '👁 إظهار' : '🙈 إخفاء', () => patch(r, { hidden: !r.hidden })));
      anchor.parentNode.append(m);
      setTimeout(() => D.addEventListener('click', close, { once: true }), 0);
    }

    function card(r) {
      const c = cfg.card(r);
      const more = h('button', { type: 'button', class: 'al-ib', 'aria-label': 'المزيد', text: '⋮' });
      more.addEventListener('click', e => { e.stopPropagation(); menu(r, more); });
      return h('article', { class: 'al-card' + (r.hidden ? ' dim' : '') },
        h('div', { class: 'al-ch' }, avatar(Object.assign({ name: c.title }, r), 44),
          h('div', { class: 'al-ct' }, h('b', { text: c.title }), c.sub ? h('small', { text: c.sub }) : null),
          c.badge ? h('span', { class: 'al-badge ' + (c.badgeCls || ''), text: c.badge }) : null,
          r.vis === 'public' ? h('span', { class: 'al-badge pub', text: 'عام' }) : null,
          r.hidden ? h('span', { class: 'al-badge', text: 'مخفي' }) : null),
        (c.lines && c.lines.length) ? h('ul', { class: 'al-cl' }, c.lines.filter(Boolean).map(t => h('li', { text: t }))) : null,
        h('div', { class: 'al-ca' },
          h('button', { type: 'button', class: 'al-ib', 'aria-label': 'عرض', text: '👁', onclick: () => view(r) }),
          h('button', { type: 'button', class: 'al-ib', 'aria-label': 'تعديل', text: '✏️', onclick: () => edit(r) }),
          h('button', { type: 'button', class: 'al-ib', 'aria-label': 'حذف', text: '🗑', onclick: () => del(r) }),
          more));
    }

    function render() {
      const v = visible();
      countEl.textContent = '(' + v.length + ')';
      listEl.replaceChildren(...(v.length ? v.map(card) : [h('p', { class: 'al-empty', text: query || filter ? 'لا نتائج مطابقة' : (cfg.emptyText || 'لا توجد عناصر بعد') })]));
    }

    return {
      el, load,
      setQuery(q) { query = q || ''; render(); },
      count() { return visible().length; },
      all() { return items; }
    };
  }

  root.AlCore = {
    norm, num, fmt, esc, uid, finance, sumFinance, matches, search,
    h, toast, modal, confirmBox, copyText, shareText, printHtml, pickImage, avatar, splash,
    store: makeStore, form, collection, recordLines, contactHref, CONTACT_KINDS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AlCore;
})(typeof window !== 'undefined' ? window : globalThis);
