# 2.12: تجاوز الروابط المحجوبة + تشخيص الاتصال + المجموعات الخاصة (واجهة) + مطابقة الإصدار
# python3 tests/e2e15.py (خادم الموقع 8765؛ يشغّل خادم Worker المحلي 8788)
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; API='http://localhost:8788'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
srv=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8788'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.5)
def chan(api, apis=None):
    c={'format':'alaisai-channel','version':1,'seq':5,'updated':1,'contact':{},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[],'api':api,'plans':[],'pay':[],'channels':[]}
    if apis: c['apis']=apis
    return json.dumps(c)
try:
  with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox']))
    # 1) الرابط الأساسي محجوب والبديل يعمل: يتصل تلقائياً
    ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page(); body={'v':chan('http://localhost:9',[API])}
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=body['v']))
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800); page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.wait_for_function("document.querySelector('#comm-chip')&&document.querySelector('#comm-chip').textContent.includes('متصل')", timeout=20000)
    check('الرابط الأساسي محجوب فيتصل بالبديل تلقائياً', 'غير' not in page.inner_text('#comm-chip') and page.evaluate("Control.api()")==API)
    page.close(); ctx.close()
    # 2) كل الروابط محجوبة: رسالة وتشخيص
    ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page()
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=chan('http://localhost:9')))
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800); page.click('#comm-btn'); page.wait_for_selector('[data-c=diag]', timeout=20000)
    page.click('[data-c=diag]'); page.wait_for_selector('.dialog-overlay'); page.wait_for_function("document.querySelector('.dialog-msg')&&document.querySelector('.dialog-msg').textContent.includes('🔴')", timeout=20000)
    t=page.inner_text('.dialog-msg'); check('التشخيص يذكر الرابط المحجوب وسببه المحتمل', 'localhost:9' in t and 'يحجب' in t, t)
    page.click('.dialog-overlay [data-cancel], .dialog-overlay button'); page.close(); ctx.close()
    # 3) المجموعات
    ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page()
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=chan(API)))
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800); page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.click('.comm-tab[data-v=me]'); page.click('[data-c=regtoggle]')
    page.fill('input[name=name]','علي'); page.fill('input[name=ident]','ali@x.com'); page.fill('input[name=password]','secret-pass-1'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-fbar')
    me=page.evaluate("Community.st.user.id")
    bt=page.evaluate("""async()=>{const r=await fetch('http://localhost:8788/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'سعيد',ident:'saeed@x.com',password:'secret-pass-2',did:'did-saeed-test-0001'})});return await r.json()}""")
    H=lambda t:{'content-type':'application/json','authorization':'Bearer '+t}
    page.evaluate("async([b,me])=>{await fetch('http://localhost:8788/v1/friend/'+me,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+b.token},body:JSON.stringify({op:'send'})})}",[bt,me])
    page.click('.comm-tab[data-v=me]'); page.wait_for_selector('[data-c=fr][data-op=accept]'); page.click('[data-c=fr][data-op=accept]'); page.wait_for_timeout(600)
    check('قسم المجموعات الخاصة ظاهر', page.locator('#comm-grp [data-c=gnew]').count()==1)
    page.click('[data-c=gnew]'); page.wait_for_selector('.dialog-overlay'); page.fill('.dialog-overlay input >> nth=0','عملاء الأسمدة'); page.click('.dialog-overlay button[type=submit]'); page.wait_for_selector('#comm-grp .admin-row'); 
    check('المجموعة تظهر في قائمتي', 'عملاء الأسمدة' in page.inner_text('#comm-grp'))
    page.click('#comm-grp [data-c=grp]'); page.wait_for_selector('[data-c=gop][data-op=invite]'); page.click('[data-c=gop][data-op=invite]'); page.wait_for_timeout(600)
    check('دعوة صديق وانتظار قبوله', 'بانتظار القبول' in page.inner_text('#comm-body') and 'سعيد' in page.inner_text('#comm-body'))
    gid=page.evaluate("Community.gid")
    page.evaluate("async([b,g])=>{await fetch('http://localhost:8788/v1/groups/'+g,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+b.token},body:JSON.stringify({op:'accept'})})}",[bt,gid])
    page.click('[data-c=back]'); page.wait_for_selector('#comm-grp'); page.wait_for_timeout(400)
    page.click('#comm-grp [data-c=scope]'); page.wait_for_selector('.comm-fbar'); page.wait_for_timeout(600)
    check('شريط الموجز يعرض المجموعة بقفل', '🔒 عملاء الأسمدة' in page.inner_text('.comm-fbar'))
    page.click('.comm-fbar [data-c=compose]'); page.wait_for_selector('form[data-f=post]')
    check('الوجهة الافتراضية هي المجموعة', page.locator('.comm-dchip').count()==1 and 'عملاء الأسمدة' in page.inner_text('#cm-chips'))
    page.click('[data-ddt=dest]'); page.check('input[data-dk=platform]'); page.wait_for_timeout(150)
    check('اختيار المنصة يزيل المجموعة (لا يُنشر معها)', page.locator('.comm-dchip').count()==1 and 'منصة العيسائي' in page.inner_text('#cm-chips') and 'عملاء' not in page.inner_text('#cm-chips'))
    page.click('[data-ddt=dest]'); page.check('input[data-dk^="group:"]'); page.wait_for_timeout(150)
    page.fill('textarea[name=text]','عرض سري للعملاء: خصم 20%'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-dchip'); page.click('[data-c=go][data-v=feed]'); page.wait_for_selector('.comm-post')
    check('المنشور يظهر في موجز المجموعة', 'عرض سري' in page.inner_text('#comm-list') and '🔒' in page.inner_text('.comm-tags'))
    page.click('.comm-fbar [data-c=scope][data-k=platform]') if page.locator('.comm-fbar [data-c=scope][data-k=platform]').count() else page.evaluate("Community.scope='platform';Community.feed=[];Community.load()")
    page.wait_for_timeout(900); check('ولا يظهر في المنصة العامة', 'عرض سري' not in page.inner_text('#comm-list'))
    bfeed=page.evaluate("async([b,g])=>{const r=await fetch('http://localhost:8788/v1/posts?scope=group:'+g,{headers:{authorization:'Bearer '+b.token}});return (await r.json()).posts.map(p=>p.text)}",[bt,gid])
    check('العضو المدعو يرى منشور المجموعة', bfeed==['عرض سري للعملاء: خصم 20%'], str(bfeed))
    out=page.evaluate("async(g)=>{const r=await fetch('http://localhost:8788/v1/posts?scope=group:'+g);return r.status}",gid); check('الغريب يُرفض', out==403)
    page.click('[data-c=close]'); page.close(); ctx.close()
finally:
  srv.terminate()
print('\nفشل:',fails) if fails else print('\nكل الفحوص نجحت')
sys.exit(1 if fails else 0)
