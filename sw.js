/* Alaisai OS - Service Worker
 * غيّر VERSION عند كل إصدار ليصل التحديث للمستخدمين. */
const VERSION = '2.10.0';
const BUILD = 'dev'; // يستبدله سير العمل برمز الإيداع عند النشر ليصل التحديث للجميع
const CACHE = `alaisai-${VERSION}-${BUILD}`;
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './assets/css/app.css',
  './assets/fonts/tajawal-400.woff2',
  './assets/fonts/tajawal-500.woff2',
  './assets/fonts/tajawal-700.woff2',
  './src/theme-boot.js',
  './src/version.js',
  './src/ui.js',
  './src/tree.js',
  './src/security.js',
  './src/storage.js',
  './src/vault.js',
  './src/apps.js',
  './src/addons.js',
  './src/catalog.js',
  './src/repo-addons.js',
  './src/sync.js',
  './src/control.js',
  './src/community.js',
  './src/cloud.js',
  './src/qr.js',
  './src/share.js',
  './src/uploader.js',
  './src/gitflash.js',
  './src/explorer.js',
  './src/admin.js',
  './src/main.js',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/apple-touch-icon.png',
  './privacy.html',
  './terms.html',
  './catalog/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // إضافة كل ملف على حدة: فشل ملف واحد لا يُفشل التثبيت كله
    await Promise.allSettled(CORE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== location.origin) return; // باقي الطلبات الخارجية (المتصفح المدمج...) لا نتدخل فيها

  // التنقل: الشبكة أولاً ثم الكاش (لتصل التحديثات)، ومنه صفحة index دون اتصال
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE); c.put('./index.html', res.clone()); return res;
      } catch (_) { return (await caches.match('./index.html')) || Response.error(); }
    })());
    return;
  }
  // فهرس المتجر: الشبكة أولاً كي يختفي المحذوف فوراً، وبالكاش عند انقطاع الاتصال
  if (url.pathname.endsWith('/catalog/index.json') || url.pathname.endsWith('/control/channel.json')) {
    event.respondWith((async () => {
      try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) (await caches.open(CACHE)).put(req, res.clone()); return res; }
      catch (_) { return (await caches.match(req)) || Response.error(); }
    })());
    return;
  }
  event.respondWith(staleWhileRevalidate(req, CACHE));
});

// ---------- تنبيهات الإعلانات (بلا خادم): مزامنة دورية في الخلفية على أندرويد للتطبيق المثبّت ----------
async function checkChannel() {
  try {
    const r = await fetch('./control/channel.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const ch = await r.json(); if (!ch || ch.format !== 'alaisai-channel' || !Array.isArray(ch.items)) return;
    const store = await caches.open('alaisai-notify'), hit = await store.match('last'), now = Date.now();
    const last = hit ? Number(await hit.text()) || 0 : 0;
    const fresh = ch.items.filter((i) => i.aud === 'all' && i.title && !i.arch && (!i.expires || i.expires > now) && (i.created || 0) > last).sort((a, b) => b.created - a.created);
    if (hit) for (const i of fresh.slice(0, 3)) await self.registration.showNotification(String(i.title).slice(0, 80), { body: String(i.body || '').slice(0, 140), tag: 'ch-' + i.id, lang: 'ar', dir: 'rtl', icon: './assets/images/icon-192.png', data: { url: './?news=1' } });
    await store.put('last', new Response(String(Math.max(last, now))));
  } catch (_) { /* لا شيء */ }
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'alaisai-channel') e.waitUntil(checkChannel()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); try { c.postMessage({ alaisai: 'news' }); } catch (_) { /* لا شيء */ } return; } }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
