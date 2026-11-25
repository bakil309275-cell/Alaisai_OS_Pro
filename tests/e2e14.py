# 2.11: شريط الموجز الثابت، تعديل الملف الشخصي، وجهات النشر المتعددة، نافذة الإضافة، صفحات الحسابات
# python3 tests/e2e14.py (خادم الموقع على 8765؛ يشغّل خادم الـ Worker المحلي على 8788)
import sys, os, json, subprocess, time, base64, struct, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; API='http://localhost:8788'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
def png(path):  # صورة PNG صالحة 40×40 بلا مكتبات
    raw=b''.join(b'\x00'+b'\x20\x90\x70'*40 for _ in range(40)); ch=lambda t,d: struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',40,40,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
png('/tmp/av.png')
srv=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8788'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.5)
try:
  with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox'])); ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page()
    ch={'format':'alaisai-channel','version':1,'seq':5,'updated':1,'contact':{'whatsapp':'','telegram':'','email':'','facebook':'','note':''},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[],'api':API,'plans':[],'pay':[],'channels':[]}
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(ch)))
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800)
    page.evaluate("""()=>{Addons.put({name:'الخدمات الزراعية',files:[{name:'manifest.json',content:'{"name":"الخدمات الزراعية","icon":"🌱","version":"1.0.0"}'},{name:'index.html',content:'<main>مرحبا</main>'},{name:'main.js',content:'//'}]},'local');Addons.install('الخدمات الزراعية');OS.renderDesktop()}""")
    # حساب أول: تاجر
    page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.click('.comm-tab[data-v=me]'); page.click('[data-c=regtoggle]')
    page.fill('input[name=name]','علي'); page.fill('input[name=ident]','ali@x.com'); page.fill('input[name=password]','secret-pass-1'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-fbar')
    check('الشريط الثابت: دائرة بالحرف الأول', page.inner_text('.comm-fbar .comm-avb')=='ع')
    check('الشريط يضم الحقل والبحث والمرشحات', all(x in page.inner_text('.comm-fbar') for x in ['بماذا تفكر يا علي','بحث','الكل','الرسمي','الصور']))
    # تعديل الملف الشخصي
    page.click('.comm-tab[data-v=me]'); page.click('[data-c=edit]'); page.wait_for_selector('form[data-f=edit]')
    page.set_input_files('form[data-f=edit] input[name=img]','/tmp/av.png'); page.wait_for_selector('#ed-prev img')
    page.fill('input[name=name]','علي التاجر'); page.select_option('select[name=kind]','business'); page.fill('input[name=email]','ali@shop.com'); page.fill('input[name=phone]','+967 700 111 222'); page.check('input[name=showc]'); page.fill('textarea[name=bio]','توريد أسمدة ومبيدات بأسعار الجملة')
    page.click('form[data-f=edit] button[type=submit]'); page.wait_for_selector('.comm-me'); page.wait_for_timeout(400)
    check('الحفظ يظهر الاسم والنبذة والنوع', all(x in page.inner_text('.comm-me') for x in ['علي التاجر','توريد أسمدة','تاجر']))
    check('صورة الملف الشخصي تظهر في حسابي', page.locator('.comm-me img.comm-av').count()==1)
    page.click('.comm-tab[data-v=feed]'); page.wait_for_selector('.comm-fbar')
    check('الشريط يعرض صورة الملف بدل الحرف', page.locator('.comm-fbar img.comm-av').count()==1)
    check('الصورة تُحمَّل فعلاً من الخادم', page.evaluate("new Promise(r=>{const i=document.querySelector('.comm-fbar img.comm-av');i.complete?r(i.naturalWidth>0):(i.onload=()=>r(true),i.onerror=()=>r(false))})"))
    # صفحات خارجية + وجهات متعددة
    page.click('[data-c=compose]'); page.wait_for_selector('form[data-f=post]')
    page.click('[data-ddt=dest]'); check('القائمة المنسدلة تفتح', page.locator('.comm-ddp:not([hidden])').count()==1)
    check('القائمة تعرض المنصة والإضافة المثبتة', 'منصة العيسائي برو' in page.inner_text('.comm-ddp') and 'الخدمات الزراعية' in page.inner_text('.comm-ddp'))
    page.check('input[data-dk="addon:الخدمات الزراعية"]'); page.wait_for_timeout(150)
    check('القائمة تُغلق بمجرد وضع علامة', page.locator('.comm-ddp:not([hidden])').count()==0)
    check('الاسم المختار يظهر بعلامة ✓', page.locator('.comm-dchip', has_text='الخدمات الزراعية').count()==1 and page.locator('.comm-dchip', has_text='✓').count()==2)
    page.fill('textarea[name=text]','سماد يوريا بسعر خاص'); page.click('[data-ddt=pages]'); page.select_option('select[name=ptype]','facebook'); page.fill('input[name=purl]','http://bad'); page.click('[data-padd]')
    check('رابط غير https يُرفض', page.locator('.comm-dchip', has_text='فيسبوك').count()==0)
    page.fill('input[name=purl]','https://facebook.com/ali.shop'); page.click('[data-padd]'); page.wait_for_selector('.comm-dchip:has-text("فيسبوك")')
    check('الصفحة الخارجية تُضاف إلى الوجهات بعلامة', page.locator('.comm-dchip', has_text='فيسبوك').count()==1 and page.locator('input[data-dk^="page:"]').first.is_checked() if page.locator('input[data-dk^="page:"]').count() else False)
    check('النص لم يضع عند إضافة الصفحة', page.input_value('textarea[name=text]')=='سماد يوريا بسعر خاص')
    page.click('.comm-form button[type=submit]'); page.wait_for_selector('[data-c=ext]')
    t=page.inner_text('#comm-body'); check('نتيجة النشر: المنصة والإضافة وزر الصفحة الخارجية', 'المنصة' in t and 'الخدمات الزراعية' in t and 'فيسبوك' in t)
    page.evaluate("window.__o=[];window.open=(u)=>{window.__o.push(u)};0"); page.click('[data-c=ext]'); check('زر الصفحة الخارجية يفتح رابطها', page.evaluate("window.__o")==['https://facebook.com/ali.shop'])
    check('الصفحات تُحفظ بملفك العام', page.evaluate("Community.st.user.links.length")==1)
    # منشور واحد يصل لجهتين، وآخر للإضافة فقط
    page.click('[data-c=go][data-v=feed]'); page.wait_for_selector('.comm-post'); check('المنشور في المنصة', 'سماد يوريا' in page.inner_text('#comm-list') and 'الخدمات الزراعية' in page.inner_text('.comm-tags'))
    page.click('[data-c=compose]'); page.click('[data-ddt=dest]'); page.uncheck('input[data-dk=platform]'); page.click('[data-ddt=dest]'); page.check('input[data-dk="addon:الخدمات الزراعية"]'); page.fill('textarea[name=text]','عرض حصري لمستخدمي الإضافة'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-dchip'); page.click('[data-c=go][data-v=feed]'); page.wait_for_timeout(500)
    check('المنشور الخاص بالإضافة لا يظهر في المنصة العامة', 'عرض حصري' not in page.inner_text('#comm-list'))
    # الشريط ثابت مع التمرير
    page.evaluate("async()=>{for(let i=0;i<14;i++)await Community.call('/v1/posts',{method:'POST',body:{text:'منشور رقم '+i+' '+'ن'.repeat(120),scopes:['platform']}});}"); 
    page.evaluate("Community.feed=[];Community.load()"); page.wait_for_function("document.querySelectorAll('.comm-post').length>5")
    page.evaluate("document.getElementById('comm-body').scrollTop=900"); page.wait_for_timeout(200)
    r=page.evaluate("(()=>{const b=document.getElementById('comm-body').getBoundingClientRect(),f=document.querySelector('.comm-fbar').getBoundingClientRect();return [Math.round(f.top-b.top),Math.round(f.height)]})()")
    check('الشريط يبقى ثابتاً أعلى النافذة بعد التمرير', abs(r[0])<=1 and r[1]>40, str(r))
    check('الشريط قابل للتمرير أفقياً', page.evaluate("(()=>{const s=document.querySelector('.comm-fscroll');return s.scrollWidth>s.clientWidth&&getComputedStyle(s).overflowX==='auto'})()"))
    # البحث
    page.click('.comm-fbar [data-c=search]'); page.fill('#comm-q','رقم 3'); page.wait_for_timeout(200)
    check('البحث يصفّي المنشورات فوراً', page.locator('.comm-post').count()>=1 and all('رقم 3' in x for x in page.locator('.comm-post .comm-tx').all_inner_texts()))
    page.press('#comm-q','Enter'); page.wait_for_timeout(700); check('Enter يبحث في الخادم', page.locator('.comm-post').count()>=1)
    page.click('.comm-fbar [data-c=search]'); page.wait_for_timeout(700); check('إغلاق البحث يعيد القائمة', page.locator('.comm-post').count()>5)
    page.click('.comm-fbar [data-c=filter][data-k=img]'); check('مرشّح الصور', page.locator('.comm-post').count()==0)
    page.click('.comm-fbar [data-c=filter][data-k=all]')
    page.click('[data-c=close]')
    # نافذة الإضافة
    page.evaluate("OS.openApp(Store.db.registry.find(a=>a.type==='addon'))"); page.wait_for_selector('#addon-comm:not([hidden])')
    page.click('#addon-comm'); page.wait_for_selector('.comm-sheet.over'); page.wait_for_function("document.querySelectorAll('.comm-post').length>=1"); page.wait_for_timeout(300)
    check('عنوان النافذة باسم الإضافة', 'مجتمع الخدمات الزراعية' in page.inner_text('.comm-head'))
    tx=page.locator('.comm-post .comm-tx').all_inner_texts(); check('موجز الإضافة فيه منشوراتها فقط', any('عرض حصري' in x for x in tx) and not any('رقم' in x for x in tx), str(tx))
    check('النافذة فوق مسرح الإضافة', page.evaluate("+getComputedStyle(document.querySelector('.comm-sheet')).zIndex")>1000)
    page.click('.comm-fbar [data-c=scope][data-k=platform]'); page.wait_for_timeout(700); check('التبديل إلى المنصة العامة', page.locator('.comm-post', has_text='رقم').count()>=1)
    page.click('.comm-fbar [data-c=scope]:not([data-k=platform])'); page.wait_for_timeout(500)
    page.click('[data-c=compose]'); check('النشر من الإضافة يختارها افتراضياً', page.locator('.comm-dchip').count()==1 and 'الخدمات الزراعية' in page.inner_text('#cm-chips'))
    page.click('[data-c=close]'); page.click('#close-stage')
    # حساب ثانٍ وصفحة حساب عامة
    page.evaluate("""async()=>{const r=await fetch('http://localhost:8788/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'سعيد',ident:'saeed@x.com',password:'secret-pass-2',did:'did-saeed-test-0001'})});const j=await r.json();
      await fetch('http://localhost:8788/v1/posts',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+j.token},body:JSON.stringify({text:'عرض سعيد',scopes:['platform']})})}""")
    page.click('#comm-btn'); page.wait_for_selector('.comm-post', timeout=8000); page.wait_for_timeout(500)
    page.click('.comm-post:has-text("عرض سعيد") strong.comm-lnk'); page.wait_for_selector('.comm-me'); page.wait_for_timeout(500)
    check('صفحة حساب عامة: اسمه ومنشوراته', 'سعيد' in page.inner_text('.comm-me') and 'عرض سعيد' in page.inner_text('#comm-body'))
    page.click('[data-c=follow]'); page.wait_for_timeout(500); check('المتابعة', 'تتابعه' in page.inner_text('#comm-body'))
    page.click('[data-c=fr][data-op=send]'); page.wait_for_timeout(500); check('طلب الصداقة', 'أُرسل الطلب' in page.inner_text('#comm-body'))
    page.click('[data-c=back]'); page.wait_for_selector('.comm-fbar'); page.click('.comm-fbar [data-c=filter][data-k=following]'); page.wait_for_timeout(700)
    check('موجز المتابَعين يعرض منشورات من تتابعهم', page.locator('.comm-post', has_text='عرض سعيد').count()==1)
    page.click('.comm-tab[data-v=me]'); page.wait_for_selector('.comm-me'); page.wait_for_function("document.getElementById('comm-fr')&&document.getElementById('comm-fr').textContent.includes('الأصدقاء')"); check('قسم الأصدقاء والمجموعات في حسابي', 'الأصدقاء' in page.inner_text('#comm-body') and 'المجموعات الخاصة' in page.inner_text('#comm-body'))
    page.click('[data-c=logout]'); page.wait_for_selector('form[data-f=auth]'); page.click('.comm-tab[data-v=feed]'); page.wait_for_selector('.comm-fbar')
    check('بعد الخروج: دائرة زائر وحقل الدعوة للتسجيل', 'سجّل دخولك' in page.inner_text('.comm-say') and page.locator('[data-k=following]').count()==0)
finally:
  srv.terminate()
print('\nفشل:',fails) if fails else print('\nكل الفحوص نجحت')
sys.exit(1 if fails else 0)
