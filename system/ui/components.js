/**
 * Alaisai Components - مكتبة المكونات القابلة لإعادة الاستخدام
 * @version 1.4.0
 */

const AlaisaiComponents = {
    version: '1.4.0',
    registry: new Map(),
    themes: new Map(),
    
    // تسجيل مكون
    register(name, component) {
        this.registry.set(name, {
            render: component.render || component,
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
        
        // التحقق من props
        const validatedProps = this.validateProps(component.props, props);
        
        // تنفيذ beforeRender
        if (component.lifecycle.beforeRender) {
            component.lifecycle.beforeRender(validatedProps);
        }
        
        // إنشاء HTML
        let html = component.render(validatedProps, children);
        
        // إضافة الأنماط
        if (component.styles) {
            html = `<style>${component.styles}</style>${html}`;
        }
        
        return html;
    },
    
    // التحقق من props
    validateProps(definition, props) {
        const validated = { ...props };
        
        Object.entries(definition).forEach(([key, config]) => {
            if (config.required && props[key] === undefined) {
                console.warn(`⚠️ Prop ${key} مطلوب لكنه غير موجود`);
                validated[key] = config.default;
            }
            
            if (props[key] === undefined && config.default !== undefined) {
                validated[key] = config.default;
            }
            
            // التحقق من النوع
            if (props[key] !== undefined && config.type) {
                const type = typeof props[key];
                if (type !== config.type) {
                    console.warn(`⚠️ Prop ${key} يجب أن يكون ${config.type} لكنه ${type}`);
                }
            }
        });
        
        return validated;
    },
    
    // إنشاء زر
    Button: {
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
            
            return `
                <button 
                    type="${type}"
                    class="${classes}"
                    onclick="${onClick}"
                    ${disabled ? 'disabled' : ''}
                >
                    ${iconHtml}
                    <span class="btn-text">${children}</span>
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
            
            .btn-primary {
                background: #4cc9f0;
                color: white;
            }
            .btn-primary:hover { background: #3aa8d0; }
            
            .btn-success {
                background: #4ade80;
                color: white;
            }
            .btn-success:hover { background: #3bc46a; }
            
            .btn-danger {
                background: #f72585;
                color: white;
            }
            .btn-danger:hover { background: #d41e6e; }
            
            .btn-outline {
                background: transparent;
                border: 2px solid #4cc9f0;
                color: #4cc9f0;
            }
            .btn-outline:hover {
                background: #4cc9f0;
                color: white;
            }
            
            .btn-small { padding: 6px 12px; font-size: 12px; }
            .btn-medium { padding: 10px 20px; font-size: 14px; }
            .btn-large { padding: 14px 28px; font-size: 16px; }
            
            .btn-full { width: 100%; }
            
            .btn-disabled {
                opacity: 0.5;
                cursor: not-allowed;
                pointer-events: none;
            }
            
            .btn-icon {
                font-size: 1.2em;
                line-height: 1;
            }
        `,
        props: {
            variant: { type: 'string', default: 'primary' },
            size: { type: 'string', default: 'medium' },
            disabled: { type: 'boolean', default: false },
            fullWidth: { type: 'boolean', default: false },
            icon: { type: 'string', default: '' }
        }
    },
    
    // إنشاء بطاقة
    Card: {
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
                background: white;
                border-radius: 12px;
                overflow: hidden;
            }
            
            .card-padding-small { padding: 12px; }
            .card-padding-medium { padding: 20px; }
            .card-padding-large { padding: 28px; }
            
            .card-shadow-small { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .card-shadow-medium { box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
            .card-shadow-large { box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
            
            .card-border { border: 1px solid rgba(0,0,0,0.1); }
            
            .card-title {
                margin: 0 0 8px 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .card-subtitle {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: #666;
                font-weight: normal;
            }
            
            .card-image {
                margin: -20px -20px 20px -20px;
            }
            .card-image img {
                width: 100%;
                height: auto;
                display: block;
            }
            
            .card-footer {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid rgba(0,0,0,0.1);
            }
        `
    },
    
    // إنشاء نموذج
    Modal: {
        render: (props, children) => {
            const {
                id = 'modal',
                title = '',
                show = false,
                size = 'medium',
                closeOnClick = true
            } = props;
            
            const classes = [
                'modal',
                `modal-${size}`,
                show ? 'modal-show' : ''
            ].filter(Boolean).join(' ');
            
            return `
                <div id="${id}" class="${classes}" onclick="${closeOnClick ? 'this.classList.remove(\'modal-show\')' : ''}">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h3>${title}</h3>
                            <button class="modal-close" onclick="document.getElementById('${id}').classList.remove('modal-show')">&times;</button>
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
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            .modal-show {
                display: flex;
            }
            
            .modal-content {
                background: white;
                border-radius: 12px;
                max-width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .modal-small .modal-content { width: 300px; }
            .modal-medium .modal-content { width: 500px; }
            .modal-large .modal-content { width: 800px; }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid rgba(0,0,0,0.1);
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                line-height: 1;
            }
            
            .modal-close:hover {
                color: #f72585;
            }
            
            .modal-body {
                padding: 20px;
            }
        `
    }
};

// تسجيل المكونات الأساسية
AlaisaiComponents.register('Button', AlaisaiComponents.Button);
AlaisaiComponents.register('Card', AlaisaiComponents.Card);
AlaisaiComponents.register('Modal', AlaisaiComponents.Modal);

window.AlaisaiComponents = AlaisaiComponents;
console.log('🧩 Alaisai Components جاهزة للعمل');// Alaisai Components
