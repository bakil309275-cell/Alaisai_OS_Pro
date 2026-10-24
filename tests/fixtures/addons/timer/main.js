const $ = (id) => document.getElementById(id);
const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');
// ---- التبويبات ----
const tabs = [['tab-sw', 'p-sw'], ['tab-cd', 'p-cd']];
tabs.forEach(([t, p]) => $(t).addEventListener('click', () => tabs.forEach(([t2, p2]) => {
  $(t2).setAttribute('aria-selected', t2 === t); $(p2).hidden = p2 !== p;
})));
// ---- ساعة الإيقاف ----
let swRun = false, swStart = 0, swAcc = 0, swRaf = 0, lastLap = 0;
const swNow = () => swAcc + (swRun ? performance.now() - swStart : 0);
const fmt = (ms) => `${pad(ms / 60000)}:${pad((ms / 1000) % 60)}.${pad((ms % 1000) / 10)}`;
function swTick() { $('sw').textContent = fmt(swNow()); if (swRun) swRaf = requestAnimationFrame(swTick); }
$('sw-go').onclick = () => {
  if (swRun) { swAcc = swNow(); swRun = false; cancelAnimationFrame(swRaf); $('sw-go').textContent = 'متابعة'; $('sw-lap').disabled = true; }
  else { swStart = performance.now(); swRun = true; $('sw-go').textContent = 'إيقاف'; $('sw-lap').disabled = false; swTick(); }
  swTick();
};
$('sw-lap').onclick = () => {
  const t = swNow(), li = document.createElement('li');
  li.innerHTML = '<span></span><span></span>'; li.children[0].textContent = 'لفّة ' + ($('laps').children.length + 1);
  li.children[1].textContent = fmt(t - lastLap) + '  |  ' + fmt(t); lastLap = t; $('laps').prepend(li);
};
$('sw-reset').onclick = () => { swRun = false; cancelAnimationFrame(swRaf); swAcc = 0; lastLap = 0; $('laps').textContent = ''; $('sw-go').textContent = 'ابدأ'; $('sw-lap').disabled = true; swTick(); };
// ---- المؤقّت التنازلي ----
let cdRun = false, cdEnd = 0, cdLeft = 0, cdTimer = 0;
const total = () => Math.max(0, Math.min(999, +$('min').value || 0)) * 60 + Math.max(0, Math.min(59, +$('sec').value || 0));
const showCd = (s) => { $('cd').textContent = `${pad(s / 60)}:${pad(s % 60)}`; $('cd').classList.toggle('done', s === 0 && !cdRun && cdLeft === 0 && finished); };
let finished = false;
function cdTick() {
  const left = Math.max(0, Math.ceil((cdEnd - Date.now()) / 1000));
  showCd(left);
  if (left <= 0) { clearInterval(cdTimer); cdRun = false; cdLeft = 0; finished = true; $('cd').classList.add('done'); $('cd-go').textContent = 'ابدأ'; Alaisai.toast('⏰ انتهى الوقت!'); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (_) {} }
}
$('cd-go').onclick = () => {
  if (cdRun) { cdLeft = Math.max(0, Math.ceil((cdEnd - Date.now()) / 1000)); clearInterval(cdTimer); cdRun = false; $('cd-go').textContent = 'متابعة'; return; }
  const s = cdLeft || total(); if (!s) return;
  finished = false; $('cd').classList.remove('done'); cdEnd = Date.now() + s * 1000; cdRun = true; $('cd-go').textContent = 'إيقاف مؤقت';
  clearInterval(cdTimer); cdTimer = setInterval(cdTick, 250); cdTick();
};
$('cd-reset').onclick = () => { clearInterval(cdTimer); cdRun = false; cdLeft = 0; finished = false; $('cd-go').textContent = 'ابدأ'; $('cd').classList.remove('done'); showCd(total()); };
['min', 'sec'].forEach((id) => $(id).addEventListener('input', () => { if (!cdRun) { cdLeft = 0; showCd(total()); } }));
swTick(); showCd(total());
