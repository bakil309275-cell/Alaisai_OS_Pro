// يغيّر عنوان الموقع الافتراضي (GitHub Pages) إلى نطاقك: node tools/set-site-url.mjs https://example.com/
import fs from 'node:fs';
const OLD = 'https://bakil309275-cell.github.io/Alaisai_OS_Pro/';
let next = process.argv[2];
if (!next || !/^https:\/\/[^\s]+$/.test(next)) { console.error('Usage: node tools/set-site-url.mjs https://your-domain.com/'); process.exit(1); }
if (!next.endsWith('/')) next += '/';
let n = 0;
for (const f of ['index.html', 'privacy.html', 'terms.html', '404.html', 'robots.txt', 'sitemap.xml']) {
  const s = fs.readFileSync(f, 'utf8'); if (!s.includes(OLD)) continue;
  fs.writeFileSync(f, s.split(OLD).join(next)); n++;
}
console.log(`updated ${n} files -> ${next}`);
