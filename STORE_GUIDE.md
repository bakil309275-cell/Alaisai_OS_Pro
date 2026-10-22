# دليل النشر: من الموقع إلى المتاجر

> التطبيق جاهز تقنياً كـ PWA (يُثبَّت من المتصفح مباشرة). النشر في المتاجر يتطلب خطوات إدارية منك (حسابات مطوّر، توقيع، رسوم). لا يستطيع أحد ضمان القبول بنسبة 100%، لكن هذا الدليل يغطي معايير الرفض الشائعة. تحقّق دائماً من الشروط والرسوم الحالية في صفحات المتاجر الرسمية فهي تتغير.

## 1) النشر على الويب (الخطوة الأولى لكل شيء)
1. ارفع هذا المجلد إلى مستودعك على GitHub (فرع `main`).
2. من **Settings ← Pages ← Source** اختر **GitHub Actions**. سير العمل `.github/workflows/pages.yml` ينشر الموقع تلقائياً مع كل push، ويختم رقم البناء في `sw.js` فيصل التحديث لكل من يستخدم التطبيق.
3. عنوانك الافتراضي: `https://bakil309275-cell.github.io/Alaisai_OS_Pro/`. إن استخدمت نطاقاً خاصاً: `node tools/set-site-url.mjs https://نطاقك/` ثم ارفع.
4. **كيف تصل التحديثات للجميع؟** كل push إلى `main` ← نشر ← يكتشف Service Worker الإصدار الجديد ← يظهر لمستخدميه إشعار «يتوفر إصدار جديد». والإضافات الجديدة: أضف مجلداً في `addons/<id>/` (أو `catalog/src/<id>/`) ثم `node tools/build-catalog.mjs` وارفع، فتظهر في المتجر لكل المستخدمين وتُحدَّث الإضافات المثبّتة تلقائياً.

## 2) التثبيت المباشر (بلا متجر)
- **Android/Chrome، Windows/Edge، Mac/Chrome:** زر 📲 في شريط التطبيق أو «تثبيت» من المتصفح.
- **iPhone/iPad:** Safari ← مشاركة ← «إضافة إلى الشاشة الرئيسية» (يعرض التطبيق الشرح بنفسه).

## 3) Google Play (عبر TWA)
**شرط أساسي:** يجب أن يعمل الموقع على جذر نطاق (`https://نطاقك/`) ليُرفق `/.well-known/assetlinks.json`. مستودع GitHub Pages من نوع «project site» لا يصلح لذلك؛ استخدم نطاقاً خاصاً أو مستودعاً باسم `bakil309275-cell.github.io`.
1. حساب Google Play Console (رسم تسجيل لمرة واحدة، وقد تُطلب خطوات تحقق للحسابات الجديدة).
2. أسهل طريق: <https://www.pwabuilder.com> ← أدخل رابط موقعك ← Package for Stores ← Android. أو Bubblewrap: انسخ `store/twa-manifest.template.json` إلى `twa-manifest.json` وعدّل النطاق، ثم `npx @bubblewrap/cli build`.
3. ارفع ملف `.aab`، وفعّل **Play App Signing**، ثم انسخ بصمة SHA-256 إلى `store/assetlinks.template.json` وانشره باسم `.well-known/assetlinks.json` على نطاقك (يجب أن يردّ بـ 200 دون إعادة توجيه).
4. عبّئ النماذج من `store/listing.md` (الوصف، التصنيف، Data safety = لا بيانات تُجمع، رابط الخصوصية `privacy.html`).
5. الصور: `store/play-icon-512.png`، `store/feature-graphic-1024x500.png`، ولقطات الهاتف من `assets/screenshots/narrow-*.png`.
6. للحسابات الشخصية الجديدة تشترط Google عادةً فترة اختبار مغلق قبل الإنتاج: راجع المتطلبات الحالية.

## 4) Microsoft Store
PWABuilder ← Windows ← ينتج حزمة MSIX. ارفعها في Partner Center مع الوصف والصور نفسها.

## 5) متاجر أخرى
Samsung Galaxy Store وHuawei AppGallery وAmazon Appstore تقبل عادةً حزمة Android نفسها (APK/AAB من PWABuilder) بعد تسجيل حساب مطوّر لديها.

## 6) Apple App Store (تنبيه)
يتطلب تغليفاً أصلياً (مثل Capacitor) وحساب Apple Developer مدفوعاً. وتميل Apple لرفض التطبيقات التي هي مجرد غلاف لموقع (Guideline 4.2) ما لم تقدّم قيمة أصلية؛ الأسلم البدء بالتثبيت المباشر على iOS.

## قائمة الفحص (ما أُنجز في المشروع)
- [x] manifest كامل: id، أيقونات 48→512 + maskable، اختصارات، لقطات شاشة، تصنيفات، lang/dir
- [x] Service Worker يعمل دون اتصال، مع تحديثات وإشعار للمستخدم
- [x] لا موارد خارجية: الخط والأيقونات محلية (لا Google Fonts)
- [x] سياسة خصوصية وشروط (`privacy.html`, `terms.html`) وصفحة 404
- [x] SEO: title/description/canonical/Open Graph/JSON-LD/robots/sitemap/security.txt
- [x] إمكانية الوصول: تباين ≥ 4.5، أسماء لكل عنصر، تنقّل بلوحة المفاتيح، رابط تخطّي، تقليل الحركة
- [x] أداء: FCP ≈ 0.2 ثانية على محاكاة جوال بطيء، حجم تحميل صغير، بلا أطر خارجية
- [x] أمان: كلمة مرور مجزّأة، عزل التطبيقات، تشفير النسخ، رمز GitHub مشفّر بمفتاح الجهاز
- [ ] **بيدك:** نطاق خاص (لـ Play)، حسابات المطوّر، التوقيع، واستبدال `YOUR-DOMAIN`

> **حدود صريحة:** لم أستطع تشغيل Lighthouse (الشبكة محجوبة في بيئة العمل)، فبنيت سكربت تدقيق خاصاً (`tests/audit.py`) يفحص قابلية التثبيت عبر Chrome نفسه والتباين والأسماء والأداء. شغّل Lighthouse على موقعك المنشور للتأكد. واجهة التطبيق عربية فقط حالياً.
