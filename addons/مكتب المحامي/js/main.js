'use strict';
const NAV = [['today', 'اليوم', 'today'], ['cases', 'القضايا', 'cases'], ['cal', 'الجلسات', 'cal'], ['clients', 'الموكلون', 'people'], ['fees', 'الأتعاب', 'coin'], ['lib', 'المكتبة', 'book']];
const TITLE = { today: 'اليوم', cases: 'القضايا', cal: 'الجلسات', clients: 'الموكلون', fees: 'الأتعاب', lib: 'المكتبة', tools: 'الأدوات والنسخ' };
const ADD = { today: ['newCase', 'قضية'], cases: ['addCase', 'قضية'], clients: ['newClient', 'موكّل'], cal: ['calHearing', 'جلسة'] };
let onSaved = null;

function render() {
  const detail = S.caseId ? 'case' : S.clientId ? 'client' : '';
  const nav = NAV.map(([k, l, i]) => `<button class="${S.tab === k && !detail ? 'on' : ''}${S.tab === k ? ' cur' : ''}" data-act="go" data-k="${k}" aria-label="${l}">${ic(i)}<span>${l}</span></button>`).join('');
  $('#tabs').innerHTML = nav;
  $('#rail').innerHTML = `<div class="brand">${ic('scale')}<strong>${E(DB.s.office || 'مكتب المحامي')}</strong>${DB.s.lawyer ? `<small>${E(DB.s.lawyer)}</small>` : ''}</div><div class="rail-nav">${nav}</div><button class="${S.tab === 'tools' ? 'on cur' : ''} gear" data-act="go" data-k="tools">${ic('gear')}<span>الأدوات والنسخ</span></button>`;
  const add = ADD[S.tab];
  $('#top').innerHTML = `<h1>${E(TITLE[S.tab])}</h1><span class="grow"></span>${add && !detail ? `<button class="btn pri small" data-act="${add[0]}">${ic('plus')}${add[1]}</button>` : ''}<button class="icon gear-m" data-act="go" data-k="tools" aria-label="الأدوات والنسخ">${ic('gear')}</button>`;
  const v = detail === 'case' ? vCase() : detail === 'client' ? vClient() : ({ today: vToday, cases: vCases, cal: vCal, clients: vClients, fees: vFees, lib: vLib, tools: vTools }[S.tab])();
  $('#view').innerHTML = v;
  document.body.dataset.detail = detail;
  freeUrls(); if (S.tab === 'tools') { calc(); }
  hydrateThumbs();
  $$('.subtabs .on,.chips .on').forEach((x) => { try { x.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* لا شيء */ } });
}
function keepFocus(id) { const i = $('#' + id); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { /* لا شيء */ } } }
const cur = () => caseById(S.caseId);
const sorted = (a) => a;
function goTab(k) { S.tab = k; S.caseId = null; S.clientId = null; render(); $('#view').scrollTop = 0; scrollTo(0, 0); }
function openCase(id, sub) { S.caseId = id; S.clientId = null; S.sub = sub || 'hearings'; render(); scrollTo(0, 0); }
const byId = (arr, id) => arr.find((x) => x.id === id);

function simpleItem(arrName, title, fields, id, base, live) {
  const c = cur(), arr = c[arrName], it = id ? byId(arr, id) : null;
  form((it ? 'تعديل ' : 'إضافة ') + title, fields, it || base || {}, (o) => {
    if (it) Object.assign(it, o); else arr.push(Object.assign({ id: uid() }, o));
    persist(); render();
  }, Object.assign({ live: live ? (o) => live(o, it) : null }, it ? { del: 1, delLabel: 'حذف', delMsg: 'سيُحذف هذا البند. متأكد؟', onDel: () => { c[arrName] = arr.filter((x) => x !== it); persist(); render(); } } : {}));
}
const payF = [{ n: 'amount', l: 'المبلغ', t: 'number', req: 1, half: 1 }, { n: 'date', l: 'التاريخ', t: 'date', req: 1, half: 1 }, { n: 'note', l: 'ملاحظة', ph: 'مثال: الدفعة الأولى' }];

const payLive = (o, it) => { const c = cur(), tot = num(c.feeTotal); if (!tot) return 'لم تُحدَّد الأتعاب بعد، حدّدها من تبويب الأتعاب ليظهر المتبقي.'; const rest = tot - (paid(c) - (it ? num(it.amount) : 0) - 0) - num(o.amount); return 'المتبقي بعد هذه الدفعة: ' + fNum(Math.max(0, rest)) + ' ' + DB.s.cur + (rest < 0 ? ' (زيادة ' + fNum(-rest) + ')' : ''); };
function moveCase(c, st) { const old = c.status; c.status = st; persist(); S.filter = st; toast('نُقلت «' + caseLabel(c) + '» من ' + old + ' إلى ' + st); render(); }
function addCase() {
  const st = S.filter; if (st === 'all') return editCase();
  const el = sheet('إضافة إلى «' + (st === 'جارية' ? 'الجارية' : st) + '»', `<div class="choice"><button class="tpl-i big" data-n>${ic('plus')}<span><strong>قضية جديدة</strong><small>أدخل بياناتها لأول مرة</small></span></button><button class="tpl-i big" data-x ${DB.cases.some((c) => c.status !== st) ? '' : 'disabled'}>${ic('cases')}<span><strong>قضية موجودة</strong><small>انقلها إلى هذا القسم بلا إعادة تدوين</small></span></button></div>`, { noFocus: true });
  $('[data-n]', el).onclick = () => { closeSheet(); editCase(); setTimeout(() => { const s = $('#f_status'); if (s) s.value = st; }, 0); };
  $('[data-x]', el).onclick = () => pickClient(st);
}
function pickClient(st) {
  const others = DB.cases.filter((c) => c.status !== st), ids = [...new Set(others.map((c) => c.clientId || ''))];
  const rows = ids.map((id) => ({ id, name: id ? (client(id) || { name: 'موكّل محذوف' }).name : 'بلا موكّل', n: others.filter((c) => (c.clientId || '') === id).length })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const el = sheet('اختر الموكّل', `<label class="search">${ic('search')}<input id="pq" type="search" placeholder="ابحث باسم الموكّل" autocomplete="off"></label><div class="list" id="pl" style="margin-top:12px"></div>`);
  const draw = () => { const q = norm($('#pq', el).value); $('#pl', el).innerHTML = rows.filter((r) => !q || norm(r.name).includes(q)).map((r) => `<button class="row" data-cl="${E(r.id)}"><span class="av">${E(r.name.charAt(0))}</span><span class="main"><strong>${E(r.name)}</strong><small>${r.n} قضية يمكن نقلها</small></span></button>`).join('') || '<p class="calm" style="padding:12px">لا نتائج</p>'; $$('[data-cl]', el).forEach((b) => { b.onclick = () => pickCase(st, b.dataset.cl); }); };
  $('#pq', el).addEventListener('input', draw); draw();
}
function pickCase(st, cid) {
  const list = DB.cases.filter((c) => c.status !== st && (c.clientId || '') === cid);
  const el = sheet('اختر القضية لنقلها', `<div class="list">${list.map((c) => `<button class="row cr" data-c="${c.id}">${dot(c.status)}<span class="main"><strong>${E(caseLabel(c))}</strong><small>${E(sub(c))}</small></span><span class="tag">${E(c.status)}</span></button>`).join('')}</div><p class="note">تنتقل القضية بكل بياناتها وجلساتها وأتعابها من قسمها الحالي إلى «${E(st === 'جارية' ? 'الجارية' : st)}» دون نسخ.</p>`, { noFocus: true });
  $$('[data-c]', el).forEach((b) => { b.onclick = () => { closeSheet(); moveCase(caseById(b.dataset.c), st); }; });
}
const feeLive = (o) => { const c = cur(); const rest = num(o.feeTotal) - paid(c); return 'المستلم حتى الآن ' + fNum(paid(c)) + ' ' + DB.s.cur + '، والمتبقي ' + fNum(Math.max(0, rest)) + ' ' + DB.s.cur; };
const A = {
  addCase, 
  setFee: () => { const c = cur(); form('الأتعاب المتفق عليها', [{ n: 'feeTotal', l: 'إجمالي الأتعاب (' + DB.s.cur + ')', t: 'number', req: 1 }], c, (o) => { c.feeTotal = o.feeTotal; persist(); render(); toast('حُدّدت الأتعاب'); }, { live: feeLive }); },
  pickFiles: (d) => pickFiles(d.kind, false), pickShot: (d) => pickFiles(d.kind, true), openFile: (d) => openFile(d.kind, d.id),
  libSec: (d) => { Lib.sec = d.k; render(); }, libItem: (d) => libItem(d.id), msgOwner,
  newTpl: () => editTpl(null), editTpl: (d) => editTpl(d.id), useTpl: (d) => A.tplFree(d),
  go: (d) => goTab(d.k),
  back: () => { S.caseId = null; S.clientId = null; render(); },
  case: (d) => openCase(d.id, d.sub),
  newCase: (d) => { if (!DB.clients.length && !DB.cases.length) { /* مسموح بلا موكّل */ } editCase(); if (d.cid) setTimeout(() => { const s = $('#f_clientId'); if (s) s.value = d.cid; }, 0); },
  editCase: () => editCase(cur()),
  filter: (d) => { S.filter = d.k; render(); },
  sub: (d) => { S.sub = d.k; render(); },
  task: (d) => { const k = byId(caseById(d.c || S.caseId).tasks, d.id); k.done = !k.done; persist(); render(); },
  doc: (d) => { const k = byId(cur().docs, d.id); k.have = !k.have; persist(); render(); },
  addHearing: () => form('جلسة جديدة', hearingFields, { date: today() }, saveHearing(null)),
  editHearing: (d) => { const h = byId(cur().hearings, d.id); form('الجلسة', hearingFields.slice(0, 4).concat(hearingFields[4]), h, saveHearing(h), { del: 1, delLabel: 'حذف الجلسة', delMsg: 'حذف هذه الجلسة؟', onDel: () => { const c = cur(); c.hearings = c.hearings.filter((x) => x !== h); persist(); render(); } }); },
  calHearing: () => { if (!DB.cases.length) return toast('أضف قضية أولاً'); form('جلسة جديدة', [{ n: 'cid', l: 'القضية', t: 'select', o: DB.cases.filter(open).map((c) => [c.id, caseLabel(c)]) }, ...hearingFields], { date: S.day }, (o) => { S.caseId = o.cid; saveHearing(null)(o); S.caseId = null; render(); }); },
  addTask: () => simpleItem('tasks', 'مهمة', [{ n: 'text', l: 'المهمة', req: 1 }, { n: 'due', l: 'موعدها', t: 'date' }], null, { done: false }),
  editTask: (d) => simpleItem('tasks', 'مهمة', [{ n: 'text', l: 'المهمة', req: 1 }, { n: 'due', l: 'موعدها', t: 'date' }], d.id),
  addDoc: () => simpleItem('docs', 'مستند', [{ n: 'name', l: 'اسم المستند', req: 1, ph: 'مثال: صورة الهوية' }], null, {}),
  editDoc: (d) => simpleItem('docs', 'مستند', [{ n: 'name', l: 'اسم المستند', req: 1 }], d.id),
  addPay: () => simpleItem('payments', 'دفعة', payF, null, { date: today() }, payLive),
  editPay: (d) => simpleItem('payments', 'دفعة', payF, d.id, null, payLive),
  addExp: () => simpleItem('expenses', 'مصروف', payF, null, { date: today() }),
  editExp: (d) => simpleItem('expenses', 'مصروف', payF, d.id),
  addNote: () => simpleItem('notes', 'ملاحظة', [{ n: 'date', l: 'التاريخ', t: 'date', req: 1 }, { n: 'text', l: 'الملاحظة', t: 'textarea', req: 1, rows: 4 }], null, { date: today() }),
  editNote: (d) => simpleItem('notes', 'ملاحظة', [{ n: 'date', l: 'التاريخ', t: 'date', req: 1 }, { n: 'text', l: 'الملاحظة', t: 'textarea', req: 1, rows: 4 }], d.id),
  receipt: (d) => { const p = byId(cur().payments, d.id); openTemplate(cur(), tplById('receipt'), { amount: p.amount, for: p.note }); },
  pickTpl: () => pickTemplate(cur()),
  tpl: (d) => openTemplate(cur(), tplById(d.t)),
  tplFree: (d) => {
    if (!DB.cases.length) return openTemplate(null, tplById(d.t));
    form('اختر القضية', [{ n: 'cid', l: 'القضية', t: 'select', o: [['', '— بلا قضية (حقول فارغة) —'], ...DB.cases.map((c) => [c.id, caseLabel(c)])] }], {}, (o) => openTemplate(o.cid ? caseById(o.cid) : null, tplById(d.t)), { ok: 'متابعة' });
  },
  client: (d) => { S.clientId = d.id; S.caseId = null; S.tab = 'clients'; render(); scrollTo(0, 0); },
  newClient: () => form('موكّل جديد', clientFields, {}, (o) => { const c = Object.assign({ id: uid() }, o); DB.clients.push(c); persist(); S.clientId = c.id; S.tab = 'clients'; render(); }),
  editClient: () => { const c = client(S.clientId); form('تعديل الموكّل', clientFields, c, (o) => { Object.assign(c, o); persist(); render(); }, { del: 1, delLabel: 'حذف الموكّل', delMsg: 'سيُحذف الموكّل وتبقى قضاياه بلا موكّل. متأكد؟', onDel: () => { dropFiles(c.files); DB.clients = DB.clients.filter((x) => x !== c); DB.cases.forEach((k) => { if (k.clientId === c.id) k.clientId = ''; }); S.clientId = null; persist(); render(); } }); },
  day: (d) => { S.day = d.d; render(); },
  mo: (d) => { const [y, m] = S.month.split('-').map(Number); const x = new Date(y, m - 1 + Number(d.n), 1); S.month = x.getFullYear() + '-' + pad(x.getMonth() + 1); S.day = S.month + '-01'; render(); },
  printDay: () => {
    const l = allHearings().filter((x) => x.h.date === S.day).sort((a, b) => (a.h.time || '').localeCompare(b.h.time || ''));
    printHTML(`<div class="paper">${letterhead()}<h2 class="ph">جدول جلسات ${E(fDay(S.day))} ${E(fDate(S.day))}</h2>${l.length ? `<table class="pt"><tr><th>الوقت</th><th>القضية</th><th>الجهة</th><th>الموكّل</th><th>الغرض</th></tr>${l.map((x) => `<tr><td>${E(x.h.time || '')}</td><td>${E(caseLabel(x.c))}${x.c.number ? ' (' + E(x.c.number) + ')' : ''}</td><td>${E(x.c.court)}</td><td>${E(who(x.c))}</td><td>${E(x.h.note)}</td></tr>`).join('')}</table>` : '<p>لا جلسات في هذا اليوم.</p>'}</div>`);
  },
  office: () => form('بيانات المكتب', [{ n: 'office', l: 'اسم المكتب' }, { n: 'lawyer', l: 'اسم المحامي' }, { n: 'phone', l: 'الهاتف', t: 'tel', half: 1 }, { n: 'city', l: 'المدينة', half: 1 }, { n: 'cur', l: 'العملة', ph: 'ريال، دولار، ريال سعودي…' }], DB.s, (o) => { Object.assign(DB.s, o); persist(); render(); }),
  export: () => { download('نسخة-مكتب-المحامي-' + today() + '.json', JSON.stringify({ format: 'lawyer-office', v: 1, s: DB.s, clients: DB.clients, cases: DB.cases, tpls: DB.tpls })); toast('نُزّلت النسخة'); },
  import: () => $('#imp').click(),
};
function saveHearing(h) {
  return (o) => {
    const c = cur(), next = o.nextDate; delete o.nextDate; delete o.cid;
    if (h) Object.assign(h, o); else c.hearings.push(Object.assign({ id: uid() }, o));
    if (next && !c.hearings.some((x) => x.date === next)) c.hearings.push({ id: uid(), date: next, time: '', note: '', result: '' });
    if (next && c.status === 'منتهية') c.status = 'جارية';
    persist(); render();
  };
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.closest('#sheet-root')) return;
  const a = A[b.dataset.act]; if (!a) return; e.preventDefault(); a(b.dataset);
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') { S.q = t.value; render(); keepFocus('q'); }
  else if (t.id === 'lq') { Lib.q = t.value; render(); keepFocus('lq'); }
  else if (t.id === 'cq') { S.cq = t.value; render(); keepFocus('cq'); }
  else if (t.closest && t.closest('#calc')) calc();
});
document.addEventListener('change', (e) => {
  if (e.target.closest && e.target.closest('#calc')) calc();
  if (e.target.id === 'fpick') { onPicked([...e.target.files]); return; }
  if (e.target.id === 'imp') {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = async () => {
      try {
        const o = JSON.parse(r.result); if (!o || o.format !== 'lawyer-office' || !Array.isArray(o.cases)) throw 0;
        if (!(await ask('سيحلّ محتوى النسخة محل بياناتك الحالية (' + DB.cases.length + ' قضية). متأكد؟', 'استبدال'))) return;
        normalize(o); await flush(); S.caseId = S.clientId = null; render(); toast('تم الاستيراد: ' + DB.cases.length + ' قضية');
      } catch (x) { toast('هذا الملف ليس نسخة من مكتب المحامي'); }
    };
    r.readAsText(f); e.target.value = '';
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
addEventListener('pagehide', () => flush());

(async () => {
  await load(); render();
  const th = (Alaisai.env && Alaisai.env.theme) || 'dark'; document.documentElement.dataset.theme = th;
})();
