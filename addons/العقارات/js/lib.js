'use strict';
/* ===== أدوات عامة ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => iso(new Date());
const parseD = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parseD(a) - parseD(b)) / 864e5);
const fDate = (s) => (s ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseD(s)) : '');
const fShort = (s) => (s ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short' }).format(parseD(s)) : '');
const fDay = (s) => (s ? new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long' }).format(parseD(s)) : '');
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,،\s]/g, '')); return isFinite(n) ? n : 0; };
const fNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0);
const money = (n) => fNum(n) + ' ' + (DB.profile.cur || '');
const norm = (s) => String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const rel = (s) => { const n = diff(s, today()); if (n === 0) return 'اليوم'; if (n === 1) return 'غداً'; if (n === 2) return 'بعد يومين'; if (n > 2 && n <= 10) return 'بعد ' + n + ' أيام'; if (n > 10) return 'بعد ' + n + ' يوماً'; if (n === -1) return 'أمس'; if (n === -2) return 'قبل يومين'; if (n >= -10) return 'قبل ' + (-n) + ' أيام'; return 'قبل ' + (-n) + ' يوماً'; };
const telClean = (s) => String(s || '').replace(/[^\d+]/g, '');
const waNum = (s) => telClean(s).replace(/^\+/, '').replace(/^00/, '');

/* ===== الأيقونات ===== */
const IC = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  dots: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeoff: '<path d="M3 3l18 18M10 6a9 9 0 0 1 2-.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3.2 4M6.3 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.5-.7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3.2 3 13.8 0 17M12 3.5c-3 3.2-3 13.8 0 17"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  img: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.900c.6.5 1 1.200 1 2.100h5c0-.9.4-1.600 1-2.100A6 6 0 0 0 12 3z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.9-2.5.9-2.5 2 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>',
  chev: '<path d="M6 9l6 6 6-6"/>', back: '<path d="M9 5l7 7-7 7"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  wa: '<path d="M4 20l1.2-4A8 8 0 1 1 8 18.8z"/><path d="M9 9.500c0 3 2.500 5.500 5.500 5.500l1-1.500-2-1-.8.800c-.8-.4-1.600-1.200-2-2l.8-.8-1-2z"/>',
  star: '<path d="M12 4l2.4 5 5.600.7-4.100 3.800 1.100 5.500L12 16.300 7 19l1.100-5.500L4 9.700 9.600 9z"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ===== البيانات ===== */
const LIMIT = 256 * 1024;
const DB = { profile: { name: '', kind: '', bio: '', cur: 'ريال', phones: [], emails: [], banks: [], links: [], addr: {}, map: '', extra: {}, splash: { on: false, mode: 'first' } }, lists: {}, opts: {}, bookings: [], inquiries: [], posts: [], seen: 0 };
const Meta = { bytes: 0, full: false };
const emptyProfile = () => ({ name: '', kind: '', bio: '', cur: 'ريال', phones: [], emails: [], banks: [], links: [], addr: {}, map: '', extra: {}, splash: { on: false, mode: 'first' } });
function normalize(o) {
  const x = o && typeof o === 'object' ? o : {};
  DB.profile = Object.assign(emptyProfile(), x.profile || {});
  DB.profile.addr = DB.profile.addr || {}; DB.profile.extra = DB.profile.extra || {}; DB.profile.splash = Object.assign({ on: false, mode: 'first' }, DB.profile.splash || {});
  ['phones', 'emails', 'banks', 'links'].forEach((k) => { if (!Array.isArray(DB.profile[k])) DB.profile[k] = []; });
  DB.lists = x.lists && typeof x.lists === 'object' ? x.lists : {};
  CFG.lists.forEach((l) => { if (!Array.isArray(DB.lists[l.id])) DB.lists[l.id] = []; });
  DB.opts = x.opts && typeof x.opts === 'object' && !Array.isArray(x.opts) ? x.opts : {};
  DB.bookings = (Array.isArray(x.bookings) ? x.bookings : []).map((b) => Object.assign({ payments: [] }, b));
  DB.inquiries = Array.isArray(x.inquiries) ? x.inquiries : [];
  DB.posts = Array.isArray(x.posts) ? x.posts : [];
  DB.seen = x.seen || 0;
}
async function pack(obj) {
  const j = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return { z: 0, d: j };
  const buf = new Uint8Array(await new Response(new Blob([j]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  return { z: 1, d: btoa(s) };
}
async function unpack(p) {
  if (!p || typeof p.d !== 'string') return null; if (!p.z) return JSON.parse(p.d);
  const b = atob(p.d), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
/* البيانات تُحفظ في مساحة الإضافة؛ وإن كبرت عن حدّها تنتقل تلقائياً إلى خزنة الملفات، فالحد الفعلي هو سعة الجهاز */
async function saveDb(p) {
  const big = JSON.stringify(p).length > LIMIT * 0.8;
  if (big && hasVault()) { await Alaisai.vault.put('db.big', new Blob([JSON.stringify(p)], { type: 'application/json' }), 'db.json'); await Alaisai.set('db', { big: 1, t: Date.now() }); return; }
  await Alaisai.set('db', p); if (hasVault()) { try { await Alaisai.vault.remove('db.big'); } catch (e) { /* لا شيء */ } }
}
let saveTimer = 0, chain = Promise.resolve();
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 350); };
function flush() {
  clearTimeout(saveTimer);
  chain = chain.then(async () => {
    try { const p = await pack({ v: 1, profile: DB.profile, lists: DB.lists, opts: DB.opts, bookings: DB.bookings, inquiries: DB.inquiries, posts: DB.posts, seen: DB.seen }); Meta.bytes = JSON.stringify(p).length + 8; await saveDb(p); Meta.full = false; }
    catch (e) { Meta.full = true; toast('تعذّر الحفظ: امتلأت مساحة الجهاز. صدّر نسخة واحذف ما لا تحتاجه.'); }
  });
  return chain;
}
async function load() { try { let p = await Alaisai.get('db'); if (p && p.big && hasVault()) { const r = await Alaisai.vault.get('db.big'); p = r ? JSON.parse(await r.blob.text()) : null; } if (p) { normalize(await unpack(p)); Meta.bytes = JSON.stringify(p).length + 8; return; } } catch (e) { toast('تعذّرت قراءة البيانات'); } normalize({}); }
let toastT = 0;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3000); }

/* ===== الوسائط (خزنة الملفات) ===== */
const hasVault = () => !!(window.Alaisai && Alaisai.vault);
const cache = new Map();
function freeCache(keys) { (keys || [...cache.keys()]).forEach((k) => { const u = cache.get(k); if (u) { URL.revokeObjectURL(u); cache.delete(k); } }); }
async function blobUrl(key) { if (cache.has(key)) return cache.get(key); const r = await Alaisai.vault.get(key); if (!r) return null; const u = URL.createObjectURL(r.blob); cache.set(key, u); return u; }
function loadImage(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('ليست صورة صالحة')); }; i.src = u; }); }
async function shrink(file, max, q) {
  const im = await loadImage(file), r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * r)); c.height = Math.max(1, Math.round(im.height * r));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', q));
}
async function dataUrlOf(file, max, maxBytes) { let q = 0.8, b; do { b = await shrink(file, max, q); q -= 0.12; } while (b.size > maxBytes && q > 0.3); return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); }
async function addPhoto(file) { const id = 'p' + uid(); await Alaisai.vault.put(id, await shrink(file, 1280, 0.78), 'photo.jpg'); await Alaisai.vault.put('t' + id, await shrink(file, 280, 0.6), 'thumb.jpg'); return id; }
async function dropPhotos(ids) { for (const id of ids || []) { for (const k of [id, 't' + id]) { try { await Alaisai.vault.remove(k); } catch (e) { /* لا شيء */ } } freeCache([id, 't' + id]); } }
async function hydrate(root = document) {
  if (!hasVault()) return;
  for (const el of $$('[data-ph]', root)) { try { const u = await blobUrl(el.dataset.ph); if (u && el.isConnected) el.innerHTML = `<img alt="" src="${u}">`; } catch (e) { /* لا شيء */ } }
}
function download(name, text, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function pickFile(accept, multiple) { return new Promise((res) => { const i = $('#fpick'); i.accept = accept; i.multiple = !!multiple; i.value = ''; i.onchange = () => res([...i.files]); i.click(); }); }
async function shareText(text, title) {
  try { if (navigator.share) { await navigator.share({ title: title || '', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('نُسخ النص، الصقه في أي تطبيق'); } catch (e) { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (x) { /* لا شيء */ } a.remove(); } toast('تم النسخ'); }
