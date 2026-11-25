'use strict';
/* أنواع القضايا الهرمية (حتى 5 مستويات): اختيار، إضافة، تعديل، حذف، ترتيب، وطيّ بالمثلثات.
 * قيمة النوع في القضية نصّ مساره مفصولاً بـ « › » مثل: مدنية › عقارية. */
const SEP = ' › ', TMAX = 5;

const tid = () => 'k' + Date.now().toString(36).slice(-3) + Math.random().toString(36).slice(2, 6);
const DEF_KINDS = () => [{ name: 'مدنية', c: ['عقارية', 'إيجارات', 'تعويضات'] }, 'تجارية', 'جزائية', 'أحوال شخصية', 'عمالية', 'إدارية', 'أخرى']
  .map((k) => (typeof k === 'string' ? { id: tid(), name: k, c: [] } : { id: tid(), name: k.name, c: k.c.map((n) => ({ id: tid(), name: n, c: [] })) }));

function kClean(a, d = 1) {
  if (!Array.isArray(a) || d > TMAX) return [];
  return a.slice(0, 100).filter((n) => n && typeof n.name === 'string' && n.name.trim()).map((n) => ({ id: typeof n.id === 'string' ? n.id : tid(), name: n.name.trim().slice(0, 40), c: kClean(n.c, d + 1) }));
}
function kFlat(nodes, d = 1, path = [], out = []) {
  nodes.forEach((n, i) => { const p = path.concat(n.name); out.push({ n, d, p, arr: nodes, i }); kFlat(n.c, d + 1, p, out); });
  return out;
}
const kinds = () => DB.opts.kinds;
const inKind = (v, p) => !p || v === p || String(v || '').startsWith(p + SEP);
/** بعد إعادة التسمية تُحدَّث قيم القضايا القائمة على المسار القديم */
function kRename(oldP, newP) { DB.cases.forEach((c) => { if (c.kind === oldP) c.kind = newP; else if (String(c.kind || '').startsWith(oldP + SEP)) c.kind = newP + c.kind.slice(oldP.length); }); }
const kUsed = (p) => DB.cases.filter((c) => inKind(c.kind, p)).length;

/** لوحة شجرة: pick(path) للاختيار (وإلا فتُستعمل للإدارة فقط). تعيد دالة إعادة الرسم */
function kPanel(host, { pick, sel = '' } = {}) {
  const open = new Set(kFlat(kinds()).filter((r) => r.n.c.length && r.d < 2).map((r) => r.n.id));
  kFlat(kinds()).forEach((r) => { if (sel && inKind(sel, r.p.join(SEP)) && r.n.c.length) open.add(r.n.id); });
  let under = null, ren = null, armed = null;
  const draw = () => {
    const rows = [], walk = (arr, d) => arr.forEach((n) => {
      const o = open.has(n.id), path = kFlat(kinds()).find((r) => r.n === n).p.join(SEP);
      rows.push(`<div class="kr" style="--lv:${d - 1}" data-id="${E(n.id)}">${n.c.length ? `<button type="button" class="kt${o ? ' o' : ''}" data-k="tg" aria-label="${o ? 'طيّ' : 'فتح'} ${E(n.name)}">◂</button>` : '<span class="kt0"></span>'}
        ${ren === n.id ? `<input class="krn" value="${E(n.name)}" maxlength="40" aria-label="الاسم الجديد">` : `<button type="button" class="kn${sel === path ? ' on' : ''}" data-k="${pick ? 'pick' : 'tg'}">${E(n.name)}</button>`}
        <span class="ka">${d < TMAX ? `<button type="button" data-k="add" aria-label="إضافة فرع تحت ${E(n.name)}">＋</button>` : ''}<button type="button" data-k="up" aria-label="أعلى">⬆</button><button type="button" data-k="down" aria-label="أسفل">⬇</button><button type="button" data-k="ren" aria-label="تعديل ${E(n.name)}">✏️</button><button type="button" data-k="del" class="${armed === n.id ? 'arm' : ''}" aria-label="حذف ${E(n.name)}">${armed === n.id ? 'تأكيد الحذف؟' : '🗑'}</button></span></div>`);
      if (n.c.length && o) walk(n.c, d + 1);
    });
    walk(kinds(), 1);
    const u = under && kFlat(kinds()).find((r) => r.n.id === under);
    host.innerHTML = `<div class="kl">${rows.join('') || '<p class="muted">لا أنواع بعد.</p>'}</div>${u ? `<p class="kunder">فرع جديد تحت «${E(u.n.name)}» <button type="button" data-k="nou">إلغاء</button></p>` : ''}
      <div class="kadd"><input name="kv" maxlength="40" placeholder="${u ? 'اسم الفرع الجديد…' : 'إضافة نوع جديد…'}" aria-label="اسم جديد" autocomplete="off"><button class="btn pri small" type="button" data-k="addnew">＋ إضافة</button></div>
      <div class="kall"><button type="button" class="btn small" data-k="xall">فتح الكل</button><button type="button" class="btn small" data-k="call">طيّ الكل</button></div>`;
  };
  host.onclick = (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return; if (b.dataset.k !== 'del') armed = null; const k = b.dataset.k, row = b.closest('[data-id]'), r = row && kFlat(kinds()).find((x) => x.n.id === row.dataset.id);
    if (k === 'addnew') return addNew();
    if (k === 'xall') kFlat(kinds()).forEach((x) => x.n.c.length && open.add(x.n.id)); else if (k === 'call') open.clear(); else if (k === 'nou') under = null;
    else if (!r) return;
    else if (k === 'tg') open.has(r.n.id) ? open.delete(r.n.id) : open.add(r.n.id);
    else if (k === 'pick') { pick(r.p.join(SEP)); return; }
    else if (k === 'add') { under = r.n.id; open.add(r.n.id); }
    else if (k === 'up' || k === 'down') { const j = r.i + (k === 'up' ? -1 : 1); if (j < 0 || j >= r.arr.length) return; r.arr.splice(j, 0, r.arr.splice(r.i, 1)[0]); persist(); }
    else if (k === 'ren') { ren = r.n.id; armed = null; draw(); const x = host.querySelector('.krn'); if (x) { x.focus(); x.select(); } return; }
    else if (k === 'del') {
      if (armed !== r.n.id) { armed = r.n.id; draw(); return; }
      armed = null; r.arr.splice(r.i, 1); persist();
    }
    draw(); if (onKinds) onKinds();
  };
  const addNew = () => {
    const v = host.querySelector('[name=kv]').value.trim(); if (!v) return toast('اكتب الاسم أولاً');
    const par = under && kFlat(kinds()).find((x) => x.n.id === under), arr = par ? par.n.c : kinds();
    if (par && par.d >= TMAX) return toast('بلغت الحد الأقصى: 5 مستويات');
    if (arr.some((x) => x.name === v)) return toast('الاسم موجود في المستوى نفسه');
    arr.push({ id: tid(), name: v.slice(0, 40), c: [] }); if (par) open.add(par.n.id); persist(); draw(); if (onKinds) onKinds();
  };
  const saveRen = (x) => {
    const row = x.closest('[data-id]'), r = kFlat(kinds()).find((q) => q.n.id === row.dataset.id), nm = x.value.trim().slice(0, 40); ren = null;
    if (r && nm && nm !== r.n.name) {
      if (r.arr.some((q) => q !== r.n && q.name === nm)) toast('الاسم موجود في المستوى نفسه');
      else { const old = r.p.join(SEP); r.n.name = nm; kRename(old, r.p.slice(0, -1).concat(nm).join(SEP)); persist(); if (onKinds) onKinds(); }
    }
    draw();
  };
  host.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') return; const t = e.target;
    if (t.matches('[name=kv]')) { if (e.key === 'Enter') { e.preventDefault(); addNew(); } return; }
    if (t.matches('.krn')) { e.preventDefault(); e.stopPropagation(); if (e.key === 'Enter') saveRen(t); else { ren = null; draw(); } }
  };
  host.addEventListener('focusout', (e) => { if (e.target.matches && e.target.matches('.krn') && ren) saveRen(e.target); });
  draw(); return draw;
}
let onKinds = null;

/** حقل نوع القضية داخل النموذج: زر يفتح لوحة الشجرة المضمّنة */
function kField(el) {
  $$('[data-tp]', el).forEach((btn) => {
    const inp = $('#f_' + btn.dataset.tp, el), host = btn.nextElementSibling;
    btn.onclick = () => {
      if (!host.hidden) { host.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
      host.hidden = false; btn.setAttribute('aria-expanded', 'true');
      kPanel(host, { sel: inp.value, pick: (p) => { inp.value = p; btn.firstChild.textContent = p + ' '; host.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    };
  });
}

/** شريط تصفية هرمي في قائمة القضايا: صف للجذور ثم صف لأبناء كل عقدة في المسار المحدد */
function vKindBar(sel) {
  const rows = [kinds()], chain = []; let arr = kinds();
  for (const nm of sel ? sel.split(SEP) : []) { const n = arr.find((x) => x.name === nm); if (!n) break; chain.push(n); arr = n.c; if (n.c.length) rows.push(n.c); }
  const pathOf = (n) => kFlat(kinds()).find((r) => r.n === n).p.join(SEP);
  const row = (a, first) => `<div class="chips krow">${first ? `<button class="chip${!sel ? ' on' : ''}" data-act="kind" data-k="">كل الأنواع</button>` : ''}${a.map((n) => { const p = pathOf(n); return `<button class="chip${chain.includes(n) ? ' on' : ''}" data-act="kind" data-k="${E(p)}">${E(n.name)}${n.c.length ? ' ▾' : ''}<i>${DB.cases.filter((c) => inKind(c.kind, p)).length}</i></button>`; }).join('')}${first ? '<button class="chip" data-act="kinds" aria-label="تعديل أنواع القضايا">⚙ الأنواع</button>' : ''}</div>`;
  return rows.map((a, i) => row(a, i === 0)).join('');
}
function manageKinds() {
  const el = sheet('أنواع القضايا', '<p class="muted">رتّب الأنواع في شجرة حتى 5 مستويات: أضف فروعاً، عدّل، احذف، وارفع أو أنزل. القضايا القائمة لا تتأثر بالحذف.</p><div id="kp"></div>', { wide: 1 });
  onKinds = null; kPanel($('#kp', el), {}); onKinds = () => render();
  const close = () => { onKinds = null; render(); }; $$('[data-close]', el.parentElement).forEach((b) => b.addEventListener('click', close));
}
