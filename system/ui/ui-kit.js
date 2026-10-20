/**
 * Alaisai UI Kit - أدوات متكاملة لواجهة المستخدم
 * @version 1.2.0
 */

const AlaisaiUI = {
    version: '1.2.0',
    
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
            
            // اختيار الأيقونة حسب النوع
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            notification.innerHTML = `
                <div class="notification-icon">${icons[type] || '📢'}</div>
                <div class="notification-content">${message}</div>
                <button class="notification-close" onclick="AlaisaiUI.notifications.close('${id}')">&times;</button>
            `;
            
            this.container.appendChild(notification);
            
            if (duration > 0) {
                setTimeout(() => this.close(id), duration);
            }
            
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
            
            const id = 'dialog_' + Date.now();
            
            const dialogHTML = `
                <div id="${id}" class="dialog-overlay animate-fade-in">
                    <div class="dialog-box animate-scale-in">
                        <div class="dialog-header">
                            <h3>${title}</h3>
                            <button class="dialog-close" onclick="AlaisaiUI.dialog.close('${id}')">&times;</button>
                        </div>
                        <div class="dialog-body">
                            ${message}
                        </div>
                        <div class="dialog-footer">
                            ${type === 'alert' ? `
                                <button class="btn btn-primary" onclick="AlaisaiUI.dialog.close('${id}'); ${onConfirm}">${confirmText}</button>
                            ` : `
                                <button class="btn btn-outline" onclick="AlaisaiUI.dialog.close('${id}'); ${onCancel}">${cancelText}</button>
                                <button class="btn btn-primary" onclick="AlaisaiUI.dialog.close('${id}'); ${onConfirm}">${confirmText}</button>
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
        
        alert(message, title = 'تنبيه') {
            return this.show({
                title,
                message,
                type: 'alert',
                confirmText: 'موافق'
            });
        },
        
        confirm(message, onConfirm, onCancel, title = 'تأكيد') {
            return this.show({
                title,
                message,
                type: 'confirm',
                confirmText: 'نعم',
                cancelText: 'لا',
                onConfirm: onConfirm ? `(${onConfirm})()` : '',
                onCancel: onCancel ? `(${onCancel})()` : ''
            });
        },
        
        prompt(message, defaultValue = '', callback) {
            const id = 'prompt_' + Date.now();
            
            const promptHTML = `
                <div id="${id}" class="dialog-overlay animate-fade-in">
                    <div class="dialog-box animate-scale-in">
                        <div class="dialog-header">
                            <h3>إدخال</h3>
                            <button class="dialog-close" onclick="AlaisaiUI.dialog.close('${id}')">&times;</button>
                        </div>
                        <div class="dialog-body">
                            <p>${message}</p>
                            <input type="text" id="${id}_input" class="dialog-input" value="${defaultValue}">
                        </div>
                        <div class="dialog-footer">
                            <button class="btn btn-outline" onclick="AlaisaiUI.dialog.close('${id}')">إلغاء</button>
                            <button class="btn btn-primary" onclick="AlaisaiUI.dialog.handlePrompt('${id}', ${callback})">موافق</button>
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
            const {
                accept = '*/*',
                multiple = false,
                maxSize = 10 * 1024 * 1024, // 10MB
                onSelect = null,
                onUpload = null
            } = options;
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.multiple = multiple;
            input.style.display = 'none';
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                
                // التحقق من الحجم
                const validFiles = files.filter(f => f.size <= maxSize);
                if (validFiles.length !== files.length) {
                    AlaisaiUI.notifications.error('بعض الملفات أكبر من الحجم المسموح');
                }
                
                if (onSelect) {
                    onSelect(validFiles);
                }
                
                if (onUpload) {
                    for (const file of validFiles) {
                        await onUpload(file);
                    }
                }
            };
            
            document.body.appendChild(input);
            
            return {
                open: () => input.click(),
                destroy: () => input.remove()
            };
        }
    },
    
    // أداة السحب والإفلات
    draggable: {
        make(element, options = {}) {
            const {
                handle = null,
                onDragStart = null,
                onDrag = null,
                onDragEnd = null
            } = options;
            
            let isDragging = false;
            let startX, startY, initialX, initialY;
            
            const dragHandle = handle ? element.querySelector(handle) : element;
            
            dragHandle.style.cursor = 'grab';
            
            const onMouseDown = (e) => {
                if (e.button !== 0) return; // فقط الزر الأيسر
                
                e.preventDefault();
                
                const rect = element.getBoundingClientRect();
                startX = e.clientX;
                startY = e.clientY;
                initialX = rect.left;
                initialY = rect.top;
                
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
    
    // أداة البحث والتصفية
    filter: {
        filterList(items, searchTerm, fields = ['name']) {
            if (!searchTerm) return items;
            
            const term = searchTerm.toLowerCase();
            
            return items.filter(item => {
                return fields.some(field => {
                    const value = item[field];
                    return value && value.toString().toLowerCase().includes(term);
                });
            });
        },
        
        sortList(items, field, direction = 'asc') {
            return [...items].sort((a, b) => {
                let aVal = a[field];
                let bVal = b[field];
                
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();
                
                if (direction === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });
        }
    },
    
    // أداة النسخ
    clipboard: {
        async copy(text) {
            try {
                await navigator.clipboard.writeText(text);
                AlaisaiUI.notifications.success('تم النسخ');
                return true;
            } catch (err) {
                // طريقة بديلة
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
                const text = await navigator.clipboard.readText();
                return text;
            } catch (err) {
                AlaisaiUI.notifications.error('فشل اللصق');
                return null;
            }
        }
    }
};

// إضافة الأنماط اللازمة
const style = document.createElement('style');
style.textContent = `
    /* نظام الإشعارات */
    .notifications-container {
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 300px;
    }
    
    .notification {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation-duration: 0.3s;
    }
    
    .notification-success {
        background: #4ade80;
        color: white;
    }
    
    .notification-error {
        background: #f72585;
        color: white;
    }
    
    .notification-warning {
        background: #fbbf24;
        color: black;
    }
    
    .notification-info {
        background: #4cc9f0;
        color: white;
    }
    
    .notification-icon {
        font-size: 20px;
    }
    
    .notification-content {
        flex: 1;
        font-size: 14px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: currentColor;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.7;
        padding: 0;
    }
    
    .notification-close:hover {
        opacity: 1;
    }
    
    /* نظام الحوارات */
    .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .dialog-box {
        background: white;
        border-radius: 12px;
        min-width: 300px;
        max-width: 500px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    
    .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #dee2e6;
    }
    
    .dialog-header h3 {
        margin: 0;
        font-size: 18px;
    }
    
    .dialog-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    
    .dialog-body {
        padding: 20px;
    }
    
    .dialog-footer {
        padding: 15px 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
    
    .dialog-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        margin-top: 10px;
        font-size: 14px;
    }
    
    .dialog-input:focus {
        outline: none;
        border-color: #4cc9f0;
    }
`;

document.head.appendChild(style);

window.AlaisaiUI = AlaisaiUI;
console.log('🎨 Alaisai UI Kit جاهز للعمل');// Alaisai UI Kit
