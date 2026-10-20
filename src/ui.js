/* واجهة المستخدم: تهريب النصوص، التنبيهات، مربعات الحوار، السمات */
(function () {
  const UI = {};

  UI.esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  UI.toast = (msg, type = 'info', ms = 3000) => {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
    return t;
  };

  /**
   * مربع حوار. يعيد كائن القيم {id: value} أو null عند الإلغاء.
   * fields: {id,label,type(text|password|textarea|select),value,options,required,maxlength,mono,placeholder,autocomplete}
   * validate(values) => نص الخطأ أو falsy
   */
  UI.dialog = ({ title, message = '', fields = [], okText = 'موافق', cancelText = 'إلغاء',
                 danger = false, hideCancel = false, validate = null }) =>
    new Promise((resolve) => {
      const prev = document.activeElement;
      const root = document.getElementById('dialog-root');
      const uid = 'dlg' + Math.random().toString(36).slice(2, 7);
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      const form = document.createElement('form');
      form.className = 'dialog';
      form.noValidate = false;
      form.setAttribute('role', 'dialog');
      form.setAttribute('aria-modal', 'true');
      form.setAttribute('aria-labelledby', uid + 't');

      const ctl = (f) => {
        const id = `${uid}_${f.id}`;
        const common = `id="${id}" name="${UI.esc(f.id)}" class="field${f.mono ? ' code-editor' : ''}"` +
          `${f.required ? ' required' : ''}${f.maxlength ? ` maxlength="${+f.maxlength}"` : ''}` +
          `${f.placeholder ? ` placeholder="${UI.esc(f.placeholder)}"` : ''}` +
          `${f.autocomplete ? ` autocomplete="${UI.esc(f.autocomplete)}"` : ''}`;
        let html;
        if (f.type === 'textarea') html = `<textarea ${common} rows="${f.rows || 6}"></textarea>`;
        else if (f.type === 'select') {
          html = `<select ${common}>${(f.options || []).map(([v, l]) =>
            `<option value="${UI.esc(v)}">${UI.esc(l)}</option>`).join('')}</select>`;
        } else html = `<input ${common} type="${f.type || 'text'}">`;
        return f.label ? `<label class="lbl" for="${id}">${UI.esc(f.label)}</label>${html}` : html;
      };

      form.innerHTML =
        `<h3 id="${uid}t">${UI.esc(title)}</h3>` +
        (message ? `<p class="dialog-msg">${UI.esc(message)}</p>` : '') +
        fields.map(ctl).join('') +
        `<div class="dialog-err" role="alert"></div>` +
        `<div class="dialog-actions">` +
        `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${UI.esc(okText)}</button>` +
        (hideCancel ? '' : `<button type="button" class="btn" data-cancel>${UI.esc(cancelText)}</button>`) +
        `</div>`;
      overlay.appendChild(form);
      root.appendChild(overlay);

      // القيم الابتدائية تُضبط عبر الخصائص لا عبر HTML (آمن ضد الحقن)
      fields.forEach((f) => {
        const el = form.elements[f.id];
        if (el && f.value != null) el.value = f.value;
      });

      const done = (val) => {
        overlay.remove();
        if (prev && prev.focus) try { prev.focus(); } catch (_) {}
        resolve(val);
      };
      const readValues = () => {
        const out = {};
        fields.forEach((f) => { out[f.id] = form.elements[f.id].value; });
        return out;
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const vals = readValues();
        const err = validate ? validate(vals) : '';
        if (err) { form.querySelector('.dialog-err').textContent = err; return; }
        done(fields.length ? vals : {});
      });
      form.querySelector('[data-cancel]')?.addEventListener('click', () => done(null));
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay && !hideCancel) done(null); });
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !hideCancel) { e.stopPropagation(); done(null); }
        if (e.key === 'Tab') { // حصر التركيز داخل الحوار
          const f = [...form.querySelectorAll('input,select,textarea,button')].filter((x) => !x.disabled);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      (form.querySelector('input,textarea,select') || form.querySelector('button')).focus();
    });

  UI.confirm = (message, { title = 'تأكيد', okText = 'تأكيد', danger = true } = {}) =>
    UI.dialog({ title, message, okText, danger }).then((v) => !!v);

  UI.prompt = (title, { label = '', value = '', type = 'text', placeholder = '', okText = 'موافق' } = {}) =>
    UI.dialog({ title, okText, fields: [{ id: 'v', label, value, type, placeholder, required: true }] })
      .then((v) => (v ? v.v : null));

  // ---------- السمات ----------
  UI.themePref = 'auto';
  UI.applyTheme = (pref) => {
    UI.themePref = ['auto', 'dark', 'light'].includes(pref) ? pref : 'auto';
    const light = matchMedia('(prefers-color-scheme: light)').matches;
    const t = UI.themePref === 'auto' ? (light ? 'light' : 'dark') : UI.themePref;
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = t === 'light' ? '#e6f0ff' : '#1a1a2e';
    try { localStorage.setItem('alaisai_theme', UI.themePref); } catch (_) {}
  };
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (UI.themePref === 'auto') UI.applyTheme('auto');
  });

  window.UI = UI;
})();
