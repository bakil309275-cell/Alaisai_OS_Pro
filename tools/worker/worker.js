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
const SCOPE = /^(platform|group:\d{1,12}|addon:[^,<>"'\\%_]{1,80})$/u; // جهة النشر داخل المنصة: الصفحة الرئيسية أو صفحة إضافة معيّنة
// ----- رفع الملفات (2.13): أي نوع ملف أو فيديو. مع ربط R2 (env.FILES) حتى 100MB وبث مباشر؛ بدونه تُخزَّن قطعاً في D1 حتى 8MB -----
const CHUNK = 262144, LIM = { d1: 8 * 1048576, r2: 100 * 1048576 }, QUOTA = { d1: 40 * 1048576, r2: 1024 * 1048576 };
const BAD_EXT = /\.(exe|msi|bat|cmd|com|scr|pif|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|jar|apk|dll|lnk|hta|html?|xhtml|svg|php|sh)$/i; // ملفات تنفيذية ونصوص تُشغَّل في المتصفح: ممنوعة
const SAFE_VIEW = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg)|audio\/(mpeg|ogg|wav|webm|mp4|aac)|application\/pdf)$/;
const FID = /^[0-9a-f]{32}$/;
const KINDS_U = ['person', 'business', 'company', 'pro'];
const HTTPS = /^https:\/\/[^\s"'<>]{4,300}$/;
// أعمدة أُضيفت في 2.11: تُنفَّذ مرة بعد الجداول؛ الفشل (العمود موجود) يُتجاهل
const MIGRATE = [
  'ALTER TABLE users ADD COLUMN email TEXT', 'ALTER TABLE users ADD COLUMN phone TEXT', 'ALTER TABLE users ADD COLUMN bio TEXT', 'ALTER TABLE users ADD COLUMN av TEXT',
  'ALTER TABLE users ADD COLUMN avts INTEGER DEFAULT 0', 'ALTER TABLE users ADD COLUMN links TEXT', 'ALTER TABLE users ADD COLUMN kind TEXT', 'ALTER TABLE users ADD COLUMN showc INTEGER DEFAULT 0',
  "ALTER TABLE posts ADD COLUMN scopes TEXT DEFAULT ',platform,'",
];
const TABLES = [
  'CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)',
  'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, ident TEXT UNIQUE, name TEXT, salt TEXT, hash TEXT, ts INTEGER, banned INTEGER DEFAULT 0, did TEXT)',
  'CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER, ts INTEGER, text TEXT, link TEXT, media TEXT, hidden INTEGER DEFAULT 0, pin INTEGER DEFAULT 0, official INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS posts_ts ON posts (hidden, pin, ts)',
  'CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post INTEGER, uid INTEGER, ts INTEGER, text TEXT, hidden INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS comments_post ON comments (post, ts)',
  'CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, uid INTEGER, post INTEGER, reason TEXT)',
  'CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, descr TEXT, owner INTEGER, ts INTEGER)',
  'CREATE TABLE IF NOT EXISTS gmem (gid INTEGER, uid INTEGER, st TEXT, role TEXT, ts INTEGER, PRIMARY KEY (gid, uid))',
  'CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, uid INTEGER, name TEXT, type TEXT, size INTEGER, chunks INTEGER, mode TEXT, done INTEGER DEFAULT 0, post INTEGER DEFAULT 0, ts INTEGER)',
  'CREATE TABLE IF NOT EXISTS fchunks (fid TEXT, n INTEGER, data TEXT, PRIMARY KEY (fid, n))',
  'CREATE TABLE IF NOT EXISTS follows (a INTEGER, b INTEGER, ts INTEGER, PRIMARY KEY (a, b))',
  'CREATE TABLE IF NOT EXISTS friends (a INTEGER, b INTEGER, st TEXT, ts INTEGER, PRIMARY KEY (a, b))',
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
  const u = await c.one(env, 'SELECT ' + ME + ' FROM users WHERE id = ?', +uid); return u && !u.banned ? u : null;
}
const pub = (u) => ({ id: u.id, name: u.name, av: u.avts || 0 });
const links = (v) => { let a = v; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (_) { a = []; } } const o = []; for (const x of Array.isArray(a) ? a.slice(0, 8) : []) if (x && typeof x.n === 'string' && HTTPS.test(x.u || '')) o.push({ n: x.n.trim().slice(0, 30), u: x.u }); return o; };
const mine = (u) => ({ ...pub(u), bio: u.bio || '', email: u.email || '', phone: u.phone || '', showc: !!u.showc, kind: u.kind || 'person', links: links(u.links) });
const ME = 'id, name, banned, ident, bio, email, phone, avts, links, kind, showc';
const scopesOf = (v) => { const a = Array.isArray(v) ? v.filter((x) => typeof x === 'string' && SCOPE.test(x)) : []; const g = a.find((x) => x.startsWith('group:')); return g ? [g] : [...new Set(a.length ? a : ['platform'])].slice(0, 6); }; // منشور المجموعة الخاصة لا يُنشر معه في غيرها
const member = async (env, gid, uid) => !!(uid && await one(env, "SELECT 1 x FROM gmem WHERE gid = ? AND uid = ? AND st = 'm'", gid, uid));
const postGate = async (env, id, me) => { const r = await one(env, 'SELECT scopes FROM posts WHERE id = ? AND hidden = 0', id); if (!r) return 404; const g = /,group:(\d+),/.exec(r.scopes || ''); return !g || await member(env, +g[1], me && me.id) ? 0 : 403; };
function media(list) {
  const out = []; for (const m of Array.isArray(list) ? list.slice(0, 4) : []) {
    if (m && m.t === 'img' && typeof m.d === 'string' && m.d.length < 260000 && IMG.test(m.d)) out.push({ t: 'img', d: m.d });
    else if (m && m.t === 'vid' && typeof m.u === 'string' && /^https:\/\/[^\s"'<>]{4,300}$/.test(m.u)) out.push({ t: 'vid', u: m.u });
  } return out;
}
/** يضيف مرفقات الملفات المرفوعة (بعد التحقق أنها لصاحب المنشور ومكتملة وغير مرتبطة بمنشور) */
/** تفعيل R2 بزر المالك: يلزم ربط الحاوية FILES في Cloudflare ثم تفعيلها من «أدوات المالك»؛ الملفات القديمة تبقى حيث رُفعت */
const r2on = async (env) => !!env.FILES && ((await one(env, "SELECT v FROM cfg WHERE k = 'r2'")) || {}).v === '1';
async function withFiles(env, list, uid, out) {
  for (const m of Array.isArray(list) ? list : []) {
    if (out.length >= 4) break; if (!m || m.t !== 'file' || !FID.test(m.id || '')) continue;
    const f = await one(env, 'SELECT id, name, type, size, mode FROM files WHERE id = ? AND uid = ? AND done = 1 AND post = 0', m.id, uid); if (f) { const o = { t: 'file', id: f.id, name: f.name, type: f.type, size: f.size, mode: f.mode }; if (/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]{100,45000}$/.test(m.poster || '')) o.poster = m.poster; if (+m.ar >= 0.2 && +m.ar <= 5) o.ar = Math.round(+m.ar * 1000) / 1000; out.push(o); }
  } return out;
}
const dropFiles = async (env, post) => {
  for (const f of await rows(env, 'SELECT id, mode FROM files WHERE post = ?', post)) { await q(env, 'DELETE FROM fchunks WHERE fid = ?', f.id).run(); if (f.mode === 'r2' && env.FILES) { try { await env.FILES.delete('f/' + f.id); } catch (_) { /* لا شيء */ } } await q(env, 'DELETE FROM files WHERE id = ?', f.id).run(); }
};
/** حذف حساب وكل ما يخصه نهائياً (منشورات، تعليقات، ملفات، متابعات، صداقات، مجموعات يملكها) */
async function eraseUser(env, id) {
  const del = async (post) => { await dropFiles(env, post); await q(env, 'DELETE FROM comments WHERE post = ?', post).run(); await q(env, 'DELETE FROM reports WHERE post = ?', post).run(); await q(env, 'DELETE FROM posts WHERE id = ?', post).run(); };
  for (const g of await rows(env, 'SELECT id FROM groups WHERE owner = ?', id)) { for (const r of await rows(env, 'SELECT id FROM posts WHERE scopes = ?', ',group:' + g.id + ',')) await del(r.id); await q(env, 'DELETE FROM gmem WHERE gid = ?', g.id).run(); await q(env, 'DELETE FROM groups WHERE id = ?', g.id).run(); }
  for (const r of await rows(env, 'SELECT id FROM posts WHERE uid = ?', id)) await del(r.id);
  for (const f of await rows(env, 'SELECT id, mode FROM files WHERE uid = ?', id)) { await q(env, 'DELETE FROM fchunks WHERE fid = ?', f.id).run(); if (f.mode === 'r2' && env.FILES) { try { await env.FILES.delete('f/' + f.id); } catch (_) { /* لا شيء */ } } await q(env, 'DELETE FROM files WHERE id = ?', f.id).run(); }
  await q(env, 'DELETE FROM comments WHERE uid = ?', id).run(); await q(env, 'DELETE FROM reports WHERE uid = ?', id).run();
  await q(env, 'DELETE FROM follows WHERE a = ? OR b = ?', id, id).run(); await q(env, 'DELETE FROM friends WHERE a = ? OR b = ?', id, id).run(); await q(env, 'DELETE FROM gmem WHERE uid = ?', id).run();
  await q(env, 'DELETE FROM users WHERE id = ?', id).run();
}
const fenc = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fdec = (t) => Uint8Array.from(atob(t), (ch) => ch.charCodeAt(0));
async function shape(env, c, r, uid) {
  const out = []; for (const p of r) {
    const au = p.official ? { id: 0, name: 'العيسائي برو' } : await c.one(env, 'SELECT id, name, avts, kind FROM users WHERE id = ?', p.uid);
    out.push({ id: p.id, ts: p.ts, text: p.text, link: p.link, media: JSON.parse(p.media || '[]'), pin: !!p.pin, official: !!p.official, author: au ? { ...pub(au), kind: au.kind || 'person' } : { id: 0, name: 'محذوف' }, scopes: String(p.scopes || ',platform,').split(',').filter(Boolean), mine: !!uid && p.uid === uid, comments: (await c.one(env, 'SELECT COUNT(*) n FROM comments WHERE post = ? AND hidden = 0', p.id)).n });
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
    const r = await one(env, 'SELECT ' + ME + ' FROM users WHERE ident = ?', ident); return J({ token: await mint(env, r.id), user: mine(r) });
  }
  if (p === '/v1/auth/login' && m === 'POST') {
    const b = await body(req); if (!b) return J({ error: 'bad' }, 400); const ident = str(b.ident, 60).toLowerCase();
    const r = IDENT.test(ident) && typeof b.password === 'string' ? await one(env, 'SELECT * FROM users WHERE ident = ?', ident) : null;
    const ok = r ? c.same(await hashPw(b.password.slice(0, 100), r.salt), r.hash) : (await hashPw('x', 'AAAAAAAAAAAAAAAAAAAAAA'), false);
    if (!ok || r.banned) return J({ error: 'بيانات الدخول غير صحيحة' }, 401);
    return J({ token: await mint(env, r.id), user: mine(r) });
  }
  if (p === '/v1/posts' && m === 'GET') {
    const me = await who(req, env, c), before = Math.max(0, +u.searchParams.get('before') || 0) || 9e15, sp = u.searchParams;
    const author = +sp.get('author') || 0, scope = SCOPE.test(sp.get('scope') || '') ? sp.get('scope') : 'platform', qs = (sp.get('q') || '').replace(/[%_\\]/g, ' ').trim().slice(0, 60);
    let w = 'hidden = 0 AND id < ?'; const a = [before];
    const NG = " AND scopes NOT LIKE '%,group:%'";
    if (author > 0) { w += ' AND uid = ? AND official = 0' + NG; a.push(author); }
    else if (sp.get('feed') === 'following' && me) { w += ' AND (uid = ? OR uid IN (SELECT b FROM follows WHERE a = ?))' + NG; a.push(me.id, me.id); }
    else { const g = /^group:(\d+)$/.exec(scope); if (g && !(await member(env, +g[1], me && me.id))) return J({ error: 'مجموعة خاصة' }, 403); w += ' AND scopes LIKE ?'; a.push('%,' + scope + ',%'); }
    if (qs) { w += ' AND text LIKE ?'; a.push('%' + qs + '%'); }
    const r = await rows(env, 'SELECT * FROM posts WHERE ' + w + ' ORDER BY pin DESC, id DESC LIMIT 20', ...a);
    return J({ posts: await shape(env, c, r, me && me.id) });
  }
  if (p === '/v1/posts' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req, 700000); if (!b) return J({ error: 'bad' }, 400);
    const text = str(b.text, 3000), link = /^https?:\/\/[^\s"'<>]{4,300}$/.test(b.link || '') ? b.link : '', md = await withFiles(env, b.media, me.id, media(b.media));
    if (!text && !md.length) return J({ error: 'empty' }, 400);
    if ((await one(env, 'SELECT COUNT(*) n FROM posts WHERE uid = ? AND ts > ?', me.id, now - 3600000)).n >= 10) return J({ error: 'rate' }, 429);
    const sc = scopesOf(b.scopes), gm = /^group:(\d+)$/.exec(sc[0]); if (gm && !(await member(env, +gm[1], me.id))) return J({ error: 'لست عضواً في هذه المجموعة' }, 403);
    await q(env, 'INSERT INTO posts (uid, ts, text, link, media, scopes) VALUES (?,?,?,?,?,?)', me.id, now, text, link, JSON.stringify(md), ',' + sc.join(',') + ',').run();
    const id = (await one(env, 'SELECT MAX(id) n FROM posts WHERE uid = ?', me.id)).n;
    for (const f of md.filter((x) => x.t === 'file')) await q(env, 'UPDATE files SET post = ? WHERE id = ?', id, f.id).run();
    return J({ ok: true, id, scopes: sc });
  }
  // ----- الملف الشخصي والصفحات العامة والمتابعة والصداقة (2.11) -----
  if (p === '/v1/me' && m === 'GET') { const me = await who(req, env, c); return me ? J({ user: mine(me) }) : J({ error: 'سجّل الدخول أولاً' }, 401); }
  if (p === '/v1/me/delete' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req); const r = await one(env, 'SELECT salt, hash FROM users WHERE id = ?', me.id);
    if (!b || typeof b.password !== 'string' || !r || !c.same(await hashPw(b.password.slice(0, 100), r.salt), r.hash)) return J({ error: 'كلمة المرور غير صحيحة' }, 403);
    await eraseUser(env, me.id); return J({ ok: true });
  }
  if (p === '/v1/me' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req, 120000); if (!b) return J({ error: 'bad' }, 400);
    const name = b.name === undefined ? me.name : str(b.name, 40); if (name.length < 2) return J({ error: 'الاسم حرفان فأكثر' }, 400);
    const email = b.email === undefined ? me.email : str(b.email, 80), phone = b.phone === undefined ? me.phone : str(b.phone, 25);
    if (email && !/^[^\s@<>"']{1,60}@[^\s@<>"']{1,60}$/.test(email)) return J({ error: 'البريد غير صالح' }, 400);
    if (phone && !/^[\d+\s()-]{5,25}$/.test(phone)) return J({ error: 'رقم الهاتف غير صالح' }, 400);
    const bio = b.bio === undefined ? me.bio : str(b.bio, 600), kind = KINDS_U.includes(b.kind) ? b.kind : (me.kind || 'person'), showc = b.showc === undefined ? (me.showc ? 1 : 0) : (b.showc ? 1 : 0);
    const lk = b.links === undefined ? links(me.links) : links(b.links);
    let av = null, avts = me.avts || 0;
    if (b.av === '') { av = ''; avts = now; } else if (typeof b.av === 'string') { if (b.av.length > 90000 || !IMG.test(b.av)) return J({ error: 'الصورة غير صالحة أو كبيرة' }, 400); av = b.av; avts = now; }
    if (av === null) await q(env, 'UPDATE users SET name = ?, email = ?, phone = ?, bio = ?, kind = ?, showc = ?, links = ? WHERE id = ?', name, email, phone, bio, kind, showc, JSON.stringify(lk), me.id).run();
    else await q(env, 'UPDATE users SET name = ?, email = ?, phone = ?, bio = ?, kind = ?, showc = ?, links = ?, av = ?, avts = ? WHERE id = ?', name, email, phone, bio, kind, showc, JSON.stringify(lk), av, avts, me.id).run();
    return J({ ok: true, user: mine(await one(env, 'SELECT ' + ME + ' FROM users WHERE id = ?', me.id)) });
  }
  let mm = /^\/v1\/u\/(\d{1,12})\/av$/.exec(p);
  if (mm && m === 'GET') {
    const r = await one(env, 'SELECT av FROM users WHERE id = ? AND banned = 0', +mm[1]), x = r && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(r.av || '');
    if (!x) return new Response('', { status: 404, headers: H });
    return new Response(unb64(x[2]), { headers: { ...H, 'content-type': x[1], 'cache-control': 'public, max-age=86400' } });
  }
  if ((mm = /^\/v1\/u\/(\d{1,12})$/.exec(p)) && m === 'GET') {
    const me = await who(req, env, c), id = +mm[1], r = await one(env, 'SELECT ' + ME + ' FROM users WHERE id = ? AND banned = 0', id); if (!r) return J({ error: 'not found' }, 404);
    const o = { ...pub(r), bio: r.bio || '', kind: r.kind || 'person', links: links(r.links), joined: r.ts || 0 };
    if (r.showc) { o.email = r.email || ''; o.phone = r.phone || ''; }
    o.followers = (await one(env, 'SELECT COUNT(*) n FROM follows WHERE b = ?', id)).n; o.posts = (await one(env, 'SELECT COUNT(*) n FROM posts WHERE uid = ? AND hidden = 0', id)).n;
    if (me && me.id !== id) {
      o.following = !!(await one(env, 'SELECT 1 x FROM follows WHERE a = ? AND b = ?', me.id, id));
      const f = await one(env, 'SELECT a, st FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me.id, id, id, me.id);
      o.friend = !f ? 'none' : f.st === 'ok' ? 'friends' : f.a === me.id ? 'sent' : 'incoming';
    }
    return J({ user: o });
  }
  if ((mm = /^\/v1\/follow\/(\d{1,12})$/.exec(p)) && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401); const id = +mm[1], b = await body(req);
    if (id === me.id || !(await one(env, 'SELECT id FROM users WHERE id = ? AND banned = 0', id))) return J({ error: 'bad' }, 400);
    if (b && b.off) await q(env, 'DELETE FROM follows WHERE a = ? AND b = ?', me.id, id).run();
    else { if ((await one(env, 'SELECT COUNT(*) n FROM follows WHERE a = ?', me.id)).n >= 500) return J({ error: 'rate' }, 429); await q(env, 'INSERT OR IGNORE INTO follows (a, b, ts) VALUES (?,?,?)', me.id, id, now).run(); }
    return J({ ok: true, followers: (await one(env, 'SELECT COUNT(*) n FROM follows WHERE b = ?', id)).n });
  }
  if (p === '/v1/friends' && m === 'GET') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const shapeU = (x) => ({ id: x.id, name: x.name, av: x.avts || 0, kind: x.kind || 'person' });
    const inc = await rows(env, "SELECT u.id, u.name, u.avts, u.kind FROM friends f JOIN users u ON u.id = f.a WHERE f.b = ? AND f.st = 'p' AND u.banned = 0 ORDER BY f.ts DESC LIMIT 50", me.id);
    const fr = await rows(env, "SELECT u.id, u.name, u.avts, u.kind FROM friends f JOIN users u ON u.id = (CASE WHEN f.a = ? THEN f.b ELSE f.a END) WHERE (f.a = ? OR f.b = ?) AND f.st = 'ok' AND u.banned = 0 ORDER BY f.ts DESC LIMIT 200", me.id, me.id, me.id);
    return J({ incoming: inc.map(shapeU), friends: fr.map(shapeU) });
  }
  if ((mm = /^\/v1\/friend\/(\d{1,12})$/.exec(p)) && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401); const id = +mm[1], b = await body(req), op = b ? b.op : '';
    if (id === me.id || !(await one(env, 'SELECT id FROM users WHERE id = ? AND banned = 0', id))) return J({ error: 'bad' }, 400);
    if (op === 'send') {
      const f = await one(env, 'SELECT a, st FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me.id, id, id, me.id);
      if (f && f.st === 'p' && f.a === id) await q(env, "UPDATE friends SET st = 'ok', ts = ? WHERE a = ? AND b = ?", now, id, me.id).run();
      else if (!f) { if ((await one(env, 'SELECT COUNT(*) n FROM friends WHERE a = ? AND ts > ?', me.id, now - 864e5)).n >= 30) return J({ error: 'rate' }, 429); await q(env, "INSERT INTO friends (a, b, st, ts) VALUES (?,?,'p',?)", me.id, id, now).run(); }
    } else if (op === 'accept') await q(env, "UPDATE friends SET st = 'ok', ts = ? WHERE a = ? AND b = ? AND st = 'p'", now, id, me.id).run();
    else if (op === 'remove') await q(env, 'DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me.id, id, id, me.id).run();
    else return J({ error: 'bad' }, 400);
    return J({ ok: true });
  }
  // ----- الملفات: init → (قطع أو رفع واحد R2) → done -----
  if (p === '/v1/files' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req, 4000); if (!b) return J({ error: 'bad' }, 400); const mode = (await r2on(env)) ? 'r2' : 'd1', size = Math.floor(+b.size);
    const name = str(b.name, 120).replace(/[\\\\/:*?"<>|\x00-\x1f]/g, '_') || 'file', type = /^[\w.+-]{1,60}\/[\w.+-]{1,80}$/.test(b.type || '') ? b.type : 'application/octet-stream';
    if (BAD_EXT.test(name)) return J({ error: 'نوع الملف غير مسموح (ملفات تنفيذية أو صفحات ويب)' }, 400);
    if (!(size > 0) || size > LIM[mode]) return J({ error: 'الحد الأقصى للملف ' + Math.round(LIM[mode] / 1048576) + ' ميغابايت' + (mode === 'd1' ? ' (يزيد بربط R2)' : '') }, 413);
    for (const o of await rows(env, 'SELECT id, mode FROM files WHERE post = 0 AND ts < ? LIMIT 20', now - 86400000)) { await q(env, 'DELETE FROM fchunks WHERE fid = ?', o.id).run(); if (o.mode === 'r2' && env.FILES) { try { await env.FILES.delete('f/' + o.id); } catch (_) { /* لا شيء */ } } await q(env, 'DELETE FROM files WHERE id = ?', o.id).run(); } // تنظيف المرفوعات اليتيمة
    if ((await one(env, 'SELECT COUNT(*) n FROM files WHERE uid = ? AND ts > ?', me.id, now - 3600000)).n >= 30) return J({ error: 'rate' }, 429);
    if ((await one(env, 'SELECT COALESCE(SUM(size), 0) n FROM files WHERE uid = ?', me.id)).n + size > QUOTA[mode]) return J({ error: 'تجاوزت مساحة ملفاتك (' + Math.round(QUOTA[mode] / 1048576) + 'MB). احذف منشورات قديمة بملفات' }, 413);
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join(''), chunks = Math.ceil(size / CHUNK);
    await q(env, 'INSERT INTO files (id, uid, name, type, size, chunks, mode, done, post, ts) VALUES (?,?,?,?,?,?,?,0,0,?)', id, me.id, name, type, size, chunks, mode, now).run();
    return J({ ok: true, id, mode, chunk: CHUNK, chunks, name, type, size });
  }
  mm = /^\/v1\/files\/([0-9a-f]{32})(?:\/(up|done|\d{1,5}))?$/.exec(p);
  if (mm && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const f = await one(env, 'SELECT * FROM files WHERE id = ? AND uid = ? AND done = 0', mm[1], me.id); if (!f) return J({ error: 'not found' }, 404);
    if (mm[2] === 'up') {
      if (f.mode !== 'r2' || !env.FILES) return J({ error: 'bad' }, 400); if (+req.headers.get('content-length') !== f.size) return J({ error: 'الحجم لا يطابق' }, 400);
      await env.FILES.put('f/' + f.id, req.body, { httpMetadata: { contentType: f.type } }); const h = await env.FILES.head('f/' + f.id);
      if (!h || h.size !== f.size) { try { await env.FILES.delete('f/' + f.id); } catch (_) { /* لا شيء */ } return J({ error: 'لم يكتمل الرفع' }, 400); }
      await q(env, 'UPDATE files SET done = 1 WHERE id = ?', f.id).run(); return J({ ok: true, file: { id: f.id, name: f.name, type: f.type, size: f.size, mode: f.mode } });
    }
    if (f.mode !== 'd1') return J({ error: 'bad' }, 400);
    if (mm[2] === 'done') {
      if ((await one(env, 'SELECT COUNT(*) n FROM fchunks WHERE fid = ?', f.id)).n !== f.chunks) return J({ error: 'قطع ناقصة' }, 400);
      await q(env, 'UPDATE files SET done = 1 WHERE id = ?', f.id).run(); return J({ ok: true, file: { id: f.id, name: f.name, type: f.type, size: f.size, mode: f.mode } });
    }
    const n = +mm[2]; if (!(n >= 0 && n < f.chunks)) return J({ error: 'bad' }, 400);
    const buf = new Uint8Array(await req.arrayBuffer()), want = n === f.chunks - 1 ? f.size - n * CHUNK : CHUNK; if (buf.length !== want) return J({ error: 'حجم القطعة غير صحيح' }, 400);
    await q(env, 'INSERT OR REPLACE INTO fchunks (fid, n, data) VALUES (?,?,?)', f.id, n, fenc(buf)).run(); return J({ ok: true, n });
  }
  if (mm && m === 'GET') {
    const f = await one(env, 'SELECT * FROM files WHERE id = ? AND done = 1', mm[1]); if (!f) return J({ error: 'not found' }, 404);
    const safe = SAFE_VIEW.test(f.type), fn = encodeURIComponent(f.name), base = { ...H, 'x-content-type-options': 'nosniff', 'content-security-policy': "sandbox; default-src 'none'", 'cache-control': 'public, max-age=86400', 'access-control-expose-headers': 'content-range,accept-ranges,content-length,content-disposition' };
    if (mm[2] === undefined && u.searchParams.get('meta')) return J({ id: f.id, name: f.name, type: f.type, size: f.size, chunks: f.chunks, mode: f.mode });
    if (f.mode === 'd1') {
      if (mm[2] === undefined) return J({ id: f.id, name: f.name, type: f.type, size: f.size, chunks: f.chunks, mode: 'd1' });
      const r = await one(env, 'SELECT data FROM fchunks WHERE fid = ? AND n = ?', f.id, +mm[2]); if (!r) return J({ error: 'not found' }, 404);
      return new Response(fdec(r.data), { headers: { ...base, 'content-type': 'application/octet-stream' } });
    }
    if (!env.FILES) return J({ error: 'not found' }, 404);
    const rg = req.headers.get('range'), o = await env.FILES.get('f/' + f.id, rg ? { range: req.headers } : undefined); if (!o) return J({ error: 'not found' }, 404);
    const h = { ...base, 'content-type': safe ? f.type : 'application/octet-stream', 'content-disposition': (safe ? 'inline' : 'attachment') + "; filename*=UTF-8''" + fn, 'accept-ranges': 'bytes' };
    if (rg && o.range) { const off = o.range.offset || 0, len = o.range.length == null ? f.size - off : o.range.length; h['content-range'] = 'bytes ' + off + '-' + (off + len - 1) + '/' + f.size; h['content-length'] = String(len); return new Response(o.body, { status: 206, headers: h }); }
    h['content-length'] = String(f.size); return new Response(o.body, { headers: h });
  }
  if (mm && !mm[2] && m === 'DELETE') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const f = await one(env, 'SELECT id, mode FROM files WHERE id = ? AND uid = ? AND post = 0', mm[1], me.id); if (!f) return J({ error: 'not found' }, 404);
    await q(env, 'DELETE FROM fchunks WHERE fid = ?', f.id).run(); if (f.mode === 'r2' && env.FILES) { try { await env.FILES.delete('f/' + f.id); } catch (_) { /* لا شيء */ } } await q(env, 'DELETE FROM files WHERE id = ?', f.id).run(); return J({ ok: true });
  }
  // ----- المجموعات الخاصة (2.12): أعضاء فقط؛ الدعوة للأصدقاء؛ منشوراتها بنطاق group:<id> لا تظهر خارجها -----
  if (p === '/v1/groups' && m === 'GET') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const gs = await rows(env, "SELECT g.id, g.name, g.descr, g.owner, x.st, x.role, (SELECT COUNT(*) FROM gmem y WHERE y.gid = g.id AND y.st = 'm') n FROM gmem x JOIN groups g ON g.id = x.gid WHERE x.uid = ? ORDER BY g.id DESC LIMIT 100", me.id);
    const sh = (g) => ({ id: g.id, name: g.name, descr: g.descr || '', members: g.n, role: g.role, owner: g.owner });
    return J({ groups: gs.filter((g) => g.st === 'm').map(sh), invites: gs.filter((g) => g.st === 'i').map(sh) });
  }
  if (p === '/v1/groups' && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req), name = b ? str(b.name, 40) : '', descr = b ? str(b.descr, 200) : ''; if (name.length < 2) return J({ error: 'اسم المجموعة حرفان فأكثر' }, 400);
    if ((await one(env, 'SELECT COUNT(*) n FROM groups WHERE owner = ?', me.id)).n >= 10) return J({ error: 'الحد 10 مجموعات' }, 429);
    const r = await q(env, 'INSERT INTO groups (name, descr, owner, ts) VALUES (?,?,?,?)', name, descr, me.id, now).run(), id = r.meta && r.meta.last_row_id || (await one(env, 'SELECT MAX(id) id FROM groups')).id;
    await q(env, "INSERT INTO gmem (gid, uid, st, role, ts) VALUES (?,?,'m','o',?)", id, me.id, now).run(); return J({ ok: true, id });
  }
  mm = /^\/v1\/groups\/(\d{1,12})$/.exec(p);
  if (mm && m === 'GET') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401); const id = +mm[1];
    const g = await one(env, 'SELECT id, name, descr, owner FROM groups WHERE id = ?', id), x = g && await one(env, 'SELECT st FROM gmem WHERE gid = ? AND uid = ?', id, me.id);
    if (!g || !x) return J({ error: 'مجموعة خاصة' }, 403);
    if (x.st !== 'm') return J({ group: { id: g.id, name: g.name, descr: g.descr || '' }, invited: true });
    const ms = await rows(env, "SELECT u.id, u.name, u.avts, x.role, x.st FROM gmem x JOIN users u ON u.id = x.uid WHERE x.gid = ? AND u.banned = 0 ORDER BY x.role DESC, x.ts LIMIT 300", id);
    return J({ group: { id: g.id, name: g.name, descr: g.descr || '', owner: g.owner }, mine: g.owner === me.id, members: ms.filter((u) => u.st === 'm').map((u) => ({ id: u.id, name: u.name, av: u.avts || 0, role: u.role })), pending: g.owner === me.id ? ms.filter((u) => u.st === 'i').map((u) => ({ id: u.id, name: u.name })) : [] });
  }
  if (mm && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401); const id = +mm[1], b = await body(req), op = b ? b.op : '', uid = b ? +b.uid || 0 : 0;
    const g = await one(env, 'SELECT id, owner FROM groups WHERE id = ?', id), x = g && await one(env, 'SELECT st FROM gmem WHERE gid = ? AND uid = ?', id, me.id); if (!g || !x) return J({ error: 'مجموعة خاصة' }, 403);
    const own = g.owner === me.id;
    if (op === 'accept' && x.st === 'i') await q(env, "UPDATE gmem SET st = 'm', ts = ? WHERE gid = ? AND uid = ?", now, id, me.id).run();
    else if (op === 'decline' || (op === 'leave' && !own)) await q(env, 'DELETE FROM gmem WHERE gid = ? AND uid = ?', id, me.id).run();
    else if (x.st !== 'm') return J({ error: 'bad' }, 400);
    else if (op === 'invite') {
      if (!own) return J({ error: 'الدعوة لمالك المجموعة' }, 403);
      const f = await one(env, "SELECT 1 x FROM friends WHERE st = 'ok' AND ((a = ? AND b = ?) OR (a = ? AND b = ?))", me.id, uid, uid, me.id); if (!f) return J({ error: 'يمكنك دعوة أصدقائك فقط' }, 403);
      if ((await one(env, 'SELECT COUNT(*) n FROM gmem WHERE gid = ?', id)).n >= 200) return J({ error: 'اكتمل العدد' }, 429);
      await q(env, "INSERT OR IGNORE INTO gmem (gid, uid, st, role, ts) VALUES (?,?,'i','m',?)", id, uid, now).run();
    } else if (op === 'kick') { if (!own || uid === me.id) return J({ error: 'bad' }, 403); await q(env, 'DELETE FROM gmem WHERE gid = ? AND uid = ?', id, uid).run(); }
    else if (op === 'delete') {
      if (!own) return J({ error: 'لمالك المجموعة' }, 403);
      const ps = await rows(env, 'SELECT id FROM posts WHERE scopes = ?', ',group:' + id + ',');
      for (const r of ps) { await dropFiles(env, r.id); await q(env, 'DELETE FROM comments WHERE post = ?', r.id).run(); await q(env, 'DELETE FROM posts WHERE id = ?', r.id).run(); }
      await q(env, 'DELETE FROM gmem WHERE gid = ?', id).run(); await q(env, 'DELETE FROM groups WHERE id = ?', id).run();
    } else return J({ error: 'bad' }, 400);
    return J({ ok: true });
  }
  mm = /^\/v1\/posts\/(\d{1,12})$/.exec(p);
  if (mm && m === 'DELETE') {
    const me = await who(req, env, c), own = owner(req, env); if (!me && !own) return J({ error: 'unauthorized' }, 401);
    const r = await one(env, 'SELECT uid FROM posts WHERE id = ?', +mm[1]); if (!r) return J({ error: 'not found' }, 404);
    if (!own && r.uid !== me.id) return J({ error: 'forbidden' }, 403);
    await dropFiles(env, +mm[1]); await q(env, 'DELETE FROM posts WHERE id = ?', +mm[1]).run(); await q(env, 'DELETE FROM comments WHERE post = ?', +mm[1]).run(); return J({ ok: true });
  }
  mm = /^\/v1\/posts\/(\d{1,12})\/comments$/.exec(p);
  if (mm && m === 'GET') {
    const gt = await postGate(env, +mm[1], await who(req, env, c)); if (gt) return J({ error: gt === 404 ? 'not found' : 'مجموعة خاصة' }, gt);
    const r = await rows(env, 'SELECT c.id, c.ts, c.text, c.uid, u.name FROM comments c LEFT JOIN users u ON u.id = c.uid WHERE c.post = ? AND c.hidden = 0 ORDER BY c.id LIMIT 100', +mm[1]);
    return J({ comments: r.map((x) => ({ id: x.id, ts: x.ts, text: x.text, author: { id: x.uid, name: x.name || 'محذوف' } })) });
  }
  if (mm && m === 'POST') {
    const me = await who(req, env, c); if (!me) return J({ error: 'سجّل الدخول أولاً' }, 401);
    const b = await body(req), text = b ? str(b.text, 800) : ''; if (!text) return J({ error: 'empty' }, 400);
    { const gt = await postGate(env, +mm[1], me); if (gt) return J({ error: gt === 404 ? 'not found' : 'مجموعة خاصة' }, gt); }
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
      await q(env, "INSERT INTO posts (uid, ts, text, link, media, pin, official, scopes) VALUES (0,?,?,?,?,?,1,',platform,')", now, text, /^https?:\/\/[^\s"'<>]{4,300}$/.test(b.link || '') ? b.link : '', JSON.stringify(md), b.pin ? 1 : 0).run(); return J({ ok: true });
    }
    if (p === '/v1/admin/users') return J({ users: await rows(env, 'SELECT id, ident, name, ts, banned FROM users ORDER BY id DESC LIMIT 200'), reports: await rows(env, 'SELECT post, COUNT(*) n FROM reports GROUP BY post ORDER BY n DESC LIMIT 20') });
    if ((mm = /^\/v1\/admin\/ban\/(\d{1,12})$/.exec(p)) && m === 'POST') { const b = await body(req); await q(env, 'UPDATE users SET banned = ? WHERE id = ?', b && b.off ? 0 : 1, +mm[1]).run(); return J({ ok: true }); }
    if ((mm = /^\/v1\/admin\/deluser\/(\d{1,12})$/.exec(p)) && m === 'POST') { if (!(await one(env, 'SELECT id FROM users WHERE id = ?', +mm[1]))) return J({ error: 'not found' }, 404); await eraseUser(env, +mm[1]); return J({ ok: true }); }
    if ((mm = /^\/v1\/admin\/delpost\/(\d{1,12})$/.exec(p)) && m === 'POST') { if (!(await one(env, 'SELECT id FROM posts WHERE id = ?', +mm[1]))) return J({ error: 'not found' }, 404); await dropFiles(env, +mm[1]); await q(env, 'DELETE FROM comments WHERE post = ?', +mm[1]).run(); await q(env, 'DELETE FROM reports WHERE post = ?', +mm[1]).run(); await q(env, 'DELETE FROM posts WHERE id = ?', +mm[1]).run(); return J({ ok: true }); }
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
    for (const s of MIGRATE) { try { await q(env, s).run(); } catch (_) { /* العمود موجود */ } }
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
        if (p === '/v1/admin/storage') {
          if (req.method === 'POST') { const b = await body(req, 500); if (!b || typeof b.on !== 'boolean') return J({ error: 'bad' }, 400); if (b.on && !env.FILES) return J({ error: 'لم تُربط حاوية R2 باسم FILES في Cloudflare بعد' }, 400); await q(env, "INSERT OR REPLACE INTO cfg (k, v) VALUES ('r2', ?)", b.on ? '1' : '0').run(); }
          return J({ bound: !!env.FILES, on: await r2on(env), limitMB: { d1: LIM.d1 / 1048576, r2: LIM.r2 / 1048576 } });
        }
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
