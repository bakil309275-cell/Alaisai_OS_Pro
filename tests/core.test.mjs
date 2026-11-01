// اختبارات منطق النواة (بلا DOM): node tests/core.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const C = createRequire(import.meta.url)('../core/core.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('norm يوحّد الهمزات والتاء المربوطة والتشكيل والأرقام', () => {
  assert.equal(C.norm('أَحْمَد'), 'احمد');
  assert.equal(C.norm('صيدلية'), 'صيدليه');
  assert.equal(C.norm('مستشفى'), 'مستشفي');
  assert.equal(C.norm('١٢٣'), '123');
});

t('num يقرأ الأرقام العربية والفواصل', () => {
  assert.equal(C.num('١٬٢٥٠'), 1250);
  assert.equal(C.num('1,250.5'), 1250.5);
  assert.equal(C.num(''), 0);
  assert.equal(C.num('abc'), 0);
  assert.equal(C.num(null), 0);
});

t('finance: المتفق والمدفوع والمتبقي', () => {
  assert.deepEqual(C.finance(1000, 400), { agreed: 1000, paid: 400, remaining: 600, state: 'due' });
  assert.equal(C.finance(500, 500).state, 'settled');
  assert.equal(C.finance(500, 700).state, 'over');
  assert.equal(C.finance('', '').remaining, 0);
  assert.equal(C.finance(0.1 + 0.2, 0.3).remaining, 0); // لا أخطاء فاصلة عائمة
});

t('sumFinance يجمع عدة حجوزات', () => {
  const s = C.sumFinance([{ agreed: 100, paid: 40 }, { agreed: 50, paid: 50 }, {}]);
  assert.deepEqual(s, { agreed: 150, paid: 90, remaining: 60 });
});

t('matches: بحث عربي متسامح وكل الكلمات مطلوبة', () => {
  assert.ok(C.matches('د. أحمد — مستشفى الثورة', 'احمد ثوره'));
  assert.ok(C.matches('صيدلية النور', 'صيدليه'));
  assert.ok(!C.matches('صيدلية النور', 'صيدليه الامل'));
  assert.ok(C.matches('أي شيء', ''));
});

t('esc يهرّب HTML', () => {
  assert.equal(C.esc('<b onclick="x">&\'</b>'), '&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;');
});

t('contactHref يبني روابط التواصل', () => {
  assert.equal(C.contactHref({ kind: 'phone', value: '+967 77-123' }), 'tel:+96777123');
  assert.equal(C.contactHref({ kind: 'whatsapp', value: '+967 771 234' }), 'https://wa.me/967771234');
  assert.equal(C.contactHref({ kind: 'email', value: 'a@b.c' }), 'mailto:a@b.c');
  assert.equal(C.contactHref({ kind: 'facebook', value: 'facebook.com/x' }), 'https://facebook.com/x');
  assert.equal(C.contactHref({ kind: 'bank', value: '123' }), '');
});

const s = C.store('test');
const a = await s.save('k', { name: 'أ' });
const b = await s.save('k', { name: 'ب' });
assert.ok(a.id && b.id && a.id !== b.id);
await s.save('k', { ...a, name: 'أ2' });
assert.deepEqual((await s.list('k')).map(x => x.name), ['أ2', 'ب']);
await s.remove('k', a.id);
assert.deepEqual((await s.list('k')).map(x => x.name), ['ب']);
await Promise.all([1, 2, 3, 4, 5].map(i => s.save('p', { i })));   // كتابات متزامنة لا تضيع
assert.equal((await s.list('p')).length, 5);
n++; console.log('ok - store: حفظ/تعديل/حذف وكتابات متزامنة');

console.log('\n' + n + ' اختبارات نجحت');
