(()=>{'use strict';
const GLYPH={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔',p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
const VAL={p:1,n:3,b:3,r:5,q:9,k:0};
const AR={P:'بيدق أبيض',N:'حصان أبيض',B:'فيل أبيض',R:'رخ أبيض',Q:'وزير أبيض',K:'ملك أبيض',p:'بيدق أسود',n:'حصان أسود',b:'فيل أسود',r:'رخ أسود',q:'وزير أسود',k:'ملك أسود'};
const START=[['r','n','b','q','k','b','n','r'],Array(8).fill('p'),Array(8).fill(''),Array(8).fill(''),Array(8).fill(''),Array(8).fill(''),Array(8).fill('P'),['R','N','B','Q','K','B','N','R']];
const inB=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const color=p=>p?(p===p.toUpperCase()?'w':'b'):'';
const sq=(r,c)=>String.fromCharCode(97+c)+(8-r);
const parse=s=>[8-Number(s[1]),s.charCodeAt(0)-97];
function clone(S){return{b:S.b.map(r=>r.slice()),turn:S.turn,cast:{...S.cast},ep:S.ep,half:S.half,full:S.full}}
function initialState(){return{b:START.map(r=>r.slice()),turn:'w',cast:{K:true,Q:true,k:true,q:true},ep:null,half:0,full:1}}
function attacked(b,r,c,by){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+(by==='w'?1:-1)*-1*0+dr,cc=c+dc;if(by==='w'&&dr===1&&Math.abs(dc)===1&&b[rr]?.[cc]==='P')return true;if(by==='b'&&dr===-1&&Math.abs(dc)===1&&b[rr]?.[cc]==='p')return true}
for(const[dr,dc]of[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]){const q=b[r+dr]?.[c+dc];if(q&&(by==='w'?q==='N':q==='n'))return true}
for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const q=b[r+dr]?.[c+dc];if(q&&(by==='w'?q==='K':q==='k'))return true}
const lines=[[-1,0],[1,0],[0,-1],[0,1]],diags=[[-1,-1],[-1,1],[1,-1],[1,1]];
for(const[dr,dc]of lines){let rr=r+dr,cc=c+dc;while(inB(rr,cc)){const q=b[rr][cc];if(q){if(color(q)===by&&(q.toLowerCase()==='r'||q.toLowerCase()==='q'))return true;break}rr+=dr;cc+=dc}}
for(const[dr,dc]of diags){let rr=r+dr,cc=c+dc;while(inB(rr,cc)){const q=b[rr][cc];if(q){if(color(q)===by&&(q.toLowerCase()==='b'||q.toLowerCase()==='q'))return true;break}rr+=dr;cc+=dc}}
return false}
function kingPos(b,color){const k=color==='w'?'K':'k';for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(b[r][c]===k)return[r,c];return null}
function inCheck(S,color){const k=kingPos(S.b,color);return k?attacked(S.b,k[0],k[1],color==='w'?'b':'w'):false}
function pseudo(S,pl){const b=S.b,out=[];
const add=(fr,fc,tr,tc,flags={})=>{if(!inB(tr,tc))return;const t=b[tr][tc];if(t&&color(t)===pl)return;out.push({from:[fr,fc],to:[tr,tc],capture:!!t,...flags})};
for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(!p||color(p)!==pl)continue;const t=p.toLowerCase();
if(t==='p'){const d=pl==='w'?-1:1,home=pl==='w'?6:1,promo=pl==='w'?0:7;
if(inB(r+d,c)&&!b[r+d][c]){add(r,c,r+d,c,{promo:r+d===promo});if(r===home&&!b[r+2*d][c])add(r,c,r+2*d,c,{double:true})}
for(const dc of[-1,1]){const rr=r+d,cc=c+dc;if(!inB(rr,cc))continue;const q=b[rr][cc];
if(q&&color(q)!==pl)add(r,c,rr,cc,{promo:rr===promo});
else if(S.ep&&S.ep[0]===rr&&S.ep[1]===cc)add(r,c,rr,cc,{ep:true})}}
if(t==='n')for(const[dr,dc]of[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]])add(r,c,r+dr,c+dc);
if(t==='k'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc)add(r,c,r+dr,c+dc);
const row=pl==='w'?7:0,right=pl==='w'?'K':'k',left=pl==='w'?'Q':'q';
if(S.cast[right]&&!b[row][5]&&!b[row][6]&&b[row][7]&&b[row][7].toLowerCase()==='r'&&!attacked(b,row,4,pl==='w'?'b':'w')&&!attacked(b,row,5,pl==='w'?'b':'w')&&!attacked(b,row,6,pl==='w'?'b':'w'))out.push({from:[row,4],to:[row,6],castle:'K'});
if(S.cast[left]&&!b[row][3]&&!b[row][2]&&!b[row][1]&&b[row][0]&&b[row][0].toLowerCase()==='r'&&!attacked(b,row,4,pl==='w'?'b':'w')&&!attacked(b,row,3,pl==='w'?'b':'w')&&!attacked(b,row,2,pl==='w'?'b':'w'))out.push({from:[row,4],to:[row,2],castle:'Q'})}
const lines=[[-1,0],[1,0],[0,-1],[0,1]],diags=[[-1,-1],[-1,1],[1,-1],[1,1]];
const dirs=t==='b'?diags:t==='r'?lines:t==='q'?[...diags,...lines]:[];
for(const[dr,dc]of dirs){let rr=r+dr,cc=c+dc;while(inB(rr,cc)){const q=b[rr][cc];if(q){if(color(q)!==pl)add(r,c,rr,cc);break}add(r,c,rr,cc);rr+=dr;cc+=dc}}}
return out}
function makeMove(S,m){const N=clone(S),b=N.b,[fr,fc]=m.from,[tr,tc]=m.to,p=b[fr][fc],color=p===p.toUpperCase()?'w':'b',t=p.toLowerCase();
N.ep=null;
if(m.ep){const capR=color==='w'?tr+1:tr-1;N.b[capR][tc]=''}
b[fr][fc]='';N.b[tr][tc]=m.promo?(color==='w'?'Q':'q'):p;
if(m.castle==='K'){N.b[tr][5]=N.b[tr][7];N.b[tr][7]=''}
if(m.castle==='Q'){N.b[tr][3]=N.b[tr][0];N.b[tr][0]=''}
if(t==='p'&&Math.abs(tr-fr)===2)N.ep=[(fr+tr)/2,fc];
if(t==='k'){if(color==='w'){N.cast.K=false;N.cast.Q=false}else{N.cast.k=false;N.cast.q=false}}
if(t==='r'){if(fr===7&&fc===0)N.cast.Q=false;if(fr===7&&fc===7)N.cast.K=false;if(fr===0&&fc===0)N.cast.q=false;if(fr===0&&fc===7)N.cast.k=false}
if(t==='p'||m.capture)N.half=0;else N.half++;
if(color==='b')N.full++;
N.turn=color==='w'?'b':'w';return N}
function legalMoves(S,color=S.turn){return pseudo(S,color).filter(m=>{const N=makeMove(S,m);return!inCheck(N,color)})}
function san(S,m){const b=S.b,[fr,fc]=m.from,[tr,tc]=m.to,p=b[fr][fc],t=p.toLowerCase();
if(m.castle)return m.castle==='K'?'O-O':'O-O-O';
let s='';if(t!=='p')s+=p.toUpperCase();
if(m.capture){if(t==='p')s+=String.fromCharCode(97+fc);s+='x'}
s+=sq(tr,tc);if(m.promo)s+='=Q';
const N=makeMove(S,m);if(inCheck(N,N.turn))s+=legalMoves(N,N.turn).length?' +':' #';
return s}
function gameStatus(S){const moves=legalMoves(S,S.turn);if(!moves.length)return inCheck(S,S.turn)?{over:true,result:S.turn==='w'?'b':'w',text:'كش مات'}:{over:true,result:'draw',text:'تعادل بالجمود'};
if(S.half>=100)return{over:true,result:'draw',text:'تعادل بقاعدة الخمسين نقلة'};return{over:false,moves}}
function bestMove(S){const moves=legalMoves(S,S.turn);if(!moves.length)return null;let best=null,bestScore=-1e9;
for(const m of moves){const N=makeMove(S,m);let score=0;const cap=S.b[m.to[0]][m.to[1]];if(cap)score+=VAL[cap.toLowerCase()]*10;
if(m.promo)score+=800;if(m.ep)score+=10;
const[tr,tc]=m.to;score+=[3,2,3,4,4,3,2,3][tr]+[3,4,4,5,5,4,4,3][tc]-(S.b[m.from[0]][m.from[1]].toLowerCase()==='k'?20:0);
if(inCheck(N,N.turn))score+=45;if(gameStatus(N).over&&gameStatus(N).result===S.turn)score+=10000;
score+=Math.random()*3;if(score>bestScore){bestScore=score;best=m}}
return best}
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id);let S=initialState(),history=[],selected=null,last=null,mode='local',busy=false;
const files={w:['♙','♘','♗','♖','♕','♔'],b:['♟','♞','♝','♜','♛','♚']};
function setStatus(text,cls){const e=$('status');e.textContent='● '+text;e.className='status'+(cls?' '+cls:'')}
function render(){const root=$('board');root.replaceChildren();const legal=selected?legalMoves(S,S.turn).filter(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]):[];
for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=S.b[r][c];const cell=document.createElement('button');
cell.className=`square ${(r+c)%2?'dark-square':'light-square'}${selected&&selected[0]===r&&selected[1]===c?' selected':''}${legal.some(m=>m.to[0]===r&&m.to[1]===c)?' legal':''}${last&&last.to[0]===r&&last.to[1]===c?' last':''}`;
cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',`${sq(r,c)}${p?' · '+AR[p]:''}${legal.some(m=>m.to[0]===r&&m.to[1]===c)?' · نقلة قانونية':''}`);
const span=document.createElement('span');span.textContent=p?files[color(p)][['p','n','b','r','q','k'].indexOf(p.toLowerCase())]:'';span.setAttribute('aria-hidden','true');cell.append(span);
cell.onclick=()=>clickSquare(r,c);root.append(cell)}
$('turn').textContent=S.turn==='w'?'الأبيض':'الأسود';$('moveCount').textContent=S.full;$('moveCount2').textContent='النقلة '+S.full;
$('moves').replaceChildren(...(history.length?history.map((m,i)=>{const d=document.createElement('div');d.textContent=`${i+1}. ${m}`;return d}):[document.createTextNode('لم تبدأ أي نقلة بعد')]));
const capW=[],capB=[];history.forEach(m=>{if(m.includes('x')){}});
$('capW').textContent='أسرى: '+countCaptured('w');$('capB').textContent='أسرى: '+countCaptured('b');
$('pW').classList.toggle('active',S.turn==='w');$('pB').classList.toggle('active',S.turn==='b');
$('undo').disabled=!history.length||busy}
function countCaptured(color){const start=START.flat(),now=S.b.flat();const count=t=>start.filter(x=>x===t).length-now.filter(x=>x===t).length;const out=[];
for(const t of(color==='w'?['p','n','b','r','q']:['P','N','B','R','Q'])){const n=count(t);for(let i=0;i<n;i++)out.push(GLYPH[t])}
return out.length?out.join(' '):'—'}
function clickSquare(r,c){if(busy)return;const st=gameStatus(S);if(st.over)return;
if(selected){const m=legalMoves(S,S.turn).find(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]&&m.to[0]===r&&m.to[1]===c);
if(m){doMove(m);return}selected=null;render();return}
const p=S.b[r][c];if(p&&color(p)===S.turn){selected=[r,c];render();$('hint').textContent='اختر مربعاً مضيئاً للنقل، أو اضغط القطعة مجدداً للإلغاء'}else{$('hint').textContent='اختر قطعة من لون الدور الحالي'}}
function doMove(m){const notation=san(S,m);last=m;S=makeMove(S,m);history.push(notation);selected=null;render();sound(320);
const st=gameStatus(S);
if(st.over){setStatus(st.text+(st.result==='draw'?'':' · فاز '+(st.result==='w'?'الأبيض':'الأسود')),st.result==='draw'?'good':'alert');modal(`<h2 id="modalTitle">${st.result==='draw'?'🤝 تعادل':'🏆 نهاية المباراة'}</h2><p>${st.text}${st.result==='draw'?'':' · الفائز: '+(st.result==='w'?'الأبيض':'الأسود')}</p><p>عدد النقلات: ${S.full-1}</p>`);return}
setStatus(inCheck(S,S.turn)?'كش ملك على '+(S.turn==='w'?'الأبيض':'الأسود'):'دور '+(S.turn==='w'?'الأبيض':'الأسود'),inCheck(S,S.turn)?'alert':'');
if(mode==='ai'&&S.turn==='b'){busy=true;$('hint').textContent='الكمبيوتر يفكر…';setTimeout(()=>{const m=bestMove(S);busy=false;if(m)doMove(m)},450)}}
function reset(){S=initialState();history=[];selected=null;last=null;busy=false;render();setStatus('دور الأبيض');closeModal()}
function undo(){if(!history.length||busy)return;let times=(mode==='ai'&&S.turn==='w'&&history.length>=2)?2:1;for(let i=0;i<times;i++){if(!history.length)break;history.pop();S=undoState()}
selected=null;last=null;render();setStatus('دور '+(S.turn==='w'?'الأبيض':'الأسود'));closeModal()}
let past=[];const origMake=makeMove;function undoState(){return past.pop()||initialState()}
const origDo=doMove;doMove=function(m){past.push(clone(S));origDo(m)};
function sound(f){if(!D_sound())return;try{audio ||= new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.03,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.07);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.08)}catch{}}
let audio,D_soundOn=true;function D_sound(){return D_soundOn}
function closeModal(){const d=$('modal');if(d.open)d.close()}
function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}
$('newGame').onclick=()=>{if(history.length&&!confirm('بدء لعبة جديدة وإلغاء المباراة الحالية؟'))return;past=[];reset()};
$('undo').onclick=undo;
$('mode').onchange=e=>{mode=e.target.value;past=[];reset();toast(mode==='ai'?'وضع الكمبيوتر: تلعب بالأبيض':'وضع اللاعبين المحليين')};
$('copyPgn').onclick=async()=>{const text=history.join(' ');try{await navigator.clipboard.writeText(text);toast('تم نسخ سجل النقلات')}catch{modal('<h2 id="modalTitle">سجل النقلات</h2><p>انسخه يدوياً:</p><textarea readonly style="width:100%;min-height:100px">'+text+'</textarea>')}};
let toastTimer;function toast(t){const x=document.createElement('div');x.textContent=t;x.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#20231f;color:#f2d7a9;padding:10px 18px;border-radius:12px;z-index:50';document.body.append(x);setTimeout(()=>x.remove(),2500)}
window.addEventListener('message',e=>{try{const d=typeof e.data==='string'?JSON.parse(e.data):e.data;if(d&&d.type==='move'&&d.from&&d.to){const m=legalMoves(S,S.turn).find(m=>sq(...m.from)===d.from&&sq(...m.to)===d.to);if(m)doMove(m)}}catch{}});
window.MurabbaBridge={receiveMove:d=>{try{const m=typeof d==='string'?JSON.parse(d):d;const mv=legalMoves(S,S.turn).find(x=>sq(...x.from)===m.from&&sq(...x.to)===m.to);if(mv)doMove(mv)}catch{}},getState:()=>({fenLike:history.join(' '),turn:S.turn})};
render();setStatus('دور الأبيض');
}
else if(typeof module!=='undefined'&&module.exports){module.exports={initialState,legalMoves,makeMove,inCheck,gameStatus,bestMove,san,attacked,clone}}
})();