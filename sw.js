/* Alaisai OS - Service Worker
 * غيّر VERSION عند كل إصدار ليصل التحديث للمستخدمين. */
const VERSION = '2.3.0';
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
  './src/security.js',
  './src/storage.js',
  './src/apps.js',
  './src/addons.js',
  './src/catalog.js',
  './src/repo-addons.js',
  './src/sync.js',
  './src/explorer.js',
  './src/admin.js',
  './src/main.js',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/apple-touch-icon.png',
  './privacy.html',
  './terms.html',
  './catalog/index.json',
  './catalog/addons/calculator.alaisai-addon.json',
  './catalog/addons/timer.alaisai-addon.json',
  './catalog/addons/todo.alaisai-addon.json',
  './catalog/addons/tasbih.alaisai-addon.json',
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
  event.respondWith(staleWhileRevalidate(req, CACHE));
});
