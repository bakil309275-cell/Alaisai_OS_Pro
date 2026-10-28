/* ملف الخدمة: تخزين الأصل للعمل دون اتصال + تحديث تلقائي بالإصدار */
const VERSION = 'v2.1.2';
const CACHE = 'maktabat-alaisai-' + VERSION;
const CORE = [
  './', './index.html', './privacy.html', './manifest.json', './css/style.css',
  './js/app.js', './js/lib.js', './js/db.js', './js/crypto.js', './js/ui.js', './js/sanitize.js', './js/github.js', './js/sw-register.js',
  './icons/icon-192x192.png', './icons/icon-512x512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('maktabat-alaisai-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // لا نعترض GitHub API

  // البيانات المنشورة: الشبكة أولاً ثم النسخة المخزنة
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone())); return r; }).catch(() => caches.match(req)));
    return;
  }
  // الصفحات: الشبكة أولاً (لضمان أحدث نسخة) مع بديل مخزّن
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html'))));
    return;
  }
  // الأصول: مخزّن أولاً مع تحديث في الخلفية
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
