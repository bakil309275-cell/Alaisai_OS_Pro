v/**
 * Alaisai Core - نواة النظام المركزية
 * @version 2.0.0
 */

const AlaisaiCore = {
    version: '2.0.0',
    build: '2026.02',
    modules: {},
    hooks: {},
    events: {},
    
    // تهيئة النظام
    init() {
        console.log('✅ Alaisai Core: تم تشغيل نواة النظام');
        this.loadModules();
        this.registerCoreHooks();
        return this;
    },
    
    // تسجيل وحدة جديدة
    registerModule(name, module) {
        this.modules[name] = {
            instance: module,
            status: 'active',
            loadedAt: new Date().toISOString()
        };
        console.log(`📦 تم تسجيل الوحدة: ${name}`);
        this.emit('module:registered', { name });
        return this;
    },
    
    // إلغاء تسجيل وحدة
    unregisterModule(name) {
        if (this.modules[name]) {
            delete this.modules[name];
            console.log(`🗑️ تم إلغاء تسجيل الوحدة: ${name}`);
            this.emit('module:unregistered', { name });
        }
        return this;
    },
    
    // استدعاء وحدة
    call(moduleName, method, ...args) {
        const module = this.modules[moduleName];
        if (!module || module.status !== 'active') {
            throw new Error(`❌ الوحدة ${moduleName} غير متاحة`);
        }
        
        if (module.instance[method]) {
            return module.instance[method](...args);
        }
        
        throw new Error(`❌ الدالة ${method} غير موجودة في الوحدة ${moduleName}`);
    },
    
    // تسجيل خطاف (Hook)
    registerHook(name, callback) {
        if (!this.hooks[name]) {
            this.hooks[name] = [];
        }
        this.hooks[name].push(callback);
        console.log(`🪝 تم تسجيل خطاف: ${name}`);
        return this;
    },
    
    // تنفيذ الخطافات
    runHook(name, data = {}) {
        if (this.hooks[name]) {
            return this.hooks[name].map(callback => callback(data));
        }
        return [];
    },
    
    // نظام الأحداث
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return this;
    },
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
        return this;
    },
    
    // تحميل الوحدات المسجلة
    loadModules() {
        console.log('🔄 جاري تحميل الوحدات المسجلة...');
    },
    
    // تسجيل الخطافات الأساسية
    registerCoreHooks() {
        this.registerHook('system:beforeInit', () => console.log('🔄 قبل تهيئة النظام'));
        this.registerHook('system:afterInit', () => console.log('✅ بعد تهيئة النظام'));
        this.registerHook('system:error', (error) => console.error('❌ خطأ في النظام:', error));
    },
    
    // معلومات النظام
    info() {
        return {
            version: this.version,
            build: this.build,
            modules: Object.keys(this.modules).length,
            hooks: Object.keys(this.hooks).length,
            uptime: Date.now() - (window._alaisai_start_time || Date.now())
        };
    }
};

//تسجيل بدء التشغيل
window._alaisai_start_time = Date.now();

// تصدير للنظام
indow.AlaisaiCore = AlaisaiCore;
// تحميل مدير الإضافات
if (window.AlaisaiAddons) {
    AlaisaiAddons.init();
}
console.log('✨ Alaisai Core جاهز للعمل');// Alaisai Core v2.0.0
