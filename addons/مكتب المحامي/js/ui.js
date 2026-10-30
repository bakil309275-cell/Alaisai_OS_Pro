'use strict';
/* ===== أيقونات ===== */
const IC = {
  today: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="1.5"/>',
  cases: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c2 .8 3.5 2.8 3.5 5.6"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.9-2.5.9-2.5 2 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0 4.8 4.8L21 13l-8 8-3-3 8-8M3 21l5-5"/><path d="M8 3l3 3-2 2-3-3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>',
  scale: '<path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ===== نماذج ===== */
function fieldHTML(f, v) {
  const val = v == null ? (f.v == null ? '' : f.v) : v;
  const id = 'f_' + f.n, req = f.req ? ' required' : '', ph = f.ph ? ` placeholder="${E(f.ph)}"` : '';
  let ctl;
  if (f.t === 'textarea') ctl = `<textarea id="${id}" name="${f.n}" rows="${f.rows || 3}"${ph}${req}>${E(val)}</textarea>`;
  else if (f.t === 'select') ctl = `<select id="${id}" name="${f.n}"${req}>${(f.o || []).map((o) => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${E(k)}"${String(k) === String(val) ? ' selected' : ''}>${E(l)}</option>`; }).join('')}</select>`;
  else if (f.t === 'number') ctl = `<input id="${id}" name="${f.n}" type="text" inputmode="decimal" value="${E(val)}"${ph}${req} autocomplete="off">`;
  else ctl = `<input id="${id}" name="${f.n}" type="${f.t || 'text'}" value="${E(val)}"${ph}${req} autocomplete="off"${f.t === 'tel' ? ' dir="ltr" inputmode="tel"' : ''}>`;
  return `<label class="fld${f.half ? ' half' : ''}" for="${id}"><span>${E(f.l)}${f.req ? '' : ''}</span>${ctl}${f.hint ? `<small>${E(f.hint)}</small>` : ''}</label>`;
}

let sheetEl = null, lastFocus = null;
function sheet(title, html, opt = {}) {
  closeSheet();
  lastFocus = document.activeElement;
  const root = $('#sheet-root');
  root.innerHTML = `<div class="veil" data-close></div><section class="sheet${opt.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${E(title)}"><header><h2>${E(title)}</h2><button class="icon" data-close aria-label="إغلاق">${ic('x')}</button></header><div class="sheet-body">${html}</div></section>`;
  sheetEl = root.lastElementChild;
  document.body.classList.add('sheeted');
  root.addEventListener('click', onSheetClick);
  const first = $('input:not([type=hidden]),textarea,select', sheetEl); if (first && !opt.noFocus) setTimeout(() => first.focus({ preventScroll: true }), 60);
  return sheetEl;
}
function onSheetClick(e) { if (e.target.closest('[data-close]')) closeSheet(); }
function closeSheet() {
  const root = $('#sheet-root'); root.innerHTML = ''; root.removeEventListener('click', onSheetClick); sheetEl = null;
  document.body.classList.remove('sheeted');
  if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* لا شيء */ }
  lastFocus = null;
}
function form(title, fields, values, onSave, opt = {}) {
  const el = sheet(title, `<form class="frm" novalidate>${fields.map((f) => fieldHTML(f, values && values[f.n])).join('')}${opt.live ? '<p class="live" aria-live="polite"></p>' : ''}<div class="actions">${opt.del ? `<button type="button" class="btn danger" data-del>${E(opt.delLabel || 'حذف')}</button>` : ''}<span class="grow"></span><button type="button" class="btn quiet" data-close>إلغاء</button><button type="submit" class="btn pri">${E(opt.ok || 'حفظ')}</button></div></form>`);
  const f = $('form', el);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const out = {}; let bad = null;
    for (const d of fields) { const c = f.elements[d.n]; let v = c.value.trim(); if (d.t === 'number') v = v === '' ? '' : String(num(v)); out[d.n] = v; if (d.req && !v && !bad) bad = c; }
    if (bad) { bad.classList.add('bad'); bad.focus(); toast('أكمل الحقل المطلوب'); return; }
    closeSheet(); onSave(out);
  });
  f.addEventListener('input', (e) => e.target.classList.remove('bad'));
  if (opt.live) { const L = $('.live', el), upd = () => { const o = {}; for (const d of fields) { const c = f.elements[d.n]; o[d.n] = d.t === 'number' ? String(num(c.value)) : c.value; } L.textContent = opt.live(o); }; f.addEventListener('input', upd); upd(); }
  const del = $('[data-del]', el); if (del) del.addEventListener('click', async () => { if (await ask(opt.delMsg || 'سيُحذف نهائياً. متأكد؟', opt.delLabel || 'حذف')) { closeSheet(); opt.onDel(); } });
  return el;
}
function ask(msg, okLabel = 'تأكيد') {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'ask';
    d.innerHTML = `<div class="veil"></div><div class="box" role="alertdialog" aria-label="${E(msg)}"><p>${E(msg)}</p><div class="actions"><span class="grow"></span><button class="btn quiet" data-n>إلغاء</button><button class="btn danger" data-y>${E(okLabel)}</button></div></div>`;
    document.body.appendChild(d);
    const done = (v) => { d.remove(); res(v); };
    $('[data-y]', d).onclick = () => done(true); $('[data-n]', d).onclick = () => done(false); $('.veil', d).onclick = () => done(false);
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } });
    $('[data-n]', d).focus();
  });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetEl) { e.preventDefault(); closeSheet(); } });

/* ===== تنزيل وطباعة ===== */
function download(name, text, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function printHTML(html) {
  const a = $('#print-area'); a.innerHTML = html; document.body.classList.add('printing');
  setTimeout(() => { try { window.print(); } catch (e) { toast('تعذّرت الطباعة من هذه الشاشة، نزّل الملف بدلاً منها'); } setTimeout(() => { document.body.classList.remove('printing'); a.innerHTML = ''; }, 400); }, 80);
}
const letterhead = () => `<div class="lh"><div><strong>${E(DB.s.office || DB.s.lawyer || 'مكتب المحاماة')}</strong>${DB.s.office && DB.s.lawyer ? `<span>${E(DB.s.lawyer)}</span>` : ''}</div><div class="lh-r">${DB.s.phone ? `<span dir="ltr">${E(DB.s.phone)}</span>` : ''}${DB.s.city ? `<span>${E(DB.s.city)}</span>` : ''}</div></div>`;
