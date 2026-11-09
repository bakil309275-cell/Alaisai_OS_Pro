const $ = (id) => document.getElementById(id);
let st = { zikr: 'سبحان الله', counts: {}, goal: 33, total: 0 };
const cur = () => st.counts[st.zikr] || 0;
const save = () => Alaisai.set('state', st);
function render() {
  $('zikr').textContent = st.zikr; $('n').textContent = cur();
  $('of').textContent = st.goal ? `من ${st.goal}` : 'بلا حدّ';
  $('tap').classList.toggle('full', !!st.goal && cur() >= st.goal);
  $('goal').value = String(st.goal);
  $('total').textContent = `الإجمالي الكلي: ${st.total}`;
  document.querySelectorAll('[data-z]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.z === st.zikr));
}
$('tap').onclick = () => {
  st.counts[st.zikr] = cur() + 1; st.total++;
  if (st.goal && cur() === st.goal) { Alaisai.toast('تقبّل الله، أتممت ' + st.goal); try { navigator.vibrate && navigator.vibrate(120); } catch (_) {} }
  save(); render();
};
$('reset').onclick = () => { st.counts[st.zikr] = 0; save(); render(); };
$('goal').onchange = (e) => { st.goal = +e.target.value; save(); render(); };
document.querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => { st.zikr = b.dataset.z; save(); render(); }));
Alaisai.get('state').then((v) => {
  if (v && typeof v === 'object') st = { zikr: typeof v.zikr === 'string' ? v.zikr : st.zikr, counts: v.counts && typeof v.counts === 'object' ? v.counts : {}, goal: [0, 33, 99, 100].includes(v.goal) ? v.goal : 33, total: +v.total || 0 };
  render();
}).catch(render);
