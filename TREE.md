
## هيكل الإصدار 2 (الفعلي المستخدم في index.html)
```
index.html            # الهيكل فقط
assets/css/app.css    # الأنماط (داكن/فاتح)
src/ui.js             # حوارات، تنبيهات، سمات، تهريب HTML
src/security.js       # PBKDF2، AES-GCM
src/storage.js        # IndexedDB، تحقق وترحيل، نسخ احتياطي
src/apps.js           # عارض التطبيقات (html معزول / متصفح / ملاحظات)
src/explorer.js       # مستكشف الملفات وبيئة التجربة
src/admin.js          # لوحة الإدارة
src/main.js           # النواة وسطح المكتب
sw.js, manifest.json  # PWA
tests/                # اختبارات
```

📁 Alaisai_OS_Pro/                              # المجلد الرئيسي
│
├── 📄 index.html                                # مشغل النظام الرئيسي
├── 📄 manifest.json                              # ملف PWA
├── 📄 sw.js                                      # Service Worker
├── 📄 TREE.md                                    # الهيكل الشجري
│
├── 📁 system/                                    # ملفات النظام الأساسية (معزولة)
│   │
│   ├── 📁 core/                                   # نواة النظام
│   │   ├── 📄 core.js                               # نواة النظام المركزية
│   │   ├── 📄 api.js                                 # واجهة برمجة التطبيقات
│   │   ├── 📄 database.js                             # نظام قاعدة البيانات
│   │   ├── 📄 security.js                             # نظام الأمان والحماية
│   │   └── 📄 i18n.js                                 # نظام الترجمة والدولنة
│   │
│   ├── 📁 config/                                  # ملفات التكوين
│   │   ├── 📄 routes.json                             # نظام المسارات
│   │   ├── 📄 plugins.json                             # إدارة الإضافات
│   │   ├── 📄 errors.json                              # نظام الأخطاء
│   │   └── 📄 settings.json                            # إعدادات النظام
│   │
│   ├── 📁 ui/                                       # ملفات واجهة المستخدم
│   │   ├── 📄 components.js                            # مكتبة المكونات
│   │   ├── 📄 animations.css                            # تأثيرات حركية
│   │   ├── 📄 themes.css                                # نظام الثيمات
│   │   └── 📄 ui-kit.js                                 # أدوات واجهة المستخدم
│   │
│   └── 📁 utils/                                    # أدوات مساعدة
│       ├── 📄 helpers.js                               # دوال مساعدة
│       ├── 📄 validators.js                             # أدوات التحقق
│       └── 📄 formatters.js                             # أدوات التنسيق
│
├── 📁 addons/                                     # الإضافات المعزولة
│   │
│   ├── 📁 example-addon/                            # مثال إضافة
│   │   ├── 📄 manifest.json                           # ملف تعريف الإضافة
│   │   ├── 📄 main.js                                  # الكود الرئيسي
│   │   ├── 📄 style.css                                # أنماط الإضافة
│   │   └── 📄 README.md                                # وثائق الإضافة
│   │
│   └── 📁 [إضافات أخرى]/                            # مجلدات إضافات أخرى
│
├── 📁 assets/                                      # ملفات الوسائط
│   │
│   ├── 📁 images/                                   # الصور
│   │   ├── 📄 logo.png                                # شعار النظام
│   │   ├── 📄 favicon.ico                              # أيقونة المتصفح
│   │   └── 📁 icons/                                   # مجلد الأيقونات
│   │
│   ├── 📁 fonts/                                     # الخطوط
│   │   └── 📄 custom-font.woff2                         # خطوط مخصصة
│   │
│   └── 📁 sounds/                                    # المؤثرات الصوتية
│       └── 📄 notification.mp3                          # صوت الإشعارات
│
├── 📁 backups/                                     # النسخ الاحتياطية
│   ├── 📄 backup_2026-02-21.json                     # نسخة احتياطية (تاريخ)
│   └── 📄 auto_backup_latest.json                     # آخر نسخة تلقائية
│
└── 📁 temp/                                         # الملفات المؤقتة
    ├── 📁 cache/                                      # ذاكرة مؤقتة
    ├── 📁 logs/                                        # سجلات النظام
    └── 📁 uploads/                                     # ملفات مرفوعة مؤقتاً
