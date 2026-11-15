'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = (s) => String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const IC = {
  vault: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8v-1.6M12 16.8v-1.6M8.8 12H7.2M16.8 12h-1.6M7 19.500V21M17 19.500V21"/>',
  lock: '<rect x="5" y="10.500" width="14" height="9.500" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M15.500 8.500V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.500a2 2 0 0 0 2 2h2.500"/>',
  eye: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>',
  eyeoff: '<path d="M3 3l18 18M10 6a9 9 0 0 1 2-.5C18 5.500 21.500 12 21.500 12a17 17 0 0 1-3.200 4M6.300 7.700A17 17 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 3.500-.7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>', chev: '<path d="M6 9l6 6 6-6"/>', down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n].replace(/(\d)\.(\d)00/g, '$1.$2')}</svg>`;

/* ===== الحالة ===== */
let META = { title: 'الخزنة الرقمية', auto: 2 }, REC = null, KEY = null, SALT = null, IT = ITER, D = null, query = '';
const shown = new Set(); let fails = 0, idleT = 0, hideT = 0, toastT = 0;
const starter = () => ({ sections: [{ id: 's' + uid(), title: 'مرحباً بك في الخزنة', badge: 'قسم توضيحي', collapsed: false, items: [
  { id: 'i' + uid(), title: 'دليل البداية', val: 'احذف هذا القسم أو أضف أقسامك وعناصرك بالأزرار أعلاه. كل شيء مشفّر بكلمة مرورك.', link: false, sens: false },
  { id: 'i' + uid(), title: 'رابط تجريبي', val: 'https://example.com', link: true, sens: false },
  { id: 'i' + uid(), title: 'كود سرّي تجريبي', val: 'EXAMPLE-SECRET-2026', link: false, sens: true }] }] });
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
async function save() { REC = await sealWith(KEY, SALT, IT, D); await Alaisai.set('vault', REC); }
async function saveMeta() { await Alaisai.set('meta', META); }
function safeUrl(v) {
  const s = String(v || '').trim(); if (!s || /\s/.test(s)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(s)) return 'https://' + s;
  return null;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (x) { /* لا شيء */ } t.remove(); }
  toast('تم النسخ');
}

/* ===== القفل ===== */
function dial() {
  const ticks = Array.from({ length: 36 }, (_, i) => `<line x1="60" y1="${i % 3 ? 9 : 5}" x2="60" y2="14" transform="rotate(${i * 10} 60 60)"/>`).join('');
  return `<div class="dial" aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="ring" cx="60" cy="60" r="55"/><g class="tick">${ticks}</g><circle class="core" cx="60" cy="60" r="30"/></svg>${ic('lock', 'dl')}</div>`;
}
function renderLock(msg) {
  const L = $('#lock'); $('#app').hidden = true; L.hidden = false; document.title = META.title;
  const first = !REC;
  L.innerHTML = `<div class="gate">${dial()}<h1>${E(META.title)}</h1><p class="sub">${first ? 'أنشئ كلمة مرور لحماية بياناتك' : 'أدخل كلمة المرور لفتح الخزنة'}</p><form id="lf" novalidate autocomplete="off"><input type="password" id="p1" placeholder="${first ? 'كلمة مرور جديدة' : 'كلمة المرور'}" autocomplete="${first ? 'new-password' : 'current-password'}" aria-label="كلمة المرور">${first ? `<div class="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></div><input type="password" id="p2" placeholder="أعد كتابة كلمة المرور" autocomplete="new-password" aria-label="تأكيد كلمة المرور"><p class="warn">لا يمكن استرجاع الخزنة إن نسيت كلمة المرور. اكتبها في مكان آمن.</p>` : ''}<p class="err" id="lerr" role="alert">${E(msg || '')}</p><button class="btn pri" type="submit" id="lbtn">${first ? 'إنشاء الخزنة' : 'فتح الخزنة'}</button></form></div>`;
  const f = $('#lf'), p1 = $('#p1');
  if (first) p1.addEventListener('input', () => { const s = strength(p1.value); $$('.meter i').forEach((e, i) => { e.className = i < s ? 's' + s : ''; }); });
  f.addEventListener('submit', first ? setup : unlock);
  setTimeout(() => p1.focus(), 50);
}
function busy(on) { const g = $('.gate'); if (g) g.classList.toggle('busy', on); const b = $('#lbtn'); if (b) { b.disabled = on; b.textContent = on ? 'جارٍ التحقق…' : (REC ? 'فتح الخزنة' : 'إنشاء الخزنة'); } }
const lerr = (m) => { const e = $('#lerr'); if (e) e.textContent = m; };
async function setup(e) {
  e.preventDefault(); const a = $('#p1').value, b = $('#p2').value;
  if (a.length < 6) return lerr('كلمة المرور قصيرة، استخدم 6 أحرف على الأقل.');
  if (a !== b) return lerr('كلمتا المرور غير متطابقتين.');
  busy(true);
  try { SALT = crypto.getRandomValues(new Uint8Array(16)); IT = ITER; KEY = await deriveKey(a, SALT, IT); D = starter(); await save(); await saveMeta(); enter(); }
  catch (x) { busy(false); lerr('تعذّر إنشاء الخزنة على هذا المتصفح.'); }
}
async function unlock(e) {
  e.preventDefault(); const pw = $('#p1').value; if (!pw) return lerr('أدخل كلمة المرور.');
  busy(true);
  try {
    const salt = unb64(REC.s), key = await deriveKey(pw, salt, REC.it || ITER), data = await openWith(key, REC);
    SALT = salt; IT = REC.it || ITER; KEY = key; D = data; fails = 0; enter();
  } catch (x) {
    fails++; const wait = Math.min(8, fails * 1.5);
    renderLock('كلمة المرور غير صحيحة.'); $('.gate').classList.add('shake');
    const b = $('#lbtn'); b.disabled = true; setTimeout(() => { if (b.isConnected) b.disabled = false; }, wait * 1000);
  }
}
function lock(msg) {
  KEY = null; D = null; SALT = null; shown.clear(); query = ''; closeSheet();
  $('#sections').innerHTML = ''; renderLock(msg);
}
function enter() {
  $('#lock').hidden = true; $('#app').hidden = false; document.title = META.title; render(); poke();
  const d = $('#bar .ic.brand'); if (d) d.classList.add('turn');
}
function poke() { clearTimeout(idleT); if (KEY && META.auto > 0) idleT = setTimeout(() => lock('أُقفلت الخزنة تلقائياً بعد فترة خمول.'), META.auto * 60000); }
['pointerdown', 'keydown', 'scroll'].forEach((ev) => addEventListener(ev, poke, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden && KEY) { clearTimeout(hideT); hideT = setTimeout(() => { if (document.hidden && KEY) lock('أُقفلت الخزنة لأنك غادرت الشاشة.'); }, 30000); } else clearTimeout(hideT); });

/* ===== العرض ===== */
function render() {
  $('#bar').innerHTML = `<div class="brand">${ic('vault', 'brand')}<div><h1>${E(META.title)}</h1><small>${D.sections.reduce((a, s) => a + s.items.length, 0)} عنصر في ${D.sections.length} قسم</small></div></div><label class="search">${ic('search')}<input id="q" type="search" placeholder="ابحث بالعنوان أو القسم" value="${E(query)}" autocomplete="off" aria-label="بحث"></label><div class="acts"><button class="btn quiet" data-a="newSec">${ic('plus')}<span>قسم</span></button><button class="btn pri" data-a="newItem">${ic('plus')}<span>عنصر</span></button><button class="icon" data-a="settings" aria-label="الإعدادات">${ic('gear')}</button><button class="icon" data-a="lock" aria-label="قفل الخزنة">${ic('lock')}</button></div>`;
  drawSections(); const q = $('#q'); q.addEventListener('input', () => { query = q.value; drawSections(); });
}
function matchItem(it, s, q) { return norm(it.title + ' ' + s.title + ' ' + s.badge + ' ' + (it.sens ? '' : it.val)).includes(q); }
function drawSections() {
  const q = norm(query.trim()), root = $('#sections');
  if (!D.sections.length) { root.innerHTML = `<div class="empty"><div class="mark">${ic('vault')}</div><h2>الخزنة فارغة</h2><p>أنشئ قسماً ثم أضف إليه روابطك وحساباتك وأكوادك.</p><button class="btn pri" data-a="newSec">${ic('plus')}قسم جديد</button></div>`; return; }
  const html = D.sections.map((s) => {
    const items = q ? s.items.filter((it) => matchItem(it, s, q)) : s.items;
    if (q && !items.length && !norm(s.title + s.badge).includes(q)) return '';
    const open = q ? true : !s.collapsed;
    return `<section class="drawer${open ? '' : ' shut'}" data-sec="${s.id}"><header><button class="dh" data-a="fold" data-id="${s.id}" aria-expanded="${open}">${ic('chev', 'fold')}<h2>${E(s.title)}</h2><span class="plate">${E(s.badge)}</span><small>${s.items.length}</small></button><button class="icon" data-a="editSec" data-id="${s.id}" aria-label="تعديل القسم ${E(s.title)}">${ic('edit')}</button></header>${open ? `<div class="rows">${items.length ? items.map((it) => row(it)).join('') : `<p class="none">${s.items.length ? 'لا نتائج في هذا القسم.' : 'لا عناصر بعد.'} <button class="lnk" data-a="newItem" data-sec="${s.id}">أضف عنصراً</button></p>`}</div>` : ''}</section>`;
  }).join('');
  root.innerHTML = html || `<div class="empty"><h2>لا نتائج</h2><p>جرّب كلمة أخرى.</p></div>`;
}
function row(it) {
  const url = it.link ? safeUrl(it.val) : null, hid = it.sens && !shown.has(it.id);
  const val = hid ? '<span class="mask" aria-label="قيمة مخفية">••••••••••</span>' : url ? `<a class="val link" href="${E(url)}" target="_blank" rel="noopener noreferrer">${E(it.val)}</a>` : `<span class="val${it.sens ? ' sens' : ''}" dir="auto">${E(it.val)}</span>`;
  return `<div class="item"><div class="it-b"><small>${E(it.title)}</small>${val}</div><div class="it-a">${it.sens ? `<button class="icon s" data-a="reveal" data-id="${it.id}" aria-label="${hid ? 'إظهار' : 'إخفاء'}" aria-pressed="${!hid}">${ic(hid ? 'eye' : 'eyeoff')}</button>` : ''}<button class="icon s" data-a="copy" data-id="${it.id}" aria-label="نسخ ${E(it.title)}">${ic('copy')}</button>${url ? `<a class="icon s" href="${E(url)}" target="_blank" rel="noopener noreferrer" aria-label="فتح الرابط">${ic('ext')}</a>` : ''}<button class="icon s" data-a="editItem" data-id="${it.id}" aria-label="تعديل ${E(it.title)}">${ic('edit')}</button></div></div>`;
}
const findItem = (id) => { for (const s of D.sections) { const it = s.items.find((x) => x.id === id); if (it) return { s, it }; } return null; };

/* ===== النوافذ ===== */
let sheetEl = null, lastF = null;
function sheet(title, html) {
  closeSheet(); lastF = document.activeElement; const r = $('#sheet-root');
  r.innerHTML = `<div class="veil" data-close></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${E(title)}"><header><h2>${E(title)}</h2><button class="icon" data-close aria-label="إغلاق">${ic('x')}</button></header><div class="sheet-b">${html}</div></section>`;
  sheetEl = r.lastElementChild; r.onclick = (e) => { if (e.target.closest('[data-close]')) closeSheet(); };
  const f = $('input:not([type=hidden]):not([type=checkbox]),textarea,select', sheetEl); if (f) setTimeout(() => f.focus({ preventScroll: true }), 60); return sheetEl;
}
function closeSheet() { $('#sheet-root').innerHTML = ''; sheetEl = null; if (lastF && lastF.focus) try { lastF.focus({ preventScroll: true }); } catch (e) { /* لا شيء */ } lastF = null; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetEl) { e.preventDefault(); closeSheet(); } });
function ask(msg, ok = 'تأكيد') {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'ask'; d.innerHTML = `<div class="veil"></div><div class="box" role="alertdialog" aria-label="${E(msg)}"><p>${E(msg)}</p><div class="acts2"><button class="btn quiet" data-n>إلغاء</button><button class="btn danger" data-y>${E(ok)}</button></div></div>`;
    document.body.appendChild(d); const done = (v) => { d.remove(); res(v); };
    $('[data-y]', d).onclick = () => done(true); $('[data-n]', d).onclick = () => done(false); $('.veil', d).onclick = () => done(false);
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } }); $('[data-n]', d).focus();
  });
}
const fld = (n, l, v = '', x = '') => `<label class="fld"><span>${l}</span><input name="${n}" value="${E(v)}" autocomplete="off" ${x}></label>`;

function secForm(s) {
  const el = sheet(s ? 'تعديل القسم' : 'قسم جديد', `<form class="frm" novalidate>${fld('title', 'اسم القسم', s ? s.title : '', 'placeholder="مثال: حسابات التواصل"')}${fld('badge', 'الوسم (يظهر كلوحة نحاسية)', s ? s.badge : '', 'placeholder="مثال: شخصي"')}<div class="acts2">${s ? '<button type="button" class="btn danger" data-del>حذف القسم</button>' : ''}<span class="grow"></span><button type="button" class="btn quiet" data-close>إلغاء</button><button class="btn pri" type="submit">حفظ</button></div></form>`);
  $('form', el).onsubmit = async (e) => { e.preventDefault(); const f = e.target.elements, title = f.title.value.trim(); if (!title) { f.title.classList.add('bad'); return f.title.focus(); } const badge = f.badge.value.trim() || 'عام'; if (s) { s.title = title; s.badge = badge; } else D.sections.push({ id: 's' + uid(), title, badge, collapsed: false, items: [] }); closeSheet(); await save(); render(); toast('حُفظ القسم'); };
  const d = $('[data-del]', el); if (d) d.onclick = async () => { if (await ask('سيُحذف القسم وكل ما فيه (' + s.items.length + ' عنصر). متأكد؟', 'حذف')) { D.sections = D.sections.filter((x) => x !== s); closeSheet(); await save(); render(); toast('حُذف القسم'); } };
}
function itemForm(it, sec) {
  if (!D.sections.length) return secForm();
  const cur = it ? findItem(it.id).s : (sec || D.sections[0]);
  const el = sheet(it ? 'تعديل العنصر' : 'عنصر جديد', `<form class="frm" novalidate><label class="fld"><span>القسم</span><select name="sec">${D.sections.map((s) => `<option value="${s.id}"${s === cur ? ' selected' : ''}>${E(s.title)}</option>`).join('')}</select></label>${fld('title', 'العنوان أو اسم الخدمة', it ? it.title : '')}<label class="fld"><span>القيمة (رابط أو اسم مستخدم أو كود)</span><div class="with"><textarea name="val" rows="2">${E(it ? it.val : '')}</textarea><button type="button" class="btn quiet small" data-gen>${ic('dice')}توليد</button></div></label><div class="checks"><label><input type="checkbox" name="link"${it && it.link ? ' checked' : ''}> رابط قابل للنقر</label><label><input type="checkbox" name="sens"${!it || it.sens ? ' checked' : ''}> سرّي (يُخفى حتى تكشفه)</label></div><div class="acts2">${it ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span class="grow"></span><button type="button" class="btn quiet" data-close>إلغاء</button><button class="btn pri" type="submit">حفظ</button></div></form>`);
  const f = $('form', el); $('[data-gen]', el).onclick = () => { f.elements.val.value = genPass(); f.elements.sens.checked = true; f.elements.link.checked = false; };
  f.onsubmit = async (e) => {
    e.preventDefault(); const x = f.elements, title = x.title.value.trim(), val = x.val.value.trim();
    if (!title || !val) { (title ? x.val : x.title).classList.add('bad'); (title ? x.val : x.title).focus(); return toast('أكمل العنوان والقيمة'); }
    const to = D.sections.find((s) => s.id === x.sec.value), data = { title, val, link: x.link.checked, sens: x.sens.checked };
    if (it) { const from = findItem(it.id).s; Object.assign(it, data); if (from !== to) { from.items = from.items.filter((y) => y !== it); to.items.push(it); } } else to.items.push(Object.assign({ id: 'i' + uid() }, data));
    to.collapsed = false; closeSheet(); await save(); render(); toast('حُفظ العنصر');
  };
  const d = $('[data-del]', el); if (d) d.onclick = async () => { if (await ask('حذف «' + it.title + '» نهائياً؟', 'حذف')) { const s = findItem(it.id).s; s.items = s.items.filter((y) => y !== it); shown.delete(it.id); closeSheet(); await save(); render(); toast('حُذف العنصر'); } };
}
function settings() {
  const el = sheet('إعدادات الخزنة', `<form class="frm" id="sf" novalidate>${fld('title', 'عنوان الخزنة', META.title)}<label class="fld"><span>القفل التلقائي عند الخمول</span><select name="auto">${[[1, 'دقيقة'], [2, 'دقيقتان'], [5, '5 دقائق'], [15, '15 دقيقة'], [0, 'بلا قفل تلقائي']].map(([v, l]) => `<option value="${v}"${META.auto === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><div class="acts2"><span class="grow"></span><button class="btn pri" type="submit">حفظ الإعدادات</button></div></form>
  <h3 class="sh">النسخ الاحتياطي</h3><div class="grid2"><button class="btn quiet" data-a2="exp">${ic('down')}تصدير مشفّر</button><button class="btn quiet" data-a2="imp">${ic('up')}استيراد</button></div><button class="lnk" data-a2="plain">تصدير غير مشفّر (خطر)</button><input id="impf" type="file" accept=".json,application/json" hidden>
  <h3 class="sh">كلمة المرور</h3><form class="frm" id="pf" novalidate><label class="fld"><span>كلمة مرور جديدة</span><input type="password" name="a" autocomplete="new-password"></label><label class="fld"><span>تأكيدها</span><input type="password" name="b" autocomplete="new-password"></label><div class="acts2"><span class="grow"></span><button class="btn quiet" type="submit">تغيير كلمة المرور</button></div></form>
  <h3 class="sh">منطقة الخطر</h3><button class="btn danger" data-a2="erase">${ic('x')}مسح الخزنة بالكامل</button>`);
  $('#sf', el).onsubmit = async (e) => { e.preventDefault(); const t = e.target.elements.title.value.trim(); if (t) META.title = t.slice(0, 40); META.auto = Number(e.target.elements.auto.value); await saveMeta(); closeSheet(); render(); poke(); toast('حُفظت الإعدادات'); };
  $('#pf', el).onsubmit = async (e) => { e.preventDefault(); const a = e.target.elements.a.value, b = e.target.elements.b.value; if (a.length < 6) return toast('كلمة المرور قصيرة، 6 أحرف على الأقل'); if (a !== b) return toast('كلمتا المرور غير متطابقتين'); try { SALT = crypto.getRandomValues(new Uint8Array(16)); KEY = await deriveKey(a, SALT, IT); await save(); closeSheet(); toast('تم تغيير كلمة المرور'); } catch (x) { toast('تعذّر التغيير'); } };
  const imp = $('#impf', el);
  el.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-a2]'); if (!k) return; const a = k.dataset.a2;
    if (a === 'exp') { download('نسخة-الخزنة-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(Object.assign({ format: 'alaisai-vault' }, REC))); toast('نُزّلت نسخة مشفّرة'); }
    if (a === 'plain') { if (await ask('سيحوي الملف كل كلماتك السرية بلا تشفير. احذفه بعد الاستعمال. متابعة؟', 'تصدير')) download('خزنة-غير-مشفرة.json', JSON.stringify({ format: 'alaisai-vault-plain', sections: D.sections }, null, 2)); }
    if (a === 'imp') imp.click();
    if (a === 'erase') { if (await ask('سيُمسح كل ما في الخزنة ولا يمكن التراجع. تأكد أن لديك نسخة احتياطية.', 'مسح')) { await Alaisai.remove('vault'); REC = null; closeSheet(); lock(); toast('مُسحت الخزنة'); } }
  });
  imp.onchange = () => { const f = imp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => importData(String(r.result)); r.readAsText(f); imp.value = ''; };
}
function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function cleanSections(arr) {
  return (Array.isArray(arr) ? arr : []).filter((s) => s && typeof s.title === 'string').slice(0, 200).map((s) => ({ id: 's' + uid(), title: String(s.title).slice(0, 80), badge: String(s.badge || 'عام').slice(0, 40), collapsed: false,
    items: (Array.isArray(s.items) ? s.items : []).filter((i) => i && i.title != null && i.val != null).slice(0, 500).map((i) => ({ id: 'i' + uid(), title: String(i.title).slice(0, 120), val: String(i.val).slice(0, 4000), link: !!(i.link || i.isLink), sens: !!(i.sens || i.isSensitive) })) }));
}
async function importData(txt) {
  let o; try { o = JSON.parse(txt); } catch (e) { return toast('الملف ليس JSON صالحاً'); }
  let secs = null;
  if (o && o.format === 'alaisai-vault' && o.ct) {
    const el = sheet('كلمة مرور النسخة', `<form class="frm" novalidate><label class="fld"><span>كلمة المرور التي شُفّرت بها النسخة</span><input type="password" name="p" autocomplete="off"></label><p class="note">تُدمج الأقسام الموجودة في النسخة مع خزنتك الحالية، ولا يُحذف شيء.</p><div class="acts2"><span class="grow"></span><button class="btn pri" type="submit">استيراد</button></div></form>`);
    $('form', el).onsubmit = async (e) => { e.preventDefault(); try { const k = await deriveKey(e.target.elements.p.value, unb64(o.s), o.it || ITER); const d = await openWith(k, o); merge(cleanSections(d.sections)); } catch (x) { toast('كلمة المرور غير صحيحة أو الملف تالف'); } };
    return;
  }
  if (o && o.format === 'alaisai-vault-plain') secs = cleanSections(o.sections);
  else if (o && typeof o === 'object' && !Array.isArray(o)) secs = cleanSections(Object.values(o)); // صيغة الخزنة القديمة (sec_*)
  if (!secs || !secs.length) return toast('لا أقسام صالحة في هذا الملف');
  merge(secs);
}
async function merge(secs) { D.sections.push(...secs); closeSheet(); await save(); render(); toast('أُضيف ' + secs.length + ' قسم من النسخة'); }

/* ===== الأحداث ===== */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-a]'); if (!b || e.target.closest('#sheet-root')) return; const a = b.dataset.a, id = b.dataset.id;
  if (a === 'lock') return lock();
  if (a === 'settings') return settings();
  if (a === 'newSec') return secForm();
  if (a === 'newItem') return itemForm(null, b.dataset.sec ? D.sections.find((s) => s.id === b.dataset.sec) : null);
  if (a === 'fold') { const s = D.sections.find((x) => x.id === id); s.collapsed = !s.collapsed; drawSections(); save(); return; }
  if (a === 'editSec') return secForm(D.sections.find((x) => x.id === id));
  const f = findItem(id); if (!f) return;
  if (a === 'editItem') return itemForm(f.it);
  if (a === 'copy') return copy(f.it.val);
  if (a === 'reveal') { if (shown.has(id)) shown.delete(id); else { shown.add(id); setTimeout(() => { shown.delete(id); if (KEY) drawSections(); }, 20000); } drawSections(); }
});
(async () => {
  try { META = Object.assign(META, await Alaisai.get('meta') || {}); REC = await Alaisai.get('vault'); } catch (e) { /* أول تشغيل */ }
  if (!(window.crypto && crypto.subtle)) { $('#lock').hidden = false; $('#lock').innerHTML = '<div class="gate"><h1>التشفير غير متاح</h1><p class="sub">هذا المتصفح لا يدعم WebCrypto. حدّثه ثم أعد المحاولة.</p></div>'; return; }
  renderLock();
})();
