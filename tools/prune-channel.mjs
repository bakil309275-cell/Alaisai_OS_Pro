// تنظيف قناة المالك: يؤرشف القديم (يبقى العنوان) ويحذف المنتهي. يطابق Control.prune في التطبيق.
// الاستخدام: node tools/prune-channel.mjs [control/channel.json]
import fs from 'node:fs';
const file = process.argv[2] || 'control/channel.json', DAY = 864e5, now = Date.now();
const ch = JSON.parse(fs.readFileSync(file, 'utf8'));
if (ch.format !== 'alaisai-channel' || !Array.isArray(ch.items)) { console.error('ملف قناة غير صالح'); process.exit(1); }
const r = ch.retain || {}, ad = +r.archiveDays || 60, dd = +r.deleteDays || 240; let del = 0, arch = 0;
ch.items = ch.items.filter((i) => { const gone = (i.expires && i.expires < now) || now - (i.created || 0) > dd * DAY; if (gone) del++; return !gone; });
ch.items.forEach((i) => { if (!i.arch && now - (i.created || 0) > ad * DAY) { i.arch = true; delete i.body; arch++; } });
if (del || arch) { ch.seq = (ch.seq || 0) + 1; ch.updated = now; fs.writeFileSync(file, JSON.stringify(ch, null, 1) + '\n'); }
console.log(`archived=${arch} deleted=${del} changed=${del || arch ? 'yes' : 'no'}`);
