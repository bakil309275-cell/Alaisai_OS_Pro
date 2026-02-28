/**
 * Alaisai Helpers - دوال مساعدة عامة
 * @version 2.0.0
 */

const AlaisaiHelpers = {
    version: '2.0.0',
    
    // تنسيق التاريخ مع i18n
    formatDate(date, format = 'short') {
        const d = new Date(date);
        if (window.AlaisaiI18n) {
            const locale = AlaisaiI18n.locale;
            if (format === 'short') return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale);
            if (format === 'long') return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (format === 'time') return d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : locale);
            if (format === 'full') return d.toLocaleString(locale === 'ar' ? 'ar-SA' : locale);
        }
        return d.toISOString();
    },
    
    // إنشاء معرف فريد
    generateId(prefix = 'id') {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // نسخ نص
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        }
    },
    
    // تحميل ملف
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // قراءة ملف
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    // تأخير
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // إزالة التكرار
    uniqueArray(arr) {
        return [...new Set(arr)];
    },
    
    // دمج كائنات
    mergeObjects(...objects) {
        return Object.assign({}, ...objects);
    },
    
    // اقتطاع نص مع مراعاة العربية
    truncateText(text, maxLength = 100, suffix = '...') {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + suffix;
    },
    
    // تحويل النص إلى slug (يدعم العربية)
    slugify(text) {
        // تحويل الحروف العربية إلى ما يشبه الحروف اللاتينية (اختياري) أو استبدال المسافات
        const arabicToLatin = {
            'أ': 'a', 'إ': 'e', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
            'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
            'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
            'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
            'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'h', 'ى': 'a'
        };
        
        let slug = text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, (match) => {
                // إذا كانت أحرف عربية، نحولها
                return match.split('').map(c => arabicToLatin[c] || '').join('');
            })
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
        
        return slug || 'slug';
    },
    
    // الحصول على معلمات URL
    getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return Object.fromEntries(params.entries());
    },
    
    // تخزين مع انتهاء صلاحية
    setWithExpiry(key, value, ttlMinutes) {
        const item = {
            value,
            expiry: Date.now() + ttlMinutes * 60 * 1000
        };
        localStorage.setItem(key, JSON.stringify(item));
    },
    
    getWithExpiry(key) {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;
        try {
            const item = JSON.parse(itemStr);
            if (Date.now() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            return item.value;
        } catch {
            return null;
        }
    },
    
    // تجميع مصفوفة
    groupBy(array, key) {
        return array.reduce((result, item) => {
            (result[item[key]] = result[item[key]] || []).push(item);
            return result;
        }, {});
    },
    
    // ترتيب مصفوفة
    sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            if (order === 'asc') return aVal > bVal ? 1 : -1;
            else return aVal < bVal ? 1 : -1;
        });
    },
    
    // تصفية مصفوفة
    filterBy(array, searchTerm, fields = ['name']) {
        if (!searchTerm) return array;
        const term = searchTerm.toLowerCase();
        return array.filter(item => fields.some(field => {
            const value = item[field];
            return value && value.toString().toLowerCase().includes(term);
        }));
    },
    
    // تنسيق حجم الملف
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // إنشاء عنصر HTML
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        }
        for (const child of children) {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        }
        return element;
    },
    
    // إزالة HTML
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }
};

if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiHelpers', AlaisaiHelpers);
}

window.AlaisaiHelpers = AlaisaiHelpers;
console.log('🛠️ Alaisai Helpers جاهز للعمل');