/**
 * Alaisai i18n - نظام الترجمة والدولنة
 * @version 1.2.0
 */

const AlaisaiI18n = {
    version: '1.2.0',
    locale: 'ar',
    fallback: 'en',
    translations: new Map(),
    formatters: new Map(),
    
    // اللغات المدعومة
    locales: {
        ar: {
            name: 'العربية',
            dir: 'rtl',
            code: 'ar'
        },
        en: {
            name: 'English',
            dir: 'ltr',
            code: 'en'
        }
    },
    
    // تهيئة النظام
    init(options = {}) {
        this.locale = options.locale || 'ar';
        this.fallback = options.fallback || 'en';
        
        // تحميل الترجمات الافتراضية
        this.loadDefaultTranslations();
        
        console.log(`🌐 Alaisai i18n initialized with locale: ${this.locale}`);
        return this;
    },
    
    // تحميل الترجمات الافتراضية
    loadDefaultTranslations() {
        // العربية
        this.addTranslations('ar', {
            // عام
            'welcome': 'مرحباً بك',
            'loading': 'جاري التحميل...',
            'save': 'حفظ',
            'cancel': 'إلغاء',
            'delete': 'حذف',
            'edit': 'تعديل',
            'add': 'إضافة',
            'search': 'بحث',
            'settings': 'الإعدادات',
            'language': 'اللغة',
            'theme': 'المظهر',
            'dark': 'داكن',
            'light': 'فاتح',
            'system': 'النظام',
            
            // الأخطاء
            'error': 'خطأ',
            'success': 'نجاح',
            'warning': 'تحذير',
            'info': 'معلومات',
            'confirm': 'تأكيد',
            
            // التطبيقات
            'apps': 'التطبيقات',
            'addons': 'الإضافات',
            'settings.system': 'إعدادات النظام',
            'settings.account': 'إعدادات الحساب',
            
            // الوقت
            'today': 'اليوم',
            'yesterday': 'أمس',
            'tomorrow': 'غداً',
            'days': 'أيام',
            'hours': 'ساعات',
            'minutes': 'دقائق',
            'seconds': 'ثواني',
            
            // الحالة
            'online': 'متصل',
            'offline': 'غير متصل',
            'active': 'نشط',
            'inactive': 'غير نشط',
            'pending': 'قيد الانتظار',
            'completed': 'مكتمل',
            'failed': 'فشل'
        });
        
        // الإنجليزية
        this.addTranslations('en', {
            // General
            'welcome': 'Welcome',
            'loading': 'Loading...',
            'save': 'Save',
            'cancel': 'Cancel',
            'delete': 'Delete',
            'edit': 'Edit',
            'add': 'Add',
            'search': 'Search',
            'settings': 'Settings',
            'language': 'Language',
            'theme': 'Theme',
            'dark': 'Dark',
            'light': 'Light',
            'system': 'System',
            
            // Errors
            'error': 'Error',
            'success': 'Success',
            'warning': 'Warning',
            'info': 'Info',
            'confirm': 'Confirm',
            
            // Apps
            'apps': 'Apps',
            'addons': 'Addons',
            'settings.system': 'System Settings',
            'settings.account': 'Account Settings',
            
            // Time
            'today': 'Today',
            'yesterday': 'Yesterday',
            'tomorrow': 'Tomorrow',
            'days': 'days',
            'hours': 'hours',
            'minutes': 'minutes',
            'seconds': 'seconds',
            
            // Status
            'online': 'Online',
            'offline': 'Offline',
            'active': 'Active',
            'inactive': 'Inactive',
            'pending': 'Pending',
            'completed': 'Completed',
            'failed': 'Failed'
        });
    },
    
    // إضافة ترجمات
    addTranslations(locale, translations) {
        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }
        
        const current = this.translations.get(locale);
        Object.assign(current, translations);
        
        return this;
    },
    
    // ترجمة نص
    t(key, params = {}, locale = null) {
        const targetLocale = locale || this.locale;
        
        // البحث في اللغة المطلوبة
        let translation = this.translations.get(targetLocale)?.[key];
        
        // إذا لم نجد، نبحث في اللغة الاحتياطية
        if (translation === undefined && targetLocale !== this.fallback) {
            translation = this.translations.get(this.fallback)?.[key];
        }
        
        // إذا لم نجد، نرجع المفتاح نفسه
        if (translation === undefined) {
            return key;
        }
        
        // استبدال المتغيرات
        return this.interpolate(translation, params);
    },
    
    // استبدال المتغيرات في النص
    interpolate(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    },
    
    // تغيير اللغة
    setLocale(locale) {
        if (this.locales[locale]) {
            this.locale = locale;
            
            // تحديث اتجاه الصفحة
            document.documentElement.dir = this.locales[locale].dir;
            document.documentElement.lang = locale;
            
            // حفظ التفضيل
            localStorage.setItem('alaisai_locale', locale);
            
            console.log(`🌐 تم تغيير اللغة إلى: ${this.locales[locale].name}`);
            
            // إطلاق حدث
            window.dispatchEvent(new CustomEvent('locale:changed', { 
                detail: { locale, direction: this.locales[locale].dir }
            }));
            
            return true;
        }
        return false;
    },
    
    // تنسيق الأرقام
    formatNumber(number, options = {}) {
        try {
            return new Intl.NumberFormat(this.locale, options).format(number);
        } catch {
            return number.toString();
        }
    },
    
    // تنسيق التواريخ
    formatDate(date, options = {}) {
        try {
            const d = date instanceof Date ? date : new Date(date);
            return new Intl.DateTimeFormat(this.locale, options).format(d);
        } catch {
            return String(date);
        }
    },
    
    // تنسيق العملات
    formatCurrency(amount, currency = 'SAR') {
        try {
            return new Intl.NumberFormat(this.locale, {
                style: 'currency',
                currency
            }).format(amount);
        } catch {
            return `${amount} ${currency}`;
        }
    },
    
    // تنسيق الوقت النسبي (منذ...)
    formatRelativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diff = now - then;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return this.t('days', { count: days });
        }
        if (hours > 0) {
            return this.t('hours', { count: hours });
        }
        if (minutes > 0) {
            return this.t('minutes', { count: minutes });
        }
        return this.t('seconds', { count: seconds });
    },
    
    // إضافة مُنسق مخصص
    addFormatter(name, formatter) {
        this.formatters.set(name, formatter);
        return this;
    },
    
    // استخدام مُنسق مخصص
    format(name, value, ...args) {
        const formatter = this.formatters.get(name);
        if (formatter) {
            return formatter(value, ...args);
        }
        return value;
    },
    
    // قائمة اللغات المتاحة
    getAvailableLocales() {
        return Object.entries(this.locales).map(([code, info]) => ({
            code,
            ...info
        }));
    },
    
    // هل اللغة RTL؟
    isRTL(locale = this.locale) {
        return this.locales[locale]?.dir === 'rtl';
    }
};

// تهيئة النظام
AlaisaiI18n.init({
    locale: localStorage.getItem('alaisai_locale') || 'ar'
});

window.AlaisaiI18n = AlaisaiI18n;
console.log('🌐 Alaisai i18n جاهز للعمل');// Alaisai i18n v1.2.0
