/**
 * Alaisai OS - Service Worker 2026 (محسّن)
 * وظيفة الملف: ضمان العمل بدون إنترنت وتخزين ملفات النظام
 */

const CACHE_NAME = 'alaisai-ultra-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './assets/images/icon-72.png',
    './assets/images/icon-128.png',
    './assets/images/icon-144.png',
    './assets/images/icon-152.png',
    './assets/images/icon-192.png',
    './assets/images/icon-384.png',
    './assets/images/icon-512.png',
    './assets/css/themes.css',
    './assets/css/animations.css',
    './system/core/core.js',
    './system/core/database.js',
    './system/core/security.js',
    './system/core/api.js',
    './system/core/addons-manager.js',
    './system/ui/i18n.js',
    './system/ui/ui-kit.js',
    './system/ui/components.js',
    './system/ui/file-manager.js',
    './system/ui/validators.js',
    './system/ui/helpers.js',
    './system/ui/formatters.js'
];

// مرحلة التثبيت
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('🛡️ Alaisai Cache: تخزين ملفات النظام');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// مرحلة التنشيط: مسح الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// استراتيجية الجلب: كاش أولاً ثم الشبكة
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});