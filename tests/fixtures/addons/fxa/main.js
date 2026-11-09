// حاسبة بمحلّل رياضي خاص (بدون eval)
const KEYS = [
  ['C', 'مسح', 'fn'], ['⌫', 'حذف', 'fn'], ['%', 'نسبة', 'fn'], ['÷', 'قسمة', 'op'],
  ['7'], ['8'], ['9'], ['×', 'ضرب', 'op'],
  ['4'], ['5'], ['6'], ['−', 'طرح', 'op'],
  ['1'], ['2'], ['3'], ['+', 'جمع', 'op'],
  ['0'], ['.', 'فاصلة'], ['=', 'يساوي', 'op eq'],
];
const keys = document.getElementById('keys'), out = document.getElementById('out'), exprEl = document.getElementById('expr');
let expr = '', justEvaluated = false;

KEYS.forEach(([k, label, cls]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = k; if (label) b.setAttribute('aria-label', label); if (cls) b.className = cls;
  b.addEventListener('click', () => press(k));
  keys.appendChild(b);
});

function tokenize(s) {
  const t = [], re = /\s*(\d+\.?\d*|\.\d+|[+\-×÷*/()%])/gy; let m, last = 0;
  while ((m = re.exec(s))) { t.push(m[1]); last = re.lastIndex; }
  if (last !== s.length) throw new Error('bad');
  return t;
}
function evaluate(s) {
  const t = tokenize(s.replace(/−/g, '-')); let i = 0;
  const peek = () => t[i], next = () => t[i++];
  function primary() {
    const x = next();
    if (x === undefined) throw new Error('bad');
    if (x === '(') { const v = sum(); if (next() !== ')') throw new Error('bad'); return v; }
    if (x === '-') return -primary();
    if (x === '+') return primary();
    const n = parseFloat(x); if (Number.isNaN(n)) throw new Error('bad'); return n;
  }
  function postfix() { let v = primary(); while (peek() === '%') { next(); v = v / 100; } return v; }
  function product() {
    let v = postfix();
    while (peek() === '×' || peek() === '*' || peek() === '÷' || peek() === '/') {
      const o = next(), r = postfix();
      if ((o === '÷' || o === '/') && r === 0) throw new Error('div0');
      v = (o === '×' || o === '*') ? v * r : v / r;
    }
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === '+' || peek() === '-') { const o = next(), r = product(); v = o === '+' ? v + r : v - r; }
    return v;
  }
  const v = sum(); if (i !== t.length) throw new Error('bad'); return v;
}
const fmt = (n) => { const r = Math.round(n * 1e10) / 1e10; return Number.isFinite(r) ? String(r) : 'خطأ'; };

function render() { exprEl.textContent = expr; out.textContent = expr || '0'; }
function press(k) {
  if (k === 'C') { expr = ''; justEvaluated = false; }
  else if (k === '⌫') { expr = expr.slice(0, -1); }
  else if (k === '=') {
    if (!expr) return;
    try { const r = fmt(evaluate(expr)); exprEl.textContent = expr + ' ='; out.textContent = r; expr = r === 'خطأ' ? '' : r; justEvaluated = true; return; }
    catch (e) { exprEl.textContent = expr; out.textContent = e.message === 'div0' ? 'لا يمكن القسمة على صفر' : 'تعبير غير صالح'; return; }
  } else {
    if (justEvaluated && /\d|\./.test(k)) expr = '';
    justEvaluated = false;
    if (k === '.' && expr.split(/[+\-−×÷%()]/).pop().includes('.')) return;
    expr += k;
  }
  render();
}
addEventListener('keydown', (e) => {
  const map = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C' };
  const k = map[e.key] || e.key;
  if (/^[0-9.+%]$/.test(k) || ['×', '÷', '−', '=', '⌫', 'C'].includes(k)) { e.preventDefault(); press(k); }
});
render();
