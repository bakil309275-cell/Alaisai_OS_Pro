'use strict';
function render() {
  const p = DB.profile;
  $('#top').innerHTML = `${avatar(40)}<div class="tt"><strong>${E(p.name || CFG.name)}</strong><small>${E(p.kind || CFG.name)}</small></div><span class="grow"></span><button class="icon" data-act="search" aria-label="بحث شامل">${ic('search')}</button>`;
  const nav = TABS.map(([k, l, i]) => `<button class="${S.tab === k ? 'cur' : ''}" data-act="go" data-t="${k}" aria-label="${E(l)}">${ic(i)}<span>${E(l)}</span></button>`).join('');
  $('#tabs').innerHTML = nav; $('#rail').innerHTML = `<div class="brand">${avatar(54)}<strong>${E(p.name || CFG.name)}</strong><small>${E(CFG.name)}</small></div><div class="rail-nav">${nav}</div>`;
  $('#view').innerHTML = ({ home: vHome, cat: vCat, book: vBook, msg: vMsg, me: vMe }[S.tab])();
  hydrate($('#view')); if (S.tab === 'me') vaultUse();
  $$('.chips .on,.seg .on').forEach((x) => { try { x.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* لا شيء */ } });
}
async function vaultUse() { const o = $('#vuse'); if (!o || !hasVault()) return; try { const u = await Alaisai.vault.usage(); o.textContent = 'البيانات ' + Math.min(100, Math.round(Meta.bytes / LIMIT * 100)) + '% من المساحة. الصور: ' + u.count + ' ملف، ' + (u.bytes / 1048576).toFixed(1) + ' م.ب على هذا الجهاز.'; } catch (e) { /* لا شيء */ } }
function goto(t, l, s) { S.tab = t; if (l) { S.list = l; S.filter = ''; S.q = ''; } if (s) S.seg = s; render(); scrollTo(0, 0); }
const byId = (arr, id) => arr.find((x) => x.id === id);

/* ----- البحث الشامل ----- */
function searchSheet() {
  const el = sheet('بحث شامل', `<label class="search">${ic('search')}<input id="gq" type="search" placeholder="${E(CFG.searchHint)}" autocomplete="off"></label><div id="gres" class="gres"></div>`);
  const draw = () => {
    const q = norm($('#gq', el).value.trim()); const out = $('#gres', el); if (q.length < 1) { out.innerHTML = `<p class="calm">${E(CFG.searchHint)}</p>`; return; }
    const hit = [];
    CFG.lists.forEach((l) => recs(l.id).filter((r) => norm(l.fields.map((f) => r[f.n]).join(' ')).includes(q)).forEach((r) => hit.push({ g: l.title, t: r[l.primary], d: (l.sub || []).map((n) => r[n]).filter(Boolean).join(' · '), a: ['rec', l.id, r.id] })));
    DB.bookings.filter((b) => norm([b.name, b.phone, b.what, b.note].join(' ')).includes(q)).forEach((b) => hit.push({ g: CFG.book.tab, t: b.name, d: [b.what, fShort(b.date)].filter(Boolean).join(' · '), a: ['book', b.id] }));
    DB.inquiries.filter((i) => norm([i.from, i.text, i.phone].join(' ')).includes(q)).forEach((i) => hit.push({ g: 'الاستفسارات', t: i.from, d: i.text.slice(0, 60), a: ['inq', i.id] }));
    DB.posts.filter((p) => norm([p.title, p.text].join(' ')).includes(q)).forEach((p) => hit.push({ g: 'المنشورات', t: p.title, d: p.kind, a: ['post', p.id] }));
    out.innerHTML = hit.length ? `<div class="list">${hit.slice(0, 40).map((h, i) => `<button class="row rb" data-i="${i}"><span class="main"><strong>${E(h.t)}</strong><small>${E(h.g)}${h.d ? ' · ' + E(h.d) : ''}</small></span></button>`).join('')}</div>` : '<p class="calm">لا نتائج. جرّب كلمة أقصر.</p>';
    $$('[data-i]', out).forEach((b) => { b.onclick = () => { const a = hit[+b.dataset.i].a; closeSheet(true); if (a[0] === 'rec') { const l = lcfg(a[1]); viewRec(l, byId(recs(l.id), a[2])); } else if (a[0] === 'book') viewBook(byId(DB.bookings, a[1])); else if (a[0] === 'inq') viewInq(byId(DB.inquiries, a[1])); else viewPost(byId(DB.posts, a[1])); }; });
  };
  $('#gq', el).addEventListener('input', draw); draw();
}

/* ----- كتالوج للمشاركة (ملف HTML مستقل) ----- */
function blobData(b) { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); }
async function exportCatalog() {
  toast('جارٍ تجهيز الكتالوج…'); const p = DB.profile; let imgs = 0;
  const sections = [];
  for (const l of CFG.lists) {
    const items = recs(l.id).filter((r) => r.vis !== 'prv' && !r.hide); if (!items.length) continue; const cards = [];
    for (const r of items) {
      let im = ''; if (hasVault() && r.photos && r.photos[0] && imgs < 60) { try { const x = await Alaisai.vault.get('t' + r.photos[0]); if (x) { im = `<img alt="" src="${await blobData(x.blob)}">`; imgs++; } } catch (e) { /* لا شيء */ } }
      const bf = l.fields.find((f) => f.n === l.badge);
      cards.push(`<article class="c">${im}<h3>${E(r[l.primary])}</h3>${bf && r[bf.n] ? `<p class="pr">${E(fval(bf, r))}</p>` : ''}<ul>${l.fields.filter((f) => f.n !== l.primary && f.n !== l.badge && f.t !== 'textarea').map((f) => [f.l, fval(f, r)]).filter((x) => x[1]).slice(0, 5).map(([a, b]) => `<li><b>${E(a)}:</b> ${E(b)}</li>`).join('')}</ul></article>`);
    }
    sections.push(`<section><h2>${E(l.title)}</h2><div class="g">${cards.join('')}</div></section>`);
  }
  const offers = DB.posts.filter((x) => x.vis !== 'prv' && !x.hide).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12);
  if (offers.length) sections.unshift(`<section><h2>العروض والمنشورات</h2>${offers.map((x) => `<article class="c w"><h3>${E(x.title)}</h3><small>${E(fDate(x.date))}</small><p>${E(x.text || '').replace(/\n/g, '<br>')}</p></article>`).join('')}</section>`);
  if (!sections.length) return toast('لا عناصر عامة بعد. أضف عناصر واجعلها «عامة».');
  const ph = p.phones[0], css = getComputedStyle(document.documentElement), a = (css.getPropertyValue('--a') || '#1d4a43').trim();
  const doc = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(p.name || CFG.name)}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Tajawal,system-ui,sans-serif;background:#f3f4f2;color:#1a1d1c;line-height:1.7}header{background:${a};color:#fff;padding:28px 18px;text-align:center}header img,header .lg{width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #fff8;margin:0 auto 8px;display:block;background:#fff3}h1{margin:0;font-size:24px}.k{opacity:.85}main{max-width:960px;margin:0 auto;padding:16px}h2{margin:26px 0 10px;font-size:19px;border-inline-start:5px solid ${a};padding-inline-start:10px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.c{background:#fff;border-radius:12px;padding:12px;box-shadow:0 1px 3px #0002}.c img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.c h3{margin:8px 0 2px;font-size:16px}.pr{margin:0;color:${a};font-weight:700}.c ul{list-style:none;margin:6px 0 0;padding:0;font-size:14px;color:#444}.w{margin-bottom:10px}.btns{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}.btns a{background:#fff;color:${a};padding:8px 18px;border-radius:99px;text-decoration:none;font-weight:700}footer{text-align:center;padding:24px;color:#666;font-size:13px}</style></head><body><header>${p.logo ? `<img alt="" src="${E(p.logo)}">` : ''}<h1>${E(p.name || CFG.name)}</h1><div class="k">${E(p.kind || '')}</div>${p.bio ? `<p>${E(p.bio)}</p>` : ''}<div class="btns">${ph ? `<a href="tel:${E(telClean(ph.v))}">اتصال</a><a href="https://wa.me/${E(waNum(ph.v))}">واتساب</a>` : ''}${p.map && /^https?:/i.test(p.map) ? `<a href="${E(p.map)}">الموقع</a>` : ''}</div></header><main>${sections.join('')}</main><footer>${E(addrText())}<br>أُنشئ بإضافة ${E(CFG.name)} على العيسائي برو · ${E(fDate(today()))}</footer></body></html>`;
  download((p.name || CFG.name) + '-كتالوج.html', doc, 'text/html'); toast('نُزّل الكتالوج، أرسله بواتساب أو ارفعه على موقعك');
}
const cardText = () => { const p = DB.profile; return [`*${p.name || CFG.name}*`, p.kind, p.bio, ...p.phones.map((c) => '📞 ' + c.v + (c.t ? ' (' + c.t + ')' : '')), ...p.emails.map((c) => '✉️ ' + c.v), addrText() && '📍 ' + addrText(), p.map, ...p.links.map((c) => c.v)].filter(Boolean).join('\n'); };

/* ----- النسخ الاحتياطي ----- */
function exportBackup() { download((CFG.id) + '-نسخة-' + today() + '.json', JSON.stringify({ format: 'alaisai-biz', sector: CFG.id, profile: DB.profile, lists: DB.lists, bookings: DB.bookings, inquiries: DB.inquiries, posts: DB.posts })); toast('نُزّلت النسخة (بلا الصور)'); }
async function importBackup() {
  const [f] = await pickFile('.json,application/json'); if (!f) return; let o; try { o = JSON.parse(await f.text()); } catch (e) { return toast('ملف غير صالح'); }
  if (!o || o.format !== 'alaisai-biz' || o.sector !== CFG.id) return toast('هذه النسخة ليست من إضافة ' + CFG.name);
  if (!(await ask('ستحلّ النسخة محل بياناتك الحالية. متأكد؟', 'استبدال'))) return;
  normalize(o); await flush(); render(); toast('تم الاستيراد');
}

/* ----- القفل ----- */
const enc = new TextEncoder(); const bb = (u) => btoa(String.fromCharCode(...u)); const ub = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hashPin(pin, salt) { const k = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']); return bb(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, 256))); }
function lockSet() {
  form(localStorageLock ? 'تغيير القفل' : 'تفعيل القفل', [{ n: 'a', l: 'كلمة المرور الجديدة (4 أحرف على الأقل)' }, { n: 'b', l: 'تأكيدها' }], {}, async (o) => {
    if (o.a.length < 4 || o.a !== o.b) return toast('كلمتان غير متطابقتين أو قصيرتان');
    const salt = crypto.getRandomValues(new Uint8Array(16)); await Alaisai.set('lock', { s: bb(salt), h: await hashPin(o.a, salt) }); localStorageLock = true; render(); toast('فُعّل القفل');
  }, { del: localStorageLock, delLabel: 'إلغاء القفل', delMsg: 'إلغاء القفل؟', onDel: async () => { await Alaisai.remove('lock'); localStorageLock = false; render(); toast('أُلغي القفل'); } });
  const f = $('.sheet form'); if (f) { f.elements.a.type = 'password'; f.elements.b.type = 'password'; }
}
function showLock(rec) {
  return new Promise((res) => {
    const z = document.createElement('div'); z.className = 'lockscr'; z.innerHTML = `<form class="gate">${avatar(84)}<h1>${E(DB.profile.name || CFG.name)}</h1><input type="password" id="lp" placeholder="كلمة المرور" aria-label="كلمة المرور" autocomplete="current-password"><p class="err" id="le" role="alert"></p><button class="btn pri">فتح</button></form>`; document.body.appendChild(z);
    const f = $('form', z); setTimeout(() => $('#lp', z).focus(), 50);
    f.onsubmit = async (e) => { e.preventDefault(); if (await hashPin($('#lp', z).value, ub(rec.s)) === rec.h) { z.remove(); res(); } else { $('#le', z).textContent = 'كلمة المرور غير صحيحة'; $('#lp', z).value = ''; } };
  });
}

/* ----- الأحداث ----- */
const A = {
  go: (d) => goto(d.t, d.l, d.s), tip: (d) => { const g = d.g.split('|'); goto(g[0], g[1] && g[1] !== 'inq' ? g[1] : null, g[1] === 'inq' ? 'inq' : null); },
  search: searchSheet, list: (d) => { S.list = d.l; S.filter = ''; S.q = ''; render(); }, flt: (d) => { S.filter = d.k; render(); },
  newRec: () => recForm(lcfg(S.list)), viewRec: (d) => viewRec(lcfg(S.list), byId(recs(S.list), d.id)), recMenu: (d) => recMenu(lcfg(S.list), byId(recs(S.list), d.id)),
  newBook: () => bookForm(), viewBook: (d) => viewBook(byId(DB.bookings, d.id)), bflt: (d) => { S.bfilter = d.k; render(); },
  seg: (d) => { S.seg = d.k; render(); }, newPost: () => postForm(), draftPost, viewPost: (d) => viewPost(byId(DB.posts, d.id)), postMenu: (d) => postMenu(byId(DB.posts, d.id)),
  newInq: () => inqForm(), viewInq: (d) => viewInq(byId(DB.inquiries, d.id)),
  editMe, logo: setLogo, addC: (d) => contactForm(d.k), editC: (d) => contactForm(d.k, +d.i),
  splashPick, splashTest: () => showSplash(true), splashDel: async () => { await Alaisai.remove('splash'); DB.profile.splash.on = false; persist(); render(); toast('أُزيلت الصورة'); },
  exportCatalog, shareMe: () => shareText(cardText(), DB.profile.name), export: exportBackup, import: importBackup, lockSet,
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || e.target.closest('#sheet-root')) return; const a = A[b.dataset.act]; if (a) { e.preventDefault(); a(b.dataset); } });
document.addEventListener('input', (e) => {
  const t = e.target; const keep = (id) => { const i = $('#' + id); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (x) { /* لا شيء */ } } };
  if (t.id === 'cq') { S.q = t.value; render(); keep('cq'); } else if (t.id === 'bq') { S.bq = t.value; render(); keep('bq'); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'sp-on') { DB.profile.splash.on = e.target.checked; persist(); } if (e.target.id === 'sp-mode') { DB.profile.splash.mode = e.target.value; persist(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); }); addEventListener('pagehide', () => flush());
(async () => {
  document.documentElement.dataset.theme = (Alaisai.env && Alaisai.env.theme) || 'dark';
  await load(); let lk = null; try { lk = await Alaisai.get('lock'); } catch (e) { /* لا شيء */ }
  localStorageLock = !!lk; render(); if (lk) await showLock(lk); showSplash(false);
})();
