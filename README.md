# العيسائي برو (Alaisai OS Pro)

سطح مكتب تطبيقات يعمل في المتصفح ودون اتصال (PWA)، بياناتك عندك وحدك.

## التشغيل
```bash
python3 -m http.server 8765   # ثم افتح http://localhost:8765
```
(ميزات التشفير وService Worker تتطلب HTTPS أو localhost.)

## الميزات
- **الإضافات الحقيقية**: مجلد (`manifest.json` + `index.html` + `main.js` + `style.css`) يتحوّل إلى تطبيق على سطح المكتب يعمل في بيئة معزولة، ويستخدم واجهة `Alaisai` (`toast/get/set/remove/keys`). تصدير/استيراد كملف `.alaisai-addon.json`.
- **متجر الإضافات**: `catalog/` (4 إضافات جاهزة). أضف إضافة جديدة في `catalog/src/<id>/` ثم `node tools/build-catalog.mjs`، فتصل لكل المستخدمين مع تحديثاتها.
- **مزامنة GitHub**: نسخة مشفّرة (AES-GCM) في مستودع خاص، يدوية أو تلقائية، مع كشف التعارضات.
- **الأمان**: كلمة مرور مجزّأة، sandbox لكل تطبيق، نسخ احتياطي دوّار ومشفّر.
- **PWA/المتاجر**: انظر [`STORE_GUIDE.md`](STORE_GUIDE.md).

## كتابة إضافة
```js
// main.js داخل الإضافة
const n = ((await Alaisai.get("opens")) || 0) + 1;   // تخزين خاص بالإضافة (256KB)
await Alaisai.set("opens", n);
Alaisai.toast("أهلاً");                               // إشعار
Alaisai.env.theme;                                    // "dark" | "light"
```
متغيرات CSS جاهزة: `--bg --fg --muted --card --line --accent --accent-fg --danger`.

## الاختبارات
```bash
node tests/run.mjs                      # وحدات
python3 -m http.server 8765 &           # ثم:
python3 tests/e2e.py                    # المتصفح: الأساسيات والأمان
python3 tests/e2e2.py                   # الإضافات والمتجر والمزامنة (GitHub وهمي)
python3 tests/audit.py                  # تثبيت، SEO، وصول، أداء
```

## الهيكل
`index.html` · `assets/{css,fonts,images,screenshots}` · `src/*.js` · `catalog/` · `tools/` · `store/` · `tests/` · `.github/workflows/`

## الإضافات والمستودع (v2.2)
- **من التطبيق إلى المستودع:** مع كل مزامنة تُنشر ملفات إضافاتك (غير المشفّرة) في `addons/<الاسم>/`. يمكن إيقاف ذلك من لوحة المزامنة.
- **من المستودع إلى التطبيق:** ضع مجلداً فيه `manifest.json` و`index.html` داخل `addons/<الاسم>/` فيظهر في «متجر الإضافات» بشارة «جديد».
- **لكل من ينزّل التطبيق:** عند الدفع إلى `main` يبني سير النشر الكتالوج العام من `catalog/src` و`addons/` تلقائياً.
