# اختبار شامل في متصفح حقيقي: python3 tests/e2e.py  (يتطلب خادماً على 8765)
import json, sys, time, pathlib
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; OUT=pathlib.Path('/tmp/claude-0/shots'); OUT.mkdir(exist_ok=True,parents=True)
legacy=json.load(open('tests/fixtures/legacy-backup-v1.json'))
fails=[]

def open_admin(page, pw):
    page.click('#admin-gate'); page.wait_for_timeout(500)
    if page.locator('.dialog input[type=password]').count():
        page.fill('.dialog input[type=password]', pw); page.keyboard.press('Enter')
    page.wait_for_selector('.tabs', timeout=8000)
def check(name, cond, extra=''):
    print(('✓ ' if cond else '✗ ')+name, extra if not cond else ''); 
    if not cond: fails.append(name)

with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':1100,'height':760}, accept_downloads=True, service_workers='allow')
    page=ctx.new_page(); errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    # زرع بيانات الإصدار القديم في localStorage (مرة واحدة فقط)
    page.goto('http://localhost:8765/favicon.ico')
    page.evaluate("""([db])=>{localStorage.setItem('alaisai_ultra_db',JSON.stringify(db));localStorage.setItem('saved_note','ملاحظتي القديمة');
      localStorage.setItem('alaisai_auto_backup',JSON.stringify({timestamp:'x',data:db}))}""",[legacy])
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(800)

    check('ثلاثة تطبيقات على سطح المكتب', page.locator('.app-card').count()==3)
    ls=page.evaluate("Object.keys(localStorage)")
    check('حُذفت بيانات localStorage القديمة (كلمة المرور النصية)', 'alaisai_ultra_db' not in ls and 'alaisai_auto_backup' not in ls and 'saved_note' not in ls, str(ls))
    dump=page.evaluate("""()=>new Promise(r=>{const q=indexedDB.open('alaisai_os');q.onsuccess=()=>{const g=q.result.transaction('kv').objectStore('kv').get('db');g.onsuccess=()=>r(JSON.stringify(g.result))}})""")
    check('لا كلمة مرور نصية في IndexedDB', '"pass"' not in dump and '"1234"' not in dump and 'passHash' in dump)
    check('زيادة عدّاد التشغيل من 1050', json.loads(dump)['config']['visits']==1051, str(json.loads(dump)['config']['visits']))

    # --- الملاحظات
    page.get_by_text('الملاحظات').first.click(); page.wait_for_selector('.notes')
    check('ملاحظة قديمة رُحّلت', page.locator('.notes-list li').count()==1 and 'ملاحظتي' in page.locator('.notes-list li').first.inner_text())
    page.click('[data-new]'); page.fill('[data-title]','عنوان 2'); page.fill('[data-body]','نص <b>خطير</b> & آخر'); page.wait_for_timeout(1200)
    page.wait_for_timeout(800); check('حفظ تلقائي', 'تم الحفظ' in page.inner_text('.notes [data-state]'))
    page.fill('[data-q]','خطير'); check('بحث', page.locator('.notes-list li').count()==1)
    check('لا حقن HTML في القائمة', page.locator('.notes-list b').count()==0)
    page.screenshot(path=str(OUT/'notes.png'))
    page.keyboard.press('Escape'); check('Esc يغلق المسرح', page.locator('#stage-overlay.hidden').count()==1)
    page.reload(); page.wait_for_selector('.app-card'); page.get_by_text('الملاحظات').first.click(); page.wait_for_selector('.notes')
    check('الملاحظات باقية بعد إعادة التحميل', page.locator('.notes-list li').count()==2)
    page.keyboard.press('Escape')

    # --- الدخول: كلمة خاطئة ثم 1234 الضعيفة => إجبار على التغيير
    page.click('#admin-gate'); page.fill('.dialog input[type=password]','nope'); page.keyboard.press('Enter'); page.wait_for_timeout(600)
    check('رفض كلمة خاطئة', 'خاطئة' in page.inner_text('#toast-wrap'))
    page.click('#admin-gate'); page.fill('.dialog input[type=password]','1234'); page.keyboard.press('Enter'); page.wait_for_timeout(1200)
    check('إجبار تغيير كلمة المرور الضعيفة', 'تغيير كلمة المرور' in page.inner_text('.dialog h3'))
    page.fill('input[name=p1]','1234'); page.fill('input[name=p2]','1234'); page.keyboard.press('Enter')
    check('رفض كلمة ضعيفة جديدة', 'ضعيفة' in page.inner_text('.dialog-err') or '6' in page.inner_text('.dialog-err'))
    page.fill('input[name=p1]','Alaisai#2026'); page.fill('input[name=p2]','Alaisai#2026'); page.keyboard.press('Enter'); page.wait_for_selector('.tabs',timeout=8000)
    check('فتحت لوحة التحكم', page.locator('.admin-row').count()==3)
    page.screenshot(path=str(OUT/'admin.png'))

    # --- تطبيق خبيث معزول
    page.click('[data-act=add]')
    page.fill('input[name=name]','خبيث'); page.select_option('select[name=type]','html')
    page.fill('textarea[name=content]',"<h1 id=h>x</h1><script>try{parent.document.body.innerHTML='PWNED'}catch(e){document.getElementById('h').textContent='blocked-parent'};try{localStorage.getItem('a');}catch(e){document.getElementById('h').textContent+=' blocked-ls'};try{parent.OS}catch(e){document.getElementById('h').textContent+=' blocked-os'}</script>")
    page.click('.dialog button[type=submit]'); page.wait_for_timeout(300)
    check('أضيف تطبيق رابع', page.locator('.admin-row').count()==4)
    page.click('#close-stage'); page.get_by_text('خبيث').first.click(); page.wait_for_timeout(600)
    fr=page.frame_locator('.app-frame'); txt=fr.locator('#h').inner_text()
    check('الـ sandbox يمنع الوصول للصفحة الأم وlocalStorage', 'blocked-parent' in txt and 'blocked-ls' in txt and 'blocked-os' in txt, txt)
    check('الصفحة الأم لم تتأثر', page.locator('#status-bar').count()==1 and 'PWNED' not in page.inner_text('body'))
    check('الإطار بلا allow-same-origin', 'allow-same-origin' not in page.get_attribute('.app-frame','sandbox'))
    page.keyboard.press('Escape')

    # --- ترتيب وتعديل
    open_admin(page,'Alaisai#2026')
    page.locator('[data-act=down]').first.click(); page.wait_for_timeout(200)
    names=page.eval_on_selector_all('.admin-row .grow','e=>e.map(x=>x.textContent.trim().split(" ")[0])')
    check('ترتيب بالسهم', names[0]=='المتصفح' and names[1]=='الترحيب', str(names))
    page.click('[data-act=tab][data-tab=logs]'); check('تبويب السجلات', 'مرة تشغيل' in page.inner_text('#admin-view'))
    page.click('[data-act=tab][data-tab=storage]'); page.locator('[data-ex=open][data-folder=system]').first.click(); page.wait_for_selector('#lab-code')
    page.fill('#lab-code',"<h1 id=r>ok</h1><script>var s='ran';try{parent.OS;s+=' LEAK'}catch(e){s+=' blocked'};document.getElementById('r').textContent=s</script>"); page.click('[data-ex=run]'); page.wait_for_timeout(500)
    lt=page.frame_locator('#lab-out iframe').locator('#r').inner_text(); check('بيئة التجربة معزولة', lt=='ran blocked', lt)

    # --- تصدير مشفّر ثم استيراد
    page.click('[data-act=tab][data-tab=system]')
    page.click('[data-act=exportenc]'); page.fill('input[name=p1]','backup-pass-1'); page.fill('input[name=p2]','backup-pass-1')
    with page.expect_download() as d: page.keyboard.press('Enter')
    path=d.value.path(); env=json.load(open(path)); check('الملف المشفّر بلا نص صريح', env.get('encrypted') and 'خبيث' not in open(path).read())
    # حذف التطبيق الخبيث ثم استعادته من النسخة المشفّرة
    page.click('[data-act=tab][data-tab=apps]'); page.locator('[data-act=delapp]').last.click(); page.click('.dialog button[type=submit]'); page.wait_for_timeout(300)
    check('حُذف التطبيق', page.locator('.admin-row').count()==3)
    page.click('[data-act=tab][data-tab=system]')
    with page.expect_file_chooser() as fc: page.click('[data-act=import]')
    fc.value.set_files(path); page.wait_for_selector('input[type=password]'); page.fill('.dialog input[type=password]','wrong'); page.keyboard.press('Enter'); page.wait_for_timeout(800)
    check('عبارة خاطئة تُرفض', 'خاطئة' in page.inner_text('#toast-wrap'))
    with page.expect_file_chooser() as fc: page.click('[data-act=import]')
    fc.value.set_files(path); page.wait_for_selector('input[type=password]'); page.fill('.dialog input[type=password]','backup-pass-1'); page.keyboard.press('Enter')
    page.wait_for_selector('.dialog h3:has-text("استيراد")')
    with page.expect_navigation(timeout=15000): page.click('.dialog button[type=submit]')
    page.wait_for_selector('.app-card'); page.wait_for_timeout(800)
    check('الاستيراد المشفّر أعاد 4 تطبيقات', page.locator('.app-card').count()==4, str(page.locator('.app-card').count())+' '+page.inner_text('#toast-wrap'))
    # ملف تالف
    bad=pathlib.Path('/tmp/claude-0/bad.json'); bad.write_text('{"config":{},"registry":"x"}')
    open_admin(page,'Alaisai#2026')
    page.click('[data-act=tab][data-tab=system]')
    with page.expect_file_chooser() as fc: page.click('[data-act=import]')
    fc.value.set_files(str(bad)); page.wait_for_timeout(800)
    check('الملف التالف يُرفض دون إفساد البيانات', 'registry' in page.inner_text('#toast-wrap') or '❌' in page.inner_text('#toast-wrap'))
    page.click('[data-act=tab][data-tab=backup]'); page.wait_for_timeout(300)
    check('نسخ احتياطية دوّارة موجودة', page.locator('[data-act=restore]').count()>=1)
    page.keyboard.press('Escape')

    # --- المظهر
    page.click('#theme-toggle'); page.click('#theme-toggle')  # auto -> dark -> light
    check('مظهر فاتح', page.evaluate("document.documentElement.dataset.theme")=='light')
    page.screenshot(path=str(OUT/'light.png'))
    # --- PWA دون اتصال
    page.evaluate("navigator.serviceWorker.ready"); page.wait_for_timeout(1500)
    cached=page.evaluate("caches.keys().then(async k=>{const c=await caches.open(k.find(x=>x.startsWith('alaisai-')));return (await c.keys()).length})")
    check('الكاش يحوي ملفات النظام', cached>=10, str(cached))
    ctx.set_offline(True); page.reload(); page.wait_for_selector('.app-card',timeout=8000)
    check('يعمل دون إنترنت', page.locator('.app-card').count()==4)
    ctx.set_offline(False)
    # --- جوال
    m=b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2); mp=m.new_page(); mp.goto(BASE); mp.wait_for_selector('.app-card'); mp.screenshot(path=str(OUT/'mobile.png'))
    mp.get_by_text('الملاحظات').first.click(); mp.wait_for_selector('.notes'); mp.screenshot(path=str(OUT/'mobile-notes.png'))
    check('لا تمرير أفقي في الجوال', mp.evaluate("document.documentElement.scrollWidth<=innerWidth"))
    mp.close(); m.close()
    check('لا أخطاء JavaScript غير ملتقطة', not errors, str(errors))
    b.close()
print('\nFAILED:',fails) if fails else print('\nكل الاختبارات نجحت')
sys.exit(1 if fails else 0)
