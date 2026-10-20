/**
 * Alaisai Security - نظام الأمان والحماية
 * @version 1.4.0
 */

const AlaisaiSecurity = {
    version: '1.4.0',
    permissions: new Map(),
    roles: new Map(),
    sessions: new Map(),
    tokens: new Map(),
    rateLimits: new Map(),
    
    // إنشاء دور جديد
    createRole(name, permissions = []) {
        this.roles.set(name, {
            name,
            permissions: new Set(permissions),
            createdAt: new Date().toISOString()
        });
        console.log(`👑 تم إنشاء دور: ${name}`);
        return this;
    },
    
    // إنشاء مستخدم
    createUser(username, password, role = 'user') {
        const userId = this.generateId();
        const user = {
            id: userId,
            username,
            password: this.hashPassword(password),
            role,
            permissions: new Set(),
            createdAt: new Date().toISOString(),
            lastLogin: null,
            failedAttempts: 0,
            locked: false
        };
        
        this.permissions.set(userId, user);
        console.log(`👤 تم إنشاء مستخدم: ${username}`);
        return userId;
    },
    
    // تسجيل الدخول
    async login(username, password) {
        let user = null;
        let userId = null;
        
        // البحث عن المستخدم
        this.permissions.forEach((u, id) => {
            if (u.username === username) {
                user = u;
                userId = id;
            }
        });
        
        if (!user) {
            return {
                success: false,
                error: 'USER_NOT_FOUND',
                message: 'المستخدم غير موجود'
            };
        }
        
        // التحقق من القفل
        if (user.locked) {
            return {
                success: false,
                error: 'ACCOUNT_LOCKED',
                message: 'الحساب مقفل'
            };
        }
        
        // التحقق من كلمة المرور
        if (this.verifyPassword(password, user.password)) {
            // إنشاء جلسة
            const token = this.generateToken();
            const session = {
                userId,
                username: user.username,
                role: user.role,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                lastActivity: new Date().toISOString()
            };
            
            this.sessions.set(token, session);
            this.tokens.set(token, { userId, expires: session.expiresAt });
            
            // تحديث معلومات المستخدم
            user.lastLogin = new Date().toISOString();
            user.failedAttempts = 0;
            
            return {
                success: true,
                token,
                user: {
                    id: userId,
                    username: user.username,
                    role: user.role
                },
                session
            };
        } else {
            // زيادة محاولات الفاشلة
            user.failedAttempts++;
            if (user.failedAttempts >= 5) {
                user.locked = true;
            }
            
            return {
                success: false,
                error: 'INVALID_PASSWORD',
                message: 'كلمة المرور غير صحيحة',
                attemptsLeft: 5 - user.failedAttempts
            };
        }
    },
    
    // التحقق من الصلاحية
    checkPermission(userId, permission) {
        const user = this.permissions.get(userId);
        if (!user) return false;
        
        // صلاحيات الأدمن المطلق
        if (user.role === 'admin') return true;
        
        // التحقق من صلاحيات الدور
        const role = this.roles.get(user.role);
        if (role && role.permissions.has(permission)) {
            return true;
        }
        
        // التحقق من الصلاحيات المباشرة
        return user.permissions.has(permission);
    },
    
    // التحقق من التوكن
    verifyToken(token) {
        const session = this.sessions.get(token);
        if (!session) return null;
        
        const now = new Date();
        const expires = new Date(session.expiresAt);
        
        if (now > expires) {
            this.sessions.delete(token);
            this.tokens.delete(token);
            return null;
        }
        
        session.lastActivity = now.toISOString();
        return session;
    },
    
    // تسجيل الخروج
    logout(token) {
        this.sessions.delete(token);
        this.tokens.delete(token);
        return true;
    },
    
    // تنقية المدخلات
    sanitizeInput(input, type = 'string') {
        if (!input) return input;
        
        let sanitized = String(input);
        
        // إزالة أكواد HTML الضارة
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/<[^>]*>?/gm, '');
        
        // منع حقن SQL
        sanitized = sanitized.replace(/'/g, "''");
        sanitized = sanitized.replace(/--/g, '');
        sanitized = sanitized.replace(/;.*$/gm, '');
        
        // حسب النوع
        switch (type) {
            case 'email':
                sanitized = sanitized.replace(/[^a-zA-Z0-9@._-]/g, '');
                break;
            case 'filename':
                sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
                break;
            case 'number':
                sanitized = sanitized.replace(/[^0-9.-]/g, '');
                break;
        }
        
        return sanitized;
    },
    
    // تشفير كلمة المرور
    hashPassword(password) {
        // في الإنتاج استخدم bcrypt أو Argon2
        return btoa(password + '_alaisai_salt_2026');
    },
    
    // التحقق من كلمة المرور
    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    },
    
    // إنشاء توكن
    generateToken() {
        return 'token_' + Date.now() + '_' + 
               Math.random().toString(36).substr(2, 16) + 
               '_' + Math.random().toString(36).substr(2, 16);
    },
    
    generateId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // تحديد معدل الطلبات
    checkRateLimit(key, limit = 100, window = 60000) {
        const now = Date.now();
        const record = this.rateLimits.get(key) || { count: 0, resetAt: now + window };
        
        if (now > record.resetAt) {
            record.count = 1;
            record.resetAt = now + window;
        } else {
            record.count++;
        }
        
        this.rateLimits.set(key, record);
        
        return {
            allowed: record.count <= limit,
            remaining: Math.max(0, limit - record.count),
            resetAt: new Date(record.resetAt).toISOString()
        };
    },
    
    // تشفير بيانات حساسة
    encrypt(data, key = 'default') {
        // تشفير بسيط - في الإنتاج استخدم AES
        const encoded = btoa(JSON.stringify(data));
        return `enc_${key}_${encoded}`;
    },
    
    // فك تشفير
    decrypt(encrypted) {
        try {
            const parts = encrypted.split('_');
            const encoded = parts.slice(2).join('_');
            return JSON.parse(atob(encoded));
        } catch {
            return null;
        }
    }
};

// إنشاء أدوار افتراضية
AlaisaiSecurity.createRole('admin', ['*']);
AlaisaiSecurity.createRole('user', ['read', 'write:own']);
AlaisaiSecurity.createRole('guest', ['read']);

window.AlaisaiSecurity = AlaisaiSecurity;
console.log('🛡️ Alaisai Security جاهز للعمل');// Alaisai Security v1.4.0
