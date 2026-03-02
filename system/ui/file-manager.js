// ==================== file-manager.js (الإصدار 7.4.0 - مع الحفاظ على جميع الأزرار) ====================
/**
 * Alaisai File Manager - مدير الملفات المتطور مع دعم كامل لجميع المصادر
 * @version 7.4.0
 */

const AlaisaiFileManager = {
    version: '7.4.0',
    repo: 'bakil309275-cell/Alaisai_OS_Pro',
    branch: 'main',
    token: null,
    webdavCredentials: { url: '', user: '', pass: '' },
    currentPath: '',
    currentSource: 'local', // 'local', 'github', 'webdav'
    opfsRoot: null,
    selectedItems: new Set(),
    clipboardItems: [],
    isDragging: false,
    dragSource: null,
    autoSaveTimer: null,
    currentEditingFile: null,

    // ========== المصادقة ==========
    setToken(token) {
        this.token = token;
        sessionStorage.setItem('github_token', token);
    },

    setWebDAVCredentials(url, user, pass) {
        this.webdavCredentials = { url, user, pass };
        sessionStorage.setItem('webdav_url', url);
        sessionStorage.setItem('webdav_user', user);
        if (pass) {
            const encodedPass = btoa(pass);
            sessionStorage.setItem('webdav_pass_enc', encodedPass);
        }
    },

    getWebDAVPassword() {
        const encoded = sessionStorage.getItem('webdav_pass_enc');
        return encoded ? atob(encoded) : '';
    },

    // ========== دوال العودة إلى لوحة التحكم ==========
    goBackToAdminDashboard() {
        // العودة إلى لوحة التحكم المركزية دون إغلاق التطبيق بالكامل
        if (window.Admin && typeof Admin.renderTab === 'function') {
            // إذا كنا داخل تطبيق، نغلق المرحلة الحالية ونفتح لوحة التحكم
            if (window.AlaisaiOS && typeof AlaisaiOS.closeStage === 'function') {
                AlaisaiOS.closeStage();
            }
            // فتح لوحة التحكم مباشرة
            Admin.openDashboard();
        } else {
            // حل بديل: العودة إلى الصفحة الرئيسية
            window.location.hash = '';
            location.reload();
        }
    },

    // ========== OPFS Local Storage ==========
    async initOPFS() {
        if (this.opfsRoot) return this.opfsRoot;
        try {
            this.opfsRoot = await navigator.storage.getDirectory();
            console.log('✅ OPFS initialized');
            await this.createOPFSDirectory('system');
            await this.createOPFSDirectory('addons');
            await this.createOPFSDirectory('backups');
            await this.initializeSystemFiles();
            return this.opfsRoot;
        } catch (err) {
            console.error('❌ OPFS initialization failed:', err);
            return null;
        }
    },

    async createOPFSDirectory(dirName) {
        try {
            return await this.opfsRoot.getDirectoryHandle(dirName, { create: true });
        } catch (err) {
            console.error(`❌ Failed to create directory ${dirName}:`, err);
            return null;
        }
    },

    async initializeSystemFiles() {
        const systemFiles = [
            'system/core/core.js',
            'system/core/database.js',
            'system/core/security.js',
            'system/core/api.js',
            'system/core/addons-manager.js',
            'system/ui/i18n.js',
            'system/ui/ui-kit.js',
            'system/ui/components.js',
            'system/ui/validators.js',
            'system/ui/helpers.js',
            'system/ui/formatters.js',
            'system/ui/file-manager.js'
        ];
        for (const filePath of systemFiles) {
            try {
                const exists = await this.readOPFSFile(filePath).catch(() => null);
                if (!exists) {
                    const response = await fetch(filePath);
                    if (response.ok) {
                        const content = await response.text();
                        await this.writeOPFSFile(filePath, content);
                        console.log(`✅ Copied system file: ${filePath}`);
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Could not copy system file ${filePath}:`, err);
            }
        }
    },

    async readOPFSDirectory(path = '') {
        const root = await this.initOPFS();
        if (!root) return [];
        try {
            const parts = path.split('/').filter(p => p);
            let currentDir = root;
            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part);
            }
            const entries = [];
            for await (const entry of currentDir.values()) {
                const stats = entry.kind === 'file' ? await entry.getFile() : null;
                entries.push({
                    name: entry.name,
                    type: entry.kind === 'directory' ? 'dir' : 'file',
                    path: path ? `${path}/${entry.name}` : entry.name,
                    size: stats?.size || 0,
                    handle: entry,
                    modified: stats?.lastModified || null,
                    isDirectory: entry.kind === 'directory'
                });
            }
            return entries.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name, 'ar');
            });
        } catch (err) {
            console.error('❌ Failed to read OPFS directory:', err);
            return [];
        }
    },

    async writeOPFSFile(filePath, content) {
        const root = await this.initOPFS();
        if (!root) return false;
        try {
            const parts = filePath.split('/');
            const fileName = parts.pop();
            let currentDir = root;
            for (const dirPart of parts) {
                currentDir = await currentDir.getDirectoryHandle(dirPart, { create: true });
            }
            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            console.log(`✅ File written to OPFS: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`❌ Failed to write OPFS file ${filePath}:`, err);
            return false;
        }
    },

    async readOPFSFile(filePath) {
        const root = await this.initOPFS();
        if (!root) return null;
        try {
            const parts = filePath.split('/');
            const fileName = parts.pop();
            let currentDir = root;
            for (const dirPart of parts) {
                currentDir = await currentDir.getDirectoryHandle(dirPart);
            }
            const fileHandle = await currentDir.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const content = await file.text();
            return { content, handle: fileHandle, modified: file.lastModified, size: file.size };
        } catch (err) {
            console.error(`❌ Failed to read OPFS file ${filePath}:`, err);
            return null;
        }
    },

    async deleteOPFSFile(filePath) {
        const root = await this.initOPFS();
        if (!root) return false;
        try {
            const parts = filePath.split('/');
            const fileName = parts.pop();
            let currentDir = root;
            for (const dirPart of parts) {
                currentDir = await currentDir.getDirectoryHandle(dirPart);
            }
            await currentDir.removeEntry(fileName);
            console.log(`✅ Deleted OPFS file: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`❌ Failed to delete OPFS file ${filePath}:`, err);
            return false;
        }
    },

    // ========== GitHub API ==========
    async listGitHubContents(path = '') {
        const url = `https://api.github.com/repos/${this.repo}/contents/${path}?ref=${this.branch}`;
        const headers = {};
        if (this.token) headers.Authorization = `token ${this.token}`;
        try {
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
            const data = await res.json();
            return data.map(item => ({
                name: item.name,
                path: item.path,
                type: item.type,
                size: item.size,
                download_url: item.download_url,
                html_url: item.html_url,
                sha: item.sha,
                isDirectory: item.type === 'dir'
            })).sort((a, b) => {
                if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        } catch (e) {
            console.error('❌ Failed to fetch GitHub contents:', e);
            return [];
        }
    },

    async getGitHubFileContent(path) {
        const url = `https://api.github.com/repos/${this.repo}/contents/${path}?ref=${this.branch}`;
        const headers = {};
        if (this.token) headers.Authorization = `token ${this.token}`;
        try {
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
            const data = await res.json();
            if (data.type === 'file') {
                const base64 = data.content.replace(/\n/g, '');
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const content = new TextDecoder('utf-8').decode(bytes);
                return { content, sha: data.sha, size: data.size };
            }
            return null;
        } catch (e) {
            console.error('❌ Failed to read GitHub file:', e);
            return null;
        }
    },

    async saveGitHubFile(path, content, message = 'Update via Alaisai File Manager') {
        if (!this.token) {
            alert('تحتاج إلى إعداد توكن GitHub أولاً');
            return false;
        }
        let sha = null;
        try {
            const existing = await this.getGitHubFileContent(path);
            sha = existing?.sha;
        } catch {}
        const url = `https://api.github.com/repos/${this.repo}/contents/${path}`;
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        const body = { message, content: encodedContent, branch: this.branch };
        if (sha) body.sha = sha;
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    Authorization: `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
            if (window.AlaisaiUI) AlaisaiUI.notifications.success('✅ تم حفظ الملف بنجاح على GitHub');
            return true;
        } catch (e) {
            console.error('❌ Failed to save GitHub file:', e);
            if (window.AlaisaiUI) AlaisaiUI.notifications.error('❌ فشل حفظ الملف على GitHub');
            return false;
        }
    },

    async deleteGitHubFile(path, message = 'Delete via Alaisai File Manager') {
        if (!this.token) {
            alert('تحتاج إلى إعداد توكن GitHub أولاً');
            return false;
        }
        let sha = null;
        try {
            const existing = await this.getGitHubFileContent(path);
            sha = existing?.sha;
        } catch {}
        if (!sha) {
            alert('الملف غير موجود');
            return false;
        }
        const url = `https://api.github.com/repos/${this.repo}/contents/${path}`;
        const body = { message, sha, branch: this.branch };
        try {
            const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
            if (window.AlaisaiUI) AlaisaiUI.notifications.success('✅ تم حذف الملف بنجاح من GitHub');
            return true;
        } catch (e) {
            console.error('❌ Failed to delete GitHub file:', e);
            if (window.AlaisaiUI) AlaisaiUI.notifications.error('❌ فشل حذف الملف من GitHub');
            return false;
        }
    },

    // ========== WebDAV API (مفعل بالكامل) ==========
    async webdavRequest(path, options = {}) {
        const { url, user, pass } = this.webdavCredentials;
        if (!url || !user || !pass) {
            throw new Error('WebDAV credentials not set');
        }
        const fullUrl = url.endsWith('/') ? url + path : url + '/' + path;
        const headers = {
            'Authorization': 'Basic ' + btoa(user + ':' + pass),
            ...options.headers
        };
        return await fetch(fullUrl, { ...options, headers });
    },

    async listWebDAVContents(path = '') {
        try {
            const res = await this.webdavRequest(path, {
                method: 'PROPFIND',
                headers: { 'Depth': '1' }
            });
            if (!res.ok) throw new Error(`WebDAV error: ${res.status}`);
            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'application/xml');
            const responses = xml.querySelectorAll('response');
            const entries = [];
            
            for (const resp of responses) {
                const href = resp.querySelector('href')?.textContent;
                if (!href) continue;
                const displayName = decodeURIComponent(href.split('/').pop() || '');
                if (!displayName) continue;
                
                const isCollection = resp.querySelector('resourcetype collection') !== null;
                const contentLength = resp.querySelector('getcontentlength')?.textContent;
                
                entries.push({
                    name: displayName,
                    path: path ? `${path}/${displayName}` : displayName,
                    type: isCollection ? 'dir' : 'file',
                    size: parseInt(contentLength) || 0,
                    isDirectory: isCollection,
                    modified: resp.querySelector('getlastmodified')?.textContent
                });
            }
            
            return entries.filter(e => e.path !== path).sort((a, b) => {
                if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        } catch (err) {
            console.error('❌ Failed to list WebDAV contents:', err);
            return [];
        }
    },

    async getWebDAVFileContent(path) {
        try {
            const res = await this.webdavRequest(path, { method: 'GET' });
            if (!res.ok) throw new Error(`WebDAV error: ${res.status}`);
            const content = await res.text();
            return { content, size: content.length };
        } catch (err) {
            console.error('❌ Failed to read WebDAV file:', err);
            return null;
        }
    },

    async saveWebDAVFile(path, content) {
        try {
            const res = await this.webdavRequest(path, {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: content
            });
            if (!res.ok) throw new Error(`WebDAV error: ${res.status}`);
            if (window.AlaisaiUI) AlaisaiUI.notifications.success('✅ تم حفظ الملف بنجاح على WebDAV');
            return true;
        } catch (err) {
            console.error('❌ Failed to save WebDAV file:', err);
            if (window.AlaisaiUI) AlaisaiUI.notifications.error('❌ فشل حفظ الملف على WebDAV');
            return false;
        }
    },

    async deleteWebDAVFile(path) {
        try {
            const res = await this.webdavRequest(path, { method: 'DELETE' });
            if (!res.ok) throw new Error(`WebDAV error: ${res.status}`);
            if (window.AlaisaiUI) AlaisaiUI.notifications.success('✅ تم حذف الملف بنجاح من WebDAV');
            return true;
        } catch (err) {
            console.error('❌ Failed to delete WebDAV file:', err);
            if (window.AlaisaiUI) AlaisaiUI.notifications.error('❌ فشل حذف الملف من WebDAV');
            return false;
        }
    },

    async createWebDAVDirectory(path) {
        try {
            const res = await this.webdavRequest(path, {
                method: 'MKCOL'
            });
            if (!res.ok) throw new Error(`WebDAV error: ${res.status}`);
            return true;
        } catch (err) {
            console.error('❌ Failed to create WebDAV directory:', err);
            return false;
        }
    },

    // ========== دوال الإختيار المتعدد والسحب ==========
    handleItemClick(path, event, isDirectory) {
        if (this.isDragging) return;
        
        if (isDirectory) {
            this.navigateTo(path);
            return;
        }
        
        if (event.ctrlKey || event.metaKey) {
            if (this.selectedItems.has(path)) {
                this.selectedItems.delete(path);
            } else {
                this.selectedItems.add(path);
            }
        } else if (event.shiftKey && this.selectedItems.size > 0) {
            const items = Array.from(document.querySelectorAll('.file-item')).map(el => el.dataset.path);
            const lastSelected = Array.from(this.selectedItems).pop();
            const startIdx = items.indexOf(lastSelected);
            const endIdx = items.indexOf(path);
            if (startIdx !== -1 && endIdx !== -1) {
                const [low, high] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
                for (let i = low; i <= high; i++) {
                    this.selectedItems.add(items[i]);
                }
            }
        } else {
            this.selectedItems.clear();
            this.selectedItems.add(path);
        }
        this.updateSelectionUI();
    },

    updateSelectionUI() {
        document.querySelectorAll('.file-item').forEach(el => {
            const path = el.dataset.path;
            const type = el.dataset.type;
            if (type === 'dir') {
                el.classList.remove('selected');
                el.style.background = '';
                el.style.border = '';
                el.style.boxShadow = '';
            } else if (this.selectedItems.has(path)) {
                el.classList.add('selected');
                el.style.background = 'rgba(76, 201, 240, 0.3)';
                el.style.border = '2px solid #4cc9f0';
                el.style.boxShadow = '0 0 10px rgba(76, 201, 240, 0.5)';
            } else {
                el.classList.remove('selected');
                el.style.background = '';
                el.style.border = '';
                el.style.boxShadow = '';
            }
        });
        
        const statusEl = document.getElementById('fm-status');
        if (statusEl) {
            const count = this.selectedItems.size;
            statusEl.innerHTML = count > 0 ? `✅ تم تحديد ${count} ملف` : 'جاهز';
        }
    },

    // ========== عمليات الحافظة ==========
    copyToClipboard(cut = false) {
        if (this.selectedItems.size === 0) return;
        this.clipboardItems = Array.from(this.selectedItems).map(path => ({
            path,
            source: this.currentSource,
            operation: cut ? 'cut' : 'copy'
        }));
        this.setStatus(`📋 تم نسخ ${this.clipboardItems.length} ملف إلى الحافظة`);
    },

    async pasteFromClipboard() {
        if (this.clipboardItems.length === 0) return;
        let successCount = 0;
        for (const item of this.clipboardItems) {
            if (item.source !== this.currentSource) {
                this.setStatus(`❌ لا يمكن اللصق بين مصادر مختلفة`, true);
                continue;
            }
            const fileName = item.path.split('/').pop();
            const newPath = this.currentPath ? `${this.currentPath}/${fileName}` : fileName;
            
            try {
                if (item.operation === 'cut') {
                    if (this.currentSource === 'local') {
                        const content = await this.readOPFSFile(item.path);
                        if (content) {
                            await this.writeOPFSFile(newPath, content.content);
                            await this.deleteOPFSFile(item.path);
                            successCount++;
                        }
                    } else if (this.currentSource === 'github') {
                        const content = await this.getGitHubFileContent(item.path);
                        if (content) {
                            await this.saveGitHubFile(newPath, content.content, `نقل ${fileName}`);
                            await this.deleteGitHubFile(item.path, `نقل ${fileName}`);
                            successCount++;
                        }
                    } else if (this.currentSource === 'webdav') {
                        const content = await this.getWebDAVFileContent(item.path);
                        if (content) {
                            await this.saveWebDAVFile(newPath, content.content);
                            await this.deleteWebDAVFile(item.path);
                            successCount++;
                        }
                    }
                } else {
                    if (this.currentSource === 'local') {
                        const content = await this.readOPFSFile(item.path);
                        if (content) {
                            await this.writeOPFSFile(newPath, content.content);
                            successCount++;
                        }
                    } else if (this.currentSource === 'github') {
                        const content = await this.getGitHubFileContent(item.path);
                        if (content) {
                            await this.saveGitHubFile(newPath, content.content, `نسخ ${fileName}`);
                            successCount++;
                        }
                    } else if (this.currentSource === 'webdav') {
                        const content = await this.getWebDAVFileContent(item.path);
                        if (content) {
                            await this.saveWebDAVFile(newPath, content.content);
                            successCount++;
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Paste error:', err);
            }
        }
        if (successCount > 0) {
            this.setStatus(`✅ تم لصق ${successCount} ملف بنجاح`);
            this.openUI(this.currentPath, this.currentSource);
        }
        this.clipboardItems = [];
    },

    // ========== السحب والإفلات ==========
    handleDragStart(event, path) {
        this.isDragging = true;
        this.dragSource = path;
        event.dataTransfer.setData('text/plain', path);
        event.dataTransfer.effectAllowed = 'move';
        event.target.style.opacity = '0.5';
    },

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    },

    handleDragEnd(event) {
        this.isDragging = false;
        event.target.style.opacity = '1';
    },

    async handleDrop(event, targetPath) {
        event.preventDefault();
        this.isDragging = false;
        const sourcePath = event.dataTransfer.getData('text/plain');
        if (!sourcePath || sourcePath === targetPath) return;

        const fileName = sourcePath.split('/').pop();
        const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;

        try {
            if (this.currentSource === 'local') {
                const content = await this.readOPFSFile(sourcePath);
                if (content) {
                    await this.writeOPFSFile(newPath, content.content);
                    await this.deleteOPFSFile(sourcePath);
                }
            } else if (this.currentSource === 'github') {
                const content = await this.getGitHubFileContent(sourcePath);
                if (content) {
                    await this.saveGitHubFile(newPath, content.content, `نقل ${fileName}`);
                    await this.deleteGitHubFile(sourcePath, `نقل ${fileName}`);
                }
            } else if (this.currentSource === 'webdav') {
                const content = await this.getWebDAVFileContent(sourcePath);
                if (content) {
                    await this.saveWebDAVFile(newPath, content.content);
                    await this.deleteWebDAVFile(sourcePath);
                }
            }
            this.setStatus(`✅ تم نقل ${fileName}`);
            this.openUI(this.currentPath, this.currentSource);
        } catch (err) {
            this.setStatus(`❌ فشل النقل: ${err.message}`, true);
        }
    },

    // ========== عمليات الملفات المتقدمة ==========
    async deleteSelected() {
        if (this.selectedItems.size === 0) return;
        const confirmMsg = `⚠️ هل أنت متأكد من حذف ${this.selectedItems.size} ملف؟`;
        if (!confirm(confirmMsg)) return;

        let successCount = 0;
        for (const path of this.selectedItems) {
            try {
                if (this.currentSource === 'local') {
                    if (await this.deleteOPFSFile(path)) successCount++;
                } else if (this.currentSource === 'github') {
                    if (await this.deleteGitHubFile(path, `حذف ${path}`)) successCount++;
                } else if (this.currentSource === 'webdav') {
                    if (await this.deleteWebDAVFile(path)) successCount++;
                }
            } catch (err) {
                console.error(`❌ Failed to delete ${path}:`, err);
            }
        }
        this.setStatus(`✅ تم حذف ${successCount} ملف بنجاح`);
        this.selectedItems.clear();
        this.openUI(this.currentPath, this.currentSource);
    },

    async renameSelected() {
        if (this.selectedItems.size !== 1) {
            alert('الرجاء تحديد ملف واحد لإعادة التسمية');
            return;
        }
        const oldPath = Array.from(this.selectedItems)[0];
        const oldName = oldPath.split('/').pop();
        const newName = prompt('أدخل الاسم الجديد:', oldName);
        if (!newName || newName === oldName) return;

        const directory = oldPath.split('/').slice(0, -1).join('/');
        const newPath = directory ? `${directory}/${newName}` : newName;

        try {
            if (this.currentSource === 'local') {
                const content = await this.readOPFSFile(oldPath);
                if (content) {
                    await this.writeOPFSFile(newPath, content.content);
                    await this.deleteOPFSFile(oldPath);
                }
            } else if (this.currentSource === 'github') {
                const content = await this.getGitHubFileContent(oldPath);
                if (content) {
                    await this.saveGitHubFile(newPath, content.content, `إعادة تسمية ${oldName} إلى ${newName}`);
                    await this.deleteGitHubFile(oldPath, `إعادة تسمية ${oldName} إلى ${newName}`);
                }
            } else if (this.currentSource === 'webdav') {
                const content = await this.getWebDAVFileContent(oldPath);
                if (content) {
                    await this.saveWebDAVFile(newPath, content.content);
                    await this.deleteWebDAVFile(oldPath);
                }
            }
            this.setStatus(`✅ تمت إعادة التسمية`);
            this.selectedItems.clear();
            this.openUI(this.currentPath, this.currentSource);
        } catch (err) {
            this.setStatus(`❌ فشل إعادة التسمية: ${err.message}`, true);
        }
    },

    async downloadSelected() {
        if (this.selectedItems.size === 0) return;
        
        if (this.selectedItems.size === 1) {
            const path = Array.from(this.selectedItems)[0];
            let fileData;
            
            if (this.currentSource === 'local') {
                fileData = await this.readOPFSFile(path);
            } else if (this.currentSource === 'github') {
                fileData = await this.getGitHubFileContent(path);
            } else if (this.currentSource === 'webdav') {
                fileData = await this.getWebDAVFileContent(path);
            }
            
            if (fileData) {
                const blob = new Blob([fileData.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = path.split('/').pop();
                a.click();
                URL.revokeObjectURL(url);
                this.setStatus(`✅ تم تحميل الملف`);
            }
        } else {
            alert('تحميل عدة ملفات سيتم دعمه قريباً مع إنشاء ملف ZIP');
        }
    },

    async createNewFile() {
        const fileName = prompt('اسم الملف الجديد:', 'newfile.txt');
        if (!fileName) return;
        const newPath = this.currentPath ? `${this.currentPath}/${fileName}` : fileName;
        const defaultContent = '// ملف جديد تم إنشاؤه عبر Alaisai File Manager\n';
        
        try {
            if (this.currentSource === 'local') {
                await this.writeOPFSFile(newPath, defaultContent);
            } else if (this.currentSource === 'github') {
                await this.saveGitHubFile(newPath, defaultContent, `إنشاء ${fileName}`);
            } else if (this.currentSource === 'webdav') {
                await this.saveWebDAVFile(newPath, defaultContent);
            }
            this.setStatus(`✅ تم إنشاء ${fileName}`);
            this.openUI(this.currentPath, this.currentSource);
        } catch (err) {
            this.setStatus(`❌ فشل إنشاء الملف: ${err.message}`, true);
        }
    },

    async createNewFolder() {
        const folderName = prompt('اسم المجلد الجديد:', 'newfolder');
        if (!folderName) return;
        const newPath = this.currentPath ? `${this.currentPath}/${folderName}` : folderName;
        
        try {
            if (this.currentSource === 'local') {
                await this.createOPFSDirectory(newPath);
            } else if (this.currentSource === 'github') {
                await this.saveGitHubFile(`${newPath}/.gitkeep`, '', `إنشاء مجلد ${folderName}`);
            } else if (this.currentSource === 'webdav') {
                await this.createWebDAVDirectory(newPath);
            }
            this.setStatus(`✅ تم إنشاء المجلد ${folderName}`);
            this.openUI(this.currentPath, this.currentSource);
        } catch (err) {
            this.setStatus(`❌ فشل إنشاء المجلد: ${err.message}`, true);
        }
    },

    // ========== محرر الملفات المتطور ==========
    setupAutoSave(editorElement, path) {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        editorElement.addEventListener('input', () => {
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }
            this.autoSaveTimer = setTimeout(() => {
                this.autoSaveFile(path, editorElement.value);
            }, 2000);
        });
    },

    async autoSaveFile(path, content) {
        this.setStatus(`⏳ جاري الحفظ التلقائي...`);
        try {
            if (this.currentSource === 'local') {
                await this.writeOPFSFile(path, content);
            } else if (this.currentSource === 'github') {
                await this.saveGitHubFile(path, content, `تحديث تلقائي ${new Date().toLocaleString()}`);
            } else if (this.currentSource === 'webdav') {
                await this.saveWebDAVFile(path, content);
            }
            this.setStatus(`✅ تم الحفظ التلقائي في ${new Date().toLocaleTimeString()}`);
        } catch (err) {
            this.setStatus(`❌ فشل الحفظ التلقائي`, true);
        }
    },

    async viewFile(path) {
        let fileData;
        if (this.currentSource === 'local') {
            fileData = await this.readOPFSFile(path);
        } else if (this.currentSource === 'github') {
            fileData = await this.getGitHubFileContent(path);
        } else if (this.currentSource === 'webdav') {
            fileData = await this.getWebDAVFileContent(path);
        }
        
        if (fileData) {
            const content = `
                <div class="admin-ui" style="direction:ltr; text-align:left;">
                    <h3 style="color:#4cc9f0;">👁️ معاينة: ${path}</h3>
                    <pre class="code-editor" style="min-height:400px;">${this.escapeHtml(fileData.content)}</pre>
                    <div style="margin-top:10px; text-align:left;">
                        <button class="adm-btn" onclick="AlaisaiFileManager.editFile('${path}')" style="background:#4cc9f0;">✏️ تعديل</button>
                        <button class="adm-btn" onclick="AlaisaiOS.closeStage()">❌ إغلاق</button>
                    </div>
                </div>
            `;
            AlaisaiOS.openApp({ name: `معاينة: ${path.split('/').pop()}`, content });
        }
    },

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // ========== UI المتطور ==========
    setStatus(message, isError = false) {
        const status = document.getElementById('fm-status');
        if (status) {
            status.innerHTML = message;
            status.style.color = isError ? '#f72585' : '#4ade80';
        }
    },

    async openUI(path = '', source = 'local') {
        this.currentPath = path;
        this.currentSource = source;
        this.selectedItems.clear();
        
        const savedToken = sessionStorage.getItem('github_token');
        if (savedToken) this.token = savedToken;
        
        const savedWebdavUrl = sessionStorage.getItem('webdav_url');
        const savedWebdavUser = sessionStorage.getItem('webdav_user');
        const savedWebdavPass = this.getWebDAVPassword();
        if (savedWebdavUrl && savedWebdavUser && savedWebdavPass) {
            this.webdavCredentials = {
                url: savedWebdavUrl,
                user: savedWebdavUser,
                pass: savedWebdavPass
            };
        }

        const content = await this.renderExplorer(path, source);
        AlaisaiOS.openApp({
            name: source === 'local' ? '📁 المخزن المحلي' : 
                  source === 'github' ? '📡 مستكشف GitHub' : '☁️ مستكشف WebDAV',
            content: content
        });
        setTimeout(() => this.bindEvents(), 100);
    },

    async renderExplorer(path, source) {
        let files = [];
        let title = '';
        let sourceIcon = '';
        
        try {
            if (source === 'github') {
                files = await this.listGitHubContents(path);
                title = '📡 مستكشف GitHub';
                sourceIcon = '🐙';
            } else if (source === 'webdav') {
                files = await this.listWebDAVContents(path);
                title = '☁️ مستكشف WebDAV';
                sourceIcon = '☁️';
            } else {
                files = await this.readOPFSDirectory(path);
                title = '📁 المخزن المحلي';
                sourceIcon = '💾';
            }
        } catch (err) {
            this.setStatus(`❌ خطأ في تحميل المحتويات: ${err.message}`, true);
        }

        const pathParts = path.split('/').filter(p => p);
        
        let filesHtml = '';
        if (files.length === 0) {
            filesHtml = '<div style="padding:20px; text-align:center; color:var(--text-muted);">📭 لا توجد ملفات</div>';
        } else {
            filesHtml = files.map(f => `
                <div class="file-item" data-path="${f.path}" data-type="${f.type}" 
                     draggable="true" ondragstart="AlaisaiFileManager.handleDragStart(event, '${f.path}')"
                     ondragover="AlaisaiFileManager.handleDragOver(event)"
                     ondrop="AlaisaiFileManager.handleDrop(event, '${f.path}')"
                     ondragend="AlaisaiFileManager.handleDragEnd(event)"
                     ondblclick="AlaisaiFileManager.handleDoubleClick('${f.path}', '${f.type}')">
                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                        <span style="font-size:1.8rem; cursor:${f.isDirectory ? 'pointer' : 'default'};"
                              onclick="AlaisaiFileManager.handleItemClick('${f.path}', event, ${f.isDirectory})">
                            ${f.isDirectory ? '📁' : '📄'}
                        </span>
                        <span style="color:var(--text-primary); font-weight:500; cursor:${f.isDirectory ? 'pointer' : 'default'};"
                              onclick="AlaisaiFileManager.handleItemClick('${f.path}', event, ${f.isDirectory})">
                            ${f.name}
                        </span>
                        <span style="color:var(--text-muted); font-size:12px; margin-right:auto;">
                            ${!f.isDirectory ? this.formatFileSize(f.size) : ''}
                        </span>
                        <div class="file-actions">
                            ${!f.isDirectory ? `
                                <button class="file-btn" onclick="event.stopPropagation(); AlaisaiFileManager.viewFile('${f.path}')">👁️ معاينة</button>
                                <button class="file-btn" onclick="event.stopPropagation(); AlaisaiFileManager.editFile('${f.path}')">✏️ تعديل</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const breadcrumb = `
            <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <button class="adm-btn" onclick="AlaisaiFileManager.goBackToAdminDashboard()" style="background:#f72585; color:white;">🔙 رجوع للوحة التحكم</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.navigateTo('')">🏠 الرئيسية</button>
                ${pathParts.map((p, i) => {
                    const fullPath = pathParts.slice(0, i+1).join('/');
                    return `<button class="adm-btn" onclick="AlaisaiFileManager.navigateTo('${fullPath}')">${p}</button>`;
                }).join(' / ')}
                <span style="flex:1; text-align:left; color:var(--text-muted);">${files.length} عنصر</span>
            </div>
        `;

        const actionBar = `
            <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap; background:rgba(76,201,240,0.1); padding:10px; border-radius:8px;">
                <button class="adm-btn" onclick="AlaisaiFileManager.createNewFile()" style="background:#4cc9f0;">📄 ملف جديد</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.createNewFolder()" style="background:#4ade80;">📁 مجلد جديد</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.copyToClipboard(false)" style="background:#4cc9f0;">📋 نسخ</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.copyToClipboard(true)" style="background:#f72585;">✂️ قص</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.pasteFromClipboard()" style="background:#4ade80;">📌 لصق</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.renameSelected()" style="background:#ffc107;">✏️ إعادة تسمية</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.deleteSelected()" style="background:#dc3545;">🗑️ حذف</button>
                <button class="adm-btn" onclick="AlaisaiFileManager.downloadSelected()" style="background:#17a2b8;">⬇️ تحميل</button>
            </div>
        `;

        const sourceSelector = `
            <div style="display:flex; gap:10px; margin-bottom:20px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <button class="adm-btn ${source === 'local' ? 'active' : ''}" 
                        onclick="AlaisaiFileManager.switchSource('local')" 
                        style="${source === 'local' ? 'background:#4cc9f0; color:black; font-weight:bold;' : ''}">
                    💾 محلي
                </button>
                <button class="adm-btn ${source === 'github' ? 'active' : ''}" 
                        onclick="AlaisaiFileManager.switchSource('github')"
                        style="${source === 'github' ? 'background:#4cc9f0; color:black; font-weight:bold;' : ''}">
                    🐙 GitHub
                </button>
                <button class="adm-btn ${source === 'webdav' ? 'active' : ''}" 
                        onclick="AlaisaiFileManager.switchSource('webdav')"
                        style="${source === 'webdav' ? 'background:#4cc9f0; color:black; font-weight:bold;' : ''}">
                    ☁️ WebDAV
                </button>
            </div>
        `;

        const githubSettings = source === 'github' ? `
            <div style="margin-bottom:20px; background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #4cc9f0;">
                <h4 style="color:#4cc9f0; margin-bottom:10px;">🐙 إعدادات GitHub</h4>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="fm-repo" placeholder="المستودع (username/repo)" 
                           value="${this.repo}" style="flex:2; padding:8px; border-radius:5px; background:rgba(255,255,255,0.1); color:white; border:1px solid #4cc9f0;">
                    <input type="text" id="fm-branch" placeholder="الفرع" value="${this.branch}" 
                           style="flex:1; padding:8px; border-radius:5px; background:rgba(255,255,255,0.1); color:white; border:1px solid #4cc9f0;">
                </div>
                <div style="display:flex; gap:10px;">
                    <input type="password" id="fm-token" placeholder="GitHub Token" 
                           value="${this.token || ''}" style="flex:3; padding:8px; border-radius:5px; background:rgba(255,255,255,0.1); color:white; border:1px solid #4cc9f0;">
                    <button class="adm-btn" id="fm-set-token" style="background:#4cc9f0;">🔑 تعيين</button>
                </div>
            </div>
        ` : '';

        const webdavSettings = source === 'webdav' ? `
            <div style="margin-bottom:20px; background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border:1px solid #4ade80;">
                <h4 style="color:#4ade80; margin-bottom:10px;">☁️ إعدادات WebDAV</h4>
                <input type="text" id="fm-webdav-url" placeholder="WebDAV URL (مثال: https://example.com/dav/)" 
                       value="${this.webdavCredentials.url}" style="width:100%; padding:8px; margin-bottom:10px; border-radius:5px; background:rgba(255,255,255,0.1); color:white; border:1px solid #4ade80;">
                <input type="text" id="fm-webdav-user" placeholder="اسم المستخدم" 
                       value="${this.webdavCredentials.user}" style="width:100%; padding:8px; margin-bottom:10px; border-radius:5px; background:rgba(255,255,255,0.1); color:white; border:1px solid #4ade80;">
                <input type="password" id="fm-webdav-pass" placeholder="كلمة المرور" 
                       value="${this.getWebDAVPassword()}" style="width:100%; padding:8px; margin-bottom:10px; border-radius:5px; background:rgba(255,255,255,0.1); color:white; border:1px solid #4ade80;">
                <button class="adm-btn" id="fm-set-webdav" style="background:#4ade80;">🔗 اتصال</button>
            </div>
        ` : '';

        return `
            <div class="admin-ui" style="direction:ltr; text-align:left; max-width:800px; margin:0 auto;">
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px; background:linear-gradient(135deg, #4cc9f020, #f7258520); padding:15px; border-radius:15px;">
                    <div style="font-size:3.5rem;">${sourceIcon}</div>
                    <div>
                        <h2 style="color:#4cc9f0; margin:0;">${title}</h2>
                        <p style="color:var(--text-muted); margin:5px 0 0;">المسار الحالي: /${path || ''}</p>
                    </div>
                </div>
                
                ${sourceSelector}
                ${githubSettings}
                ${webdavSettings}
                ${actionBar}
                ${breadcrumb}
                
                <div id="fm-files" style="background:var(--bg-secondary); border-radius:10px; padding:15px; max-height:400px; overflow-y:auto;">
                    ${filesHtml}
                </div>
                
                <div id="fm-status" style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.3); border-radius:5px; color:#4ade80; font-size:12px; font-family:monospace;">
                    جاهز
                </div>
            </div>
        `;
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    navigateTo(path) {
        this.openUI(path, this.currentSource);
    },

    switchSource(source) {
        this.openUI(this.currentPath, source);
    },

    handleDoubleClick(path, type) {
        if (type === 'dir') {
            this.navigateTo(path);
        } else {
            this.editFile(path);
        }
    },

    async editFile(path) {
        this.setStatus(`⏳ جاري تحميل ${path}...`);
        let fileData;
        
        try {
            if (this.currentSource === 'local') {
                fileData = await this.readOPFSFile(path);
            } else if (this.currentSource === 'github') {
                fileData = await this.getGitHubFileContent(path);
                if (fileData) this.currentFileSha = fileData.sha;
            } else if (this.currentSource === 'webdav') {
                fileData = await this.getWebDAVFileContent(path);
            }
        } catch (err) {
            this.setStatus(`❌ فشل تحميل ${path}: ${err.message}`, true);
            return;
        }
        
        if (fileData) {
            const content = `
                <div class="admin-ui" style="direction:ltr; text-align:left;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
                        <button onclick="AlaisaiFileManager.goBackToAdminDashboard()" class="adm-btn" style="background:#f72585;">🔙 رجوع للوحة التحكم</button>
                        <button onclick="AlaisaiFileManager.openUI('${this.currentPath}', '${this.currentSource}')" class="adm-btn" style="background:#4cc9f0;">⬅ رجوع للمستكشف</button>
                        <h3 style="color:#4cc9f0;">✏️ تعديل: ${path}</h3>
                    </div>
                    
                    <div style="background:#2a2a32; border-radius:10px; padding:15px;">
                        <textarea id="fm-edit-content" class="code-editor" style="min-height:400px; width:100%;">${this.escapeHtml(fileData.content)}</textarea>
                        
                        <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
                            <button class="adm-btn" onclick="AlaisaiFileManager.saveEdit('${path}')" style="background:#4ade80;">💾 حفظ</button>
                            <button class="adm-btn" onclick="AlaisaiFileManager.saveEditAndClose('${path}')" style="background:#4cc9f0;">💾 حفظ وإغلاق</button>
                            <button class="adm-btn" onclick="AlaisaiFileManager.cancelEdit()" style="background:#f72585;">❌ إلغاء</button>
                        </div>
                        <p style="color:#4ade80; font-size:12px; margin-top:10px;">⏱️ سيتم الحفظ تلقائياً بعد التوقف عن الكتابة</p>
                    </div>
                </div>
            `;
            
            AlaisaiOS.openApp({ name: `✏️ ${path.split('/').pop()}`, content });
            
            setTimeout(() => {
                const editor = document.getElementById('fm-edit-content');
                if (editor) {
                    this.setupAutoSave(editor, path);
                    this.currentEditingFile = path;
                }
            }, 100);
        }
    },

    async saveEdit(path) {
        const editor = document.getElementById('fm-edit-content');
        if (!editor) return;
        const content = editor.value;
        
        this.setStatus(`⏳ جاري حفظ ${path}...`);
        try {
            if (this.currentSource === 'local') {
                await this.writeOPFSFile(path, content);
            } else if (this.currentSource === 'github') {
                await this.saveGitHubFile(path, content, `تحديث ${path}`);
            } else if (this.currentSource === 'webdav') {
                await this.saveWebDAVFile(path, content);
            }
            this.setStatus(`✅ تم حفظ ${path}`);
            if (window.AlaisaiUI) AlaisaiUI.notifications.success(`✅ تم حفظ ${path}`);
        } catch (err) {
            this.setStatus(`❌ فشل حفظ ${path}: ${err.message}`, true);
            if (window.AlaisaiUI) AlaisaiUI.notifications.error(`❌ فشل حفظ ${path}`);
        }
    },

    async saveEditAndClose(path) {
        await this.saveEdit(path);
        this.openUI(this.currentPath, this.currentSource);
    },

    cancelEdit() {
        this.openUI(this.currentPath, this.currentSource);
    },

    bindEvents() {
        if (this.currentSource === 'github') {
            document.getElementById('fm-set-token')?.addEventListener('click', () => {
                const token = document.getElementById('fm-token').value;
                const repo = document.getElementById('fm-repo').value;
                const branch = document.getElementById('fm-branch').value;
                if (token) {
                    this.setToken(token);
                    this.repo = repo || this.repo;
                    this.branch = branch || this.branch;
                    alert('✅ تم تعيين التوكن');
                    this.openUI(this.currentPath, this.currentSource);
                }
            });
        }

        if (this.currentSource === 'webdav') {
            document.getElementById('fm-set-webdav')?.addEventListener('click', () => {
                const url = document.getElementById('fm-webdav-url').value;
                const user = document.getElementById('fm-webdav-user').value;
                const pass = document.getElementById('fm-webdav-pass').value;
                if (url && user && pass) {
                    this.setWebDAVCredentials(url, user, pass);
                    alert('✅ تم تعيين بيانات WebDAV');
                    this.openUI(this.currentPath, this.currentSource);
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (document.getElementById('fm-edit-content')) return;
            
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    e.preventDefault();
                    this.copyToClipboard(false);
                } else if (e.key === 'x') {
                    e.preventDefault();
                    this.copyToClipboard(true);
                } else if (e.key === 'v') {
                    e.preventDefault();
                    this.pasteFromClipboard();
                } else if (e.key === 'a') {
                    e.preventDefault();
                    document.querySelectorAll('.file-item').forEach(el => {
                        if (el.dataset.type !== 'dir') {
                            this.selectedItems.add(el.dataset.path);
                        }
                    });
                    this.updateSelectionUI();
                }
            } else if (e.key === 'Delete') {
                e.preventDefault();
                this.deleteSelected();
            } else if (e.key === 'F2') {
                e.preventDefault();
                this.renameSelected();
            }
        });
    }
};

// جعله متاحاً عمومياً
window.AlaisaiFileManager = AlaisaiFileManager;
console.log('📁 Alaisai File Manager v7.4.0 جاهز للعمل - مع جميع أزرار التنقل');