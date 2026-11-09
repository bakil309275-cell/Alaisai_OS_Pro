// خادم تطوير محلي يشغّل الـ Worker نفسه فوق SQLite (للاختبار فقط): node tools/worker/serve.mjs [port]
import http from 'node:http'; import { DatabaseSync } from 'node:sqlite'; import W from './worker.js';
const sql = new DatabaseSync(':memory:');
const DB = { prepare: (s) => ({ bind: (...a) => ({ run: async () => { sql.prepare(s).run(...a); return {}; }, all: async () => ({ results: sql.prepare(s).all(...a).map((r) => ({ ...r })) }), first: async () => { const r = sql.prepare(s).get(...a); return r ? { ...r } : null; } }), run: async () => { sql.prepare(s).run(); return {}; } }) };
const env = { DB, OWNER_KEY: process.env.OWNER_KEY || 'dev-owner-key-0123456789' };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  const r = await W.fetch(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(+process.argv[2] || 8788, () => console.log('worker dev server ready'));
