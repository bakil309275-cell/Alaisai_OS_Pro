# يولّد لقطات الشاشة لـ manifest ومتاجر التطبيقات من التطبيق الفعلي: python3 tools/make-screenshots.py (خادم على 8765)
import json
from playwright.sync_api import sync_playwright
B='http://localhost:8765/index.html'
def seed(page):
    page.goto(B); page.wait_for_selector('.app-card'); page.wait_for_timeout(500)
    for aid in ('calculator','todo','timer','tasbih'):
        page.evaluate("async id=>{const e=(await Catalog.fetchIndex()).find(x=>x.id===id);await Catalog.install(e,{silent:true})}", aid)
    page.evaluate("""Store.db.notes=[{id:'n1',title:'أفكار المشروع',body:'- تصميم الواجهة\\n- كتابة الإضافات\\n- نشر التطبيق في المتاجر',updated:Date.now()},{id:'n2',title:'قائمة التسوق',body:'خبز، حليب، تمر',updated:Date.now()-3600000}];Store.save()""")
    page.evaluate("UI.applyTheme('dark')"); page.wait_for_timeout(600)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for kind,vp,dsf in (('wide',{'width':1280,'height':720},1),('narrow',{'width':360,'height':640},2)):
        ctx=b.new_context(viewport=vp,device_scale_factor=dsf,is_mobile=(kind=='narrow'),locale='ar'); page=ctx.new_page(); seed(page)
        page.screenshot(path=f'assets/screenshots/{kind}-1-home.png')
        page.get_by_text('الملاحظات').first.click(); page.wait_for_selector('.notes'); page.wait_for_timeout(300); page.screenshot(path=f'assets/screenshots/{kind}-2-notes.png'); page.click('#close-stage')
        page.click('#store-btn'); page.wait_for_selector('#cat-list .admin-row'); page.wait_for_timeout(300); page.screenshot(path=f'assets/screenshots/{kind}-3-store.png'); page.click('#close-stage')
        page.locator('.app-card:has-text("الحاسبة")').click(); page.wait_for_timeout(800)
        f=page.frame_locator('.app-frame')
        for k in ['1','2','×','3','=']: f.locator('#keys button',has_text=__import__('re').compile('^'+k+'$')).first.click()
        page.screenshot(path=f'assets/screenshots/{kind}-4-calculator.png')
        ctx.close()
    b.close()
m=json.load(open('manifest.json',encoding='utf8'))
labels={'1-home':'سطح المكتب وتطبيقاتك','2-notes':'ملاحظات متعددة مع بحث وحفظ تلقائي','3-store':'متجر الإضافات','4-calculator':'إضافة الحاسبة'}
m['screenshots']=[{'src':f'assets/screenshots/{k}-{n}.png','sizes':'1280x720' if k=='wide' else '720x1280','type':'image/png','form_factor':k,'label':l} for k in ('wide','narrow') for n,l in labels.items()]
json.dump(m,open('manifest.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('ok')
