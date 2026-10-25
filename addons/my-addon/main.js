// ==========================================
// خوارزمية التشفير السرية (لا تعدلها)
// ==========================================
function generateSecretCode(deviceId) {
    let sum = 0;
    for (let i = 0; i < deviceId.length; i++) {
        sum += deviceId.charCodeAt(i) * (i + 1);
    }
    let hash = (sum * 7391) % 99999; // رقم سري 7391
    return `VIP-${hash}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    await initSystem(); // تهيئة معرف الجهاز
    await initPrompts();
    await initIncome();
    initTimer();
    initAdminPanel(); // تهيئة لوحة المالك
});

// التنقل بين الأقسام
function initNavigation() {
    const btns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });
}

// تهيئة معرف الجهاز
async function initSystem() {
    let deviceId = await Alaisai.get('pro_device_id');
    if (!deviceId) {
        // توليد معرف فريد مكون من 8 أحرف وأرقام
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const randomStr2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        deviceId = `DEV-${randomStr}-${randomStr2}`;
        await Alaisai.set('pro_device_id', deviceId);
    }
    window.currentDeviceId = deviceId; // حفظه في الذاكرة
    document.getElementById('deviceIdText').textContent = deviceId;
}

// ================= قسم البرومبتات =================
async function initPrompts() {
    const saveBtn = document.getElementById('savePrompt');
    const titleInput = document.getElementById('promptTitle');
    const textInput = document.getElementById('promptText');
    const isVipCheckbox = document.getElementById('isVipPrompt');
    const list = document.getElementById('promptsList');

    let isVipUser = (await Alaisai.get('is_vip_user')) || false;

    let prompts = (await Alaisai.get('pro_prompts')) || [
        { id: 1, title: 'كتابة إعلان تسويقي', text: 'أنت خبير تسويق. اكتب إعلاناً ممولاً لمنتج [اسم المنتج] يستهدف [الجمهور]، مع التركيز على [الميزة الأساسية]، بأسلوب مشوق ومقنع.', isVip: false },
        { id: 2, title: 'سر كتابة المقالات الاحترافية', text: 'أنت كاتب محترف. اكتب مقالاً عن [الموضوع] بأسلوب جذاب، مقسم إلى مقدمة، 3 نقاط رئيسية، وخاتمة تحفيزية.', isVip: true }
    ];

    function renderPrompts() {
        list.innerHTML = '';
        prompts.forEach(p => {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            
            const isLocked = p.isVip && !isVipUser;
            const vipBadge = p.isVip ? '<span class="vip-badge">VIP 🔒</span>' : '';
            const displayText = isLocked ? '••••••••••••••••••••••••••••••••••••••••' : p.text;

            card.innerHTML = `
                <h3>${vipBadge} ${p.title}</h3>
                <p>${displayText}</p>
                <div class="actions">
                    <button class="copy-btn" onclick="copyPrompt('${p.id}')">📋 نسخ</button>
                    <button class="del-btn" onclick="deletePrompt('${p.id}')">🗑️ حذف</button>
                </div>
            `;
            list.appendChild(card);
        });
    }

    window.copyPrompt = async (id) => {
        const p = prompts.find(item => item.id == id);
        if (p) {
            if (p.isVip && !isVipUser) {
                Alaisai.toast('🔒 هذا البرومبت حصري لمشتركي VIP! قم بشراء كود التفعيل.');
                return;
            }
            try {
                await navigator.clipboard.writeText(p.text);
                Alaisai.toast('تم نسخ البرومبت بنجاح!');
            } catch (err) {
                Alaisai.toast('تعذر النسخ.');
            }
        }
    };

    window.deletePrompt = async (id) => {
        prompts = prompts.filter(item => item.id != id);
        await Alaisai.set('pro_prompts', prompts);
        renderPrompts();
        Alaisai.toast('تم الحذف');
    };

    saveBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const text = textInput.value.trim();
        const isVip = isVipCheckbox.checked;

        if (title && text) {
            prompts.push({ id: Date.now(), title: title, text: text, isVip: isVip });
            await Alaisai.set('pro_prompts', prompts);
            titleInput.value = ''; textInput.value = ''; isVipCheckbox.checked = false;
            renderPrompts();
            Alaisai.toast('تم الحفظ بنجاح');
        } else {
            Alaisai.toast('يرجى ملء كافة الحقول');
        }
    });

    renderPrompts();

    // زر طلب الشراء
    document.getElementById('buyVipBtn').addEventListener('click', () => {
        const msg = `مرحباً، أريد الاشتراك في VIP لإضافة Pro Core.%0Aرقم جهازي هو: *${window.currentDeviceId}*`;
        const paymentLink = `https://wa.me/967734454642?text=${msg}`; 
        if (confirm('سيتم نسخ رقم جهازك تلقائياً وإرساله للمطور عبر واتساب لإتمام الدفع. هل تريد المتابعة؟')) {
            window.open(paymentLink, '_blank');
        }
    });

    // زر التفعيل بالكود
    document.getElementById('activateVipBtn').addEventListener('click', async () => {
        const userCode = prompt('أدخل كود التفعيل السري الخاص بجهازك:');
        
        if (userCode) {
            const expectedCode = generateSecretCode(window.currentDeviceId);
            
            if (userCode.trim().toUpperCase() === expectedCode) {
                await Alaisai.set('is_vip_user', true);
                isVipUser = true; 
                Alaisai.toast('🎉 مبروك! تم تفعيل حساب VIP لهذا الجهاز بنجاح.');
                renderPrompts();
            } else {
                Alaisai.toast('❌ الكود غير صحيح أو لا ينتمي لهذا الجهاز.');
            }
        }
    });
}

// ================= لوحة تحكم المالك السرية =================
function initAdminPanel() {
    let clickCount = 0;
    const trigger = document.getElementById('secretAdminTrigger');

    trigger.addEventListener('click', () => {
        clickCount++;
        if (clickCount === 5) {
            const password = prompt('أدخل كلمة مرور المالك:');
            if (password === 'admin123') { // كلمة المرور السرية
                const customerId = prompt('أدخل رقم جهاز العميل (مثال: DEV-XXXX-YYYY):');
                if (customerId) {
                    const code = generateSecretCode(customerId.trim().toUpperCase());
                    alert(`كود التفعيل الخاص بهذا العميل هو:\n\n${code}\n\nأرسل هذا الكود له، لن يعمل مع أي جهاز آخر.`);
                }
            } else {
                Alaisai.toast('كلمة مرور خاطئة');
            }
            clickCount = 0;
        }
        setTimeout(() => { clickCount = 0; }, 2000); 
    });
}

// ================= قسم الأرباح =================
async function initIncome() {
    const addBtn = document.getElementById('addIncomeBtn');
    const amountInput = document.getElementById('incomeAmount');
    const descInput = document.getElementById('incomeDesc');
    const list = document.getElementById('incomeList');
    const totalEl = document.getElementById('totalIncome');

    let incomeData = (await Alaisai.get('pro_income')) || [];

    function renderIncome() {
        list.innerHTML = '';
        let total = 0;
        [...incomeData].reverse().forEach(item => {
            total += parseFloat(item.amount);
            const date = new Date(item.date).toLocaleDateString('ar-EG');
            const li = document.createElement('li');
            li.className = 'transaction-item';
            li.innerHTML = `
                <div class="info"><h4>${item.desc}</h4><span>${date}</span></div>
                <div style="display:flex; align-items:center;">
                    <span class="amount">+$${item.amount}</span>
                    <button class="del-trans" onclick="deleteIncome('${item.id}')">✖</button>
                </div>
            `;
            list.appendChild(li);
        });
        totalEl.textContent = `$${total.toFixed(2)}`;
    }

    window.deleteIncome = async (id) => {
        incomeData = incomeData.filter(item => item.id != id);
        await Alaisai.set('pro_income', incomeData);
        renderIncome();
    };

    addBtn.addEventListener('click', async () => {
        const amount = amountInput.value;
        const desc = descInput.value.trim();
        if (amount > 0 && desc) {
            incomeData.push({ id: Date.now(), amount: parseFloat(amount), desc: desc, date: new Date().toISOString() });
            await Alaisai.set('pro_income', incomeData);
            amountInput.value = ''; descInput.value = '';
            renderIncome();
            Alaisai.toast('تم إضافة الربح!');
        }
    });
    renderIncome();
}

// ================= قسم المؤقت =================
function initTimer() {
    let timeLeft = 25 * 60, timerId = null, isRunning = false;
    const display = document.getElementById('timeDisplay');
    const startBtn = document.getElementById('startTimer');
    const resetBtn = document.getElementById('resetTimer');

    function updateDisplay() {
        display.textContent = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;
    }

    startBtn.addEventListener('click', () => {
        if (isRunning) {
            clearInterval(timerId); startBtn.textContent = 'استئناف'; startBtn.style.background = 'var(--accent)';
        } else {
            timerId = setInterval(() => {
                if (timeLeft > 0) { timeLeft--; updateDisplay(); } 
                else { clearInterval(timerId); isRunning = false; startBtn.textContent = 'ابدأ'; Alaisai.toast('انتهى الوقت!'); timeLeft = 25 * 60; updateDisplay(); }
            }, 1000);
            startBtn.textContent = 'إيقاف'; startBtn.style.background = 'var(--danger)';
        }
        isRunning = !isRunning;
    });

    resetBtn.addEventListener('click', () => {
        clearInterval(timerId); isRunning = false; timeLeft = 25 * 60; updateDisplay(); startBtn.textContent = 'ابدأ'; startBtn.style.background = 'var(--accent)';
    });
    updateDisplay();
}