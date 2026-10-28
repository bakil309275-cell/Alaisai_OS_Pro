/* التشفير الحقيقي: PBKDF2 لتجزئة كلمة المرور + AES-GCM لتشفير النسخ والرمز */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64enc(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
export function b64dec(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function baseKey(password) {
  return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}

const ITER = 250000;

/* تجزئة كلمة المرور للتحقق فقط (لا تُخزَّن كلمة المرور نفسها أبداً) */
export async function hashPassword(password, saltB64, iter = ITER) {
  const salt = saltB64 ? b64dec(saltB64) : rand(16);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    await baseKey(password),
    256
  );
  return { salt: b64enc(salt), hash: b64enc(new Uint8Array(bits)), iter };
}

export async function verifyPassword(password, rec) {
  if (!rec) return false;
  const r = await hashPassword(password, rec.salt, rec.iter);
  // مقارنة بزمن ثابت تقريباً
  let diff = r.hash.length ^ rec.hash.length;
  for (let i = 0; i < r.hash.length; i++) diff |= r.hash.charCodeAt(i) ^ (rec.hash.charCodeAt(i) || 0);
  return diff === 0;
}

async function aesKey(password, salt, iter) {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    await baseKey(password),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/* تشفير بايتات أو نص → كائن JSON قابل للحفظ */
export async function encrypt(data, password) {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  const salt = rand(16);
  const iv = rand(12);
  const key = await aesKey(password, salt, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { alaisai: 1, alg: 'AES-GCM-256', kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64enc(salt), iv: b64enc(iv), data: b64enc(ct) };
}

export async function decrypt(pkg, password) {
  try {
    const key = await aesKey(password, b64dec(pkg.salt), pkg.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64dec(pkg.iv) }, key, b64dec(pkg.data));
    return new Uint8Array(pt);
  } catch {
    throw new Error('كلمة المرور/عبارة التشفير غير صحيحة أو الملف تالف');
  }
}
export const decryptText = async (pkg, pw) => dec.decode(await decrypt(pkg, pw));
