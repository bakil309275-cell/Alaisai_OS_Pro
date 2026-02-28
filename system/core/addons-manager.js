// ==================== addons-manager.js (الإصدار 3.3.0 النهائي) ====================
/**
 * Alaisai Addons Manager - نظام إدارة الإضافات المتكامل (نهائي)
 * @version 3.3.0
 */

const AlaisaiAddons = {
    version: '3.3.0',
    addons: new Map(),        // الإضافات المحملة في الذاكرة
    initialized: false,
    
    async init() {
        if (this.initialized) return this;
        
        // تحميل الإضافات من IndexedDB
        if (window.AlaisaiDB) {
            const storedAddons = await AlaisaiDB.getAll('addons').catch(() => []);
            storedAddons.forEach(addon => this.addons.set(addon.id, addon));
        }
        
        // التأكد من وجود مجلد addons في OPFS
        if (window.AlaisaiFileManager) {
            await this.ensureOPFSFolder();
            await this.syncWithOPFS();
        }
        
        // ترحيل الإضافات القديمة من registry (مرة واحدة)
        await this.migrateFromRegistry();
        
        if (window.AlaisaiCore) {
            AlaisaiCore.registerModule('AlaisaiAddons', this);
        }
        
        this.initialized = true;
        console.log('📦 Alaisai Addons Manager جاهز');
        return this;
    },
    
    async ensureOPFSFolder() {
        try {
            await AlaisaiFileManager.createOPFSDirectory('addons');
        } catch (err) {
            console.warn('⚠️ Could not create addons folder:', err);
        }
    },
    
    async syncWithOPFS() {
        try {
            const files = await AlaisaiFileManager.readOPFSDirectory('addons');
            for (const file of files) {
                if (file.type === 'file' && file.name.endsWith('.json')) {
                    const fileData = await AlaisaiFileManager.readOPFSFile(file.path);
                    if (fileData) {
                        try {
                            const addon = JSON.parse(fileData.content);
                            if (!this.addons.has(addon.id)) {
                                this.addons.set(addon.id, addon);
                                if (window.AlaisaiDB) {
                                    await AlaisaiDB.put('addons', addon);
                                }
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ Could not sync with OPFS:', err);
        }
    },
    
    async migrateFromRegistry() {
        if (!window.AlaisaiOS || !AlaisaiOS.db.registry || AlaisaiOS.db.registry.length === 0) return;
        
        console.log('🔄 بدء ترحيل التطبيقات القديمة إلى AlaisaiAddons...');
        let migrated = 0;
        for (const app of AlaisaiOS.db.registry) {
            if (!this.addons.has(app.id)) {
                await this.addAddon({
                    id: app.id,
                    name: app.name,
                    icon: app.icon,
                    content: app.content,
                    version: '1.0.0',
                    author: 'المالك',
                    script: '',
                    styles: ''
                }).catch(() => {});
                migrated++;
            }
        }
        if (migrated > 0) {
            console.log(`✅ تم ترحيل ${migrated} تطبيق إلى AlaisaiAddons`);
        }
    },
    
    async addAddon(addonData) {
        const id = addonData.id || 'addon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const addon = {
            id,
            name: addonData.name || 'إضافة جديدة',
            version: addonData.version || '1.0.0',
            description: addonData.description || '',
            author: addonData.author || 'غير معروف',
            icon: addonData.icon || '📦',
            content: addonData.content || '',
            script: addonData.script || '',
            styles: addonData.styles || '',
            enabled: addonData.enabled !== false,
            installedAt: new Date().toISOString(),
            settings: addonData.settings || {}
        };
        
        this.addons.set(id, addon);
        
        // حفظ في IndexedDB
        if (window.AlaisaiDB) {
            await AlaisaiDB.put('addons', addon);
        }
        
        // حفظ في OPFS (مجلد addons/)
        if (window.AlaisaiFileManager) {
            const fileName = `addons/${id}.json`;
            await AlaisaiFileManager.writeOPFSFile(fileName, JSON.stringify(addon, null, 2));
        }
        
        // إضافة إلى registry القديم للتوافق (اختياري)
        if (window.AlaisaiOS && AlaisaiOS.db.registry) {
            if (!AlaisaiOS.db.registry.find(a => a.id === id)) {
                AlaisaiOS.db.registry.push({
                    id,
                    name: addon.name,
                    icon: addon.icon,
                    content: addon.content,
                    order: AlaisaiOS.db.registry.length
                });
                AlaisaiOS.save();
            }
        }
        
        return addon;
    },
    
    async updateAddon(id, newData) {
        const existing = this.addons.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...newData, id };
        this.addons.set(id, updated);
        if (window.AlaisaiDB) {
            await AlaisaiDB.put('addons', updated);
        }
        if (window.AlaisaiFileManager) {
            const fileName = `addons/${id}.json`;
            await AlaisaiFileManager.writeOPFSFile(fileName, JSON.stringify(updated, null, 2));
        }
        // تحديث registry القديم
        if (window.AlaisaiOS && AlaisaiOS.db.registry) {
            const index = AlaisaiOS.db.registry.findIndex(a => a.id === id);
            if (index !== -1) {
                AlaisaiOS.db.registry[index] = {
                    ...AlaisaiOS.db.registry[index],
                    name: updated.name,
                    icon: updated.icon,
                    content: updated.content
                };
                AlaisaiOS.save();
            }
        }
        return updated;
    },
    
    async removeAddon(id) {
        const addon = this.addons.get(id);
        if (!addon) return false;
        this.addons.delete(id);
        if (window.AlaisaiDB) {
            await AlaisaiDB.delete('addons', id);
        }
        if (window.AlaisaiFileManager) {
            const fileName = `addons/${id}.json`;
            await AlaisaiFileManager.deleteOPFSFile(fileName).catch(() => {});
        }
        // حذف من registry القديم
        if (window.AlaisaiOS && AlaisaiOS.db.registry) {
            AlaisaiOS.db.registry = AlaisaiOS.db.registry.filter(a => a.id !== id);
            AlaisaiOS.save();
        }
        return true;
    },
    
    getAddon(id) {
        return this.addons.get(id) || null;
    },
    
    exportAddonAsFile(id) {
        const addon = this.addons.get(id);
        if (!addon) return;
        const data = JSON.stringify(addon, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `addon_${addon.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    async importAddonFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const addonData = JSON.parse(e.target.result);
                    const addon = await this.addAddon(addonData);
                    resolve(addon);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    async saveToFileSystem() {
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                for (const addon of this.addons.values()) {
                    const fileName = `${addon.name.replace(/[^a-z0-9]/gi, '_')}.json`;
                    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(JSON.stringify(addon, null, 2));
                    await writable.close();
                }
                alert('✅ تم حفظ جميع الإضافات في المجلد المحدد');
            } catch (err) {
                console.error('فشل الحفظ:', err);
            }
        } else {
            for (const addon of this.addons.values()) {
                this.exportAddonAsFile(addon.id);
            }
        }
    },
    
    async loadFromFileSystem() {
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                let count = 0;
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const file = await entry.getFile();
                        const text = await file.text();
                        try {
                            const addon = JSON.parse(text);
                            await this.addAddon(addon);
                            count++;
                        } catch (e) {}
                    }
                }
                alert(`✅ تم استيراد ${count} إضافة من المجلد`);
            } catch (err) {
                console.error('فشل الاستيراد:', err);
            }
        } else {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.multiple = true;
            input.onchange = async (e) => {
                for (const file of e.target.files) {
                    await this.importAddonFromFile(file);
                }
                alert(`✅ تم استيراد ${e.target.files.length} إضافة`);
            };
            input.click();
        }
    },
    
    renderAddonsList(container) {
        if (!container) return;
        let html = '<h4>📦 الإضافات المثبتة</h4>';
        this.addons.forEach(addon => {
            html += `
                <div style="display:flex; align-items:center; gap:10px; padding:10px; background:rgba(255,255,255,0.05); margin:5px 0; border-radius:8px;">
                    <span style="font-size:24px;">${addon.icon}</span>
                    <div style="flex:1;">
                        <strong>${addon.name}</strong> <small>v${addon.version}</small>
                    </div>
                    <button class="file-btn" onclick="AlaisaiAddons.exportAddonAsFile('${addon.id}')">📥 تحميل</button>
                </div>
            `;
        });
        container.innerHTML = html;
    },
    
    listAddons() {
        return Array.from(this.addons.values());
    }
};

// تسجيل في النواة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiAddons', AlaisaiAddons);
    AlaisaiAddons.init().catch(console.error);
} else {
    window.AlaisaiAddons = AlaisaiAddons;
}