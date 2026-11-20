const $ = (id) => document.getElementById(id);
let tasks = [], filter = 'all';
const save = () => Alaisai.set('tasks', tasks);
function render() {
  const list = $('list'); list.textContent = '';
  const shown = tasks.filter((t) => filter === 'all' || (filter === 'done') === t.done);
  shown.forEach((t) => {
    const li = document.createElement('li'); if (t.done) li.className = 'done';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = t.done; cb.setAttribute('aria-label', 'إنجاز: ' + t.text);
    cb.onchange = () => { t.done = cb.checked; save(); render(); };
    const sp = document.createElement('span'); sp.textContent = t.text;
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '🗑'; del.setAttribute('aria-label', 'حذف: ' + t.text);
    del.onclick = () => { tasks = tasks.filter((x) => x !== t); save(); render(); };
    li.append(cb, sp, del); list.appendChild(li);
  });
  const left = tasks.filter((t) => !t.done).length;
  $('count').textContent = tasks.length ? `${left} متبقية من ${tasks.length}` : 'لا توجد مهام. أضف أول مهمة 👆';
  $('clear').hidden = !tasks.some((t) => t.done);
  document.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === filter));
}
$('f').onsubmit = (e) => {
  e.preventDefault(); const v = $('in').value.trim(); if (!v) return;
  if (tasks.length >= 500) return Alaisai.toast('بلغت الحد الأقصى للمهام');
  tasks.unshift({ id: Date.now() + Math.random(), text: v, done: false }); $('in').value = ''; save(); render();
};
document.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; render(); }));
$('clear').onclick = () => { tasks = tasks.filter((t) => !t.done); save(); render(); };
Alaisai.get('tasks').then((v) => { tasks = Array.isArray(v) ? v.filter((t) => t && typeof t.text === 'string').slice(0, 500) : []; render(); }).catch(render);
