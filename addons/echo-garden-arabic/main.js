(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='echo-garden-v1';
const initial={coins:120,solved:[],daily:'',dayStreak:0,sound:true,hints:0,ads:0};
let D={...initial},storage=true;
try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v){if(Number.isFinite(v.coins)&&v.coins>=0)D.coins=Math.floor(v.coins);if(Array.isArray(v.solved))D.solved=v.solved.filter(n=>Number.isInteger(n)&&n>=0&&n<LEVELS.length);if(typeof v.daily==='string')D.daily=v.daily;if(Number.isFinite(v.dayStreak)&&v.dayStreak>=0)D.dayStreak=Math.floor(v.dayStreak);if(typeof v.sound==='boolean')D.sound=v.sound;for(const k of ['hints','ads'])if(Number.isFinite(v[k])&&v[k]>=0)D[k]=Math.floor(v[k]);}}catch{storage=false}
const LEVELS=[
{name:'أول زهرة',grid:['#######','#P....#','#.....#','#..F..#','#.....#','#..X..#','#######']},
{name:'طريق متفرع',grid:['#######','#P...F#','#.###.#','#....X#','#######']},
{name:'بذرة الصدى',grid:['#####','#P..#','#.O.#','#S.D#','#..X#','#####']},
{name:'زهرة خلف الباب',grid:['#######','#P....#','#.ODF.#','#.S...#','#....X#','#######']},
{name:'الشبح يجمع',grid:['#######','#P..F.#','#.O...#','#.S.D.#','#....X#','#######']},
{name:'باب الزهرة',grid:['########','#P.....#','#.O.DF.#','#.S....#','#......#','#.....X#','########']},
{name:'بابان وبذرة',grid:['########','#P.....#','#.O....#','#.S.D.F#','#....D.#','#.....X#','########']},
{name:'حديقة النافورة',grid:['#########','#P......#','#..F....#','#.......#','#..###..#','#..#X#..#','#..F....#','#.......#','#########']},
{name:'الشبح والبابين',grid:['########','#P.....#','#.O.F..#','#.S....#','#..D.F.#','#....X.#','########']},
{name:'صدىان لباب واحد',grid:['#########','#P......#','#.O...O.#','#.S...S.#','#...D...#','#...X...#','#########']},
{name:'حديقة الأضواء',grid:['#########','#P......#','#.O.F...#','#.S.....#','#...D.F.#','#.......#','#..F...X#','#########']},
{name:'قلب المملكة',grid:['#########','#P......#','#.O...O.#','#.S.F.S.#','#...D...#','#.F.....#','#...X...#','#########']}];
const DIRS={U:[-1,0],D:[1,0],L:[0,-1],R:[0,1],W:[0,0]};
let current=0,st=null,adTimer=null;
let tt;function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>x.classList.remove('show'),3000)}
function day(){const d=new Date;return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function save(){try{localStorage.setItem(KEY,JSON.stringify(D))}catch{toast('تعذر الحفظ الدائم؛ التقدم متاح لهذه الجلسة فقط.')}render()}
function parseLevel(g){const walls=new Set,flowers=new Set,seeds=new Set,plates=new Set,doors=new Set,exits=new Set;let start=null;
g.forEach((row,r)=>[...row].forEach((ch,c)=>{const k=r+','+c;
if(ch==='#')walls.add(k);else if(ch==='P')start={r,c};else if(ch==='F')flowers.add(k);else if(ch==='S')seeds.add(k);else if(ch==='O')plates.add(k);else if(ch==='D')doors.add(k);else if(ch==='X')exits.add(k)}));
return{grid:g,walls,flowers,seeds,plates,doors,exits,start}}
function doorsOpen(s){return s.L.plates.every(p=>s.ghosts.some(g=>g.r===p.r&&g.c===p.c))}
function createState(i){const L=parseLevel(LEVELS[i].grid);return{i,L,player:{...L.start},turn:0,flowers:new Set(L.flowers),ghosts:[],created:new Set(),history:[]}}
function step(s,a){const[dr,dc]=DIRS[a];const nr=s.player.r+dr,nc=s.player.c+dc;const cell=s.L.grid[nr]?.[nc];let blocked=false;
if(cell===undefined||cell==='#')blocked=true;
else if(cell==='D'&&!doorsOpen(s))blocked=true;
else if(cell==='X'&&s.flowers.size)blocked=true;
if(blocked)return{blocked:true};
s.player={r:nr,c:nc};s.history.push(a);s.turn++;
if(cell==='S'&&!s.created.has(nr+','+nc)){s.created.add(nr+','+nc);s.ghosts.push({r:s.L.start.r,c:s.L.start.c,idx:0})}
for(const g of s.ghosts){const d=DIRS[s.history[g.idx%s.history.length]];const gr=g.r+d[0],gc=g.c+d[1];const c2=s.L.grid[gr]?.[gc];
if(c2===undefined||c2==='#'||(c2==='D'&&!doorsOpen(s))){g.idx++}else{g.r=gr;g.c=gc;g.idx++}}
for(const f of[...s.flowers]){if((s.player.r===+f.split(',')[0]&&s.player.c===+f.split(',')[1])||s.ghosts.some(g=>g.r===+f.split(',')[0]&&g.c===+f.split(',')[1]))s.flowers.delete(f)}
const onExit=s.L.grid[s.player.r][s.player.c]==='X';
const win=onExit&&s.flowers.size===0;
return{blocked:false,win}}
function render(){const lv=LEVELS[current];if(!st)return;$$('[data-coins]').forEach(e=>e.textContent=D.coins);
$('#region').textContent='الحديقة '+(current+1);$('#gardenTitle').textContent=lv.name;$('#levelBadge').textContent=(current+1)+' / '+LEVELS.length;
$('#status').textContent=st.flowers.size?`اجمع ${st.flowers.size} زهرة ثم اتجه إلى المخرج`:'اتجه إلى المخرج 🏁';
const tiles=$('#tiles');tiles.replaceChildren();LEVELS.forEach((l,i)=>{const t=document.createElement('div');t.className='tile'+(D.solved.includes(i)?' open':'');t.textContent=D.solved.includes(i)?'✿':'🔒';tiles.append(t)});
$('#daily').disabled=D.daily===day();const gift=50+Math.min(50,D.dayStreak*10);$('#daily').textContent=D.daily===day()?'✓ استلمت هدية اليوم':`🎁 هدية اليوم · ${gift} ◈`;$('#giftStat').textContent=D.daily===day()?'تم الاستلام':`هدية ${gift} ◈`;
$('#adStat').textContent=`إعلانات: ${D.ads}`;$('#hintCoins').disabled=D.coins<30;$('#hintAd').disabled=adTimer!==null;
$('#mapBtn').textContent='🗺';}
function drawBoard(){const b=$('#board');b.replaceChildren();b.style.gridTemplateColumns=`repeat(${st.L.grid[0].length},1fr)`;
st.L.grid.forEach((row,r)=>[...row].forEach((ch,c)=>{const d=document.createElement('div');d.className='cell';
let content='';let isPlayer=st.player.r===r&&st.player.c===c;let isGhost=st.ghosts.some(g=>g.r===r&&g.c===c);
if(ch==='#')d.classList.add('wall');
if(ch==='F'&&st.flowers.has(r+','+c)){d.classList.add('flower');ch='🌸'}
if(ch==='S'&&st.created.has(r+','+c)===false&&st.L.seeds.has(r+','+c)===false){} 
if(st.L.seeds.has(r+','+c)&&![...st.created].some(k=>k===r+','+c)){d.classList.add('seed');ch='✨'}
if(ch==='O')d.classList.add('plate'),ch='🟡';
if(ch==='D'){d.classList.add('door');ch=doorsOpen(st)?'🚪':'🚪';if(doorsOpen(st))d.classList.add('open')}
if(ch==='X'){d.classList.add('exit');ch='🏁'}
if(isPlayer)ch='🧑‍🌾',d.classList.add('player');
if(isGhost&&!isPlayer)ch='👻',d.classList.add('ghost');
d.textContent=ch;b.append(d)}))}
function loadLevel(i){current=i;st=createState(i);$('#region').textContent='الحديقة '+(i+1);$('#gardenTitle').textContent=LEVELS[i].name;$('#levelBadge').textContent=(i+1)+' / '+LEVELS.length;drawBoard();render()}
function move(a){if(!st||st.won)return;const r=step(st,a);if(r.blocked){toast(a==='W'?'لا داعي للانتظار هنا':'هذا الاتجاه مغلق');return}sound(r.win?700:380);drawBoard();render();
if(r.win){const first=!D.solved.includes(current);if(first){D.solved.push(current);D.coins+=40;toast('أحسنت! حديقة مكتملة · +40 ◈')}else toast('أعدت حل الحديقة');save();
if(D.solved.length>=LEVELS.length){modal(`<h2 id="modalTitle">🏆 أكملت الحديقة!</h2><p>حللت كل الـ12 حديقة. رصيدك: ${D.coins} ◈.</p>`);return}
let next=0;while(next<LEVELS.length&&D.solved.includes(next))next++;loadLevel(next)}else if(st.flowers.size===0){$('#status').textContent='كل الزهور جمعت! اتجه إلى المخرج 🏁'}}
if(typeof document!=='undefined'){
$('#app').addEventListener('click',e=>{const b=e.target.closest('[data-move]');if(b)move(b.dataset.move)});
function move(a){if(!st||st.won)return;const r=step(st,a);if(r.blocked){toast(a==='W'?'انتظار بلا فائدة هنا':'الاتجاه مغلق');return}sound(r.win?700:380);drawBoard();render();
if(r.win){const first=!D.solved.includes(current);if(first){D.solved.push(current);D.coins+=40;toast('أحسنت! +40 ◈')}save();
if(D.solved.length>=LEVELS.length){modal('<h2 id="modalTitle">🏆 أكملت الحديقة!</h2><p>فتحت كل الحدائق الـ12.</p>');return}
let next=0;while(next<LEVELS.length&&D.solved.includes(next))next++;loadLevel(next)}}
document.addEventListener('keydown',e=>{const map={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',w:'U',s:'D',a:'L',d:'R',' ':'W'};if(map[e.key]){e.preventDefault();move(map[e.key])}});
function giveHint(){if(!st||st.won)return;let target=null,best=1e9;
for(const f of st.flowers){const[r,c]=f.split(',').map(Number);const d=Math.abs(r-st.player.r)+Math.abs(c-st.player.c);if(d<best){best=d;target={r,c}}}
if(!target)target=[...st.L.exits][0];
const dr=target.r-st.player.r,dc=target.c-st.player.c;
const dir=Math.abs(dr)>Math.abs(dc)?(dr>0?'أسفل':'أعلى'):(dc>0?'يميناً':'يساراً');
toast('💡 تلميح: تحرك '+dir)}
$('#hintCoins').onclick=()=>{if(D.coins<30){toast('تحتاج 30 ◈');return}D.coins-=30;save();giveHint()};
$('#hintAd').onclick=()=>{modal(`<h2 id="modalTitle">🎬 إعلان مكافأة</h2><div class="adBox"><b>⏳</b><p>إعلان تجريبي داخل النسخة الحالية. عند ربط شبكة إعلانات حقيقية سيُستبدل بإعلان فعلي.</p><p>المكافأة: تلميح اتجاه + 10 ◈.</p><button id="startAd" class="primary">ابدأ المشاهدة (5 ثوانٍ)</button></div>`);$('#startAd').onclick=()=>{if(adTimer)return;let left=5;const btn=$('#startAd');btn.disabled=true;btn.textContent=`⏳ ${left}`;adTimer=setInterval(()=>{left--;if(left>0){btn.textContent=`⏳ ${left}`;return}clearInterval(adTimer);adTimer=null;D.ads++;D.coins+=10;save();$('#modal').close();giveHint()},1000)}};
$('#daily').onclick=()=>{if(D.daily===day())return;const y=new Date(Date.now()-86400000);const yk=`${y.getFullYear()}-${y.getMonth()+1}-${y.getDate()}`;D.dayStreak=D.daily===yk?D.dayStreak+1:1;D.daily=day();const gift=50+Math.min(50,(D.dayStreak-1)*10);D.coins+=gift;save();toast(`هدية اليوم: +${gift} ◈`)};
function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}
$('#mapBtn').onclick=()=>modal(`<h2 id="modalTitle">🗺 حدائق المملكة</h2><ul>${LEVELS.map((l,i)=>`<li>${i+1}. ${l.name} — ${D.solved.includes(i)?'✅ مكتملة':'🔒 مقفلة'}</li>`).join('')}</ul>`);
$$('.gift').forEach(b=>b.onclick=()=>{if(D.daily===day()){toast('استلمت هدية اليوم');return}D.daily=day();D.coins+=50;save();toast('هدية اليوم: +50 ◈')});
$$('.settings').forEach(b=>b.onclick=()=>{modal(`<h2 id="modalTitle">⚙ الإعدادات</h2><label><input id="soundOpt" type="checkbox" ${D.sound?'checked':''}> مؤثرات صوتية</label><p>الإعلانات تجريبية ومحاكاة فقط. لا يوجد خيار حذف التقدم.</p>`);$('#soundOpt').onchange=e=>{D.sound=e.target.checked;save()}});
let audio;function sound(f){if(!D.sound)return;try{audio ||= new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.03,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.08)}catch{}}
$('#restart').onclick=()=>{if(st.won)return;st=createState(current);drawBoard();render();toast('أعيدت الحديقة')};
$('#modal').addEventListener('close',()=>{if(adTimer){clearInterval(adTimer);adTimer=null}});
render();let startLevel=0;while(startLevel<LEVELS.length&&D.solved.includes(startLevel))startLevel++;loadLevel(startLevel);
}
else if(typeof module!=='undefined'&&module.exports){module.exports={LEVELS,createState,step};}
})();