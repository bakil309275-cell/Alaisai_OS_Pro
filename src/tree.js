/* شجرة هرمية عامة (حتى 5 مستويات): طي وفتح بالمثلثات، إضافة فرع، تعديل، حذف، تحريك.
 * تُستعمل في أقسام الشاشة الرئيسية وفي لوحة المالك. العقدة: { id, name, c: [] } */
(function () {
  const E = UI.esc, MAX = 5, NAME = 40;
  const uid = () => 't' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

  const Tree = {
    MAX,
    uid,
    /** تنظيف شجرة قادمة من تخزين أو نسخة احتياطية */
    clean(nodes, depth = 1, seen = new Set()) {
      if (!Array.isArray(nodes) || depth > MAX) return [];
      const out = [];
      for (const n of nodes.slice(0, 200)) {
        if (!n || typeof n !== 'object' || typeof n.name !== 'string' || !n.name.trim()) continue;
        let id = typeof n.id === 'string' && /^[\w-]{1,32}$/.test(n.id) ? n.id : uid();
        while (seen.has(id)) id = uid(); seen.add(id);
        out.push({ id, name: n.name.trim().slice(0, NAME), c: Tree.clean(n.c, depth + 1, seen) });
      }
      return out;
    },
    /** مسطّحة بالترتيب: [{ node, depth, parent: مصفوفة الأخوة، idx, path: [أسماء] }] */
    flat(nodes, depth = 1, path = [], out = []) {
      nodes.forEach((node, idx) => { const p = path.concat(node.name); out.push({ node, depth, parent: nodes, idx, path: p }); Tree.flat(node.c, depth + 1, p, out); });
      return out;
    },
    find(nodes, id) { return id ? Tree.flat(nodes).find((r) => r.node.id === id) || null : null; },
    /** معرّفات العقدة وكل أحفادها */
    ids(node) { return [node.id].concat(...node.c.map(Tree.ids)); },
    label(nodes, id) { const r = Tree.find(nodes, id); return r ? r.path.join(' › ') : ''; },
    /** خيارات select مسطّحة مع إزاحة بصرية */
    options(nodes) { return Tree.flat(nodes).map((r) => [r.node.id, ' '.repeat(r.depth - 1) + (r.depth > 1 ? '↳ ' : '') + r.node.name]); },

    /**
     * نافذة إدارة الشجرة.
     * o: { title, nodes (تُعدَّل في مكانها), count(node) → رقم اختياري, onChange(), onDelete(node, ids) اختياري, select(node) اختياري }
     */
    manage(o) {
      const root = document.getElementById('dialog-root'), ov = document.createElement('div'); ov.className = 'dialog-overlay';
      const open = new Set(), nodes = o.nodes; let under = null;
      Tree.flat(nodes).forEach((r) => { if (r.node.c.length && r.depth < 2) open.add(r.node.id); });
      ov.innerHTML = `<div class="dialog tree-dlg" role="dialog" aria-modal="true" aria-label="${E(o.title)}"><h3>${E(o.title)}</h3><ul class="tree-list" role="tree"></ul>
        <p class="tree-under" hidden></p><form class="tree-add"><input class="field" name="v" maxlength="${NAME}" placeholder="إضافة قسم جديد…" aria-label="اسم جديد" autocomplete="off"><button class="btn btn-primary" type="submit">＋ إضافة</button></form>
        <div class="dialog-actions"><button type="button" class="btn btn-sm" data-t="xall">فتح الكل</button><button type="button" class="btn btn-sm" data-t="call">طيّ الكل</button><span class="grow"></span><button type="button" class="btn" data-t="close">إغلاق</button></div></div>`;
      root.appendChild(ov);
      const list = ov.querySelector('.tree-list'), inp = ov.querySelector('[name=v]'), und = ov.querySelector('.tree-under');
      const changed = () => { if (o.onChange) o.onChange(); };
      const draw = () => {
        const rows = [];
        const walk = (arr, depth) => arr.forEach((n) => {
          const kids = n.c.length, isOpen = open.has(n.id), cnt = o.count ? o.count(n) : null;
          rows.push(`<li class="tree-row" role="treeitem" aria-level="${depth}" aria-expanded="${kids ? isOpen : 'false'}" style="--lv:${depth - 1}">
            ${kids ? `<button type="button" class="tg${isOpen ? ' o' : ''}" data-t="tg" data-id="${E(n.id)}" aria-label="${isOpen ? 'طيّ' : 'فتح'} ${E(n.name)}">◂</button>` : '<span class="tg0"></span>'}
            <button type="button" class="tn" data-t="pick" data-id="${E(n.id)}">${E(n.name)}${cnt != null ? ` <span class="badge">${cnt}</span>` : ''}</button>
            <span class="tree-act">${depth < MAX ? `<button type="button" class="btn btn-sm" data-t="add" data-id="${E(n.id)}" aria-label="إضافة فرع تحت ${E(n.name)}" title="إضافة فرع">＋</button>` : ''}
            <button type="button" class="btn btn-sm" data-t="up" data-id="${E(n.id)}" aria-label="أعلى">⬆</button><button type="button" class="btn btn-sm" data-t="down" data-id="${E(n.id)}" aria-label="أسفل">⬇</button>
            <button type="button" class="btn btn-sm" data-t="ren" data-id="${E(n.id)}" aria-label="تعديل ${E(n.name)}">✏️</button><button type="button" class="btn btn-sm btn-danger" data-t="del" data-id="${E(n.id)}" aria-label="حذف ${E(n.name)}">🗑</button></span></li>`);
          if (kids && isOpen) walk(n.c, depth + 1);
        });
        walk(nodes, 1); list.innerHTML = rows.join('') || '<li class="muted tree-none">لا توجد أقسام بعد. أضف أول قسم بالأسفل.</li>';
        const u = under ? Tree.find(nodes, under) : null;
        und.hidden = !u; und.innerHTML = u ? `فرع جديد تحت «${E(u.node.name)}» <button type="button" class="btn btn-sm" data-t="nou">إلغاء</button>` : '';
        inp.placeholder = u ? 'اسم الفرع الجديد…' : 'إضافة قسم جديد…';
      };
      ov.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-t]'); if (!b) return; const t = b.dataset.t, id = b.dataset.id, r = id ? Tree.find(nodes, id) : null;
        if (t === 'close') return ov.remove();
        if (t === 'xall') { Tree.flat(nodes).forEach((x) => { if (x.node.c.length) open.add(x.node.id); }); return draw(); }
        if (t === 'call') { open.clear(); return draw(); }
        if (t === 'nou') { under = null; return draw(); }
        if (!r && t !== 'close') return;
        if (t === 'tg') { open.has(id) ? open.delete(id) : open.add(id); return draw(); }
        if (t === 'add') { under = id; open.add(id); draw(); return inp.focus(); }
        if (t === 'pick') { if (o.select) { ov.remove(); o.select(r.node); } return; }
        if (t === 'up' || t === 'down') { const j = r.idx + (t === 'up' ? -1 : 1); if (j < 0 || j >= r.parent.length) return; r.parent.splice(j, 0, r.parent.splice(r.idx, 1)[0]); changed(); return draw(); }
        if (t === 'ren') {
          const v = await UI.prompt('تعديل الاسم', { value: r.node.name, label: 'الاسم', okText: 'حفظ' }); if (!v || !v.trim()) return;
          const nm = v.trim().slice(0, NAME); if (r.parent.some((x) => x !== r.node && x.name === nm)) return UI.toast('هذا الاسم موجود في نفس المستوى', 'warn');
          r.node.name = nm; changed(); return draw();
        }
        if (t === 'del') {
          const n = r.node.c.length, used = o.count ? Tree.ids(r.node).reduce((s, x) => s + (o.count({ id: x, c: [] }) || 0), 0) : 0;
          if (!(await UI.confirm('حذف «' + r.node.name + '»' + (n ? ' مع كل فروعه' : '') + '؟' + (used ? ' عناصره (' + used + ') لا تُحذف بل تعود بلا قسم.' : ''), { okText: 'حذف' }))) return;
          const gone = Tree.ids(r.node); r.parent.splice(r.idx, 1); if (o.onDelete) o.onDelete(r.node, gone); if (under && gone.includes(under)) under = null; changed(); draw();
        }
      });
      ov.querySelector('.tree-add').addEventListener('submit', (e) => {
        e.preventDefault(); const v = inp.value.trim(); if (!v) return UI.toast('اكتب الاسم أولاً', 'warn');
        const par = under ? Tree.find(nodes, under) : null, arr = par ? par.node.c : nodes;
        if (par && par.depth >= MAX) return UI.toast('بلغت الحد الأقصى: 5 مستويات', 'warn');
        if (arr.some((x) => x.name === v)) return UI.toast('هذا الاسم موجود في نفس المستوى', 'warn');
        arr.push({ id: uid(), name: v.slice(0, NAME), c: [] }); if (par) open.add(par.node.id); inp.value = ''; changed(); draw();
      });
      ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (under) { under = null; draw(); } else ov.remove(); } });
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
      draw(); inp.focus();
    },
  };
  window.Tree = Tree;
})();
