// يبني حزم الإضافات من catalog/src/<id>/ ومن addons/<id>/ (المجلد الذي يمليه التطبيق ويضيف إليه أصحابه) إلى catalog/addons/<id>.alaisai-addon.json ثم catalog/index.json
// الاستخدام: node tools/build-catalog.mjs [--check]   (--check يفشل إن كانت الملفات المبنية قديمة)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..', 'catalog');
const check = process.argv.includes('--check');
const FILE_ORDER = ['manifest.json', 'index.html', 'main.js', 'style.css'];
const ID_RE = /^[\w-]{1,40}$/, FILE_RE = /^[\w.\- ]{1,80}$/, VER_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const sources = [path.join(root, 'src'), path.resolve(root, '..', 'addons')].filter((d) => fs.existsSync(d));
const out = [], entries = [], seen = new Set();
for (const srcDir of sources) {
  const lenient = path.basename(srcDir) === 'addons'; // مجلد addons/ يحرّره الناس: نتخطى الفاسد بتحذير بدل إفشال البناء
  for (const id of fs.readdirSync(srcDir).sort()) {
    const dir = path.join(srcDir, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    try {
      if (!ID_RE.test(id)) throw new Error('invalid folder name');
      if (seen.has(id)) throw new Error('duplicate id (already in catalog/src)');
      const names = fs.readdirSync(dir).filter((n) => FILE_RE.test(n) && fs.statSync(path.join(dir, n)).isFile())
        .sort((a, b) => (FILE_ORDER.indexOf(a) + 99) % 99 - (FILE_ORDER.indexOf(b) + 99) % 99 || a.localeCompare(b));
      if (!names.includes('manifest.json')) throw new Error('manifest.json missing');
      const files = names.map((n) => ({ name: n, content: fs.readFileSync(path.join(dir, n), 'utf8') }));
      const manifest = JSON.parse(files.find((f) => f.name === 'manifest.json').content);
      if (!manifest || typeof manifest !== 'object') throw new Error('manifest.json must be an object');
      if (lenient) manifest.id = id; else if (manifest.id !== id) throw new Error(`manifest.id (${manifest.id}) must equal folder name (${id})`);
      if (!VER_RE.test(manifest.version || '')) { if (lenient) manifest.version = '1.0.0'; else throw new Error('manifest.version must be x.y.z'); }
      const pkg = { format: 'alaisai-addon', version: 1, id, manifest, files };
      const text = JSON.stringify(pkg, null, 2) + '\n';
      const rel = `addons/${id}.alaisai-addon.json`;
      out.push([path.join(root, rel), text]); seen.add(id);
      entries.push({ id, name: String(manifest.name || id).slice(0, 60), icon: String(manifest.icon || '🧩').slice(0, 8), version: manifest.version, description: String(manifest.description || '').slice(0, 200), author: String(manifest.author || '').slice(0, 60),
        file: rel, size: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') });
    } catch (e) { if (!lenient) throw e; console.warn(`skipped addons/${id}: ${e.message}`); }
  }
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
