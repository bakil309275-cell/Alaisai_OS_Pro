// يصغّر ملفات src/*.js داخل مجلد النشر فقط (المصدر في المستودع يبقى مقروءاً). الاستعمال: node tools/minify-site.mjs _site
// يحتاج esbuild (في CI: npm i --no-save esbuild). أي ملف يفشل تصغيره أو فحص صياغته يبقى كما هو.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { pathToFileURL } from 'node:url';
const dir = process.argv[2] || '_site';
let es; try { es = await import(process.env.ESBUILD_PATH ? pathToFileURL(process.env.ESBUILD_PATH).href : 'esbuild'); } catch (_) { console.log('esbuild غير متاح: تخطّي التصغير'); process.exit(0); }
const T = es.transformSync || es.default.transformSync; let before = 0, after = 0, n = 0;
for (const f of fs.readdirSync(path.join(dir, 'src')).filter((x) => x.endsWith('.js'))) {
  const p = path.join(dir, 'src', f), src = fs.readFileSync(p, 'utf8');
  try { const out = T(src, { minify: true, target: 'es2019', legalComments: 'none', charset: 'utf8' }).code; new vm.Script(out); before += src.length; after += out.length; n++; fs.writeFileSync(p, out); }
  catch (e) { console.log('تخطّي ' + f + ': ' + String(e.message).split('\n')[0]); }
}
console.log(`صُغّر ${n} ملفاً: ${(before / 1024).toFixed(0)}KB ← ${(after / 1024).toFixed(0)}KB`);
