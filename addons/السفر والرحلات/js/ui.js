'use strict';
/* ===== نماذج ونوافذ ===== */
function fieldHTML(f, v) {
  const val = v == null ? (f.v == null ? '' : f.v) : v, id = 'f_' + f.n, req = f.req ? ' required' : '', ph = f.ph ? ` placeholder="${E(f.ph)}"` : '';
  let ctl;
  if (f.t === 'textarea') ctl = `<textarea id="${id}" name="${f.n}" rows="${f.rows || 3}"${ph}${req}>${E(val)}</textarea>`;
  else if (f.t === 'select') ctl = `<select id="${id}" name="${f.n}"${req}>${(f.o || []).map((o) => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${E(k)}"${String(k) === String(val) ? ' selected' : ''}>${E(l)}</option>`; }).join('')}</select>`;
  else if (f.t === 'number' || f.t === 'money') ctl = `<input id="${id}" name="${f.n}" type="text" inputmode="decimal" value="${E(val)}"${ph}${req} autocomplete="off">`;
  else if (f.o) ctl = `<input id="${id}" name="${f.n}" list="dl_${f.n}" value="${E(val)}"${ph}${req} autocomplete="off"><datalist id="dl_${f.n}">${f.o.map((o) => `<option value="${E(o)}">`).join('')}</datalist>`;
  else ctl = `<input id="${id}" name="${f.n}" type="${f.t === 'tel' || f.t === 'url' ? 'text' : f.t || 'text'}" value="${E(val)}"${ph}${req} autocomplete="off"${f.t === 'tel' ? ' dir="ltr" inputmode="tel"' : f.t === 'url' ? ' dir="ltr" inputmode="url"' : ''}>`;
  return `<label class="fld${f.half ? ' half' : ''}" for="${id}"><span>${E(f.l)}</span>${ctl}${f.hint ? `<small>${E(f.hint)}</small>` : ''}</label>`;
}
let sheetEl = null, lastFocus = null, onSheetClose = null;
function sheet(title, html, opt = {}) {
  closeSheet(); lastFocus = document.activeElement; const root = $('#sheet-root');
  root.innerHTML = `<div class="veil" data-close></div><section class="sheet${opt.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${E(title)}"><header><h2>${E(title)}</h2><button class="icon" data-close aria-label="إغلاق">${ic('x')}</button></header><div class="sheet-body">${html}</div></section>`;
  sheetEl = root.lastElementChild; onSheetClose = opt.onClose || null;
  root.onclick = (e) => { if (e.target.closest('[data-close]')) closeSheet(); };
  const first = $('input:not([type=hidden]):not([type=checkbox]),textarea,select', sheetEl); if (first && !opt.noFocus) setTimeout(() => { if (sheetEl && !sheetEl.contains(document.activeElement)) first.focus({ preventScroll: true }); }, 60);
  return sheetEl;
}
function closeSheet(silent) {
  const cb = onSheetClose; onSheetClose = null; $('#sheet-root').innerHTML = ''; sheetEl = null;
  if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* لا شيء */ } lastFocus = null;
  if (cb && !silent) cb();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetEl) { e.preventDefault(); closeSheet(); } });
function collect(form, fields) {
  const out = {}; let bad = null;
  for (const d of fields) { const c = form.elements[d.n]; if (!c) continue; let v = c.value.trim(); if (d.t === 'number' || d.t === 'money') v = v === '' ? '' : String(num(v)); out[d.n] = v; if (d.req && !v && !bad) bad = c; }
  return { out, bad };
}
function form(title, fields, values, onSave, opt = {}) {
  const el = sheet(title, `<form class="frm" novalidate>${fields.map((f) => fieldHTML(f, values && values[f.n])).join('')}${opt.extra || ''}${opt.live ? '<p class="live" aria-live="polite"></p>' : ''}<div class="actions">${opt.del ? `<button type="button" class="btn danger" data-del>${E(opt.delLabel || 'حذف')}</button>` : ''}<span class="grow"></span><button type="button" class="btn quiet" data-close>إلغاء</button><button type="submit" class="btn pri">${E(opt.ok || 'حفظ')}</button></div></form>`, { onClose: opt.onClose });
  const f = $('form', el);
  f.addEventListener('submit', (e) => { e.preventDefault(); const { out, bad } = collect(f, fields); if (bad) { bad.classList.add('bad'); bad.focus(); return toast('أكمل الحقل المطلوب'); } closeSheet(true); onSave(out, f); });
  f.addEventListener('input', (e) => e.target.classList.remove('bad'));
  if (opt.live) { const L = $('.live', el), upd = () => { const o = {}; for (const d of fields) { const c = f.elements[d.n]; if (c) o[d.n] = (d.t === 'number' || d.t === 'money') ? String(num(c.value)) : c.value; } L.textContent = opt.live(o); }; f.addEventListener('input', upd); upd(); }
  const del = $('[data-del]', el); if (del) del.addEventListener('click', async () => { if (await ask(opt.delMsg || 'سيُحذف نهائياً. متأكد؟', opt.delLabel || 'حذف')) { closeSheet(true); opt.onDel(); } });
  return el;
}
function ask(msg, okLabel = 'تأكيد') {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'ask';
    d.innerHTML = `<div class="veil"></div><div class="box" role="alertdialog" aria-label="${E(msg)}"><p>${E(msg)}</p><div class="actions"><span class="grow"></span><button class="btn quiet" data-n>إلغاء</button><button class="btn danger" data-y>${E(okLabel)}</button></div></div>`;
    document.body.appendChild(d); const done = (v) => { d.remove(); res(v); };
    $('[data-y]', d).onclick = () => done(true); $('[data-n]', d).onclick = () => done(false); $('.veil', d).onclick = () => done(false);
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } }); $('[data-n]', d).focus();
  });
}
/* قائمة الإجراءات (ثلاث نقاط): [{k,l,i,danger}] */
function menu(title, acts) {
  return new Promise((res) => {
    const el = sheet(title, `<div class="menu">${acts.filter(Boolean).map((a) => `<button class="mi${a.danger ? ' danger' : ''}" data-k="${a.k}">${ic(a.i || 'dots')}<span>${E(a.l)}</span></button>`).join('')}</div>`, { noFocus: true, onClose: () => res(null) });
    $$('[data-k]', el).forEach((b) => { b.onclick = () => { closeSheet(true); res(b.dataset.k); }; });
  });
}
function printHTML(html) { const a = $('#print-area'); a.innerHTML = html; document.body.classList.add('printing'); setTimeout(() => { try { window.print(); } catch (e) { toast('تعذّرت الطباعة من هذه الشاشة'); } setTimeout(() => { document.body.classList.remove('printing'); a.innerHTML = ''; }, 400); }, 80); }
const letterhead = () => `<div class="lh">${DB.profile.logo ? `<img src="${E(DB.profile.logo)}" alt="">` : ''}<div><strong>${E(DB.profile.name || CFG.name)}</strong>${DB.profile.kind ? `<span>${E(DB.profile.kind)}</span>` : ''}</div><div class="lh-r">${DB.profile.phones[0] ? `<span dir="ltr">${E(DB.profile.phones[0].v)}</span>` : ''}${addrText() ? `<span>${E(addrText())}</span>` : ''}</div></div>`;
const addrText = () => ['country', 'gov', 'dir', 'iso', 'street'].map((k) => DB.profile.addr[k]).filter(Boolean).join('، ');
