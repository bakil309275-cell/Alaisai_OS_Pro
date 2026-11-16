// الواجهة الخلفية الاختيارية للعيسائي برو (Cloudflare Worker + D1، مجانية للاستخدام الخفيف).
// تقدّم: إعجابات/تفاعلات عامة، عدّاد المستخدمين والمتصلين، صندوق رسائل المالك.
// لا تخزّن إلا معرّفاً عشوائياً للجهاز بلا أي بيانات شخصية (ما لم يكتب المستخدم اسمه ورقمه في رسالة).
// التطبيق يعمل كاملاً بدونها؛ هي طبقة اختيارية. الأسرار: OWNER_KEY فقط (Secret في Cloudflare).
// ===== منصة العيسائي والاشتراكات (ملف واحد ليسهل لصقه في لوحة Cloudflare) =====
// منصة العيسائي: حسابات، منشورات، تعليقات، بلاغات، وطلبات اشتراك. تُستدعى من worker.js.
// الأمان: كلمات المرور PBKDF2 مملّحة، رموز الدخول HMAC بانتهاء، كل المدخلات تُقيَّد، حدود معدّل لكل حساب/جهاز.
const enc = new TextEncoder();
const b64 = (u8) => { let s = ''; u8.forEach((c) => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const IDENT = /^[\w.+@-]{4,60}$/;
const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{20,}$/;
const PLAN = /^[\w-]{1,30}$/;
const TABLES = [
  'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, ident TEXT UNIQUE, name TEXT, salt TEXT, hash TEXT, ts INTEGER, banned INTEGER DEFAULT 0, did TEXT)',
  'CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER, ts INTEGER, text TEXT, link TEXT, media TEXT, hidden INTEGER DEFAULT 0, pin INTEGER DEFAULT 0, official INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS posts_ts ON posts (hidden, pin, ts)',
  'CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post INTEGER, uid INTEGER, ts INTEGER, text TEXT, hidden INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS comments_post ON comments (post, ts)',
  'CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, uid INTEGER, post INTEGER, reason TEXT)',
  'CREATE TABLE IF NOT EXISTS subreq (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, did TEXT, rk TEXT, aid TEXT, addon TEXT, plan TEXT, name TEXT, phone TEXT, email TEXT, proof TEXT, proofimg TEXT, status TEXT DEFAULT \'new\', code TEXT, note TEXT)',
];
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data))));
}
async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 100000 }, k, 256)));
}
const secret = (env) => env.TOKEN_SECRET || env.OWNER_KEY || '';
async function mint(env, uid) { const p = uid + '.' + (Date.now() + 30 * 864e5); return p + '.' + await hmac(secret(env), p); }
async function who(req, env, c) {
  const m = /^Bearer ([\d]+\.[\d]+\.[\w-]+)$/.exec(req.headers.get('authorization') || ''); if (!m || secret(env).length < 16) return null;
  const [uid, exp, sig] = m[1].split('.'); if (+exp < Date.now() || !c.same(sig, await hmac(secret(env), uid + '.' + exp))) return null;
  const u = await c.one(env, 'SELECT id, name, banned FROM users WHERE id = ?', +uid); return u && !u.banned ? u : null;
}
const pub = (u) => ({ id: u.id, name: u.name });
function media(list) {
  const out = []; for (const m of Array.isArray(list) ? list.slice(0, 3) : []) {
    if (m && m.t === 'img' && typeof m.d === 'string' && m.d.length < 260000 && IMG.test(m.d)) out.push({ t: 'img', d: m.d });
    else if (m && m.t === 'vid' && typeof m.u === 'string' && /^https:\/\/[^\s"'<>]{4,300}$/.test(m.u)) out.push({ t: 'vid', u: m.u });
  } return out;
}
async function shape(env, c, r, uid) {
  const out = []; for (const p of r) {
    const au = p.official ? { id: 0, name: 'العيسائي برو' } : await c.one(env, 'SELECT id, name FROM users WHERE id = ?', p.uid);
    out.push({ id: p.id, ts: p.ts, text: p.text, link: p.link, media: JSON.parse(p.media || '[]'), pin: !!p.pin, official: !!p.official, author: au ? pub(au) : { id: 0, name: 'محذوف' }, mine: !!uid && p.uid === uid, comments: (await c.one(env, 'SELECT COUNT(*) n FROM comments WHERE post = ? AND hidden = 0', p.id)).n });
  } return out;
}
async function platform(req, env, p, u, c) {
  const { J, q, rows, one, str, body, owner, now } = c, m = req.method;
  if (p === '/v1/auth/register' && m === 'POST') {
    if (secret(env).length < 16) return J({ error: 'الخادم بلا مفتاح' }, 500);
    const b = await body(req); if (!b) return J({ error: 'bad' }, 400);
    const ident = str(b.ident, 60).toLowerCase(), name = str(b.name, 40), pw = typeof b.password === 'string' ? b.password : '';
    if (!IDENT.test(ident) || name.length < 2 || pw.length < 8 || pw.length > 100) return J({ error: 'بيانات غير صالحة: الاسم حرفان فأكثر، كلمة المرور 8 فأكثر' }, 400);
    const did = DID.test(String(b.did)) ? b.did : '';
    if (did && (await one(env, 'SELECT COUNT(*) n FROM users WHERE did = ?', did)).n >= 3) return J({ error: 'rate' }, 429);
    if ((await one(env, 'SELECT COUNT(*) n FROM users WHERE ts > ?', now - 3600000)).n >= 60) return J({ error: 'rate' }, 429);
    if (await one(env, 'SELECT id FROM users WHERE ident = ?', ident)) return J({ error: 'المعرّف مستخدم' }, 409);
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    await q(env, 'INSERT INTO users (ident, name, salt, hash, ts, did) VALUES (?,?,?,?,?,?)', ident, name, salt, await hashPw(pw, salt), now, did).run();
    const r = await one(env, 'SELECT id, name FROM users WHERE ident = ?', ident); return J({ token: await mint(env, r.id), user: pub(r) });
  }
  if (p === '/v1/auth/login' && m === 'POST') {
    const b = await body(req); if (!b) return J({ error: 'bad' }, 400); const ident = str(b.ident, 60).toLowerCase();
    const r = IDENT.test(ident) && typeof b.password === 'string' ? await one(env, 'SELECT * FROM users WHERE ident = ?', ident) : null;
    const ok = r ? c.same(await hashPw(b.password.slice(0, 100), r.salt), r.hash) : (await hashPw('x', 'AAAAAAAAAAAAAAAAAAAAAA'), false);
    if (!ok || r.banned) return J({ error: 'بيانات الدخول غير صحيحة' }, 401);
    return J({ token: await mint(env, r.id), user: pub(r) });
  }
  if (p === '/v1/posts' && m === 'GET') {
    const me = await who(req, env, c), before = Math.max(0, +u.searchParams.get('before') || 0) || 9e15;
    const r = await rows(env, 'SELECT * FROM posts WHERE hidden = 0 AND id < ? ORDER BY pin DESC, id DESC LIMIT 20', before);
    return J({ posts: await shape(env, c, r, me && me.id) });
  }
  if (p === '/v1/posts' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req, 700000); if (!b) return J({ error: 'bad' }, 400);
    const text = str(b.text, 3000), link = /^https?:\/\/[^\s"'<>]{4,300}$/.test(b.link || '') ? b.link : '', md = media(b.media);
    if (!text && !md.length) return J({ error: 'empty' }, 400);
    if ((await one(env, 'SELECT COUNT(*) n FROM posts WHERE uid = ? AND ts > ?', me.id, now - 3600000)).n >= 10) return J({ error: 'rate' }, 429);
    await q(env, 'INSERT INTO posts (uid, ts, text, link, media) VALUES (?,?,?,?,?)', me.id, now, text, link, JSON.stringify(md)).run();
    const id = (await one(env, 'SELECT MAX(id) n FROM posts WHERE uid = ?', me.id)).n; return J({ ok: true, id });
  }
  let mm = /^\/v1\/posts\/(\d{1,12})$/.exec(p);
  if (mm && m === 'DELETE') {
    const me = await who(req, env, c), own = owner(req, env); if (!me && !own) return J({ error: 'unauthorized' }, 401);
    const r = await one(env, 'SELECT uid FROM posts WHERE id = ?', +mm[1]); if (!r) return J({ error: 'not found' }, 404);
    if (!own && r.uid !== me.id) return J({ error: 'forbidden' }, 403);
    await q(env, 'DELETE FROM posts WHERE id = ?', +mm[1]).run(); await q(env, 'DELETE FROM comments WHERE post = ?', +mm[1]).run(); return J({ ok: true });
  }
  mm = /^\/v1\/posts\/(\d{1,12})\/comments$/.exec(p);
  if (mm && m === 'GET') {
    const r = await rows(env, 'SELECT c.id, c.ts, c.text, c.uid, u.name FROM comments c LEFT JOIN users u ON u.id = c.uid WHERE c.post = ? AND c.hidden = 0 ORDER BY c.id LIMIT 100', +mm[1]);
    return J({ comments: r.map((x) => ({ id: x.id, ts: x.ts, text: x.text, author: { id: x.uid, name: x.name || 'محذوف' } })) });
  }
  if (mm && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req), text = b ? str(b.text, 800) : ''; if (!text) return J({ error: 'empty' }, 400);
    if (!(await one(env, 'SELECT id FROM posts WHERE id = ? AND hidden = 0', +mm[1]))) return J({ error: 'not found' }, 404);
    if ((await one(env, 'SELECT COUNT(*) n FROM comments WHERE uid = ? AND ts > ?', me.id, now - 60000)).n >= 8) return J({ error: 'rate' }, 429);
    await q(env, 'INSERT INTO comments (post, uid, ts, text) VALUES (?,?,?,?)', +mm[1], me.id, now, text).run(); return J({ ok: true });
  }
  if (p === '/v1/report' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req); if (!b || !(+b.post > 0)) return J({ error: 'bad' }, 400);
    if ((await one(env, 'SELECT COUNT(*) n FROM reports WHERE uid = ? AND ts > ?', me.id, now - 3600000)).n >= 10) return J({ error: 'rate' }, 429);
    await q(env, 'INSERT INTO reports (ts, uid, post, reason) VALUES (?,?,?,?)', now, me.id, +b.post, str(b.reason, 200)).run();
    if ((await one(env, 'SELECT COUNT(DISTINCT uid) n FROM reports WHERE post = ?', +b.post)).n >= 3) await q(env, 'UPDATE posts SET hidden = 1 WHERE id = ? AND official = 0', +b.post).run();
    return J({ ok: true });
  }
  // ----- طلبات الاشتراك (بلا حساب منصة؛ المفتاح rk السري يعيد الرمز لصاحب الطلب فقط) -----
  if (p === '/v1/sub/request' && m === 'POST') {
    const b = await body(req, 400000); if (!b || !DID.test(String(b.did))) return J({ error: 'bad' }, 400);
    const aid = str(b.aid, 40), addon = str(b.addon, 120), plan = str(b.plan, 30), name = str(b.name, 60), phone = str(b.phone, 25);
    if (!/^[\w-]{6,40}$/.test(aid) || !name || !phone || (plan && !PLAN.test(plan))) return J({ error: 'أكمل الاسم والهاتف' }, 400);
    if ((await one(env, 'SELECT COUNT(*) n FROM subreq WHERE did = ? AND ts > ?', b.did, now - 3600000)).n >= 5) return J({ error: 'rate' }, 429);
    const rk = b64(crypto.getRandomValues(new Uint8Array(18))), img = typeof b.proofimg === 'string' && b.proofimg.length < 260000 && IMG.test(b.proofimg) ? b.proofimg : '';
    await q(env, 'INSERT INTO subreq (ts, did, rk, aid, addon, plan, name, phone, email, proof, proofimg) VALUES (?,?,?,?,?,?,?,?,?,?,?)', now, b.did, rk, aid, addon, plan, name, phone, str(b.email, 80), str(b.proof, 1000), img).run();
    return J({ ok: true, id: (await one(env, 'SELECT MAX(id) n FROM subreq WHERE rk = ?', rk)).n, rk });
  }
  if (p === '/v1/sub/mine' && m === 'GET') {
    const id = +u.searchParams.get('id'), rk = u.searchParams.get('rk') || ''; if (!(id > 0) || !/^[\w-]{10,40}$/.test(rk)) return J({ error: 'bad' }, 400);
    const r = await one(env, 'SELECT id, status, code, note, addon, plan FROM subreq WHERE id = ? AND rk = ?', id, rk); return r ? J(r) : J({ error: 'not found' }, 404);
  }
  // ----- أدوات المالك -----
  if (p.indexOf('/v1/admin/') === 0) {
    if (!owner(req, env)) return J({ error: 'unauthorized' }, 401);
    if (p === '/v1/admin/post' && m === 'POST') {
      const b = await body(req, 700000), text = b ? str(b.text, 3000) : '', md = b ? media(b.media) : []; if (!text && !md.length) return J({ error: 'empty' }, 400);
      await q(env, 'INSERT INTO posts (uid, ts, text, link, media, pin, official) VALUES (0,?,?,?,?,?,1)', now, text, /^https?:\/\/[^\s"'<>]{4,300}$/.test(b.link || '') ? b.link : '', JSON.stringify(md), b.pin ? 1 : 0).run(); return J({ ok: true });
    }
    if (p === '/v1/admin/users') return J({ users: await rows(env, 'SELECT id, ident, name, ts, banned FROM users ORDER BY id DESC LIMIT 200'), reports: await rows(env, 'SELECT post, COUNT(*) n FROM reports GROUP BY post ORDER BY n DESC LIMIT 20') });
    if ((mm = /^\/v1\/admin\/ban\/(\d{1,12})$/.exec(p)) && m === 'POST') { const b = await body(req); await q(env, 'UPDATE users SET banned = ? WHERE id = ?', b && b.off ? 0 : 1, +mm[1]).run(); return J({ ok: true }); }
    if ((mm = /^\/v1\/admin\/hide\/(\d{1,12})$/.exec(p)) && m === 'POST') { const b = await body(req); await q(env, 'UPDATE posts SET hidden = ? WHERE id = ?', b && b.off ? 0 : 1, +mm[1]).run(); return J({ ok: true }); }
    if ((mm = /^\/v1\/admin\/pin\/(\d{1,12})$/.exec(p)) && m === 'POST') { const b = await body(req); await q(env, 'UPDATE posts SET pin = ? WHERE id = ?', b && b.off ? 0 : 1, +mm[1]).run(); return J({ ok: true }); }
    if (p === '/v1/admin/subreq' && m === 'GET') return J({ items: await rows(env, 'SELECT id, ts, aid, addon, plan, name, phone, email, proof, proofimg, status, code, note FROM subreq ORDER BY id DESC LIMIT 100') });
    if ((mm = /^\/v1\/admin\/subreq\/(\d{1,12})$/.exec(p)) && m === 'POST') {
      const b = await body(req); if (!b || !['new', 'approved', 'rejected'].includes(b.status)) return J({ error: 'bad' }, 400);
      await q(env, 'UPDATE subreq SET status = ?, code = ?, note = ? WHERE id = ?', b.status, str(b.code, 900), str(b.note, 300), +mm[1]).run(); return J({ ok: true });
    }
  }
  return null;
}

// ===== الواجهة الأساسية =====
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
    ].concat(TABLES)) await q(env, s).run();
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
async function body(req, max = 20000) { try { const t = await req.text(); if (t.length > max) return null; const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch (_) { return null; } }

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, ''), now = Date.now();
    try {
      if (p === '/v1/health') return J({ ok: true, t: now });
      if (!env.DB) return J({ error: 'قاعدة البيانات DB غير مربوطة' }, 500);
      await ensure(env);

      const pr = await platform(req, env, p, u, { J, q, rows, one, str, body, owner: (r) => owner(r, env), same, now });
      if (pr) return pr;
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
