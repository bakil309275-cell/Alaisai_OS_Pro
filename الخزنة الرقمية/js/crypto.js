'use strict';
/* ===== التشفير: PBKDF2 (SHA-256) ← مفتاح AES-GCM 256، ولا يُحفظ شيء غير مشفّر سوى عنوان الخزنة ===== */
const te = new TextEncoder(), td = new TextDecoder();
const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITER = 250000;
async function deriveKey(pass, salt, it) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function sealWith(key, salt, it, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  return { v: 1, it, s: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function openWith(key, rec) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.ct));
  return JSON.parse(td.decode(pt));
}
function strength(p) {
  let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w\s]/.test(p)) s++;
  return Math.min(4, Math.max(p.length ? 1 : 0, s - (p.length < 6 ? 1 : 0)));
}
function genPass(n = 18) {
  const set = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?', r = crypto.getRandomValues(new Uint32Array(n)); let o = '';
  for (let i = 0; i < n; i++) o += set[r[i] % set.length]; return o;
}
