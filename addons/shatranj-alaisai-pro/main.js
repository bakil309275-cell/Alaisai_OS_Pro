(() => {
  const files = { w: ['♙','♘','♗','♖','♕','♔'], b: ['♟','♞','♝','♜','♛','♚'] };
  const start = [['r','n','b','q','k','b','n','r'], Array(8).fill('p'), ...Array.from({length:4}, () => Array(8).fill('')), Array(8).fill('P'), ['R','N','B','Q','K','B','N','R']];
  let board = start.map(row => row.slice()), selected = null, turn = 'w', history = [];
  const sessionCode = 'Q7K-29P';
  const $ = id => document.getElementById(id);
  const side = p => p && (p === p.toUpperCase() ? 'w' : 'b');
  const square = (r, c) => String.fromCharCode(97 + c) + (8 - r);
  const bridge = window.Alaisai?.chess || window.alaisai?.chess || window.Android?.chess || null;

  function setStatus(text, connected = false) {
    $('status').textContent = `● ${text}`;
    $('status').classList.toggle('connected', connected);
  }
  function sendBridge(message) {
    try {
      if (bridge?.sendMove && message.type === 'move') return bridge.sendMove(JSON.stringify(message));
      if (bridge?.sendMessage) return bridge.sendMessage(JSON.stringify(message));
      if (window.Android?.postMessage) return window.Android.postMessage(JSON.stringify(message));
      window.parent?.postMessage({ source: 'shatranj-alaisai-pro', ...message }, '*');
    } catch (error) { console.warn('[shatranj] bridge send failed', error); }
  }
  function movesFor(r, c) {
    const p = board[r][c], s = side(p), t = p?.toLowerCase(), out = [];
    if (!p || s !== turn) return out;
    const add = (rr, cc) => { if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false; const q = board[rr][cc]; if (!q) { out.push([rr, cc]); return true; } if (side(q) !== s) out.push([rr, cc]); return false; };
    if (t === 'p') { const d = s === 'w' ? -1 : 1, home = s === 'w' ? 6 : 1; if (r + d >= 0 && r + d < 8 && !board[r + d][c]) { out.push([r + d, c]); if (r === home && !board[r + 2 * d][c]) out.push([r + 2 * d, c]); } for (const dc of [-1, 1]) { const rr = r + d, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] && side(board[rr][cc]) !== s) out.push([rr, cc]); } }
    if (t === 'n') for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
    if (t === 'k') for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
    const dirs = t === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]] : t === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]] : t === 'q' ? [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]] : [];
    for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } }
    return out;
  }
  function render() {
    const root = $('board'); root.innerHTML = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const cell = document.createElement('button'), p = board[r][c]; cell.className = `square ${(r + c) % 2 ? 'dark-square' : 'light-square'} ${selected?.[0] === r && selected?.[1] === c ? 'selected' : ''}`; if (selected && movesFor(...selected).some(x => x[0] === r && x[1] === c)) cell.classList.add('legal'); cell.textContent = p ? files[side(p)][['p','n','b','r','q','k'].indexOf(p.toLowerCase())] : ''; cell.setAttribute('aria-label', square(r, c)); cell.onclick = () => clickSquare(r, c); root.appendChild(cell); }
    $('turn').textContent = turn === 'w' ? 'أنت (الأبيض)' : 'الخصم (الأسود)'; $('moveCount').textContent = `النقلة ${history.length + 1} من ٤٠`; $('moves').innerHTML = history.length ? history.map((m, i) => `<div>${i + 1}. ${m}</div>`).join('') : 'لم تبدأ أي نقلة بعد';
  }
  function applyMove(from, to, remote = false) {
    const sr = 8 - Number(from[1]), sc = from.charCodeAt(0) - 97, r = 8 - Number(to[1]), c = to.charCodeAt(0) - 97;
    if ([sr, sc, r, c].some(Number.isNaN) || !board[sr]?.[sc] || !movesFor(sr, sc).some(x => x[0] === r && x[1] === c)) return false;
    const p = board[sr][sc], captured = board[r][c]; board[r][c] = p; board[sr][sc] = ''; if (p.toLowerCase() === 'p' && (r === 0 || r === 7)) board[r][c] = side(p) === 'w' ? 'Q' : 'q'; history.push(`${from} → ${to}${captured ? ' ×' : ''}`); turn = turn === 'w' ? 'b' : 'w'; selected = null; render(); if (!remote) sendBridge({ type: 'move', session: sessionCode, from, to }); return true;
  }
  function clickSquare(r, c) { if (selected) { if (applyMove(square(...selected), square(r, c))) return; selected = null; render(); return; } if (board[r][c] && side(board[r][c]) === turn) { selected = [r, c]; render(); } }
  function reset() { board = start.map(row => row.slice()); selected = null; turn = 'w'; history = []; render(); setStatus('بانتظار لاعب'); sendBridge({ type: 'reset', session: sessionCode }); }
  function copyText(value) { const input = document.createElement('textarea'); input.value = value; input.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(input); input.select(); try { document.execCommand('copy'); $('copy').textContent = 'تم النسخ'; } catch { $('copy').textContent = 'انسخ الرمز يدوياً'; } input.remove(); setTimeout(() => $('copy').textContent = 'نسخ الرمز', 1800); }
  $('newGame').onclick = reset; $('copy').onclick = () => copyText(sessionCode);
  $('network').onclick = () => { setStatus('اللعب المحلي جاهز', true); copyText(`${location.href.split('#')[0]}#join=${sessionCode}`); alert(`أرسل الرمز ${sessionCode} للاعب الآخر. الاتصال الفعلي بين جهازين يتم عبر جسر Android داخل العيسائي برو.`); };
  $('connect').onclick = async () => { try { if (bridge?.pair) { await bridge.pair(sessionCode); setStatus('تم اقتران الجهازين', true); return; } if (!window.isSecureContext || !navigator.bluetooth) throw new Error('يجب أن يوفر تطبيق العيسائي برو جسر Bluetooth باسم Alaisai.chess.pair'); const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true }); setStatus(`تم اختيار ${device.name || 'جهاز قريب'}`, true); } catch (e) { if (e.name !== 'NotFoundError') alert(`تعذر الاتصال: ${e.message}`); } };
  window.addEventListener('message', event => { const data = typeof event.data === 'string' ? (() => { try { return JSON.parse(event.data); } catch { return {}; } })() : event.data; if (!data || data.source === 'shatranj-alaisai-pro') return; if (data.type === 'move' && data.session === sessionCode) applyMove(data.from, data.to, true); if (data.type === 'reset' && data.session === sessionCode) reset(); if (data.type === 'connected') setStatus('تم اتصال الجهازين', true); });
  window.AlaisaiChessBridge = { receiveMove: data => { const move = typeof data === 'string' ? JSON.parse(data) : data; if (move.session === sessionCode) applyMove(move.from, move.to, true); }, receiveReset: reset };
  render();
})();
