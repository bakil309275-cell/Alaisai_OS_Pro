/* تحديث تطبيق أندرويد المغلَّف (Capacitor) من المستودع دون إعادة بناء APK.
 * التطبيق يحمل ملفاته داخله ويعمل منها (دون متصفح). عند وجود إنترنت يقارن release-manifest.json المنشور
 * بنسخته ويحمّل الملفات المتغيّرة فقط إلى مخزن «alaisai-ota» فيخدمها Service Worker قبل الملفات المضمَّنة.
 * إن تعطّل التطبيق مباشرة بعد تحديث يرجع تلقائياً إلى الملفات المضمَّنة (تراجع آمن). لا أثر في المتصفح العادي. */
(function () {
  'use strict';
  const NATIVE = location.hostname === 'localhost' && location.protocol === 'https:' && (window.Capacitor || window.NATIVE_FORCE);
  window.NativeUpdate = { native: !!NATIVE };
  if (!NATIVE) return;
  const REMOTE = (window.NATIVE_REMOTE || 'https://bakil309275-cell.github.io/Alaisai_OS_Pro/').replace(/\/?$/, '/'), OTA = 'alaisai-ota';
  const OK = /^(index\.html|manifest\.json|privacy\.html|terms\.html|assets\/|src\/|catalog\/|addons\/|promo\/|store\/)/;
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { /* لا شيء */ } return null; };

  // تراجع آمن: إن بقي علم الإقلاع (لم يعش التطبيق 10 ثوانٍ بعد تحديث) نحذف التحديثات ونعود للمضمَّن
  (async () => {
    if (ls('ota_boot') === '1') { await caches.delete(OTA); ls('ota_boot', null); ls('ota_ver', null); ls('ota_fail', String(Date.now())); location.reload(); return; }
    if (ls('ota_ver')) { ls('ota_boot', '1'); setTimeout(() => ls('ota_boot', null), 10000); }
  })();

  async function localManifest() {
    const c = await caches.open(OTA), hit = await c.match('release-manifest.json');
    if (hit) return hit.json();
    const r = await fetch('release-manifest.json', { cache: 'no-store' }); return r.ok ? r.json() : null;
  }
  async function check(manual) {
    if (!navigator.onLine) return { state: 'offline' };
    let rem; try { const r = await fetch(REMOTE + 'release-manifest.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw 0; rem = await r.json(); } catch (_) { return { state: 'error' }; }
    if (!rem || !rem.files) return { state: 'error' };
    const loc = (await localManifest()) || { version: '', files: {} };
    const todo = Object.keys(rem.files).filter((p) => OK.test(p) && loc.files[p] !== rem.files[p]);
    if (!todo.length) return { state: 'current', version: rem.version };
    if (todo.length > 400) return { state: 'error' };
    const staged = []; let i = 0, bad = false;
    await Promise.all(Array.from({ length: 6 }, async () => { while (i < todo.length && !bad) { const p = todo[i++]; try { const r = await fetch(REMOTE + p, { cache: 'no-store' }); if (!r.ok) throw 0; staged.push([p, await r.blob(), r.headers.get('content-type')]); } catch (_) { bad = true; } } }));
    if (bad) return { state: 'error' };
    const c = await caches.open(OTA);
    for (const [p, b, t] of staged) { const rs = new Response(b, { headers: { 'content-type': t || 'application/octet-stream' } }); await c.put(new Request(new URL(p, location.origin + '/')), rs); if (p === 'index.html') await c.put(new Request(new URL('./', location.origin + '/')), new Response(b, { headers: { 'content-type': 'text/html; charset=utf-8' } })); }
    await c.put('release-manifest.json', new Response(JSON.stringify(rem), { headers: { 'content-type': 'application/json' } }));
    ls('ota_ver', rem.version || '1'); ls('ota_boot', null); ls('ota_last', String(Date.now()));
    return { state: 'updated', version: rem.version, n: staged.length };
  }
  window.NativeUpdate.check = check;
  window.NativeUpdate.run = async function () {
    const r = await check(); if (r.state === 'updated') {
      const t = window.UI && UI.toast ? UI.toast('⬆️ تم تنزيل تحديث التطبيق (' + (r.version || '') + ')', 'success', 30000) : null;
      if (t) { const b = document.createElement('button'); b.className = 'btn btn-sm btn-primary'; b.textContent = 'إعادة التشغيل'; b.onclick = () => location.reload(); t.appendChild(b); } else location.reload();
    } return r;
  };
  // عند الإقلاع (بعد هدوء التحميل) ثم عند العودة للتطبيق
  const go = () => { const last = +ls('ota_chk') || 0; if (Date.now() - last < 3 * 3600000) return; ls('ota_chk', String(Date.now())); window.NativeUpdate.run().catch(() => {}); };
  window.addEventListener('load', () => setTimeout(go, 4000));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
})();
