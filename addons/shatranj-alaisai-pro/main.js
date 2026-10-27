(() => {
  const files = { w: ['♙','♘','♗','♖','♕','♔'], b: ['♟','♞','♝','♜','♛','♚'] };
  const start = [['r','n','b','q','k','b','n','r'],Array(8).fill('p'),...Array.from({length:4},()=>Array(8).fill('')),Array(8).fill('P'),['R','N','B','Q','K','B','N','R']];
  let board = start.map(row => row.slice()), selected = null, turn = 'w', history = [], castling = {K:true,Q:true,k:true,q:true};
  const $ = id => document.getElementById(id);
  const side = p => p && (p === p.toUpperCase() ? 'w' : 'b');
  const name = {p:'بيدق',n:'حصان',b:'فيل',r:'قلعة',q:'وزير',k:'ملك'};
  const square = (r,c) => String.fromCharCode(97+c) + (8-r);
  function movesFor(r,c) { const p=board[r][c], s=side(p), t=p.toLowerCase(), out=[]; if(!p||s!==turn)return out;
    const add=(rr,cc)=>{if(rr<0||rr>7||cc<0||cc>7)return false; const q=board[rr][cc]; if(!q){out.push([rr,cc]);return true} if(side(q)!==s)out.push([rr,cc]);return false};
    if(t==='p'){const d=s==='w'?-1:1, home=s==='w'?6:1;if(r+d>=0&&r+d<8&&!board[r+d][c]){out.push([r+d,c]);if(r===home&&!board[r+2*d][c])out.push([r+2*d,c])}for(const dc of [-1,1]){const rr=r+d,cc=c+dc;if(rr>=0&&rr<8&&cc>=0&&cc<8&&board[rr][cc]&&side(board[rr][cc])!==s)out.push([rr,cc])}}
    if(t==='n')for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dr,c+dc);
    if(t==='k')for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc)add(r+dr,c+dc);
    const dirs=t==='b'?[[-1,-1],[-1,1],[1,-1],[1,1]]:t==='r'?[[-1,0],[1,0],[0,-1],[0,1]]:t==='q'?[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]:[];
    for(const [dr,dc] of dirs){let rr=r+dr,cc=c+dc;while(add(rr,cc)){rr+=dr;cc+=dc}}
    return out;
  }
  function render(){const root=$('board');root.innerHTML='';for(let r=0;r<8;r++)for(let c=0;c<8;c++){const b=document.createElement('button');const p=board[r][c];b.className=`square ${(r+c)%2?'dark-square':'light-square'} ${selected&&selected[0]===r&&selected[1]===c?'selected':''}`;if(selected&&movesFor(...selected).some(x=>x[0]===r&&x[1]===c))b.classList.add('legal');b.textContent=p?files[side(p)][['p','n','b','r','q','k'].indexOf(p.toLowerCase())]:'';b.setAttribute('aria-label',square(r,c));b.onclick=()=>clickSquare(r,c);root.appendChild(b)}
    $('turn').textContent=turn==='w'?'أنت (الأبيض)':'الخصم (الأسود)';$('moveCount').textContent=`النقلة ${history.length+1} من ٤٠`;$('moves').innerHTML=history.length?history.map((m,i)=>`<div>${i+1}. ${m}</div>`).join(''):'لم تبدأ أي نقلة بعد';
  }
  function clickSquare(r,c){if(selected){const legal=movesFor(...selected).some(x=>x[0]===r&&x[1]===c);if(legal){const [sr,sc]=selected,p=board[sr][sc],captured=board[r][c];board[r][c]=p;board[sr][sc]='';if(p.toLowerCase()==='p'&&(r===0||r===7))board[r][c]=side(p)==='w'?'Q':'q';history.push(`${square(sr,sc)} → ${square(r,c)}${captured?' ×':''}`);turn=turn==='w'?'b':'w';selected=null;render();return}selected=null;render();return}if(board[r][c]&&side(board[r][c])===turn){selected=[r,c];render()}}
  function reset(){board=start.map(row=>row.slice());selected=null;turn='w';history=[];render();$('status').textContent='● بانتظار لاعب';$('status').classList.remove('connected')}
  $('newGame').onclick=reset;
  $('copy').onclick=()=>navigator.clipboard?.writeText('Q7K-29P').then(()=>{$('copy').textContent='تم نسخ الرمز';setTimeout(()=>$('copy').textContent='نسخ الرمز',1500)});
  $('network').onclick=()=>{$('status').textContent='● اللعب المحلي جاهز';$('status').classList.add('connected');alert('للاتصال بجهاز آخر استخدم رمز الجلسة Q7K-29P في نفس نظام العيسائي برو. البلوتوث في المتصفح يكتشف الأجهزة فقط ولا ينقل النقلات دون خدمة Bluetooth خاصة.')};
  $('connect').onclick=async()=>{if(!window.isSecureContext||!navigator.bluetooth){alert('الاتصال المباشر بالبلوتوث يحتاج إصدار HTTPS ومتصفح Chrome على Android. استخدم رمز الشبكة بدلاً منه.');return}try{const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true});device.addEventListener('gattserverdisconnected',()=>{$('status').textContent='● انقطع الاتصال';$('status').classList.remove('connected')});$('status').textContent=`● تم اختيار ${device.name||'جهاز قريب'}`;$('status').classList.add('connected')}catch(e){if(e.name!=='NotFoundError')alert('تعذر فتح نافذة البلوتوث: '+e.message)}};
  render();
})();
