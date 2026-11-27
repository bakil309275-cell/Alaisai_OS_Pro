/* مدير زر الرجوع (مثلث الهاتف / رجوع المتصفح): رجوع تدريجي داخل العيسائي برو بدل الخروج المباشر.
 * الفكرة: كل «طبقة» ظاهرة (نافذة حوار، نافذة المنصة، المسرح، صفحة داخلية) تدفع مدخلاً واحداً في سجل المتصفح.
 * الرجوع يغلق الطبقة العليا فقط. وإغلاقها بزر التطبيق (✕ أو إلغاء) يزيل مدخلها فلا يتراكم السجل.
 * عند سطح المكتب (لا طبقات) يسأل: «هل تريد الخروج؟» — نعم تغادر، لا تبقى.
 * الاكتشاف تلقائي (MutationObserver) فلا يلزم تعديل كل نافذة؛ والصفحات الداخلية تستعمل Nav.sync. */
(function () {
  const Nav = {
    stack: [],          // الطبقات من الأقدم إلى الأحدث؛ لكل منها مدخل في السجل
    q: Promise.resolve(), expect: 0, waiter: null, leaving: false, prompting: false, ready: false,

    init() {
      if (this.ready || !window.history || !history.pushState) return; this.ready = true;
      // قاعدة + حارس: الرجوع من سطح المكتب يستهلك الحارس فنعرف أن المستخدم يريد المغادرة
      try {
        const st = history.state && history.state.alaisai;
        if (st === 'guard') { /* إعادة تحميل على الحارس: السجل سليم، لا تُضف مدخلاً */ }
        else if (st === 'layer') history.replaceState({ alaisai: 'guard' }, ''); // بقايا طبقة قبل إعادة التحميل: الرجوع ينزل بها للقاعدة
        else { history.replaceState({ alaisai: 'base' }, ''); history.pushState({ alaisai: 'guard' }, ''); }
      } catch (_) { this.ready = false; return; }
      window.addEventListener('popstate', (e) => this.onPop(e));
      this.watch(); this.nativeBack();
    },

    /** زر الرجوع في هاتف أندرويد داخل غلاف Capacitor: نتحكم به كاملاً بدل الاعتماد على سجل WebView
     *  (يغلق الطبقة العليا، وإن لم يبقَ شيء يسأل «هل تريد الخروج؟»، و«نعم» تخرج فوراً) */
    nativeBack(tries) {
      if (this._nb) return; const C = window.Capacitor; if (!C || !(C.isNativePlatform ? C.isNativePlatform() : true)) return;
      const A = this.capApp();
      if (!A) { if ((tries || 0) < 20) setTimeout(() => this.nativeBack((tries || 0) + 1), 250); return; }
      this._nb = true;
      A.addListener('backButton', async () => {
        const live = this.stack.filter((x) => !x.dead);
        if (live.length) {
          const L = live[live.length - 1]; let r; try { r = L.close ? await L.close() : undefined; } catch (_) { r = undefined; }
          if (r !== false && !L.dead) this.release(L);   // إن لم تُغلَق الطبقة تلقائياً نزيلها
          return;
        }
        this.exitPrompt();
      });
    },

    // ---------- سجل المتصفح (عمليات متسلسلة كي لا تتداخل) ----------
    _push() { this.q = this.q.then(() => { try { history.pushState({ alaisai: 'layer' }, ''); } catch (_) { /* لا شيء */ } }); },
    _back() {
      this.q = this.q.then(() => new Promise((res) => {
        this.expect++;
        const t = setTimeout(() => { if (this.waiter) { this.waiter = null; this.expect = Math.max(0, this.expect - 1); } res(); }, 700);
        this.waiter = () => { clearTimeout(t); res(); };
        try { history.back(); } catch (_) { clearTimeout(t); this.waiter = null; this.expect = Math.max(0, this.expect - 1); res(); }
      }));
    },

    // ---------- الطبقات ----------
    push(L) { if (!this.ready) return L; this.stack.push(L); this._push(); return L; },
    release(L) {
      const i = this.stack.indexOf(L); if (i < 0) return;
      if (L.id === 'stage') this.stack.slice(i).forEach((x) => { x.dead = true; }); // إغلاق المسرح يُغلق كل ما فوقه
      else L.dead = true;
      this.trim();
    },
    /** يزيل الطبقات الميتة من القمة ويعيد السجل لموضعه (الميتة تحت طبقة حيّة تبقى حتى تنكشف) */
    trim() {
      while (this.stack.length && this.stack[this.stack.length - 1].dead) {
        this.stack.pop(); if (!this.leaving) this._back();
      }
    },
    /** طبقة منطقية (صفحة داخلية): تُدفع حين active وتُزال حين لا. close يُستدعى عند الرجوع. */
    sync(id, active, close) {
      if (!this.ready) return;
      const L = this.stack.find((x) => x.id === id && !x.dead);
      if (active) { if (L) L.close = close; else this.push({ id, close, dead: false }); }
      else if (L) this.release(L);
    },

    onPop(e) {
      if (this.expect > 0) {
        this.expect--; if (this.waiter) { const w = this.waiter; this.waiter = null; w(); }
        if (this.leaving) history.back();
        return;
      }
      if (this.leaving) { history.back(); return; }
      if (this.stack.length) return this.userBack();
      if (!(e.state && e.state.alaisai === 'base')) { history.back(); return; } // مداخل قديمة بعد إعادة تحميل: انزل حتى القاعدة
      this.exitPrompt();
    },
    async userBack() {
      const L = this.stack.pop();
      if (L.dead) { this.trim(); history.back(); return; }  // مدخل ميت: لا أثر مرئي، تابع للأسفل
      let r; try { r = L.close ? await L.close() : undefined; } catch (_) { r = undefined; }
      if (r === false) { this.stack.push(L); this._push(); return; }   // رفضت الطبقة الإغلاق (مثلاً حوار يرفض): أعدها
      this.trim();
    },

    // ---------- الخروج من سطح المكتب ----------
    exitPrompt() {
      if (this.prompting) return; this.prompting = true;
      try { history.pushState({ alaisai: 'guard' }, ''); } catch (_) { /* لا شيء */ }
      UI.dialog({ title: 'الخروج من العيسائي برو', message: 'هل تريد الخروج من العيسائي برو؟', okText: 'نعم، خروج', cancelText: 'لا، أبقَ', danger: false })
        .then((yes) => { this.prompting = false; if (yes) this.leave(); });
    },
    /** إضافة التطبيق في غلاف أندرويد (Capacitor)؛ null في المتصفح */
    capApp() { try { const C = window.Capacitor; return C && C.Plugins && C.Plugins.App && C.Plugins.App.exitApp ? C.Plugins.App : null; } catch (_) { return null; } },
    leave() {
      const A = this.capApp(); if (A) { try { return A.exitApp(); } catch (_) { /* نكمل بالطريقة العادية */ } }   // تطبيق أندرويد: خروج فوري بعد الموافقة، دون تأكيد ثانٍ
      this.leaving = true; setTimeout(() => { this.leaving = false; }, 2500);
      try { window.close(); } catch (_) { /* لا شيء */ }
      history.back();
    },

    // ---------- اكتشاف الطبقات تلقائياً ----------
    /** يغلق حواراً بأفضل طريقة متاحة: إلغاء، ثم Escape، ثم زر إغلاق، ثم النقر على الخلفية، ثم الموافقة لحوار معلومات */
    closeOverlay(el) {
      const ev = (t, o) => el.dispatchEvent(new (t === 'keydown' ? KeyboardEvent : MouseEvent)(t, Object.assign({ bubbles: true, cancelable: true }, o)));
      const c = el.querySelector('[data-cancel]'); if (c) c.click();
      if (el.isConnected) ev('keydown', { key: 'Escape' });
      if (el.isConnected) {
        const b = [...el.querySelectorAll('.dialog-actions button, [data-s=x], [data-v=x], [data-g=x]')].filter((x) => /إغلاق|إلغاء|رجوع|تخطي|حسناً|✕|❌/.test(x.textContent) && !x.matches('[type=submit]')).pop();
        if (b) b.click();
      }
      if (el.isConnected) { ev('mousedown'); ev('click'); }
      if (el.isConnected && !el.querySelector('[data-cancel]')) { const ok = el.querySelector('button[type=submit]'); if (ok && el.querySelectorAll('button').length <= 2) ok.click(); }
      return !el.isConnected;
    },
    watch() {
      const add = (n, close) => { if (n.nodeType === 1 && !this.stack.some((x) => x.el === n)) this.push({ el: n, close: () => close(n), dead: false }); };
      const gone = (n) => { const L = this.stack.find((x) => x.el === n); if (L) this.release(L); };
      const dr = document.getElementById('dialog-root');
      if (dr) new MutationObserver((ms) => ms.forEach((m) => { m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('dialog-overlay')) add(n, (el) => this.closeOverlay(el)); }); m.removedNodes.forEach(gone); })).observe(dr, { childList: true });
      new MutationObserver((ms) => ms.forEach((m) => {
        m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('comm-sheet')) add(n, () => { if (window.Community) Community.close(); else n.remove(); return !n.isConnected; }); });
        m.removedNodes.forEach(gone);
      })).observe(document.body, { childList: true });
      const stage = document.getElementById('stage-overlay');
      if (stage) {
        const sync = () => {
          const open = !stage.classList.contains('hidden'), L = this.stack.find((x) => x.id === 'stage' && !x.dead);
          if (open && !L) this.push({ id: 'stage', el: stage, close: () => { OS.closeStage(); }, dead: false });
          else if (!open && L) this.release(L);
        };
        new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ['class'] }); sync();
      }
    },
  };
  window.Nav = Nav;
})();
