/**
 * Alaisai Core - النواة المركزية للنظام
 * @version 2.1.0
 */

const AlaisaiCore = {
    version: '2.1.0',
    build: '2026.03',
    modules: new Map(),
    hooks: new Map(),
    events: new Map(),
    ready: false,

    // تهيئة النظام
    async init() {
        console.log('✅ Alaisai Core: بدء تهيئة النظام...');
        this.runHook('system:beforeInit');

        // تسجيل الوحدات الأساسية تلقائياً
        this.registerModule('AlaisaiCore', this, { core: true });

        // انتظار تحميل باقي الوحدات (إذا تم تسجيلها لاحقاً)
        this.ready = true;

        this.runHook('system:afterInit');
        console.log('✅ Alaisai Core: تم تهيئة النظام بنجاح');
        return this;
    },

    // تسجيل وحدة جديدة
    registerModule(name, instance, options = {}) {
        if (this.modules.has(name)) {
            console.warn(`⚠️ الوحدة ${name} مسجلة مسبقاً، سيتم استبدالها`);
        }
        this.modules.set(name, {
            instance,
            status: 'active',
            loadedAt: new Date().toISOString(),
            ...options
        });
        console.log(`📦 تم تسجيل الوحدة: ${name}`);
        this.emit('module:registered', { name });
        return this;
    },

    // إلغاء تسجيل وحدة
    unregisterModule(name) {
        if (this.modules.delete(name)) {
            console.log(`🗑️ تم إلغاء تسجيل الوحدة: ${name}`);
            this.emit('module:unregistered', { name });
        }
        return this;
    },

    // الحصول على وحدة
    getModule(name) {
        return this.modules.get(name)?.instance;
    },

    // استدعاء دالة من وحدة
    async call(moduleName, method, ...args) {
        const module = this.modules.get(moduleName);
        if (!module || module.status !== 'active') {
            throw new Error(`❌ الوحدة ${moduleName} غير متاحة`);
        }
        if (typeof module.instance[method] !== 'function') {
            throw new Error(`❌ الدالة ${method} غير موجودة في الوحدة ${moduleName}`);
        }
        return await module.instance[method](...args);
    },

    // تسجيل خطاف (Hook)
    registerHook(name, callback, priority = 10) {
        if (!this.hooks.has(name)) {
            this.hooks.set(name, []);
        }
        this.hooks.get(name).push({ callback, priority });
        this.hooks.get(name).sort((a, b) => a.priority - b.priority);
        console.log(`🪝 تم تسجيل خطاف: ${name}`);
        return this;
    },

    // تنفيذ الخطافات
    async runHook(name, data = {}) {
        if (!this.hooks.has(name)) return [];
        const results = [];
        for (const hook of this.hooks.get(name)) {
            try {
                results.push(await hook.callback(data));
            } catch (e) {
                console.error(`❌ خطأ في خطاف ${name}:`, e);
            }
        }
        return results;
    },

    // نظام الأحداث
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return this;
    },

    off(event, callback) {
        if (!this.events.has(event)) return;
        const callbacks = this.events.get(event).filter(cb => cb !== callback);
        this.events.set(event, callbacks);
        return this;
    },

    emit(event, data) {
        if (!this.events.has(event)) return;
        this.events.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`❌ خطأ في حدث ${event}:`, e);
            }
        });
        return this;
    },

    // معلومات النظام
    info() {
        return {
            version: this.version,
            build: this.build,
            modules: Array.from(this.modules.keys()),
            hooks: Array.from(this.hooks.keys()),
            uptime: Date.now() - (window._alaisai_start_time || Date.now())
        };
    }
};

// تسجيل بدء التشغيل
window._alaisai_start_time = Date.now();

// تصدير للنظام
window.AlaisaiCore = AlaisaiCore;

// تهيئة عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AlaisaiCore.init());
} else {
    AlaisaiCore.init();
}

console.log('✨ Alaisai Core جاهز للعمل (نسخة محسّنة)');