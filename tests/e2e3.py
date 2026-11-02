# رفع ملفات ومجلدات (نصية وثنائية) من الجهاز في المستكشف: python3 tests/e2e3.py (يتطلب خادماً على 8765)
import sys, os, struct, zlib, hashlib, random
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; PW='Test#Pass2026xyz'
fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
def png(r,g,b):
    def ch(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',2,2,8,2,0,0,0))+ch(b'IDAT',zlib.compress((b'\x00'+bytes([r,g,b])*2)*2))+ch(b'IEND',b'')
# ملفات الاختبار: PNG حقيقية + ثنائي عشوائي + نص كبير + ملف أكبر من الحد
import shutil; shutil.rmtree('/tmp/upl',ignore_errors=True)
for d in ['mylib/src/sub','mylib/img','mylib/node_modules','loose','huge','c']: os.makedirs('/tmp/upl/'+d)
PNG=png(255,0,0); W=lambda p,c,m='w': open('/tmp/upl/'+p,m).write(c)
W('mylib/src/a.js','export const a=1;\n'); W('mylib/src/sub/b.css','body{color:red}\n'); W('mylib/data.json','{"name":"x"}\n')
W('mylib/img/red.png',PNG,'wb'); W('mylib/logo.png',bytes(random.Random(1).randrange(256) for _ in range(400)),'wb')
W('mylib/big.txt','a'*600000); W('mylib/.DS_Store','x'); W('mylib/node_modules/n.js','x')
W('loose/ملاحظة.txt','مرحبا\n'); W('loose/two.md','two\n'); W('huge/huge.bin',os.urandom(3300000),'wb'); W('c/src','x')
def open_admin(page):
    page.click('#admin-gate'); page.wait_for_timeout(500)
    if page.locator('.dialog input[name=p1]').count():
        page.fill('input[name=p1]',PW); page.fill('input[name=p2]',PW); page.keyboard.press('Enter')
    elif page.locator('.dialog input[type=password]').count():
        page.fill('.dialog input[type=password]',PW); page.keyboard.press('Enter')
    page.wait_for_selector('.tabs',timeout=8000)
def names(page): return page.evaluate("Addons.get('رفع').files.map(f=>f.name).sort()")
def choose(page, kind, paths):
    page.click('[data-ex=upload]'); page.select_option('.dialog select',kind)
    with page.expect_file_chooser() as fc: page.click('.dialog button[type=submit]')
    fc.value.set_files(paths)
SHA="""async()=>{const a=Addons.get('رفع');const o={};for(const f of a.files.filter(f=>f.name.startsWith('mylib/'))){const h=await crypto.subtle.digest('SHA-256',Addons.toBytes(f));o[f.name]=[!!f.bin,[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')]}return o}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':1100,'height':800},service_workers='block')
    page=ctx.new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(500)
    open_admin(page); page.click('[data-act=tab][data-tab=storage]')
    page.click('[data-ex=newaddon]'); page.fill('input[name=name]','رفع'); page.keyboard.press('Enter'); page.wait_for_timeout(400)
    check('زر الرفع ظاهر', page.locator('[data-ex=upload]').count()==1)
    # 1) مجلد كامل بكل ما فيه
    choose(page,'dir','/tmp/upl/mylib'); page.wait_for_timeout(1200)
    n=names(page)
    check('بنية المجلد محفوظة', all(x in n for x in ['mylib/src/a.js','mylib/src/sub/b.css','mylib/data.json']), str(n))
    check('node_modules و.DS_Store تُجاهلا', not any('node_modules' in x or 'DS_Store' in x for x in n), str(n))
    check('الصور والملفات الثنائية رُفعت أيضاً', 'mylib/logo.png' in n and 'mylib/img/red.png' in n, str(n))
    check('لا نافذة أخطاء حين يُرفع كل شيء', page.locator('.dialog').count()==0, page.inner_text('.dialog') if page.locator('.dialog').count() else '')
    ex=page.evaluate(SHA)
    check('PNG حُفظت بايتاً ببايت', ex['mylib/img/red.png']==[True,hashlib.sha256(PNG).hexdigest()], str(ex.get('mylib/img/red.png')))
    check('نص أكبر من 500 ألف حرف حُفظ ولم يُرفض', ex['mylib/big.txt']==[True,hashlib.sha256(b'a'*600000).hexdigest()])
    check('النص العادي يبقى نصاً', ex['mylib/data.json'][0] is False)
    # عرض الصورة في المستكشف
    page.locator('[data-ex=opendir][data-dir=mylib]').first.click(); page.locator('[data-ex=opendir][data-dir="mylib/img"]').first.click(); page.wait_for_timeout(150)
    page.locator('[data-ex=edit][data-file="mylib/img/red.png"]').first.click(); page.wait_for_timeout(300)
    check('الصورة تُعرض فعلاً في المستكشف', page.evaluate("(()=>{const i=document.querySelector('.panel img');return !!i&&i.complete&&i.naturalWidth===2})()"))
    with page.expect_download() as d: page.click('[data-ex=download]')
    check('زر التنزيل يعيد الملف نفسه', open(d.value.path(),'rb').read()==PNG)
    page.locator('[data-ex=opendir]').first.click(); page.wait_for_timeout(150)   # رجوع من عرض الملف
    page.locator('[data-ex=opendir][data-dir=""]').first.click(); page.wait_for_timeout(150)   # جذر الإضافة
    # الصورة تعمل داخل الإضافة (src نسبي في HTML وurl() في CSS)
    page.evaluate("""()=>{const a=Addons.get('رفع');const put=(n,c)=>{const f=a.files.find(x=>x.name===n);f?f.content=c:a.files.push({name:n,content:c})};
      put('index.html','<main><img id="i" src="mylib/img/red.png"><div id="d"></div></main>'); put('style.css','#d{width:20px;height:20px;background:url(mylib/img/red.png)}'); put('main.js','/* لا شيء */'); Store.save()}""")
    page.click('[data-ex=preview]'); page.wait_for_timeout(1200)
    doc=page.evaluate("Addons.buildDoc(Addons.get('رفع'))")
    check('buildDoc يضمّن الصورة كـ data: لا مسارات منكسرة', doc.count('data:image/png;base64,')>=2 and 'src="mylib/img/red.png"' not in doc)
    check('الصورة تُحمَّل داخل الإضافة', page.frame_locator('#addon-preview iframe').locator('#i').evaluate("i=>i.complete&&i.naturalWidth===2"))
    # ملف أكبر من 3 ميغابايت يُرفض بسبب واضح
    choose(page,'files',['/tmp/upl/huge/huge.bin']); page.wait_for_selector('.dialog'); page.wait_for_timeout(300)
    check('ملف أكبر من 3 ميغابايت يُرفض بسبب مذكور', '3 ميغابايت' in page.inner_text('.dialog'), page.inner_text('.dialog'))
    page.click('.dialog button[type=submit]'); page.wait_for_timeout(200)
    # باقية بعد إعادة التحميل (IndexedDB) وفي التصدير
    page.evaluate("Store.flush()"); page.wait_for_timeout(400); page.reload(); page.wait_for_selector('.app-card'); page.wait_for_timeout(600)
    h=page.evaluate("[Addons.get('رفع').files.find(x=>x.name==='mylib/img/red.png').bin, Addons.toPackage(Addons.get('رفع')).files.find(x=>x.name==='mylib/img/red.png').bin]")
    check('الصورة باقية بعد إعادة التحميل وفي حزمة التصدير', h==[True,True], str(h))
    open_admin(page); page.click('[data-act=tab][data-tab=storage]'); page.locator('[data-ex=open][data-folder=رفع]').first.click(); page.wait_for_timeout(200)
    # 2) ملفات متعددة بأسماء عربية داخل مجلد فرعي
    page.locator('[data-ex=opendir][data-dir=mylib]').first.click(); page.wait_for_timeout(200)
    choose(page,'files',['/tmp/upl/loose/ملاحظة.txt','/tmp/upl/loose/two.md']); page.wait_for_timeout(700)
    n=names(page)
    check('رفع ملفات متعددة للمجلد الحالي بأسماء عربية', 'mylib/ملاحظة.txt' in n and 'mylib/two.md' in n, str(n))
    # 3) الاستبدال يطلب تأكيداً
    choose(page,'files',['/tmp/upl/loose/two.md']); page.wait_for_selector('.dialog'); page.wait_for_timeout(300)
    check('تأكيد قبل الاستبدال', 'يستبدل' in page.inner_text('.dialog'), page.inner_text('.dialog'))
    page.click('.dialog button[type=submit]'); page.wait_for_timeout(400)
    # 4) تعارض اسم ملف مع مجلد
    choose(page,'files',['/tmp/upl/c/src']); page.wait_for_timeout(500)
    check('ملف بنفس اسم مجلد موجود يُرفض', 'بنفس الاسم' in (page.inner_text('.dialog') if page.locator('.dialog').count() else ''))
    page.click('.dialog button[type=submit]')
    errs=[e for e in errs if 'serviceWorker' not in e]  # ضجيج وضع حجب Service Worker في الإطارات المعزولة
    check('لا أخطاء JS', not errs, str(errs))
    b.close()
print('FAILED:',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
