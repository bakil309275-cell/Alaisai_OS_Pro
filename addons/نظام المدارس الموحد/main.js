// === محرك قاعدة البيانات المحلي ===
const DB = {
    init: function() {
        if (!localStorage.getItem('school_db')) {
            const initialData = {
                schools: [],
                users: [],
                classes: [],
                posts: [],
                assignments: [],
                grades: [],
                payments: [],
                currentUser: null
            };
            localStorage.setItem('school_db', JSON.stringify(initialData));
        }
    },
    get: function(table) { return JSON.parse(localStorage.getItem('school_db'))[table] || []; },
    set: function(table, data) {
        let db = JSON.parse(localStorage.getItem('school_db'));
        db[table] = data;
        localStorage.setItem('school_db', JSON.stringify(db));
    },
    add: function(table, item) {
        let data = this.get(table);
        item.id = Date.now().toString();
        data.push(item);
        this.set(table, data);
        return item;
    },
    login: function(email, pass) {
        let users = this.get('users');
        let user = users.find(u => u.email === email && u.password === pass);
        if (user) {
            let db = JSON.parse(localStorage.getItem('school_db'));
            db.currentUser = user;
            localStorage.setItem('school_db', JSON.stringify(db));
            return user;
        }
        return null;
    },
    logout: function() {
        let db = JSON.parse(localStorage.getItem('school_db'));
        db.currentUser = null;
        localStorage.setItem('school_db', JSON.stringify(db));
    },
    currentUser: function() {
        return JSON.parse(localStorage.getItem('school_db')).currentUser;
    }
};

// === دوال مساعدة ===
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// === واجهات النظام ===
const App = {
    init: function() {
        DB.init();
        const user = DB.currentUser();
        if (user) {
            this.renderDashboard(user);
        } else {
            this.renderLogin();
        }
    },

    renderLogin: function() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-box">
                    <h2>🎓 نظام المدارس الموحد</h2>
                    <div class="form-group">
                        <label>البريد الإلكتروني</label>
                        <input type="email" id="login-email" placeholder="admin@school.com">
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" id="login-pass" placeholder="123456">
                    </div>
                    <button class="btn" onclick="App.doLogin()">تسجيل الدخول</button>
                    <button class="btn btn-success" onclick="App.renderRegisterSchool()">تسجيل مدرسة جديدة</button>
                    <div style="text-align:center;margin-top:15px;font-size:12px;color:#777">
                        حساب تجريبي: admin@school.com / 123456
                    </div>
                </div>
            </div>
        `;
    },

    doLogin: function() {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const user = DB.login(email, pass);
        if (user) {
            showToast('تم تسجيل الدخول بنجاح');
            this.renderDashboard(user);
        } else {
            showToast('خطأ في البريد أو كلمة المرور');
        }
    },

    renderRegisterSchool: function() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-box">
                    <h2>🏫 تسجيل مدرسة جديدة</h2>
                    <div class="form-group">
                        <label>اسم المدرسة</label>
                        <input type="text" id="reg-school" placeholder="مدرسة النور">
                    </div>
                    <div class="form-group">
                        <label>البريد الإلكتروني للمدير</label>
                        <input type="email" id="reg-email" placeholder="manager@school.com">
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" id="reg-pass" placeholder="123456">
                    </div>
                    <button class="btn btn-success" onclick="App.doRegisterSchool()">تسجيل المدرسة</button>
                    <button class="btn" style="background:#95a5a6;margin-top:10px" onclick="App.renderLogin()">رجوع</button>
                </div>
            </div>
        `;
    },

    doRegisterSchool: function() {
        const name = document.getElementById('reg-school').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        
        if (!name || !email || !pass) return showToast('أكمل جميع الحقول');
        
        // إنشاء المدرسة
        const school = DB.add('schools', { name: name, email: email });
        
        // إنشاء حساب المدير
        DB.add('users', { schoolId: school.id, name: 'مدير المدرسة', email: email, password: pass, role: 'admin' });
        
        showToast('تم إنشاء المدرسة بنجاح، يرجى تسجيل الدخول');
        this.renderLogin();
    },

    renderDashboard: function(user) {
        const app = document.getElementById('app');
        const school = DB.get('schools').find(s => s.id === user.schoolId);
        
        app.innerHTML = `
            <div class="dashboard">
                <div class="sidebar">
                    <div class="user-info">
                        <div class="avatar">${user.name.charAt(0)}</div>
                        <strong>${user.name}</strong>
                        <div style="font-size:12px;color:#bdc3c7">${user.role}</div>
                        <div style="font-size:12px;color:#bdc3c7">${school.name}</div>
                    </div>
                    <a class="active" onclick="App.loadView('home')">🏠 الرئيسية</a>
                    <a onclick="App.loadView('users')">👥 المستخدمين</a>
                    <a onclick="App.loadView('assignments')">📝 الواجبات</a>
                    <a onclick="App.loadView('grades')">📊 النتائج</a>
                    <a onclick="App.loadView('payments')">💳 الرسوم</a>
                    <a onclick="App.logout()" style="margin-top:auto;color:#e74c3c">🚪 تسجيل الخروج</a>
                </div>
                <div class="content" id="main-content"></div>
            </div>
        `;
        this.loadView('home');
    },

    loadView: function(view) {
        // تحديث التبويب النشط
        document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        const content = document.getElementById('main-content');
        const user = DB.currentUser();
        const schoolId = user.schoolId;

        if (view === 'home') {
            content.innerHTML = `
                <div class="card">
                    <h3>🏠 لوحة التحكم الرئيسية</h3>
                    <p>مرحباً بك في نظام إدارة المدارس الموحد.</p>
                    <div class="grid">
                        <div class="card" style="text-align:center">
                            <h1>${DB.get('users').filter(u=>u.schoolId===schoolId).length}</h1>
                            <p>مستخدم</p>
                        </div>
                        <div class="card" style="text-align:center">
                            <h1>${DB.get('assignments').filter(a=>a.schoolId===schoolId).length}</h1>
                            <p>واجب</p>
                        </div>
                    </div>
                </div>
            `;
        } else if (view === 'users') {
            const users = DB.get('users').filter(u => u.schoolId === schoolId);
            content.innerHTML = `
                <div class="card">
                    <h3>👥 إدارة المستخدمين</h3>
                    <p>هنا يمكن للمدير إضافة معلمين أو أولياء أمور.</p>
                    <button class="btn btn-success" style="width:auto" onclick="App.addUser()">+ إضافة مستخدم</button>
                    <div style="margin-top:20px">
                        ${users.map(u => `
                            <div class="list-item">
                                <div>
                                    <strong>${u.name}</strong>
                                    <div style="font-size:12px;color:#777">${u.email}</div>
                                </div>
                                <span class="badge">${u.role}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (view === 'assignments') {
            const assignments = DB.get('assignments').filter(a => a.schoolId === schoolId);
            content.innerHTML = `
                <div class="card">
                    <h3>📝 الواجبات الدراسية</h3>
                    <button class="btn btn-success" style="width:auto" onclick="App.addAssignment()">+ إضافة واجب</button>
                    <div style="margin-top:20px">
                        ${assignments.map(a => `
                            <div class="list-item">
                                <div>
                                    <strong>${a.title}</strong>
                                    <div style="font-size:12px;color:#777">${a.desc}</div>
                                </div>
                                <span class="badge">${a.subject}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (view === 'grades') {
            content.innerHTML = `<div class="card"><h3>📊 سجل الدرجات</h3><p>هنا يتم رصد الدرجات للطلاب.</p></div>`;
        } else if (view === 'payments') {
            content.innerHTML = `<div class="card"><h3>💳 إدارة الرسوم</h3><p>هنا تظهر إيصالات الدفع من أولياء الأمور.</p></div>`;
        }
    },

    addUser: function() {
        const name = prompt('اسم المستخدم:');
        const email = prompt('البريد الإلكتروني:');
        const role = prompt('الصلاحية (teacher / parent):');
        if (name && email && role) {
            const user = DB.currentUser();
            DB.add('users', { schoolId: user.schoolId, name, email, password: '123456', role });
            showToast('تمت إضافة المستخدم');
            this.loadView('users');
        }
    },

    addAssignment: function() {
        const title = prompt('عنوان الواجب:');
        const desc = prompt('تفاصيل الواجب:');
        const subject = prompt('المادة:');
        if (title && desc) {
            const user = DB.currentUser();
            DB.add('assignments', { schoolId: user.schoolId, title, desc, subject });
            showToast('تمت إضافة الواجب');
            this.loadView('assignments');
        }
    },

    logout: function() {
        DB.logout();
        showToast('تم تسجيل الخروج');
        this.renderLogin();
    }
};

window.onload = () => App.init();
