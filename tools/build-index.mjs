// يحقن «CSS الحرج» (المحدد بعلامات /*!critical*/ في assets/css/app.css) داخل index.html لإلغاء طلب CSS الحاجب للرسم.
// الاستعمال: node tools/build-index.mjs  (أو --check للتحقق في CI). شغّله بعد تعديل أي جزء محدد بالعلامات.
import fs from 'node:fs';
const css = fs.readFileSync('assets/css/app.css', 'utf8'), htmlPath = 'index.html';
const parts = [...css.matchAll(/\/\*!critical\*\/([\s\S]*?)\/\*!\/critical\*\//g)].map((m) => m[1]);
if (!parts.length) { console.error('لا توجد علامات critical'); process.exit(1); }
const min = parts.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\.\.\/fonts\//g, 'assets/fonts/').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const block = '<!--critical:start--><style>' + min + '</style><!--critical:end-->';
const html = fs.readFileSync(htmlPath, 'utf8'), re = /<!--critical:start-->[\s\S]*?<!--critical:end-->/;
if (!re.test(html)) { console.error('علامات critical غير موجودة في index.html'); process.exit(1); }
const out = html.replace(re, () => block);
if (process.argv.includes('--check')) { if (out !== html) { console.error('index.html غير محدّث: شغّل node tools/build-index.mjs'); process.exit(1); } console.log('index.html up to date (' + min.length + ' bytes critical CSS)'); }
else { fs.writeFileSync(htmlPath, out); console.log('critical CSS: ' + min.length + ' bytes'); }
