/**
 * Alaisai UI Kit - أدوات متكاملة لواجهة المستخدم مع دعم i18n
 * @version 2.0.0
 */

const AlaisaiUI = {
    version: '2.0.0',
    
    // نظام الإشعارات
    notifications: {
        container: null,
        
        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'notifications-container';
                document.body.appendChild(this.container);
            }
            return this;
        },
        
        show(message, type = 'info', duration = 3000) {
            this.init();
            
            const id = 'notif_' + Date.now();
            const notification = document.createElement('div');
            notification.id = id;
            notification.className = `notification notification-${type} animate-slide-in-left`;
            
            const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
            notification.innerHTML = `
                <div class="notification-icon">${icons[type] || '📢'}</div>
                <div class="notification-content">${message}</div>
                <button class="notification-close" onclick="AlaisaiUI.notifications.close('${id}')">&times;</button>
            `;
            
            this.container.appendChild(notification);
            if (duration > 0) setTimeout(() => this.close(id), duration);
            return id;
        },
        
        close(id) {
            const notif = document.getElementById(id);
            if (notif) {
                notif.classList.add('animate-slide-out-right');
                setTimeout(() => notif.remove(), 300);
            }
        },
        
        success(message, duration) {
            return this.show(message, 'success', duration);
        },
        error(message, duration) {
            return this.show(message, 'error', duration);
        },
        warning(message, duration) {
            return this.show(message, 'warning', duration);
        },
        info(message, duration) {
            return this.show(message, 'info', duration);
        }
    },
    
    // نظام الحوارات
    dialog: {
        show(options = {}) {
            const {
                title = 'تأكيد',
                message = '',
                type = 'confirm',
                confirmText = 'تأكيد',
                cancelText = 'إلغاء',
                onConfirm = () => {},
                onCancel = () => {}
            } = options;
            
            // دعم الترجمة
            const t = (key) => window.AlaisaiI18n ? AlaisaiI18n.t(key) : key;
            const finalTitle = typeof title === 'string' && title.startsWith('__') ? t(title.slice(2)) : title;
            const finalConfirm = confirmText.startsWith('__') ? t(confirmText.slice(2)) : confirmText;
            const finalCancel = cancelText.startsWith('__') ? t(cancelText.slice(2)) : cancelText;
            
            const id = 'dialog_' + Date.now();
            const dialogHTML = `
                <div id="${id}" class="dialog-overlay animate-fade-in">
                    <div class="dialog-box animate-scale-in">
                        <div class="dialog-header">
                            <h3>${finalTitle}</h3>
                            <button class="dialog-close" onclick="AlaisaiUI.dialog.close('${id}')">&times;</button>
                        </div>
                        <div class="dialog-body">
                            ${message}
                        </div>
                        <div class="dialog-footer">
                            ${type === 'alert' ? `
                                <button class="btn btn-primary" onclick="AlaisaiUI.dialog.close('${id}'); (${onConfirm})()">${finalConfirm}</button>
                            ` : `
                                <button class="btn btn-outline" onclick="AlaisaiUI.dialog.close('${id}'); (${onCancel})()">${finalCancel}</button>
                                <button class="btn btn-primary" onclick="AlaisaiUI.dialog.close('${id}'); (${onConfirm})()">${finalConfirm}</button>
                            `}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', dialogHTML);
            return id;
        },
        
        close(id) {
            const dialog = document.getElementById(id);
            if (dialog) {
                dialog.classList.add('animate-fade-out');
                setTimeout(() => dialog.remove(), 300);
            }
        },
        
        alert(message, title = '__confirm') {
            return this.show({ title, message, type: 'alert', confirmText: '__ok' });
        },
        
        confirm(message, onConfirm, onCancel, title = '__confirm') {
            return this.show({ title, message, type: 'confirm', confirmText: '__yes', cancelText: '__no', onConfirm, onCancel });
        },
        
        prompt(message, defaultValue = '', callback) {
            const id = 'prompt_' + Date.now();
            const t = (key) => window.AlaisaiI18n ? AlaisaiI18n.t(key) : key;
            const promptHTML = `
                <div id="${id}" class="dialog-overlay animate-fade-in">
                    <div class="dialog-box animate-scale-in">
                        <div class="dialog-header">
                            <h3>${t('__input')}</h3>
                            <button class="dialog-close" onclick="AlaisaiUI.dialog.close('${id}')">&times;</button>
                        </div>
                        <div class="dialog-body">
                            <p>${message}</p>
                            <input type="text" id="${id}_input" class="dialog-input" value="${defaultValue}">
                        </div>
                        <div class="dialog-footer">
                            <button class="btn btn-outline" onclick="AlaisaiUI.dialog.close('${id}')">${t('__cancel')}</button>
                            <button class="btn btn-primary" onclick="AlaisaiUI.dialog.handlePrompt('${id}', ${callback})">${t('__ok')}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', promptHTML);
            document.getElementById(`${id}_input`).focus();
        },
        
        handlePrompt(id, callback) {
            const value = document.getElementById(`${id}_input`).value;
            this.close(id);
            if (callback) callback(value);
        }
    },
    
    // أداة تحميل الملفات
    uploader: {
        create(options = {}) {
            const { accept = '*/*', multiple = false, maxSize = 10 * 1024 * 1024, onSelect = null, onUpload = null } = options;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.multiple = multiple;
            input.style.display = 'none';
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                const validFiles = files.filter(f => f.size <= maxSize);
                if (validFiles.length !== files.length) {
                    AlaisaiUI.notifications.error('بعض الملفات أكبر من الحجم المسموح');
                }
                if (onSelect) onSelect(validFiles);
                if (onUpload) {
                    for (const file of validFiles) await onUpload(file);
                }
            };
            
            document.body.appendChild(input);
            return {
                open: () => input.click(),
                destroy: () => input.remove()
            };
        }
    },
    
    // أداة السحب والإفلات (مبسطة)
    draggable: {
        make(element, options = {}) {
            const { handle = null, onDragStart = null, onDrag = null, onDragEnd = null } = options;
            let isDragging = false, startX, startY, initialX, initialY;
            const dragHandle = handle ? element.querySelector(handle) : element;
            dragHandle.style.cursor = 'grab';
            
            const onMouseDown = (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const rect = element.getBoundingClientRect();
                startX = e.clientX; startY = e.clientY;
                initialX = rect.left; initialY = rect.top;
                isDragging = true;
                dragHandle.style.cursor = 'grabbing';
                if (onDragStart) onDragStart({ x: initialX, y: initialY });
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            
            const onMouseMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                element.style.position = 'absolute';
                element.style.left = (initialX + dx) + 'px';
                element.style.top = (initialY + dy) + 'px';
                if (onDrag) onDrag({ x: initialX + dx, y: initialY + dy });
            };
            
            const onMouseUp = (e) => {
                if (!isDragging) return;
                isDragging = false;
                dragHandle.style.cursor = 'grab';
                if (onDragEnd) onDragEnd({ x: initialX, y: initialY });
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            dragHandle.addEventListener('mousedown', onMouseDown);
            return {
                disable: () => dragHandle.removeEventListener('mousedown', onMouseDown),
                enable: () => dragHandle.addEventListener('mousedown', onMouseDown)
            };
        }
    },
    
    // أداة النسخ
    clipboard: {
        async copy(text) {
            try {
                await navigator.clipboard.writeText(text);
                AlaisaiUI.notifications.success('تم النسخ');
                return true;
            } catch {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                AlaisaiUI.notifications.success('تم النسخ');
                return true;
            }
        },
        
        async paste() {
            try {
                return await navigator.clipboard.readText();
            } catch {
                AlaisaiUI.notifications.error('فشل اللصق');
                return null;
            }
        }
    }
};

// تسجيل في النواة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiUI', AlaisaiUI);
}

window.AlaisaiUI = AlaisaiUI;
console.log('🎨 Alaisai UI Kit جاهز للعمل (مع دعم i18n)');