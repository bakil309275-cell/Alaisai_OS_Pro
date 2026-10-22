// لغز الجزيرة: 6 ألغاز متسلسلة. التقدّم يُحفظ عبر واجهة Alaisai (يبقى بعد الإغلاق).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const scene = $('scene'), inv = $('inventory');
  const FINAL_SECONDS = 108;

  // توحيد النص العربي للمقارنة: تشكيل، همزات، تاء مربوطة، ألف مقصورة، أرقام هندية، «ال» التعريف
  const norm = (s) => String(s).normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const stripAl = (s) => (s.startsWith('ال') && s.length > 3 ? s.slice(2) : s);
  const matches = (input, answers) => { const a = stripAl(norm(input)); return answers.some((x) => stripAl(norm(x)) === a); };

  const LETTERS = ['أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','هـ','و','ي'];
  const MORSE = ['-----','.----','..---','...--','....-','.....','-....','--...','---..','----.'];
  // مفاتيح الإضاءة: الحل هو الضغط على هذه الخانات (تبديل الخانة وجاراتها الأربع)
  const SOLUTION = [1, 3, 8];

  const LEVELS = [
    { title: 'الشاطئ', icon: '🏖️', item: '🎒 الحقيبة: 80', type: 'text', answers: ['80'], placeholder: 'الرقم التالي',
      story: 'تستيقظ على رمل مبلّل وحطام طائرة حولك. بين الحطام حقيبة بقفل رقمي، وعلى الورقة المبلّلة المعلّقة بها تسلسل أرقام ينقصه آخره.',
      clue: '5 ، 10 ، 20 ، 40 ، ؟',
      hints: ['كل رقم له علاقة بالرقم الذي قبله.', 'الرقم يتضاعف في كل خطوة.', 'ضاعف 40.'],
      win: 'انفتحت الحقيبة! بداخلها خريطة ممزّقة وملاحظة: «الغابة تخفي المدخل».' },
    { title: 'الغابة', icon: '🌴', item: '🗺️ المدخل: كهف', type: 'text', answers: ['كهف'], placeholder: 'الكلمة المخفية',
      story: 'على جذع شجرة نُحتت أرقام. تذكّر أن كل رقم هو ترتيب حرف في الأبجدية العربية (أ=1، ب=2، ت=3 …) فالأرقام تكوّن كلمة.',
      clue: '22 - 26 - 20', extra: 'alphabet',
      hints: ['افتح جدول الحروف وابحث عن كل رقم.', 'الرقم الأول هو الحرف «ك».', 'الحروف: ك – هـ – ف.'],
      win: 'الكلمة هي «كهف»! ظهر ممرّ ضيّق بين الصخور.' },
    { title: 'الكهف', icon: '🕳️', item: '☁️ الإشارة: السحاب', type: 'text', answers: ['سحاب', 'سحابه', 'غيمه', 'غيم'], placeholder: 'الجواب',
      story: 'في عمق الكهف بوابة حجرية وعليها نقش قديم يطلب جواباً ليفتح الطريق:',
      clue: 'أمشي بلا أرجل، وأبكي بلا عيون. من أنا؟',
      hints: ['تراني في السماء.', 'أُحجب الشمس وأُنزل المطر.', 'تبدأ بحرف السين.'],
      win: 'انزاحت البوابة. خلفها درج يقود إلى محطة أبحاث مهجورة.' },
    { title: 'المحطة', icon: '💡', item: '🔑 مفتاح المحطة', type: 'lights',
      story: 'لوحة كهربائية فيها 9 مصابيح. الضغط على مصباح يبدّل حالته وحالة جيرانه (فوق وتحت ويمين ويسار). أطفئ جميع المصابيح لتفتح الباب.',
      hints: ['الضغط مرتين على المصباح نفسه يلغي أثره، فلا تكرر.', 'الحل يحتاج 3 ضغطات فقط.', 'اضغط: وسط الصف الأول، ثم يسار الصف الثاني، ثم يمين الصف الثالث.'],
      win: 'انطفأت المصابيح وانفتح الباب. في الداخل مفتاح وجهاز لاسلكي يبثّ نبضات.' },
    { title: 'اللاسلكي', icon: '📻', item: '📻 الرسالة: 425', type: 'text', answers: ['425'], placeholder: 'الرقم المُرسَل',
      story: 'يبثّ الجهاز رسالة بشفرة مورس: ثلاث مجموعات، كل مجموعة رقم واحد. حوّلها إلى أرقام لتحصل على العدد المُرسَل.',
      clue: '....-  ..---  .....', extra: 'morse', big: true,
      hints: ['استخدم جدول مورس للأرقام.', 'المجموعة الأولى (....-) تعني 4.', 'الأرقام: 4 ثم 2 ثم 5.'],
      win: 'الرسالة: 425. وعلى الشاشة عبارة: «الفتحة تنتظر مجموع الرقمين اللذين فتحا الحقيبة واللاسلكي».' },
    { title: 'الفتحة', icon: '⏳', item: '🚪 الفتحة', type: 'final', answers: ['505'],
      story: 'وصلتَ إلى الفتحة الأخيرة. عند بدء العدّ التنازلي لديك 108 ثوانٍ لإدخال الرمز الصحيح. كل رمز خاطئ يخصم 10 ثوانٍ. إن انتهى الوقت يدوّي الإنذار وتعيد المحاولة.',
      clue: 'الرمز = رقم الحقيبة + رقم اللاسلكي',
      hints: ['الحقيبة: 80.', 'اللاسلكي: 425.', '80 + 425 = ؟'],
      win: '' },
  ];

  let st = { level: 0, hints: 0, shown: 0, started: Date.now(), done: 0, ms: 0 };
  let timer = null;

  const save = () => Alaisai.set('island_state', st).catch(() => {});
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.forEach((k) => n.append(k)); return n;
  };

  function paintMeta() {
    const lv = Math.min(st.level, 5);
    $('lvl-badge').textContent = st.level >= 6 ? 'اكتملت الرحلة' : `المرحلة ${st.level + 1} من 6 — ${LEVELS[lv].title}`;
    $('hint-count').textContent = `تلميحات مستخدمة: ${st.hints}`;
    $('bar').setAttribute('aria-valuenow', st.level);
    $('bar-fill').style.width = Math.round((Math.min(st.level, 6) / 6) * 100) + '%';
    inv.textContent = '';
    if (!st.level) inv.append(el('li', { className: 'empty', textContent: 'لا شيء بعد' }));
    for (let i = 0; i < Math.min(st.level, 6); i++) inv.append(el('li', { textContent: LEVELS[i].item }));
  }

  function hintsBlock(lv) {
    const wrap = el('div');
    const list = el('ol', { className: 'hints' });
    const btn = el('button', { className: 'ghost', type: 'button' });
    const paint = () => {
      list.textContent = '';
      for (let i = 0; i < st.shown; i++) list.append(el('li', { textContent: lv.hints[i] }));
      btn.textContent = st.shown >= lv.hints.length ? 'لا مزيد من التلميحات' : `💡 تلميح (${st.shown}/${lv.hints.length})`;
      btn.disabled = st.shown >= lv.hints.length;
    };
    btn.addEventListener('click', () => { if (st.shown < lv.hints.length) { st.shown++; st.hints++; save(); paint(); paintMeta(); } });
    paint(); wrap.append(btn, list); return wrap;
  }

  function extras(lv) {
    if (lv.extra === 'alphabet') {
      const d = el('details'); d.append(el('summary', { textContent: 'جدول الحروف' }));
      const t = el('div', { className: 'table' });
      LETTERS.forEach((l, i) => t.append(el('span', { textContent: `${l} = ${i + 1}` }))); d.append(t); return d;
    }
    if (lv.extra === 'morse') {
      const d = el('details'); d.append(el('summary', { textContent: 'جدول مورس للأرقام' }));
      const t = el('div', { className: 'table' });
      MORSE.forEach((m, i) => t.append(el('span', { textContent: `${i}: ${m}`, dir: 'ltr' }))); d.append(t); return d;
    }
    return null;
  }

  function solved(lv) {
    clearInterval(timer);
    st.level++; st.shown = 0; save(); paintMeta(); // يُحفظ التقدّم فور الحل
    scene.textContent = '';
    scene.append(el('h2', { textContent: `${lv.icon} أحسنت!` }), el('p', { className: 'story', textContent: lv.win }));
    const next = el('button', { type: 'button', textContent: st.level === 5 ? 'إلى الفتحة ⏳' : 'المرحلة التالية ➜' });
    next.addEventListener('click', render);
    scene.append(next); next.focus();
  }

  function renderText(lv) {
    const form = el('form', { autocomplete: 'off' });
    const input = el('input', { type: 'text', placeholder: lv.placeholder, autocomplete: 'off', inputMode: 'text' });
    input.setAttribute('aria-label', lv.placeholder);
    const ok = el('button', { type: 'submit', textContent: 'تحقّق' });
    const msg = el('div', { className: 'msg', role: 'status' });
    form.append(el('div', { className: 'row' }, input, ok), msg);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (matches(input.value, lv.answers)) solved(lv);
      else { msg.className = 'msg bad'; msg.textContent = '❌ ليس صحيحاً، حاول مجدداً'; input.select(); }
    });
    scene.append(form); input.focus();
  }

  function renderLights(lv) {
    const cells = Array(9).fill(false);
    const press = (i) => {
      const r = Math.floor(i / 3), c = i % 3;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) cells[rr * 3 + cc] = !cells[rr * 3 + cc];
      });
    };
    SOLUTION.forEach(press); // الحالة الابتدائية: نطبّق الحل على لوحة مطفأة فتصبح قابلة للحل دائماً
    const grid = el('div', { className: 'grid3', role: 'group' }); grid.setAttribute('aria-label', 'لوحة المصابيح');
    const msg = el('div', { className: 'msg', role: 'status' });
    const btns = cells.map((_, i) => {
      const b = el('button', { type: 'button' }); b.dataset.i = i; b.setAttribute('aria-label', `مصباح ${i + 1}`);
      b.addEventListener('click', () => {
        press(i); draw();
        if (cells.every((x) => !x)) solved(lv);
      });
      grid.append(b); return b;
    });
    const draw = () => btns.forEach((b, i) => { b.classList.toggle('on', cells[i]); b.textContent = cells[i] ? '💡' : '·'; b.setAttribute('aria-pressed', cells[i]); });
    draw(); scene.append(grid, msg);
  }

  function renderFinal(lv) {
    let left = FINAL_SECONDS, running = false;
    const clock = el('div', { className: 'timer', textContent: fmt(left), role: 'timer' });
    const start = el('button', { type: 'button', textContent: '▶ ابدأ العدّ التنازلي' });
    const form = el('form', { hidden: true, autocomplete: 'off' });
    const input = el('input', { type: 'text', placeholder: 'رمز الفتحة', autocomplete: 'off', inputMode: 'numeric' });
    input.setAttribute('aria-label', 'رمز الفتحة');
    const msg = el('div', { className: 'msg', role: 'status' });
    form.append(el('div', { className: 'row' }, input, el('button', { type: 'submit', textContent: 'أدخل الرمز' })), msg);
    function fmt(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    const tick = () => {
      clock.textContent = fmt(Math.max(left, 0)); clock.classList.toggle('low', left <= 15);
      if (left <= 0) {
        clearInterval(timer); running = false; form.hidden = true; start.hidden = false; start.textContent = '↺ دوّى الإنذار! حاول مجدداً';
        msg.className = 'msg bad'; msg.textContent = '🚨 انتهى الوقت'; left = FINAL_SECONDS; clock.classList.remove('low');
      }
    };
    start.addEventListener('click', () => {
      running = true; left = FINAL_SECONDS; msg.textContent = ''; start.hidden = true; form.hidden = false; input.value = ''; input.focus();
      clearInterval(timer); timer = setInterval(() => { left--; tick(); }, 1000); tick();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault(); if (!running) return;
      if (matches(input.value, lv.answers)) { clearInterval(timer); finish(); }
      else { left -= 10; msg.className = 'msg bad'; msg.textContent = '❌ رمز خاطئ: خُصمت 10 ثوانٍ'; input.select(); tick(); }
    });
    scene.append(clock, start, form);
  }

  function finish() {
    st.level = 6; st.ms = Date.now() - st.started; save(); render();
  }

  function renderEnd() {
    clearInterval(timer);
    const mins = Math.max(1, Math.round((st.ms || 0) / 60000));
    scene.textContent = '';
    scene.append(el('div', { className: 'end' },
      el('div', { className: 'big', textContent: '🌅' }),
      el('h2', { textContent: 'انفتحت الفتحة!' }),
      el('p', { className: 'story', textContent: 'اندفع الضوء من الأسفل، وخرجتَ من الجزيرة أخيراً.\nأنهيت الألغاز الستة بنجاح.' }),
      el('p', { textContent: `⏱️ المدة التقريبية: ${mins} دقيقة — 💡 التلميحات: ${st.hints}` })));
    Alaisai.toast('🏆 أنهيت لغز الجزيرة!').catch(() => {});
  }

  function render() {
    clearInterval(timer); paintMeta(); scene.textContent = '';
    if (st.level >= 6) return renderEnd();
    const lv = LEVELS[st.level];
    scene.append(el('h2', { textContent: `${lv.icon} ${lv.title}` }), el('p', { className: 'story', textContent: lv.story }));
    if (lv.clue) scene.append(el('div', { className: 'clue' + (lv.big ? ' big' : ''), textContent: lv.clue }));
    const ex = extras(lv); if (ex) scene.append(ex);
    if (lv.type === 'text') renderText(lv); else if (lv.type === 'lights') renderLights(lv); else renderFinal(lv);
    scene.append(hintsBlock(lv));
  }

  $('restart').addEventListener('click', () => {
    if (!confirm('البدء من جديد سيمسح تقدّمك. متأكد؟')) return;
    st = { level: 0, hints: 0, shown: 0, started: Date.now(), done: 0, ms: 0 }; save(); render();
  });

  Alaisai.get('island_state').then((v) => {
    if (v && Number.isInteger(v.level) && v.level >= 0 && v.level <= 6) st = Object.assign(st, v);
  }).catch(() => {}).then(render);
})();
