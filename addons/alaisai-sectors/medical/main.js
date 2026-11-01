/* إضافة قطاع الطب والأدوية — العيسائي برو */
(function () {
  'use strict';
  const C = window.AlCore, h = C.h;
  const S = C.store('medical');

  const TYPES = [['doctor', 'طبيب'], ['hospital', 'مستشفى'], ['pharmacy', 'صيدلية'], ['nurse', 'ممرض'], ['supplier', 'مورّد'], ['company', 'شركة']];
  const typeLabel = v => (TYPES.find(t => t[0] === v) || [0, v || ''])[1];
  const STATUS = [['new', 'جديد'], ['confirmed', 'مؤكد'], ['done', 'منجز'], ['cancelled', 'ملغى']];
  const statusLabel = v => (STATUS.find(t => t[0] === v) || [0, v])[1];
  const statusCls = v => ({ new: 'warn', confirmed: '', done: 'ok', cancelled: 'bad' }[v] || '');

  let ENT = [];                       // نسخة من الجهات لاستخدامها في القوائم المنسدلة
  const entName = id => (ENT.find(e => e.id === id) || {}).name || '';
  const entOpts = () => [['', '— بدون —']].concat(ENT.map(e => [e.id, e.name + ' (' + typeLabel(e.type) + ')']));

  /* ---------- الجهات: أطباء، مستشفيات، صيدليات، ممرضون، مورّدون، شركات ---------- */
  const entities = C.collection({
    store: S, kind: 'entities', label: 'الجهات الطبية', singular: 'جهة',
    filterKey: 'type', filterOptions: TYPES, mapKey: 'map',
    schema: [
      { key: 'avatar', label: 'الصورة الشخصية / الشعار', type: 'image', max: 256, round: true },
      { key: 'type', label: 'النوع', type: 'select', options: TYPES },
      { key: 'name', label: 'الاسم', req: true },
      { key: 'specialty', label: 'التخصص' },
      { key: 'degree', label: 'الدرجة العلمية' },
      { key: 'country', label: 'الدولة' },
      { key: 'province', label: 'المحافظة' },
      { key: 'district', label: 'المديرية' },
      { key: 'isolation', label: 'العزلة' },
      { key: 'street', label: 'الشارع' },
      { key: 'map', label: 'رابط الموقع (Google Maps)', wide: true },
      { key: 'bio', label: 'السيرة الذاتية', type: 'textarea', wide: true },
      { key: 'contacts', label: 'وسائل التواصل والحسابات', type: 'contacts' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', wide: true },
      { key: 'welcome', label: 'تفعيل الصورة الترحيبية لهذه الجهة', type: 'checkbox', wide: true },
      { key: 'welcomeImg', label: 'الصورة الترحيبية', type: 'image', max: 900 }
    ],
    card: r => ({
      title: r.name, sub: [typeLabel(r.type), r.specialty, r.degree].filter(Boolean).join(' · '),
      lines: [[r.province, r.district, r.isolation, r.street].filter(Boolean).join('، '),
        (r.contacts || []).length ? (r.contacts.length + ' وسيلة تواصل') : ''].filter(Boolean)
    }),
    onChange: l => { ENT = l; renderDash(); }
  });

  /* ---------- الأدوية والمعدات ---------- */
  const medicines = C.collection({
    store: S, kind: 'medicines', label: 'الأدوية والمعدات', singular: 'صنف',
    schema: [
      { key: 'name', label: 'الصنف', req: true, wide: true },
      { key: 'pack', label: 'العبوة' },
      { key: 'count', label: 'العدد في العبوة', type: 'number' },
      { key: 'qty', label: 'الكمية المتوفرة', type: 'number' },
      { key: 'price', label: 'السعر', type: 'number' },
      { key: 'date', label: 'التاريخ / الانتهاء', type: 'date' },
      { key: 'entityId', label: 'الجهة (صيدلية / مورّد / شركة)', type: 'select', options: entOpts, wide: true },
      { key: 'total', label: 'قيمة المخزون', type: 'computed', compute: v => C.fmt(C.num(v.qty) * C.num(v.price)) },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', wide: true }
    ],
    extraText: r => entName(r.entityId),
    card: r => ({
      title: r.name, sub: [r.pack, r.count ? ('عدد ' + C.fmt(r.count)) : ''].filter(Boolean).join(' · '),
      lines: [r.qty !== '' && r.qty != null ? 'الكمية: ' + C.fmt(r.qty) : '', r.price ? 'السعر: ' + C.fmt(r.price) : '',
        r.date ? 'التاريخ: ' + r.date : '', entName(r.entityId) ? 'الجهة: ' + entName(r.entityId) : ''].filter(Boolean)
    }),
    onChange: () => renderDash()
  });

  /* ---------- الحجوزات والمواعيد (مع الحسابات المالية الفورية) ---------- */
  const bookings = C.collection({
    store: S, kind: 'bookings', label: 'الحجوزات والمواعيد', singular: 'حجز',
    filterKey: 'status', filterOptions: STATUS,
    defaults: () => ({ status: 'new' }),
    schema: [
      { key: 'patient', label: 'اسم المراجع', req: true },
      { key: 'phone', label: 'رقم الهاتف' },
      { key: 'entityId', label: 'الجهة', type: 'select', options: entOpts, wide: true },
      { key: 'service', label: 'الخدمة / الاستفسار', wide: true },
      { key: 'when', label: 'موعد الحجز', type: 'datetime-local' },
      { key: 'status', label: 'الحالة', type: 'select', options: STATUS },
      { key: 'agreed', label: 'المتفق عليه', type: 'number' },
      { key: 'paid', label: 'المدفوع', type: 'number' },
      { key: 'remaining', label: 'المتبقي (تلقائي)', type: 'computed', compute: v => C.fmt(C.finance(v.agreed, v.paid).remaining) },
      { key: 'receipt', label: 'سند الحوالة / الإيداع البنكي', type: 'image', max: 1000 },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', wide: true }
    ],
    extraText: r => entName(r.entityId),
    card: r => {
      const f = C.finance(r.agreed, r.paid);
      return {
        title: r.patient, sub: [r.service, entName(r.entityId)].filter(Boolean).join(' · '),
        badge: statusLabel(r.status), badgeCls: statusCls(r.status),
        lines: [r.when ? 'الموعد: ' + r.when.replace('T', ' ') : '',
          f.agreed || f.paid ? ('المتفق: ' + C.fmt(f.agreed) + ' | المدفوع: ' + C.fmt(f.paid) + ' | المتبقي: ' + C.fmt(f.remaining)) : ''].filter(Boolean)
      };
    },
    onChange: () => renderDash()
  });

  /* ---------- العروض والمنشورات الطبية ---------- */
  const posts = C.collection({
    store: S, kind: 'posts', label: 'العروض والمنشورات', singular: 'منشور',
    schema: [
      { key: 'title', label: 'العنوان', req: true, wide: true },
      { key: 'entityId', label: 'الجهة الناشرة', type: 'select', options: entOpts, wide: true },
      { key: 'body', label: 'النص', type: 'textarea', wide: true },
      { key: 'image', label: 'صورة', type: 'image', max: 900 }
    ],
    extraText: r => entName(r.entityId),
    card: r => ({ title: r.title, sub: entName(r.entityId), lines: [(r.body || '').slice(0, 90)].filter(Boolean) }),
    onChange: () => renderDash()
  });

  /* ---------- الواجهة: لوحة، تبويبات، بحث شامل ---------- */
  const COLLS = { entities, medicines, bookings, posts };
  const TABS = [['dash', '📊', 'الرئيسية'], ['entities', '🏥', 'الجهات'], ['medicines', '💊', 'الأدوية'], ['bookings', '📅', 'الحجوزات'], ['posts', '📢', 'العروض']];
  const panes = {};
  const dash = h('section', { class: 'dash' });
  panes.dash = dash;
  Object.keys(COLLS).forEach(k => { panes[k] = COLLS[k].el; });

  const app = document.getElementById('app');
  const logo = h('span', { id: 'logo' });
  const title = h('b', { id: 'title', text: 'الطب والأدوية' });
  const search = h('input', { class: 'al-search', type: 'search', placeholder: 'ابحث: طبيب، مستشفى، دواء، شركة…', 'aria-label': 'بحث شامل', oninput: () => runSearch() });
  const head = h('header', { class: 'top' },
    h('div', { class: 'brand' }, logo, title, h('button', { class: 'al-ib', type: 'button', 'aria-label': 'هوية الصفحة', text: '⚙️', onclick: openProfile })),
    search);
  const nav = h('nav', { class: 'tabs' }, TABS.map(t => h('button', {
    type: 'button', 'data-tab': t[0], onclick: () => show(t[0])
  }, h('span', { text: t[1] }), h('small', { text: t[2] }))));
  app.append(head, ...Object.values(panes), nav);

  let current = 'dash';
  function show(name) {
    current = name; search.value = ''; runSearch(true);
    if (name === 'dash') renderDash();
    Object.keys(panes).forEach(k => { panes[k].hidden = k !== name; });
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  }

  function runSearch(silent) {
    const q = search.value;
    Object.values(COLLS).forEach(c => c.setQuery(q));
    if (!q.trim()) { if (!silent) show(current); return; }
    dash.hidden = true;
    Object.keys(COLLS).forEach(k => { panes[k].hidden = COLLS[k].count() === 0; });
    nav.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    if (Object.keys(COLLS).every(k => panes[k].hidden)) {
      dash.hidden = false; dash.replaceChildren(h('p', { class: 'al-empty', text: 'لا نتائج مطابقة لبحثك' }));
    } else renderDash();
  }

  function stat(label, value, cls) {
    return h('div', { class: 'stat ' + (cls || '') }, h('b', { text: String(value) }), h('small', { text: label }));
  }

  function renderDash() {
    const bk = bookings.all().filter(b => b.status !== 'cancelled');
    const t = C.sumFinance(bk);
    const byType = TYPES.map(([k, l]) => [l, ENT.filter(e => e.type === k).length]).filter(x => x[1]);
    dash.replaceChildren(
      h('div', { class: 'grid' },
        stat('الجهات', ENT.length), stat('الأصناف', medicines.all().length),
        stat('الحجوزات', bookings.all().length), stat('المنشورات', posts.all().length)),
      h('h3', { text: 'الحسابات (من الحجوزات غير الملغاة)' }),
      h('div', { class: 'grid three' },
        stat('المتفق عليه', C.fmt(t.agreed)), stat('المدفوع', C.fmt(t.paid), 'ok'),
        stat('المتبقي', C.fmt(t.remaining), t.remaining > 0 ? 'warn' : 'ok')),
      byType.length ? h('div', {}, h('h3', { text: 'توزيع الجهات' }),
        h('ul', { class: 'dist' }, byType.map(([l, n]) => h('li', {}, h('span', { text: l }), h('b', { text: String(n) }))))) : null,
      !ENT.length ? h('p', { class: 'al-empty', text: 'ابدأ بإضافة أول جهة من تبويب «الجهات».' }) : null);
  }

  /* ---------- هوية الصفحة: شعار دائري + صورة ترحيبية ---------- */
  let profile = { name: '', logo: '', welcome: false, welcomeImg: '', welcomeSeen: false };

  function applyProfile() {
    title.textContent = profile.name || 'الطب والأدوية';
    logo.replaceChildren(C.avatar({ avatar: profile.logo, name: profile.name || 'ط' }, 38));
  }

  async function openProfile() {
    const f = C.form([
      { key: 'logo', label: 'الشعار / الصورة الشخصية (دائرية)', type: 'image', max: 256, round: true },
      { key: 'name', label: 'اسم الصفحة (مستشفى، مكتب، صيدلية…)', wide: true },
      { key: 'welcome', label: 'تفعيل الصورة الترحيبية عند أول فتح', type: 'checkbox', wide: true },
      { key: 'welcomeImg', label: 'الصورة الترحيبية', type: 'image', max: 900 }
    ], profile);
    C.modal('هوية الصفحة', f.el, [{
      text: 'حفظ', fn: async () => {
        const v = f.get();
        profile = Object.assign({}, profile, v, { welcomeSeen: (v.welcomeImg !== profile.welcomeImg) ? false : profile.welcomeSeen });
        await S.set('profile', profile); applyProfile(); C.toast('تم الحفظ');
      }
    }, { text: 'إلغاء', cls: 'ghost' }]);
  }

  async function init() {
    const p = await S.get('profile');
    if (p && typeof p === 'object') profile = Object.assign(profile, p);
    applyProfile();
    await Promise.all(Object.values(COLLS).map(c => c.load()));
    show('dash');
    if (profile.welcome && profile.welcomeImg && !profile.welcomeSeen) {
      C.splash(profile.welcomeImg, profile.name, 2600);
      profile.welcomeSeen = true; await S.set('profile', profile);
    }
  }
  init();
})();
