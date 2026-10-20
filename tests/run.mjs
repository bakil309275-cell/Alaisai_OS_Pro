// اختبارات الوحدات: node tests/run.mjs
import vm from 'node:vm'; import fs from 'node:fs'; import nodeCrypto from 'node:crypto'; import assert from 'node:assert/strict';
const ctx = { console, TextEncoder, TextDecoder, crypto: nodeCrypto.webcrypto, btoa, atob, Blob, setTimeout, clearTimeout, navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: {}, matchMedia: () => ({ matches: false }) };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
ctx.Viewer = { head: (x) => '<head>' + x + '</head>' }; ctx.OS = { renderDesktop() {} }; ctx.DOMParser = class { parseFromString() { return { head: { querySelectorAll: () => [] }, body: { innerHTML: '' } }; } };
for (const f of ['src/version.js', 'src/ui.js', 'src/security.js', 'src/storage.js', 'src/addons.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const { Sec, Store, UI, Addons } = ctx;
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n ', e.message); process.exitCode = 1; } };

await t('sha256 يطابق Node على عدة مدخلات', () => {
  for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 1000]) {
    const b = nodeCrypto.randomBytes(len);
    assert.equal(Buffer.from(Sec.sha256(b)).toString('hex'), nodeCrypto.createHash('sha256').update(b).digest('hex'), 'len ' + len);
  }
});
await t('تجزئة كلمة المرور والتحقق', async () => {
  const r = await Sec.hash('كلمة-قوية-9'); assert.ok(Sec.isHashRecord(r)); assert.equal(r.algo, 'pbkdf2-sha256');
  assert.ok(await Sec.verify('كلمة-قوية-9', r)); assert.ok(!await Sec.verify('خطأ', r));
  const r2 = await Sec.hash('كلمة-قوية-9'); assert.notEqual(r.salt, r2.salt); assert.notEqual(r.hash, r2.hash);
});
await t('سياسة كلمة المرور', () => {
  assert.ok(Sec.passwordIssue('1234')); assert.ok(Sec.passwordIssue('aaaaaaaa')); assert.ok(Sec.passwordIssue('password'));
  assert.equal(Sec.passwordIssue('Tr0ub4dor&3'), null);
});
await t('تشفير/فك تشفير النسخة', async () => {
  const env = await Sec.encrypt('{"a":"عربي"}', 'pass-123'); assert.ok(env.encrypted && !env.data.includes('عربي'));
  assert.equal(await Sec.decrypt(env, 'pass-123'), '{"a":"عربي"}');
  await assert.rejects(() => Sec.decrypt(env, 'wrong'));
});
await t('ترحيب بملف نسخة المستخدم القديم (v1)', async () => {
  const raw = JSON.parse(fs.readFileSync('tests/fixtures/legacy-backup-v1.json', 'utf8'));
  const db = await Store.migrate(raw);
  assert.equal(db.version, 2); assert.equal(db.config.pass, undefined);
  assert.ok(Sec.isHashRecord(db.config.passHash)); assert.ok(await Sec.verify('1234', db.config.passHash));
  assert.equal(db.config.mustChange, true, 'كلمة 1234 ضعيفة');
  assert.equal(db.config.visits, 1050);
  assert.equal(JSON.stringify(db.registry.map((a) => [a.id, a.type])), JSON.stringify([['app_1', 'html'], ['app_2', 'url'], ['app_3', 'notes']]));
  assert.equal(db.registry[1].content, 'https://www.bing.com');
  assert.ok(!JSON.stringify(db).includes('"pass"'));
});
await t('رفض ملفات غير صالحة', async () => {
  for (const bad of [null, [], 'x', {}, { registry: [] }, { config: {}, registry: 'x' }, { config: {}, registry: [], version: 99 }])
    await assert.rejects(() => Store.migrate(bad));
});
await t('تعقيم السجلات: معرفات مكررة، أنواع، أحجام', async () => {
  const db = await Store.migrate({ config: {}, registry: [
    { id: 'a', name: 'x'.repeat(500), icon: '😀'.repeat(20), type: 'evil', content: '<b>1</b>', order: 5 },
    { id: 'a', name: 'dup', content: 'z' }, { id: '__proto__', name: 'p' }, 'junk', null, { id: 'bad id!', name: 'q' }] });
  assert.equal(new Set(db.registry.map((a) => a.id)).size, db.registry.length);
  assert.ok(db.registry.every((a) => ['html', 'url', 'notes'].includes(a.type) && a.name.length <= 60 && a.icon.length <= 8));
  assert.equal(db.registry.length, 4);
});
await t('ملاحظة قديمة تُرحَّل', async () => {
  const db = await Store.migrate({ config: {}, registry: [] }, { legacyNote: 'ملاحظتي القديمة' });
  assert.equal(db.notes.length, 1); assert.equal(db.notes[0].body, 'ملاحظتي القديمة');
});
await t('ذهاب وإياب التصدير (v2) بلا فقدان', async () => {
  const d = Store.defaults(); d.config.passHash = await Sec.hash('Str0ng!pass'); d.notes.push({ id: 'n1', title: 't', body: 'b', updated: 5 });
  Store.db = d; const payload = JSON.parse(JSON.stringify(Store.exportPayload()));
  const back = await Store.migrate(payload);
  assert.equal(JSON.stringify(back.notes), JSON.stringify(d.notes)); assert.equal(JSON.stringify(back.registry), JSON.stringify(d.registry)); assert.ok(await Sec.verify('Str0ng!pass', back.config.passHash));
});
await t('UI.esc يهرّب الرموز الخطرة', () => assert.equal(UI.esc(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;'));
await t('حزمة إضافة صالحة وأخرى خبيثة', async () => {
  const good = { format: 'alaisai-addon', version: 1, id: 'demo', files: [{ name: 'manifest.json', content: '{"name":"تجربة","icon":"🧪","version":"1.2.3"}' }, { name: 'main.js', content: '1' }] };
  const r = Addons.validatePackage(good); assert.equal(r.manifest.version, '1.2.3'); assert.equal(r.manifest.name, 'تجربة');
  for (const bad of [null, {}, { ...good, id: '../etc' }, { ...good, version: 2 }, { ...good, files: [] }, { ...good, files: [{ name: '../x.js', content: '' }] },
    { ...good, files: [good.files[0], good.files[0]] }, { ...good, files: [{ name: 'manifest.json', content: 'not json' }] },
    { ...good, files: [{ name: 'a.js', content: 'x' }] }, { ...good, files: [good.files[0], { name: 'big.js', content: 'x'.repeat(600000) }] }])
    assert.throws(() => Addons.validatePackage(bad));
});
await t('مقارنة الإصدارات', () => { assert.equal(Addons.cmpVer('1.10.0', '1.9.9'), 1); assert.equal(Addons.cmpVer('1.0.0', '1.0.0'), 0); assert.equal(Addons.cmpVer('0.9.0', '1.0.0'), -1); });
await t('اتساق رقم الإصدار (version.js / sw.js / package.json)', () => {
  const sw = fs.readFileSync('sw.js', 'utf8').match(/const VERSION = '([\d.]+)'/)[1], pk = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  assert.equal(ctx.APP_VERSION, sw); assert.equal(ctx.APP_VERSION, pk); assert.equal(ctx.APP_CHANGELOG[0].v, ctx.APP_VERSION);
});
await t('كل ملفات SW CORE موجودة', () => {
  const core = [...fs.readFileSync('sw.js', 'utf8').match(/const CORE = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const missing = core.filter((f) => !fs.existsSync(f)); assert.equal(missing.length, 0, missing.join(','));
});
await t('كل سكربتات index.html موجودة ومسجّلة في SW', () => {
  const html = fs.readFileSync('index.html', 'utf8'), sw = fs.readFileSync('sw.js', 'utf8');
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) { assert.ok(fs.existsSync(m[1]), m[1]); assert.ok(sw.includes(`'./${m[1]}'`), 'غير مخزّن في SW: ' + m[1]); }
});
console.log(`\n${n} اختبار ناجح`);
