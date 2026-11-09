'use strict';
/* ===== ملفات الموكلين والقضايا (خزنة الملفات) ===== */
const hasVault = () => !!(window.Alaisai && Alaisai.vault);
const sizeTxt = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب');
const isImg = (t) => /^image\//.test(t || '');
const urls = [];
const mkUrl = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
function freeUrls() { while (urls.length) URL.revokeObjectURL(urls.pop()); }
function fileIcon(t, name) { return isImg(t) ? 'doc' : /pdf/.test(t) ? 'doc' : 'doc'; }
const kindOf = (f) => (isImg(f.type) ? 'صورة' : /pdf/.test(f.type) ? 'PDF' : (f.name.split('.').pop() || 'ملف').slice(0, 5).toUpperCase());

function filesPane(owner, label, kind) {
  const list = owner.files || [];
  if (!hasVault()) return `<p class="note">إرفاق الملفات يحتاج العيسائي برو بالإصدار 2.7.0 أو أحدث. حدّث التطبيق ثم عد إلى هنا.</p>`;
  return `<div class="sec-h"><h3>ملفات ${E(label)}</h3><span class="btns"><button class="btn small quiet" data-act="pickShot" data-kind="${kind}">${ic('cal')}تصوير</button><button class="btn small pri" data-act="pickFiles" data-kind="${kind}">${ic('plus')}إضافة ملفات</button></span></div>` +
    (list.length ? `<div class="files">${list.slice().reverse().map((f) => `<button class="file" data-act="openFile" data-kind="${kind}" data-id="${f.id}"><span class="thumb" data-thumb="${f.id}" data-type="${E(f.type)}">${isImg(f.type) ? '' : `<b>${E(kindOf(f))}</b>`}</span><span class="fn">${E(f.name)}</span><small>${E(sizeTxt(f.size))} · ${E(fShort(f.date))}</small></button>`).join('')}</div>` : `<p class="calm">أضف صور الهوية والعقود والأحكام وأي مستند من ملفات جهازك أو بالكاميرا. تبقى على جهازك فقط.</p>`) +
    `<p class="note">الملفات محفوظة على هذا الجهاز ولا تدخل في النسخة الاحتياطية JSON ولا في المزامنة. انسخها بنفسك من زر التنزيل إن احتجت.</p>`;
}
async function hydrateThumbs() {
  if (!hasVault()) return;
  for (const el of $$('[data-thumb]')) {
    if (!isImg(el.dataset.type)) continue;
    try { const r = await Alaisai.vault.get(el.dataset.thumb); if (r && el.isConnected) { el.innerHTML = `<img alt="" src="${mkUrl(r.blob)}">`; } } catch (e) { /* لا شيء */ }
  }
}
function ownerOf(kind) { return kind === 'client' ? client(S.clientId) : caseById(S.caseId); }
let pending = null;
function pickFiles(kind, shot) {
  pending = kind; const i = $('#fpick'); i.value = ''; if (shot) i.setAttribute('capture', 'environment'); else i.removeAttribute('capture');
  i.accept = shot ? 'image/*' : '*/*'; i.multiple = !shot; i.click();
}
async function onPicked(files) {
  const o = ownerOf(pending); if (!o || !files.length) return;
  let ok = 0, bad = '';
  for (const f of files) {
    if (f.size > 25 * 1048576) { bad = f.name + ' أكبر من 25 م.ب'; continue; }
    const id = 'f' + uid();
    try { await Alaisai.vault.put(id, f, f.name); o.files.push({ id, name: f.name || 'ملف', type: f.type || 'application/octet-stream', size: f.size, date: today(), note: '' }); ok++; }
    catch (e) { bad = (e && e.message) || 'تعذّر الحفظ'; break; }
  }
  if (ok) { persist(); render(); }
  toast(ok ? 'أُضيف ' + ok + (ok > 1 ? ' ملفات' : ' ملف') + (bad ? '، وتعذّر: ' + bad : '') : bad || 'لم يُختر شيء');
}
async function saveBlob(blob, name) { const a = document.createElement('a'); a.href = mkUrl(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
async function shareBlob(blob, name, text) {
  try { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name, text: text || '' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  saveBlob(blob, name); toast('المشاركة المباشرة غير متاحة هنا، نُزّل الملف لترسله');
}
async function openFile(kind, id) {
  const o = ownerOf(kind), m = o.files.find((x) => x.id === id); if (!m) return;
  const r = await Alaisai.vault.get(id).catch(() => null); if (!r) return toast('الملف غير موجود على هذا الجهاز');
  const el = sheet(m.name, `<div class="viewer">${isImg(m.type) ? `<img alt="${E(m.name)}" src="${mkUrl(r.blob)}">` : `<div class="bigk">${E(kindOf(m))}</div>`}</div><p class="muted">${E(sizeTxt(m.size))} · ${E(fDate(m.date))}${m.note ? '<br>' + E(m.note) : ''}</p><div class="actions"><button class="btn danger" data-d>${ic('trash')}حذف</button><button class="btn quiet" data-e>${ic('edit')}تسمية</button><span class="grow"></span><button class="btn quiet" data-s>مشاركة</button><button class="btn pri" data-dl>${ic('down')}تنزيل</button></div>`, { wide: true, noFocus: true });
  $('[data-dl]', el).onclick = () => saveBlob(r.blob, m.name);
  $('[data-s]', el).onclick = () => shareBlob(r.blob, m.name);
  $('[data-e]', el).onclick = () => { closeSheet(); form('اسم الملف', [{ n: 'name', l: 'الاسم', req: 1 }, { n: 'note', l: 'ملاحظة', t: 'textarea' }], m, (v) => { Object.assign(m, v); persist(); render(); }); };
  $('[data-d]', el).onclick = async () => { if (await ask('حذف هذا الملف من الجهاز؟', 'حذف')) { try { await Alaisai.vault.remove(id); } catch (e) { /* لا شيء */ } o.files = o.files.filter((x) => x !== m); closeSheet(); persist(); render(); } };
}
async function dropFiles(arr) { for (const f of arr || []) { try { await Alaisai.vault.remove(f.id); } catch (e) { /* لا شيء */ } } }

/* ===== المكتبة العامة (من مالك الإضافة) ===== */
const Lib = { data: null, sec: 'all', q: '' };
function libLoad() {
  if (Lib.data) return Lib.data;
  let d = null; try { d = JSON.parse(Alaisai.file('library/index.json') || 'null'); } catch (e) { d = null; }
  d = d && typeof d === 'object' ? d : {};
  const secs = (Array.isArray(d.sections) ? d.sections : []).filter((x) => x && x.id && x.title);
  Lib.data = { owner: d.owner || {}, title: d.title || 'المكتبة', sections: secs, posts: Array.isArray(d.posts) ? d.posts : [], items: (Array.isArray(d.items) ? d.items : []).filter((i) => i && i.title) };
  return Lib.data;
}
const ext = (n) => (String(n || '').split('.').pop() || '').toLowerCase();
function libBlob(path) {
  const c = Alaisai.file(path); if (c == null) return null;
  const m = /^data:([^;,]+);base64,(.*)$/.exec(c);
  if (m) { const b = atob(m[2]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Blob([u], { type: m[1] }); }
  return new Blob([c], { type: 'text/plain;charset=utf-8' });
}
function vLib() {
  const L = libLoad(), q = norm(Lib.q);
  const items = L.items.filter((i) => (Lib.sec === 'all' || i.section === Lib.sec) && (!q || norm(i.title + ' ' + (i.desc || '')).includes(q)));
  const secName = (id) => (L.sections.find((s) => s.id === id) || {}).title || '';
  const has = L.items.length || L.posts.length;
  return `<div class="lib-h"><div><h2>${E(L.title)}</h2>${L.owner.name ? `<small>من ${E(L.owner.name)}</small>` : ''}</div><button class="btn pri small" data-act="msgOwner">${ic('phone')}راسل المالك</button></div>` +
    (!has ? empty('المكتبة فارغة', 'يضيف مالك التطبيق هنا المنشورات والكتب والنماذج، وتصلك مع تحديث الإضافة.') : '') +
    (L.posts.length ? `<div class="posts">${L.posts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3).map((p) => `<article class="post"><small>${E(fDate(p.date))}</small><h3>${E(p.title)}</h3><p>${E(p.text)}</p></article>`).join('')}</div>` : '') +
    (L.items.length ? `<div class="bar"><label class="search">${ic('search')}<input id="lq" type="search" placeholder="ابحث في المكتبة" value="${E(Lib.q)}" autocomplete="off"></label></div><div class="chips"><button class="chip${Lib.sec === 'all' ? ' on' : ''}" data-act="libSec" data-k="all">الكل</button>${L.sections.map((s) => `<button class="chip${Lib.sec === s.id ? ' on' : ''}" data-act="libSec" data-k="${E(s.id)}">${E((s.icon || '') + ' ' + s.title)}</button>`).join('')}</div>` +
      (items.length ? `<div class="list">${items.map((i) => `<button class="row" data-act="libItem" data-id="${E(i.id || i.title)}"><span class="av sq">${E((L.sections.find((s) => s.id === i.section) || {}).icon || '📄')}</span><span class="main"><strong>${E(i.title)}</strong><small>${E([secName(i.section), i.desc].filter(Boolean).join('  ·  '))}</small></span>${i.date ? `<span class="tag">${E(fShort(i.date))}</span>` : ''}</button>`).join('')}</div>` : '<p class="calm">لا نتائج.</p>') : '');
}
function libItem(id) {
  const L = libLoad(), it = L.items.find((i) => (i.id || i.title) === id); if (!it) return;
  const b = it.file ? libBlob(it.file) : null, e = ext(it.file), name = it.title + (e ? '.' + e : '');
  const text = b && /^(txt|md|html?)$/.test(e) ? Alaisai.file(it.file) : (it.text || '');
  const body = b && /^(png|jpe?g|gif|webp|svg)$/i.test(e) ? `<div class="viewer"><img alt="${E(it.title)}" src="${mkUrl(b)}"></div>` : text ? `<div class="reader">${E(String(text).replace(/<[^>]+>/g, '')).replace(/\n/g, '<br>')}</div>` : `<div class="viewer"><div class="bigk">${E((e || 'ملف').toUpperCase())}</div></div>`;
  const el = sheet(it.title, `${it.desc ? `<p class="muted">${E(it.desc)}</p>` : ''}${body}<div class="actions">${/^(txt|md)$/.test(e) && b ? '<button class="btn quiet" data-tpl>' + ic('doc') + 'احفظه كنموذج لي</button>' : ''}<span class="grow"></span><button class="btn quiet" data-s>مشاركة</button>${b ? `<button class="btn pri" data-dl>${ic('down')}تنزيل</button>` : ''}</div>`, { wide: true, noFocus: true });
  const blob = b || new Blob([text], { type: 'text/plain;charset=utf-8' }), fname = b ? name : it.title + '.txt';
  $('[data-s]', el).onclick = () => shareBlob(blob, fname, it.title);
  const dl = $('[data-dl]', el); if (dl) dl.onclick = () => saveBlob(blob, fname);
  const tp = $('[data-tpl]', el); if (tp) tp.onclick = () => { DB.tpls.push({ id: 'u' + uid(), name: it.title, body: String(text) }); persist(); toast('أُضيف إلى «نماذجي» في الأدوات'); };
}
function msgOwner() {
  const o = libLoad().owner || {}, wa = String(o.whatsapp || '').replace(/[^\d]/g, ''), mail = String(o.email || '');
  const el = sheet('مراسلة المالك', `${wa || mail ? '' : '<p class="note">لم يضبط المالك وسيلة تواصل بعد. يمكنك نسخ رسالتك وإرسالها بأي طريقة.</p>'}<form class="frm" novalidate><label class="fld"><span>الموضوع</span><input name="s" autocomplete="off" placeholder="مثال: طلب نموذج أو استفسار"></label><label class="fld"><span>رسالتك</span><textarea name="m" rows="6" required></textarea></label><div class="actions"><button type="button" class="btn quiet" data-c>نسخ</button><span class="grow"></span>${mail ? '<a class="btn quiet" data-mail target="_blank" rel="noopener">بريد</a>' : ''}${wa ? `<a class="btn pri" data-wa target="_blank" rel="noopener">واتساب</a>` : ''}</div></form>`, { noFocus: true });
  const f = $('form', el), txt = () => (f.elements.s.value ? f.elements.s.value + '\n\n' : '') + f.elements.m.value + (DB.s.lawyer ? '\n\n— ' + DB.s.lawyer : '');
  const upd = () => { const w = $('[data-wa]', el), m = $('[data-mail]', el); if (w) w.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(txt()); if (m) m.href = 'mailto:' + mail + '?subject=' + encodeURIComponent(f.elements.s.value) + '&body=' + encodeURIComponent(f.elements.m.value); };
  f.addEventListener('input', upd); upd();
  $('[data-c]', el).onclick = async () => { try { await navigator.clipboard.writeText(txt()); toast('نُسخت الرسالة'); } catch (e) { f.elements.m.select(); toast('حدّد النص وانسخه'); } };
}
