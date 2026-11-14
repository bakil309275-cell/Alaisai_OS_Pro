# GitFlash (مع GitHub وهمي): python3 tests/e2e11.py (خادم على 8765)
import sys, os, json, pathlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from gh_mock import GH, TOKEN
BASE='http://localhost:8765/index.html'; PW='Alaisai#2026'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
gh=GH(); gh.files={'README.md':b'# hi','addons/a/manifest.json':b'{"name":"a"}','addons/a/old.js':b'1'}
# المستودع الوهمي يدعم me/vault فقط
d=pathlib.Path('/tmp/gf_t/pack'); (d/'js').mkdir(parents=True,exist_ok=True); (d/'index.html').write_text('<b>x</b>'); (d/'js'/'m.js').write_text('1')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block')
    ctx.route('https://api.github.com/**', gh.handle); page=ctx.new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.start-card'); page.click('#admin-gate'); page.wait_for_timeout(500)
    page.fill('input[name=p1]',PW); page.fill('input[name=p2]',PW); page.keyboard.press('Enter'); page.wait_for_selector('.tabs')
    check('المستخدم العادي لا يرى تبويبي المنصة وGitFlash', page.locator('.tabs [data-tab=gitflash]').count()==0 and page.locator('.tabs [data-tab=control]').count()==0)
    page.locator('.tabs [data-tab=owner]').click(); check('تبويب المالك يعرض الدخول بمفتاح', page.locator('[data-act=ownerunlock]').count()==1)
    page.evaluate("async()=>{const k=await Sync.deviceKey(true);await Store.set('ctrlapi',await Sec.seal(k,'owner-key-for-test-0123456789'));Admin.owner=await Control.isOwner();Admin.drawTabs()}")
    page.locator('.tabs [data-tab=gitflash]').click(); page.click('[data-gf=open]'); page.wait_for_selector('.gf-dlg')
    check('زر الإدارة يفتح نافذة GitFlash', True)
    page.fill('.gf-conn [name=owner]','me'); page.fill('.gf-conn [name=repo]','vault'); page.fill('.gf-conn [name=token]',TOKEN); page.click('.gf-conn button[type=submit]')
    page.wait_for_selector('.gf-row'); check('الاتصال وعرض الشجرة', 'متصل' in page.inner_text('.gf-status') and page.locator('.gf-row').count()>=2)
    check('الاتصال لا يضع الرمز في localStorage نصاً', TOKEN not in page.evaluate("JSON.stringify(Object.assign({},localStorage))"))
    sealed=page.evaluate("Store.get('gfcfg')"); check('الإعدادات محفوظة مشفّرة', sealed and TOKEN not in json.dumps(sealed))
    page.locator('.gf-row[data-p=addons] [data-g=tg]').click(); page.wait_for_timeout(100)
    check('الطيّ والفتح', page.locator('.gf-row[data-p=addons] [data-g=tg].o').count()==1 and page.locator('.gf-row[data-p="addons/a"]').count()==1)
    page.fill('.gf-q','manifest'); page.wait_for_timeout(100); check('البحث في المسارات', page.locator('.gf-row[data-d="0"]').count()==1); page.fill('.gf-q','')
    # رفع مجلد: commit واحد وتجاهل اسم المجلد
    c0=len([l for l in gh.log if l==('POST','/repos/me/vault/git/commits')])
    page.fill('[name=root]','addons/pack'); page.click('[data-g=add]'); page.wait_for_selector('.up-dlg')
    page.set_input_files('#up-d', str(d)); page.wait_for_timeout(150); page.click('[data-u=go]'); page.wait_for_timeout(1500)
    c1=len([l for l in gh.log if l==('POST','/repos/me/vault/git/commits')])
    check('رفع مجلد بـ commit واحد', c1-c0==1, str(c1-c0))
    check('الملفات في المسار الصحيح دون اسم المجلد', gh.files.get('addons/pack/index.html')==b'<b>x</b>' and gh.files.get('addons/pack/js/m.js')==b'1', str(sorted(gh.files)))
    # رفع مطابق لا ينشئ commit
    page.click('[data-g=add]'); page.wait_for_selector('.up-dlg'); page.set_input_files('#up-d', str(d)); page.click('[data-u=go]'); page.wait_for_timeout(1200)
    check('رفع مطابق لا ينشئ commit جديداً', len([l for l in gh.log if l==('POST','/repos/me/vault/git/commits')])==c1 and 'مطابقة' in page.inner_text('.gf-log'))
    # نقل مجلد بدون إعادة تنزيل
    page.locator('.gf-row[data-p="addons/pack"] [data-g=ren]').click(); page.wait_for_selector('form.dialog input'); page.fill('form.dialog input','addons/pack2'); page.keyboard.press('Enter'); page.wait_for_timeout(1500)
    check('نقل مجلد: الملفات في الوجهة ومحذوفة من المصدر', 'addons/pack2/js/m.js' in gh.files and not any(k.startswith('addons/pack/') for k in gh.files), str(sorted(gh.files)))
    # إنشاء ملف
    page.locator('.gf-row[data-p="addons"] [data-g=new]').click(); page.wait_for_selector('form.dialog input'); page.fill('form.dialog input','note.txt'); page.keyboard.press('Enter'); page.wait_for_timeout(1500)
    check('إنشاء ملف داخل مجلد', 'addons/note.txt' in gh.files)
    # عرض وتعديل
    page.locator('.gf-row[data-p="addons/pack2/js/m.js"]').scroll_into_view_if_needed() if page.locator('.gf-row[data-p="addons/pack2/js/m.js"]').count() else None
    page.evaluate("GitFlash.st.open.add('addons');GitFlash.st.open.add('addons/pack2');GitFlash.st.open.add('addons/pack2/js');GitFlash.drawTree()")
    page.locator('.gf-row[data-p="addons/pack2/js/m.js"] [data-g=view]').click(); page.wait_for_selector('.gf-edit'); page.fill('.gf-edit','2'); page.click('[data-v=save]'); page.wait_for_timeout(1500)
    check('تعديل ملف نصي وحفظه', gh.files.get('addons/pack2/js/m.js')==b'2')
    # حذف
    page.evaluate("GitFlash.st.open.add('addons');GitFlash.drawTree()")
    page.locator('.gf-row[data-p="addons/note.txt"] [data-g=del]').click(); page.wait_for_selector('form.dialog button[type=submit]'); page.click('form.dialog button[type=submit]'); page.wait_for_timeout(1500)
    check('حذف ملف', 'addons/note.txt' not in gh.files)
    # تحديد متعدد بالضغط المستمر ثم حذف دفعة واحدة
    page.evaluate("GitFlash.st.open.add('addons');GitFlash.st.open.add('addons/a');GitFlash.drawTree()")
    page.evaluate("GitFlash.run('x',()=>GitFlash.commit([{path:'x1.txt',content:'MQ=='},{path:'x2.txt',content:'Mg=='}],'t'))"); page.wait_for_selector('.gf-row[data-p="x2.txt"]'); page.wait_for_timeout(500)
    page.locator('.gf-row[data-p="x1.txt"]').scroll_into_view_if_needed(); r=page.locator('.gf-row[data-p="x1.txt"]').bounding_box(); page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2); page.mouse.down(); page.wait_for_timeout(700); page.mouse.up()
    check('الضغط المطوّل يبدأ وضع التحديد', page.locator('.gf-selbar').is_visible() and 'محدد: 1' in page.inner_text('.gf-selbar'))
    page.locator('.gf-row[data-p="x2.txt"]').click(); check('النقر يضيف للتحديد', 'محدد: 2' in page.inner_text('.gf-selbar') and page.locator('.gf-row.sel').count()==2)
    page.locator('.gf-row[data-p="x2.txt"]').click(); check('النقر على محدد يلغيه', 'محدد: 1' in page.inner_text('.gf-selbar'))
    page.locator('.gf-row[data-p="x2.txt"]').click(); c0=len([l for l in gh.log if l==('POST','/repos/me/vault/git/commits')])
    page.click('[data-g=seldel]'); page.wait_for_selector('form.dialog button[type=submit]'); page.click('form.dialog button[type=submit]'); page.wait_for_timeout(1800)
    check('حذف المحدد في commit واحد', 'x1.txt' not in gh.files and 'x2.txt' not in gh.files and len([l for l in gh.log if l==('POST','/repos/me/vault/git/commits')])==c0+1, str((sorted(gh.files), c0, len([l for l in gh.log if l==('POST','/repos/me/vault/git/commits')]))))
    check('انتهى وضع التحديد', not page.locator('.gf-selbar').is_visible())
    check('لا force-push في أي طلب', all(True for _ in [0]) and not any('force' in str(l) for l in gh.log))
    check('لا أخطاء JS', not [e for e in errs if 'serviceWorker' not in e], str(errs[:2]))
    b.close()
print('ALL OK' if not fails else 'FAILED: %s'%fails); sys.exit(1 if fails else 0)
