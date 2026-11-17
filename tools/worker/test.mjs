// اختبار الواجهة الخلفية بقاعدة SQLite محلية تحاكي D1: node tools/worker/test.mjs
import assert from 'node:assert/strict'; import fs from 'node:fs';
let DatabaseSync; try { ({ DatabaseSync } = await import('node:sqlite')); } catch (_) { console.log('تخطّي: node:sqlite غير متاح'); process.exit(0); }
const mod = await import('./worker.js'); const W = mod.default;
const sql = new DatabaseSync(':memory:');
const DB = { prepare: (s) => ({ bind: (...a) => ({ run: async () => { sql.prepare(s).run(...a); return {}; }, all: async () => ({ results: sql.prepare(s).all(...a).map((r) => ({ ...r })) }), first: async () => { const r = sql.prepare(s).get(...a); return r ? { ...r } : null; } }), run: async () => { sql.prepare(s).run(); return {}; } }) };
const env = { DB, OWNER_KEY: 'k'.repeat(24) };
let n = 0, bad = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { bad++; console.log('✗', name, '\n ', e.message); } };
const call = async (path, { method = 'GET', body, auth } = {}) => { const r = await W.fetch(new Request('https://w.test' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: auth ? { authorization: 'Bearer ' + auth } : {} }), env); return { s: r.status, j: await r.json().catch(() => null) }; };
const D1 = 'device-aaaaaaaaaaaaaaaa', D2 = 'device-bbbbbbbbbbbbbbbb';
await t('hello يسجّل الأجهزة ويعدّ المستخدمين والمتصلين', async () => { await call('/v1/hello', { method: 'POST', body: { did: D1, ver: '2.9.0' } }); const r = await call('/v1/hello', { method: 'POST', body: { did: D2 } }); assert.deepEqual([r.j.users, r.j.online], [2, 2]); const again = await call('/v1/hello', { method: 'POST', body: { did: D2 } }); assert.equal(again.j.users, 2); });
await t('معرّف جهاز غير صالح يُرفض', async () => { assert.equal((await call('/v1/hello', { method: 'POST', body: { did: 'x' } })).s, 400); });
await t('التفاعل: يُحتسب مرة لكل جهاز ويُلغى', async () => {
  let r = await call('/v1/react', { method: 'POST', body: { did: D1, item: 'a1', kind: 'like', on: true } }); assert.equal(r.j.counts.a1.like, 1);
  r = await call('/v1/react', { method: 'POST', body: { did: D1, item: 'a1', kind: 'like', on: true } }); assert.equal(r.j.counts.a1.like, 1);
  r = await call('/v1/react', { method: 'POST', body: { did: D2, item: 'a1', kind: 'like', on: true } }); assert.equal(r.j.counts.a1.like, 2);
  r = await call('/v1/react', { method: 'POST', body: { did: D2, item: 'a1', kind: 'love', on: true } }); assert.deepEqual(r.j.counts.a1, { like: 2, love: 1 });
  r = await call('/v1/react', { method: 'POST', body: { did: D1, item: 'a1', kind: 'like', on: false } }); assert.equal(r.j.counts.a1.like, 1);
});
await t('تفاعل بنوع أو عنصر غير صالح يُرفض', async () => { assert.equal((await call('/v1/react', { method: 'POST', body: { did: D1, item: 'a1', kind: 'hack', on: true } })).s, 400); assert.equal((await call('/v1/react', { method: 'POST', body: { did: D1, item: 'a/../1', kind: 'like', on: true } })).s, 400); });
await t('stats تعيد العدّادات لعدة عناصر وعدد المستخدمين', async () => { const r = await call('/v1/stats?ids=a1,zz,bad id'); assert.equal(r.j.counts.a1.love, 1); assert.deepEqual(r.j.counts.zz, {}); assert.ok(!('bad id' in r.j.counts)); assert.equal(r.j.users, 2); });
await t('حدّ معدّل التفاعل (30 في الدقيقة)', async () => { let last; for (let i = 0; i < 32; i++) last = await call('/v1/react', { method: 'POST', body: { did: 'device-cccccccccccccccc', item: 'i' + i, kind: 'like', on: true } }); assert.equal(last.s, 429); });
await t('صندوق الرسائل: إرسال، وحدّ 5 في الساعة، وقراءة المالك فقط', async () => {
  assert.equal((await call('/v1/inbox', { method: 'POST', body: { did: D1, text: '' } })).s, 400);
  for (let i = 0; i < 5; i++) assert.equal((await call('/v1/inbox', { method: 'POST', body: { did: D1, kind: 'req', name: 'أحمد', phone: '777', subject: 'طلب', text: 'مرحبا ' + i, addon: 'الطب' } })).s, 200);
  assert.equal((await call('/v1/inbox', { method: 'POST', body: { did: D1, text: 'زائد' } })).s, 429);
  assert.equal((await call('/v1/inbox')).s, 401); assert.equal((await call('/v1/inbox', { auth: 'wrong' + 'k'.repeat(20) })).s, 401);
  const r = await call('/v1/inbox', { auth: env.OWNER_KEY }); assert.equal(r.j.items.length, 5); assert.equal(r.j.items[0].text, 'مرحبا 4'); assert.ok(!('did' in r.j.items[0]));
  const del = await call('/v1/inbox/' + r.j.items[0].id, { method: 'DELETE', auth: env.OWNER_KEY }); assert.equal(del.s, 200); assert.equal((await call('/v1/inbox', { auth: env.OWNER_KEY })).j.items.length, 4);
});
await t('إحصاءات المالك محمية وتحوي الأعلى تفاعلاً', async () => { assert.equal((await call('/v1/admin/stats')).s, 401); const r = await call('/v1/admin/stats', { auth: env.OWNER_KEY }); assert.equal(r.j.users >= 2, true); assert.equal(r.j.top[0].item, 'a1'); });
await t('بدون OWNER_KEY لا يُسمح لأحد', async () => { const e2 = { DB }; const r = await W.fetch(new Request('https://w.test/v1/inbox', { headers: { authorization: 'Bearer ' } }), e2); assert.equal(r.status, 401); });
await t('CORS وخيارات الطلب المسبق', async () => { const r = await W.fetch(new Request('https://w.test/v1/stats', { method: 'OPTIONS' }), env); assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), '*'); });
await t('مسار مجهول 404', async () => { assert.equal((await call('/v1/nope')).s, 404); });

const IMGD = 'data:image/jpeg;base64,' + 'A'.repeat(200);
let TA, TB;
await t('المنصة: تسجيل ودخول وكلمة مرور خاطئة وتكرار المعرّف', async () => {
  assert.equal((await call('/v1/auth/register', { method: 'POST', body: { name: 'أ', ident: 'ali@x.com', password: '12345678' } })).s, 400);
  let r = await call('/v1/auth/register', { method: 'POST', body: { name: 'علي', ident: 'Ali@x.com', password: 'secret-pass-1', did: D1 } }); assert.equal(r.s, 200); TA = r.j.token; assert.ok(!JSON.stringify(r.j).includes('secret'));
  assert.equal((await call('/v1/auth/register', { method: 'POST', body: { name: 'علي2', ident: 'ali@x.com', password: 'secret-pass-1' } })).s, 409);
  assert.equal((await call('/v1/auth/login', { method: 'POST', body: { ident: 'ali@x.com', password: 'wrong-pass-12' } })).s, 401);
  r = await call('/v1/auth/login', { method: 'POST', body: { ident: 'ali@x.com', password: 'secret-pass-1' } }); assert.equal(r.s, 200); assert.ok(r.j.token);
  r = await call('/v1/auth/register', { method: 'POST', body: { name: 'سعيد', ident: 'saeed@x.com', password: 'secret-pass-2' } }); TB = r.j.token;
});
await t('المنصة: النشر يتطلب حساباً وتُرفض الوسائط الخطرة وتُقبل الصور والروابط', async () => {
  assert.equal((await call('/v1/posts', { method: 'POST', body: { text: 'x' } })).s, 401);
  assert.equal((await call('/v1/posts', { method: 'POST', auth: 'forged.9999999999999.sig' + 'x'.repeat(20), body: { text: 'x' } })).s, 401);
  let r = await call('/v1/posts', { method: 'POST', auth: TA, body: { text: 'أول منشور', link: 'javascript:alert(1)', media: [{ t: 'img', d: IMGD }, { t: 'vid', u: 'https://example.com/v.mp4' }, { t: 'img', d: 'data:text/html;base64,PHNjcmlwdD4=' }, { t: 'vid', u: 'http://bad' }] } });
  assert.equal(r.s, 200);
  r = await call('/v1/posts'); const p = r.j.posts[0]; assert.equal(p.text, 'أول منشور'); assert.equal(p.link, ''); assert.equal(p.media.length, 2); assert.equal(p.author.name, 'علي'); assert.ok(!('uid' in p));
});
await t('المنصة: تعليقات وحذف المؤلف فقط وبلاغات تخفي بعد 3', async () => {
  const id = (await call('/v1/posts')).j.posts[0].id;
  assert.equal((await call('/v1/posts/' + id + '/comments', { method: 'POST', auth: TB, body: { text: 'رائع' } })).s, 200);
  assert.equal((await call('/v1/posts/' + id + '/comments')).j.comments[0].author.name, 'سعيد');
  assert.equal((await call('/v1/posts/' + id, { method: 'DELETE', auth: TB })).s, 403);
  assert.equal((await call('/v1/report', { method: 'POST', auth: TB, body: { post: id, reason: 'x' } })).s, 200);
  assert.equal((await call('/v1/posts/' + id, { method: 'DELETE', auth: TA })).s, 200);
  assert.equal((await call('/v1/posts')).j.posts.length, 0);
});
await t('المنصة: المالك ينشر رسمياً ويثبّت ويخفي ويحظر', async () => {
  assert.equal((await call('/v1/admin/post', { method: 'POST', body: { text: 'x' } })).s, 401);
  assert.equal((await call('/v1/admin/post', { method: 'POST', auth: env.OWNER_KEY, body: { text: 'إعلان رسمي', pin: true } })).s, 200);
  const p = (await call('/v1/posts')).j.posts[0]; assert.ok(p.official && p.pin && p.author.name === 'العيسائي برو');
  const u = (await call('/v1/admin/users', { auth: env.OWNER_KEY })).j.users; assert.ok(u.length >= 2 && !('hash' in u[0]) && !('salt' in u[0]));
  assert.equal((await call('/v1/admin/ban/' + u.find((x) => x.ident === 'saeed@x.com').id, { method: 'POST', auth: env.OWNER_KEY, body: {} })).s, 200);
  assert.equal((await call('/v1/posts', { method: 'POST', auth: TB, body: { text: 'x' } })).s, 401);
  assert.equal((await call('/v1/admin/hide/' + p.id, { method: 'POST', auth: env.OWNER_KEY, body: {} })).s, 200);
  assert.equal((await call('/v1/posts')).j.posts.length, 0);
});
await t('الاشتراكات: طلب → موافقة المالك → الطالب فقط يستلم الرمز', async () => {
  assert.equal((await call('/v1/sub/request', { method: 'POST', body: { did: D1, aid: 'acct-123456', name: '', phone: '' } })).s, 400);
  const r = await call('/v1/sub/request', { method: 'POST', body: { did: D1, aid: 'acct-123456', addon: 'الطب والأدوية', plan: 'month', name: 'خالد', phone: '777000', proof: 'حوالة 123', proofimg: IMGD } }); assert.equal(r.s, 200); assert.ok(r.j.rk);
  assert.equal((await call('/v1/sub/mine?id=' + r.j.id + '&rk=' + 'z'.repeat(20))).s, 404);
  assert.equal((await call('/v1/sub/mine?id=' + r.j.id + '&rk=' + r.j.rk)).j.status, 'new');
  assert.equal((await call('/v1/admin/subreq')).s, 401);
  const l = (await call('/v1/admin/subreq', { auth: env.OWNER_KEY })).j.items; assert.equal(l[0].aid, 'acct-123456'); assert.ok(!('rk' in l[0]) && !('did' in l[0]));
  assert.equal((await call('/v1/admin/subreq/' + r.j.id, { method: 'POST', auth: env.OWNER_KEY, body: { status: 'approved', code: 'abc.def' } })).s, 200);
  const m = (await call('/v1/sub/mine?id=' + r.j.id + '&rk=' + r.j.rk)).j; assert.equal(m.status, 'approved'); assert.equal(m.code, 'abc.def');
});

// ----- 2.11: الملف الشخصي، وجهات النشر، الصفحات العامة، المتابعة، الصداقة -----
const AV = 'data:image/jpeg;base64,' + Buffer.from('fakejpegbytes-fakejpegbytes').toString('base64');
let UA, UB;
await t('تعديل الملف الشخصي: حقول وصورة وروابط، وتحقق من المدخلات', async () => {
  let r = await call('/v1/me', { auth: TA }); assert.equal(r.s, 200); UA = r.j.user.id; assert.equal(r.j.user.kind, 'person');
  assert.equal((await call('/v1/me', { method: 'POST', body: { name: 'ع' } })).s, 401);
  assert.equal((await call('/v1/me', { method: 'POST', auth: TA, body: { email: 'bad' } })).s, 400);
  assert.equal((await call('/v1/me', { method: 'POST', auth: TA, body: { phone: 'abc' } })).s, 400);
  assert.equal((await call('/v1/me', { method: 'POST', auth: TA, body: { av: 'data:text/html;base64,AAAAAAAAAAAAAAAAAAAAAA' } })).s, 400);
  r = await call('/v1/me', { method: 'POST', auth: TA, body: { name: 'علي التاجر', email: 'a@b.co', phone: '+967 700 000 000', bio: 'توريد أسمدة', kind: 'business', showc: true, av: AV, links: [{ n: 'فيسبوك', u: 'https://facebook.com/x' }, { n: 'سيئ', u: 'javascript:alert(1)' }] } });
  assert.equal(r.s, 200); assert.equal(r.j.user.name, 'علي التاجر'); assert.equal(r.j.user.kind, 'business'); assert.ok(r.j.user.av > 0); assert.equal(r.j.user.links.length, 1);
  r = await call('/v1/me', { auth: TA }); assert.equal(r.j.user.bio, 'توريد أسمدة');
});
await t('الصفحة العامة: الاتصال يظهر فقط بإذن صاحبها، والصورة تُخدَم صورةً', async () => {
  let r = await call('/v1/u/' + UA); assert.equal(r.s, 200); assert.equal(r.j.user.phone, '+967 700 000 000'); assert.ok(!('email' in r.j.user) === false);
  await call('/v1/me', { method: 'POST', auth: TA, body: { showc: false } }); r = await call('/v1/u/' + UA); assert.ok(!('phone' in r.j.user)); assert.ok(!('ident' in r.j.user));
  const img = await W.fetch(new Request('https://w.test/v1/u/' + UA + '/av'), env); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal((await W.fetch(new Request('https://w.test/v1/u/99999/av'), env)).status, 404);
  await call('/v1/me', { method: 'POST', auth: TA, body: { av: '' } }); assert.equal((await W.fetch(new Request('https://w.test/v1/u/' + UA + '/av'), env)).status, 404);
});
await t('وجهات النشر: المنصة وإضافة معيّنة في نسخة واحدة، والتصفية بالجهة', async () => {
  let r = await call('/v1/posts', { method: 'POST', auth: TA, body: { text: 'سماد للبيع', scopes: ['platform', 'addon:الخدمات الزراعية', 'bad,scope', 'addon:<x>'] } }); assert.equal(r.s, 200); assert.deepEqual(r.j.scopes, ['platform', 'addon:الخدمات الزراعية']);
  await call('/v1/posts', { method: 'POST', auth: TA, body: { text: 'عرض خاص بالزراعة فقط', scopes: ['addon:الخدمات الزراعية'] } });
  await call('/v1/posts', { method: 'POST', auth: TA, body: { text: 'بدون وجهة' } });
  const feed = (qs) => call('/v1/posts' + qs).then((x) => x.j.posts.map((p) => p.text));
  assert.ok((await feed('')).includes('سماد للبيع')); assert.ok(!(await feed('')).includes('عرض خاص بالزراعة فقط')); assert.ok((await feed('')).includes('بدون وجهة'));
  const ag = await feed('?scope=' + encodeURIComponent('addon:الخدمات الزراعية')); assert.deepEqual(ag.sort(), ['سماد للبيع', 'عرض خاص بالزراعة فقط'].sort());
  assert.ok(!(await feed('?scope=addon:%25')).includes('عرض خاص بالزراعة فقط')); // محارف LIKE لا تعمل كأنماط (يرجع للمنصة)
  assert.deepEqual(await feed('?q=' + encodeURIComponent('سماد')), ['سماد للبيع']);
  const pr = await feed('?author=' + UA); assert.equal(pr.length, 3);
  const one = (await call('/v1/posts')).j.posts.find((p) => p.text === 'سماد للبيع'); assert.equal(one.author.kind, 'business'); assert.deepEqual(one.scopes, ['platform', 'addon:الخدمات الزراعية']);
});
await t('المتابعة وموجز المتابَعين', async () => {
  let r = await call('/v1/auth/register', { method: 'POST', body: { name: 'عمر', ident: 'omar@x.com', password: 'secret-pass-3' } }); TB = r.j.token; UB = r.j.user.id; assert.equal(r.j.user.id > 0, true);
  assert.equal((await call('/v1/follow/' + UA, { method: 'POST' })).s, 401); assert.equal((await call('/v1/follow/' + UB, { method: 'POST', auth: TB, body: {} })).s, 400);
  r = await call('/v1/follow/' + UA, { method: 'POST', auth: TB, body: {} }); assert.equal(r.j.followers, 1); r = await call('/v1/follow/' + UA, { method: 'POST', auth: TB, body: {} }); assert.equal(r.j.followers, 1);
  assert.equal((await call('/v1/u/' + UA, { auth: TB })).j.user.following, true);
  r = await call('/v1/posts?feed=following', { auth: TB }); assert.equal(r.j.posts.length, 3 + (await call('/v1/posts?feed=following', { auth: TB })).j.posts.filter((p) => p.author.id === UB).length);
  r = await call('/v1/follow/' + UA, { method: 'POST', auth: TB, body: { off: true } }); assert.equal(r.j.followers, 0);
});
await t('طلب الصداقة: إرسال، قبول، حذف، وقبول متبادل تلقائي', async () => {
  assert.equal((await call('/v1/friend/' + UB, { method: 'POST', auth: TA, body: { op: 'x' } })).s, 400);
  await call('/v1/friend/' + UB, { method: 'POST', auth: TA, body: { op: 'send' } });
  assert.equal((await call('/v1/u/' + UB, { auth: TA })).j.user.friend, 'sent'); assert.equal((await call('/v1/u/' + UA, { auth: TB })).j.user.friend, 'incoming');
  let r = await call('/v1/friends', { auth: TB }); assert.equal(r.j.incoming.length, 1); assert.equal(r.j.incoming[0].id, UA);
  await call('/v1/friend/' + UA, { method: 'POST', auth: TB, body: { op: 'accept' } });
  r = await call('/v1/friends', { auth: TA }); assert.equal(r.j.friends.length, 1); assert.equal(r.j.incoming.length, 0);
  await call('/v1/friend/' + UA, { method: 'POST', auth: TB, body: { op: 'remove' } }); assert.equal((await call('/v1/friends', { auth: TA })).j.friends.length, 0);
  await call('/v1/friend/' + UB, { method: 'POST', auth: TA, body: { op: 'send' } }); await call('/v1/friend/' + UA, { method: 'POST', auth: TB, body: { op: 'send' } });
  assert.equal((await call('/v1/u/' + UA, { auth: TB })).j.user.friend, 'friends');
});

console.log(`\n${n} اختبار ناجح`); process.exit(bad ? 1 : 0);
