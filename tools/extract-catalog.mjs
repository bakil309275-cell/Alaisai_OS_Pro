// يستخرج مجلدات الإضافات (المصدر) من حزم catalog/addons ليعيدها إلى addons/<اسم المجلد>/ — عكس build-catalog.
// يُستعمل لاستعادة addons/ إن فُقدت المجلدات (النشر يعيد بناء الكتالوج منها فيفرغ المتجر إن غابت).
// الاستعمال: node tools/extract-catalog.mjs [--force]   (لا يستبدل مجلداً موجوداً إلا مع --force)
import fs from 'node:fs'; import path from 'node:path';
const repo = path.resolve(import.meta.dirname, '..'), cat = path.join(repo, 'catalog'), force = process.argv.includes('--force');
const idx = JSON.parse(fs.readFileSync(path.join(cat, 'index.json'), 'utf8'));
let made = 0, skipped = 0;
for (const e of idx.addons || []) {
  const pkg = JSON.parse(fs.readFileSync(path.join(cat, e.file), 'utf8')), dir = path.join(repo, 'addons', e.id);
  if (fs.existsSync(dir) && !force) { skipped++; continue; }
  for (const f of pkg.files) {
    const p = path.join(dir, f.name); if (!p.startsWith(dir + path.sep)) throw new Error('مسار غير آمن: ' + f.name);
    fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.bin ? Buffer.from(f.content, 'base64') : f.content);
  }
  made++; console.log('استُخرجت:', e.id, '(' + pkg.files.length + ' ملف)');
}
console.log(`تم: ${made} إضافة، تخطّي ${skipped} موجودة`);
