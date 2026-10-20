/**
 * Alaisai Database - نظام إدارة قواعد البيانات
 * @version 1.3.0
 */

const AlaisaiDB = {
    version: '1.3.0',
    stores: new Map(),
    indexes: new Map(),
    backups: [],
    
    // إنشاء مخزن جديد
    createStore(name, options = {}) {
        if (this.stores.has(name)) {
            throw new Error(`❌ المخزن ${name} موجود بالفعل`);
        }
        
        const store = {
            name,
            data: new Map(),
            indexes: new Map(),
            options: {
                primaryKey: options.primaryKey || 'id',
                timestamps: options.timestamps || true,
                ...options
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.stores.set(name, store);
        console.log(`📁 تم إنشاء مخزن: ${name}`);
        return this;
    },
    
    // إدراج بيانات
    insert(storeName, data) {
        const store = this.stores.get(storeName);
        if (!store) {
            throw new Error(`❌ المخزن ${storeName} غير موجود`);
        }
        
        const primaryKey = store.options.primaryKey;
        const id = data[primaryKey] || this.generateId();
        
        const record = {
            [primaryKey]: id,
            ...data,
            _created: store.options.timestamps ? new Date().toISOString() : undefined,
            _updated: store.options.timestamps ? new Date().toISOString() : undefined
        };
        
        store.data.set(id, record);
        store.updatedAt = new Date().toISOString();
        
        // تحديث الفهارس
        this.updateIndexes(storeName, record, 'insert');
        
        return record;
    },
    
    // البحث
    find(storeName, query = {}) {
        const store = this.stores.get(storeName);
        if (!store) return [];
        
        const results = [];
        store.data.forEach((record) => {
            if (this.matchesQuery(record, query)) {
                results.push({ ...record });
            }
        });
        
        return results;
    },
    
    // العثور على سجل واحد
    findOne(storeName, query) {
        const results = this.find(storeName, query);
        return results.length > 0 ? results[0] : null;
    },
    
    // تحديث
    update(storeName, query, updates) {
        const store = this.stores.get(storeName);
        if (!store) return 0;
        
        let count = 0;
        store.data.forEach((record, id) => {
            if (this.matchesQuery(record, query)) {
                const oldRecord = { ...record };
                const updated = {
                    ...record,
                    ...updates,
                    _updated: store.options.timestamps ? new Date().toISOString() : undefined
                };
                
                store.data.set(id, updated);
                this.updateIndexes(storeName, updated, 'update', oldRecord);
                count++;
            }
        });
        
        if (count > 0) {
            store.updatedAt = new Date().toISOString();
        }
        
        return count;
    },
    
    // حذف
    delete(storeName, query) {
        const store = this.stores.get(storeName);
        if (!store) return 0;
        
        let count = 0;
        store.data.forEach((record, id) => {
            if (this.matchesQuery(record, query)) {
                store.data.delete(id);
                this.updateIndexes(storeName, record, 'delete');
                count++;
            }
        });
        
        if (count > 0) {
            store.updatedAt = new Date().toISOString();
        }
        
        return count;
    },
    
    // إنشاء فهرس
    createIndex(storeName, field) {
        const store = this.stores.get(storeName);
        if (!store) return;
        
        if (!store.indexes.has(field)) {
            const index = new Map();
            
            store.data.forEach(record => {
                const value = record[field];
                if (value !== undefined) {
                    if (!index.has(value)) {
                        index.set(value, []);
                    }
                    index.get(value).push(record[store.options.primaryKey]);
                }
            });
            
            store.indexes.set(field, index);
            console.log(`🔍 تم إنشاء فهرس على ${storeName}.${field}`);
        }
    },
    
    // تحديث الفهارس
    updateIndexes(storeName, record, operation, oldRecord = null) {
        const store = this.stores.get(storeName);
        if (!store) return;
        
        store.indexes.forEach((index, field) => {
            const value = record[field];
            const primaryKey = record[store.options.primaryKey];
            
            if (operation === 'insert' || operation === 'update') {
                if (!index.has(value)) {
                    index.set(value, []);
                }
                if (!index.get(value).includes(primaryKey)) {
                    index.get(value).push(primaryKey);
                }
            }
            
            if (operation === 'delete' || (operation === 'update' && oldRecord)) {
                const oldValue = oldRecord?.[field];
                if (oldValue && oldValue !== value) {
                    const oldIndex = index.get(oldValue);
                    if (oldIndex) {
                        const pos = oldIndex.indexOf(primaryKey);
                        if (pos > -1) oldIndex.splice(pos, 1);
                    }
                }
            }
        });
    },
    
    // إنشاء نسخة احتياطية
    backup() {
        const backup = {
            timestamp: new Date().toISOString(),
            stores: {}
        };
        
        this.stores.forEach((store, name) => {
            backup.stores[name] = {
                options: store.options,
                data: Array.from(store.data.entries())
            };
        });
        
        this.backups.push(backup);
        
        // الاحتفاظ بآخر 5 نسخ فقط
        if (this.backups.length > 5) {
            this.backups.shift();
        }
        
        console.log('💾 تم إنشاء نسخة احتياطية');
        return backup;
    },
    
    // استعادة نسخة احتياطية
    restore(backupIndex = -1) {
        const backup = backupIndex === -1 ? 
            this.backups[this.backups.length - 1] : 
            this.backups[backupIndex];
            
        if (!backup) {
            throw new Error('❌ لا توجد نسخة احتياطية');
        }
        
        this.stores.clear();
        
        Object.entries(backup.stores).forEach(([name, storeData]) => {
            const store = {
                name,
                data: new Map(storeData.data),
                indexes: new Map(),
                options: storeData.options,
                createdAt: backup.timestamp,
                updatedAt: backup.timestamp
            };
            this.stores.set(name, store);
        });
        
        console.log('🔄 تم استعادة النسخة الاحتياطية');
        return true;
    },
    
    // دوال مساعدة
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    matchesQuery(record, query) {
        for (const [key, value] of Object.entries(query)) {
            if (record[key] !== value) {
                return false;
            }
        }
        return true;
    },
    
    // إحصائيات
    stats() {
        const stats = {};
        this.stores.forEach((store, name) => {
            stats[name] = {
                records: store.data.size,
                indexes: store.indexes.size,
                createdAt: store.createdAt,
                updatedAt: store.updatedAt
            };
        });
        return {
            stores: stats,
            totalRecords: Array.from(this.stores.values()).reduce((acc, s) => acc + s.data.size, 0),
            backups: this.backups.length
        };
    }
};

window.AlaisaiDB = AlaisaiDB;
console.log('🗄️ Alaisai Database جاهزة للعمل');// Alaisai Database v1.3.0
