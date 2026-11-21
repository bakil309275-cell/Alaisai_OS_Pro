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


// ----- 2.12: المجموعات الخاصة -----
await t('المجموعات الخاصة: إنشاء ودعوة الأصدقاء فقط وقبول ومنشورات للأعضاء فقط', async () => {
  let r = await call('/v1/auth/register', { method: 'POST', body: { name: 'خالد', ident: 'khaled@x.com', password: 'secret-pass-4' } }); const TC = r.j.token, UC = r.j.user.id;
  assert.equal((await call('/v1/groups', { method: 'POST', body: { name: 'x' } })).s, 401);
  r = await call('/v1/groups', { method: 'POST', auth: TA, body: { name: 'عملاء الأسمدة', descr: 'مجموعة العملاء' } }); assert.equal(r.s, 200); const G = r.j.id; assert.ok(G > 0);
  assert.equal((await call('/v1/groups', { method: 'POST', auth: TA, body: { name: 'ع' } })).s, 400);
  assert.equal((await call('/v1/groups/' + G, { method: 'POST', auth: TA, body: { op: 'invite', uid: UC } })).s, 403, 'غير صديق');
  await call('/v1/friend/' + UC, { method: 'POST', auth: TA, body: { op: 'send' } }); await call('/v1/friend/' + UA, { method: 'POST', auth: TC, body: { op: 'accept' } });
  assert.equal((await call('/v1/groups/' + G, { method: 'POST', auth: TA, body: { op: 'invite', uid: UC } })).s, 200);
  assert.equal((await call('/v1/groups/' + G, { auth: TC })).j.invited, true);
  assert.equal((await call('/v1/groups/' + G, { method: 'POST', auth: TC, body: { op: 'invite', uid: UB } })).s, 400, 'مدعو لا يدعو');
  r = await call('/v1/groups', { auth: TC }); assert.equal(r.j.invites.length, 1); assert.equal(r.j.groups.length, 0);
  await call('/v1/groups/' + G, { method: 'POST', auth: TC, body: { op: 'accept' } });
  r = await call('/v1/groups/' + G, { auth: TC }); assert.equal(r.j.members.length, 2); assert.equal(r.j.mine, false);
  assert.equal((await call('/v1/groups/' + G, { auth: TB })).s, 403, 'غير عضو');
  const sc = 'group:' + G;
  assert.equal((await call('/v1/posts', { method: 'POST', auth: TB, body: { text: 'تطفل', scopes: [sc] } })).s, 403);
  r = await call('/v1/posts', { method: 'POST', auth: TC, body: { text: 'سري للمجموعة', scopes: [sc, 'platform'] } }); assert.equal(r.s, 200); assert.deepEqual(r.j.scopes, [sc], 'لا يُنشر معها في غيرها'); const PID = r.j.id;
  const feed = async (qs, a) => (await call('/v1/posts' + qs, { auth: a })).j;
  assert.deepEqual((await feed('?scope=' + sc, TA)).posts.map((x) => x.text), ['سري للمجموعة']);
  assert.equal((await call('/v1/posts?scope=' + sc, { auth: TB })).s, 403); assert.equal((await call('/v1/posts?scope=' + sc)).s, 403);
  assert.ok(!(await feed('', TA)).posts.some((x) => x.text === 'سري للمجموعة')); assert.ok(!(await feed('?author=' + UC, TA)).posts.some((x) => x.text === 'سري للمجموعة'));
  await call('/v1/follow/' + UC, { method: 'POST', auth: TA, body: {} }); assert.ok(!(await feed('?feed=following', TA)).posts.some((x) => x.text === 'سري للمجموعة'));
  assert.equal((await call('/v1/posts/' + PID + '/comments', { auth: TB })).s, 403); assert.equal((await call('/v1/posts/' + PID + '/comments', { method: 'POST', auth: TB, body: { text: 'x' } })).s, 403);
  assert.equal((await call('/v1/posts/' + PID + '/comments', { method: 'POST', auth: TA, body: { text: 'تعليق عضو' } })).s, 200);
  assert.equal((await call('/v1/posts/' + PID + '/comments', { auth: TC })).j.comments.length, 1);
  assert.equal((await call('/v1/groups/' + G, { method: 'POST', auth: TC, body: { op: 'kick', uid: UA } })).s, 403, 'العضو لا يطرد');
  assert.equal((await call('/v1/groups/' + G, { method: 'POST', auth: TC, body: { op: 'delete' } })).s, 403);
  await call('/v1/groups/' + G, { method: 'POST', auth: TA, body: { op: 'kick', uid: UC } }); assert.equal((await call('/v1/posts?scope=' + sc, { auth: TC })).s, 403);
  assert.equal((await call('/v1/groups/' + G, { method: 'POST', auth: TA, body: { op: 'delete' } })).s, 200);
  assert.equal((await call('/v1/groups', { auth: TA })).j.groups.length, 0);
});

// ---- الملفات (D1 قطعاً + R2) وحذف الحساب وصلاحيات المالك ----
const reg = async (ident, name) => { const r = await call('/v1/auth/register', { method: 'POST', body: { name, ident, password: 'secret-pass-9' } }); return { t: r.j.token, id: r.j.user.id }; };
const raw = async (path, { method = 'GET', body, auth, headers = {} } = {}) => W.fetch(new Request('https://w.test' + path, { method, body, headers: Object.assign(auth ? { authorization: 'Bearer ' + auth } : {}, headers) }), env);
const mkR2 = () => { const m = new Map(); return { m, put: async (k, b, o) => { m.set(k, { buf: new Uint8Array(await new Response(b).arrayBuffer()), o }); }, head: async (k) => (m.has(k) ? { size: m.get(k).buf.length } : null), delete: async (k) => { m.delete(k); }, get: async (k, opt) => { const x = m.get(k); if (!x) return null; const rg = opt && opt.range && opt.range.get ? opt.range.get('range') : null; if (rg) { const mt = /bytes=(\d+)-(\d*)/.exec(rg); const a = +mt[1], e = mt[2] ? +mt[2] : x.buf.length - 1; return { body: x.buf.slice(a, e + 1), range: { offset: a, length: e - a + 1 } }; } return { body: x.buf }; } }; };
await t('رفع ملف كبير على D1 قطعاً ثم نشره وتنزيله وفحص الأنواع الممنوعة', async () => {
  const U = await reg('up1@x.com', 'رافع');
  assert.equal((await call('/v1/files', { method: 'POST', body: { name: 'a.pdf', size: 10 } })).s, 401);
  assert.equal((await call('/v1/files', { method: 'POST', auth: U.t, body: { name: 'virus.exe', size: 10 } })).s, 400, 'exe ممنوع');
  assert.equal((await call('/v1/files', { method: 'POST', auth: U.t, body: { name: 'page.html', size: 10 } })).s, 400, 'html ممنوع');
  assert.equal((await call('/v1/files', { method: 'POST', auth: U.t, body: { name: 'big.mp4', size: 9 * 1048576 } })).s, 413, 'فوق حد D1');
  const data = new Uint8Array(600000).map((_, i) => i % 251); const init = await call('/v1/files', { method: 'POST', auth: U.t, body: { name: 'عرض المنتجات.mp4', type: 'video/mp4', size: data.length } });
  assert.equal(init.s, 200); assert.equal(init.j.mode, 'd1'); assert.equal(init.j.chunks, 3);
  assert.equal((await raw('/v1/files/' + init.j.id + '/0', { method: 'POST', auth: U.t, body: data.slice(0, 100) })).status, 400, 'حجم قطعة خاطئ');
  assert.equal((await call('/v1/files/' + init.j.id + '/done', { method: 'POST', auth: U.t })).s, 400, 'قطع ناقصة');
  for (let n = 0; n < 3; n++) assert.equal((await raw('/v1/files/' + init.j.id + '/' + n, { method: 'POST', auth: U.t, body: data.slice(n * 262144, (n + 1) * 262144) })).status, 200);
  const done = await call('/v1/files/' + init.j.id + '/done', { method: 'POST', auth: U.t }); assert.equal(done.s, 200);
  const att = { t: 'file', id: init.j.id }; const other = await reg('up2@x.com', 'آخر');
  assert.equal((await call('/v1/posts', { method: 'POST', auth: other.t, body: { media: [att], scopes: ['platform'] } })).s, 400, 'مرفق غيري يُتجاهل فيصبح المنشور فارغاً');
  const pst = 'data:image/jpeg;base64,' + 'A'.repeat(400);
  const pr = await call('/v1/posts', { method: 'POST', auth: U.t, body: { text: 'فيديو', media: [Object.assign({ poster: pst, ar: 0.563 }, att)], scopes: ['platform'] } }); assert.equal(pr.s, 200);
  const feed = (await call('/v1/posts?author=' + U.id)).j.posts[0]; assert.equal(feed.media[0].t, 'file'); assert.equal(feed.media[0].name, 'عرض المنتجات.mp4'); assert.equal(feed.media[0].size, 600000); assert.equal(feed.media[0].poster, pst); assert.equal(feed.media[0].ar, 0.563);
  const meta = await call('/v1/files/' + init.j.id + '?meta=1'); assert.equal(meta.j.chunks, 3);
  const parts = []; for (let n = 0; n < 3; n++) parts.push(Buffer.from(await (await raw('/v1/files/' + init.j.id + '/' + n)).arrayBuffer()));
  assert.ok(Buffer.concat(parts).equals(Buffer.from(data)), 'المحتوى مطابق');
  assert.equal((await call('/v1/files/' + init.j.id, { method: 'DELETE', auth: U.t })).s, 404, 'المرتبط بمنشور لا يُحذف منفرداً');
  assert.equal((await call('/v1/posts/' + pr.j.id, { method: 'DELETE', auth: U.t })).s, 200);
  assert.equal((await raw('/v1/files/' + init.j.id + '/0')).status, 404, 'حُذف مع المنشور');
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM fchunks').get().n, 0);
});
await t('رفع R2: ملف حتى 100MB، بث Range، تنزيل آمن للأنواع غير المعروفة، الحصة', async () => {
  const E2 = Object.assign({}, env, { FILES: mkR2() }); const call2 = async (path, o = {}) => { const r = await W.fetch(new Request('https://w.test' + path, { method: o.method || 'GET', body: o.body, headers: Object.assign(o.auth ? { authorization: 'Bearer ' + o.auth } : {}, o.headers || {}) }), E2); return r; };
  const U = await reg('r2a@x.com', 'مصور'); const json = (o) => JSON.stringify(o);
  let r0 = await call2('/v1/files', { method: 'POST', auth: U.t, body: json({ name: 'a.zip', size: 100 }) }); const j0 = await r0.json(); assert.equal(j0.mode, 'd1', 'R2 مربوط لكن غير مفعّل = D1');
  await call2('/v1/files/' + j0.id, { method: 'DELETE', auth: U.t });
  assert.equal((await call2('/v1/admin/storage', { method: 'POST', auth: U.t, body: json({ on: true }) })).status, 401);
  const st0 = await (await call2('/v1/admin/storage', { auth: env.OWNER_KEY })).json(); assert.equal(st0.bound, true); assert.equal(st0.on, false);
  assert.equal((await (await call2('/v1/admin/storage', { method: 'POST', auth: env.OWNER_KEY, body: json({ on: true }) })).json()).on, true);
  assert.equal((await call(' /v1/admin/storage'.trim(), { method: 'POST', auth: env.OWNER_KEY, body: { on: true } })).s, 400, 'بلا ربط R2 لا يُفعَّل');
  let r = await call2('/v1/files', { method: 'POST', auth: U.t, body: json({ name: 'huge.zip', size: 101 * 1048576 }) }); assert.equal(r.status, 413);
  const buf = Buffer.alloc(3000, 7); r = await call2('/v1/files', { method: 'POST', auth: U.t, body: json({ name: 'تقرير.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: buf.length }) }); const init = await r.json(); assert.equal(init.mode, 'r2');
  r = await call2('/v1/files/' + init.id + '/up', { method: 'POST', auth: U.t, body: buf, headers: { 'content-length': '5' } }); assert.equal(r.status, 400, 'الحجم لا يطابق');
  r = await call2('/v1/files/' + init.id + '/up', { method: 'POST', auth: U.t, body: buf, headers: { 'content-length': String(buf.length) } }); assert.equal(r.status, 200);
  const pr = await (await call2('/v1/posts', { method: 'POST', auth: U.t, body: json({ text: 'مستند', media: [{ t: 'file', id: init.id }], scopes: ['platform'] }) })).json(); assert.ok(pr.ok);
  r = await call2('/v1/files/' + init.id); assert.equal(r.status, 200); assert.match(r.headers.get('content-disposition'), /^attachment/); assert.equal(r.headers.get('content-type'), 'application/octet-stream'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal((await r.arrayBuffer()).byteLength, 3000);
  const vi = await (await call2('/v1/files', { method: 'POST', auth: U.t, body: json({ name: 'v.mp4', type: 'video/mp4', size: 1000 }) })).json(); await call2('/v1/files/' + vi.id + '/up', { method: 'POST', auth: U.t, body: Buffer.alloc(1000, 1), headers: { 'content-length': '1000' } });
  r = await call2('/v1/files/' + vi.id, { headers: { range: 'bytes=0-99' } }); assert.equal(r.status, 206); assert.equal(r.headers.get('content-range'), 'bytes 0-99/1000'); assert.equal(r.headers.get('content-type'), 'video/mp4'); assert.match(r.headers.get('content-disposition'), /^inline/);
  const left = await call2('/v1/files/' + vi.id, { method: 'DELETE', auth: U.t }); assert.equal(left.status, 200, 'ملف غير منشور يُحذف'); assert.ok(!E2.FILES.m.has('f/' + vi.id));
  await call2('/v1/posts/' + pr.id, { method: 'DELETE', auth: U.t }); assert.ok(!E2.FILES.m.has('f/' + init.id), 'حُذف من R2 مع المنشور');
});
await t('حذف الحساب بكلمة المرور يمحو كل شيء، والمالك يحذف حساباً ومنشوراً', async () => {
  const A = await reg('del1@x.com', 'سيحذف'), B = await reg('del2@x.com', 'سيبقى');
  const p1 = (await call('/v1/posts', { method: 'POST', auth: A.t, body: { text: 'منشور سيُحذف', scopes: ['platform'] } })).j.id; const p2 = (await call('/v1/posts', { method: 'POST', auth: B.t, body: { text: 'منشور باقٍ', scopes: ['platform'] } })).j.id;
  await call('/v1/posts/' + p2 + '/comments', { method: 'POST', auth: A.t, body: { text: 'تعليق سيُحذف' } }); await call('/v1/follow/' + B.id, { method: 'POST', auth: A.t, body: {} });
  const g = (await call('/v1/groups', { method: 'POST', auth: A.t, body: { name: 'مجموعة المحذوف' } })).j.id;
  assert.equal((await call('/v1/me/delete', { method: 'POST', body: { password: 'secret-pass-9' } })).s, 401);
  assert.equal((await call('/v1/me/delete', { method: 'POST', auth: A.t, body: { password: 'wrong-pass-123' } })).s, 403); assert.equal((await call('/v1/me', { auth: A.t })).s, 200, 'ما زال موجوداً');
  assert.equal((await call('/v1/me/delete', { method: 'POST', auth: A.t, body: { password: 'secret-pass-9' } })).s, 200);
  assert.equal((await call('/v1/me', { auth: A.t })).s, 401); assert.equal((await call('/v1/auth/login', { method: 'POST', body: { ident: 'del1@x.com', password: 'secret-pass-9' } })).s, 401);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM posts WHERE id = ?').get(p1).n, 0); assert.equal(sql.prepare('SELECT COUNT(*) n FROM comments WHERE uid = ?').get(A.id).n, 0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM groups WHERE id = ?').get(g).n, 0); assert.equal(sql.prepare('SELECT COUNT(*) n FROM follows WHERE a = ?').get(A.id).n, 0);
  assert.equal((await call('/v1/posts?author=' + B.id)).j.posts.length, 1, 'منشورات غيره سليمة');
  // المالك
  assert.equal((await call('/v1/admin/delpost/' + p2, { method: 'POST', auth: B.t })).s, 401, 'غير المالك');
  assert.equal((await call('/v1/admin/delpost/' + p2, { method: 'POST', auth: env.OWNER_KEY })).s, 200); assert.equal((await call('/v1/posts?author=' + B.id)).j.posts.length, 0);
  assert.equal((await call('/v1/admin/deluser/' + B.id, { method: 'POST', auth: B.t })).s, 401); assert.equal((await call('/v1/admin/deluser/' + B.id, { method: 'POST', auth: env.OWNER_KEY })).s, 200);
  assert.equal((await call('/v1/admin/deluser/' + B.id, { method: 'POST', auth: env.OWNER_KEY })).s, 404); assert.equal((await call('/v1/me', { auth: B.t })).s, 401);
  const C = await reg('del3@x.com', 'ثالث'); const pc = (await call('/v1/posts', { method: 'POST', auth: C.t, body: { text: 'سيُخفى', scopes: ['platform'] } })).j.id;
  await call('/v1/admin/hide/' + pc, { method: 'POST', auth: env.OWNER_KEY, body: {} }); assert.equal((await call('/v1/posts?author=' + C.id)).j.posts.length, 0, 'مخفي');
  await call('/v1/admin/ban/' + C.id, { method: 'POST', auth: env.OWNER_KEY, body: {} }); assert.equal((await call('/v1/me', { auth: C.t })).s, 401, 'محظور');
});


console.log(`\n${n} اختبار ناجح`); process.exit(bad ? 1 : 0);
