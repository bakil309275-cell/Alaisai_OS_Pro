// ==================== file-manager.js (Ø§ÙØ¥ØµØ¯Ø§Ø± 5.0.0 Ø§ÙÙÙØ§Ø¦Ù ÙØ¹ OPFS + GitHub) ====================
/**
 * Alaisai File Manager - ÙØ¯ÙØ± Ø§ÙÙÙÙØ§Øª Ø§ÙØ­ÙÙÙÙ (OPFS + GitHub)
 * @version 5.0.0
 */

const AlaisaiFileManager = {
    version: '5.0.0',
    repo: 'alsamayoanwww-cyber/Alaisai_OS_Pro',
    branch: 'main',
    token: null,
    currentPath: '',
    currentSource: 'local', // 'local' or 'github'
    opfsRoot: null,

    setToken(token) {
        this.token = token;
        sessionStorage.setItem('github_token', token);
    },

    // ========== OPFS Local Storage ==========
    async initOPFS() {
        if (this.opfsRoot) return this.opfsRoot;
        try {
            this.opfsRoot = await navigator.storage.getDirectory();
            console.log('â OPFS initialized');
            // Ø¥ÙØ´Ø§Ø¡ Ø§ÙÙØ¬ÙØ¯Ø§Øª Ø§ÙØ£Ø³Ø§Ø³ÙØ©
            await this.createOPFSDirectory('system');
            await this.createOPFSDirectory('addons');
            // ØªÙÙØ¦Ø© ÙÙÙØ§Øª Ø§ÙÙØ¸Ø§Ù Ø§ÙØ£Ø³Ø§Ø³ÙØ© Ø¥Ø°Ø§ ÙÙ ØªÙÙ ÙÙØ¬ÙØ¯Ø©
            await this.initializeSystemFiles();
            return this.opfsRoot;
        } catch (err) {
            console.error('â OPFS initialization failed:', err);
            return null;
        }
    },

    async createOPFSDirectory(dirName) {
        try {
            const dirHandle = await this.opfsRoot.getDirectoryHandle(dirName, { create: true });
            console.log(`ð Created directory: ${dirName}`);
            return dirHandle;
        } catch (err) {
            console.error(`â Failed to create directory ${dirName}:`, err);
            return null;
        }
    },

    async initializeSystemFiles() {
        // ÙØ§Ø¦ÙØ© Ø¨ÙÙÙØ§Øª Ø§ÙÙØ¸Ø§Ù Ø§ÙØ£Ø³Ø§Ø³ÙØ© Ø§ÙØªÙ ÙØ±ÙØ¯ ÙØ³Ø®ÙØ§ Ø¥ÙÙ OPFS
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
                // ØªØ­ÙÙ Ø¥Ø°Ø§ ÙØ§Ù Ø§ÙÙÙÙ ÙÙØ¬ÙØ¯Ø§Ù Ø¨Ø§ÙÙØ¹Ù ÙÙ OPFS
                const exists = await this.readOPFSFile(filePath).catch(() => null);
                if (!exists) {
                    // Ø¬ÙØ¨ Ø§ÙÙÙÙ ÙÙ Ø§ÙÙØ³Ø§Ø± Ø§ÙØ£ØµÙÙ
                    const response = await fetch(filePath);
                    if (response.ok) {
                        const content = await response.text();
                        await this.writeOPFSFile(filePath, content);
                        console.log(`â Copied system file: ${filePath}`);
                    }
                }
            } catch (err) {
                console.warn(`â ï¸ Could not copy system file ${filePath}:`, err);
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
                entries.push({
                    name: entry.name,
                    type: entry.kind === 'directory' ? 'dir' : 'file',
                    path: path ? `${path}/${entry.name}` : entry.name,
                    size: entry.kind === 'file' ? (await entry.getFile()).size : 0,
                    handle: entry
                });
            }
            return entries;
        } catch (err) {
            console.error('â Failed to read OPFS directory:', err);
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
            console.log(`â File written to OPFS: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`â Failed to write OPFS file ${filePath}:`, err);
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
            return { content, handle: fileHandle };
        } catch (err) {
            console.error(`â Failed to read OPFS file ${filePath}:`, err);
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
            console.log(`â Deleted OPFS file: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`â Failed to delete OPFS file ${filePath}:`, err);
            return false;
        }
    },

    // Ø¯ÙØ§Ù ÙÙØªØ­ Ø§ÙÙØ¬ÙØ¯Ø§Øª ÙØ¨Ø§Ø´Ø±Ø© ÙÙ Ø§ÙÙØ®Ø²Ù Ø§ÙÙØ­ÙÙ
    openSystemFolder() {
        this.openUI('system', 'local');
    },

    openAddonsFolder() {
        this.openUI('addons', 'local');
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
                sha: item.sha
            }));
        } catch (e) {
            console.error('â Failed to fetch GitHub contents:', e);
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
                const content = atob(data.content.replace(/\n/g, ''));
                return { content, sha: data.sha };
            }
            return null;
        } catch (e) {
            console.error('â Failed to read GitHub file:', e);
            return null;
        }
    },

    async saveGitHubFile(path, content, message = 'Update via Alaisai File Manager') {
        if (!this.token) {
            alert('ØªØ­ØªØ§Ø¬ Ø¥ÙÙ Ø¥Ø¹Ø¯Ø§Ø¯ ØªÙÙÙ GitHub Ø£ÙÙØ§Ù');
            return false;
        }
        let sha = null;
        try {
            const existing = await this.getGitHubFileContent(path);
            sha = existing?.sha;
        } catch {}
        const url = `https://api.github.com/repos/${this.repo}/contents/${path}`;
        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content))),
            branch: this.branch
        };
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
            if (window.AlaisaiUI) AlaisaiUI.notifications.success('â ØªÙ Ø­ÙØ¸ Ø§ÙÙÙÙ Ø¨ÙØ¬Ø§Ø­ Ø¹ÙÙ GitHub');
            return true;
        } catch (e) {
            console.error('â Failed to save GitHub file:', e);
            if (window.AlaisaiUI) AlaisaiUI.notifications.error('â ÙØ´Ù Ø­ÙØ¸ Ø§ÙÙÙÙ Ø¹ÙÙ GitHub');
            return false;
        }
    },

    // ========== UI ==========
    async openUI(path = '', source = 'local') {
        this.currentPath = path;
        this.currentSource = source;
        const savedToken = sessionStorage.getItem('github_token');
        if (savedToken) this.token = savedToken;
        const content = await this.renderExplorer(path, source);
        AlaisaiOS.openApp({
            name: source === 'github' ? 'ð ÙØ³ØªÙØ´Ù GitHub' : 'ð Ø§ÙÙØ®Ø²Ù Ø§ÙÙØ­ÙÙ',
            content: content
        });
        setTimeout(() => this.bindEvents(), 100);
    },

    async renderExplorer(path, source) {
        let files = [];
        let title = '';
        if (source === 'github') {
            files = await this.listGitHubContents(path);
            title = 'ð ÙØ³ØªÙØ´Ù GitHub';
        } else {
            files = await this.readOPFSDirectory(path);
            title = 'ð Ø§ÙÙØ®Ø²Ù Ø§ÙÙØ­ÙÙ (OPFS)';
        }
        const pathParts = path.split('/').filter(p => p);
        let filesHtml = '';
        if (files.length === 0) {
            filesHtml = '<div style="padding:20px; text-align:center;">ð­ ÙØ§ ØªÙØ¬Ø¯ ÙÙÙØ§Øª</div>';
        } else {
            filesHtml = files.map(f => `
                <div class="file-item" data-path="${f.path}" data-type="${f.type}">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${f.type === 'dir' ? 'ð' : 'ð'}</span>
                        <span style="color:var(--text-primary);">${f.name}</span>
                        <span style="color:var(--text-muted); font-size:12px;">${f.type === 'file' ? Math.ceil(f.size/1024) + 'KB' : ''}</span>
                    </div>
                    <div class="file-actions">
                        ${f.type === 'file' ? `<button class="file-btn view-btn" data-path="${f.path}">ðï¸ Ø¹Ø±Ø¶</button>` : ''}
                        ${f.type === 'dir' ? `<button class="file-btn open-btn" data-path="${f.path}">ð ÙØªØ­</button>` : ''}
                        <button class="file-btn delete-btn" data-path="${f.path}">ðï¸</button>
                    </div>
                </div>
            `).join('');
        }
        const breadcrumb = `
            <div style="display:flex; gap:5px; margin-bottom:15px; flex-wrap:wrap;">
                <button class="adm-btn" data-path="">ð  Ø§ÙØ±Ø¦ÙØ³ÙØ©</button>
                ${pathParts.map((p, i) => {
                    const fullPath = pathParts.slice(0, i+1).join('/');
                    return `<button class="adm-btn" data-path="${fullPath}">${p}</button>`;
                }).join(' / ')}
            </div>
        `;
        return `
            <div class="admin-ui" style="direction:ltr; text-align:left;">
                <h2 style="color:#4cc9f0;">${title}</h2>
                <div style="margin-bottom:15px; display:flex; gap:10px;">
                    <button class="adm-btn ${source === 'local' ? 'active' : ''}" onclick="AlaisaiFileManager.switchSource('local')">ð¾ ÙØ­ÙÙ</button>
                    <button class="adm-btn ${source === 'github' ? 'active' : ''}" onclick="AlaisaiFileManager.switchSource('github')">ð GitHub</button>
                </div>
                ${source === 'github' ? `
                <div style="margin-bottom:20px;">
                    <input type="text" id="fm-token" placeholder="GitHub Token" value="${this.token || ''}" style="width:70%; padding:8px;">
                    <button class="adm-btn" id="fm-set-token" style="background:#4cc9f0;">ð ØªØ¹ÙÙÙ</button>
                </div>
                ` : ''}
                ${breadcrumb}
                <div id="fm-files" style="background:var(--bg-secondary); border-radius:10px; padding:15px;">
                    ${filesHtml}
                </div>
                <div id="fm-editor" style="display:none; margin-top:20px;">
                    <h4 style="color:#4cc9f0;">ð ÙØ­Ø±Ø± Ø§ÙÙÙÙ</h4>
                    <textarea id="fm-editor-content" class="code-editor" style="min-height:400px;"></textarea>
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button class="adm-btn" id="fm-save" style="background:#4ade80;">ð¾ Ø­ÙØ¸</button>
                        <button class="adm-btn" id="fm-cancel">â Ø¥ÙØºØ§Ø¡</button>
                    </div>
                </div>
            </div>
        `;
    },

    switchSource(source) {
        this.openUI(this.currentPath, source);
    },

    bindEvents() {
        if (this.currentSource === 'github') {
            document.getElementById('fm-set-token')?.addEventListener('click', () => {
                const token = document.getElementById('fm-token').value;
                if (token) {
                    this.setToken(token);
                    alert('â ØªÙ ØªØ¹ÙÙÙ Ø§ÙØªÙÙÙ');
                }
            });
        }

        document.querySelectorAll('[data-path]').forEach(el => {
            el.addEventListener('click', (e) => {
                const path = e.target.dataset.path;
                if (path !== undefined) {
                    if (el.classList.contains('open-btn') || el.tagName === 'BUTTON') {
                        this.openUI(path, this.currentSource);
                    } else {
                        this.openUI(path, this.currentSource);
                    }
                }
            });
        });

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const path = btn.dataset.path;
                let file;
                if (this.currentSource === 'github') {
                    file = await this.getGitHubFileContent(path);
                } else {
                    file = await this.readOPFSFile(path);
                }
                if (file) {
                    document.getElementById('fm-files').style.display = 'none';
                    document.getElementById('fm-editor').style.display = 'block';
                    document.getElementById('fm-editor-content').value = file.content;
                    document.getElementById('fm-save').dataset.path = path;
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const path = btn.dataset.path;
                if (confirm(`â ï¸ Ø­Ø°Ù ${path}Ø`)) {
                    if (this.currentSource === 'github') {
                        alert('Ø­Ø°Ù ÙÙ GitHub ØºÙØ± ÙØ¯Ø¹ÙÙ Ø¨Ø¹Ø¯');
                    } else {
                        await this.deleteOPFSFile(path);
                        this.openUI(this.currentPath, this.currentSource);
                    }
                }
            });
        });

        document.getElementById('fm-save')?.addEventListener('click', async () => {
            const path = document.getElementById('fm-save').dataset.path;
            const content = document.getElementById('fm-editor-content').value;
            let success;
            if (this.currentSource === 'github') {
                success = await this.saveGitHubFile(path, content);
            } else {
                success = await this.writeOPFSFile(path, content);
            }
            if (success) {
                document.getElementById('fm-editor').style.display = 'none';
                document.getElementById('fm-files').style.display = 'block';
                this.openUI(this.currentPath, this.currentSource);
            }
        });

        document.getElementById('fm-cancel')?.addEventListener('click', () => {
            document.getElementById('fm-editor').style.display = 'none';
            document.getElementById('fm-files').style.display = 'block';
        });
    }
};

// Ø¬Ø¹ÙÙ ÙØªØ§Ø­Ø§Ù Ø¹ÙÙÙÙØ§Ù
window.AlaisaiFileManager = AlaisaiFileManager;