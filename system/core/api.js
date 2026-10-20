/**
 * Alaisai API - واجهة برمجة التطبيقات المركزية
 * @version 1.5.0
 */

const AlaisaiAPI = {
    version: '1.5.0',
    endpoints: new Map(),
    middleware: [],
    
    // تسجيل نقطة نهاية جديدة
    register(endpoint, handler, options = {}) {
        this.endpoints.set(endpoint, {
            handler,
            options: {
                auth: options.auth || false,
                rateLimit: options.rateLimit || 0,
                cache: options.cache || false,
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
        // التحقق من وجود النقطة
        if (!this.endpoints.has(endpoint)) {
            return {
                success: false,
                error: 'ENDPOINT_NOT_FOUND',
                message: `النقطة ${endpoint} غير موجودة`
            };
        }
        
        const api = this.endpoints.get(endpoint);
        
        // تنفيذ middleware
        for (const mw of this.middleware) {
            const result = await mw({ endpoint, data, context, api });
            if (result === false) {
                return {
                    success: false,
                    error: 'MIDDLEWARE_BLOCKED',
                    message: 'تم رفض الطلب بواسطة middleware'
                };
            }
        }
        
        // التحقق من الصلاحيات
        if (api.options.auth && !context.user) {
            return {
                success: false,
                error: 'UNAUTHORIZED',
                message: 'يتطلب تسجيل الدخول'
            };
        }
        
        try {
            // زيادة عداد الاستدعاءات
            api.hits++;
            
            // تنفيذ المعالج
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
            return {
                success: false,
                error: 'HANDLER_ERROR',
                message: error.message
            };
        }
    },
    
    // إضافة middleware
    use(middleware) {
        this.middleware.push(middleware);
        console.log(`🛡️ تم إضافة middleware: ${middleware.name || 'anonymous'}`);
        return this;
    },
    
    // حذف نقطة نهاية
    unregister(endpoint) {
        if (this.endpoints.has(endpoint)) {
            this.endpoints.delete(endpoint);
            console.log(`🗑️ تم حذف API: ${endpoint}`);
        }
        return this;
    },
    
    // قائمة بكل APIs
    list() {
        const list = [];
        this.endpoints.forEach((api, endpoint) => {
            list.push({
                endpoint,
                hits: api.hits,
                options: api.options,
                createdAt: api.createdAt
            });
        });
        return list;
    },
    
    // إعادة تعيين الإحصائيات
    resetStats() {
        this.endpoints.forEach(api => {
            api.hits = 0;
        });
        console.log('📊 تم إعادة تعيين إحصائيات API');
        return this;
    }
};

// APIs مدمجة
AlaisaiAPI.register('system.info', () => ({
    version: AlaisaiCore?.version || '2.0.0',
    uptime: Date.now() - (window._alaisai_start_time || Date.now()),
    modules: AlaisaiCore?.modules ? Object.keys(AlaisaiCore.modules).length : 0
}), { cache: true });

AlaisaiAPI.register('system.ping', () => 'pong', { cache: false });

AlaisaiAPI.register('system.time', () => new Date().toISOString());

// Middleware لتسجيل الطلبات
AlaisaiAPI.use(async (req) => {
    console.log(`📡 API Request: ${req.endpoint}`, req.data);
    return true;
});

window.AlaisaiAPI = AlaisaiAPI;
console.log('🔌 Alaisai API جاهزة للعمل');// Alaisai API v1.5.0
