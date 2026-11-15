# زر الرجوع (مثلث الهاتف): رجوع تدريجي + سؤال الخروج. python3 tests/e2e13.py (خادم الموقع على 8765)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; PW='Alaisai#2026'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
STAGE="!document.getElementById('stage-overlay').classList.contains('hidden')"
ADDON_MAIN='''let n=0;Alaisai.onBack(()=>{ if(n>0){n--;document.getElementById("d").textContent=n;return true}return false});
document.getElementById("go").onclick=()=>{n++;document.getElementById("d").textContent=n};'''
with sync_playwright() as p:
    b=seeded(p.chromium.launch(args=['--no-sandbox'])); ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    back=lambda: (page.go_back(), page.wait_for_timeout(450))
    page.goto('about:blank'); page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(500)
    check('مدير الرجوع جاهز', page.evaluate("Nav.ready && Nav.stack.length===0"))
    # 1) متجر: رجوع يغلق المسرح
    page.click('#store-btn'); page.wait_for_timeout(300); check('المتجر مفتوح', page.evaluate(STAGE))
    back(); check('رجوع يغلق المتجر', not page.evaluate(STAGE) and page.locator('form.dialog').count()==0)
    # 2) الإغلاق بالزر لا يترك مدخلاً زائداً: رجوع بعده يعرض سؤال الخروج مباشرة
    page.click('#store-btn'); page.wait_for_timeout(300); page.click('#close-stage'); page.wait_for_timeout(500)
    check('بعد الإغلاق بالزر لا طبقات', page.evaluate("Nav.stack.length")==0)
    back(); check('رجوع عند سطح المكتب يسأل عن الخروج', page.locator('form.dialog:has-text("هل تريد الخروج")').count()==1)
    # 3) «لا» تبقيك، وكرّر السؤال في الرجوع التالي
    page.click('form.dialog [data-cancel]'); page.wait_for_timeout(500); check('«لا» تبقى في التطبيق', 'localhost' in page.url and page.locator('form.dialog').count()==0)
    back(); check('السؤال يتكرر عند كل رجوع', page.locator('form.dialog:has-text("هل تريد الخروج")').count()==1)
    # 4) رجوع والسؤال ظاهر = «لا»
    back(); check('رجوع فوق السؤال يغلقه ويبقى', page.locator('form.dialog').count()==0 and 'localhost' in page.url)
    # 5) الإدارة: تبويب ثم حوار ثم رجوع خطوة خطوة
    page.click('#admin-gate'); page.wait_for_timeout(500); page.fill('input[name=p1]',PW); page.fill('input[name=p2]',PW); page.keyboard.press('Enter'); page.wait_for_selector('.tabs')
    page.locator('.tabs [data-tab=storage]').click(); page.wait_for_timeout(300)
    back(); check('رجوع من تبويب إلى «التطبيقات»', page.evaluate("Admin.tab")=='apps' and page.evaluate(STAGE))
    page.locator('[data-act=add]').first.click(); page.wait_for_selector('form.dialog'); 
    back(); check('رجوع يغلق الحوار ويبقى في الإدارة', page.locator('form.dialog').count()==0 and page.evaluate(STAGE))
    back(); check('رجوع ثانٍ يغلق الإدارة', not page.evaluate(STAGE))
    # 6) المستكشف: خطوة خطوة
    page.evaluate("Addons.put({name:'مجلد-تجريب',files:[{name:'manifest.json',content:JSON.stringify({id:'t',name:'تجريب',icon:'🧪',version:'1',description:'',author:''})},{name:'index.html',content:'<button id=go>+</button><b id=d>0</b>'},{name:'main.js',content:%s},{name:'sub/a.txt',content:'x'}]},'local'); Addons.install('مجلد-تجريب')" % __import__('json').dumps(ADDON_MAIN))
    page.click('#admin-gate'); page.wait_for_selector('.tabs'); page.locator('.tabs [data-tab=storage]').click(); page.wait_for_timeout(300)
    page.evaluate("Explorer.nav={view:'folder',folder:'مجلد-تجريب',dir:'sub'};Explorer.render()"); page.wait_for_timeout(200)
    check('المستكشف داخل مجلد فرعي', page.evaluate("Nav.stack.some(x=>x.id==='explorer')"))
    back(); check('رجوع: من المجلد الفرعي إلى مجلد الإضافة', page.evaluate("Explorer.nav.view==='folder' && !Explorer.nav.dir"))
    back(); check('رجوع: إلى القائمة الرئيسية للمستكشف', page.evaluate("Explorer.nav.view")=='root')
    back(); check('رجوع: إلى تبويب التطبيقات', page.evaluate("Admin.tab")=='apps'); back(); check('رجوع: إغلاق الإدارة', not page.evaluate(STAGE))
    # 7) إضافة تسجّل Alaisai.onBack: الرجوع يُعالَج داخلها أولاً
    page.click('.app-card:has-text("تجريب")'); page.wait_for_selector('#stage-viewport iframe'); fr=page.frame_locator('#stage-viewport iframe'); page.wait_for_timeout(800)
    fr.locator('#go').click(); fr.locator('#go').click(); page.wait_for_timeout(300)
    check('الإضافة سجّلت طبقة الرجوع', page.evaluate("Nav.stack.some(x=>String(x.id).startsWith('addon-back'))"))
    back(); page.wait_for_timeout(300); check('رجوع 1: الإضافة تراجعت داخلياً (2→1) وبقيت مفتوحة', fr.locator('#d').inner_text()=='1' and page.evaluate(STAGE), fr.locator('#d').inner_text())
    back(); page.wait_for_timeout(300); check('رجوع 2: (1→0)', fr.locator('#d').inner_text()=='0' and page.evaluate(STAGE))
    back(); page.wait_for_timeout(900); check('رجوع 3: لا حالة داخلية فتُغلق الإضافة', not page.evaluate(STAGE))
    # 7ب) إضافة حقيقية (الطب والأدوية): الرجوع من تبويب إلى الرئيسية ثم يغلقها
    page.evaluate("async()=>{const k=await (await fetch('catalog/index.json')).json();const e=k.addons.find(x=>x.id==='الطب والأدوية');const p=await (await fetch('catalog/'+e.file)).json();Addons.put({name:p.id,files:p.files},'catalog');Addons.install(p.id)}")
    page.click('.app-card:has-text("الطب")'); page.wait_for_selector('#stage-viewport iframe'); fr=page.frame_locator('#stage-viewport iframe'); fr.locator("nav [data-act=go][data-t=cat]").wait_for(); page.wait_for_timeout(700)
    fr.locator("nav [data-act=go][data-t=cat]").click(); page.wait_for_timeout(300); check('الإضافة في تبويب «الكتالوج»', fr.locator('nav button.cur[data-t=cat]').count()==1)
    back(); page.wait_for_timeout(300); check('رجوع الهاتف داخل الإضافة الحقيقية يعيد «الرئيسية»', fr.locator('nav button.cur[data-t=home]').count()==1 and page.evaluate(STAGE))
    back(); page.wait_for_timeout(900); check('رجوع ثانٍ يغلق الإضافة الحقيقية', not page.evaluate(STAGE))
    # 8) المنصة
    page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.wait_for_timeout(400); page.click('.comm-tab[data-v=chan]'); page.wait_for_timeout(300)
    back(); check('المنصة: رجوع من «القناة» إلى «الموجز»', page.locator('.comm-sheet').count()==1 and page.evaluate("Community.view")=='feed')
    back(); check('المنصة: رجوع يغلق النافذة', page.locator('.comm-sheet').count()==0)
    # 9) «نعم» تغادر التطبيق
    back(); page.wait_for_selector('form.dialog:has-text("هل تريد الخروج")'); page.click('form.dialog button[type=submit]'); page.wait_for_timeout(1500)
    check('«نعم، خروج» يغادر التطبيق', page.url=='about:blank', page.url)
    check('لا أخطاء JS', not [e for e in errs if 'serviceWorker' not in e], str(errs[:2]))
    b.close()
print('ALL OK' if not fails else 'FAILED: %s'%fails); sys.exit(1 if fails else 0)
