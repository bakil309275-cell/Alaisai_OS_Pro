'use strict';
/* ===== المحرك المشترك لإضافات القطاعات (الإعداد في cfg.js) ===== */
const S = { tab: 'home', list: CFG.lists[0].id, q: '', filter: '', bfilter: 'all', seg: 'posts', bq: '' };
const TABS = [['home', 'الرئيسية', 'home'], ['cat', 'الكتالوج', 'grid'], ['book', CFG.book.tab, 'cal'], ['msg', 'العروض والرسائل', 'chat'], ['me', 'ملفي', 'user']];
const lf = (l) => l.fields.map((f) => (f.t === 'select' ? Object.assign({}, f, { key: l.id + '.' + f.n, scope: 'rec:' + l.id }) : f));
const lcfg = (id) => CFG.lists.find((l) => l.id === id);
const recs = (id) => DB.lists[id] || (DB.lists[id] = []);
const isMoney = (f) => f.t === 'money';
function fval(f, r) {
  const v = r[f.n]; if (v == null || v === '') return '';
  if (isMoney(f)) return money(num(v)); if (f.t === 'date') return fDate(v); if (f.t === 'number') return fNum(num(v)) + (f.u ? ' ' + f.u : ''); return String(v);
}
function recText(l, r) {
  const lines = [`*${r[l.primary] || ''}*`]; l.fields.forEach((f) => { if (f.n === l.primary) return; const v = fval(f, r); if (v) lines.push(f.l + ': ' + v); });
  const p = DB.profile; lines.push('', p.name || CFG.name); if (p.phones[0]) lines.push('📞 ' + p.phones[0].v); return lines.join('\n');
}
const visIcon = (r) => (r.vis === 'prv' ? ic('lock', 'mini') : ic('globe', 'mini'));
const photoOf = (r) => (r.photos && r.photos[0]) || null;
const thumb = (r, l) => `<span class="th" ${photoOf(r) && hasVault() ? `data-ph="t${photoOf(r)}"` : ''}>${photoOf(r) ? '' : `<b>${E(String(r[l.primary] || '؟').trim().charAt(0))}</b>`}</span>`;

/* ----- التنبيهات الذكية (قواعد محلية، بلا اتصال) ----- */
function tips() {
  const t = [], td = today();
  CFG.lists.forEach((l) => { if (!l.stock) return; recs(l.id).filter((r) => !r.hide).forEach((r) => {
    const q = num(r[l.stock.qty]), mn = num(r[l.stock.min]);
    if (l.stock.min && r[l.stock.min] !== '' && r[l.stock.qty] !== '' && q <= mn) t.push({ k: 'warn', t: 'نفاد قريب: ' + r[l.primary], d: 'الكمية ' + fNum(q) + ' وحد التنبيه ' + fNum(mn), go: ['cat', l.id] });
    const ex = r[l.stock.exp]; if (ex) { const n = diff(ex, td); if (n < 0) t.push({ k: 'bad', t: 'منتهي الصلاحية: ' + r[l.primary], d: 'انتهى ' + rel(ex), go: ['cat', l.id] }); else if (n <= 60) t.push({ k: 'warn', t: 'ينتهي قريباً: ' + r[l.primary], d: 'خلال ' + n + ' يوماً', go: ['cat', l.id] }); }
  }); });
  DB.bookings.forEach((b) => { const rest = bRest(b);
    if (b.date && b.date < td && CFG.book.open.includes(b.status)) t.push({ k: 'warn', t: 'سجل مضى موعده: ' + b.name, d: 'حدّث حالته (' + b.status + ')', go: ['book'] });
    if (rest > 0 && b.status === CFG.book.done) t.push({ k: 'bad', t: 'مكتمل وعليه متبقٍ: ' + b.name, d: money(rest), go: ['book'] }); });
  DB.inquiries.filter((i) => i.status === 'جديد' && i.date && diff(td, i.date) >= 1).forEach((i) => t.push({ k: 'warn', t: 'استفسار بلا رد: ' + i.from, d: 'منذ ' + diff(td, i.date) + ' يوماً', go: ['msg', 'inq'] }));
  if (!DB.profile.name || !DB.profile.phones.length) t.push({ k: 'info', t: 'أكمل ملفك', d: 'أضف الاسم ورقم هاتف ليظهرا في الكتالوج والمنشورات', go: ['me'] });
  if (!CFG.lists.some((l) => recs(l.id).length)) t.push({ k: 'info', t: 'ابدأ بإضافة ' + CFG.lists[0].single + ' الأول', d: 'يظهر في الكتالوج ويمكنك نشره', go: ['cat', CFG.lists[0].id] });
  return t.slice(0, 8);
}
const bPaid = (b) => (b.payments || []).reduce((a, p) => a + num(p.amount), 0);
const bRest = (b) => Math.max(0, num(b.agreed) - bPaid(b));
const stBadge = (s) => `<span class="st st-${CFG.book.statuses.indexOf(s)}">${E(s)}</span>`;

/* ----- الرئيسية ----- */
function vHome() {
  const td = today(), p = DB.profile;
  const upcoming = DB.bookings.filter((b) => b.date && b.date >= td && !CFG.book.closed.includes(b.status)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 5);
  const agreed = DB.bookings.reduce((a, b) => a + num(b.agreed), 0), paid = DB.bookings.reduce((a, b) => a + bPaid(b), 0);
  const mo = td.slice(0, 7), mpaid = DB.bookings.reduce((a, b) => a + (b.payments || []).filter((x) => (x.date || '').startsWith(mo)).reduce((s, x) => s + num(x.amount), 0), 0);
  const people = {}; DB.bookings.forEach((b) => { const k = (b.name || '').trim(); if (k) { people[k] = people[k] || { n: 0, paid: 0 }; people[k].n++; people[k].paid += bPaid(b); } }); DB.inquiries.forEach((i) => { const k = (i.from || '').trim(); if (k) { people[k] = people[k] || { n: 0, paid: 0 }; people[k].n++; } });
  const top = Object.entries(people).sort((a, b) => b[1].n - a[1].n || b[1].paid - a[1].paid).slice(0, 5);
  const newInq = DB.inquiries.filter((i) => i.status === 'جديد').length, ts = tips();
  const contacts = [p.phones[0] && `<a class="qa" href="tel:${E(telClean(p.phones[0].v))}">${ic('phone')}اتصال</a>`, p.phones[0] && `<a class="qa" href="https://wa.me/${E(waNum(p.phones[0].v))}" target="_blank" rel="noopener">${ic('wa')}واتساب</a>`, p.map && /^https?:/i.test(p.map) && `<a class="qa" href="${E(p.map)}" target="_blank" rel="noopener">${ic('pin')}الموقع</a>`].filter(Boolean).join('');
  return `<section class="card-id">${avatar(76)}<div class="ci-t"><h1>${E(p.name || CFG.name)}</h1><p>${E(p.kind || CFG.tagline)}</p>${contacts ? `<div class="qas">${contacts}</div>` : ''}</div></section>` +
    `<div class="stats">${CFG.lists.map((l) => `<button class="stat" data-act="go" data-t="cat" data-l="${l.id}"><b>${recs(l.id).length}</b><small>${E(l.title)}</small></button>`).join('')}<button class="stat" data-act="go" data-t="book"><b>${DB.bookings.length}</b><small>${E(CFG.book.tab)}</small></button><button class="stat${newInq ? ' hot' : ''}" data-act="go" data-t="msg" data-s="inq"><b>${newInq}</b><small>استفسار جديد</small></button></div>` +
    `<div class="ledger"><div><small>المتفق عليه</small><b>${E(fNum(agreed))}</b></div><div><small>المدفوع</small><b>${E(fNum(paid))}</b></div><div class="${agreed - paid > 0 ? 'owed' : ''}"><small>المتبقي</small><b>${E(fNum(Math.max(0, agreed - paid)))}</b></div></div><p class="calm sm">المحصّل هذا الشهر ${E(money(mpaid))}</p>` +
    (ts.length ? `<div class="sec-h"><h3>${ic('bulb')}اقتراحات المساعد</h3></div><div class="tipl">${ts.map((x) => `<button class="tip ${x.k}" data-act="tip" data-g="${E(x.go.join('|'))}"><strong>${E(x.t)}</strong><small>${E(x.d)}</small></button>`).join('')}</div>` : '') +
    `<div class="sec-h"><h3>${CFG.book.upcoming}</h3></div>` + (upcoming.length ? `<div class="list">${upcoming.map((b) => bRow(b)).join('')}</div>` : '<p class="calm">لا مواعيد قادمة. أضف حجزاً من تبويب «' + E(CFG.book.tab) + '».</p>') +
    (top.length ? `<div class="sec-h"><h3>${CFG.terms.active}</h3></div><div class="list">${top.map(([n, v], i) => `<div class="row"><span class="rank">${i + 1}</span><span class="main"><strong>${E(n)}</strong><small>${v.n} تعامل${v.paid ? ' · مدفوع ' + E(fNum(v.paid)) : ''}</small></span></div>`).join('')}</div>` : '') +
    `<p class="calm sm foot-note">عدد المشتركين والمتصلين حالياً يحتاج خادماً مركزياً، ولا تتوفر في إضافة تعمل على جهازك فقط.</p>`;
}
const avatar = (n) => `<span class="av" style="--s:${n}px">${DB.profile.logo ? `<img alt="" src="${E(DB.profile.logo)}">` : `<b>${E((DB.profile.name || CFG.name).trim().charAt(0))}</b>`}</span>`;

/* ----- الكتالوج ----- */
function vCat() {
  const l = lcfg(S.list), q = norm(S.q), fl = S.filter, all = recs(l.id);
  const fo = l.filter ? optValues(Object.assign({ key: l.id + '.' + l.filter }, l.fields.find((f) => f.n === l.filter))) : [];
  let list = all.filter((r) => (fl === '__hide' ? r.hide : !r.hide && (!fl || r[l.filter] === fl)) && (!q || norm(l.fields.map((f) => r[f.n]).join(' ')).includes(q)));
  list = list.slice().sort((a, b) => (b.created || 0) - (a.created || 0));
  const seg = CFG.lists.length > 1 ? `<div class="seg" role="tablist">${CFG.lists.map((x) => `<button role="tab" aria-selected="${x.id === l.id}" class="${x.id === l.id ? 'on' : ''}" data-act="list" data-l="${x.id}">${E(x.title)}<i>${recs(x.id).length}</i></button>`).join('')}</div>` : '';
  const chips = (fo.length || all.some((r) => r.hide)) ? `<div class="chips"><button class="chip${!fl ? ' on' : ''}" data-act="flt" data-k="">الكل</button>${fo.filter((o) => all.some((r) => r[l.filter] === o)).map((o) => `<button class="chip${fl === o ? ' on' : ''}" data-act="flt" data-k="${E(o)}">${E(o)}</button>`).join('')}${all.some((r) => r.hide) ? `<button class="chip${fl === '__hide' ? ' on' : ''}" data-act="flt" data-k="__hide">المخفي</button>` : ''}</div>` : '';
  return seg + `<div class="bar"><label class="search">${ic('search')}<input id="cq" type="search" placeholder="ابحث في ${E(l.title)}" value="${E(S.q)}" autocomplete="off"></label><button class="btn pri" data-act="newRec">${ic('plus')}<span>${E(l.single)}</span></button></div>${chips}` +
    (list.length ? `<div class="list">${list.map((r) => cRow(l, r)).join('')}</div>` : (all.length ? emptyBox('لا نتائج', 'غيّر البحث أو الفلتر.') : emptyBox('لا ' + l.title + ' بعد', l.empty || 'أضف أول ' + l.single + ' ليظهر هنا وفي الكتالوج الذي تشاركه.', `<button class="btn pri" data-act="newRec">${ic('plus')}إضافة ${E(l.single)}</button>`)));
}
function cRow(l, r) {
  const sub = (l.sub || []).map((n) => r[n]).filter(Boolean).join(' · '), bf = l.fields.find((f) => f.n === l.badge), warn = stockWarn(l, r);
  return `<div class="row${r.hide ? ' dim' : ''}" data-id="${r.id}"><button class="rb" data-act="viewRec" data-id="${r.id}">${thumb(r, l)}<span class="main"><strong>${E(r[l.primary])}${visIcon(r)}</strong><small>${E(sub)}</small></span>${warn ? `<span class="tag bad">${E(warn)}</span>` : ''}${bf && r[bf.n] ? `<span class="amt">${E(fval(bf, r))}</span>` : ''}</button><button class="icon s" data-act="recMenu" data-id="${r.id}" aria-label="إجراءات ${E(r[l.primary])}">${ic('dots')}</button></div>`;
}
function stockWarn(l, r) {
  if (!l.stock) return ''; const td = today();
  if (r[l.stock.exp] && diff(r[l.stock.exp], td) < 0) return 'منتهي'; if (r[l.stock.exp] && diff(r[l.stock.exp], td) <= 60) return 'ينتهي قريباً';
  if (l.stock.min && r[l.stock.qty] !== '' && r[l.stock.min] !== '' && r[l.stock.qty] != null && num(r[l.stock.qty]) <= num(r[l.stock.min])) return 'نفاد';
  return '';
}
const emptyBox = (t, d, btn = '') => `<div class="empty"><div class="mark">${ic(CFG.glyph || 'grid')}</div><h3>${E(t)}</h3><p>${E(d)}</p>${btn}</div>`;

/* ----- محرر الصور داخل النماذج ----- */
function photoEditor(el, ids, max = 6) {
  let cur = (ids || []).slice(); const added = [], removed = [];
  const box = $('.phe', el); if (!box) return null;
  const draw = () => { box.innerHTML = cur.map((id) => `<span class="pe"><span class="th" data-ph="t${id}"></span><button type="button" class="x" data-rm="${id}" aria-label="إزالة الصورة">${ic('x')}</button></span>`).join('') + (cur.length < max ? `<button type="button" class="pe add" data-add aria-label="إضافة صورة">${ic('camera')}<small>صورة</small></button>` : ''); hydrate(box);
    $$('[data-rm]', box).forEach((b) => { b.onclick = () => { const id = b.dataset.rm; cur = cur.filter((x) => x !== id); (added.includes(id) ? dropPhotos([id]) : removed.push(id)); draw(); }; });
    const a = $('[data-add]', box); if (a) a.onclick = async () => { const fs = await pickFile('image/*', true); for (const f of fs.slice(0, max - cur.length)) { try { const id = await addPhoto(f); cur.push(id); added.push(id); } catch (e) { toast(e.message || 'تعذّرت إضافة الصورة'); } } draw(); }; };
  draw();
  return { ids: () => cur.slice(), commit: () => dropPhotos(removed), cancel: () => dropPhotos(added) };
}
const photoBox = () => (hasVault() ? '<div class="fld"><span>الصور</span><div class="phe"></div></div>' : '<p class="note">إرفاق الصور يحتاج العيسائي برو 2.7.0 أو أحدث.</p>');
const visField = () => ({ n: 'vis', fix: 1, l: 'النشر', t: 'select', o: [['pub', 'عام (يظهر في الكتالوج المشارَك)'], ['prv', 'خاص (لي فقط)']], half: 1 });

/* ----- سجلات الكتالوج ----- */
function recForm(l, r) {
  const isNew = !r, fields = lf(l).concat([visField()]);
  const el = form(isNew ? 'إضافة ' + l.single : 'تعديل ' + l.single, fields, r || { vis: 'pub' }, async (o) => {
    const rec = isNew ? { id: uid(), created: Date.now(), photos: [] } : r; Object.assign(rec, o); if (pe) { rec.photos = pe.ids(); pe.commit(); }
    if (isNew) recs(l.id).push(rec); persist(); render(); toast('حُفظ');
  }, { extra: photoBox(), onClose: () => pe && pe.cancel(), del: !isNew, delLabel: 'حذف', delMsg: 'حذف «' + (r && r[l.primary]) + '» نهائياً؟', onDel: () => { dropPhotos(r.photos); DB.lists[l.id] = recs(l.id).filter((x) => x !== r); persist(); render(); } });
  const pe = photoEditor(el, r && r.photos);
}
function viewRec(l, r) {
  const rows = l.fields.filter((f) => f.n !== l.primary).map((f) => [f.l, fval(f, r)]).filter((x) => x[1]);
  const el = sheet(r[l.primary], `${r.photos && r.photos.length && hasVault() ? `<div class="gal">${r.photos.map((id) => `<button class="gi" data-big="${id}"><span class="th" data-ph="${id}"></span></button>`).join('')}</div>` : ''}<dl class="facts">${rows.map(([k, v]) => `<div><dt>${E(k)}</dt><dd dir="auto">${E(v)}</dd></div>`).join('')}</dl><p class="muted">${r.vis === 'prv' ? 'خاص: لا يظهر في الكتالوج المشارَك' : 'عام: يظهر في الكتالوج المشارَك'}${r.hide ? ' · مخفي' : ''}</p><div class="actions"><button class="btn quiet" data-k="more">${ic('dots')}المزيد</button><span class="grow"></span><button class="btn quiet" data-k="share">${ic('share')}مشاركة</button><button class="btn pri" data-k="edit">${ic('edit')}تعديل</button></div>`, { wide: true, noFocus: true });
  hydrate(el); $$('[data-big]', el).forEach((b) => { b.onclick = async () => { const u = await blobUrl(b.dataset.big); if (u) { const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = `<img alt="" src="${u}">`; z.onclick = () => z.remove(); document.body.appendChild(z); } }; });
  $('[data-k=edit]', el).onclick = () => { closeSheet(true); recForm(l, r); }; $('[data-k=share]', el).onclick = () => shareText(recText(l, r), r[l.primary]); $('[data-k=more]', el).onclick = () => recMenu(l, r);
}
async function recMenu(l, r) {
  const k = await menu(r[l.primary], [{ k: 'view', l: 'عرض', i: 'eye' }, { k: 'edit', l: 'تعديل', i: 'edit' }, { k: 'copy', l: 'نسخ البيانات', i: 'copy' }, { k: 'print', l: 'طباعة', i: 'print' }, { k: 'share', l: 'مشاركة', i: 'share' }, { k: 'vis', l: r.vis === 'prv' ? 'نشر للعامة' : 'جعله خاصاً', i: r.vis === 'prv' ? 'globe' : 'lock' }, { k: 'hide', l: r.hide ? 'إظهار' : 'إخفاء', i: r.hide ? 'eye' : 'eyeoff' }, { k: 'del', l: 'حذف', i: 'trash', danger: 1 }]);
  if (!k) return;
  if (k === 'view') return viewRec(l, r); if (k === 'edit') return recForm(l, r);
  if (k === 'copy') return copyText(recText(l, r)); if (k === 'share') return shareText(recText(l, r), r[l.primary]);
  if (k === 'print') return printHTML(`<div class="paper">${letterhead()}<h2 class="ph">${E(r[l.primary])}</h2><table class="pt">${l.fields.filter((f) => f.n !== l.primary).map((f) => [f.l, fval(f, r)]).filter((x) => x[1]).map(([a, b]) => `<tr><th>${E(a)}</th><td>${E(b)}</td></tr>`).join('')}</table></div>`);
  if (k === 'vis') { r.vis = r.vis === 'prv' ? 'pub' : 'prv'; persist(); render(); return toast(r.vis === 'pub' ? 'أصبح عاماً' : 'أصبح خاصاً'); }
  if (k === 'hide') { r.hide = !r.hide; persist(); render(); return toast(r.hide ? 'أُخفي' : 'أُظهر'); }
  if (k === 'del' && await ask('حذف «' + r[l.primary] + '» نهائياً؟', 'حذف')) { dropPhotos(r.photos); DB.lists[l.id] = recs(l.id).filter((x) => x !== r); persist(); render(); toast('حُذف'); }
}

/* ----- الحجوزات والطلبات ----- */
const bookFields = () => [{ n: 'name', l: CFG.book.nameLabel, req: 1 }, { n: 'phone', l: 'الهاتف', t: 'tel', half: 1 }, { n: 'what', l: CFG.book.itemLabel, half: 1, o: CFG.book.itemFrom ? recs(CFG.book.itemFrom).map((r) => r[lcfg(CFG.book.itemFrom).primary]) : undefined }]
  .concat(CFG.book.qtyLabel ? [{ n: 'qty', l: CFG.book.qtyLabel, t: 'number', half: 1 }] : []).concat([{ n: 'date', l: CFG.book.dateLabel, t: 'date', half: 1 }, { n: 'time', l: 'الوقت', t: 'time', half: 1 }, { n: 'agreed', l: 'المبلغ المتفق عليه', t: 'money', half: 1 }, { n: 'status', l: 'الحالة', t: 'select', fix: 1, key: 'book.status', scope: 'book', o: CFG.book.statuses, half: 1 }, { n: 'note', l: 'ملاحظات', t: 'textarea', rows: 2 }]);
function bRow(b) {
  return `<div class="row" data-id="${b.id}"><button class="rb" data-act="viewBook" data-id="${b.id}"><span class="when"><b>${E(b.date ? fShort(b.date) : '—')}</b><small>${E(b.time || '')}</small></span><span class="main"><strong>${E(b.name)}</strong><small>${E([b.what, b.qty && 'عدد ' + b.qty].filter(Boolean).join(' · '))}</small></span>${stBadge(b.status)}${bRest(b) > 0 ? `<span class="amt">${E(fNum(bRest(b)))}</span>` : ''}</button></div>`;
}
function vBook() {
  const q = norm(S.bq), fl = S.bfilter;
  const list = DB.bookings.filter((b) => (fl === 'all' || b.status === fl) && (!q || norm([b.name, b.phone, b.what, b.note].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const agreed = DB.bookings.reduce((a, b) => a + num(b.agreed), 0), paid = DB.bookings.reduce((a, b) => a + bPaid(b), 0);
  return `<div class="ledger"><div><small>المتفق عليه</small><b>${E(fNum(agreed))}</b></div><div><small>المدفوع</small><b>${E(fNum(paid))}</b></div><div class="${agreed - paid > 0 ? 'owed' : ''}"><small>المتبقي</small><b>${E(fNum(Math.max(0, agreed - paid)))}</b></div></div>` +
    `<div class="bar"><label class="search">${ic('search')}<input id="bq" type="search" placeholder="ابحث بالاسم أو الهاتف" value="${E(S.bq)}" autocomplete="off"></label><button class="btn pri" data-act="newBook">${ic('plus')}<span>${E(CFG.book.single)}</span></button></div>` +
    `<div class="chips">${['all', ...CFG.book.statuses].map((s) => `<button class="chip${fl === s ? ' on' : ''}" data-act="bflt" data-k="${E(s)}">${s === 'all' ? 'الكل' : E(s)}<i>${s === 'all' ? DB.bookings.length : DB.bookings.filter((b) => b.status === s).length}</i></button>`).join('')}</div>` +
    (list.length ? `<div class="list">${list.map(bRow).join('')}</div>` : (DB.bookings.length ? emptyBox('لا نتائج', 'غيّر البحث أو الحالة.') : emptyBox('لا ' + CFG.book.tab + ' بعد', CFG.book.empty, `<button class="btn pri" data-act="newBook">${ic('plus')}${E(CFG.book.single)} جديد</button>`)));
}
function bookForm(b) {
  const isNew = !b;
  form(isNew ? CFG.book.single + ' جديد' : 'تعديل ' + CFG.book.single, bookFields(), b || { status: CFG.book.statuses[0], date: today() }, (o) => {
    if (isNew) DB.bookings.push(Object.assign({ id: uid(), created: Date.now(), payments: [] }, o)); else Object.assign(b, o); persist(); render(); toast('حُفظ');
  }, { del: !isNew, delMsg: 'حذف هذا السجل ودفعاته؟', onDel: () => { (b.payments || []).forEach((p) => p.img && dropPhotos([p.img])); DB.bookings = DB.bookings.filter((x) => x !== b); persist(); render(); } });
}
function viewBook(b) {
  const paid = bPaid(b), ag = num(b.agreed);
  const el = sheet(b.name, `<div class="bk-h">${stBadge(b.status)}<span class="muted">${E([b.what, b.date && fDate(b.date) + (b.time ? ' ' + b.time : '')].filter(Boolean).join(' · '))}</span></div>${b.phone ? `<div class="qas"><a class="qa" href="tel:${E(telClean(b.phone))}">${ic('phone')}اتصال</a><a class="qa" href="https://wa.me/${E(waNum(b.phone))}" target="_blank" rel="noopener">${ic('wa')}واتساب</a></div>` : ''}${b.note ? `<p class="note">${E(b.note)}</p>` : ''}
  <div class="ledger"><div><small>المتفق عليه</small><b>${E(fNum(ag))}</b></div><div><small>المدفوع</small><b>${E(fNum(paid))}</b></div><div class="${ag - paid > 0 ? 'owed' : ''}"><small>المتبقي</small><b>${E(fNum(Math.max(0, ag - paid)))}</b></div></div>${ag ? `<div class="meterb" aria-hidden="true"><i style="width:${Math.min(100, Math.round(paid / ag * 100))}%"></i></div>` : ''}
  <div class="sec-h"><h3>الدفعات والسندات</h3><button class="btn small pri" data-k="pay">${ic('plus')}دفعة</button></div>${(b.payments || []).length ? `<div class="list">${b.payments.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).map((p) => `<div class="row"><span class="main"><strong>${E(money(num(p.amount)))}</strong><small>${E(fDate(p.date))}${p.note ? ' · ' + E(p.note) : ''}</small></span>${p.img && hasVault() ? `<button class="th sm" data-big="${p.img}" data-ph="t${p.img}" aria-label="عرض السند"></button>` : ''}<button class="icon s" data-prt="${p.id}" aria-label="طباعة إيصال">${ic('print')}</button><button class="icon s" data-delp="${p.id}" aria-label="حذف الدفعة">${ic('trash')}</button></div>`).join('')}</div>` : '<p class="calm">لا دفعات. سجّل الدفعة ويحسب المتبقي تلقائياً، وأرفق صورة سند الحوالة أو الإيداع.</p>'}
  <div class="actions"><button class="btn quiet" data-k="more">${ic('dots')}المزيد</button><span class="grow"></span><button class="btn pri" data-k="edit">${ic('edit')}تعديل</button></div>`, { wide: true, noFocus: true });
  hydrate(el); $$('[data-big]', el).forEach((x) => { x.onclick = async () => { const u = await blobUrl(x.dataset.big); if (u) { const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = `<img alt="" src="${u}">`; z.onclick = () => z.remove(); document.body.appendChild(z); } }; });
  $('[data-k=edit]', el).onclick = () => { closeSheet(true); bookForm(b); };
  $('[data-k=pay]', el).onclick = () => { closeSheet(true); payForm(b); };
  $$('[data-prt]', el).forEach((x) => { x.onclick = () => printReceipt(b, b.payments.find((p) => p.id === x.dataset.prt)); });
  $$('[data-delp]', el).forEach((x) => { x.onclick = async () => { if (await ask('حذف هذه الدفعة؟', 'حذف')) { const p = b.payments.find((q) => q.id === x.dataset.delp); if (p && p.img) dropPhotos([p.img]); b.payments = b.payments.filter((q) => q !== p); persist(); render(); closeSheet(true); viewBook(b); } }; });
  $('[data-k=more]', el).onclick = async () => { const k = await menu(b.name, [{ k: 'copy', l: 'نسخ الملخص', i: 'copy' }, { k: 'share', l: 'مشاركة الملخص', i: 'share' }, { k: 'print', l: 'طباعة كشف', i: 'print' }, { k: 'del', l: 'حذف', i: 'trash', danger: 1 }]); if (k === 'copy') copyText(bText(b)); if (k === 'share') shareText(bText(b), b.name); if (k === 'print') printHTML(`<div class="paper">${letterhead()}<h2 class="ph">كشف: ${E(b.name)}</h2><table class="pt"><tr><th>البيان</th><td>${E(b.what || '')}</td></tr><tr><th>التاريخ</th><td>${E(fDate(b.date))}</td></tr><tr><th>المتفق عليه</th><td>${E(money(ag))}</td></tr><tr><th>المدفوع</th><td>${E(money(paid))}</td></tr><tr><th>المتبقي</th><td>${E(money(Math.max(0, ag - paid)))}</td></tr></table></div>`); if (k === 'del' && await ask('حذف هذا السجل ودفعاته؟', 'حذف')) { (b.payments || []).forEach((p) => p.img && dropPhotos([p.img])); DB.bookings = DB.bookings.filter((x) => x !== b); persist(); render(); } };
}
const bText = (b) => [`*${DB.profile.name || CFG.name}*`, `${CFG.book.single}: ${b.name}`, b.what && `${CFG.book.itemLabel}: ${b.what}`, b.date && `الموعد: ${fDate(b.date)} ${b.time || ''}`, `المتفق عليه: ${money(num(b.agreed))}`, `المدفوع: ${money(bPaid(b))}`, `المتبقي: ${money(bRest(b))}`].filter(Boolean).join('\n');
function payForm(b) {
  let img = null;
  const el = form('تسجيل دفعة', [{ n: 'amount', l: 'المبلغ', t: 'money', req: 1, half: 1 }, { n: 'date', l: 'التاريخ', t: 'date', half: 1 }, { n: 'note', l: 'ملاحظة', ph: 'مثال: حوالة بنكية' }], { date: today() }, async (o) => {
    b.payments.push(Object.assign({ id: uid() }, o, img ? { img } : {})); persist(); render(); viewBook(b); toast('سُجّلت الدفعة');
  }, { extra: hasVault() ? `<div class="fld"><span>صورة السند (اختياري)</span><div class="phe one"></div></div>` : '', live: (o) => { const ag = num(b.agreed); return ag ? 'المتبقي بعد هذه الدفعة: ' + money(Math.max(0, ag - bPaid(b) - num(o.amount))) + (ag - bPaid(b) - num(o.amount) < 0 ? ' (زيادة ' + fNum(bPaid(b) + num(o.amount) - ag) + ')' : '') : 'لم يُحدَّد المبلغ المتفق عليه بعد؛ عدّله من زر التعديل.'; }, onClose: () => { if (img) dropPhotos([img]); viewBook(b); } });
  const box = $('.phe', el); if (box) { const draw = () => { box.innerHTML = img ? `<span class="pe"><span class="th" data-ph="t${img}"></span><button type="button" class="x" data-rm aria-label="إزالة">${ic('x')}</button></span>` : `<button type="button" class="pe add" data-add>${ic('camera')}<small>صورة</small></button>`; hydrate(box); const r = $('[data-rm]', box); if (r) r.onclick = () => { dropPhotos([img]); img = null; draw(); }; const a = $('[data-add]', box); if (a) a.onclick = async () => { const [f] = await pickFile('image/*', false); if (f) { try { img = await addPhoto(f); } catch (e) { toast('تعذّرت إضافة الصورة'); } draw(); } }; }; draw(); }
}
function printReceipt(b, p) { printHTML(`<div class="paper">${letterhead()}<h2 class="ph">سند استلام</h2><table class="pt"><tr><th>التاريخ</th><td>${E(fDate(p.date))}</td></tr><tr><th>استُلم من</th><td>${E(b.name)}</td></tr><tr><th>المبلغ</th><td>${E(money(num(p.amount)))}</td></tr><tr><th>عن</th><td>${E(p.note || b.what || '')}</td></tr><tr><th>المتبقي بعد الدفعة</th><td>${E(money(bRest(b)))}</td></tr></table><p class="sig">التوقيع: ……………………</p></div>`); }

/* ----- العروض والرسائل ----- */
function vMsg() {
  const seg = `<div class="seg"><button class="${S.seg === 'posts' ? 'on' : ''}" data-act="seg" data-k="posts">العروض والمنشورات<i>${DB.posts.length}</i></button><button class="${S.seg === 'inq' ? 'on' : ''}" data-act="seg" data-k="inq">الاستفسارات<i>${DB.inquiries.filter((i) => i.status === 'جديد').length || DB.inquiries.length}</i></button></div>`;
  if (S.seg === 'posts') {
    const list = DB.posts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return seg + `<div class="bar"><button class="btn pri grow" data-act="newPost">${ic('plus')}منشور أو عرض جديد</button><button class="btn quiet" data-act="draftPost">${ic('bulb')}اقترح نصاً</button></div>` + (list.length ? `<div class="list">${list.map((p) => `<div class="row${p.hide ? ' dim' : ''}"><button class="rb" data-act="viewPost" data-id="${p.id}"><span class="th" ${p.photos && p.photos[0] && hasVault() ? `data-ph="t${p.photos[0]}"` : ''}>${p.photos && p.photos[0] ? '' : `<b>${ic('bell')}</b>`}</span><span class="main"><strong>${E(p.title)}${visIcon(p)}</strong><small>${E([p.kind, fDate(p.date)].filter(Boolean).join(' · '))}</small></span></button><button class="icon s" data-act="postMenu" data-id="${p.id}" aria-label="إجراءات">${ic('dots')}</button></div>`).join('')}</div>` : emptyBox('لا منشورات بعد', 'انشر عرضاً أو إعلاناً وشاركه مع عملائك بضغطة.', ''));
  }
  const list = DB.inquiries.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return seg + `<div class="bar"><button class="btn pri grow" data-act="newInq">${ic('plus')}تسجيل استفسار</button></div>` + (list.length ? `<div class="list">${list.map((i) => `<button class="row rb" data-act="viewInq" data-id="${i.id}"><span class="main"><strong>${E(i.from)}</strong><small>${E(i.text)}</small></span><span class="tag ${i.status === 'جديد' ? 'bad' : ''}">${E(i.status)}</span></button>`).join('')}</div>` : emptyBox('لا استفسارات', 'سجّل ما يصلك من أسئلة واتساب أو الاتصال لتتابع الردود ولا يضيع شيء.', ''));
}
const postFields = () => [{ n: 'kind', l: 'النوع', t: 'select', key: 'post.kind', scope: 'post', o: CFG.postKinds, half: 1 }, { n: 'date', l: 'التاريخ', t: 'date', half: 1 }, { n: 'title', l: 'العنوان', req: 1 }, { n: 'text', l: 'النص', t: 'textarea', rows: 5 }, visField()];
function postForm(p, preset) {
  const isNew = !p;
  const el = form(isNew ? 'منشور جديد' : 'تعديل المنشور', postFields(), p || preset || { kind: CFG.postKinds[0], date: today(), vis: 'pub' }, (o) => { const rec = isNew ? { id: uid(), photos: [] } : p; Object.assign(rec, o); if (pe) { rec.photos = pe.ids(); pe.commit(); } if (isNew) DB.posts.push(rec); persist(); render(); toast('حُفظ'); }, { extra: photoBox(), onClose: () => pe && pe.cancel(), del: !isNew, delMsg: 'حذف هذا المنشور؟', onDel: () => { dropPhotos(p.photos); DB.posts = DB.posts.filter((x) => x !== p); persist(); render(); } });
  const pe = photoEditor(el, p && p.photos, 3);
}
const postText = (p) => `*${p.title}*\n\n${p.text || ''}\n\n${DB.profile.name || CFG.name}${DB.profile.phones[0] ? '\n📞 ' + DB.profile.phones[0].v : ''}`;
function viewPost(p) {
  const el = sheet(p.title, `${p.photos && p.photos.length && hasVault() ? `<div class="gal">${p.photos.map((id) => `<span class="th big" data-ph="${id}"></span>`).join('')}</div>` : ''}<p class="muted">${E([p.kind, fDate(p.date)].filter(Boolean).join(' · '))}</p><div class="reader">${E(p.text || '').replace(/\n/g, '<br>')}</div><div class="actions"><button class="btn quiet" data-k="more">${ic('dots')}المزيد</button><span class="grow"></span><button class="btn pri" data-k="share">${ic('share')}مشاركة</button></div>`, { wide: true, noFocus: true });
  hydrate(el); $('[data-k=share]', el).onclick = () => shareText(postText(p), p.title); $('[data-k=more]', el).onclick = () => postMenu(p);
}
async function postMenu(p) {
  const k = await menu(p.title, [{ k: 'edit', l: 'تعديل', i: 'edit' }, { k: 'copy', l: 'نسخ', i: 'copy' }, { k: 'share', l: 'مشاركة', i: 'share' }, { k: 'print', l: 'طباعة', i: 'print' }, { k: 'vis', l: p.vis === 'prv' ? 'نشر للعامة' : 'جعله خاصاً', i: p.vis === 'prv' ? 'globe' : 'lock' }, { k: 'hide', l: p.hide ? 'إظهار' : 'إخفاء', i: p.hide ? 'eye' : 'eyeoff' }, { k: 'del', l: 'حذف', i: 'trash', danger: 1 }]);
  if (k === 'edit') postForm(p); if (k === 'copy') copyText(postText(p)); if (k === 'share') shareText(postText(p), p.title);
  if (k === 'print') printHTML(`<div class="paper">${letterhead()}<h2 class="ph">${E(p.title)}</h2><div class="paper-body">${E(p.text || '').replace(/\n/g, '<br>')}</div></div>`);
  if (k === 'vis') { p.vis = p.vis === 'prv' ? 'pub' : 'prv'; persist(); render(); } if (k === 'hide') { p.hide = !p.hide; persist(); render(); }
  if (k === 'del' && await ask('حذف المنشور؟', 'حذف')) { dropPhotos(p.photos); DB.posts = DB.posts.filter((x) => x !== p); persist(); render(); }
}
async function draftPost() {
  const all = CFG.lists.flatMap((l) => recs(l.id).filter((r) => !r.hide).map((r) => ({ l, r })));
  if (!all.length) return toast('أضف ' + CFG.lists[0].single + ' أولاً لأقترح نصاً عنه');
  const el = sheet('اقتراح نص منشور', `<p class="note">اختر عنصراً وأكتب لك نصاً جاهزاً تعدّله كما تشاء. هذا مساعد قواعد محلي وليس نموذج ذكاء اصطناعي.</p><div class="list">${all.slice(0, 40).map((x, i) => `<button class="row rb" data-i="${i}"><span class="main"><strong>${E(x.r[x.l.primary])}</strong><small>${E(x.l.single)}</small></span></button>`).join('')}</div>`, { noFocus: true });
  $$('[data-i]', el).forEach((b) => { b.onclick = () => { const { l, r } = all[+b.dataset.i]; const bf = l.fields.find((f) => f.n === l.badge); const lines = [CFG.draft(r, l), '', ...l.fields.filter((f) => f.n !== l.primary && f.n !== l.badge && f.t !== 'textarea').map((f) => [f.l, fval(f, r)]).filter((x) => x[1]).slice(0, 4).map(([a, c]) => '• ' + a + ': ' + c), bf && r[bf.n] ? '💰 ' + bf.l + ': ' + fval(bf, r) : '', '', 'للحجز والاستفسار تواصل معنا' + (DB.profile.phones[0] ? ' على ' + DB.profile.phones[0].v : '')]; closeSheet(true); postForm(null, { kind: CFG.postKinds[0], date: today(), vis: 'pub', title: r[l.primary], text: lines.filter((x) => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n'), photos: [] }); }; });
}
const inqFields = () => [{ n: 'from', l: 'اسم صاحب الاستفسار', req: 1, half: 1 }, { n: 'phone', l: 'الهاتف', t: 'tel', half: 1 }, { n: 'text', l: 'الاستفسار', t: 'textarea', req: 1, rows: 4 }, { n: 'date', l: 'التاريخ', t: 'date', half: 1 }, { n: 'status', l: 'الحالة', t: 'select', fix: 1, key: 'inq.status', scope: 'inq', o: ['جديد', 'تم الرد', 'مغلق'], half: 1 }];
function inqForm(i) { const isNew = !i; form(isNew ? 'استفسار جديد' : 'تعديل الاستفسار', inqFields(), i || { date: today(), status: 'جديد' }, (o) => { if (isNew) DB.inquiries.push(Object.assign({ id: uid() }, o)); else Object.assign(i, o); persist(); render(); toast('حُفظ'); }, { del: !isNew, delMsg: 'حذف هذا الاستفسار؟', onDel: () => { DB.inquiries = DB.inquiries.filter((x) => x !== i); persist(); render(); } }); }
function viewInq(i) {
  const reply = `مرحباً ${i.from}، شكراً لتواصلك مع ${DB.profile.name || CFG.name}. بخصوص استفسارك: `;
  const el = sheet(i.from, `<p class="muted">${E(fDate(i.date))} · ${E(i.status)}</p><div class="reader">${E(i.text).replace(/\n/g, '<br>')}</div><div class="actions">${i.phone ? `<a class="btn quiet" href="tel:${E(telClean(i.phone))}">${ic('phone')}اتصال</a><a class="btn pri" data-wa href="https://wa.me/${E(waNum(i.phone))}?text=${encodeURIComponent(reply)}" target="_blank" rel="noopener">${ic('wa')}رد بواتساب</a>` : ''}<span class="grow"></span><button class="btn quiet" data-k="done">${ic('check')}تم الرد</button><button class="btn quiet" data-k="edit">${ic('edit')}</button></div>`, { noFocus: true });
  $('[data-k=done]', el).onclick = () => { i.status = 'تم الرد'; persist(); render(); closeSheet(true); toast('حُدّثت الحالة'); }; $('[data-k=edit]', el).onclick = () => { closeSheet(true); inqForm(i); };
  const w = $('[data-wa]', el); if (w) w.addEventListener('click', () => { if (i.status === 'جديد') { i.status = 'تم الرد'; persist(); render(); } });
}

/* ----- ملفي ----- */
function listRows(k, title, ph) { return `<div class="sec-h"><h3>${title}</h3><button class="btn small quiet" data-act="addC" data-k="${k}">${ic('plus')}إضافة</button></div>${DB.profile[k].length ? `<div class="list">${DB.profile[k].map((c, i) => `<div class="row"><span class="main"><strong dir="auto">${E(c.v)}</strong><small>${E(c.t || '')}</small></span><button class="icon s" data-act="editC" data-k="${k}" data-i="${i}" aria-label="تعديل">${ic('edit')}</button></div>`).join('')}</div>` : `<p class="calm sm">${ph}</p>`}`; }
function vMe() {
  const p = DB.profile;
  return `<section class="card-id me">${avatar(88)}<div class="ci-t"><h1>${E(p.name || 'بلا اسم بعد')}</h1><p>${E(p.kind || CFG.tagline)}</p><div class="qas"><button class="qa" data-act="editMe">${ic('edit')}تعديل الملف</button><button class="qa" data-act="logo">${ic('camera')}الشعار</button></div></div></section>` +
    (p.bio ? `<p class="bio">${E(p.bio)}</p>` : '') +
    `<dl class="facts">${[...(CFG.profileExtra || []).map((f) => [f.l, p.extra[f.n]]), ['العنوان', addrText()], ['العملة', p.cur]].filter((x) => x[1]).map(([k, v]) => `<div><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`).join('')}</dl>` +
    listRows('phones', 'أرقام الهاتف', 'أضف رقماً أو أكثر ليظهر في الكتالوج.') + listRows('emails', 'البريد الإلكتروني', 'أضف بريداً.') + listRows('banks', 'الحسابات البنكية', 'تظهر لعملائك عند السداد.') + listRows('links', 'روابط التواصل', 'واتساب، فيسبوك، تلغرام…') +
    `<div class="sec-h"><h3>الصورة الترحيبية</h3></div><div class="splash-set"><label class="sw"><input type="checkbox" id="sp-on"${p.splash.on ? ' checked' : ''}> تفعيل الصورة الترحيبية</label><select id="sp-mode" aria-label="متى تظهر"><option value="first"${p.splash.mode === 'first' ? ' selected' : ''}>عند الفتح الأول فقط</option><option value="every"${p.splash.mode === 'every' ? ' selected' : ''}>كل مرة تُفتح الإضافة</option></select><div class="foot"><button class="btn quiet small" data-act="splashPick">${ic('img')}اختيار الصورة</button><button class="btn quiet small" data-act="splashTest">معاينة</button><button class="btn quiet small" data-act="splashDel">إزالة</button></div></div>` +
    `<div class="sec-h"><h3>مشاركة ونسخ احتياطي</h3></div><div class="grid2"><button class="btn pri" data-act="exportCatalog">${ic('globe')}كتالوج للمشاركة</button><button class="btn quiet" data-act="shareMe">${ic('share')}مشاركة بطاقتي</button><button class="btn quiet" data-act="export">${ic('down')}نسخة احتياطية</button><button class="btn quiet" data-act="import">${ic('up')}استيراد نسخة</button></div>` +
    `<div class="store"><p id="vuse" class="calm sm">التخزين بلا حد من الإضافة؛ الحد هو سعة جهازك فقط.</p></div>` +
    `<div class="sec-h"><h3>القفل</h3></div><div class="foot"><button class="btn quiet" data-act="lockSet">${ic('lock')}${localStorageLock ? 'تغيير' : 'تفعيل'} قفل الإضافة بكلمة مرور</button></div><p class="note">القفل يحجب الشاشة عن غيرك على جهازك، ولا يشفّر البيانات.</p>`;
}
let localStorageLock = false;
const meFields = () => [{ n: 'name', l: 'اسم الجهة أو الشخص', req: 1 }, { n: 'kind', l: 'النوع', t: 'select', key: 'me.kind', scope: 'me', blank: 1, o: CFG.kinds, half: 1 }, { n: 'cur', l: 'العملة', half: 1 }].concat((CFG.profileExtra || []).map((f) => Object.assign({ half: 1 }, f))).concat([{ n: 'bio', l: 'نبذة أو سيرة', t: 'textarea', rows: 4 }, { n: 'country', l: 'الدولة', half: 1 }, { n: 'gov', l: 'المحافظة', half: 1 }, { n: 'dir', l: 'المديرية', half: 1 }, { n: 'iso', l: 'العزلة أو الحي', half: 1 }, { n: 'street', l: 'الشارع' }, { n: 'map', l: 'رابط الموقع (Google Maps)', t: 'url' }]);
function editMe() {
  const p = DB.profile, vals = Object.assign({}, p.addr, p.extra, { name: p.name, kind: p.kind, cur: p.cur, bio: p.bio, map: p.map });
  form('ملف ' + CFG.name, meFields(), vals, (o) => { p.name = o.name; p.kind = o.kind; p.cur = o.cur || 'ريال'; p.bio = o.bio; p.map = o.map; ['country', 'gov', 'dir', 'iso', 'street'].forEach((k) => { p.addr[k] = o[k]; }); (CFG.profileExtra || []).forEach((f) => { p.extra[f.n] = o[f.n]; }); persist(); render(); toast('حُفظ الملف'); });
}
function contactForm(k, i) {
  const c = i != null ? DB.profile[k][i] : null, L = { phones: ['رقم الهاتف', 'مثال: واتساب، المكتب'], emails: ['البريد', 'مثال: العمل'], banks: ['رقم الحساب أو IBAN', 'اسم البنك'], links: ['الرابط', 'مثال: فيسبوك'] }[k];
  form(c ? 'تعديل' : 'إضافة', [{ n: 'v', l: L[0], req: 1, t: k === 'phones' ? 'tel' : undefined }, { n: 't', l: 'وصف', ph: L[1] }], c || {}, (o) => { if (c) Object.assign(c, o); else DB.profile[k].push(o); persist(); render(); }, { del: !!c, delMsg: 'حذف هذا البند؟', onDel: () => { DB.profile[k].splice(i, 1); persist(); render(); } });
}
async function setLogo() { const [f] = await pickFile('image/*', false); if (!f) return; try { DB.profile.logo = await dataUrlOf(f, 256, 22000); persist(); render(); toast('حُفظ الشعار'); } catch (e) { toast('تعذّر قراءة الصورة'); } }
async function splashPick() { const [f] = await pickFile('image/*', false); if (!f) return; try { const d = await dataUrlOf(f, 900, 70000); await Alaisai.set('splash', d); DB.profile.splash.on = true; persist(); render(); toast('حُفظت الصورة الترحيبية'); } catch (e) { toast('تعذّر الحفظ: ' + (e.message || '')); } }
async function showSplash(force) {
  const p = DB.profile.splash; if (!force && (!p.on || (p.mode === 'first' && DB.seen))) return; let d = null; try { d = await Alaisai.get('splash'); } catch (e) { /* لا شيء */ } if (!d) return;
  const z = document.createElement('div'); z.className = 'splash'; z.innerHTML = `<img alt="" src="${E(d)}"><button class="skip">تخطي</button>`; document.body.appendChild(z);
  const end = () => { z.classList.add('out'); setTimeout(() => z.remove(), 500); }; z.onclick = end; setTimeout(end, 2800); if (!force) { DB.seen = 1; persist(); }
}
const vm = (x) => x;

/* ----- ربط القوائم المنسدلة بالسجلات: عدّ الاستخدام وإعادة التسمية ----- */
function optHolders(f) {
  const sc = f.scope || '';
  if (sc.indexOf('rec:') === 0) return recs(sc.slice(4));
  if (sc === 'post') return DB.posts; if (sc === 'book') return DB.bookings; if (sc === 'inq') return DB.inquiries;
  if (sc === 'me') return [DB.profile]; return [];
}
function optUse(f, v) { return optHolders(f).filter((r) => r[f.n] === v).length; }
function optRename(f, a, b) { optHolders(f).forEach((r) => { if (r[f.n] === a) r[f.n] = b; }); persist(); render(); }
