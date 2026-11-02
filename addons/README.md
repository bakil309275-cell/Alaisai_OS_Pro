# مجلد الإضافات

كل مجلد هنا هو **إضافة**. اسم المجلد هو اسم الإضافة، ويمكن أن يكون بالعربية أو الإنجليزية أو بمسافات.

```
addons/
  اسم الإضافة/
    manifest.json      (إلزامي)  {"name":"الاسم الظاهر","icon":"🧩","version":"1.0.0","description":"..."}
    index.html         المحتوى
    main.js
    style.css
    src/bridge/Adapter.js   ← مجلدات متداخلة مسموحة
```

- يمكن ربط الملفات بمساراتها داخل `index.html`: `<script src="src/bridge/Adapter.js"></script>` و`<link rel="stylesheet" href="css/app.css">`.
- من الكود: `Alaisai.file("data/config.json")` تقرأ أي ملف نصي من الإضافة، و`Alaisai.files()` تعدّدها.
- الإضافات التي تنشئها داخل التطبيق تُنشر هنا تلقائياً مع المزامنة، وما تضعه هنا يظهر في «متجر الإضافات».
- هذا الملف لا يُعدّ إضافة ولا يتأثر به شيء.
