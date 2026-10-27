# رفع ملفات ومجلدات من الجهاز في المستكشف: python3 tests/e2e3.py (يتطلب خادماً على 8765)
import sys, pathlib
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; PW='Test#Pass2026xyz'
fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
def open_admin(page):
    page.click('#admin-gate'); page.wait_for_timeout(500)
    if page.locator('.dialog input[name=p1]').count():
        page.fill('input[name=p1]',PW); page.fill('input[name=p2]',PW); page.keyboard.press('Enter')
    page.wait_for_selector('.tabs',timeout=8000)
def names(page):
    return page.evaluate("Addons.get('رفع').files.map(f=>f.name).sort()")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':1100,'height':800},service_workers='block')
    page=ctx.new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(500)
    open_admin(page); page.click('[data-act=tab][data-tab=storage]')
    page.click('[data-ex=newaddon]'); page.fill('input[name=name]','رفع'); page.keyboard.press('Enter'); page.wait_for_timeout(400)
    check('زر الرفع ظاهر', page.locator('[data-ex=upload]').count()==1)
    # 1) مجلد كامل: يحتفظ باسم المجلد، يتجاهل node_modules و.DS_Store، ويرفض الثنائي مع ذكر السبب
    page.click('[data-ex=upload]'); page.select_option('.dialog select','dir')
    with page.expect_file_chooser() as fc: page.click('.dialog button[type=submit]')
    fc.value.set_files('/tmp/upl/mylib'); page.wait_for_timeout(900)
    n=names(page); print(n)
    check('بنية المجلد محفوظة', 'mylib/src/a.js' in n and 'mylib/src/sub/b.css' in n and 'mylib/data.json' in n, str(n))
    check('node_modules و.DS_Store تُجاهلا', not any('node_modules' in x or 'DS_Store' in x for x in n), str(n))
    check('الصورة الثنائية لم تُرفع', 'mylib/logo.png' not in n)
    check('ظهر تقرير بالملف المرفوض', 'logo.png' in page.inner_text('.dialog') and 'غير نصي' in page.inner_text('.dialog'), page.inner_text('.dialog') if page.locator('.dialog').count() else 'no dialog')
    page.click('.dialog button[type=submit]'); page.wait_for_timeout(200)
    # 2) ملفات متعددة بأسماء عربية داخل مجلد فرعي
    page.locator('[data-ex=opendir][data-dir=mylib]').first.click(); page.wait_for_timeout(200)
    page.click('[data-ex=upload]'); page.select_option('.dialog select','files')
    with page.expect_file_chooser() as fc: page.click('.dialog button[type=submit]')
    fc.value.set_files(['/tmp/upl/loose/ملاحظة.txt','/tmp/upl/loose/two.md']); page.wait_for_timeout(700)
    n=names(page)
    check('رفع ملفات متعددة للمجلد الحالي بأسماء عربية', 'mylib/ملاحظة.txt' in n and 'mylib/two.md' in n, str(n))
    # 3) الاستبدال يطلب تأكيداً
    page.click('[data-ex=upload]'); page.select_option('.dialog select','files')
    with page.expect_file_chooser() as fc: page.click('.dialog button[type=submit]')
    fc.value.set_files(['/tmp/upl/loose/two.md']); page.wait_for_selector('.dialog'); page.wait_for_timeout(300)
    check('تأكيد قبل الاستبدال', 'يستبدل' in page.inner_text('.dialog'), page.inner_text('.dialog'))
    page.click('.dialog button[type=submit]'); page.wait_for_timeout(400)
    # 4) تعارض اسم ملف مع مجلد
    page.click('[data-ex=upload]'); page.select_option('.dialog select','files')
    import os; os.makedirs('/tmp/upl/c',exist_ok=True); open('/tmp/upl/c/src','w').write('x')
    with page.expect_file_chooser() as fc: page.click('.dialog button[type=submit]')
    fc.value.set_files(['/tmp/upl/c/src']); page.wait_for_timeout(500)
    check('ملف بنفس اسم مجلد موجود يُرفض', 'بنفس الاسم' in (page.inner_text('.dialog') if page.locator('.dialog').count() else ''))
    page.click('.dialog button[type=submit]')
    check('لا أخطاء JS', not errs, str(errs))
    b.close()
print('FAILED:',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
