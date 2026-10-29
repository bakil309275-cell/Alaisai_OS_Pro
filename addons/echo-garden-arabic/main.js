(()=>{'use strict';
const levels=[
{name:'أول زهرة',g:['#######','#P....#','#.....#','#..F..#','#.....#','#..X..#','#######']},
{name:'طريق متفرع',g:['#######','#P...F#','#.###.#','#....X#','#######']},
{name:'درس الصدى',g:['########','#P.S.OX#','########']},
{name:'حارس الباب',g:['#########','#P.S.ODX#','#########']},
{name:'زهرة عند الباب',g:['##########','#P.S.OFDX#','##########']},
{name:'زهرتان',g:['########','#P....F#','#..##..#','#F....X#','########']},
{name:'البستان',g:['########','#P.F...#','#..##..#','#F....X#','########']},
{name:'صدى طويل',g:['###########','#P..S..ODX#','###########']},
{name:'رحلة زهور',g:['#########','#P.F....#','#...#...#','#F.....X#','#########']},
{name:'جسر الصدى',g:['###########','#P.S..OFDX#','###########']},
{name:'حول النافورة',g:['#########','#P..F...#','#..###..#','#F.....X#','#########']},
{name:'قلب الحديقة',g:['############','#P.S...OFDX#','############']}];
const dirs={U:[-1,0],D:[1,0],L:[0,-1],R:[0,1],W:[0,0]},key=(r,c)=>r+','+c;
function create(i){const g=levels[i].g;let p;const flowers=[],plates=[];g.forEach((row,r)=>[...row].forEach((v,c)=>{if(v==='P')p=[r,c];if(v==='F')flowers.push(key(r,c));if(v==='S')plates.push(key(r,c))}));return{i,p,start:[...p],flowers,plates,ghosts:[],used:[],history:[],won:false};}
function open(s){return s.plates.every(p=>s.ghosts.some(g=>key(...g.p)===p)||key(...s.p)===p);}
function step(s,a){if(s.won)return false;const g=levels[s.i].g,d=dirs[a],p=[s.p[0]+d[0],s.p[1]+d[1]],v=g[p[0]]?.[p[1]],opened=open(s);if(v===undefined||v==='#'||v==='D'&&!opened||v==='X'&&s.flowers.length)return false;s.p=p;s.history.push(a);for(const ghost of s.ghosts){if(ghost.idx<ghost.script.length){const dd=dirs[ghost.script[ghost.idx++]],q=[ghost.p[0]+dd[0],ghost.p[1]+dd[1]],vv=g[q[0]]?.[q[1]];if(vv&&vv!=='#'&&(vv!=='D'||opened))ghost.p=q;}}
if(v==='S'&&!s.used.includes(key(...p))){s.used.push(key(...p));s.ghosts.push({p:[...s.start],script:[...s.history],idx:0});}
s.flowers=s.flowers.filter(f=>f!==key(...s.p)&&!s.ghosts.some(g=>key(...g.p)===f));s.won=v==='X'&&s.flowers.length===0;return true;}
if(typeof module!=='undefined')module.exports={levels,create,step};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);let s;levels.forEach((l,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+' — '+l.name;$('levels').append(o)});
function draw(){const grid=levels[s.i].g,b=$('board');b.replaceChildren();b.style.gridTemplateColumns='repeat('+grid[0].length+',minmax(0,1fr))';grid.forEach((row,r)=>[...row].forEach((v,c)=>{const e=document.createElement('div'),k=key(r,c);e.className='cell';let t='';if(v==='#')e.classList.add('wall');if(s.flowers.includes(k))t='🌸';if(v==='S'&&!s.used.includes(k))t='🌱';if(v==='O')t='◉';if(v==='D'){t=open(s)?'▯':'▥';e.classList.add('door');if(open(s))e.classList.add('open');}if(v==='X')t='🏁';if(s.ghosts.some(g=>key(...g.p)===k)){t='👻';e.classList.add('ghost');}if(key(...s.p)===k){t='🧑‍🌾';e.classList.add('player');}e.textContent=t;b.append(e);}));$('status').textContent=s.won?'أحسنت! اكتملت الحديقة 🎉':s.flowers.length?'اجمع '+s.flowers.length+' زهرة ثم اتجه إلى العلم':'اتجه إلى العلم 🏁';$('next').hidden=!s.won||s.i===levels.length-1;}
function load(i){s=create(i);$('levels').value=i;$('title').textContent=levels[i].name;draw();}
function move(a){if(step(s,a)){draw();if(s.won)try{localStorage.setItem('echo-garden-last',String(Math.min(s.i+1,levels.length-1)))}catch{}}else if(!s.won)$('status').textContent='الاتجاه مغلق؛ اختر سهماً آخر أو انتظر.';}
document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>move(b.dataset.a));$('levels').onchange=e=>load(+e.target.value);$('reset').onclick=()=>load(s.i);$('next').onclick=()=>load(s.i+1);document.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT')return;const a={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',' ':'W'}[e.key];if(a){e.preventDefault();move(a);}});let i=0;try{i=Number(localStorage.getItem('echo-garden-last'))||0}catch{}load(Math.max(0,Math.min(i,levels.length-1)));
})();