(() => {
  const icons = { P:'♙', N:'♘', B:'♗', R:'♖', Q:'♕', K:'♔', p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' };
  const initial = [['r','n','b','q','k','b','n','r'], Array(8).fill('p'), ...Array.from({ length: 4 }, () => Array(8).fill('')), Array(8).fill('P'), ['R','N','B','Q','K','B','N','R']];
  let board = clone(initial), selected = null, turn = 'w', history = [];
  const $ = id => document.getElementById(id);
  const side = piece => piece && (piece === piece.toUpperCase() ? 'w' : 'b');
  const name = piece => ({ p:'بيدق', n:'حصان', b:'فيل', r:'رخ', q:'وزير', k:'ملك' }[piece.toLowerCase()]);
  const square = (r, c) => String.fromCharCode(97 + c) + (8 - r);
  const clone = value => value.map(row => row.slice());
  const bridge = window.Alaisai?.chess || window.alaisai?.chess || window.Android?.chess || null;

  function setStatus(text, connected = false) { $('status').textContent = `● ${text}`; $('status').classList.toggle('connected', connected); }
  function sendBridge(message) { try { if (bridge?.sendMove && message.type === 'move') return bridge.sendMove(JSON.stringify(message)); if (bridge?.sendMessage) return bridge.sendMessage(JSON.stringify(message)); if (window.Android?.postMessage) return window.Android.postMessage(JSON.stringify(message)); window.parent?.postMessage({ source:'shatranj-alaisai-pro', ...message }, '*'); } catch (error) { console.warn('[shatranj] bridge send failed', error); } }
  function ray(r, c, dr, dc, out, own) { for (let rr=r+dr, cc=c+dc; rr>=0 && rr<8 && cc>=0 && cc<8; rr+=dr, cc+=dc) { const piece = board[rr][cc]; if (!piece) out.push([rr,cc]); else { if (side(piece) !== own) out.push([rr,cc]); break; } } }
  function movesFor(r, c) {
    const piece = board[r][c], own = side(piece), type = piece?.toLowerCase(), out = []; if (!piece || own !== turn) return out;
    const add = (rr,cc) => { if (rr<0||rr>7||cc<0||cc>7) return; if (!board[rr][cc] || side(board[rr][cc]) !== own) out.push([rr,cc]); };
    if (type === 'p') { const d=own==='w'?-1:1, home=own==='w'?6:1; if (r+d>=0&&r+d<8&&!board[r+d][c]) { out.push([r+d,c]); if (r===home&&!board[r+2*d][c]) out.push([r+2*d,c]); } for (const dc of [-1,1]) { const rr=r+d,cc=c+dc; if (rr>=0&&rr<8&&cc>=0&&cc<8&&board[rr][cc]&&side(board[rr][cc])!==own) out.push([rr,cc]); } }
    if (type === 'n') [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc));
    if (type === 'k') for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) if (dr||dc) add(r+dr,c+dc);
    if (type === 'b'||type === 'q') [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>ray(r,c,dr,dc,out,own));
    if (type === 'r'||type === 'q') [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>ray(r,c,dr,dc,out,own));
    return out;
  }
  function render() {
    const el=$('board'); el.replaceChildren(); const legal=selected ? movesFor(...selected) : [];
    board.forEach((row,r)=>row.forEach((piece,c)=>{ const cell=document.createElement('button'); cell.type='button'; cell.className=`cell ${(r+c)%2?'dark':'light'}`; cell.setAttribute('role','gridcell'); cell.setAttribute('aria-label', `${square(r,c)}${piece ? ` ${name(piece)}` : ''}`); if (selected?.[0]===r&&selected?.[1]===c) cell.classList.add('selected'); if (legal.some(([rr,cc])=>rr===r&&cc===c)) cell.classList.add(piece?'capture':'legal'); if(piece){ cell.textContent=icons[piece]; cell.classList.add(side(piece)==='w'?'white-piece':'black-piece'); } cell.addEventListener('click',()=>tap(r,c)); el.appendChild(cell); }));
    $('turn').textContent=turn==='w'?'الأبيض':'الأسود'; $('moveCount').textContent=`النقلة ${history.length}`; $('moves').innerHTML=history.length ? history.map((move,index)=>`<span><b>${index+1}.</b> ${move}</span>`).join('') : 'لم تبدأ أي نقلة بعد';
  }
  function tap(r,c) { const piece=board[r][c], legal=selected ? movesFor(...selected) : []; if (selected && legal.some(([rr,cc])=>rr===r&&cc===c)) { move(selected[0],selected[1],r,c); return; } if (piece && side(piece)===turn) { selected=[r,c]; render(); } else { selected=null; render(); } }
  function move(fr,fc,tr,tc) { const piece=board[fr][fc], captured=board[tr][tc]; board[tr][tc]=piece; board[fr][fc]=''; if (piece.toLowerCase()==='p' && (tr===0||tr===7)) board[tr][tc]=side(piece)==='w'?'Q':'q'; history.push(`${square(fr,fc)}–${square(tr,tc)}${captured?' ×':''}`); turn=turn==='w'?'b':'w'; selected=null; render(); sendBridge({type:'move',from:square(fr,fc),to:square(tr,tc),piece,captured:captured||null}); }
  function reset() { board=clone(initial); selected=null; turn='w'; history=[]; setStatus('لعب محلي'); render(); }
  $('newGame').addEventListener('click',reset); $('copy').addEventListener('click',async()=>{ try { await navigator.clipboard.writeText($('sessionCode').textContent); $('copy').textContent='تم النسخ'; setTimeout(()=>$('copy').textContent='نسخ الرمز',1400); } catch { setStatus('انسخ الرمز يدوياً'); } });
  $('connect').addEventListener('click',()=>{ setStatus('جارٍ الاتصال…'); sendBridge({type:'connect',code:$('sessionCode').textContent}); setTimeout(()=>setStatus('جاهز للعب',true),650); });
  $('network').addEventListener('click',()=>{ const code=prompt('أدخل رمز الجلسة:','Q7K-29P'); if(code?.trim()) { $('sessionCode').textContent=code.trim().toUpperCase(); setStatus('تم تحديث الرمز',true); } });
  render();
})();
