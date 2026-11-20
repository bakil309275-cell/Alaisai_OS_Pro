# يولّد لقطات الشاشة لـ manifest ومتاجر التطبيقات من التطبيق الفعلي: python3 tools/make-screenshots.py (خادم على 8765)
# اللقطات من الكتالوج الحالي (إضافات addons/): سطح المكتب بإضافاتك، إضافة مفتوحة، ومستكشف الملفات.
import json
from playwright.sync_api import sync_playwright
B='http://localhost:8765/index.html'
def seed(page):
    page.goto(B); page.wait_for_function('window.Addons && window.OS'); page.wait_for_timeout(2200)
    # تثبيت إضافات الكتالوج الحالية فقط (ما في مجلد addons/) فتطابق اللقطات المتجر فعلاً
    page.evaluate("""async()=>{const idx=await (await fetch('catalog/index.json')).json();
      for(const e of idx.addons){const p=await (await fetch('catalog/'+e.file)).json();const a=Addons.validatePackage(p);Addons.put({name:p.id,files:a.files||p.files},'local');Addons.install(p.id)}
      Store.save();OS.renderDesktop()}""")
    page.evaluate("UI.applyTheme('dark')"); page.wait_for_timeout(700)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for kind,vp,dsf in (('wide',{'width':1280,'height':720},1),('narrow',{'width':360,'height':640},2)):
        ctx=b.new_context(viewport=vp,device_scale_factor=dsf,is_mobile=(kind=='narrow'),locale='ar'); page=ctx.new_page(); seed(page)
        page.screenshot(path=f'assets/screenshots/{kind}-1-home.png')
        page.locator('.app-card',has_text='الطب').first.click(); page.wait_for_timeout(1800)
        fr=[f for f in page.frames if f!=page.main_frame][0]
        fr.evaluate("""()=>{const iso=(n)=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);DB.profile.name='مركز النور الطبي';DB.profile.kind='مركز طبي';
          recs('items').push({id:'i1',name:'باراسيتامول 500',cat:'دواء',qty:'120',min:'30',price:'800',created:Date.now()-3},{id:'i2',name:'جهاز قياس الضغط',cat:'معدات طبية',qty:'8',min:'3',price:'18000',created:Date.now()-2});
          DB.bookings.push({id:'b1',created:Date.now(),payments:[],name:'أحمد سالم',phone:'',what:'كشف عام',date:iso(1),time:'10:00',agreed:'5000',status:'مؤكد',note:''});persist();S.tab='home';render()}""")
        page.wait_for_timeout(600); page.screenshot(path=f'assets/screenshots/{kind}-2-addon.png'); page.click('#close-stage')
        page.evaluate("""Addons.put({name:'ألعابي',files:[{name:'manifest.json',content:'{"name":"ألعابي","icon":"🎮","version":"1.0.0"}'},{name:'index.html',content:'<main></main>'},{name:'main.js',content:'//'},{name:'src/bridge/AisaiAdapter.js',content:'//'},{name:'src/ui/board.js',content:'//'}]},'local');
          OS.openSystem('📁 الملفات والإضافات',(el)=>{Explorer.mount(el);Explorer.nav={view:'folder',folder:'ألعابي',dir:'src'};Explorer.render()})""")
        page.wait_for_timeout(500); page.screenshot(path=f'assets/screenshots/{kind}-3-explorer.png')
        ctx.close()
    b.close()
m=json.load(open('manifest.json',encoding='utf8'))
labels={'1-home':'سطح المكتب وتطبيقاتك','2-addon':'إضافات القطاعات: طب وعقارات وسفر وغيرها','3-explorer':'إضافاتك بمجلداتها وملفاتها'}
m['screenshots']=[{'src':f'assets/screenshots/{k}-{n}.png','sizes':'1280x720' if k=='wide' else '720x1280','type':'image/png','form_factor':k,'label':l} for k in ('wide','narrow') for n,l in labels.items()]
json.dump(m,open('manifest.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('ok')
