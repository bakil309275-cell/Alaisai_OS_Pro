# المدد والأسعار + زر العين + وضع التطبيق الأصلي: python3 tests/e2e20.py (الموقع على 8765)
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox'])); ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page()
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(500)
    # زر العين
    page.evaluate("document.body.insertAdjacentHTML('beforeend','<div id=t><input type=password id=pw value=abc></div>')"); page.wait_for_timeout(200)
    check('زر العين يُضاف لحقل كلمة المرور', page.locator('#t .eye-btn').count()==1)
    page.click('#t .eye-btn'); check('الضغط يُظهر النص', page.evaluate("document.getElementById('pw').type")=='text')
    page.click('#t .eye-btn'); check('الضغط ثانية يُخفيه', page.evaluate("document.getElementById('pw').type")=='password')
    # محرّر المدد
    page.evaluate("Control.draft=Control.draft||{};Control.draft.plans=[{id:'week',label:'أسبوع',days:7,price:'1 دولار'}];Control.saveDraft=async()=>{};Control.body=()=>{};Control.editPlans()")
    page.wait_for_selector('#pl-rows')
    check('الصف الحالي يظهر', page.locator('#pl-rows .ctl-card[data-i]').count()==1)
    page.click('[data-p=add]'); page.locator('#pl-rows [data-k=label]').nth(1).fill('شهر')
    page.locator('#pl-rows [data-k=days]').nth(1).fill('30'); page.locator('#pl-rows [data-k=price]').nth(1).fill('4 دولار')
    page.click('form.dialog button[type=submit]'); page.wait_for_timeout(300)
    pl=page.evaluate("Control.draft.plans")
    check('إضافة مدة بسعر', len(pl)==2 and pl[1]['days']==30 and pl[1]['price']=='4 دولار', json.dumps(pl,ensure_ascii=False))
    check('نص المدة يعرض السعر', '4 دولار' in page.evaluate("Control.planText(Control.draft.plans[1])"))
    page.evaluate("Control.editPlans()"); page.wait_for_selector('#pl-rows')
    check('المحرّر يعيد فتح المسودة (لا المنشور)', page.locator('#pl-rows .ctl-card[data-i]').count()==2)
    page.click('#pl-rows [data-p=del][data-i="0"]'); page.wait_for_timeout(300); page.locator('form.dialog').last.locator('button[type=submit]').click(); page.wait_for_timeout(300)
    check('الحذف يزيل الصف', page.locator('#pl-rows .ctl-card[data-i]').count()==1)
    page.click('form.dialog button[type=submit]'); page.wait_for_timeout(300)
    check('بعد الحذف مدة واحدة', len(page.evaluate("Control.draft.plans"))==1)
    # رفض عدد أيام غير صالح
    page.evaluate("Control.editPlans()"); page.wait_for_selector('#pl-rows'); page.locator('#pl-rows [data-k=days]').first.fill('-5'); page.click('form.dialog button[type=submit]'); page.wait_for_timeout(200)
    check('عدد أيام غير صالح يُرفض', page.locator('#pl-rows').count()==1)
    br.close()
print('fails=%d'%len(fails)); sys.exit(1 if fails else 0)
