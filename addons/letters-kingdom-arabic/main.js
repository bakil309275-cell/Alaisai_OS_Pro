(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='letters-kingdom-v2';
const initial={coins:120,solved:[],daily:'',dayStreak:0,streak:0,bestStreak:0,sound:true,hints:0,ads:0,achievements:[]};
let D={...initial},storage=true;
try{const v=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('letters-kingdom-v1')||'null');
if(v){if(Number.isFinite(v.coins)&&v.coins>=0)D.coins=Math.floor(v.coins);
if(Array.isArray(v.solved))D.solved=[...new Set(v.solved.filter(n=>Number.isInteger(n)&&n>=0&&n<60))];
if(typeof v.daily==='string')D.daily=v.daily;
if(Number.isFinite(v.dayStreak)&&v.dayStreak>=0)D.dayStreak=Math.floor(v.dayStreak);
if(Number.isFinite(v.streak)&&v.streak>=0)D.streak=Math.floor(v.streak);
if(Number.isFinite(v.bestStreak)&&v.bestStreak>=0)D.bestStreak=Math.floor(v.bestStreak);
if(typeof v.sound==='boolean')D.sound=v.sound;
for(const k of ['hints','ads'])if(Number.isFinite(v[k])&&v[k]>=0)D[k]=Math.floor(v[k]);
if(Array.isArray(v.achievements))D.achievements=[...new Set(v.achievements.filter(a=>typeof a==='string'))];}}catch{storage=false}
const LEVELS=[
{t:'clue',a:'قمر',c:'يضيء الليل',e:'🌙'},{t:'clue',a:'نهر',c:'يجري ولا يشرب',e:'💧'},{t:'clue',a:'باب',c:'تدخل منه البيت',e:'🚪'},{t:'clue',a:'شمس',c:'نجم النهار',e:'☀️'},{t:'clue',a:'كتاب',c:'تقرأ فيه',e:'📖'},{t:'clue',a:'مفتاح',c:'يفتح القفل',e:'🔑'},{t:'clue',a:'سوق',c:'مكان البيع والشراء',e:'🏪'},{t:'clue',a:'جمل',c:'سفينة الصحراء',e:'🐪'},{t:'clue',a:'خبز',c:'طعام أساسي من الحبوب',e:'🍞'},{t:'clue',a:'مطر',c:'ماء ينزل من السماء',e:'🌧️'},
{t:'cat',a:'عسل',c:'فئة: غذاء حلو ينتجه النحل',e:'🍯'},{t:'cat',a:'تمر',c:'فئة: فاكهة النخيل',e:'🌴'},{t:'cat',a:'قهوة',c:'فئة: مشروب عربي شهير',e:'☕'},{t:'cat',a:'زعتر',c:'فئة: عشبة عطرية',e:'🌿'},{t:'cat',a:'لبن',c:'فئة: مشروب من الحليب',e:'🥛'},{t:'cat',a:'رمان',c:'فئة: فاكهة حمراء الحبوب',e:'🍎'},{t:'cat',a:'سمك',c:'فئة: طعام من البحر',e:'🐟'},{t:'cat',a:'خيار',c:'فئة: خضار بارد ومقرمش',e:'🥒'},{t:'cat',a:'زيتون',c:'فئة: ثمرة تُعصر لزيتها',e:'🫒'},{t:'cat',a:'عصير',c:'فئة: مشروب من الفاكهة',e:'🧃'},
{t:'clue',a:'قصر',c:'مسكن الملك',e:'🏰'},{t:'clue',a:'تاج',c:'يرتديه الملك',e:'👑'},{t:'clue',a:'كنز',c:'ذخيرة ثمينة مخبأة',e:'💎'},{t:'clue',a:'خريطة',c:'تدل على الطرق والأماكن',e:'🗺️'},{t:'clue',a:'فانوس',c:'يضيء ويُعلق',e:'🏮'},{t:'clue',a:'جسر',c:'يعبر فوق النهر',e:'🌉'},{t:'clue',a:'برج',c:'بناء عالٍ ومميز',e:'🗼'},{t:'clue',a:'سحاب',c:'يسبق المطر أحياناً',e:'☁️'},{t:'clue',a:'نجمة',c:'تلمع في السماء ليلاً',e:'⭐'},{t:'clue',a:'صحراء',c:'أرض رملية واسعة',e:'🏜️'},
{t:'miss',a:'مكتبة',c:'مكان الكتب والقراءة',blank:2,opts:['ت','ث','ة','ط'],e:'📚'},{t:'miss',a:'مستشفى',c:'مكان العلاج والأطباء',blank:3,opts:['ش','س','ص','ض'],e:'🏥'},{t:'miss',a:'مدرسة',c:'مكان التعليم',blank:4,opts:['ة','ث','ز','س'],e:'🏫'},{t:'miss',a:'مطار',c:'مكان إقلاع الطائرات',blank:2,opts:['ا','ط','ر','ء'],e:'✈️'},{t:'miss',a:'ملعب',c:'مكان الرياضة والمباريات',blank:3,opts:['ب','ع','ت','ك'],e:'⚽'},{t:'miss',a:'مصنع',c:'مكان إنتاج السلع',blank:2,opts:['ن','ص','س','ض'],e:'🏭'},{t:'miss',a:'مقهى',c:'مكان القهوة والجلسات',blank:3,opts:['ى','ه','ة','أ'],e:'☕'},{t:'miss',a:'متحف',c:'مكان الآثار والفنون',blank:3,opts:['ف','ه','ة','ك'],e:'🏛️'},{t:'miss',a:'مسجد',c:'مكان الصلاة',blank:3,opts:['د','ج','س','ز'],e:'🕌'},{t:'miss',a:'ملحقة',c:'ملحق أو إضافة للمبنى',blank:4,opts:['ة','ق','ك','ه'],e:'🏠'},
{t:'cat',a:'صقر',c:'فئة: طائر جارح يُستخدم في الصيد',e:'🦅'},{t:'cat',a:'هدهد',c:'فئة: طائر بعرف مميز',e:'🐦'},{t:'cat',a:'نحل',c:'فئة: حشرة تنتج العسل',e:'🐝'},{t:'cat',a:'فيل',c:'فئة: حيوان ضخم بخرطوم',e:'🐘'},{t:'cat',a:'نمر',c:'فئة: حيوان مفترس مخطط',e:'🐯'},{t:'cat',a:'غزال',c:'فئة: حيوان سريع ورشيق',e:'🦌'},{t:'cat',a:'سلحفاة',c:'فئة: حيوان بطيء بدرع',e:'🐢'},{t:'cat',a:'دلفين',c:'فئة: حيوان بحري ذكي',e:'🐬'},{t:'cat',a:'فراشة',c:'فئة: حشرة بأجنحة ملونة',e:'🦋'},{t:'cat',a:'جرادة',c:'فئة: حشرة تقفز وتأكل النبات',e:'🦗'},
{t:'clue',a:'حكمة',c:'قول موجز فيه عبرة',e:'📜'},{t:'clue',a:'شجاعة',c:'مواجهة الخطر بلا خوف',e:'🦁'},{t:'clue',a:'صبر',c:'تحمل المشقة بهدوء',e:'⏳'},{t:'clue',a:'علم',c:'معرفة ونور يُكتسب بالدراسة',e:'🎓'},{t:'clue',a:'أمل',c:'شعور بانتظار الخير',e:'🌱'},{t:'clue',a:'وفاء',c:'الثبات على العهد والصداقة',e:'🤝'},{t:'clue',a:'كرم',c:'العطاء بلا مقابل',e:'🎁'},{t:'clue',a:'عدل',c:'المساواة والحق',e:'⚖️'},{t:'clue',a:'صدق',c:'قول الحق ومطابقته للواقع',e:'🤍'},{t:'clue',a:'مجد',c:'مكانة عالية وشرف',e:'🏆'}];
const REGIONS=[{name:'واحة البداية',from:0,to:9},{name:'سوق الحروف',from:10,to:19},{name:'قصر النور',from:20,to:29},{name:'غابة الألغاز',from:30,to:39},{name:'جبال الكنز',from:40,to:49},{name:'قمة المملكة',from:50,to:59}];
const ACH=[{id:'first',name:'أول كلمة',desc:'حل أول لغز',test:d=>d.solved.length>=1},{id:'ten',name:'جامع الحروف',desc:'حل 10 ألغاز',test:d=>d.solved.length>=10},{id:'combo5',name:'سلسلة النار',desc:'5 إجابات صحيحة متتالية',test:d=>d.bestStreak>=5},{id:'regions',name:'فاتح المناطق',desc:'أكمل 3 مناطق',test:d=>REGIONS.filter(r=>d.solved.filter(i=>i>=r.from&&i<=r.to).length===10).length>=3},{id:'forty',name:'نصف المملكة',desc:'حل 30 لغزاً',test:d=>d.solved.length>=30},{id:'all',name:'ملك المملكة',desc:'أكمل الـ60 لغزاً',test:d=>d.solved.length>=LEVELS.length}];
let current=0,picked=[],letters=[],adTimer=null;
const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let tt;function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>x.classList.remove('show'),3000)}
function day(){const d=new Date;return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function save(){try{localStorage.setItem(KEY,JSON.stringify(D))}catch{if(storage)toast('تعذر الحفظ الدائم؛ التقدم متاح لهذه الجلسة فقط.');storage=false}render()}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function regionOf(i){return REGIONS.find(r=>i>=r.from&&i<=r.to)}
function checkAchievements(){let newly=[];for(const a of ACH)if(!D.achievements.includes(a.id)&&a.test(D)){D.achievements.push(a.id);newly.push(a)}
if(newly.length){toast('🏅 إنجاز جديد: '+newly.map(a=>a.name).join('، '));if(!reduceMotion&&navigator.vibrate)try{navigator.vibrate([30,50,30])}catch{}}}
let audio;
function sound(freq,dur){if(!D.sound)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+(dur||.1));o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+(dur||.1))}catch{}}
function render(){const lv=LEVELS[current];$$('[data-coins]').forEach(e=>e.textContent=D.coins);
const pct=Math.round(D.solved.length/LEVELS.length*100);$('#progress').textContent=pct+'%';$('#bar').setAttribute('aria-valuenow',String(pct));$('#fill').style.width=pct+'%';
const reg=regionOf(current);$('#region').textContent='المنطقة: '+reg.name;$('#puzzleTitle').textContent=`اللغز ${current+1} من ${LEVELS.length}`;
$('#levelType').textContent=lv.t==='clue'?'وصف وكلمة':lv.t==='cat'?'فئة وكلمة':'حرف ناقص';$('#clue').textContent=lv.c;
$('#streak').textContent=`🔥 سلسلة ${D.streak} · أفضل ${D.bestStreak}`;
const tiles=$('#tiles');tiles.replaceChildren();LEVELS.forEach((l2,i)=>{const t=document.createElement('div');t.className='tile'+(D.solved.includes(i)?' open':'');t.textContent=D.solved.includes(i)?l2.e:'🔒';t.title=D.solved.includes(i)?l2.a:'مقفل';tiles.append(t)});
$('#daily').disabled=D.daily===day();const gift=50+Math.min(50,D.dayStreak*10);$('#daily').textContent=D.daily===day()?'✓ استلمت هدية اليوم':`🎁 هدية اليوم · ${gift} ◈`;$('#giftStat').textContent=D.daily===day()?'تم الاستلام':`هدية ${gift} ◈`;
$('#achStat').textContent=`${D.achievements.length} / ${ACH.length} إنجاز`;
const isMiss=lv.t==='miss';$('#check').hidden=isMiss;$('#clear').hidden=isMiss;$('#hintCoins').disabled=D.coins<30;$('#hintAd').disabled=adTimer!==null;
if(!isMiss)$('#check').disabled=picked.length!==lv.a.length;
$('#status').textContent=isMiss?'اختر الحرف الناقص الصحيح':picked.length?'اكتملت الخانات، اضغط تحقق':'اختر الحروف لتكوين الكلمة'}
function area(){return $('#puzzleArea')}
function loadLevel(i){current=i;picked=[];const lv=LEVELS[i];const a=area();a.replaceChildren();
if(lv.t==='miss'){letters=[];const wrap=document.createElement('div');wrap.className='missing';
[...lv.a].forEach((ch,idx)=>{const s=document.createElement('span');if(idx===lv.blank){s.className='blank';s.textContent='؟';s.setAttribute('aria-label','حرف ناقص')}else s.textContent=ch;wrap.append(s)});
const opts=document.createElement('div');opts.className='options';shuffle(lv.opts).forEach(o=>{const b=document.createElement('button');b.textContent=o;b.setAttribute('aria-label','اختيار الحرف '+o);b.onclick=()=>answerMiss(o);opts.append(b)});
a.append(wrap,opts)}
else{letters=shuffle([...lv.a]).map((ch,idx)=>({ch,id:idx,used:false}));
const slots=document.createElement('div');slots.className='slots';slots.id='slots';slots.setAttribute('aria-label','خانات الكلمة');
for(let k=0;k<lv.a.length;k++){const s=document.createElement('div');s.className='slot';s.dataset.index=String(k);slots.append(s)}
const box=document.createElement('div');box.className='letters';box.id='letters';box.setAttribute('aria-label','الحروف المتاحة');
letters.forEach(l=>{const b=document.createElement('button');b.className='letter';b.textContent=l.ch;b.setAttribute('aria-label','حرف '+l.ch);b.dataset.id=String(l.id);b.onclick=()=>pick(l.id);box.append(b)});
a.append(slots,box)}
render()}
function pick(id){const l=letters.find(l=>l.id===id);if(!l||l.used)return;const lv=LEVELS[current];if(picked.length>=lv.a.length)return;
l.used=true;picked.push(id);const slot=area().querySelector(`.slot[data-index="${picked.length-1}"]`);if(slot){slot.textContent=l.ch;slot.classList.add('filled')}
const btn=area().querySelector(`.letter[data-id="${id}"]`);if(btn)btn.classList.add('used');sound(440,.06);render()}
function unpick(slotIndex){if(slotIndex>=picked.length)return;const lv=LEVELS[current];
for(let k=slotIndex;k<picked.length;k++){const id=picked[k];const l=letters.find(x=>x.id===id);if(l)l.used=false;const b=area().querySelector(`.letter[data-id="${id}"]`);if(b)b.classList.remove('used')}
picked.splice(slotIndex);
for(let k=slotIndex;k<lv.a.length;k++){const s=area().querySelector(`.slot[data-index="${k}"]`);if(s){s.textContent='';s.classList.remove('filled')}}
sound(330,.05);render()}
area().addEventListener('click',e=>{const s=e.target.closest('.slot');if(s&&s.dataset.index!==undefined){const idx=Number(s.dataset.index);if(idx<picked.length)unpick(idx)}});
$('#clear').onclick=()=>{while(picked.length)unpick(picked.length-1)};
$('#check').onclick=()=>{const lv=LEVELS[current];if(picked.length!==lv.a.length)return;const guess=picked.map(id=>letters.find(l=>l.id===id).ch).join('');guess===lv.a?solve():wrong()};
function answerMiss(o){o===LEVELS[current].a[LEVELS[current].blank]?solve():wrong()}
function wrong(){D.streak=0;save();sound(180,.2);$('#status').textContent='إجابة غير صحيحة، انقطعت السلسلة. جرّب مرة أخرى.';toast('حاول مرة أخرى');if(!reduceMotion&&navigator.vibrate)try{navigator.vibrate(60)}catch{}}
function solve(){const lv=LEVELS[current];const first=!D.solved.includes(current);sound(660,.15);
if(first){D.solved.push(current);D.streak++;D.bestStreak=Math.max(D.bestStreak,D.streak);const reward=40+Math.min(60,D.streak*5);D.coins+=reward;
const reg=regionOf(current);if(D.solved.filter(i=>i>=reg.from&&i<=reg.to).length===10){D.coins+=100;toast('أكملت '+reg.name+'! +100 ◈')}else toast(`أحسنت! ${lv.a} · +${reward} ◈`)}
else toast('هذا اللغز مفتوح مسبقاً');
checkAchievements();save();
if(D.solved.length>=LEVELS.length){modal(`<h2 id="modalTitle">🏆 أكملت المملكة!</h2><p>فتحت كل الأجزاء الـ60 وأصبحت ملك المملكة. رصيدك: ${D.coins} ◈.</p><p>أفضل سلسلة: ${D.bestStreak} · إنجازات: ${D.achievements.length}/${ACH.length}</p>`);return}
let next=0;while(next<LEVELS.length&&D.solved.includes(next))next++;loadLevel(next)}
function giveHint(source){const lv=LEVELS[current];
if(lv.t==='miss'){const correct=lv.a[lv.blank];const btns=area().querySelectorAll('.options button');for(const b of btns){if(b.textContent===correct){b.style.outline='3px solid #ffd166';b.style.outlineOffset='2px';break}}
D.hints++;sound(550,.08);toast(source==='ad'?'🎬 تلميح من إعلان: الحرف الصحيح مُظلل':'💡 تلميح: الحرف الصحيح مُظلل');render();return}
const word=lv.a;const missing=[];
for(let i=0;i<word.length;i++){const slot=area().querySelector(`.slot[data-index="${i}"]`);if(!slot||!slot.classList.contains('filled')||slot.textContent!==word[i])missing.push(i)}
if(!missing.length){toast('الكلمة مكتملة بالفعل');return}
const idx=missing[0];while(picked.length>idx)unpick(picked.length-1);
const needed=word[idx];const l=letters.find(l=>!l.used&&l.ch===needed);
if(!l){toast('لا يوجد حرف متاح مطابق؛ أعد الترتيب أولاً');return}
pick(l.id);D.hints++;toast(source==='ad'?'🎬 تلميح من إعلان: كُشف حرف':'💡 تلميح: كُشف حرف');render()}
$('#hintCoins').onclick=()=>{if(D.coins<30){toast('تحتاج 30 ◈ لهذا التلميح');return}D.coins-=30;save();giveHint('coins')};
$('#hintAd').onclick=()=>{modal(`<h2 id="modalTitle">🎬 إعلان مكافأة</h2><div class="adBox"><b>⏳</b><p>هذا إعلان تجريبي داخل النسخة الحالية. عند ربط شبكة إعلانات حقيقية، سيُستبدل بمشاهدة إعلان فعلية ثم تُمنح المكافأة.</p><p>المكافأة: كشف حرف واحد + 10 ◈.</p><button id="startAd" class="primary">ابدأ المشاهدة (5 ثوانٍ)</button></div><p>الإعلان اختياري، ويمكنك استخدام تلميح بالعملات بدلاً منه.</p>`);
$('#startAd').onclick=()=>{if(adTimer)return;let left=5;const btn=$('#startAd');btn.disabled=true;btn.textContent=`⏳ ${left}`;
adTimer=setInterval(()=>{left--;if(left>0){btn.textContent=`⏳ ${left}`;return}clearInterval(adTimer);adTimer=null;D.ads++;D.coins+=10;save();$('#modal').close();giveHint('ad')},1000)}};
$('#daily').onclick=()=>{if(D.daily===day())return;const y=new Date(Date.now()-86400000);const yk=`${y.getFullYear()}-${y.getMonth()+1}-${y.getDate()}`;
D.dayStreak=D.daily===yk?D.dayStreak+1:1;D.daily=day();const gift=50+Math.min(50,(D.dayStreak-1)*10);D.coins+=gift;save();sound(880,.12);toast(`هدية اليوم: +${gift} ◈ · سلسلة ${D.dayStreak} أيام`)};
function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}
$('#mapBtn').onclick=()=>modal(`<h2 id="modalTitle">🗺 خريطة المملكة</h2><ul>${REGIONS.map(r=>`<li>${r.name}: الألغاز ${r.from+1}–${r.to+1} — مفتوح ${D.solved.filter(i=>i>=r.from&&i<=r.to).length} من 10</li>`).join('')}</ul><p>أكمل منطقة كاملة لتحصل على 100 ◈ إضافية.</p>`);
$('#achBtn').onclick=()=>modal(`<h2 id="modalTitle">🏅 الإنجازات</h2><ul>${ACH.map(a=>`<li>${D.achievements.includes(a.id)?'✅':'⬜'} ${a.name} — ${a.desc}</li>`).join('')}</ul><p>أفضل سلسلة: ${D.bestStreak}</p>`);
$$('.settings').forEach(b=>b.onclick=()=>{
modal(`<h2 id="modalTitle">⚙ الإعدادات</h2><label><input id="soundOpt" type="checkbox" ${D.sound?'checked':''}> مؤثرات صوتية</label><p>${storage?'يُحفظ التقدم تلقائياً في هذا المتصفح.':'التخزين غير متاح؛ البيانات مؤقتة لهذه الجلسة.'}</p><p>الإعلانات في هذه النسخة تجريبية ومحاكاة فقط، ولا تُرسل بيانات أو تعرض إعلانات حقيقية.</p><p><button id="resetBtn" style="background:#7a2233;border-color:#a83a4d;color:#fff">🗑 حذف كل التقدم</button></p><p style="font-size:11px;color:#8b7ea8">سيُطلب تأكيد قبل الحذف النهائي.</p>`);
$('#soundOpt').onchange=e=>{D.sound=e.target.checked;save()};
$('#resetBtn').onclick=()=>{if(!confirm('هل أنت متأكد من حذف كل التقدم؟ لا يمكن التراجع.'))return;D={...initial};current=0;try{localStorage.removeItem(KEY)}catch{}save();$('#modal').close();loadLevel(0);toast('تم حذف التقدم')}});
document.addEventListener('keydown',e=>{
if(e.key==='Enter'&&!$('#check').hidden&&!$('#check').disabled&&document.activeElement&&document.activeElement.tagName!=='BUTTON')$('#check').click();
if(e.key==='Backspace'&&picked.length>0&&document.activeElement&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();unpick(picked.length-1)}});
$('#modal').addEventListener('close',()=>{if(adTimer){clearInterval(adTimer);adTimer=null}});
render();let startLevel=0;while(startLevel<LEVELS.length&&D.solved.includes(startLevel))startLevel++;
if(startLevel<LEVELS.length)loadLevel(startLevel);
else{modal(`<h2 id="modalTitle">🏆 أكملت المملكة!</h2><p>فتحت كل الأجزاء الـ60 وأصبحت ملك المملكة. رصيدك: ${D.coins} ◈.</p><p>أفضل سلسلة: ${D.bestStreak} · إنجازات: ${D.achievements.length}/${ACH.length}</p>`)}
})();