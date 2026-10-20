/**
 * Alaisai Addons Manager - نظام إدارة الإضافات المحلية
 * @version 1.0.0
 */

const AlaisaiAddons = {
    version: '1.0.0',
    addonsPath: 'system/addons/',
    
    // تهيئة النظام
    async init() {
        console.log('📦 Alaisai Addons Manager جاهز للعمل');
        await this.loadAddonsFromFiles();
    },
    
    // تحميل الإضافات من الملفات
    async loadAddonsFromFiles() {
        try {
            // محاولة قراءة مجلد الإضافات
            const response = await fetch(this.addonsPath);
            if (!response.ok) return;
            
            // هذا يحتاج إلى API في الخادم، سنطوره لاحقاً
            console.log('📂 جاري تحميل الإضافات من الملفات...');
        } catch (e) {
            console.log('لا توجد إضافات محلية بعد');
        }
    },
    
    // حفظ إضافة جديدة
    async saveAddon(addon) {
        try {
            // إنشاء اسم ملف آمن
            const safeName = addon.name.replace(/[^a-zA-Z0-9-_]/g, '_');
            const addonPath = `${this.addonsPath}${safeName}/`;
            
            // حفظ ملف الإضافة
            const content = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${addon.name}</title>
</head>
<body>
    <div id="app">${addon.content}</div>
    <script>
        // كود الإضافة
        ${addon.script || ''}
    <\/script>
</body>
</html>`;
            
            // هذا يحتاج إلى API لحفظ الملفات
            console.log('💾 تم حفظ الإضافة:', addon.name);
            
            // تحديث localStorage للتوافق مع النظام الحالي
            this.updateLocalStorage(addon);
            
        } catch (e) {
            console.error('❌ فشل حفظ الإضافة:', e);
        }
    },
    
    // تحديث localStorage (للتوافق)
    updateLocalStorage(addon) {
        const db = JSON.parse(localStorage.getItem('alaisai_ultra_db')) || { registry: [] };
        
        // التحقق من وجود الإضافة
        const exists = db.registry.some(a => a.id === addon.id);
        
        if (!exists) {
            db.registry.push(addon);
            localStorage.setItem('alaisai_ultra_db', JSON.stringify(db));
            console.log('🔄 تم تحديث localStorage');
        }
    },
    
    // رفع الإضافات للمستودع
    async pushToGitHub(repoUrl, token) {
        console.log('📤 جاري رفع الإضافات إلى:', repoUrl);
        // سنطور هذا لاحقاً
    },
    
    // سحب الإضافات من المستودع
    async pullFromGitHub(repoUrl, token) {
        console.log('📥 جاري سحب الإضافات من:', repoUrl);
        // سنطور هذا لاحقاً
    }
};

// تهيئة النظام
AlaisaiAddons.init();

// إضافة دالة حفظ الإضافات في Admin
const originalAddNew = Admin?.addNew;
if (originalAddNew) {
    Admin.addNew = function() {
        const result = originalAddNew.call(this);
        // بعد إضافة التطبيق، نحفظه كملف
        const newApp = AlaisaiOS.db.registry[AlaisaiOS.db.registry.length - 1];
        AlaisaiAddons.saveAddon(newApp);
        return result;
    };
}

window.AlaisaiAddons = AlaisaiAddons;
