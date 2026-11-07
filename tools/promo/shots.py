# لقطات تسويقية من التطبيق الحقيقي ببيانات تجريبية: python3 tools/promo/shots.py (خادم على 8765)
import json,time,os,sys
from playwright.sync_api import sync_playwright
R=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.abspath(R+'/../../promo/img'); BASE='http://localhost:8765/index.html'
now=int(time.time()*1000)
chan={'format':'alaisai-channel','version':1,'seq':1,'updated':now,'contact':{'whatsapp':'967700000000','telegram':'','email':'','facebook':'','note':''},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[
 {'id':'n1','kind':'ann','title':'وصل إصدار جديد من العيسائي برو','body':'أقسام هرمية لتنظيم تطبيقاتك، ومساحات تخزين تربط جوالك بدرايف وغيره، وإضافات جاهزة للأطباء والمحامين والعقارات.','link':'','aud':'all','level':'info','created':now,'expires':0,'pin':True},
 {'id':'n2','kind':'post','title':'عرض خاص لمكاتب السفر','body':'إضافة «السفر والرحلات» لإدارة الباقات والحجوزات والدفعات مجاناً لأول 100 مشترك.','link':'','aud':'all','level':'warn','created':now-86400000,'expires':0,'pin':False}]}
SEC=[{'id':'s1','name':'عملي','c':[{'id':'s11','name':'مكاتب','c':[]},{'id':'s12','name':'تجارة','c':[]}]},{'id':'s2','name':'قطاعات','c':[]},{'id':'s3','name':'شخصي','c':[]}]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block'); ctx.route('**/control/channel.json*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps(chan)))
    pg=ctx.new_page(); pg.goto(BASE); pg.wait_for_selector('.app-card'); pg.wait_for_timeout(800)
    pg.evaluate("""async(S)=>{const idx=await (await fetch('catalog/index.json')).json();
      for(const e of idx.addons){const p=await (await fetch('catalog/'+e.file)).json();const a=Addons.validatePackage(p);Addons.put({name:p.id,files:a.files||p.files},'local');Addons.install(p.id)}
      Store.db.sections=S;const reg=Store.db.registry;reg.forEach(a=>{if(a.type==='addon'){const n=a.content;a.sec=['الطب والأدوية','السفر والرحلات','الزراعة','العقارات','المنقولات والسلع الثمينة'].includes(n)?'s2':(n==='مكتب المحامي'?'s11':'s3')}});
      Store.save();OS.renderDesktop()}""",SEC)
    pg.wait_for_timeout(600); pg.screenshot(path=OUT+'/shot_home.png')
    pg.locator('#news-btn').click(); pg.wait_for_selector('.ctl-card'); pg.wait_for_timeout(500); pg.locator('.rx[data-k=like]').first.click(); pg.locator('.rx[data-k=love]').first.click(); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'/shot_news.png'); pg.locator('#close-stage').click()
    pg.locator('#hub-btn').click(); pg.wait_for_selector('.hub-src'); pg.evaluate("async()=>{await Cloud.addSource({type:'gdrive',name:'Google Drive',clientId:'x.apps.googleusercontent.com'});await Cloud.addSource({type:'webdav',name:'سحابة المكتب',url:'https://cloud.example.com/dav',user:'u'},{pass:'x'});await Cloud.addSource({type:'link',name:'روابط العقود',links:[]});}"); pg.evaluate("OS.closeStage();Cloud.open()"); pg.wait_for_selector('.hub-src'); pg.wait_for_timeout(1200); pg.screenshot(path=OUT+'/shot_hub.png'); pg.locator('#close-stage').click()
    # إضافة الطب ببيانات تجريبية
    pg.locator('.app-card',has_text='الطب').first.click(); pg.wait_for_timeout(1800); fr=pg.frame_locator('iframe').first; frame=[f for f in pg.frames if f!=pg.main_frame][0]
    frame.evaluate("""()=>{const d=new Date();const iso=(n)=>new Date(d.getTime()+n*864e5).toISOString().slice(0,10);
      DB.profile.name='مركز النور الطبي';DB.profile.kind='مركز طبي';DB.profile.bio='رعاية صحية بمعايير حديثة.';DB.profile.phones=[{v:'+967 700 000 000',t:'واتساب'}];DB.profile.gov='عدن';
      const it=recs('items');it.push({id:'i1',name:'باراسيتامول 500',cat:'دواء',pack:'علبة 20 قرص',qty:'120',min:'30',price:'800',created:Date.now()-3},{id:'i2',name:'جهاز قياس الضغط',cat:'معدات طبية',qty:'8',min:'3',price:'18000',created:Date.now()-2},{id:'i3',name:'أموكسيسيلين',cat:'دواء',qty:'12',min:'20',expiry:iso(20),price:'2500',created:Date.now()-1});
      DB.opts['items.cat']=[{n:'دواء',c:['مضادات حيوية',{n:'مسكنات',c:['أقراص','شراب']}]},'معدات طبية','مستلزمات'];
      const sv=recs('services');sv.push({id:'s1',name:'كشف عام',price:'5000',dur:'30 دقيقة',created:Date.now()});
      DB.bookings.push({id:'b1',created:Date.now(),payments:[{id:'p1',amt:'2000',date:iso(0)}],name:'أحمد سالم',phone:'',what:'كشف عام',date:iso(1),time:'10:00',agreed:'5000',status:'مؤكد',note:''});
      persist();render()}""")
    pg.wait_for_timeout(700); frame.evaluate("S.tab='home';render()"); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'/shot_med.png')
    frame.evaluate("S.tab='cat';S.list='items';S.filter='دواء';render()"); pg.wait_for_timeout(400); pg.screenshot(path=OUT+'/shot_med_tree.png')
    b.close()
print('ok',sorted(os.listdir(OUT)))
