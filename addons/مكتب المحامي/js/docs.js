'use strict';
/* ===== النماذج الجاهزة: مسودات تُعبَّأ من بيانات القضية ويعدّلها المحامي قبل الطباعة ===== */
const BL = '…………………';
const v = (x, d = BL) => (x == null || x === '' ? d : x);
function ctx(c) {
  const cl = c && client(c.clientId) || {};
  return {
    c: c || {}, cl, me: DB.s.lawyer || BL, office: DB.s.office || '', today: fDate(today()), city: DB.s.city || BL,
    cname: cl.name || BL, num: c ? v(c.number) : BL, year: c && c.year ? '/' + c.year : '', court: c ? v(c.court) : BL,
    opp: c ? v(c.opponent) : BL, role: c ? v(c.role) : BL, subject: c ? v(c.subject) : BL,
  };
}
const TPL = [
  { id: 'fee', name: 'اتفاقية أتعاب', ask: [{ n: 'amount', l: 'إجمالي الأتعاب', t: 'number' }, { n: 'terms', l: 'نظام السداد', t: 'textarea', ph: 'مثال: دفعة عند التوقيع والباقي على أقساط شهرية' }],
    build: (x, a) => `اتفاقية أتعاب محاماة\n\nحُرّرت هذه الاتفاقية بتاريخ ${x.today} في ${x.city} بين كل من:\n\nأولاً: الأستاذ/ ${x.me}${x.office ? ' - ' + x.office : ''} (المحامي).\nثانياً: السيد/ ${x.cname}${x.cl.idno ? '، هوية رقم ' + x.cl.idno : ''} (الموكّل).\n\nالمادة 1 - موضوع الاتفاقية\nيتولى المحامي تمثيل الموكّل والدفاع عن مصالحه في القضية رقم ${x.num}${x.year} أمام ${x.court}، وموضوعها: ${x.subject}.\n\nالمادة 2 - الأتعاب\nاتفق الطرفان على أتعاب إجمالية قدرها ${a.amount ? fNum(num(a.amount)) + ' ' + DB.s.cur : BL}.\n\nالمادة 3 - طريقة السداد\n${a.terms || BL}\n\nالمادة 4 - المصروفات\nلا تشمل الأتعاب الرسوم القضائية ومصاريف الخبرة والانتقال والتصوير، ويلتزم بها الموكّل ويُقدَّم له كشف بها.\n\nالمادة 5 - التزامات الموكّل\nيلتزم الموكّل بتزويد المحامي بكل المستندات والمعلومات الصحيحة في الوقت المناسب، وبحضور الجلسات التي يُطلب حضوره فيها.\n\nالمادة 6 - الإنهاء\nلكل طرف إنهاء الاتفاقية بإخطار كتابي، ويستحق المحامي أتعاب ما أُنجز من العمل حتى تاريخ الإنهاء.\n\nالمادة 7 - الخلاف\nيُحال أي خلاف حول هذه الاتفاقية إلى التسوية الودية أولاً، فإن تعذّرت فإلى الجهة المختصة.\n\nالمحامي: ${x.me}                      الموكّل: ${x.cname}\nالتوقيع: ………………                      التوقيع: ………………` },
  { id: 'receipt', name: 'إيصال استلام مبلغ', ask: [{ n: 'amount', l: 'المبلغ المستلم', t: 'number', req: true }, { n: 'for', l: 'عن', t: 'text', ph: 'دفعة من الأتعاب / مصروفات' }],
    build: (x, a) => `سند استلام\n\nالتاريخ: ${x.today}\n\nاستلمتُ أنا ${x.me}${x.office ? ' (' + x.office + ')' : ''} من السيد/ ${x.cname} مبلغاً وقدره ${fNum(num(a.amount))} ${DB.s.cur}، وذلك عن ${a.for || 'دفعة من الأتعاب'} في القضية رقم ${x.num}${x.year} - ${x.court}.\n\nالمستلم: ${x.me}\nالتوقيع: ………………` },
  { id: 'notice', name: 'إنذار رسمي', ask: [{ n: 'demand', l: 'المطلوب من المنذَر', t: 'textarea', ph: 'مثال: سداد مبلغ … خلال … يوماً من تاريخ الإنذار' }, { n: 'days', l: 'المهلة بالأيام', t: 'number' }],
    build: (x, a) => `إنذار رسمي\n\nالتاريخ: ${x.today}\n\nإلى السيد/ ${x.opp}\n\nالموضوع: ${x.subject}\n\nبناءً على توكيل السيد/ ${x.cname}، وبصفتي وكيلاً عنه، أُنذركم بما يلي:\n\n${a.demand || BL}\n\nوعليه، فإنني أمهلكم ${a.days ? a.days + ' يوماً' : BL} من تاريخ تسلّمكم هذا الإنذار للوفاء بما ذُكر أعلاه، وإلا اضطررتُ إلى اتخاذ الإجراءات القانونية اللازمة لاستيفاء حقوق موكّلي، مع تحميلكم الرسوم والمصاريف والأتعاب.\n\nوتفضلوا بقبول الاحترام،\n\nالمحامي: ${x.me}\nالتوقيع: ………………` },
  { id: 'reply', name: 'هيكل مذكرة جوابية', ask: [],
    build: (x) => `بسم الله الرحمن الرحيم\n\nمذكرة جوابية مقدّمة إلى ${x.court}\nفي القضية رقم ${x.num}${x.year}\n\nمقدّمة من: ${x.cname} (${x.role})\nضد: ${x.opp}\n\nالوقائع\n${BL}\n\nالدفوع الشكلية\n1. ${BL}\n\nالدفوع الموضوعية\n1. ${BL}\n2. ${BL}\n\nالسند القانوني\n${BL}\n\nالطلبات\nلكل ما تقدّم، يلتمس الموكّل من المحكمة الموقّرة:\n1. ${BL}\n2. ${BL}\n\nوتفضلوا بقبول فائق الاحترام،\n\nالمحامي: ${x.me}\nالتاريخ: ${x.today}` },
  { id: 'adjourn', name: 'طلب تأجيل جلسة', ask: [{ n: 'date', l: 'تاريخ الجلسة', t: 'date' }, { n: 'reason', l: 'سبب الطلب', t: 'textarea', ph: 'مثال: استكمال المستندات / تعذّر حضور الموكّل لعذر' }],
    build: (x, a) => `إلى ${x.court}\n\nالموضوع: طلب تأجيل النظر في القضية رقم ${x.num}${x.year}\n\nيتقدّم الموقّع أدناه بصفته وكيلاً عن ${x.cname} (${x.role}) بطلب تأجيل الجلسة المحدّدة بتاريخ ${a.date ? fDate(a.date) : BL}، وذلك للسبب الآتي:\n\n${a.reason || BL}\n\nلذا يلتمس التفضّل بالموافقة على التأجيل لموعد قريب يحدّده المقام الكريم.\n\nوتفضلوا بقبول الاحترام،\n\nالمحامي: ${x.me}\nالتاريخ: ${x.today}` },
  { id: 'status', name: 'تقرير حالة القضية للموكّل', ask: [],
    build: (x) => { const c = x.c, nh = c.hearings ? nextHearing(c) : null; const last = c.hearings ? c.hearings.filter((h) => h.result).sort((a, b) => b.date.localeCompare(a.date))[0] : null;
      return `تقرير حالة القضية\n\nالتاريخ: ${x.today}\nالسيد/ ${x.cname}\n\nالقضية: ${caseLabel(c)}\nالرقم: ${x.num}${x.year}    الجهة: ${x.court}\nالصفة: ${x.role}    الخصم: ${x.opp}\nالحالة الحالية: ${v(c.status)}\n\nآخر ما جرى${last ? ' (' + fDate(last.date) + ')' : ''}\n${last ? last.result : BL}\n\nالجلسة القادمة\n${nh ? fDate(nh.date) + (nh.time ? ' الساعة ' + nh.time : '') + (nh.note ? ' - ' + nh.note : '') : 'لم يُحدَّد موعد بعد'}\n\nالمطلوب منكم\n${(c.tasks || []).filter((t) => !t.done).map((t, i) => (i + 1) + '. ' + t.text).join('\n') || BL}\n\nمع التحية،\n${x.me}`; } },
  { id: 'account', name: 'كشف حساب القضية', ask: [],
    build: (x) => { const c = x.c; const rows = (c.payments || []).map((p) => `${fDate(p.date)}    ${fNum(num(p.amount))}    ${p.note || ''}`).join('\n') || 'لا دفعات مسجّلة';
      const ex = (c.expenses || []).map((p) => `${fDate(p.date)}    ${fNum(num(p.amount))}    ${p.note || ''}`).join('\n') || 'لا مصروفات مسجّلة';
      return `كشف حساب\n\nالتاريخ: ${x.today}\nالسيد/ ${x.cname}\nالقضية: ${caseLabel(c)} - رقم ${x.num}${x.year}\n\nالأتعاب المتفق عليها: ${fNum(num(c.feeTotal))} ${DB.s.cur}\n\nالدفعات المستلمة\n${rows}\nمجموع المستلم: ${fNum(paid(c))} ${DB.s.cur}\n\nالأتعاب المتبقية: ${fNum(balance(c))} ${DB.s.cur}\n\nالمصروفات المدفوعة من المكتب\n${ex}\nمجموع المصروفات: ${fNum(spent(c))} ${DB.s.cur}\n\n${x.me}`; } },
  { id: 'checklist', name: 'قائمة مستندات القضية', ask: [],
    build: (x) => { const d = x.c.docs || []; return `قائمة مستندات القضية\n\nالقضية: ${caseLabel(x.c)}    الموكّل: ${x.cname}\nالتاريخ: ${x.today}\n\n${d.length ? d.map((m) => (m.have ? '[ √ ] ' : '[    ] ') + m.name).join('\n') : BL}\n\nالمستند المعلّم بـ √ استُلم، وغير المعلّم مطلوب من الموكّل.`; } },
];
const tplAll = () => [...TPL, ...DB.tpls.map((t) => ({ id: t.id, name: t.name, custom: 1, ask: [], build: (x) => fillTpl(t.body, x) }))];
const tplById = (id) => tplAll().find((t) => t.id === id);
const TOKENS = ['الموكل', 'الهاتف', 'الهوية', 'العنوان', 'القضية', 'الرقم', 'المحكمة', 'الخصم', 'الصفة', 'الموضوع', 'الأتعاب', 'المستلم', 'المتبقي', 'التاريخ', 'المحامي', 'المكتب', 'المدينة'];
function fillTpl(body, x) {
  const c = x.c || {}, has = !!c.id, m = {
    'الموكل': x.cname, 'الهاتف': v(x.cl.phone), 'الهوية': v(x.cl.idno), 'العنوان': v(x.cl.addr), 'القضية': has ? caseLabel(c) : BL, 'الرقم': x.num + x.year, 'المحكمة': x.court, 'الخصم': x.opp, 'الصفة': x.role, 'الموضوع': x.subject,
    'الأتعاب': has ? fNum(num(c.feeTotal)) + ' ' + DB.s.cur : BL, 'المستلم': has ? fNum(paid(c)) + ' ' + DB.s.cur : BL, 'المتبقي': has ? fNum(balance(c)) + ' ' + DB.s.cur : BL,
    'التاريخ': x.today, 'المحامي': x.me, 'المكتب': v(x.office), 'المدينة': x.city };
  return String(body).replace(/\{([^{}\n]{1,20})\}/g, (a, k) => (Object.prototype.hasOwnProperty.call(m, k.trim()) ? m[k.trim()] : a));
}
function editTpl(id, after) {
  const t = id ? DB.tpls.find((x) => x.id === id) : null;
  const el = sheet(t ? 'تعديل النموذج' : 'نموذج جديد', `<form class="frm" novalidate><label class="fld"><span>اسم النموذج</span><input name="name" value="${E(t ? t.name : '')}" autocomplete="off"></label><label class="fld"><span>نص النموذج</span><textarea name="body" rows="12" class="doc-text sm" placeholder="اكتب نص المستند، واضغط على أي وسم أدناه ليُدرج مكانه عند الإنشاء.">${E(t ? t.body : '')}</textarea></label><div class="toks" aria-label="وسوم تُعبَّأ تلقائياً">${TOKENS.map((k) => `<button type="button" class="chip" data-tok="${E(k)}">{${E(k)}}</button>`).join('')}</div><div class="actions">${t ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<button type="button" class="btn quiet" data-imp>${ic('up')}من ملف نصي</button><input type="file" accept=".txt,.md,text/plain" hidden data-file><span class="grow"></span><button type="submit" class="btn pri">حفظ</button></div><p class="note">الوسوم مثل {الموكل} و{المحكمة} تُستبدل ببيانات القضية المختارة. ما لا يُعرف يبقى فراغاً للتعبئة.</p></form>`, { wide: true, noFocus: true });
  const f = $('form', el), ta = f.elements.body;
  $$('[data-tok]', el).forEach((b) => { b.onclick = () => { const s0 = ta.selectionStart || ta.value.length, e0 = ta.selectionEnd || s0, tx = '{' + b.dataset.tok + '}'; ta.value = ta.value.slice(0, s0) + tx + ta.value.slice(e0); ta.focus(); ta.setSelectionRange(s0 + tx.length, s0 + tx.length); }; });
  $('[data-imp]', el).onclick = () => $('[data-file]', el).click();
  $('[data-file]', el).onchange = (e) => { const fl = e.target.files[0]; if (!fl) return; if (fl.size > 200000) return toast('الملف كبير، الحد 200 ك.ب'); const r = new FileReader(); r.onload = () => { ta.value = String(r.result); if (!f.elements.name.value) f.elements.name.value = fl.name.replace(/\.[^.]+$/, ''); }; r.readAsText(fl); };
  f.onsubmit = (e) => { e.preventDefault(); const name = f.elements.name.value.trim(), body = ta.value.trim(); if (!name || !body) return toast('اكتب اسم النموذج ونصه'); if (t) { t.name = name; t.body = body; } else DB.tpls.push({ id: 'u' + uid(), name, body }); closeSheet(); persist(); toast('حُفظ النموذج'); if (after) after(); else render(); };
  const d = $('[data-del]', el); if (d) d.onclick = async () => { if (await ask('حذف هذا النموذج؟', 'حذف')) { DB.tpls = DB.tpls.filter((x) => x !== t); closeSheet(); persist(); render(); } };
}
function openTemplate(c, t, pre) {
  const make = (a) => {
    const text = t.build(ctx(c), a || {});
    const el = sheet(t.name, `<p class="note">مسودة تُعبَّأ من بياناتك. راجعها وعدّلها حسب القانون والمحكمة المختصة قبل الاعتماد.</p><textarea id="doc-text" class="doc-text" rows="18">${E(text)}</textarea><div class="actions"><span class="grow"></span><button class="btn quiet" data-save>${ic('down')}تنزيل</button><button class="btn pri" data-print>${ic('print')}طباعة</button></div>`, { wide: true, noFocus: true });
    const body = () => $('#doc-text', el).value;
    const html = () => `<div class="paper">${letterhead()}<div class="paper-body">${E(body()).replace(/\n/g, '<br>')}</div></div>`;
    $('[data-print]', el).onclick = () => printHTML(html());
    $('[data-save]', el).onclick = () => download(t.name + '.txt', (DB.s.office ? DB.s.office + '\n\n' : '') + body(), 'text/plain');
  };
  if (!t.ask.length) return make();
  form(t.name, t.ask, pre || {}, make, { ok: 'إنشاء المسودة' });
}
function pickTemplate(c) {
  const el = sheet('إنشاء مستند', `<div class="tpl">${tplAll().map((t) => `<button class="tpl-i" data-t="${t.id}">${ic('doc')}<span>${E(t.name)}</span></button>`).join('')}<button class="tpl-i add" data-new>${ic('plus')}<span>نموذج خاص بي</span></button></div>`, { noFocus: true });
  $$('[data-t]', el).forEach((b) => { b.onclick = () => { const t = tplById(b.dataset.t); closeSheet(); openTemplate(c, t); }; });
  $('[data-new]', el).onclick = () => editTpl(null, () => { pickTemplate(c); });
}
