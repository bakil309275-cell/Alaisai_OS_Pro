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
console.log(`\n${n} اختبار ناجح`); process.exit(bad ? 1 : 0);
