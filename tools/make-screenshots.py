# يولّد لقطات الشاشة لـ manifest ومتاجر التطبيقات من التطبيق الفعلي: python3 tools/make-screenshots.py (خادم على 8765)
# النظام لا يشحن إضافات، فاللقطات تعرض ما يشحنه فعلاً: سطح المكتب والملاحظات ومستكشف الإضافات (مع مجلدات متداخلة).
import json
from playwright.sync_api import sync_playwright
B='http://localhost:8765/index.html'
def seed(page):
    page.goto(B); page.wait_for_selector('.app-card'); page.wait_for_timeout(2200)  # بعد انتهاء شاشة الترحيب
    page.evaluate("""Store.db.notes=[{id:'n1',title:'أفكار المشروع',body:'- تصميم الواجهة\\n- كتابة الإضافات\\n- نشر التطبيق في المتاجر',updated:Date.now()},{id:'n2',title:'قائمة التسوق',body:'خبز، حليب، تمر',updated:Date.now()-3600000}];Store.save()""")
    page.evaluate("UI.applyTheme('dark')"); page.wait_for_timeout(600)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for kind,vp,dsf in (('wide',{'width':1280,'height':720},1),('narrow',{'width':360,'height':640},2)):
        ctx=b.new_context(viewport=vp,device_scale_factor=dsf,is_mobile=(kind=='narrow'),locale='ar'); page=ctx.new_page(); seed(page)
        page.screenshot(path=f'assets/screenshots/{kind}-1-home.png')
        page.get_by_text('الملاحظات').first.click(); page.wait_for_selector('.notes'); page.wait_for_timeout(300); page.screenshot(path=f'assets/screenshots/{kind}-2-notes.png'); page.click('#close-stage')
        page.evaluate("""Addons.put({name:'ألعابي',files:[{name:'manifest.json',content:'{"name":"ألعابي","icon":"🎮","version":"1.0.0"}'},{name:'index.html',content:'<main></main>'},{name:'main.js',content:'//'},{name:'src/bridge/AisaiAdapter.js',content:'//'},{name:'src/ui/board.js',content:'//'}]},'local');
          OS.openSystem('📁 الملفات والإضافات',(el)=>{Explorer.mount(el);Explorer.nav={view:'folder',folder:'ألعابي',dir:'src'};Explorer.render()})""")
        page.wait_for_timeout(500); page.screenshot(path=f'assets/screenshots/{kind}-3-explorer.png')
        ctx.close()
    b.close()
m=json.load(open('manifest.json',encoding='utf8'))
labels={'1-home':'سطح المكتب وتطبيقاتك','2-notes':'ملاحظات متعددة مع بحث وحفظ تلقائي','3-explorer':'إضافاتك بمجلداتها وملفاتها'}
m['screenshots']=[{'src':f'assets/screenshots/{k}-{n}.png','sizes':'1280x720' if k=='wide' else '720x1280','type':'image/png','form_factor':k,'label':l} for k in ('wide','narrow') for n,l in labels.items()]
json.dump(m,open('manifest.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('ok')
