/**
 * Alaisai Security - نظام الأمان والحماية المتقدم
 * @version 2.0.0
 */

const AlaisaiSecurity = {
    version: '2.0.0',
    permissions: new Map(),      // صلاحيات الأدوار (في الذاكرة)
    roles: new Map(),            // الأدوار (في الذاكرة)
    sessions: new Map(),         // الجلسات النشطة (في الذاكرة)
    rateLimits: new Map(),       // محدد الطلبات
    initialized: false,
    
    // تهيئة النظام (تحميل البيانات من IndexedDB)
    async init() {
        if (this.initialized) return this;
        
        // تحميل الأدوار والصلاحيات من قاعدة البيانات
        if (window.AlaisaiDB) {
            const rolesData = await AlaisaiDB.getAll('roles').catch(() => []);
            rolesData.forEach(role => this.roles.set(role.name, role));
            
            const usersData = await AlaisaiDB.getAll('users').catch(() => []);
            usersData.forEach(user => this.permissions.set(user.id, user));
        }
        
        // إنشاء أدوار افتراضية إذا لم توجد
        if (this.roles.size === 0) {
            this.createRole('admin', ['*']);
            this.createRole('user', ['read', 'write:own']);
            this.createRole('guest', ['read']);
        }
        
        this.initialized = true;
        console.log('🛡️ Alaisai Security جاهز للعمل');
        return this;
    },
    
    // إنشاء دور جديد
    createRole(name, permissions = []) {
        const role = {
            name,
            permissions: new Set(permissions),
            createdAt: new Date().toISOString()
        };
        this.roles.set(name, role);
        // حفظ في IndexedDB
        if (window.AlaisaiDB) {
            AlaisaiDB.put('roles', { name, permissions: Array.from(role.permissions), createdAt: role.createdAt });
        }
        console.log(`👑 تم إنشاء دور: ${name}`);
        return this;
    },
    
    // إنشاء مستخدم
    async createUser(username, password, role = 'user') {
        const userId = this.generateId();
        const hashedPassword = await this.hashPassword(password);
        const user = {
            id: userId,
            username,
            password: hashedPassword,
            role,
            permissions: new Set(),
            createdAt: new Date().toISOString(),
            lastLogin: null,
            failedAttempts: 0,
            locked: false
        };
        
        this.permissions.set(userId, user);
        
        if (window.AlaisaiDB) {
            await AlaisaiDB.put('users', {
                ...user,
                permissions: Array.from(user.permissions)
            });
        }
        
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
        if (await this.verifyPassword(password, user.password)) {
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
            
            // تحديث معلومات المستخدم
            user.lastLogin = new Date().toISOString();
            user.failedAttempts = 0;
            
            if (window.AlaisaiDB) {
                await AlaisaiDB.put('users', {
                    ...user,
                    permissions: Array.from(user.permissions)
                });
                await AlaisaiDB.put('sessions', { token, ...session });
            }
            
            return {
                success: true,
                token,
                user: {
                    id: userId,
                    username: user.username,
                    role: user.role
                }
            };
        } else {
            // زيادة محاولات الفاشلة
            user.failedAttempts++;
            if (user.failedAttempts >= 5) {
                user.locked = true;
            }
            
            if (window.AlaisaiDB) {
                await AlaisaiDB.put('users', {
                    ...user,
                    permissions: Array.from(user.permissions)
                });
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
        
        if (user.role === 'admin') return true;
        
        const role = this.roles.get(user.role);
        if (role && role.permissions.has(permission)) {
            return true;
        }
        
        return user.permissions.has(permission);
    },
    
    // التحقق من التوكن
    async verifyToken(token) {
        // ابحث في الذاكرة أولاً
        let session = this.sessions.get(token);
        if (!session && window.AlaisaiDB) {
            // حاول من IndexedDB
            session = await AlaisaiDB.get('sessions', token);
            if (session) this.sessions.set(token, session);
        }
        if (!session) return null;
        
        const now = new Date();
        const expires = new Date(session.expiresAt);
        
        if (now > expires) {
            this.sessions.delete(token);
            if (window.AlaisaiDB) {
                await AlaisaiDB.delete('sessions', token);
            }
            return null;
        }
        
        session.lastActivity = now.toISOString();
        return session;
    },
    
    // تسجيل الخروج
    async logout(token) {
        this.sessions.delete(token);
        if (window.AlaisaiDB) {
            await AlaisaiDB.delete('sessions', token);
        }
        return true;
    },
    
    // تشفير كلمة المرور باستخدام Web Crypto API
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + '_alaisai_salt_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },
    
    async verifyPassword(password, hash) {
        const hashedInput = await this.hashPassword(password);
        return hashedInput === hash;
    },
    
    // تشفير وفك تشفير باستخدام AES-GCM (تشفير حقيقي)
    async encrypt(data, password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password.padEnd(32, '0').slice(0, 32)),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('salt_alaisai'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(JSON.stringify(data))
        );
        return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };
    },
    
    async decrypt(encryptedObj, password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password.padEnd(32, '0').slice(0, 32)),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('salt_alaisai'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        const iv = new Uint8Array(encryptedObj.iv);
        const data = new Uint8Array(encryptedObj.data);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );
        return JSON.parse(new TextDecoder().decode(decrypted));
    },
    
    // تحديد معدل الطلبات
    checkRateLimit(key, limit = 100, windowMs = 60000) {
        const now = Date.now();
        const record = this.rateLimits.get(key) || { count: 0, resetAt: now + windowMs };
        
        if (now > record.resetAt) {
            record.count = 1;
            record.resetAt = now + windowMs;
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
    
    // تنقية المدخلات
    sanitizeInput(input, type = 'string') {
        if (!input) return input;
        let sanitized = String(input);
        
        // إزالة أكواد HTML الضارة
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/<[^>]*>?/gm, '');
        
        // منع حقن SQL (بسيط)
        sanitized = sanitized.replace(/'/g, "''");
        sanitized = sanitized.replace(/--/g, '');
        
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
    
    generateToken() {
        return 'token_' + Date.now() + '_' + 
               Math.random().toString(36).substr(2, 16) + 
               '_' + Math.random().toString(36).substr(2, 16);
    },
    
    generateId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
};

// تسجيل في النواة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiSecurity', AlaisaiSecurity);
    AlaisaiSecurity.init().catch(console.error);
} else {
    window.AlaisaiSecurity = AlaisaiSecurity;
}

console.log('🛡️ Alaisai Security جاهز للعمل (نسخة آمنة)');