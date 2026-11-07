/* مولّد رمز QR مدمج (وضع البايتات، تصحيح أخطاء M، الإصدارات 1 إلى 10 = حتى 213 بايتاً). بلا اعتماد خارجي. */
(function () {
  'use strict';
  // [بايتات تصحيح لكل كتلة، كتل المجموعة 1، بيانات الكتلة، كتل المجموعة 2، بيانات الكتلة] — مستوى M
  const EC = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rs(data, n) {
    let g = [1];
    for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, EXP[i]); }); g = ng; }
    const r = new Array(n).fill(0);
    data.forEach((d) => { const f = d ^ r[0]; r.shift(); r.push(0); if (f) g.slice(1).forEach((c, j) => { r[j] ^= mul(c, f); }); });
    return r;
  }
  const utf8 = (s) => Array.from(new TextEncoder().encode(s));
  const bch = (v, g, gl) => { let r = v << (gl - 1); const top = (x) => 31 - Math.clz32(x); for (let i = top(r); i >= gl - 1; i--) if (r >> i & 1) r ^= g << (i - (gl - 1)); return (v << (gl - 1)) | r; };
  function build(bytes, ver) {
    const [ecn, g1, d1, g2, d2] = EC[ver], cap = g1 * d1 + g2 * d2, bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push(v >> i & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
    for (let i = 0; i < 4 && bits.length < cap * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; cw.length < cap; p++) cw.push(p % 2 ? 0x11 : 0xec);
    const blocks = []; let o = 0;
    for (let b = 0; b < g1 + g2; b++) { const n = b < g1 ? d1 : d2; blocks.push(cw.slice(o, o + n)); o += n; }
    const ecs = blocks.map((b) => rs(b, ecn)), out = [];
    for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < ecn; i++) ecs.forEach((e) => out.push(e[i]));
    return out;
  }
  function matrix(text) {
    const bytes = utf8(String(text)); let ver = 0;
    for (let v = 1; v <= 10; v++) { const c = EC[v][1] * EC[v][2] + EC[v][3] * EC[v][4]; if (bytes.length + 2 + (v < 10 ? 0 : 1) <= c) { ver = v; break; } }
    if (!ver) throw new Error('النص أطول من أن يُحوَّل إلى QR');
    const N = 17 + 4 * ver, data = build(bytes, ver), M = [], R = [];
    for (let i = 0; i < N; i++) { M.push(new Array(N).fill(false)); R.push(new Array(N).fill(false)); }
    const set = (x, y, v) => { M[y][x] = v; R[y][x] = true; };
    const finder = (cx, cy) => { for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue; const on = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)); set(x, y, on); } };
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    for (let i = 8; i < N - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    const al = ALIGN[ver]; al.forEach((cy) => al.forEach((cx) => { if ((cx < 9 && cy < 9) || (cx < 9 && cy > N - 10) || (cx > N - 10 && cy < 9)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    set(8, N - 8, true);
    for (let i = 0; i < 9; i++) { if (!R[8][i]) set(i, 8, false); if (!R[i][8]) set(8, i, false); }
    for (let i = 0; i < 8; i++) { if (!R[8][N - 1 - i]) set(N - 1 - i, 8, false); if (!R[N - 1 - i][8]) set(8, N - 1 - i, false); }
    if (ver >= 7) { const vi = bch(ver, 0x1f25, 13); for (let i = 0; i < 18; i++) { const b = (vi >> i & 1) === 1, a = Math.floor(i / 3), c = i % 3 + N - 11; set(c, a, b); set(a, c, b); } }
    // وضع البيانات بتعرّج من اليمين السفلي
    const bitsArr = []; data.forEach((b) => { for (let i = 7; i >= 0; i--) bitsArr.push(b >> i & 1); });
    const place = []; let up = true, bi = 0;
    for (let x = N - 1; x > 0; x -= 2) { if (x === 6) x--; for (let k = 0; k < N; k++) { const y = up ? N - 1 - k : k; for (let dx = 0; dx < 2; dx++) { const xx = x - dx; if (!R[y][xx]) { place.push([xx, y, bi < bitsArr.length ? bitsArr[bi++] === 1 : false]); } } } up = !up; }
    const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const withMask = (m) => {
      const G = M.map((r) => r.slice()); place.forEach(([x, y, v]) => { G[y][x] = v !== masks[m](x, y); });
      const f = bch(m, 0x537, 11) ^ 0x5412, fb = (i) => (f >> i & 1) === 1;  // M = 00
      for (let i = 0; i < 6; i++) G[i][8] = fb(i); G[7][8] = fb(6); G[8][8] = fb(7); G[8][7] = fb(8); for (let i = 9; i < 15; i++) G[8][14 - i] = fb(i);
      for (let i = 0; i < 8; i++) G[8][N - 1 - i] = fb(i); for (let i = 8; i < 15; i++) G[N - 15 + i][8] = fb(i);
      G[N - 8][8] = true; return G;
    };
    const penalty = (G) => {
      let p = 0;
      const runs = (get) => { for (let a = 0; a < N; a++) { let run = 1; for (let b = 1; b < N; b++) { if (get(a, b) === get(a, b - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } } if (run >= 5) p += run - 2; } };
      runs((a, b) => G[a][b]); runs((a, b) => G[b][a]);
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const v = G[y][x]; if (v === G[y][x + 1] && v === G[y + 1][x] && v === G[y + 1][x + 1]) p += 3; }
      const pat = [true, false, true, true, true, false, true, false, false, false, false], pat2 = pat.slice().reverse();
      const find = (get) => { for (let a = 0; a < N; a++) for (let b = 0; b <= N - 11; b++) { let m1 = true, m2 = true; for (let k = 0; k < 11; k++) { const v = get(a, b + k); if (v !== pat[k]) m1 = false; if (v !== pat2[k]) m2 = false; } if (m1 || m2) p += 40; } };
      find((a, b) => G[a][b]); find((a, b) => G[b][a]);
      let dark = 0; G.forEach((r) => r.forEach((v) => { if (v) dark++; })); p += Math.floor(Math.abs(dark * 100 / (N * N) - 50) / 5) * 10;
      return p;
    };
    let best = null, bp = Infinity; for (let m = 0; m < 8; m++) { const G = withMask(m), p = penalty(G); if (p < bp) { bp = p; best = G; } }
    return best;
  }
  /** يرسم الرمز على canvas بحجم (N + 2*margin) * scale */
  function draw(canvas, text, scale = 8, margin = 4) {
    const m = matrix(text), n = m.length, s = (n + margin * 2) * scale; canvas.width = canvas.height = s;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#000';
    m.forEach((row, y) => row.forEach((v, x) => { if (v) c.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale); }));
    return canvas;
  }
  const api = { matrix, draw };
  if (typeof window !== 'undefined') window.QR = api; if (typeof module !== 'undefined') module.exports = api;
})();
