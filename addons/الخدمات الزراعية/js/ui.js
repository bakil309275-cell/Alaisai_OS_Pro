'use strict';
/* ===== نماذج ونوافذ ===== */
function fieldHTML(f, v) {
  let val = v == null ? (f.v == null ? '' : f.v) : v, id = 'f_' + f.n, req = f.req ? ' required' : '', ph = f.ph ? ` placeholder="${E(f.ph)}"` : '';
  let ctl;
  if (f.t === 'select' && !f.blank && val === '') { const o0 = optsOf(f)[0]; if (o0) val = o0[0]; }
  if (f.t === 'textarea') ctl = `<textarea id="${id}" name="${f.n}" rows="${f.rows || 3}"${ph}${req}>${E(val)}</textarea>`;
  else if (f.t === 'select') ctl = `<button type="button" class="pickb" id="${id}" data-pk="${f.n}" aria-haspopup="dialog"><span>${E(optLabel(f, val) || 'اختر…')}</span>${ic('chev')}</button><input type="hidden" name="${f.n}" value="${E(val)}">`;
  else if (f.t === 'number' || f.t === 'money') ctl = `<input id="${id}" name="${f.n}" type="text" inputmode="decimal" value="${E(val)}"${ph}${req} autocomplete="off">`;
  else if (f.o) ctl = `<input id="${id}" name="${f.n}" list="dl_${f.n}" value="${E(val)}"${ph}${req} autocomplete="off"><datalist id="dl_${f.n}">${f.o.map((o) => `<option value="${E(o)}">`).join('')}</datalist>`;
  else ctl = `<input id="${id}" name="${f.n}" type="${f.t === 'tel' || f.t === 'url' ? 'text' : f.t || 'text'}" value="${E(val)}"${ph}${req} autocomplete="off"${f.t === 'tel' ? ' dir="ltr" inputmode="tel"' : f.t === 'url' ? ' dir="ltr" inputmode="url"' : ''}>`;
  return `<label class="fld${f.half ? ' half' : ''}" for="${id}"><span>${E(f.l)}</span>${ctl}${f.hint ? `<small>${E(f.hint)}</small>` : ''}</label>`;
}
/* ===== القوائم المنسدلة القابلة للتعديل: اختيار + تعديل + حذف + إضافة ===== */
const optKey = (f) => f.key || f.n;
const SEP = ' › ', MAXLV = 5; /* قوائم هرمية حتى 5 مستويات: القيمة المخزّنة هي المسار كاملاً بين › */
const nodeOf = (x) => (typeof x === 'string' ? { n: x, c: [] } : { n: String(x.n), c: (x.c || []).map(nodeOf) });
const nodeOut = (x) => (x.c.length ? { n: x.n, c: x.c.map(nodeOut) } : x.n);
const baseOf = (f) => (f.o || []).map((o) => (Array.isArray(o) ? o.slice(0, 2) : [o, o]));
function userTree(f) { const c = DB.opts[optKey(f)]; if (Array.isArray(c)) return c.map(nodeOf); return f.fix ? [] : baseOf(f).map((b) => ({ n: String(b[1]), c: [] })); }
function flatTree(nodes, pre, lv, out, ip) { nodes.forEach((n, i) => { const id = ip.concat(i), p = pre ? pre + SEP + n.n : n.n; out.push({ p, n: n.n, lv, id, kids: n.c.length }); flatTree(n.c, p, lv + 1, out, id); }); return out; }
const inPath = (v, p) => v === p || String(v).indexOf(p + SEP) === 0;
function optsOf(f) { /* [قيمة، نص، مقفل؟] مسطّحة بترتيب الشجرة */
  const L = f.fix ? baseOf(f).map((x) => [x[0], x[1], 1]) : [];
  return L.concat(flatTree(userTree(f), '', 1, [], []).map((r) => [r.p, r.p]));
}
const optLabel = (f, v) => { const o = optsOf(f).find((x) => String(x[0]) === String(v)); return o ? o[1] : v; };
const optValues = (f) => optsOf(f).map((o) => o[0]);
function nodeAt(tree, id) { let arr = tree, n = null; for (let k = 0; k < id.length; k++) { n = arr[id[k]]; if (!n) return null; if (k < id.length - 1) arr = n.c; } return n; }
function parentArr(tree, id) { return id.length < 2 ? tree : nodeAt(tree, id.slice(0, -1)).c; }
function openPicker(f, cur, set) {
  const d = document.createElement('div'); d.className = 'ask pk'; let ed = -1, nv = '', under = null; /* under: مسار العقدة التي يُضاف تحتها فرع */
  const lockedN = () => (f.fix ? baseOf(f).length : 0);
  const store = (tree) => { DB.opts[optKey(f)] = tree.map(nodeOut); persist(); };
  const close = () => { d.remove(); };
  const use = (p) => (typeof optUse === 'function' ? optUse(f, p) : 0);
  const open = new Set(); const fold = (p) => { const a = String(p).split(SEP); for (let k = 1; k < a.length; k++) open.add(a.slice(0, k).join(SEP)); }; fold(cur);
  const rowOf = (i) => { const L = optsOf(f), ti = i - lockedN(); return { L, ti, r: ti >= 0 ? flatTree(userTree(f), '', 1, [], [])[ti] : null }; };
  const draw = () => {
    const L = optsOf(f), tr = flatTree(userTree(f), '', 1, [], []), known = L.some((o) => String(o[0]) === String(cur)), custom = Array.isArray(DB.opts[optKey(f)]) && (!f.fix || DB.opts[optKey(f)].length > 0), anyKids = tr.some((r) => r.kids);
    const un = under ? nodeAt(userTree(f), under) : null;
    const rows = L.map((o, i) => [o, i]).filter(([o, i]) => (i < lockedN() || (() => { const a = String(o[0]).split(SEP); for (let k = 1; k < a.length; k++) if (!open.has(a.slice(0, k).join(SEP))) return false; return true; })()));
    d.innerHTML = `<div class="veil"></div><div class="box" role="dialog" aria-label="${E(f.l)}"><h3>${E(f.l)}</h3><ul class="pl" role="tree">${cur && !known ? `<li><button type="button" class="po" data-cur><i class="rd on"></i><span>${E(cur)} <small>(الحالي)</small></span></button></li>` : ''}${rows.map(([o, i]) => {
      const r = i >= lockedN() ? tr[i - lockedN()] : null, sel = String(o[0]) === String(cur);
      if (ed === i) return `<li class="ed" style="--lv:${r ? r.lv - 1 : 0}"><input data-ev value="${E(r ? r.n : o[1])}" maxlength="60" aria-label="الاسم الجديد"><button type="button" class="icon s ok" data-ok="${i}" aria-label="حفظ">${ic('check')}</button><button type="button" class="icon s" data-no aria-label="إلغاء">${ic('x')}</button></li>`;
      const tg = r && r.kids ? `<button type="button" class="tg${open.has(o[0]) ? ' o' : ''}" data-t="${i}" aria-expanded="${open.has(o[0])}" aria-label="${open.has(o[0]) ? 'طيّ' : 'فتح'} ${E(r.n)}">${ic('chev')}</button>` : '<span class="tg0"></span>';
      const sub = r && r.lv < MAXLV ? `<button type="button" class="icon s" data-a="${i}" aria-label="إضافة فرع تحت ${E(r.n)}" title="إضافة فرع">${ic('plus')}</button>` : '';
      return `<li class="tn" role="treeitem" aria-level="${r ? r.lv : 1}" style="--lv:${r ? r.lv - 1 : 0}">${tg}<button type="button" class="po" data-i="${i}" role="radio" aria-checked="${sel}"><i class="rd${sel ? ' on' : ''}"></i><span>${E(r ? r.n : o[1])}</span></button>${o[2] ? `<span class="lk" title="خيار أساسي لا يُعدَّل">${ic('lock')}</span>` : `${sub}<button type="button" class="icon s" data-e="${i}" aria-label="تعديل ${E(o[1])}">${ic('edit')}</button><button type="button" class="icon s dng" data-d="${i}" aria-label="حذف ${E(o[1])}">${ic('trash')}</button>`}</li>`;
    }).join('')}${!L.length ? '<li class="none">القائمة فارغة، أضف خياراً بالأسفل</li>' : ''}</ul>${under ? `<p class="underp">فرع جديد تحت «${E(un ? un.n : '')}» <button type="button" class="btn quiet small" data-nou>إلغاء</button></p>` : ''}<div class="padd"><input data-nv placeholder="${under ? 'اسم الفرع الجديد…' : 'إضافة خيار جديد…'}" maxlength="60" value="${E(nv)}" aria-label="خيار جديد"><button type="button" class="btn pri" data-add>${ic('plus')}إضافة</button></div><div class="actions">${anyKids ? '<button type="button" class="btn quiet small" data-xall>فتح الكل</button><button type="button" class="btn quiet small" data-call>طيّ الكل</button>' : ''}${custom ? '<button type="button" class="btn quiet small" data-reset>استعادة الأصل</button>' : ''}${cur && !f.req ? '<button type="button" class="btn quiet small" data-clr>بدون اختيار</button>' : ''}<span class="grow"></span><button type="button" class="btn quiet" data-x>إغلاق</button></div></div>`;
    const t = ed >= 0 ? $('[data-ev]', d) : null; if (t) { t.focus(); t.select(); } else if (under) { const q = $('[data-nv]', d); if (q) q.focus(); }
  };
  const add = () => {
    const v = ($('[data-nv]', d).value || '').trim(); if (!v) return toast('اكتب الخيار الجديد أولاً');
    if (v.indexOf('›') >= 0) return toast('لا تستخدم الرمز › في الاسم');
    const tree = userTree(f), arr = under ? (nodeAt(tree, under) || {}).c || tree : tree, par = under ? flatTree(tree, '', 1, [], []).find((r) => r.id.join('.') === under.join('.')) : null;
    let ex = arr.find((n) => norm(n.n) === norm(v)); if (!ex) { ex = { n: v, c: [] }; arr.push(ex); store(tree); }
    const path = (par ? par.p + SEP : '') + ex.n;
    if (under) { open.add(par.p); nv = ''; toast('أُضيف الفرع'); return draw(); }
    set(path); close();
  };
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('button,.veil'); if (!b) return;
    if (b.classList.contains('veil') || b.hasAttribute('data-x')) return close();
    if (b.hasAttribute('data-add')) return add();
    if (b.hasAttribute('data-cur')) return close();
    if (b.hasAttribute('data-nou')) { under = null; return draw(); }
    if (b.hasAttribute('data-xall')) { flatTree(userTree(f), '', 1, [], []).forEach((r) => { if (r.kids) open.add(r.p); }); return draw(); }
    if (b.hasAttribute('data-call')) { open.clear(); return draw(); }
    if (b.dataset.t != null) { const p = optsOf(f)[+b.dataset.t][0]; open.has(p) ? open.delete(p) : open.add(p); return draw(); }
    if (b.dataset.a != null) { const { r } = rowOf(+b.dataset.a); if (r) { under = r.id; open.add(r.p); nv = $('[data-nv]', d).value; } return draw(); }
    if (b.dataset.i != null) { set(optsOf(f)[+b.dataset.i][0]); return close(); }
    if (b.dataset.e != null) { nv = $('[data-nv]', d).value; ed = +b.dataset.e; return draw(); }
    if (b.hasAttribute('data-no')) { ed = -1; return draw(); }
    if (b.hasAttribute('data-clr')) { set(''); return close(); }
    if (b.dataset.ok != null) {
      const i = +b.dataset.ok, { r } = rowOf(i), v = ($('[data-ev]', d).value || '').trim();
      if (!r) return; if (!v) return toast('اكتب الاسم'); if (v.indexOf('›') >= 0) return toast('لا تستخدم الرمز › في الاسم');
      const tree = userTree(f), sib = parentArr(tree, r.id), nd = nodeAt(tree, r.id), old = r.p;
      if (v !== r.n && sib.some((x) => x !== nd && norm(x.n) === norm(v))) return toast('هذا الخيار موجود');
      if (v !== r.n) {
        nd.n = v; const np = (r.p.indexOf(SEP) >= 0 ? r.p.slice(0, r.p.lastIndexOf(SEP) + SEP.length) : '') + v; store(tree);
        if (typeof optRename === 'function') optRename(f, old, np);
        if (inPath(String(cur), old)) { cur = np + String(cur).slice(old.length); set(cur); }
        if (open.has(old)) { open.delete(old); open.add(np); }
      }
      ed = -1; return draw();
    }
    if (b.dataset.d != null) {
      const i = +b.dataset.d, { r } = rowOf(i); if (!r) return; const n = use(r.p);
      if (!(await ask('حذف «' + r.n + '»' + (r.kids ? ' مع كل فروعه' : '') + ' من القائمة؟' + (n ? ' هو مستخدم في ' + n + ' سجل وستبقى قيمته فيها.' : ''), 'حذف'))) return;
      const tree = userTree(f), sib = parentArr(tree, r.id); sib.splice(r.id[r.id.length - 1], 1); store(tree);
      if (inPath(String(cur), r.p)) { cur = ''; set(''); }
      return draw();
    }
    if (b.hasAttribute('data-reset')) {
      if (!(await ask('استعادة قائمة «' + f.l + '» الأصلية؟ تُحذف إضافاتك وتعديلاتك على القائمة فقط، وتبقى السجلات.', 'استعادة'))) return;
      delete DB.opts[optKey(f)]; persist(); under = null; return draw();
    }
  });
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (ed >= 0) { ed = -1; draw(); } else if (under) { under = null; draw(); } else close(); return; }
    if (e.key === 'Enter') { if (e.target.matches('[data-ev]')) { e.preventDefault(); $('[data-ok]', d).click(); } else if (e.target.matches('[data-nv]')) { e.preventDefault(); add(); } }
  });
  document.body.appendChild(d); draw();
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
  for (const d of fields) { const c = form.elements[d.n]; if (!c) continue; let v = c.value.trim(); if (d.t === 'number' || d.t === 'money') v = v === '' ? '' : String(num(v)); out[d.n] = v; if (d.req && !v && !bad) bad = c.type === 'hidden' ? c.previousElementSibling : c; }
  return { out, bad };
}
function form(title, fields, values, onSave, opt = {}) {
  const el = sheet(title, `<form class="frm" novalidate>${fields.map((f) => fieldHTML(f, values && values[f.n])).join('')}${opt.extra || ''}${opt.live ? '<p class="live" aria-live="polite"></p>' : ''}<div class="actions">${opt.del ? `<button type="button" class="btn danger" data-del>${E(opt.delLabel || 'حذف')}</button>` : ''}<span class="grow"></span><button type="button" class="btn quiet" data-close>إلغاء</button><button type="submit" class="btn pri">${E(opt.ok || 'حفظ')}</button></div></form>`, { onClose: opt.onClose });
  const f = $('form', el);
  $$('.pickb', el).forEach((b) => { const d = fields.find((x) => x.n === b.dataset.pk), h = b.nextElementSibling; b.onclick = () => openPicker(d, h.value, (v) => { h.value = v; b.firstElementChild.textContent = optLabel(d, v) || 'اختر…'; b.classList.remove('bad'); h.dispatchEvent(new Event('input', { bubbles: true })); }); });
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
