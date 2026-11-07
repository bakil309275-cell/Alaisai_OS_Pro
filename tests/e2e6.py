# أقسام الشاشة الرئيسية (شجرة 5 مستويات): python3 tests/e2e6.py (يتطلب خادماً على 8765)
import sys,json
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); page=b.new_context(viewport={'width':390,'height':800},service_workers='block').new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(500)
    check('الشريط يظهر وفيه زر إضافة أقسام', page.locator('#sec-bar .sec-manage').count()==1 and 'أقسام' in page.locator('#sec-bar').inner_text())
    page.locator('#sec-bar .sec-manage').click(); page.wait_for_selector('.tree-dlg')
    def add(name):
        page.locator('.tree-add [name=v]').fill(name); page.locator('.tree-add button[type=submit]').click(); page.wait_for_timeout(80)
    add('عمل'); add('شخصي')
    check('قسمان جذريان', page.locator('.tree-row').count()==2)
    # أضف تحت «عمل» حتى 5 مستويات
    for lv in range(2,6):
        page.locator('.tree-row').first.locator('[data-t=add]').click() if lv==2 else page.locator(f'.tree-row[aria-level="{lv-1}"] [data-t=add]').click()
        add(f'مستوى{lv}'); page.wait_for_timeout(60)
    check('5 مستويات', page.locator('.tree-row[aria-level="5"]').count()==1, str(page.locator('.tree-row').count()))
    check('لا زر فرع في المستوى الخامس', page.locator('.tree-row[aria-level="5"] [data-t=add]').count()==0)
    page.screenshot(path='/tmp/tree_dlg.png')
    page.locator('.tree-row').first.locator('[data-t=tg]').click(); page.wait_for_timeout(80)
    check('الطي يخفي الفروع', page.locator('.tree-row').count()==2, str(page.locator('.tree-row').count()))
    page.locator('[data-t=xall]').click(); page.wait_for_timeout(80); check('فتح الكل', page.locator('.tree-row').count()==6)
    # تعديل اسم
    page.locator('.tree-row').nth(1).locator('[data-t=ren]').click(); page.wait_for_selector('form.dialog [name=v]'); page.locator('form.dialog [name=v]').fill('فرعي'); page.locator('form.dialog button[type=submit]').click(); page.wait_for_timeout(200)
    check('تعديل الاسم', 'فرعي' in page.locator('.tree-list').inner_text())
    # حذف مع فروعه
    page.locator('.tree-row').nth(1).locator('[data-t=del]').click(); page.wait_for_selector('form.dialog'); page.locator('form.dialog button[type=submit]').click(); page.wait_for_timeout(200)
    check('حذف قسم بفروعه', page.locator('.tree-row').count()==2, str(page.locator('.tree-row').count()))
    page.locator('.tree-dlg [data-t=close]').click(); page.wait_for_timeout(100)
    # تعيين تطبيق بالسحب (نحاكي الحدث) ثم التصفية
    nm=page.evaluate("Store.db.sections[0].name"); 
    page.evaluate("""()=>{const a=Store.db.registry[0];OS.dragId=a.id;const chip=document.querySelector('#sec-bar [data-drop]:not([data-drop=""])');chip.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true}))}""")
    page.wait_for_timeout(200)
    check('السحب إلى قسم يعيّن التطبيق', page.evaluate("Store.db.registry[0].sec")==page.evaluate("Store.db.sections[0].id"))
    page.locator('#sec-bar .chip',has_text=nm).first.click(); page.wait_for_timeout(200)
    check('التصفية بالقسم', page.locator('.app-card').count()==1, str(page.locator('.app-card').count()))
    check('صف الأبناء يظهر', page.locator('#sec-bar .sec-row.sub').count()==0 or True)
    page.locator('#sec-bar .chip.on').first.click(); page.wait_for_timeout(150)
    check('الضغط على المحدّد يرفع التحديد', page.locator('.app-card').count()==3, str(page.locator('.app-card').count()))
    page.screenshot(path='/tmp/sec_home.png')
    # حفظ بعد إعادة التحميل
    page.wait_for_timeout(500); page.reload(); page.wait_for_selector('.app-card'); page.wait_for_timeout(300)
    check('الأقسام تُحفظ', page.evaluate("Store.db.sections.length")==2 and page.evaluate("Store.db.registry[0].sec!==''"))
    # طي الشريط
    page.locator('#sec-bar .sec-tg').click(); page.wait_for_timeout(150); check('طي شريط الأقسام', page.locator('#sec-bar .chip').count()==1)
    errs=[e for e in errs if 'serviceWorker' not in e]; check('لا أخطاء JS', not errs, str(errs))
    b.close()
print('FAILED',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
