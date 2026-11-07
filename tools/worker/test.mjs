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
console.log(`\n${n} اختبار ناجح`); process.exit(bad ? 1 : 0);
