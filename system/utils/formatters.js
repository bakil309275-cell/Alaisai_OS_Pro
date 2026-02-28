/**
 * Alaisai Formatters - أدوات تنسيق البيانات المتقدمة
 * @version 2.0.0
 */

const AlaisaiFormatters = {
    version: '2.0.0',
    
    // تنسيق العملة
    currency(amount, currency = 'SAR', locale = null) {
        const loc = locale || (window.AlaisaiI18n ? AlaisaiI18n.locale : 'ar-SA');
        try {
            return new Intl.NumberFormat(loc === 'ar' ? 'ar-SA' : loc, {
                style: 'currency',
                currency
            }).format(amount);
        } catch {
            return `${amount} ${currency}`;
        }
    },
    
    // تنسيق رقم
    number(number, options = {}) {
        const { decimals = 2, locale = null, style = 'decimal' } = options;
        const loc = locale || (window.AlaisaiI18n ? AlaisaiI18n.locale : 'ar-SA');
        try {
            return new Intl.NumberFormat(loc === 'ar' ? 'ar-SA' : loc, {
                style,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(number);
        } catch {
            return number.toString();
        }
    },
    
    // تنسيق نسبة مئوية
    percent(number, decimals = 2, locale = null) {
        return this.number(number / 100, { decimals, style: 'percent', locale });
    },
    
    // تنسيق تاريخ
    date(date, options = {}) {
        const { format = 'short', locale = null } = options;
        const loc = locale || (window.AlaisaiI18n ? AlaisaiI18n.locale : 'ar-SA');
        const d = new Date(date);
        try {
            if (format === 'short') return d.toLocaleDateString(loc === 'ar' ? 'ar-SA' : loc);
            if (format === 'long') return d.toLocaleDateString(loc === 'ar' ? 'ar-SA' : loc, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            if (format === 'time') return d.toLocaleTimeString(loc === 'ar' ? 'ar-SA' : loc);
            if (format === 'full') return d.toLocaleString(loc === 'ar' ? 'ar-SA' : loc);
            if (format === 'iso') return d.toISOString();
            if (format === 'relative') return this.relativeTime(date);
        } catch {}
        return d.toLocaleDateString();
    },
    
    // الوقت النسبي
    relativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diff = now - then;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(months / 12);
        
        if (years > 0) return years === 1 ? 'منذ سنة' : `منذ ${years} سنوات`;
        if (months > 0) return months === 1 ? 'منذ شهر' : `منذ ${months} أشهر`;
        if (days > 0) return days === 1 ? 'منذ يوم' : `منذ ${days} أيام`;
        if (hours > 0) return hours === 1 ? 'منذ ساعة' : `منذ ${hours} ساعات`;
        if (minutes > 0) return minutes === 1 ? 'منذ دقيقة' : `منذ ${minutes} دقائق`;
        return 'الآن';
    },
    
    // تنسيق حجم الملف
    fileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // تنسيق رقم هاتف (دولي أو سعودي)
    phone(phone, country = 'SA') {
        const cleaned = phone.replace(/\D/g, '');
        if (country === 'SA') {
            if (cleaned.length === 10 && cleaned.startsWith('05')) {
                return cleaned.replace(/(05)(\d{2})(\d{3})(\d{3})/, '$1$2 $3 $4');
            } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
                return '0' + cleaned.replace(/(5)(\d{2})(\d{3})(\d{3})/, '$1$2 $3 $4');
            } else if (cleaned.length === 12 && cleaned.startsWith('966')) {
                return '+966 ' + cleaned.slice(3).replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3');
            }
        }
        if (cleaned.length > 10) {
            return '+' + cleaned.replace(/(\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
        }
        return phone;
    },
    
    // تنسيق بطاقة هوية
    idNumber(id, country = 'SA') {
        const cleaned = id.replace(/\D/g, '');
        if (country === 'SA' && cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{4})/, '$1 $2 $3 $4');
        }
        return id;
    },
    
    // تنسيق اسم (capitalize)
    name(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },
    
    // إخفاء جزئي للبريد الإلكتروني
    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (local.length <= 3) return local[0] + '***@' + domain;
        return local.slice(0, 3) + '*'.repeat(local.length - 3) + '@' + domain;
    },
    
    // إخفاء جزئي للرقم
    maskNumber(number, visibleDigits = 4) {
        const str = number.toString();
        return '*'.repeat(Math.max(0, str.length - visibleDigits)) + str.slice(-visibleDigits);
    },
    
    // اقتطاع نص
    truncate(text, length = 100, suffix = '...') {
        if (text.length <= length) return text;
        return text.substring(0, length) + suffix;
    },
    
    // تقصير رابط
    shortenUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, 25) + '...' + url.substring(url.length - 20);
    },
    
    // تنسيق وقت
    time(date, options = {}) {
        const { format = '24h', withSeconds = false, locale = null } = options;
        const loc = locale || (window.AlaisaiI18n ? AlaisaiI18n.locale : 'ar-SA');
        const d = new Date(date);
        try {
            return d.toLocaleTimeString(loc === 'ar' ? 'ar-SA' : loc, {
                hour: '2-digit', minute: '2-digit',
                second: withSeconds ? '2-digit' : undefined,
                hour12: format === '12h'
            });
        } catch {
            return d.toLocaleTimeString();
        }
    },
    
    // تنسيق JSON مقروء
    prettyJSON(obj) {
        return JSON.stringify(obj, null, 2);
    },
    
    // تحويل مصفوفة إلى نص (مع و)
    arrayToList(array, separator = '، ') {
        if (!array.length) return '';
        if (array.length === 1) return array[0];
        if (array.length === 2) return array.join(' و ');
        const last = array.pop();
        return array.join(separator) + ' و ' + last;
    },
    
    // إزالة التشكيل
    removeDiacritics(text) {
        const diacritics = /[ًٌٍَُِ~ّْ]/g;
        return text.replace(diacritics, '');
    },
    
    // توليد slug (يعتمد على helpers لكن هنا للاكتمال)
    slug(text) {
        return window.AlaisaiHelpers ? AlaisaiHelpers.slugify(text) : text.replace(/\s+/g, '-');
    }
};

if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiFormatters', AlaisaiFormatters);
}

window.AlaisaiFormatters = AlaisaiFormatters;
console.log('🎨 Alaisai Formatters جاهز للعمل');