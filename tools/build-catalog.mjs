// يبني حزم الإضافات من مجلداتها إلى catalog/addons/<معرّف>.alaisai-addon.json ثم catalog/index.json
//   المصادر: catalog/src/<اسم>/ و addons/<اسم>/ (المجلد الذي يمليه التطبيق ويضيف إليه أصحابه)
//   الأسماء بأي لغة، والملفات داخل مجلدات متداخلة (src/bridge/File.js).
// الاستخدام: node tools/build-catalog.mjs [--check] [--src dirA,dirB] [--out dir]
//   --check يفشل إن كانت الملفات المبنية قديمة. --src/--out لاختبار كتالوج بديل.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const repo = path.resolve(import.meta.dirname, '..');
const root = opt('--out') ? path.resolve(opt('--out')) : path.join(repo, 'catalog');
const check = argv.includes('--check');
const FILE_ORDER = ['manifest.json', 'index.html', 'main.js', 'style.css'];
const KEEP = '.gitkeep', MAX_FILES = 300, MAX_FILE = 500000, MAX_BIN = 4200000, MAX_TOTAL = 14000000;
// نفس تصنيف التطبيق (Addons.fromBytes): نص UTF-8 سليم يبقى نصاً، وغيره (صور/خطوط/صوت...) يُخزَّن base64 مع bin:true
const BIN_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'mov', 'pdf', 'zip', 'gz', '7z', 'rar', 'wasm', 'bin', 'db', 'sqlite', 'apk', 'exe', 'dll', 'so', 'psd', 'xlsx', 'docx', 'pptx']);
const extOf = (n) => { const b = n.split('/').pop(); return b.includes('.') ? b.split('.').pop().toLowerCase() : ''; };
const readFile = (file, name) => {
  const buf = fs.readFileSync(file); let text = null;
  if (!BIN_EXT.has(extOf(name))) { try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf); if (text.includes('\0')) text = null; } catch (e) { text = null; } }
  return text !== null && text.length <= MAX_FILE ? { name, content: text } : { name, content: buf.toString('base64'), bin: true };
};
// نفس قواعد التطبيق (Store.validName / Store.validPath)
const BAD = /[\u0000-\u001f\u007f\\/:*?"<>|]/, RESERVED = ['__proto__', 'constructor', 'prototype'];
const validName = (n) => n.length >= 1 && n.length <= 60 && n === n.trim() && !BAD.test(n) && !/^\.|\.$/.test(n) && !RESERVED.includes(n);
const validPath = (p) => p.length <= 200 && p.split('/').length <= 8 && p.split('/').every((s) => s.length >= 1 && s.length <= 80 && s === s.trim() && !BAD.test(s) && s !== '.' && s !== '..');
const VER_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const sources = (opt('--src') ? opt('--src').split(',').map((d) => path.resolve(d)) : [path.join(repo, 'catalog', 'src'), path.join(repo, 'addons')]).filter((d) => fs.existsSync(d));
const walk = (dir, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name), rel + e.name + '/') : e.isFile() ? [rel + e.name] : []);
// اسم ملف الحزمة المبنية بحروف آمنة دائماً (الاسم العربي يُستبدل ببصمة قصيرة)
const slug = (id) => (/^[\w-]{1,60}$/.test(id) ? id : 'p-' + crypto.createHash('sha1').update(id).digest('hex').slice(0, 12));
const out = [], entries = [], seen = new Set();
for (const srcDir of sources) {
  const lenient = path.basename(srcDir) !== 'src'; // addons/ يحرّره الناس: نتخطى الفاسد بتحذير بدل إفشال البناء
  for (const id of fs.readdirSync(srcDir).sort()) {
    const dir = path.join(srcDir, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    try {
      if (!validName(id)) throw new Error('invalid folder name');
      if (seen.has(id)) throw new Error('duplicate id');
      const names = walk(dir).filter((n) => validPath(n) && n.split('/').pop() !== KEEP)
        .sort((a, b) => (FILE_ORDER.indexOf(a) + 99) % 99 - (FILE_ORDER.indexOf(b) + 99) % 99 || a.localeCompare(b));
      if (!names.includes('manifest.json')) throw new Error('manifest.json missing');
      if (names.length > MAX_FILES) throw new Error('too many files');
      const files = names.map((n) => readFile(path.join(dir, n), n));
      if (files.some((f) => f.content.length > (f.bin ? MAX_BIN : MAX_FILE)) || files.reduce((s, f) => s + f.content.length, 0) > MAX_TOTAL) throw new Error('add-on too large');
      const mf = files.find((f) => f.name === 'manifest.json'); if (mf.bin) throw new Error('manifest.json must be UTF-8 text');
      const manifest = JSON.parse(mf.content);
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('manifest.json must be an object');
      if (lenient) manifest.id = id; else if (manifest.id !== id) throw new Error(`manifest.id (${manifest.id}) must equal folder name (${id})`);
      if (!VER_RE.test(manifest.version || '')) { if (lenient) manifest.version = '1.0.0'; else throw new Error('manifest.version must be x.y.z'); }
      const pkg = { format: 'alaisai-addon', version: 1, id, manifest, files };
      const text = JSON.stringify(pkg, null, 2) + '\n';
      const rel = `addons/${slug(id)}.alaisai-addon.json`;
      out.push([path.join(root, rel), text]); seen.add(id);
      entries.push({ id, name: String(manifest.name || id).slice(0, 60), icon: String(manifest.icon || '🧩').slice(0, 8), version: manifest.version, description: String(manifest.description || '').slice(0, 200), author: String(manifest.author || '').slice(0, 60),
        file: rel, size: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') });
    } catch (e) { if (!lenient) throw e; console.warn(`skipped ${path.basename(srcDir)}/${id}: ${e.message}`); }
  }
}
out.push([path.join(root, 'index.json'), JSON.stringify({ format: 'alaisai-catalog', version: 1, addons: entries }, null, 2) + '\n']);
// حزم مبنية قديمة لإضافات لم تعد موجودة تُحذف (حتى لا تتراكم)
const keep = new Set(out.map(([f]) => f)), addonsDir = path.join(root, 'addons');
const orphans = fs.existsSync(addonsDir) ? fs.readdirSync(addonsDir).filter((n) => n.endsWith('.alaisai-addon.json')).map((n) => path.join(addonsDir, n)).filter((f) => !keep.has(f)) : [];
let stale = orphans.length;
for (const [file, text] of out) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (cur !== text) { stale++; if (!check) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); } }
}
if (!check) orphans.forEach((f) => fs.unlinkSync(f));
if (check && stale) { console.error(`catalog out of date (${stale} files). Run: node tools/build-catalog.mjs`); process.exit(1); }
console.log(check ? 'catalog up to date' : `catalog built: ${entries.length} add-ons`);
