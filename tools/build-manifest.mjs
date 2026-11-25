// يولّد release-manifest.json: لكل ملف في الإصدار SHA الخاص بـ git (blob) ليقارنه GitFlash بمستودعك.
// الاستعمال: node tools/build-manifest.mjs   (شغّله بعد آخر تعديل وقبل الحزم/الالتزام؛ --check للتحقق)
import fs from 'node:fs'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter((f) => f && f !== 'release-manifest.json' && fs.existsSync(f));
const sha = (b) => crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
const out = { version: JSON.parse(fs.readFileSync('package.json', 'utf8')).version, files: {} };
for (const f of files.sort()) out.files[f] = sha(fs.readFileSync(f));
const txt = JSON.stringify(out, null, 0) + '\n';
if (process.argv.includes('--check')) { const cur = fs.existsSync('release-manifest.json') ? fs.readFileSync('release-manifest.json', 'utf8') : ''; if (cur !== txt) { console.error('release-manifest.json قديم: شغّل node tools/build-manifest.mjs'); process.exit(1); } console.log('manifest up to date (' + files.length + ' ملف)'); }
else { fs.writeFileSync('release-manifest.json', txt); console.log('release-manifest.json: ' + files.length + ' ملف'); }
