/* الأمان: تجزئة كلمة المرور (PBKDF2 + salt) وتشفير النسخ الاحتياطية (AES-GCM) */
(function () {
  const enc = new TextEncoder();
  const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
  const PBKDF2_ITER = 210000;
  const FALLBACK_ITER = 60000;

  const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
  const toB64 = (buf) => { let s = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s); };
  const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

  // SHA-256 بالجافاسكربت: احتياطي للسياقات غير الآمنة (http / file) حيث لا تتوفر WebCrypto
  function sha256(msg) {
    const H = [], K = []; let n = 0;
    for (let c = 2; n < 64; c++) {
      let p = true; for (let i = 2; i * i <= c; i++) if (c % i === 0) { p = false; break; }
      if (p) { if (n < 8) H[n] = (Math.pow(c, 0.5) % 1) * 4294967296 | 0; K[n++] = (Math.pow(c, 1 / 3) % 1) * 4294967296 | 0; }
    }
    const l = msg.length, total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(msg); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(l / 0x20000000)); dv.setUint32(total - 4, (l << 3) >>> 0);
    const w = new Int32Array(64); let h = H.slice();
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a | 0, h[1] + b | 0, h[2] + c | 0, h[3] + d | 0, h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer);
    h.forEach((v, i) => odv.setUint32(i * 4, v >>> 0));
    return out;
  }

  const concat = (...arrs) => { const o = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0)); let p = 0;
    arrs.forEach((a) => { o.set(a, p); p += a.length; }); return o; };

  async function derive(pw, algo, iter, saltHex) {
    const salt = fromHex(saltHex);
    if (algo === 'pbkdf2-sha256') {
      if (!subtle) throw new Error('secure-context-required');
      const key = await subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      return toHex(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
    }
    if (algo === 'sha256-iter') {
      let d = concat(salt, enc.encode(pw));
      for (let i = 0; i < iter; i++) d = sha256(concat(d, salt));
      return toHex(d);
    }
    throw new Error('unknown-algo');
  }

  const eq = (a, b) => { if (a.length !== b.length) return false; let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

  const COMMON = ['1234', '12345', '123456', '1234567', '12345678', '0000', '1111', 'password', 'admin', 'qwerty', 'alaisai', '111111', '000000'];

  const Sec = {
    subtle: !!subtle,
    sha256,
    rand: (n = 16) => toHex(crypto.getRandomValues(new Uint8Array(n))),

    passwordIssue(pw) {
      if (typeof pw !== 'string' || pw.length < 6) return 'كلمة المرور يجب ألا تقل عن 6 أحرف';
      if (COMMON.includes(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return 'كلمة المرور شائعة وضعيفة، اختر غيرها';
      return null;
    },

    async hash(pw) {
      const salt = Sec.rand(16);
      const algo = subtle ? 'pbkdf2-sha256' : 'sha256-iter';
      const iter = subtle ? PBKDF2_ITER : FALLBACK_ITER;
      return { algo, iter, salt, hash: await derive(pw, algo, iter, salt) };
    },

    isHashRecord: (r) => !!r && typeof r === 'object' && ['pbkdf2-sha256', 'sha256-iter'].includes(r.algo) &&
      Number.isInteger(r.iter) && r.iter > 0 && r.iter <= 1e6 &&
      /^[0-9a-f]{16,128}$/.test(r.salt || '') && /^[0-9a-f]{64}$/.test(r.hash || ''),

    async verify(pw, rec) {
      if (!Sec.isHashRecord(rec)) return false;
      return eq(await derive(pw, rec.algo, rec.iter, rec.salt), rec.hash);
    },

    b64: toB64, unb64: fromB64,
    textToB64: (t) => toB64(enc.encode(t)),
    b64ToText: (b) => new TextDecoder().decode(fromB64(b)),

    // مفتاح الجهاز: AES-GCM غير قابل للاستخراج، يُحفظ في IndexedDB لتشفير الأسرار (مثل رمز GitHub)
    async newDeviceKey() {
      if (!subtle) throw new Error('secure-context-required');
      return subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },
    async seal(key, text) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      return { iv: toB64(iv), data: toB64(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))) };
    },
    async open(key, rec) {
      return new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(rec.iv) }, key, fromB64(rec.data)));
    },

    // تشفير نسخة احتياطية بعبارة مرور
    async encrypt(text, pass) {
      if (!subtle) throw new Error('secure-context-required');
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const km = await subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
      const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, km,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
      return { format: 'alaisai-backup', version: 2, encrypted: true, kdf: 'pbkdf2-sha256', iter: PBKDF2_ITER,
        salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
    },
    async decrypt(env, pass) {
      if (!subtle) throw new Error('secure-context-required');
      if (!env || env.iter > 1e6 || !env.salt || !env.iv || !env.data) throw new Error('bad-envelope');
      const km = await subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
      const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(env.salt), iterations: env.iter }, km,
        { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, key, fromB64(env.data));
      return new TextDecoder().decode(pt);
    },
  };

  window.Sec = Sec;
})();
