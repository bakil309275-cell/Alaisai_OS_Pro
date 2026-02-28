/**
 * Alaisai Components - مكتبة المكونات القابلة لإعادة الاستخدام
 * @version 2.0.0
 */

const AlaisaiComponents = {
    version: '2.0.0',
    registry: new Map(),
    
    // تسجيل مكون
    register(name, component) {
        this.registry.set(name, {
            render: component.render,
            styles: component.styles || '',
            props: component.props || {},
            lifecycle: component.lifecycle || {},
            name
        });
        console.log(`🧩 تم تسجيل مكون: ${name}`);
        return this;
    },
    
    // إنشاء مكون
    render(name, props = {}, children = '') {
        const component = this.registry.get(name);
        if (!component) {
            console.error(`❌ المكون ${name} غير موجود`);
            return '';
        }
        
        const validatedProps = this._validateProps(component.props, props);
        
        if (component.lifecycle.beforeRender) {
            component.lifecycle.beforeRender(validatedProps);
        }
        
        let html = component.render(validatedProps, children);
        
        // دمج الأنماط (مرة واحدة لكل مكون)
        const styleId = `style-${name}`;
        if (component.styles && !document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = component.styles;
            document.head.appendChild(style);
        }
        
        return html;
    },
    
    _validateProps(definition, props) {
        const validated = { ...props };
        for (const [key, config] of Object.entries(definition)) {
            if (config.required && props[key] === undefined) {
                console.warn(`⚠️ Prop ${key} مطلوب`);
                validated[key] = config.default;
            } else if (props[key] === undefined && config.default !== undefined) {
                validated[key] = config.default;
            }
            
            // التحقق من النوع (بسيط)
            if (props[key] !== undefined && config.type) {
                const type = typeof props[key];
                if (type !== config.type && !(config.type === 'array' && Array.isArray(props[key]))) {
                    console.warn(`⚠️ Prop ${key} يجب أن يكون ${config.type}`);
                }
            }
        }
        return validated;
    },
    
    // دالة مساعدة للترجمة (اختصار)
    _t(key, params) {
        return window.AlaisaiI18n ? AlaisaiI18n.t(key, params) : key;
    }
};

// ========== المكونات ==========

// زر
AlaisaiComponents.register('Button', {
    render: (props, children) => {
        const {
            variant = 'primary',
            size = 'medium',
            disabled = false,
            onClick = '',
            fullWidth = false,
            icon = '',
            type = 'button'
        } = props;
        
        const classes = [
            'btn',
            `btn-${variant}`,
            `btn-${size}`,
            fullWidth ? 'btn-full' : '',
            disabled ? 'btn-disabled' : ''
        ].filter(Boolean).join(' ');
        
        const iconHtml = icon ? `<span class="btn-icon">${icon}</span>` : '';
        const text = children || AlaisaiComponents._t('__button');
        
        return `
            <button 
                type="${type}"
                class="${classes}"
                onclick="${onClick}"
                ${disabled ? 'disabled' : ''}
            >
                ${iconHtml}
                <span class="btn-text">${text}</span>
            </button>
        `;
    },
    styles: `
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }
        .btn-primary { background: var(--primary, #4cc9f0); color: white; }
        .btn-primary:hover { background: var(--primary-dark, #3aa8d0); }
        .btn-success { background: var(--success, #4ade80); color: white; }
        .btn-danger { background: var(--danger, #f72585); color: white; }
        .btn-outline {
            background: transparent;
            border: 2px solid var(--primary, #4cc9f0);
            color: var(--primary, #4cc9f0);
        }
        .btn-outline:hover {
            background: var(--primary, #4cc9f0);
            color: white;
        }
        .btn-small { padding: 6px 12px; font-size: 12px; }
        .btn-medium { padding: 10px 20px; font-size: 14px; }
        .btn-large { padding: 14px 28px; font-size: 16px; }
        .btn-full { width: 100%; }
        .btn-disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
        .btn-icon { font-size: 1.2em; line-height: 1; }
    `,
    props: {
        variant: { type: 'string', default: 'primary' },
        size: { type: 'string', default: 'medium' },
        disabled: { type: 'boolean', default: false },
        fullWidth: { type: 'boolean', default: false },
        icon: { type: 'string', default: '' }
    }
});

// بطاقة
AlaisaiComponents.register('Card', {
    render: (props, children) => {
        const {
            title = '',
            subtitle = '',
            image = '',
            footer = '',
            padding = 'medium',
            shadow = 'medium',
            border = true
        } = props;
        
        const classes = [
            'card',
            `card-padding-${padding}`,
            `card-shadow-${shadow}`,
            border ? 'card-border' : ''
        ].filter(Boolean).join(' ');
        
        return `
            <div class="${classes}">
                ${image ? `<div class="card-image"><img src="${image}" alt=""></div>` : ''}
                ${title ? `<h3 class="card-title">${title}</h3>` : ''}
                ${subtitle ? `<h4 class="card-subtitle">${subtitle}</h4>` : ''}
                <div class="card-content">${children}</div>
                ${footer ? `<div class="card-footer">${footer}</div>` : ''}
            </div>
        `;
    },
    styles: `
        .card {
            background: var(--bg-card, white);
            border-radius: 12px;
            overflow: hidden;
            color: var(--text-primary, #212529);
        }
        .card-padding-small { padding: 12px; }
        .card-padding-medium { padding: 20px; }
        .card-padding-large { padding: 28px; }
        .card-shadow-small { box-shadow: var(--shadow-sm, 0 2px 4px rgba(0,0,0,0.1)); }
        .card-shadow-medium { box-shadow: var(--shadow-md, 0 4px 8px rgba(0,0,0,0.15)); }
        .card-shadow-large { box-shadow: var(--shadow-lg, 0 8px 16px rgba(0,0,0,0.2)); }
        .card-border { border: 1px solid var(--border-light, #dee2e6); }
        .card-title { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; }
        .card-subtitle { margin: 0 0 12px 0; font-size: 14px; color: var(--text-muted, #6c757d); }
        .card-image { margin: -20px -20px 20px -20px; }
        .card-image img { width: 100%; height: auto; display: block; }
        .card-footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-light, #dee2e6); }
    `,
    props: {
        title: { type: 'string', default: '' },
        subtitle: { type: 'string', default: '' },
        image: { type: 'string', default: '' },
        footer: { type: 'string', default: '' }
    }
});

// نافذة منبثقة
AlaisaiComponents.register('Modal', {
    render: (props, children) => {
        const {
            id = 'modal',
            title = '',
            show = false,
            size = 'medium',
            closeOnClick = true,
            onClose = ''
        } = props;
        
        const tTitle = title.startsWith('__') ? AlaisaiComponents._t(title.slice(2)) : title;
        const closeScript = closeOnClick 
            ? `document.getElementById('${id}').classList.remove('modal-show'); ${onClose ? onClose + '()' : ''}` 
            : '';
        
        const classes = [
            'modal',
            `modal-${size}`,
            show ? 'modal-show' : ''
        ].filter(Boolean).join(' ');
        
        return `
            <div id="${id}" class="${classes}" onclick="${closeOnClick ? closeScript : ''}">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${tTitle}</h3>
                        <button class="modal-close" onclick="${closeScript}">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${children}
                    </div>
                </div>
            </div>
        `;
    },
    styles: `
        .modal {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-show { display: flex; }
        .modal-content {
            background: var(--bg-card, white);
            border-radius: 12px;
            max-width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            color: var(--text-primary, #212529);
        }
        .modal-small .modal-content { width: 300px; }
        .modal-medium .modal-content { width: 500px; }
        .modal-large .modal-content { width: 800px; }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid var(--border-light, #dee2e6);
        }
        .modal-header h3 { margin: 0; font-size: 18px; }
        .modal-close {
            background: none; border: none; font-size: 24px; cursor: pointer;
            color: var(--text-muted, #666); padding: 0; line-height: 1;
        }
        .modal-close:hover { color: var(--danger, #f72585); }
        .modal-body { padding: 20px; }
    `,
    props: {
        id: { type: 'string', default: 'modal' },
        title: { type: 'string', default: '' },
        show: { type: 'boolean', default: false },
        size: { type: 'string', default: 'medium' },
        closeOnClick: { type: 'boolean', default: true }
    }
});

// حقل إدخال
AlaisaiComponents.register('Input', {
    render: (props) => {
        const {
            type = 'text',
            placeholder = '',
            value = '',
            name = '',
            required = false,
            disabled = false,
            onChange = '',
            label = '',
            error = ''
        } = props;
        
        const tLabel = label.startsWith('__') ? AlaisaiComponents._t(label.slice(2)) : label;
        const tPlaceholder = placeholder.startsWith('__') ? AlaisaiComponents._t(placeholder.slice(2)) : placeholder;
        const tError = error.startsWith('__') ? AlaisaiComponents._t(error.slice(2)) : error;
        
        return `
            <div class="input-group ${error ? 'input-error' : ''}">
                ${label ? `<label class="input-label">${tLabel}</label>` : ''}
                <input
                    type="${type}"
                    name="${name}"
                    value="${value}"
                    placeholder="${tPlaceholder}"
                    ${required ? 'required' : ''}
                    ${disabled ? 'disabled' : ''}
                    onchange="${onChange}"
                    class="input-field"
                />
                ${error ? `<span class="input-error-message">${tError}</span>` : ''}
            </div>
        `;
    },
    styles: `
        .input-group { margin-bottom: 15px; }
        .input-label {
            display: block; margin-bottom: 5px; font-weight: 500;
            color: var(--text-primary, #212529);
        }
        .input-field {
            width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium, #ced4da);
            border-radius: 6px; background: var(--bg-input, white);
            color: var(--text-primary, #212529); font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-field:focus {
            outline: none; border-color: var(--primary, #4cc9f0);
            box-shadow: 0 0 0 3px rgba(76, 201, 240, 0.2);
        }
        .input-error .input-field { border-color: var(--danger, #f72585); }
        .input-error-message {
            display: block; margin-top: 5px; font-size: 12px; color: var(--danger, #f72585);
        }
    `,
    props: {
        type: { type: 'string', default: 'text' },
        placeholder: { type: 'string', default: '' },
        value: { type: 'string', default: '' },
        name: { type: 'string', default: '' },
        required: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        label: { type: 'string', default: '' },
        error: { type: 'string', default: '' }
    }
});

// تسجيل في النواة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiComponents', AlaisaiComponents);
}

window.AlaisaiComponents = AlaisaiComponents;
console.log('🧩 Alaisai Components جاهزة للعمل (نسخة متكاملة)');