/**
 * Alaisai Database - نظام إدارة قواعد البيانات مع IndexedDB
 * @version 2.0.0
 */

const AlaisaiDB = {
    version: '2.0.0',
    dbName: 'AlaisaiDB',
    dbVersion: 1,
    db: null,
    stores: new Map(), // تعريفات المخازن (للذاكرة المؤقتة)

    // تهيئة قاعدة البيانات
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('❌ فشل فتح قاعدة البيانات:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('🗄️ تم فتح قاعدة البيانات IndexedDB بنجاح');
                this._createDefaultStores();
                resolve(this);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // إنشاء المخازن الافتراضية
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'token' });
                }
                if (!db.objectStoreNames.contains('addons')) {
                    db.createObjectStore('addons', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('backups')) {
                    db.createObjectStore('backups', { keyPath: 'timestamp' });
                }
                console.log('🆕 تم إنشاء جداول قاعدة البيانات');
            };
        });
    },

    // إنشاء المخازن الافتراضية في الذاكرة للتوافق
    _createDefaultStores() {
        const stores = ['settings', 'users', 'sessions', 'addons', 'backups'];
        stores.forEach(storeName => {
            if (!this.stores.has(storeName)) {
                this.stores.set(storeName, {
                    name: storeName,
                    data: new Map(),
                    options: { primaryKey: 'id' }
                });
            }
        });
    },

    // تنفيذ عملية في معاملة
    async _transaction(storeName, mode = 'readonly', callback) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const request = callback(store);

            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = (e) => reject(e.target.error);
            transaction.onabort = (e) => reject(e.target.error);
        });
    },

    // إدراج أو تحديث
    async put(storeName, data) {
        return this._transaction(storeName, 'readwrite', store => store.put(data));
    },

    // الحصول على عنصر بالمفتاح
    async get(storeName, key) {
        return this._transaction(storeName, 'readonly', store => store.get(key));
    },

    // الحصول على جميع العناصر
    async getAll(storeName) {
        return this._transaction(storeName, 'readonly', store => store.getAll());
    },

    // حذف عنصر
    async delete(storeName, key) {
        return this._transaction(storeName, 'readwrite', store => store.delete(key));
    },

    // مسح جميع العناصر
    async clear(storeName) {
        return this._transaction(storeName, 'readwrite', store => store.clear());
    },

    // البحث بشرط (تطبيق بسيط)
    async find(storeName, predicate) {
        const all = await this.getAll(storeName);
        return all.filter(predicate);
    },

    // إنشاء نسخة احتياطية
    async backup() {
        const backup = {
            timestamp: new Date().toISOString(),
            stores: {}
        };
        for (const storeName of this.db.objectStoreNames) {
            backup.stores[storeName] = await this.getAll(storeName);
        }
        await this.put('backups', backup);
        return backup;
    },

    // استعادة نسخة احتياطية (بالمعرف)
    async restore(timestamp) {
        const backup = await this.get('backups', timestamp);
        if (!backup) throw new Error('❌ النسخة الاحتياطية غير موجودة');
        for (const [storeName, items] of Object.entries(backup.stores)) {
            await this.clear(storeName);
            for (const item of items) {
                await this.put(storeName, item);
            }
        }
        return true;
    },

    // إحصائيات
    async stats() {
        const stats = {};
        for (const storeName of this.db.objectStoreNames) {
            const count = await this._transaction(storeName, 'readonly', store => store.count());
            stats[storeName] = { records: count };
        }
        return stats;
    }
};

// تهيئة عند التحميل
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiDB', AlaisaiDB);
    AlaisaiDB.init().catch(console.error);
} else {
    window.AlaisaiDB = AlaisaiDB;
}

console.log('🗄️ Alaisai Database جاهزة للعمل (مع IndexedDB)');