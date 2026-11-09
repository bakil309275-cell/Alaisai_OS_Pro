/* نافذة الإضافة الموحدة: اسحب ملفات أو مجلداً، أو اختر من الجهاز، أو أنشئ ملفاً/مجلداً جديداً.
 * Uploader.choose() تعيد وعداً بـ { files: [{ path, file }], strip } أو { create: 'file' | 'dir' } أو null عند الإلغاء. */
(function () {
  const E = UI.esc;
  const SKIP = /(^|\/)(\.git|node_modules|__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i;
  const size = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB');

  /** قراءة عناصر السحب والإفلات (ملفات ومجلدات متداخلة) */
  async function readDropped(items) {
    const out = [];
    const walk = async (entry, base) => {
      if (entry.isFile) { out.push({ path: base + entry.name, file: await new Promise((ok, no) => entry.file(ok, no)) }); return; }
      if (!entry.isDirectory) return;
      const rd = entry.createReader();
      for (;;) {
        const batch = await new Promise((ok, no) => rd.readEntries(ok, no));
        if (!batch.length) break;
        for (const e of batch) await walk(e, base + entry.name + '/');
      }
    };
    const roots = [...items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    for (const r of roots) await walk(r, '');
    return out;
  }

  const Uploader = {
    choose(o = {}) {
      return new Promise((resolve) => {
        const root = document.getElementById('dialog-root'), ov = document.createElement('div'); ov.className = 'dialog-overlay';
        let list = []; // [{ path, file }]
        ov.innerHTML = `<div class="dialog up-dlg" role="dialog" aria-modal="true" aria-label="${E(o.title || 'إضافة ملفات')}"><h3>${E(o.title || '➕ إضافة ملفات أو مجلد')}</h3>
          <button type="button" class="up-drop" data-u="pick">📁 اسحب ملفات أو مجلداً هنا<br><small>أو اضغط للاختيار من جهازك</small></button>
          <div class="up-btns"><button type="button" class="btn btn-primary" data-u="files">📄 ملفات</button><button type="button" class="btn btn-primary" data-u="dir">📁 مجلد</button></div>
          <label class="up-strip"><input type="checkbox" id="up-strip" checked> تجاهل اسم المجلد الرئيسي (ارفع محتواه مباشرة)</label>
          <ul class="up-list" aria-live="polite"></ul><p class="up-sum muted" hidden></p>
          <details class="up-new"><summary>أو أنشئ جديداً</summary><div class="up-btns"><button type="button" class="btn" data-u="newfile">➕ ملف جديد</button><button type="button" class="btn" data-u="newdir">📁 مجلد جديد</button></div></details>
          <div class="dialog-actions"><button type="button" class="btn btn-success" data-u="go" disabled>⬆️ رفع</button><span class="grow"></span><button type="button" class="btn" data-u="x">إلغاء</button></div>
          <input type="file" id="up-f" multiple hidden><input type="file" id="up-d" webkitdirectory hidden></div>`;
        root.appendChild(ov);
        const ul = ov.querySelector('.up-list'), sum = ov.querySelector('.up-sum'), go = ov.querySelector('[data-u=go]'), strip = ov.querySelector('#up-strip');
        const done = (v) => { ov.remove(); resolve(v); };
        const draw = () => {
          const skipped = list.filter((x) => SKIP.test(x.path)).length, vis = list.filter((x) => !SKIP.test(x.path));
          ul.innerHTML = vis.slice(0, 40).map((x, i) => `<li><span dir="ltr" class="up-name">${E(x.path)}</span><span class="badge">${size(x.file.size)}</span><button type="button" class="btn btn-sm" data-u="rm" data-i="${i}" aria-label="إزالة ${E(x.path)}">✕</button></li>`).join('') +
            (vis.length > 40 ? `<li class="muted">و${vis.length - 40} ملفاً آخر…</li>` : '');
          sum.hidden = !list.length; sum.textContent = vis.length + ' ملف، ' + size(vis.reduce((t, x) => t + x.file.size, 0)) + (skipped ? ` (تُجوهل ${skipped} من مخلّفات النظام)` : '');
          go.disabled = !vis.length; go.textContent = vis.length ? '⬆️ رفع ' + vis.length + ' ملف' : '⬆️ رفع';
        };
        const add = (arr) => { const seen = new Set(list.map((x) => x.path)); arr.forEach((x) => { if (!seen.has(x.path)) { seen.add(x.path); list.push(x); } }); draw(); };
        const fromInput = (inp) => [...inp.files].map((f) => ({ path: (f.webkitRelativePath || f.name).replace(/\\/g, '/').replace(/^\/+/, ''), file: f }));
        ov.querySelector('#up-f').addEventListener('change', (e) => { add(fromInput(e.target)); e.target.value = ''; });
        ov.querySelector('#up-d').addEventListener('change', (e) => { add(fromInput(e.target)); e.target.value = ''; });
        const drop = ov.querySelector('.up-drop');
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', async (e) => {
          e.preventDefault(); drop.classList.remove('over');
          try { add(e.dataTransfer.items && e.dataTransfer.items.length ? await readDropped(e.dataTransfer.items) : [...e.dataTransfer.files].map((f) => ({ path: f.name, file: f }))); }
          catch (_) { UI.toast('تعذّرت قراءة المجلد المُسقَط. استخدم زر «مجلد».', 'warn'); }
        });
        ov.addEventListener('click', (e) => {
          if (e.target === ov) return done(null);
          const b = e.target.closest('[data-u]'); if (!b) return; const u = b.dataset.u;
          if (u === 'x') done(null);
          else if (u === 'pick' || u === 'files') ov.querySelector('#up-f').click();
          else if (u === 'dir') ov.querySelector('#up-d').click();
          else if (u === 'rm') { const vis = list.filter((x) => !SKIP.test(x.path)); list = list.filter((x) => x !== vis[+b.dataset.i]); draw(); }
          else if (u === 'newfile') done({ create: 'file' });
          else if (u === 'newdir') done({ create: 'dir' });
          else if (u === 'go') {
            let vis = list.filter((x) => !SKIP.test(x.path));
            // ملفات المجلد الواحد تبدأ كلها باسمه: نُسقطه إن طُلب ذلك
            const first = vis.map((x) => x.path.split('/')[0]);
            if (strip.checked && vis.every((x) => x.path.includes('/')) && new Set(first).size === 1) vis = vis.map((x) => ({ path: x.path.slice(x.path.indexOf('/') + 1), file: x.file }));
            done({ files: vis });
          }
        });
        ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
        draw(); drop.focus();
      });
    },
  };
  window.Uploader = Uploader;
})();
