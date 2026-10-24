/* الإضافات: حزمة ملفات (manifest.json + index.html + main.js + style.css) تعمل كتطبيق معزول على سطح المكتب */
(function () {
  const E = UI.esc;
  // أسماء الإضافات بأي لغة، ومسارات الملفات مجلدات متداخلة (src/bridge/File.js). التحقق في Store ليتطابق مع التخزين
  const NAME_RE = { test: (n) => Store.validName(n) }, FILE_RE = { test: (p) => Store.validPath(p) }, VER_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
  const MAX_FILES = 100, MAX_FILE = 500000, MAX_TOTAL = 2000000;
  // أساس مظهر الإضافات: متغيرات داكن/فاتح يمكن للإضافة استخدامها (var(--bg), var(--fg), var(--accent)...)
  const BASE_CSS = ':root{--bg:#fff;--fg:#1b1f2a;--muted:#555e70;--card:#f1f3f8;--line:#cfd5e0;--accent:#0b6e9c;--accent-fg:#fff;--danger:#b4174f}' +
    'html[data-theme=dark]{--bg:#16161d;--fg:#f1f2f6;--muted:#b4bacb;--card:#23232d;--line:#3d3d4d;--accent:#4cc9f0;--accent-fg:#04202a;--danger:#ff7aa8}' +
    'html,body{margin:0;background:var(--bg);color:var(--fg)}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}[hidden]{display:none!important}';
  const KEEP = '.gitkeep'; // ملف يحفظ المجلد الفارغ (git لا يحتفظ بمجلد بلا ملفات)
  const normPath = (p) => { const out = []; for (const seg of String(p).split(/[?#]/)[0].split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); } return out.join('/'); };
  const isLocalRef = (u) => !/^[a-z][\w+.\-]*:|^\/\//i.test(u);
  const jsSafe = (s) => s.replace(/<\/(script)/gi, '<\\/$1');
  const cssSafe = (s) => s.replace(/<\/(style)/gi, '<\\/$1');

  const Addons = {
    NAME_RE, FILE_RE, KEEP, normPath,
    list() { return Store.db.explorer.addons; },
    get(name) { return Store.db.explorer.addons.find((a) => a.name === name); },
    file(addon, name) { return addon.files.find((f) => f.name === name); },
    // هيكل المجلدات: يعيد {dirs:[أسماء المجلدات المباشرة], files:[ملفات هذا المستوى]} لمسار مجلد داخل الإضافة ('' = الجذر)
    listDir(files, dir = '') {
      const pre = dir ? dir + '/' : '', dirs = new Set(), here = [];
      for (const f of files) {
        if (!f.name.startsWith(pre)) continue;
        const rest = f.name.slice(pre.length), i = rest.indexOf('/');
        if (i < 0) { if (rest !== KEEP) here.push(f); } else dirs.add(rest.slice(0, i));
      }
      return { dirs: [...dirs].sort((a, b) => a.localeCompare(b, 'ar')), files: here.sort((a, b) => a.name.localeCompare(b.name, 'ar')) };
    },

    cmpVer(a, b) {
      const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
      for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; }
      return 0;
    },

    // يقرأ manifest.json ويطبّعه: يعيد {manifest} أو {error}
    manifest(addon) {
      const f = this.file(addon, 'manifest.json');
      if (!f) return { error: 'الملف manifest.json غير موجود' };
      let m; try { m = JSON.parse(f.content); } catch (e) { return { error: 'manifest.json ليس JSON صالحاً: ' + e.message }; }
      if (!m || typeof m !== 'object' || Array.isArray(m)) return { error: 'manifest.json يجب أن يكون كائناً' };
      const list = (v, d) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && FILE_RE.test(x)).slice(0, 20) : d);
      const manifest = {
        id: addon.name,
        name: (typeof m.name === 'string' && m.name.trim().slice(0, 60)) || addon.name,
        icon: (typeof m.icon === 'string' && m.icon.trim().slice(0, 8)) || '🧩',
        version: typeof m.version === 'string' && VER_RE.test(m.version) ? m.version : '1.0.0',
        description: typeof m.description === 'string' ? m.description.slice(0, 200) : '',
        author: typeof m.author === 'string' ? m.author.slice(0, 60) : '',
        scripts: list(m.scripts, ['main.js']),
        styles: list(m.styles, ['style.css']),
      };
      return { manifest };
    },

    // يبني مستنداً كاملاً للتشغيل داخل الـ sandbox
    buildDoc(addon) {
      const r = this.manifest(addon);
      if (r.error) throw new Error(r.error);
      const m = r.manifest;
      const txt = (n) => { const f = this.file(addon, n); return f ? f.content : ''; };
      const used = new Set();
      let body = txt('index.html'), headExtra = '';
      if (/<!doctype|<html|<body/i.test(body)) { // مستند كامل: نأخذ body وأنماط head فقط (DOMParser لا ينفّذ شيئاً)
        const d = new DOMParser().parseFromString(body, 'text/html');
        headExtra = [...d.head.querySelectorAll('style')].map((x) => `<style>${cssSafe(x.textContent)}</style>`).join('');
        body = d.body.innerHTML;
      }
      if (!body.trim()) body = '<main id="app"></main>';
      // مراجع الملفات المحلية في index.html (script src / link href) تُدمج من ملفات الإضافة بمساراتها
      body = body.replace(/<script\b[^>]*?\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/script>/gi, (m, q, src) => {
        if (!isLocalRef(src)) return m; const p = normPath(src), f = this.file(addon, p);
        if (!f) return m; used.add(p); return `<script>\n${jsSafe(f.content)}\n<\/script>`; });
      body = body.replace(/<link\b[^>]*>/gi, (m) => {
        if (!/rel\s*=\s*["']?stylesheet/i.test(m)) return m; const h = m.match(/\bhref\s*=\s*(["'])([^"']+)\1/); if (!h || !isLocalRef(h[2])) return m;
        const p = normPath(h[2]), f = this.file(addon, p); if (!f) return m; used.add(p); return `<style>${cssSafe(f.content)}</style>`; });
      const css = m.styles.filter((n) => !used.has(normPath(n))).map((n) => cssSafe(txt(n))).join('\n');
      const js = m.scripts.filter((n) => !used.has(normPath(n))).map((n) => `<script>\n${jsSafe(txt(n))}\n<\/script>`).join('\n');
      // Alaisai.file(path) / Alaisai.files(): قراءة ملفات الإضافة النصية (بيانات، قوالب...) من أي مجلد فيها
      const skip = new Set(['manifest.json', 'index.html', ...used, ...m.scripts.map(normPath), ...m.styles.map(normPath)]); // ما نُفّذ أصلاً لا يُكرَّر
      const map = {}; addon.files.forEach((f) => { if (!skip.has(f.name) && f.name.split('/').pop() !== KEEP) map[f.name] = f.content; });
      const fileApi = '<script>(function(){var F=' + JSON.stringify(map).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') +
        ';function n(p){var o=[];String(p).split(/[?#]/)[0].split("/").forEach(function(s){if(!s||s===".")return;if(s==="..")o.pop();else o.push(s)});return o.join("/")}' +
        'Alaisai.file=function(p){p=n(p);return Object.prototype.hasOwnProperty.call(F,p)?F[p]:null};Alaisai.files=function(){return Object.keys(F)}})()<\/script>';
      return Viewer.head(`<title>${E(m.name)}</title><style>${BASE_CSS}</style>` + (css ? `<style>${css}</style>` : '') + headExtra + fileApi) + '<body>' + body + js + '</body></html>';
    },

    // ---------- الحزم (تصدير/استيراد/متجر) ----------
    toPackage(addon) {
      const r = this.manifest(addon);
      return { format: 'alaisai-addon', version: 1, id: addon.name,
        manifest: r.manifest || { id: addon.name, name: addon.name },
        files: addon.files.map((f) => ({ name: f.name, content: f.content })) };
    },
    validatePackage(pkg) {
      const bad = (m) => { throw new Error(m); };
      if (!pkg || typeof pkg !== 'object' || pkg.format !== 'alaisai-addon') bad('هذا ليس ملف إضافة صالحاً (alaisai-addon)');
      if (pkg.version !== 1) bad('إصدار حزمة الإضافة غير مدعوم');
      if (typeof pkg.id !== 'string' || !NAME_RE.test(pkg.id)) bad('معرّف الإضافة غير صالح (حتى 60 حرفاً بلا / \\ : * ? " < > | ولا نقطة في البداية أو النهاية)');
      if (!Array.isArray(pkg.files) || !pkg.files.length || pkg.files.length > MAX_FILES) bad(`عدد الملفات غير صالح (1–${MAX_FILES})`);
      let total = 0; const seen = new Set();
      const files = pkg.files.map((f) => {
        if (!f || typeof f.name !== 'string' || !FILE_RE.test(f.name) || typeof f.content !== 'string') bad('مسار ملف غير صالح داخل الحزمة: ' + String(f && f.name).slice(0, 60));
        if (seen.has(f.name)) bad('أسماء ملفات مكررة'); seen.add(f.name);
        if (f.content.length > MAX_FILE) bad(`الملف ${f.name} كبير جداً`);
        total += f.content.length; return { name: f.name, content: f.content };
      });
      if (total > MAX_TOTAL) bad('حجم الإضافة كبير جداً');
      const addon = { name: pkg.id, source: 'local', files };
      const r = this.manifest(addon); if (r.error) bad(r.error);
      return { addon, manifest: r.manifest };
    },

    // يضيف/يحدّث إضافة في المستكشف (بدون المساس ببياناتها) ويحدّث بطاقة سطح المكتب إن كانت مثبّتة
    put(addon, source) {
      const list = this.list(), i = list.findIndex((a) => a.name === addon.name);
      const rec = { name: addon.name, source, files: addon.files };
      if (i >= 0) list[i] = rec; else { if (list.length >= 100) throw new Error('بلغت الحد الأقصى للإضافات'); list.push(rec); }
      this.syncRegistry(addon.name);
      Store.save();
    },
    remove(name) {
      Store.db.explorer.addons = this.list().filter((a) => a.name !== name);
      Store.db.registry = Store.db.registry.filter((a) => !(a.type === 'addon' && a.content === name));
      Store.db.registry.forEach((a, i) => (a.order = i));
      delete Store.db.appData['addon:' + name];
      Store.save();
    },

    // ---------- سطح المكتب ----------
    entry(name) { return Store.db.registry.find((a) => a.type === 'addon' && a.content === name); },
    isInstalled(name) { return !!this.entry(name); },
    install(name) {
      const addon = this.get(name); if (!addon) throw new Error('الإضافة غير موجودة');
      if (this.entry(name)) return;
      if (Store.db.registry.length >= 200) throw new Error('بلغت الحد الأقصى للتطبيقات');
      const m = this.manifest(addon).manifest || { name, icon: '🧩' };
      Store.db.registry.push({ id: 'addon_' + name, name: m.name, icon: m.icon, type: 'addon', content: name, order: Store.db.registry.length });
      Store.save(); OS.renderDesktop();
    },
    uninstall(name) {
      Store.db.registry = Store.db.registry.filter((a) => !(a.type === 'addon' && a.content === name));
      Store.db.registry.forEach((a, i) => (a.order = i)); Store.save(); OS.renderDesktop();
    },
    syncRegistry(name) { // بعد تعديل manifest: حدّث الاسم والأيقونة
      const e = this.entry(name), addon = this.get(name); if (!e || !addon) return;
      const m = this.manifest(addon).manifest; if (!m) return;
      e.name = m.name; e.icon = m.icon; OS.renderDesktop();
    },

    template(name) {
      return [
        { name: 'manifest.json', content: JSON.stringify({ id: name, name, icon: '🧩', version: '1.0.0', description: 'إضافة جديدة', author: '' }, null, 2) },
        { name: 'index.html', content: '<main id="app">\n  <h1>مرحباً من الإضافة 👋</h1>\n  <p>عدد مرات الفتح: <b id="n">…</b></p>\n  <button id="btn">إشعار</button>\n</main>\n' },
        { name: 'main.js', content: '// واجهة النظام متاحة عبر Alaisai: toast / get / set / remove / keys\n(async () => {\n  const n = ((await Alaisai.get("opens")) || 0) + 1;\n  await Alaisai.set("opens", n);\n  document.getElementById("n").textContent = n;\n  document.getElementById("btn").onclick = () => Alaisai.toast("تعمل الإضافة بنجاح ✅");\n})();\n' },
        { name: 'style.css', content: 'body { font-family: system-ui, sans-serif; padding: 16px; }\nbutton { padding: 8px 16px; border: 0; border-radius: 8px; background: #0b7fb0; color: #fff; cursor: pointer; }\n' },
      ];
    },

    // ---------- تصدير/استيراد ----------
    export(name) {
      const addon = this.get(name); if (!addon) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(this.toPackage(addon), null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.alaisai-addon.json` });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    async installPackage(pkg, source) { // يعيد اسم الإضافة، أو null إن ألغى المستخدم
      const { addon, manifest } = this.validatePackage(pkg);
      const old = this.get(addon.name);
      if (old) {
        const om = this.manifest(old).manifest, ov = om ? om.version : '0.0.0';
        const ok = await UI.confirm(`الإضافة «${manifest.name}» موجودة (الإصدار ${ov}). استبدالها بالإصدار ${manifest.version}؟ تبقى بياناتها محفوظة.`,
          { title: 'استبدال الإضافة', okText: 'استبدال', danger: false });
        if (!ok) return null;
      }
      this.put(addon, source);
      return addon.name;
    },
    importFile() {
      return new Promise((resolve) => {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
        input.onchange = async () => {
          const f = input.files[0]; if (!f) return resolve(null);
          try {
            if (f.size > 3_000_000) throw new Error('الملف كبير جداً');
            resolve(await this.installPackage(JSON.parse(await f.text()), 'import'));
          } catch (e) { UI.toast('❌ ' + (e instanceof SyntaxError ? 'الملف ليس JSON صالحاً' : e.message), 'error'); resolve(null); }
        };
        input.click();
      });
    },
  };

  // ---- العارض ----
  Viewer.addon = (app, el) => {
    const addon = Addons.get(app.content);
    const problem = (msg) => { const d = document.createElement('div'); d.className = 'sys-pad';
      d.innerHTML = '<div class="notice danger"></div>'; d.firstChild.textContent = msg; el.appendChild(d); };
    if (!addon) return problem('هذه الإضافة لم تعد موجودة. يمكنك إزالة أيقونتها من لوحة التحكم.');
    let doc; try { doc = Addons.buildDoc(addon); } catch (e) { return problem('تعذّر تشغيل الإضافة: ' + e.message); }
    Viewer.runDoc(el, { title: app.name, doc, ns: 'addon:' + addon.name });
  };

  window.Addons = Addons;
})();
