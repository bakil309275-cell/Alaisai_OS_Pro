/**
 * Alaisai i18n - نظام الترجمة والدولنة المتقدم
 * @version 2.0.0
 */

const AlaisaiI18n = {
    version: '2.0.0',
    locale: 'ar',
    fallback: 'en',
    translations: new Map(),
    formatters: new Map(),
    
    locales: {
        ar: { name: 'العربية', dir: 'rtl', code: 'ar' },
        en: { name: 'English', dir: 'ltr', code: 'en' }
    },
    
    // تهيئة النظام
    init(options = {}) {
        this.locale = options.locale || localStorage.getItem('alaisai_locale') || 'ar';
        this.fallback = options.fallback || 'en';
        
        this.loadDefaultTranslations();
        this.applyDirection();
        
        console.log(`🌐 Alaisai i18n initialized with locale: ${this.locale}`);
        return this;
    },
    
    // تطبيق اتجاه الصفحة
    applyDirection() {
        document.documentElement.dir = this.locales[this.locale]?.dir || 'rtl';
        document.documentElement.lang = this.locale;
    },
    
    // تحميل الترجمات الافتراضية مع مفردات الوقت
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
            'confirm': 'تأكيد',
            'success': 'نجاح',
            'error': 'خطأ',
            'warning': 'تحذير',
            'info': 'معلومات',
            
            // الوقت
            'days': '{count} يوم | {count} أيام',
            'hours': '{count} ساعة | {count} ساعات',
            'minutes': '{count} دقيقة | {count} دقائق',
            'seconds': '{count} ثانية | {count} ثواني',
            'now': 'الآن',
            'yesterday': 'أمس',
            'tomorrow': 'غداً',
            'today': 'اليوم',
            
            // التطبيقات
            'apps': 'التطبيقات',
            'addons': 'الإضافات',
            'settings.system': 'إعدادات النظام',
            'settings.account': 'إعدادات الحساب',
            
            // الحالة
            'online': 'متصل',
            'offline': 'غير متصل',
            'active': 'نشط',
            'inactive': 'غير نشط',
            'pending': 'قيد الانتظار',
            'completed': 'مكتمل',
            'failed': 'فشل',
            
            // واجهة المستخدم
            'close': 'إغلاق',
            'open': 'فتح',
            'back': 'رجوع',
            'next': 'التالي',
            'previous': 'السابق',
            'submit': 'إرسال',
            'reset': 'إعادة ضبط'
        });
        
        // الإنجليزية
        this.addTranslations('en', {
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
            'confirm': 'Confirm',
            'success': 'Success',
            'error': 'Error',
            'warning': 'Warning',
            'info': 'Info',
            
            'days': '{count} day | {count} days',
            'hours': '{count} hour | {count} hours',
            'minutes': '{count} minute | {count} minutes',
            'seconds': '{count} second | {count} seconds',
            'now': 'Now',
            'yesterday': 'Yesterday',
            'tomorrow': 'Tomorrow',
            'today': 'Today',
            
            'apps': 'Apps',
            'addons': 'Addons',
            'settings.system': 'System Settings',
            'settings.account': 'Account Settings',
            
            'online': 'Online',
            'offline': 'Offline',
            'active': 'Active',
            'inactive': 'Inactive',
            'pending': 'Pending',
            'completed': 'Completed',
            'failed': 'Failed',
            
            'close': 'Close',
            'open': 'Open',
            'back': 'Back',
            'next': 'Next',
            'previous': 'Previous',
            'submit': 'Submit',
            'reset': 'Reset'
        });
    },
    
    // إضافة ترجمات
    addTranslations(locale, translations) {
        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }
        Object.assign(this.translations.get(locale), translations);
        return this;
    },
    
    // ترجمة مع دعم الجمع (pluralization)
    t(key, params = {}, locale = null) {
        const targetLocale = locale || this.locale;
        let translation = this.translations.get(targetLocale)?.[key];
        
        if (translation === undefined && targetLocale !== this.fallback) {
            translation = this.translations.get(this.fallback)?.[key];
        }
        
        if (translation === undefined) return key;
        
        // دعم صيغ الجمع (مثل: "{count} يوم|{count} أيام")
        if (typeof translation === 'string' && translation.includes('|')) {
            const forms = translation.split('|');
            const count = params.count || 0;
            if (count === 1) translation = forms[0];
            else translation = forms[1] || forms[0];
        }
        
        return this.interpolate(translation, params);
    },
    
    interpolate(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    },
    
    // تغيير اللغة
    setLocale(locale) {
        if (!this.locales[locale]) return false;
        this.locale = locale;
        this.applyDirection();
        localStorage.setItem('alaisai_locale', locale);
        
        // إطلاق حدث لتحديث واجهات المستخدم
        window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale } }));
        if (window.AlaisaiCore) {
            AlaisaiCore.emit('i18n:localeChanged', { locale });
        }
        
        console.log(`🌐 تم تغيير اللغة إلى: ${this.locales[locale].name}`);
        return true;
    },
    
    // تنسيق الأرقام
    formatNumber(number, options = {}) {
        try {
            return new Intl.NumberFormat(this.locale, options).format(number);
        } catch {
            return number.toString();
        }
    },
    
    // تنسيق التاريخ مع دعم اللغة
    formatDate(date, options = {}) {
        try {
            const d = date instanceof Date ? date : new Date(date);
            return new Intl.DateTimeFormat(this.locale, options).format(d);
        } catch {
            return String(date);
        }
    },
    
    // تنسيق الوقت النسبي باستخدام الترجمة
    formatRelativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diffSeconds = Math.floor((now - then) / 1000);
        const absDiff = Math.abs(diffSeconds);
        
        if (absDiff < 60) return this.t('seconds', { count: absDiff });
        if (absDiff < 3600) return this.t('minutes', { count: Math.floor(absDiff / 60) });
        if (absDiff < 86400) return this.t('hours', { count: Math.floor(absDiff / 3600) });
        return this.t('days', { count: Math.floor(absDiff / 86400) });
    },
    
    // هل اللغة RTL؟
    isRTL(locale = this.locale) {
        return this.locales[locale]?.dir === 'rtl';
    }
};

// تهيئة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiI18n', AlaisaiI18n);
    AlaisaiI18n.init();
} else {
    window.AlaisaiI18n = AlaisaiI18n.init();
}

console.log('🌐 Alaisai i18n جاهز للعمل (مع دعم الجمع والأحداث)');