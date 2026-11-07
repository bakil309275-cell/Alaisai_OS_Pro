'use strict';
const S = { tab: 'today', caseId: null, clientId: null, q: '', filter: 'جارية', sub: 'hearings', cq: '', month: today().slice(0, 7), day: today() };
const empty = (t, d, btn) => `<div class="empty"><div class="empty-mark">${ic('scale')}</div><h3>${E(t)}</h3><p>${E(d)}</p>${btn || ''}</div>`;
const dot = (st) => `<i class="dot" style="--c:${STATUS[st] || '#7b8582'}" title="${E(st)}"></i>`;
const who = (c) => { const cl = client(c.clientId); return cl ? cl.name : ''; };
const sub = (c) => [c.number && 'رقم ' + c.number + (c.year ? '/' + c.year : ''), c.court, who(c)].filter(Boolean).join('  ·  ');

/* ---------- اليوم ---------- */
function hRow(h, c, opt = {}) {
  return `<button class="row hr" data-act="case" data-id="${c.id}"><span class="when"><b>${E(opt.date ? fShort(h.date) : (h.time || '--:--'))}</b>${opt.date ? `<small>${E(h.time || '')}</small>` : ''}</span><span class="main"><strong>${E(caseLabel(c))}</strong><small>${E([c.court, who(c), h.note].filter(Boolean).join('  ·  '))}</small></span>${opt.late ? `<span class="tag warn">سجّل النتيجة</span>` : `<span class="tag">${E(rel(h.date))}</span>`}</button>`;
}
function vToday() {
  const t = today(), act = DB.cases.filter(open);
  const up = allHearings().filter((x) => open(x.c) && x.h.date >= t && !x.h.result).sort((a, b) => (a.h.date + (a.h.time || '')).localeCompare(b.h.date + (b.h.time || '')));
  const late = allHearings().filter((x) => open(x.c) && x.h.date < t && !x.h.result).sort((a, b) => b.h.date.localeCompare(a.h.date));
  const tasks = DB.cases.filter(open).flatMap((c) => c.tasks.filter((k) => !k.done && k.due && diff(k.due, t) <= 7).map((k) => ({ k, c }))).sort((a, b) => a.k.due.localeCompare(b.k.due));
  const owed = act.filter((c) => balance(c) > 0).sort((a, b) => balance(b) - balance(a));
  const first = up[0], wk = up.filter((x) => diff(x.h.date, t) <= 6).length;
  let h = `<section class="hello"><div><h1>${E(fDay(t))}</h1><p>${E(fDate(t))}</p></div><div class="figs"><span><b>${act.length}</b> قضية جارية</span><span><b>${wk}</b> جلسة هذا الأسبوع</span><span><b>${fNum(owed.reduce((a, c) => a + balance(c), 0))}</b> ${E(DB.s.cur)} متبقي</span></div></section>`;
  if (!DB.cases.length) return h + empty('ابدأ بأول قضية', 'سجّل القضية والموكّل وموعد الجلسة القادمة، وسيعرض لك هذا اليوم كل ما يحتاج متابعة.', `<button class="btn pri" data-act="newCase">${ic('plus')}قضية جديدة</button>`);
  if (first) {
    const n = diff(first.h.date, t);
    h += `<button class="slip" data-act="case" data-id="${first.c.id}" aria-label="الجلسة القادمة"><span class="slip-l"><small>الجلسة القادمة</small><strong>${E(caseLabel(first.c))}</strong><span>${E([first.c.court, who(first.c)].filter(Boolean).join('  ·  '))}</span><span>${E(fDay(first.h.date))} ${E(fDate(first.h.date))}${first.h.time ? ' - ' + E(first.h.time) : ''}</span>${first.h.note ? `<em>${E(first.h.note)}</em>` : ''}</span><span class="stamp${n === 0 ? ' now' : ''}"><b>${n === 0 ? 'اليوم' : n === 1 ? 'غداً' : n}</b><small>${n > 1 ? 'يوماً' : '&nbsp;'}</small></span></button>`;
  }
  if (late.length) h += `<section class="blk"><h2>تحتاج تسجيل نتيجة</h2><div class="list">${late.slice(0, 6).map((x) => hRow(x.h, x.c, { date: 1, late: 1 })).join('')}</div></section>`;
  const rest = up.slice(first ? 1 : 0, 9);
  if (rest.length) h += `<section class="blk"><h2>الجلسات القادمة</h2><div class="list">${rest.map((x) => hRow(x.h, x.c, { date: 1 })).join('')}</div></section>`;
  if (tasks.length) h += `<section class="blk"><h2>مهام قريبة</h2><div class="list">${tasks.slice(0, 8).map(({ k, c }) => `<div class="row"><button class="chk${k.done ? ' on' : ''}" data-act="task" data-c="${c.id}" data-id="${k.id}" aria-label="إنجاز المهمة">${ic('check')}</button><span class="main"><strong>${E(k.text)}</strong><small>${E(caseLabel(c))}</small></span><span class="tag${diff(k.due, t) < 0 ? ' warn' : ''}">${E(rel(k.due))}</span></div>`).join('')}</div></section>`;
  if (owed.length) h += `<section class="blk"><h2>أتعاب مستحقة</h2><div class="list">${owed.slice(0, 5).map((c) => `<button class="row" data-act="case" data-id="${c.id}" data-sub="fees"><span class="main"><strong>${E(caseLabel(c))}</strong><small>${E(who(c))}</small></span><span class="amt">${E(money(balance(c)))}</span></button>`).join('')}</div></section>`;
  if (!first && !late.length && !rest.length) h += `<p class="calm">لا جلسات قادمة مسجّلة. افتح قضية وأضف موعد جلستها لتظهر هنا.</p>`;
  return h;
}

/* ---------- القضايا ---------- */
function vCases() {
  const q = norm(S.q), fl = S.filter;
  let list = DB.cases.filter((c) => (fl === 'all' ? true : c.status === fl) && (!q || norm([c.title, c.number, c.court, c.opponent, c.subject, who(c)].join(' ')).includes(q)));
  list.sort((a, b) => { const x = nextHearing(a), y = nextHearing(b); if (x && y) return x.date.localeCompare(y.date); if (x) return -1; if (y) return 1; return (b.opened || '').localeCompare(a.opened || ''); });
  const chips = [...Object.keys(STATUS).map((s) => [s, s === 'جارية' ? 'الجارية' : s]), ['all', 'الكل']].map(([k, l]) => [k, l, k === 'all' ? DB.cases.length : DB.cases.filter((c) => c.status === k).length]);
  const items = list.map((c) => { const n = nextHearing(c); return `<button class="row cr" data-act="case" data-id="${c.id}">${dot(c.status)}<span class="main"><strong>${E(caseLabel(c))}</strong><small>${E(sub(c))}</small></span><span class="side">${n ? `<span class="tag">${E(fShort(n.date))}</span>` : `<span class="muted">${E(c.status)}</span>`}${balance(c) > 0 && open(c) ? `<small class="owe">${E(fNum(balance(c)))}</small>` : ''}</span></button>`; }).join('');
  return `<div class="bar"><label class="search">${ic('search')}<input id="q" type="search" placeholder="ابحث برقم القضية أو الموكّل أو الخصم" value="${E(S.q)}" autocomplete="off"></label></div><div class="chips" role="tablist">${chips.map(([k, l, n]) => `<button class="chip${fl === k ? ' on' : ''}" data-act="filter" data-k="${E(k)}">${E(l)}<i>${n}</i></button>`).join('')}</div>` +
    (items ? `<div class="list">${items}</div>` : (DB.cases.length ? (fl === 'all' ? empty('لا نتائج', 'غيّر البحث ليظهر ما تبحث عنه.') : empty('لا قضايا في «' + (fl === 'جارية' ? 'الجارية' : fl) + '»', q ? 'غيّر البحث.' : 'أضف قضية جديدة أو انقل إليها قضية موجودة دون إعادة تدوينها.', `<button class="btn pri" data-act="addCase">${ic('plus')}إضافة قضية</button>`)) : empty('لا قضايا بعد', 'أضف أول قضية لتبدأ بتتبّع جلساتها وأتعابها.', `<button class="btn pri" data-act="newCase">${ic('plus')}قضية جديدة</button>`)));
}
const caseFields = () => [
  { n: 'title', l: 'عنوان القضية', req: 1, ph: 'مثال: نزاع عقاري - أرض الحي الشمالي' },
  { n: 'clientId', l: 'الموكّل', t: 'select', o: [['', '— بلا موكّل —'], ...DB.clients.map((c) => [c.id, c.name])] },
  { n: 'role', l: 'صفة الموكّل', t: 'select', o: ROLES, half: 1 }, { n: 'kind', l: 'نوع القضية', t: 'select', o: KINDS, half: 1 },
  { n: 'court', l: 'المحكمة أو الجهة', ph: 'مثال: المحكمة التجارية - الدائرة الثانية' },
  { n: 'number', l: 'رقم القضية', half: 1 }, { n: 'year', l: 'السنة', half: 1 },
  { n: 'opponent', l: 'الخصم', half: 1 }, { n: 'opponentLawyer', l: 'محامي الخصم', half: 1 },
  { n: 'judge', l: 'القاضي أو الدائرة', half: 1 }, { n: 'status', l: 'الحالة', t: 'select', o: Object.keys(STATUS), half: 1 },
  { n: 'subject', l: 'موضوع النزاع', t: 'textarea' }, { n: 'feeTotal', l: 'الأتعاب المتفق عليها', t: 'number', half: 1 }, { n: 'opened', l: 'تاريخ فتح الملف', t: 'date', half: 1 },
];
function editCase(c) {
  const isNew = !c;
  form(isNew ? 'قضية جديدة' : 'تعديل القضية', caseFields(), c || { status: 'جارية', opened: today(), role: 'مدعي', kind: 'مدنية' }, (o) => {
    if (isNew) { c = Object.assign({ id: uid(), hearings: [], tasks: [], payments: [], expenses: [], notes: [], docs: [] }, o); DB.cases.push(c); } else Object.assign(c, o);
    persist(); S.caseId = c.id; S.sub = 'hearings'; render();
    if (isNew) toast('تمت إضافة القضية، أضف الآن موعد الجلسة القادمة');
  }, !isNew ? { del: 1, delLabel: 'حذف القضية', delMsg: 'ستُحذف القضية بكل جلساتها وأتعابها. متأكد؟', onDel: () => { dropFiles(c.files); DB.cases = DB.cases.filter((x) => x !== c); S.caseId = null; persist(); render(); } } : {});
}

/* ---------- تفاصيل القضية ---------- */
function vCase() {
  const c = caseById(S.caseId); if (!c) { S.caseId = null; return vCases(); }
  const cl = client(c.clientId);
  const info = [['الموكّل', cl ? `<a href="#" data-act="client" data-id="${cl.id}">${E(cl.name)}</a>` : '', c.role], ['الخصم', E(c.opponent) + (c.opponentLawyer ? `<small>محاميه: ${E(c.opponentLawyer)}</small>` : '')], ['الجهة', E(c.court) + (c.judge ? `<small>${E(c.judge)}</small>` : '')], ['رقم القضية', E(c.number) + (c.year ? '/' + E(c.year) : '')], ['النوع', E(c.kind)], ['فُتح', E(fDate(c.opened))]].filter((r) => r[1]);
  const tabs = [['hearings', 'الجلسات', c.hearings.length], ['tasks', 'المهام', c.tasks.filter((k) => !k.done).length], ['docs', 'المستندات', c.docs.filter((d) => !d.have).length], ['fees', 'الأتعاب', 0], ['files', 'الملفات', 0], ['log', 'السجل', 0]];
  let body = '';
  if (S.sub === 'hearings') {
    const hs = c.hearings.slice().sort((a, b) => b.date.localeCompare(a.date));
    body = `<div class="sec-h"><h3>جلسات القضية</h3><button class="btn small pri" data-act="addHearing">${ic('plus')}جلسة</button></div>` + (hs.length ? `<div class="tl">${hs.map((h) => `<button class="tl-i${h.date >= today() && !h.result ? ' next' : ''}" data-act="editHearing" data-id="${h.id}"><span class="tl-d"><b>${E(fShort(h.date))}</b><small>${E(h.date.slice(0, 4))}</small></span><span class="tl-b"><strong>${E(h.note || 'جلسة')}${h.time ? ` <em>${E(h.time)}</em>` : ''}</strong>${h.result ? `<span class="res">${E(h.result)}</span>` : `<span class="muted">${h.date < today() ? 'بلا نتيجة مسجّلة' : E(rel(h.date))}</span>`}</span></button>`).join('')}</div>` : `<p class="calm">لا جلسات بعد. أضف موعد الجلسة القادمة.</p>`);
  } else if (S.sub === 'tasks') {
    body = `<div class="sec-h"><h3>مهام القضية</h3><button class="btn small pri" data-act="addTask">${ic('plus')}مهمة</button></div>` + (c.tasks.length ? `<div class="list">${c.tasks.slice().sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9')).map((k) => `<div class="row${k.done ? ' done' : ''}"><button class="chk${k.done ? ' on' : ''}" data-act="task" data-c="${c.id}" data-id="${k.id}" aria-label="تبديل الإنجاز">${ic('check')}</button><button class="main as-btn" data-act="editTask" data-id="${k.id}"><strong>${E(k.text)}</strong>${k.due ? `<small>${E(fDate(k.due))}</small>` : ''}</button>${k.due && !k.done ? `<span class="tag${diff(k.due, today()) < 0 ? ' warn' : ''}">${E(rel(k.due))}</span>` : ''}</div>`).join('')}</div>` : `<p class="calm">مثل: تقديم مذكرة، طلب صورة من الحكم، استلام مستند من الموكّل.</p>`);
  } else if (S.sub === 'docs') {
    body = `<div class="sec-h"><h3>مستندات الملف</h3><button class="btn small pri" data-act="addDoc">${ic('plus')}مستند</button></div>` + (c.docs.length ? `<div class="list">${c.docs.map((d) => `<div class="row${d.have ? ' done' : ''}"><button class="chk${d.have ? ' on' : ''}" data-act="doc" data-id="${d.id}" aria-label="تبديل الاستلام">${ic('check')}</button><button class="main as-btn" data-act="editDoc" data-id="${d.id}"><strong>${E(d.name)}</strong><small>${d.have ? 'مستلم' : 'مطلوب'}</small></button></div>`).join('')}</div><div class="foot"><button class="btn quiet small" data-act="tpl" data-t="checklist">${ic('print')}طباعة القائمة</button></div>` : `<p class="calm">سجّل ما يلزم القضية من أوراق (صورة الهوية، العقد، الوكالة…) وعلّم ما استلمته.</p>`);
  } else if (S.sub === 'files') {
    body = filesPane(c, 'القضية', 'case');
  } else if (S.sub === 'fees') {
    const pd = paid(c), tot = num(c.feeTotal), sp = spent(c);
    const rows = (arr, k) => arr.length ? `<div class="list">${arr.slice().sort((a, b) => b.date.localeCompare(a.date)).map((p) => `<div class="row"><button class="main as-btn" data-act="edit${k}" data-id="${p.id}"><strong>${E(money(num(p.amount)))}</strong><small>${E(fDate(p.date))}${p.note ? '  ·  ' + E(p.note) : ''}</small></button>${k === 'Pay' ? `<button class="btn small quiet" data-act="receipt" data-id="${p.id}">${ic('doc')}إيصال</button>` : ''}</div>`).join('')}</div>` : '';
    body = `<div class="sec-h"><h3>${tot ? 'الأتعاب المتفق عليها' : 'لم تُحدَّد الأتعاب بعد'}</h3><button class="btn small ${tot ? 'quiet' : 'pri'}" data-act="setFee">${ic(tot ? 'edit' : 'plus')}${tot ? 'تعديل الأتعاب' : 'تحديد الأتعاب'}</button></div><div class="ledger"><div><small>المتفق عليه</small><b>${E(fNum(tot))}</b></div><div><small>المستلم</small><b>${E(fNum(pd))}</b></div><div class="${tot - pd > 0 ? 'owed' : ''}"><small>المتبقي</small><b>${E(fNum(Math.max(0, tot - pd)))}</b></div></div>${tot ? `<div class="meter" aria-hidden="true"><i style="width:${Math.min(100, Math.round(pd / tot * 100))}%"></i></div>` : ''}` +
      `<div class="sec-h"><h3>الدفعات</h3><button class="btn small pri" data-act="addPay">${ic('plus')}دفعة</button></div>${rows(c.payments, 'Pay') || '<p class="calm">لم تُسجَّل دفعات بعد.</p>'}` +
      `<div class="sec-h"><h3>مصروفات القضية <small>${sp ? E(money(sp)) : ''}</small></h3><button class="btn small quiet" data-act="addExp">${ic('plus')}مصروف</button></div>${rows(c.expenses, 'Exp') || '<p class="calm">رسوم، تصوير، انتقال… ما دفعته عن الموكّل.</p>'}<div class="foot"><button class="btn quiet small" data-act="tpl" data-t="account">${ic('print')}كشف حساب</button><button class="btn quiet small" data-act="tpl" data-t="fee">${ic('doc')}اتفاقية أتعاب</button></div>`;
  } else {
    const items = [...c.notes.map((n) => ({ d: n.date, t: n.text, id: n.id, n: 1 })), ...c.hearings.filter((h) => h.result).map((h) => ({ d: h.date, t: (h.note ? h.note + ': ' : 'جلسة: ') + h.result }))].sort((a, b) => b.d.localeCompare(a.d));
    body = `<div class="sec-h"><h3>سجل القضية</h3><button class="btn small pri" data-act="addNote">${ic('plus')}ملاحظة</button></div>` + (items.length ? `<div class="tl">${items.map((i) => `<${i.n ? 'button data-act="editNote" data-id="' + i.id + '"' : 'div'} class="tl-i"><span class="tl-d"><b>${E(fShort(i.d))}</b><small>${E(i.d.slice(0, 4))}</small></span><span class="tl-b"><span class="res plain">${E(i.t)}</span></span></${i.n ? 'button' : 'div'}>`).join('')}</div>` : `<p class="calm">دوّن ما دار مع الموكّل أو المحكمة، وستجد هنا أيضاً نتائج الجلسات.</p>`) + (c.subject ? `<div class="subject"><h3>موضوع النزاع</h3><p>${E(c.subject)}</p></div>` : '');
  }
  return `<div class="case-h"><button class="back" data-act="back" aria-label="رجوع">${ic('back')}</button><div class="case-t"><span class="st">${dot(c.status)}${E(c.status)}</span><h1>${E(caseLabel(c))}</h1></div><div class="case-a"><button class="btn quiet small" data-act="pickTpl">${ic('doc')}مستند</button><button class="btn quiet small" data-act="editCase">${ic('edit')}تعديل</button></div></div>` +
    `<dl class="facts">${info.map(([k, val, x]) => `<div><dt>${E(k)}</dt><dd>${val}${x ? `<small>${E(x)}</small>` : ''}</dd></div>`).join('')}</dl>` +
    `<div class="subtabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-selected="${S.sub === k}" class="${S.sub === k ? 'on' : ''}" data-act="sub" data-k="${k}">${E(l)}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</div><div class="pane">${body}</div>`;
}
const hearingFields = [{ n: 'date', l: 'التاريخ', t: 'date', req: 1, half: 1 }, { n: 'time', l: 'الوقت', t: 'time', half: 1 }, { n: 'note', l: 'الغرض من الجلسة', ph: 'مثال: سماع شهود، رد على المذكرة، نطق بالحكم' }, { n: 'result', l: 'ما تقرر في الجلسة', t: 'textarea', hint: 'اتركه فارغاً قبل انعقاد الجلسة' }, { n: 'nextDate', l: 'موعد الجلسة التالية', t: 'date', hint: 'إن حدّدته تُنشأ الجلسة التالية تلقائياً' }];

/* ---------- الموكلون ---------- */
function vClients() {
  const q = norm(S.cq); const list = DB.clients.filter((c) => !q || norm([c.name, c.phone, c.idno].join(' ')).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return `<div class="bar"><label class="search">${ic('search')}<input id="cq" type="search" placeholder="ابحث بالاسم أو الهاتف" value="${E(S.cq)}" autocomplete="off"></label></div>` +
    (list.length ? `<div class="list">${list.map((c) => { const cs = DB.cases.filter((x) => x.clientId === c.id); const owe = cs.reduce((a, x) => a + (open(x) ? balance(x) : 0), 0); return `<button class="row" data-act="client" data-id="${c.id}"><span class="av">${E(c.name.trim().charAt(0))}</span><span class="main"><strong>${E(c.name)}</strong><small>${E([c.phone, cs.length + ' قضية'].filter(Boolean).join('  ·  '))}</small></span>${owe ? `<small class="owe">${E(fNum(owe))}</small>` : ''}</button>`; }).join('')}</div>` : (DB.clients.length ? empty('لا نتائج', 'جرّب اسماً أو رقماً آخر.') : empty('لا موكلين بعد', 'سجّل بيانات موكّليك ليسهل التواصل وربط قضاياهم.', `<button class="btn pri" data-act="newClient">${ic('plus')}موكّل جديد</button>`)));
}
const clientFields = [{ n: 'name', l: 'الاسم الكامل', req: 1 }, { n: 'phone', l: 'الهاتف', t: 'tel', half: 1 }, { n: 'idno', l: 'رقم الهوية', half: 1 }, { n: 'addr', l: 'العنوان' }, { n: 'note', l: 'ملاحظات', t: 'textarea' }];
function vClient() {
  const c = client(S.clientId); if (!c) { S.clientId = null; return vClients(); }
  const cs = DB.cases.filter((x) => x.clientId === c.id), owe = cs.filter(open).reduce((a, x) => a + balance(x), 0);
  const tel = (c.phone || '').replace(/[^\d+]/g, '');
  return `<div class="case-h"><button class="back" data-act="back" aria-label="رجوع">${ic('back')}</button><div class="case-t"><span class="st">موكّل</span><h1>${E(c.name)}</h1></div><div class="case-a"><button class="btn quiet small" data-act="editClient">${ic('edit')}تعديل</button></div></div>` +
    `<dl class="facts">${[['الهاتف', c.phone ? `<a dir="ltr" href="tel:${E(tel)}">${E(c.phone)}</a>` : ''], ['الهوية', E(c.idno)], ['العنوان', E(c.addr)], ['المتبقي عليه', owe ? E(money(owe)) : '']].filter((r) => r[1]).map(([k, val]) => `<div><dt>${E(k)}</dt><dd>${val}</dd></div>`).join('')}</dl>` +
    (tel ? `<div class="foot left"><a class="btn quiet small" href="tel:${E(tel)}">${ic('phone')}اتصال</a><a class="btn quiet small" href="https://wa.me/${E(tel.replace(/^\+/, '').replace(/^00/, ''))}" target="_blank" rel="noopener">واتساب</a></div>` : '') +
    (c.note ? `<div class="subject"><h3>ملاحظات</h3><p>${E(c.note)}</p></div>` : '') + filesPane(c, 'الموكّل', 'client') +
    `<div class="sec-h"><h3>قضاياه</h3><button class="btn small pri" data-act="newCase" data-cid="${c.id}">${ic('plus')}قضية</button></div>` +
    (cs.length ? `<div class="list">${cs.map((x) => `<button class="row cr" data-act="case" data-id="${x.id}">${dot(x.status)}<span class="main"><strong>${E(caseLabel(x))}</strong><small>${E(sub(x))}</small></span></button>`).join('')}</div>` : '<p class="calm">لا قضايا مرتبطة بهذا الموكّل.</p>');
}

/* ---------- الجلسات (تقويم) ---------- */
function vCal() {
  const [Y, M] = S.month.split('-').map(Number), first = new Date(Y, M - 1, 1), days = new Date(Y, M, 0).getDate();
  const lead = (first.getDay() + 1) % 7;   // السبت أول الأسبوع
  const hs = allHearings().filter((x) => open(x.c) || x.h.date >= today());
  const by = {}; hs.forEach((x) => { (by[x.h.date] = by[x.h.date] || []).push(x); });
  const names = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];
  let cells = ''; for (let i = 0; i < lead; i++) cells += '<span class="cell off"></span>';
  for (let d = 1; d <= days; d++) { const ds = S.month + '-' + pad(d), n = (by[ds] || []).length; cells += `<button class="cell${ds === today() ? ' tod' : ''}${ds === S.day ? ' sel' : ''}" data-act="day" data-d="${ds}" aria-label="${E(fDate(ds))}${n ? '، ' + n + ' جلسة' : ''}"><b>${d}</b>${n ? `<i class="pips">${'<u></u>'.repeat(Math.min(n, 3))}</i>` : ''}</button>`; }
  const dayList = (by[S.day] || []).sort((a, b) => (a.h.time || '').localeCompare(b.h.time || ''));
  const monthName = new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'long', year: 'numeric' }).format(first);
  const inMonth = hs.filter((x) => x.h.date.startsWith(S.month)).sort((a, b) => a.h.date.localeCompare(b.h.date));
  return `<div class="cal-h"><button class="icon" data-act="mo" data-n="-1" aria-label="الشهر السابق">${ic('back')}</button><h2>${E(monthName)}</h2><button class="icon" data-act="mo" data-n="1" aria-label="الشهر التالي">${ic('back', 'flip')}</button></div>` +
    `<div class="grid" role="grid">${names.map((n) => `<span class="gh">${n}</span>`).join('')}${cells}</div>` +
    `<div class="sec-h"><h3>${E(fDay(S.day))} ${E(fDate(S.day))}</h3><button class="btn small quiet" data-act="printDay">${ic('print')}طباعة</button></div>` +
    (dayList.length ? `<div class="list">${dayList.map((x) => hRow(x.h, x.c, { late: x.h.date < today() && !x.h.result })).join('')}</div>` : '<p class="calm">لا جلسات في هذا اليوم.</p>') +
    (inMonth.length ? `<div class="sec-h"><h3>كل جلسات الشهر</h3></div><div class="list">${inMonth.map((x) => hRow(x.h, x.c, { date: 1 })).join('')}</div>` : '');
}

/* ---------- الأتعاب ---------- */
function vFees() {
  const all = DB.cases, tot = all.reduce((a, c) => a + num(c.feeTotal), 0), pd = all.reduce((a, c) => a + paid(c), 0), sp = all.reduce((a, c) => a + spent(c), 0);
  const owed = all.filter((c) => balance(c) > 0).sort((a, b) => balance(b) - balance(a));
  const mo = today().slice(0, 7), thisMonth = all.reduce((a, c) => a + c.payments.filter((p) => p.date.startsWith(mo)).reduce((s, p) => s + num(p.amount), 0), 0);
  if (!all.length) return empty('لا أتعاب بعد', 'حدّد أتعاب كل قضية وسجّل الدفعات لتعرف المتبقي لكل موكّل.');
  return `<div class="ledger big"><div><small>المتفق عليه</small><b>${E(fNum(tot))}</b></div><div><small>المستلم</small><b>${E(fNum(pd))}</b></div><div class="${tot - pd > 0 ? 'owed' : ''}"><small>المتبقي</small><b>${E(fNum(Math.max(0, tot - pd)))}</b></div></div>` +
    `<p class="calm sm">استلمت هذا الشهر ${E(money(thisMonth))}${sp ? ' · مصروفات مدفوعة عن الموكلين ' + E(money(sp)) : ''}</p>` +
    `<div class="sec-h"><h3>المتبقي لدى الموكلين</h3></div>` + (owed.length ? `<div class="list">${owed.map((c) => `<button class="row" data-act="case" data-id="${c.id}" data-sub="fees"><span class="main"><strong>${E(caseLabel(c))}</strong><small>${E(who(c))} · مستلم ${E(fNum(paid(c)))} من ${E(fNum(num(c.feeTotal)))}</small></span><span class="amt">${E(fNum(balance(c)))}</span></button>`).join('')}</div>` : '<p class="calm">لا مبالغ متبقية. كل الأتعاب المسجّلة مستلمة.</p>');
}

/* ---------- الأدوات والإعدادات ---------- */
function vTools() {
  const pct = Math.min(100, Math.round(Meta.bytes / LIMIT * 100));
  setTimeout(vaultUse, 0);
  return `<div class="sec-h"><h3>حاسبة المواعيد</h3></div><div class="calc"><form id="calc"><label class="fld half"><span>من تاريخ</span><input type="date" name="d" value="${today()}"></label><label class="fld half"><span>أضف</span><input type="text" inputmode="numeric" name="n" value="30"></label><label class="fld half"><span>الوحدة</span><select name="u"><option value="d">أيام</option><option value="m">أشهر</option></select></label><label class="fld half"><span>إلى تاريخ (لحساب الفرق)</span><input type="date" name="e"></label></form><output id="calc-out" aria-live="polite"></output><p class="note">حساب حسابي فقط. مواعيد الطعن والتقادم تُحدَّد بنص القانون وطريقة احتساب العطلات، فتحقق منها قبل الاعتماد.</p></div>` +
    `<div class="sec-h"><h3>بيانات المكتب</h3><button class="btn small quiet" data-act="office">${ic('edit')}تعديل</button></div><dl class="facts one"><div><dt>المكتب</dt><dd>${E(DB.s.office) || '<span class="muted">غير مضبوط، يظهر في أعلى المستندات المطبوعة</span>'}</dd></div><div><dt>المحامي</dt><dd>${E(DB.s.lawyer)}</dd></div><div><dt>العملة</dt><dd>${E(DB.s.cur)}</dd></div></dl>` +
    `<div class="sec-h"><h3>النسخ الاحتياطي</h3></div><div class="store"><div class="meter" aria-hidden="true"><i class="${pct > 85 ? 'hot' : ''}" style="width:${Math.max(2, pct)}%"></i></div><p>مساحة البيانات المستخدمة ${pct}%${pct > 85 ? '، قاربت الامتلاء. صدّر نسخة واحذف القضايا المنتهية.' : '. البيانات مضغوطة وتتسع لمئات القضايا.'}</p><div class="foot left"><button class="btn quiet" data-act="export">${ic('down')}تصدير نسخة</button><button class="btn quiet" data-act="import">${ic('up')}استيراد نسخة</button><input id="imp" type="file" accept=".json,application/json" hidden></div><p id="vuse" class="calm sm"></p><p class="note">بياناتك محفوظة على جهازك داخل التطبيق فقط. صدّر نسخة بعد كل تحديث مهم واحفظها في مكان آخر.</p></div>` +
    `<div class="sec-h"><h3>المستندات والنماذج</h3><button class="btn small pri" data-act="newTpl">${ic('plus')}نموذج جديد</button></div><p class="calm sm">أضف أي مستند تحتاجه مستقبلاً: اكتب نصه مرة واحدة بوسوم مثل {الموكل} و{المحكمة}، ثم أنشئه لأي قضية بضغطة.</p>${DB.tpls.length ? `<div class="list">${DB.tpls.map((t) => `<div class="row"><button class="main as-btn" data-act="useTpl" data-t="${t.id}"><strong>${E(t.name)}</strong><small>نموذجي</small></button><button class="btn small quiet" data-act="editTpl" data-id="${t.id}">${ic('edit')}تعديل</button></div>`).join('')}</div>` : ''}<div class="tpl lead">${TPL.map((t) => `<button class="tpl-i" data-act="useTpl" data-t="${t.id}">${ic('doc')}<span>${E(t.name)}</span></button>`).join('')}</div>`;
}
function calc() {
  const f = $('#calc'); if (!f) return; const o = $('#calc-out');
  const d = f.d.value, n = Math.round(num(f.n.value)), e = f.e.value; let h = '';
  if (d) { const r = f.u.value === 'm' ? addMonths(d, n) : addDays(d, n); h += `<div class="res-l"><small>${n} ${f.u.value === 'm' ? 'شهر' : 'يوماً'} بعد ${E(fDate(d))}</small><strong>${E(fDay(r))} ${E(fDate(r))}</strong></div>`; }
  if (d && e) { const k = diff(e, d); h += `<div class="res-l"><small>الفرق بين التاريخين</small><strong>${Math.abs(k)} يوماً${k < 0 ? ' (قبل)' : ''}</strong></div>`; }
  o.innerHTML = h;
}

async function vaultUse() { const o = $('#vuse'); if (!o) return; if (!hasVault()) { o.textContent = 'ملفات الأجهزة تحتاج تحديث العيسائي برو إلى 2.7.0.'; return; } try { const u = await Alaisai.vault.usage(); o.textContent = 'الملفات المرفقة: ' + u.count + ' ملف، ' + sizeTxt(u.bytes) + ' من 150 م.ب على هذا الجهاز.'; } catch (e) { /* لا شيء */ } }
