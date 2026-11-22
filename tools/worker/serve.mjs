// خادم تطوير محلي يشغّل الـ Worker نفسه فوق SQLite (للاختبار فقط): node tools/worker/serve.mjs [port]
import http from 'node:http'; import { DatabaseSync } from 'node:sqlite'; import W from './worker.js';
const sql = new DatabaseSync(':memory:');
const DB = { prepare: (s) => ({ bind: (...a) => ({ run: async () => { sql.prepare(s).run(...a); return {}; }, all: async () => ({ results: sql.prepare(s).all(...a).map((r) => ({ ...r })) }), first: async () => { const r = sql.prepare(s).get(...a); return r ? { ...r } : null; } }), run: async () => { sql.prepare(s).run(); return {}; } }) };
const env = { DB, OWNER_KEY: process.env.OWNER_KEY || 'dev-owner-key-0123456789', KB_URL: process.env.KB_URL };
if (process.env.R2) { // محاكاة R2 في الذاكرة للاختبار
  const m = new Map(); env.FILES = { put: async (k, b) => { m.set(k, new Uint8Array(await new Response(b).arrayBuffer())); }, head: async (k) => (m.has(k) ? { size: m.get(k).length } : null), delete: async (k) => { m.delete(k); },
    get: async (k, o) => { const x = m.get(k); if (!x) return null; const rg = o && o.range && o.range.get ? o.range.get('range') : null; if (rg) { const t = /bytes=(\d+)-(\d*)/.exec(rg), a = +t[1], e = t[2] ? +t[2] : x.length - 1; return { body: x.slice(a, e + 1), range: { offset: a, length: e - a + 1 } }; } return { body: x }; } };
}
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  const r = await W.fetch(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(+process.argv[2] || 8788, () => console.log('worker dev server ready'));
