/**
 * Alaisai Validators - أدوات التحقق من البيانات المتقدمة
 * @version 2.0.0
 */

const AlaisaiValidators = {
    version: '2.0.0',
    
    // بريد إلكتروني
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
            valid: re.test(email),
            message: 'البريد الإلكتروني غير صالح'
        };
    },
    
    // رقم هاتف سعودي (يدعم 05XXXXXXXX و 5XXXXXXXX و +9665XXXXXXXX)
    phoneSA(phone) {
        // تنظيف الرقم
        let cleaned = phone.replace(/\s+/g, '').replace(/[()\-]/g, '');
        // تحويل +966 إلى 0
        if (cleaned.startsWith('+966')) {
            cleaned = '0' + cleaned.slice(4);
        }
        // التأكد من أنه يبدأ بـ 05 أو 5
        if (cleaned.startsWith('5') && cleaned.length === 9) {
            cleaned = '0' + cleaned;
        }
        const re = /^(05)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;
        return {
            valid: re.test(cleaned),
            message: 'رقم الهاتف غير صالح (يجب أن يكون رقم سعودي صحيح)'
        };
    },
    
    // رقم هاتف دولي
    phoneInternational(phone) {
        const re = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        return {
            valid: re.test(phone),
            message: 'رقم الهاتف غير صالح'
        };
    },
    
    // رابط
    url(url) {
        try {
            new URL(url);
            return { valid: true, message: 'رابط صالح' };
        } catch {
            return { valid: false, message: 'الرابط غير صالح' };
        }
    },
    
    // كلمة مرور قوية
    password(password, options = {}) {
        const {
            minLength = 8,
            requireUppercase = true,
            requireLowercase = true,
            requireNumbers = true,
            requireSpecialChars = true
        } = options;
        
        const errors = [];
        if (password.length < minLength) errors.push(`يجب أن تكون ${minLength} أحرف على الأقل`);
        if (requireUppercase && !/[A-Z]/.test(password)) errors.push('يجب أن تحتوي على حرف كبير');
        if (requireLowercase && !/[a-z]/.test(password)) errors.push('يجب أن تحتوي على حرف صغير');
        if (requireNumbers && !/[0-9]/.test(password)) errors.push('يجب أن تحتوي على رقم');
        if (requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('يجب أن تحتوي على رمز خاص');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // تاريخ
    date(date) {
        const d = new Date(date);
        return {
            valid: d instanceof Date && !isNaN(d),
            message: 'تاريخ غير صالح'
        };
    },
    
    // عمر (أكبر من 18)
    age(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        
        return {
            valid: age >= 18,
            age,
            message: age >= 18 ? 'عمر صالح' : 'يجب أن يكون العمر 18 سنة أو أكثر'
        };
    },
    
    // رقم هوية سعودي
    idNumber(id, country = 'SA') {
        if (country === 'SA') {
            const re = /^[1-2][0-9]{9}$/;
            return {
                valid: re.test(id),
                message: 'رقم الهوية غير صالح (يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2)'
            };
        }
        return { valid: false, message: 'لم يتم التعرف على البلد' };
    },
    
    // رمز بريدي سعودي
    postalCode(code, country = 'SA') {
        if (country === 'SA') {
            const re = /^[0-9]{5}$/;
            return {
                valid: re.test(code),
                message: 'الرمز البريدي غير صالح (يجب أن يكون 5 أرقام)'
            };
        }
        return { valid: false, message: 'لم يتم التعرف على البلد' };
    },
    
    // اسم مستخدم
    username(username) {
        const errors = [];
        if (username.length < 3) errors.push('يجب أن يكون 3 أحرف على الأقل');
        if (username.length > 30) errors.push('يجب أن يكون أقل من 30 حرف');
        if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(username)) {
            errors.push('يسمح فقط بالأحرف والأرقام والشرطة السفلية');
        }
        return { valid: errors.length === 0, errors };
    },
    
    // نص
    text(text, options = {}) {
        const { minLength = 1, maxLength = 1000, required = true } = options;
        const errors = [];
        if (required && (!text || text.trim().length === 0)) errors.push('هذا الحقل مطلوب');
        if (text && text.length < minLength) errors.push(`يجب أن يكون النص ${minLength} أحرف على الأقل`);
        if (text && text.length > maxLength) errors.push(`يجب أن يكون النص أقل من ${maxLength} حرف`);
        return { valid: errors.length === 0, errors };
    },
    
    // رقم
    number(num, options = {}) {
        const { min, max, integer = false, positive = false } = options;
        const errors = [];
        const value = Number(num);
        if (isNaN(value)) errors.push('يجب أن يكون رقماً');
        if (positive && value <= 0) errors.push('يجب أن يكون الرقم موجباً');
        if (min !== undefined && value < min) errors.push(`يجب أن يكون أكبر من أو يساوي ${min}`);
        if (max !== undefined && value > max) errors.push(`يجب أن يكون أقل من أو يساوي ${max}`);
        if (integer && !Number.isInteger(value)) errors.push('يجب أن يكون رقماً صحيحاً');
        return { valid: errors.length === 0, errors };
    },
    
    // التحقق من صورة
    image(file, options = {}) {
        const { maxSize = 5 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] } = options;
        const errors = [];
        if (!file) errors.push('الملف مطلوب');
        else {
            if (!allowedTypes.includes(file.type)) errors.push('نوع الملف غير مسموح');
            if (file.size > maxSize) errors.push(`حجم الملف كبير جداً (الحد الأقصى ${maxSize / 1024 / 1024}MB)`);
        }
        return { valid: errors.length === 0, errors };
    },
    
    // التحقق الشامل من نموذج
    validateForm(data, rules) {
        const errors = {};
        let isValid = true;
        for (const [field, validations] of Object.entries(rules)) {
            const value = data[field];
            for (const validation of validations) {
                const { validator, options = {}, message } = validation;
                let result;
                if (typeof validator === 'function') {
                    result = validator(value, options);
                } else if (typeof this[validator] === 'function') {
                    result = this[validator](value, options);
                } else continue;
                
                if (!result.valid) {
                    errors[field] = errors[field] || [];
                    errors[field].push(message || result.message || result.errors?.join(', ') || 'قيمة غير صالحة');
                    isValid = false;
                    break;
                }
            }
        }
        return { valid: isValid, errors };
    }
};

// تسجيل في النواة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiValidators', AlaisaiValidators);
}

window.AlaisaiValidators = AlaisaiValidators;
console.log('✅ Alaisai Validators جاهز للعمل');