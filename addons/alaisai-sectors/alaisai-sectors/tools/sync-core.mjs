// ينسخ النواة المشتركة (core.js و core.css) إلى مجلد كل إضافة.
// السبب: كل إضافة تعمل في صندوق معزول ولا تستطيع استيراد ملفات من خارج مجلدها.
// الاستخدام: node tools/sync-core.mjs
import { readdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const addons = join(root, 'addons');
let n = 0;
for (const d of readdirSync(addons)) {
  const dir = join(addons, d);
  if (!statSync(dir).isDirectory() || !existsSync(join(dir, 'manifest.json'))) continue;
  for (const f of ['core.js', 'core.css']) copyFileSync(join(root, 'core', f), join(dir, f));
  n++; console.log('synced →', d);
}
console.log(n + ' addon(s) updated');
