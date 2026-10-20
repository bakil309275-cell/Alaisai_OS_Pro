/**
 * Alaisai Formatters - أدوات تنسيق البيانات
 * @version 1.0.0
 */

const AlaisaiFormatters = {
    version: '1.0.0',
    
    // تنسيق العملة
    currency(amount, currency = 'SAR', locale = 'ar-SA') {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (e) {
            return `${amount} ${currency}`;
        }
    },
    
    // تنسيق رقم
    number(number, options = {}) {
        const {
            decimals = 2,
            locale = 'ar-SA',
            style = 'decimal'
        } = options;
        
        try {
            return new Intl.NumberFormat(locale, {
                style: style,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(number);
        } catch (e) {
            return number.toString();
        }
    },
    
    // تنسيق نسبة مئوية
    percent(number, decimals = 2, locale = 'ar-SA') {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'percent',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(number / 100);
        } catch (e) {
            return `${number}%`;
        }
    },
    
    // تنسيق تاريخ
    date(date, options = {}) {
        const d = new Date(date);
        
        const {
            format = 'short',
            locale = 'ar-SA'
        } = options;
        
        try {
            if (format === 'short') {
                return d.toLocaleDateString(locale);
            } else if (format === 'long') {
                return d.toLocaleDateString(locale, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else if (format === 'time') {
                return d.toLocaleTimeString(locale);
            } else if (format === 'full') {
                return d.toLocaleString(locale);
            } else if (format === 'iso') {
                return d.toISOString();
            } else if (format === 'relative') {
                return this.relativeTime(date);
            }
        } catch (e) {
            return String(date);
        }
        
        return d.toLocaleDateString(locale);
    },
    
    // تنسيق الوقت النسبي (منذ...)
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
        
        if (years > 0) {
            return years === 1 ? 'منذ سنة' : `منذ ${years} سنوات`;
        } else if (months > 0) {
            return months === 1 ? 'منذ شهر' : `منذ ${months} أشهر`;
        } else if (days > 0) {
            return days === 1 ? 'منذ يوم' : `منذ ${days} أيام`;
        } else if (hours > 0) {
            return hours === 1 ? 'منذ ساعة' : `منذ ${hours} ساعات`;
        } else if (minutes > 0) {
            return minutes === 1 ? 'منذ دقيقة' : `منذ ${minutes} دقائق`;
        } else {
            return 'الآن';
        }
    },
    
    // تنسيق حجم الملف
    fileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // تنسيق رقم الهاتف
    phone(phone, country = 'SA') {
        // إزالة المسافات والرموز
        const cleaned = phone.replace(/\D/g, '');
        
        if (country === 'SA') {
            // تنسيق سعودي: 05XX XXX XXX
            if (cleaned.length === 10 && cleaned.startsWith('05')) {
                return cleaned.replace(/(05)(\d{2})(\d{3})(\d{3})/, '$1$2 $3 $4');
            } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
                return '0' + cleaned.replace(/(5)(\d{2})(\d{3})(\d{3})/, '$1$2 $3 $4');
            } else if (cleaned.length === 12 && cleaned.startsWith('966')) {
                return '0' + cleaned.slice(3).replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3');
            }
        }
        
        // تنسيق دولي: +XXX XXX XXX XXX
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
    
    // تنسيق اسم (أحرف كبيرة)
    name(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },
    
    // تنسيق عنوان بريد إلكتروني (إخفاء جزئي)
    maskEmail(email) {
        const [local, domain] = email.split('@');
        
        if (local.length <= 3) {
            return local[0] + '***@' + domain;
        }
        
        const visibleChars = 3;
        const maskedLocal = local.slice(0, visibleChars) + '*'.repeat(local.length - visibleChars);
        
        return maskedLocal + '@' + domain;
    },
    
    // تنسيق رقم (إخفاء جزئي)
    maskNumber(number, visibleDigits = 4) {
        const str = number.toString();
        const masked = '*'.repeat(Math.max(0, str.length - visibleDigits)) + str.slice(-visibleDigits);
        
        return masked;
    },
    
    // تنسيق نص (اقتطاع)
    truncate(text, length = 100, suffix = '...') {
        if (text.length <= length) return text;
        return text.substring(0, length) + suffix;
    },
    
    // تنسيق عنوان URL (اختصار)
    shortenUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        
        const start = url.substring(0, 25);
        const end = url.substring(url.length - 20);
        
        return start + '...' + end;
    },
    
    // تنسيق وقت (ساعات:دقائق)
    time(date, options = {}) {
        const d = new Date(date);
        const {
            format = '24h',
            withSeconds = false,
            locale = 'ar-SA'
        } = options;
        
        try {
            if (format === '12h') {
                return d.toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: withSeconds ? '2-digit' : undefined,
                    hour12: true
                });
            } else {
                return d.toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: withSeconds ? '2-digit' : undefined,
                    hour12: false
                });
            }
        } catch (e) {
            return d.toLocaleTimeString();
        }
    },
    
    // تنسيق JSON (للقراءة)
    prettyJSON(obj) {
        return JSON.stringify(obj, null, 2);
    },
    
    // تنسيق مصفوفة كنص
    arrayToList(array, separator = '، ') {
        if (array.length === 0) return '';
        if (array.length === 1) return array[0];
        if (array.length === 2) return array.join(' و ');
        
        const last = array.pop();
        return array.join(separator) + ' و ' + last;
    },
    
    // تنسيق عنوان (إزالة التكرار)
    cleanAddress(address) {
        return address
            .split(' ')
            .filter((word, index, self) => self.indexOf(word) === index)
            .join(' ');
    },
    
    // تنسيق أحرف (إزالة التشكيل)
    removeDiacritics(text) {
        const diacritics = /[ًٌٍَُِ~ّْ]/g;
        return text.replace(diacritics, '');
    },
    
    // تنسيق للرابط (slug)
    slug(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    },
    
    // تنسيق أول حرف كبير
    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    },
    
    // تنسيق أول حرف كبير لكل كلمة
    capitalizeWords(text) {
        return text
            .split(' ')
            .map(word => this.capitalize(word))
            .join(' ');
    },
    
    // تنسيق عكسي (أحرف صغيرة)
    lowercase(text) {
        return text.toLowerCase();
    },
    
    // تنسيق عكسي (أحرف كبيرة)
    uppercase(text) {
        return text.toUpperCase();
    },
    
    // تنسيق وإزالة المسافات الزائدة
    normalizeSpaces(text) {
        return text
            .replace(/\s+/g, ' ')
            .trim();
    },
    
    // تنسيق رقم عشوائي (للتجربة)
    random(min = 0, max = 100) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

window.AlaisaiFormatters = AlaisaiFormatters;
console.log('🎨 Alaisai Formatters جاهز للعمل');// Alaisai Formatters
