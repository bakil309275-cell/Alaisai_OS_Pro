const app = document.getElementById('app');
const toast = document.getElementById('toast');

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

const views = {
    home: () => `
        <div class="card">
            <h3>📢 إعلانات المدرسة العامة</h3>
            <p>مرحباً بجميع أولياء الأمور. نرحب بالعام الدراسي الجديد.</p>
            <small>نشر بواسطة: إدارة المدرسة</small>
        </div>
        <div class="card">
            <h3>📝 الواجبات المنزلية</h3>
            <p>واجب الرياضيات: صفحة 45، تمرين 1 و 2.</p>
            <button class="btn btn-green" onclick="showToast('تم تسليم الواجب بنجاح')">تسليم الواجب</button>
        </div>
    `,
    grades: () => `
        <div class="card">
            <h3>📊 نتائج الطالب</h3>
            <p>الرياضيات: 95</p>
            <p>العلوم: 88</p>
            <p>اللغة العربية: 92</p>
        </div>
    `,
    pay: () => `
        <div class="card">
            <h3>💳 تسديد الرسوم الدراسية</h3>
            <p>المبلغ المتبقي: 50,000 ريال</p>
            <p>يرجى التحويل إلى رقم الحساب: <strong>1234567890</strong></p>
            <label>إرفاق صورة الإيصال:</label>
            <input type="file" id="receipt">
            <button class="btn" onclick="showToast('تم إرسال الإيصال للإدارة')">تأكيد الدفع</button>
        </div>
    `
};

function renderTabs() {
    return `
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('home', this)">الرئيسية</button>
            <button class="tab-btn" onclick="switchTab('grades', this)">النتائج</button>
            <button class="tab-btn" onclick="switchTab('pay', this)">الرسوم</button>
        </div>
        <div id="content"></div>
    `;
}

function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('content').innerHTML = views[tabName]();
}

app.innerHTML = renderTabs();
document.getElementById('content').innerHTML = views['home']();
