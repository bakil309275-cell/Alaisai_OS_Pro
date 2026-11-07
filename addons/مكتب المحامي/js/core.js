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
const addMonths = (s, n) => { const d = parseD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
const diff = (a, b) => Math.round((parseD(a) - parseD(b)) / 864e5);
const fDate = (s) => (s ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseD(s)) : '');
const fShort = (s) => (s ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short' }).format(parseD(s)) : '');
const fDay = (s) => (s ? new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long' }).format(parseD(s)) : '');
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,،\s]/g, '')); return isFinite(n) ? n : 0; };
const fNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0);
const money = (n) => fNum(n) + ' ' + (DB.s.cur || '');
const norm = (s) => String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const rel = (s) => { const n = diff(s, today()); if (n === 0) return 'اليوم'; if (n === 1) return 'غداً'; if (n === 2) return 'بعد يومين'; if (n > 2 && n <= 10) return 'بعد ' + n + ' أيام'; if (n > 10) return 'بعد ' + n + ' يوماً'; if (n === -1) return 'أمس'; if (n === -2) return 'قبل يومين'; if (n >= -10) return 'قبل ' + (-n) + ' أيام'; return 'قبل ' + (-n) + ' يوماً'; };

/* ===== البيانات ===== */
const STATUS = {
  'جارية': '#1d6b5d', 'مؤجلة': '#a9822c', 'محجوزة للحكم': '#3b5a7a', 'مستأنفة': '#7a4a8a', 'منتهية': '#7b8582',
};
const KINDS = ['مدنية', 'تجارية', 'جزائية', 'أحوال شخصية', 'عمالية', 'إدارية', 'عقارية', 'إيجارات', 'أخرى'];
const ROLES = ['مدعي', 'مدعى عليه', 'متهم', 'مجني عليه', 'مستأنف', 'مستأنف ضده', 'طالب', 'مطلوب ضده', 'أخرى'];

const DB = { s: { office: '', lawyer: '', phone: '', city: '', cur: 'ريال' }, clients: [], cases: [], tpls: [] };
const Meta = { bytes: 0, limit: 256 * 1024, full: false, saving: false, lastSaved: 0 };
const LIMIT = 256 * 1024;

const normalize = (o) => {
  const x = o && typeof o === 'object' ? o : {};
  DB.s = Object.assign({ office: '', lawyer: '', phone: '', city: '', cur: 'ريال' }, x.s || {});
  DB.clients = (Array.isArray(x.clients) ? x.clients : []).map((c) => Object.assign({ files: [] }, c));
  DB.tpls = Array.isArray(x.tpls) ? x.tpls : [];
  DB.cases = (Array.isArray(x.cases) ? x.cases : []).map((c) => Object.assign({ hearings: [], tasks: [], payments: [], expenses: [], notes: [], docs: [], files: [] }, c));
};

async function pack(obj) {
  const j = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return { z: 0, d: j };
  const buf = new Uint8Array(await new Response(new Blob([j]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  return { z: 1, d: btoa(s) };
}
async function unpack(p) {
  if (!p || typeof p.d !== 'string') return null;
  if (!p.z) return JSON.parse(p.d);
  const b = atob(p.d), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

let saveTimer = 0, saveChain = Promise.resolve();
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 350); }
function flush() {
  clearTimeout(saveTimer);
  saveChain = saveChain.then(async () => {
    try {
      const p = await pack({ v: 1, s: DB.s, clients: DB.clients, cases: DB.cases, tpls: DB.tpls });
      Meta.bytes = JSON.stringify(p).length + 8;
      await Alaisai.set('db', p);
      Meta.full = false; Meta.lastSaved = Date.now();
    } catch (e) {
      Meta.full = true;
      toast('تعذّر الحفظ: امتلأت مساحة الإضافة. صدّر نسخة احتياطية ثم احذف قضايا منتهية.');
    }
    if (typeof onSaved === 'function') onSaved();
  });
  return saveChain;
}
async function load() {
  try {
    const p = await Alaisai.get('db');
    if (p) { const o = await unpack(p); normalize(o); Meta.bytes = JSON.stringify(p).length + 8; }
  } catch (e) { toast('تعذّرت قراءة البيانات المحفوظة'); }
}
let toastT = 0;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }

/* ===== استعلامات ===== */
const client = (id) => DB.clients.find((c) => c.id === id);
const caseById = (id) => DB.cases.find((c) => c.id === id);
const paid = (c) => c.payments.reduce((a, p) => a + num(p.amount), 0);
const spent = (c) => c.expenses.reduce((a, p) => a + num(p.amount), 0);
const balance = (c) => Math.max(0, num(c.feeTotal) - paid(c));
const open = (c) => c.status !== 'منتهية';
const nextHearing = (c) => c.hearings.filter((h) => h.date >= today() && !h.result).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0] || null;
const allHearings = () => DB.cases.flatMap((c) => c.hearings.map((h) => ({ h, c })));
const caseLabel = (c) => c.title || [c.number && 'رقم ' + c.number, c.court].filter(Boolean).join(' - ') || 'قضية بلا عنوان';
