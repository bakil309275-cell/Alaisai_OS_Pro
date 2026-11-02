# هيكل المشروع (الإصدار 2.4)

```
index.html              الهيكل (سطح المكتب)
manifest.json, sw.js    PWA: التثبيت والعمل دون اتصال والتحديث
assets/                 الأنماط (css) والخطوط والصور واللقطات
src/                    كود التطبيق:
  version.js            رقم الإصدار وسجل التغييرات
  ui.js                 حوارات وتنبيهات وسمات
  security.js           تجزئة كلمة المرور والتشفير
  storage.js            IndexedDB والتحقق والنسخ الاحتياطي
  apps.js               عارض التطبيقات المعزول وجسر Alaisai
  addons.js             الإضافات: التثبيت والتصدير والاستيراد
  catalog.js            متجر الإضافات
  repo-addons.js        ربط الإضافات بمجلد addons/ في المستودع
  sync.js               مزامنة GitHub المشفّرة
  explorer.js           مستكشف الملفات وبيئة التجربة
  admin.js              لوحة الإدارة
  main.js               النواة
addons/<الاسم>/         إضافات المستودع: manifest.json + index.html (+ main.js, style.css)
catalog/                الكتالوج العام (يُبنى بـ node tools/build-catalog.mjs من addons/ ومن catalog/src إن وُجد)
tools/                  أدوات البناء
tests/                  الاختبارات
docs/                   دليل المالك (لا يقرؤه التطبيق)
store/                  ملفات النشر في المتاجر
.github/workflows/      الاختبارات والنشر على GitHub Pages
```

