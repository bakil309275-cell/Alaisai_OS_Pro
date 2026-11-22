// يبني معرفة مجلد claude/ ويدمجها في tools/worker/worker.js (نسخة احتياطية مضمَّنة + قواعد الحارس + الشخصية).
// node tools/build-claude.mjs          ← يكتب claude/knowledge/kb.json ويحدّث worker.js
// node tools/build-claude.mjs --check  ← يتحقق أن كل شيء محدَّث (للاختبارات)
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), kd = path.join(root, 'claude/knowledge');
const kb = fs.readdirSync(kd).filter((f) => f.endsWith('.md')).sort().map((f) => {
  const L = fs.readFileSync(path.join(kd, f), 'utf8').replace(/\r/g, '').split('\n'); const t = (L[0] || '').replace(/^#\s*/, '').trim();
  const kw = /^كلمات:\s*(.*)$/.exec(L[1] || ''); if (!t || !kw) throw new Error('صيغة غير صحيحة: ' + f);
  return { id: f.replace(/\.md$/, ''), t, kw: kw[1].split(/[,،]/).map((x) => x.trim()).filter(Boolean), x: L.slice(2).join('\n').trim() };
});
const persona = JSON.parse(fs.readFileSync(path.join(root, 'claude/persona.json'), 'utf8')), rules = JSON.parse(fs.readFileSync(path.join(root, 'claude/guard-rules.json'), 'utf8'));
for (const r of rules.rules) new RegExp(r.re, 'i'); new RegExp(rules.probe, 'i');
const kbJson = JSON.stringify({ v: 1, items: kb }) + '\n';
const block = '/*claude:data*/\nconst CLAUDE = ' + JSON.stringify({ persona: { system: persona.system, refuse: persona.refuse, nohit: persona.nohit, limits: persona.limits }, rules: rules.rules, probe: rules.probe, kb }) + ';\n/*claude:end*/';
const wp = path.join(root, 'tools/worker/worker.js'); let w = fs.readFileSync(wp, 'utf8');
const re = /\/\*claude:data\*\/[\s\S]*?\/\*claude:end\*\//; if (!re.test(w)) throw new Error('علامات claude:data غير موجودة في worker.js');
const nw = w.replace(re, () => block), kp = path.join(kd, 'kb.json');
if (process.argv.includes('--check')) {
  const ok = nw === w && fs.existsSync(kp) && fs.readFileSync(kp, 'utf8') === kbJson; console.log(ok ? 'claude: محدَّث (' + kb.length + ' موضوعاً)' : 'claude: يحتاج إعادة بناء: node tools/build-claude.mjs'); process.exit(ok ? 0 : 1);
}
fs.writeFileSync(kp, kbJson); fs.writeFileSync(wp, nw); console.log('claude: ' + kb.length + ' موضوعاً، ' + rules.rules.length + ' قاعدة حارس');
