// الواجهة الخلفية الاختيارية للعيسائي برو (Cloudflare Worker + D1، مجانية للاستخدام الخفيف).
// تقدّم: إعجابات/تفاعلات عامة، عدّاد المستخدمين والمتصلين، صندوق رسائل المالك.
// لا تخزّن إلا معرّفاً عشوائياً للجهاز بلا أي بيانات شخصية (ما لم يكتب المستخدم اسمه ورقمه في رسالة).
// التطبيق يعمل كاملاً بدونها؛ هي طبقة اختيارية. الأسرار: OWNER_KEY فقط (Secret في Cloudflare).
const KINDS = ['like', 'love', 'clap', 'wow', 'pray'];
const MSG_KINDS = ['inq', 'req', 'sub', 'post', 'bug', 'oth'];
const DID = /^[A-Za-z0-9_-]{16,64}$/, ITEM = /^[\w-]{1,40}$/;
const H = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,authorization', 'access-control-max-age': '86400' };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...H, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
let ready = null;
const q = (env, sql, ...a) => env.DB.prepare(sql).bind(...a);
const rows = async (env, sql, ...a) => (await q(env, sql, ...a).all()).results || [];
const one = (env, sql, ...a) => q(env, sql, ...a).first();
async function ensure(env) {
  if (!ready) ready = (async () => {
    for (const s of [
      'CREATE TABLE IF NOT EXISTS devices (did TEXT PRIMARY KEY, first INTEGER, last INTEGER, ver TEXT)',
      'CREATE TABLE IF NOT EXISTS reactions (item TEXT, kind TEXT, did TEXT, ts INTEGER, PRIMARY KEY (item, kind, did))',
      'CREATE INDEX IF NOT EXISTS reactions_did ON reactions (did, ts)',
      'CREATE TABLE IF NOT EXISTS inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, did TEXT, kind TEXT, name TEXT, phone TEXT, subject TEXT, text TEXT, addon TEXT)',
    ]) await q(env, s).run();
  })();
  return ready;
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function owner(req, env) { const k = env.OWNER_KEY; if (!k || k.length < 16) return false; const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || ''); return !!m && same(m[1], k); }
const totals = async (env, now) => ({ users: (await one(env, 'SELECT COUNT(*) n FROM devices')).n, online: (await one(env, 'SELECT COUNT(*) n FROM devices WHERE last > ?', now - 600000)).n });
async function counts(env, ids) {
  const out = {}; if (!ids.length) return out;
  const r = await rows(env, `SELECT item, kind, COUNT(*) n FROM reactions WHERE item IN (${ids.map(() => '?').join(',')}) GROUP BY item, kind`, ...ids);
  ids.forEach((i) => { out[i] = {}; }); r.forEach((x) => { out[x.item][x.kind] = x.n; }); return out;
}
async function body(req) { try { const t = await req.text(); if (t.length > 20000) return null; const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch (_) { return null; } }

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, ''), now = Date.now();
    try {
      if (p === '/v1/health') return J({ ok: true, t: now });
      if (!env.DB) return J({ error: 'قاعدة البيانات DB غير مربوطة' }, 500);
      await ensure(env);

      if (p === '/v1/hello' && req.method === 'POST') {
        const b = await body(req); if (!b || !DID.test(String(b.did))) return J({ error: 'bad' }, 400);
        await q(env, 'INSERT INTO devices (did, first, last, ver) VALUES (?,?,?,?) ON CONFLICT(did) DO UPDATE SET last = excluded.last, ver = excluded.ver', b.did, now, now, str(b.ver, 12)).run();
        if (Math.random() < 0.02) { await q(env, 'DELETE FROM devices WHERE last < ?', now - 400 * 864e5).run(); await q(env, 'DELETE FROM inbox WHERE ts < ?', now - 180 * 864e5).run(); }
        return J(await totals(env, now));
      }

      if (p === '/v1/stats' && req.method === 'GET') {
        const ids = (u.searchParams.get('ids') || '').split(',').filter((x) => ITEM.test(x)).slice(0, 50);
        return J({ counts: await counts(env, ids), ...(await totals(env, now)) });
      }

      if (p === '/v1/react' && req.method === 'POST') {
        const b = await body(req); if (!b || !DID.test(String(b.did)) || !ITEM.test(String(b.item)) || !KINDS.includes(b.kind)) return J({ error: 'bad' }, 400);
        const recent = (await one(env, 'SELECT COUNT(*) n FROM reactions WHERE did = ? AND ts > ?', b.did, now - 60000)).n; if (recent >= 30) return J({ error: 'rate' }, 429);
        if (b.on) await q(env, 'INSERT OR IGNORE INTO reactions (item, kind, did, ts) VALUES (?,?,?,?)', b.item, b.kind, b.did, now).run();
        else await q(env, 'DELETE FROM reactions WHERE item = ? AND kind = ? AND did = ?', b.item, b.kind, b.did).run();
        return J({ counts: await counts(env, [b.item]) });
      }

      if (p === '/v1/inbox' && req.method === 'POST') {
        const b = await body(req); if (!b || !DID.test(String(b.did))) return J({ error: 'bad' }, 400);
        const text = str(b.text, 4000); if (!text) return J({ error: 'empty' }, 400);
        const recent = (await one(env, 'SELECT COUNT(*) n FROM inbox WHERE did = ? AND ts > ?', b.did, now - 3600000)).n; if (recent >= 5) return J({ error: 'rate' }, 429);
        const total = (await one(env, 'SELECT COUNT(*) n FROM inbox')).n; if (total >= 5000) await q(env, 'DELETE FROM inbox WHERE id IN (SELECT id FROM inbox ORDER BY id LIMIT 500)').run();
        await q(env, 'INSERT INTO inbox (ts, did, kind, name, phone, subject, text, addon) VALUES (?,?,?,?,?,?,?,?)', now, b.did, MSG_KINDS.includes(b.kind) ? b.kind : 'oth', str(b.name, 60), str(b.phone, 25), str(b.subject, 100), text, str(b.addon, 80)).run();
        return J({ ok: true });
      }

      if (p.indexOf('/v1/admin') === 0 || p.indexOf('/v1/inbox/') === 0 || (p === '/v1/inbox' && req.method === 'GET')) {
        if (!owner(req, env)) return J({ error: 'unauthorized' }, 401);
        if (p === '/v1/inbox' && req.method === 'GET') return J({ items: await rows(env, 'SELECT id, ts, kind, name, phone, subject, text, addon FROM inbox ORDER BY id DESC LIMIT 200') });
        const m = /^\/v1\/inbox\/(\d{1,12})$/.exec(p);
        if (m && req.method === 'DELETE') { await q(env, 'DELETE FROM inbox WHERE id = ?', +m[1]).run(); return J({ ok: true }); }
        if (p === '/v1/admin/stats') {
          const day = (t) => new Date(t).toISOString().slice(0, 10), byDay = {};
          (await rows(env, 'SELECT first FROM devices WHERE first > ?', now - 14 * 864e5)).forEach((r) => { byDay[day(r.first)] = (byDay[day(r.first)] || 0) + 1; });
          return J({ ...(await totals(env, now)), reactions: (await one(env, 'SELECT COUNT(*) n FROM reactions')).n, inbox: (await one(env, 'SELECT COUNT(*) n FROM inbox')).n, newByDay: byDay, top: await rows(env, 'SELECT item, COUNT(*) n FROM reactions GROUP BY item ORDER BY n DESC LIMIT 10') });
        }
      }
      return J({ error: 'not found' }, 404);
    } catch (e) { return J({ error: 'server' }, 500); }
  },
};
