/**
 * Alaisai Validators - أدوات التحقق من البيانات
 * @version 1.0.0
 */

const AlaisaiValidators = {
    version: '1.0.0',
    
    // التحقق من البريد الإلكتروني
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
            valid: re.test(email),
            message: 'البريد الإلكتروني غير صالح'
        };
    },
    
    // التحقق من رقم الهاتف (سعودي)
    phoneSA(phone) {
        const re = /^(05|5)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;
        const cleaned = phone.replace(/\s+/g, '').replace(/^\+966/, '0');
        return {
            valid: re.test(cleaned),
            message: 'رقم الهاتف غير صالح (يجب أن يكون رقم سعودي صحيح)'
        };
    },
    
    // التحقق من رقم الهاتف دولي
    phoneInternational(phone) {
        const re = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        return {
            valid: re.test(phone),
            message: 'رقم الهاتف غير صالح'
        };
    },
    
    // التحقق من رابط
    url(url) {
        try {
            new URL(url);
            return {
                valid: true,
                message: 'رابط صالح'
            };
        } catch {
            return {
                valid: false,
                message: 'الرابط غير صالح'
            };
        }
    },
    
    // التحقق من كلمة المرور
    password(password, options = {}) {
        const {
            minLength = 8,
            requireUppercase = true,
            requireLowercase = true,
            requireNumbers = true,
            requireSpecialChars = true
        } = options;
        
        const errors = [];
        
        if (password.length < minLength) {
            errors.push(`يجب أن تكون كلمة المرور ${minLength} أحرف على الأقل`);
        }
        
        if (requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل');
        }
        
        if (requireLowercase && !/[a-z]/.test(password)) {
            errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل');
        }
        
        if (requireNumbers && !/[0-9]/.test(password)) {
            errors.push('يجب أن تحتوي على رقم واحد على الأقل');
        }
        
        if (requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // التحقق من التاريخ
    date(date) {
        const d = new Date(date);
        const isValid = d instanceof Date && !isNaN(d);
        
        return {
            valid: isValid,
            message: isValid ? 'تاريخ صالح' : 'تاريخ غير صالح'
        };
    },
    
    // التحقق من العمر (أكبر من 18)
    age(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return {
            valid: age >= 18,
            age: age,
            message: age >= 18 ? 'عمر صالح' : 'يجب أن يكون العمر 18 سنة أو أكثر'
        };
    },
    
    // التحقق من رقم البطاقة
    idNumber(id, country = 'SA') {
        if (country === 'SA') {
            // الهوية السعودية: 10 أرقام
            const re = /^[1-2][0-9]{9}$/;
            return {
                valid: re.test(id),
                message: 'رقم الهوية غير صالح (يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2)'
            };
        }
        
        return {
            valid: false,
            message: 'لم يتم التعرف على البلد'
        };
    },
    
    // التحقق من الرقم البريدي
    postalCode(code, country = 'SA') {
        if (country === 'SA') {
            // الرقم البريدي السعودي: 5 أرقام
            const re = /^[0-9]{5}$/;
            return {
                valid: re.test(code),
                message: 'الرمز البريدي غير صالح (يجب أن يكون 5 أرقام)'
            };
        }
        
        return {
            valid: false,
            message: 'لم يتم التعرف على البلد'
        };
    },
    
    // التحقق من اسم المستخدم
    username(username) {
        const errors = [];
        
        if (username.length < 3) {
            errors.push('يجب أن يكون اسم المستخدم 3 أحرف على الأقل');
        }
        
        if (username.length > 30) {
            errors.push('يجب أن يكون اسم المستخدم أقل من 30 حرف');
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            errors.push('يسمح فقط بالأحرف الإنجليزية والأرقام والشرطة السفلية');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // التحقق من النص
    text(text, options = {}) {
        const {
            minLength = 1,
            maxLength = 1000,
            required = true
        } = options;
        
        const errors = [];
        
        if (required && (!text || text.trim().length === 0)) {
            errors.push('هذا الحقل مطلوب');
        }
        
        if (text && text.length < minLength) {
            errors.push(`يجب أن يكون النص ${minLength} أحرف على الأقل`);
        }
        
        if (text && text.length > maxLength) {
            errors.push(`يجب أن يكون النص أقل من ${maxLength} حرف`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // التحقق من الرقم
    number(num, options = {}) {
        const {
            min,
            max,
            integer = false,
            positive = false
        } = options;
        
        const errors = [];
        const value = Number(num);
        
        if (isNaN(value)) {
            errors.push('يجب أن يكون رقماً صحيحاً');
        }
        
        if (positive && value <= 0) {
            errors.push('يجب أن يكون الرقم موجباً');
        }
        
        if (min !== undefined && value < min) {
            errors.push(`يجب أن يكون الرقم أكبر من أو يساوي ${min}`);
        }
        
        if (max !== undefined && value > max) {
            errors.push(`يجب أن يكون الرقم أقل من أو يساوي ${max}`);
        }
        
        if (integer && !Number.isInteger(value)) {
            errors.push('يجب أن يكون رقماً صحيحاً بدون كسور');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // التحقق من الاختيار
    inArray(value, array) {
        return {
            valid: array.includes(value),
            message: `القيمة يجب أن تكون واحدة من: ${array.join(', ')}`
        };
    },
    
    // التحقق من التطابق
    match(value1, value2, fieldName = 'القيم') {
        return {
            valid: value1 === value2,
            message: `${fieldName} غير متطابقتين`
        };
    },
    
    // التحقق من الصورة
    image(file, options = {}) {
        const {
            maxSize = 5 * 1024 * 1024, // 5MB افتراضي
            allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        } = options;
        
        const errors = [];
        
        if (!file) {
            errors.push('الملف مطلوب');
            return { valid: false, errors };
        }
        
        if (!allowedTypes.includes(file.type)) {
            errors.push(`نوع الملف غير مسموح. الأنواع المسموحة: ${allowedTypes.join(', ')}`);
        }
        
        if (file.size > maxSize) {
            errors.push(`حجم الملف كبير جداً. الحد الأقصى: ${maxSize / 1024 / 1024}MB`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // التحقق من الملف
    file(file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10MB افتراضي
            allowedTypes = []
        } = options;
        
        const errors = [];
        
        if (!file) {
            errors.push('الملف مطلوب');
            return { valid: false, errors };
        }
        
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
            errors.push(`نوع الملف غير مسموح. الأنواع المسموحة: ${allowedTypes.join(', ')}`);
        }
        
        if (file.size > maxSize) {
            errors.push(`حجم الملف كبير جداً. الحد الأقصى: ${maxSize / 1024 / 1024}MB`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // التحقق من التاريخ بالنسبة للوقت الحالي
    dateRelative(date, options = {}) {
        const {
            past = false,
            future = false,
            maxDays = null
        } = options;
        
        const targetDate = new Date(date);
        const now = new Date();
        
        const errors = [];
        
        if (past && targetDate > now) {
            errors.push('يجب أن يكون التاريخ في الماضي');
        }
        
        if (future && targetDate < now) {
            errors.push('يجب أن يكون التاريخ في المستقبل');
        }
        
        if (maxDays !== null) {
            const diffDays = Math.abs(Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)));
            if (diffDays > maxDays) {
                errors.push(`يجب أن يكون التاريخ ضمن ${maxDays} أيام من اليوم`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
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
                } else {
                    continue;
                }
                
                if (!result.valid) {
                    errors[field] = errors[field] || [];
                    errors[field].push(message || result.message || result.errors?.join(', ') || 'قيمة غير صالحة');
                    isValid = false;
                    break;
                }
            }
        }
        
        return {
            valid: isValid,
            errors
        };
    }
};

window.AlaisaiValidators = AlaisaiValidators;
console.log('✅ Alaisai Validators جاهز للعمل');// Alaisai Validators
