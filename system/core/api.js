/**
 * Alaisai API - واجهة برمجة التطبيقات المركزية مع أمان متكامل
 * @version 2.0.0
 */

const AlaisaiAPI = {
    version: '2.0.0',
    endpoints: new Map(),
    middleware: [],
    
    // تسجيل نقطة نهاية
    register(endpoint, handler, options = {}) {
        this.endpoints.set(endpoint, {
            handler,
            options: {
                auth: options.auth || false,
                rateLimit: options.rateLimit || 0,
                cache: options.cache || false,
                permissions: options.permissions || [],
                ...options
            },
            hits: 0,
            createdAt: new Date().toISOString()
        });
        console.log(`🔌 تم تسجيل API: ${endpoint}`);
        return this;
    },
    
    // استدعاء API
    async call(endpoint, data = {}, context = {}) {
        const api = this.endpoints.get(endpoint);
        if (!api) {
            return this._error('ENDPOINT_NOT_FOUND', `النقطة ${endpoint} غير موجودة`);
        }
        
        // تنفيذ middleware
        for (const mw of this.middleware) {
            const result = await mw({ endpoint, data, context, api });
            if (result === false) {
                return this._error('MIDDLEWARE_BLOCKED', 'تم رفض الطلب');
            }
        }
        
        // التحقق من المصادقة
        if (api.options.auth) {
            if (!context.token) {
                return this._error('UNAUTHORIZED', 'يتطلب تسجيل الدخول');
            }
            
            // التحقق من التوكن باستخدام AlaisaiSecurity
            if (window.AlaisaiSecurity) {
                const session = await AlaisaiSecurity.verifyToken(context.token);
                if (!session) {
                    return this._error('INVALID_TOKEN', 'التوكن غير صالح أو منتهي');
                }
                context.user = session;
            } else {
                // حل بديل بسيط
                if (context.token !== 'valid_token') {
                    return this._error('UNAUTHORIZED', 'توكن غير صحيح');
                }
            }
        }
        
        // التحقق من الصلاحيات
        if (api.options.permissions.length > 0 && context.user) {
            if (!window.AlaisaiSecurity) {
                console.warn('⚠️ نظام الأمان غير متوفر، تخطي التحقق من الصلاحيات');
            } else {
                const hasPermission = api.options.permissions.every(perm =>
                    AlaisaiSecurity.checkPermission(context.user.userId, perm)
                );
                if (!hasPermission) {
                    return this._error('FORBIDDEN', 'لا تملك الصلاحية');
                }
            }
        }
        
        // تحديد معدل الطلبات (إذا كان متوفراً)
        if (api.options.rateLimit > 0 && window.AlaisaiSecurity) {
            const key = `api:${endpoint}:${context.user?.userId || context.ip || 'anonymous'}`;
            const rateCheck = AlaisaiSecurity.checkRateLimit(key, api.options.rateLimit, 60000);
            if (!rateCheck.allowed) {
                return this._error('RATE_LIMITED', 'تجاوزت حد الطلبات', rateCheck);
            }
        }
        
        try {
            api.hits++;
            const result = await api.handler(data, context);
            return {
                success: true,
                data: result,
                meta: {
                    endpoint,
                    timestamp: new Date().toISOString(),
                    hits: api.hits
                }
            };
        } catch (error) {
            console.error(`❌ خطأ في API ${endpoint}:`, error);
            return this._error('HANDLER_ERROR', error.message);
        }
    },
    
    _error(code, message, extra = {}) {
        return {
            success: false,
            error: code,
            message,
            ...extra
        };
    },
    
    // إضافة middleware
    use(middleware) {
        this.middleware.push(middleware);
        return this;
    },
    
    // حذف نقطة نهاية
    unregister(endpoint) {
        this.endpoints.delete(endpoint);
        return this;
    },
    
    // قائمة APIs
    list() {
        return Array.from(this.endpoints.entries()).map(([endpoint, api]) => ({
            endpoint,
            hits: api.hits,
            options: api.options,
            createdAt: api.createdAt
        }));
    },
    
    // إعادة تعيين الإحصائيات
    resetStats() {
        this.endpoints.forEach(api => api.hits = 0);
        return this;
    }
};

// تسجيل APIs مدمجة تعتمد على النواة والأمان
AlaisaiAPI.register('system.info', async (data, context) => {
    const info = window.AlaisaiCore ? AlaisaiCore.info() : { version: '2.0.0' };
    return {
        ...info,
        serverTime: new Date().toISOString()
    };
}, { cache: true });

AlaisaiAPI.register('system.ping', () => 'pong', { cache: false });

AlaisaiAPI.register('system.time', () => new Date().toISOString());

AlaisaiAPI.register('auth.login', async ({ username, password }) => {
    if (!window.AlaisaiSecurity) throw new Error('نظام الأمان غير متوفر');
    return await AlaisaiSecurity.login(username, password);
}, { auth: false, rateLimit: 5 });

AlaisaiAPI.register('auth.logout', async (data, context) => {
    if (!window.AlaisaiSecurity) throw new Error('نظام الأمان غير متوفر');
    return await AlaisaiSecurity.logout(context.token);
}, { auth: true });

AlaisaiAPI.register('auth.me', async (data, context) => {
    return context.user;
}, { auth: true });

// Middleware لتسجيل الطلبات
AlaisaiAPI.use(async (req) => {
    console.log(`📡 API Request: ${req.endpoint}`, req.data);
    return true;
});

// تسجيل في النواة
if (window.AlaisaiCore) {
    AlaisaiCore.registerModule('AlaisaiAPI', AlaisaiAPI);
}

window.AlaisaiAPI = AlaisaiAPI;
console.log('🔌 Alaisai API جاهزة للعمل (مع أمان متكامل)');