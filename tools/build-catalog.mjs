// يبني حزم الإضافات من catalog/src/<id>/ إلى catalog/addons/<id>.alaisai-addon.json ثم catalog/index.json
// الاستخدام: node tools/build-catalog.mjs [--check]   (--check يفشل إن كانت الملفات المبنية قديمة)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..', 'catalog');
const check = process.argv.includes('--check');
const FILE_ORDER = ['manifest.json', 'index.html', 'main.js', 'style.css'];
const out = [], entries = [];
for (const id of fs.readdirSync(path.join(root, 'src')).sort()) {
  const dir = path.join(root, 'src', id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const names = fs.readdirSync(dir).sort((a, b) => (FILE_ORDER.indexOf(a) + 99) % 99 - (FILE_ORDER.indexOf(b) + 99) % 99 || a.localeCompare(b));
  const files = names.map((n) => ({ name: n, content: fs.readFileSync(path.join(dir, n), 'utf8') }));
  const manifest = JSON.parse(files.find((f) => f.name === 'manifest.json').content);
  if (manifest.id !== id) throw new Error(`manifest.id (${manifest.id}) must equal folder name (${id})`);
  const pkg = { format: 'alaisai-addon', version: 1, id, manifest, files };
  const text = JSON.stringify(pkg, null, 2) + '\n';
  const rel = `addons/${id}.alaisai-addon.json`;
  out.push([path.join(root, rel), text]);
  entries.push({ id, name: manifest.name, icon: manifest.icon, version: manifest.version, description: manifest.description || '', author: manifest.author || '',
    file: rel, size: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') });
}
const index = JSON.stringify({ format: 'alaisai-catalog', version: 1, addons: entries }, null, 2) + '\n';
out.push([path.join(root, 'index.json'), index]);
let stale = 0;
for (const [file, text] of out) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (cur !== text) { stale++; if (!check) fs.writeFileSync(file, text); }
}
if (check && stale) { console.error(`catalog out of date (${stale} files). Run: node tools/build-catalog.mjs`); process.exit(1); }
console.log(check ? 'catalog up to date' : `catalog built: ${entries.length} add-ons`);
