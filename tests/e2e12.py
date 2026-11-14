# المنصة والاشتراكات: python3 tests/e2e12.py (خادم الموقع على 8765؛ يشغّل خادم الـ Worker المحلي على 8788)
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; API='http://localhost:8788'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
srv=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8788'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.5)
SIGN="""async (o)=>{const E=new TextEncoder(),b=(u)=>btoa(String.fromCharCode(...u)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
 const k=await crypto.subtle.importKey('jwk',o.priv,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const p=b(E.encode(JSON.stringify(o.pl)));
 return p+'.'+b(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},k,E.encode(p))));}"""
try:
  with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox'])); ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page()
    page.goto(BASE); page.wait_for_selector('#comm-btn')
    kp=page.evaluate("""async()=>{const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
      const pub=await crypto.subtle.exportKey('jwk',k.publicKey);delete pub.key_ops;delete pub.ext;return {pub,priv:await crypto.subtle.exportKey('jwk',k.privateKey)}}""")
    ch={'format':'alaisai-channel','version':1,'seq':5,'updated':1,'contact':{'whatsapp':'967777000111','telegram':'','email':'','facebook':'','note':''},'pub':kp['pub'],'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},
        'addons':{'*':{'state':'on','msg':'','account':False,'sub':True}},'items':[],'api':API,'plans':[{'id':'week','label':'أسبوع','days':7}],'pay':[{'name':'بنك','details':'123456'}],'channels':[{'name':'صفحتي','url':'https://example.com/page'}]}
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(ch)))
    page.reload(); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800)
    # --- المنصة ---
    page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.wait_for_timeout(500)
    check('النافذة السفلية تفتح بحجم افتراضي', page.evaluate("document.querySelector('.comm-sheet').getBoundingClientRect().height")>300)
    g=page.locator('.comm-grab'); g.focus(); h0=page.evaluate("Community.h"); page.keyboard.press('ArrowUp'); check('تكبير النافذة بلوحة المفاتيح/السحب', page.evaluate("Community.h")>h0)
    check('بلا منشورات: رسالة فارغة', 'لا منشورات' in page.inner_text('.comm-body'))
    check('المستخدم العادي لا يرى تبويب المالك', page.locator('.comm-tab[data-v=owner]').count()==0)
    page.click('.comm-tab[data-v=me]'); page.click('[data-c=regtoggle]')
    page.fill('input[name=name]','علي'); page.fill('input[name=ident]','ali@x.com'); page.fill('input[name=password]','secret-pass-1'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('[data-c=compose]')
    check('إنشاء حساب ودخول', 'علي' in page.inner_text('.comm-teaser'))
    check('الرمز غير محفوظ بنص كلمة المرور', 'secret-pass-1' not in json.dumps(page.evaluate("Store.get('comm')")))
    page.click('[data-c=compose]'); page.fill('textarea[name=text]','<img src=x onerror=window.__x=1> أهلاً بالجميع')
    page.click('[data-c=addvid]'); page.wait_for_selector('form.dialog input'); page.fill('form.dialog input','https://example.com/v.mp4'); page.keyboard.press('Enter'); page.wait_for_timeout(200)
    check('خيار القناة الأخرى ظاهر', page.locator('input[name=d_0]').count()==1)
    page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-post'); page.wait_for_timeout(300)
    check('النشر يظهر في الموجز', 'أهلاً بالجميع' in page.inner_text('.comm-post'), page.inner_text('.comm-post'))
    check('النص لا يُنفَّذ كـ HTML (XSS)', page.evaluate("!window.__x && !document.querySelector('.comm-post img[src=x]')"))
    check('الفيديو يُعرض بعنصر video', page.locator('.comm-post video').count()==1)
    page.click('.comm-post [data-k=like]'); page.wait_for_timeout(600); check('التفاعل يُحتسب', page.locator('.comm-post [data-k=like].on').count()==1)
    page.click('.comm-post [data-c=comments]'); page.wait_for_selector('textarea[name=text]'); page.fill('textarea[name=text]','تعليق'); page.click('.comm-form button[type=submit]'); page.wait_for_timeout(600)
    check('التعليق يظهر', 'تعليق' in page.inner_text('#comm-cm'))
    page.click('[data-c=go][data-v=feed]'); 
    page.click('.comm-tab[data-v=chan]'); page.wait_for_selector('.comm-empty'); check('تبويب القناة', 'لا إعلانات' in page.inner_text('#comm-body'))
    page.click('.comm-tab[data-v=mine]'); check('تبويب اشتراكي يعرض المعرّف وطرق الدفع', page.evaluate("Control.st.aid") in page.inner_text('#comm-body') and '123456' in page.inner_text('#comm-body'))
    page.click('.comm-tab[data-v=me]'); check('حسابي يعرض الاسم', 'علي' in page.inner_text('#comm-body'))
    page.click('[data-c=close]'); check('الإغلاق', page.locator('.comm-sheet').count()==0)
    # وضع المالك: مفتاح الخادم محفوظ مشفّراً ⇒ يظهر تبويب المالك وأدوات الإشراف
    page.evaluate("async()=>{const k=await Sync.deviceKey(true);await Store.set('ctrlapi',await Sec.seal(k,'dev-owner-key-0123456789'))}")
    check('isOwner يصبح صحيحاً', page.evaluate("Control.isOwner()"))
    page.click('#comm-btn'); page.wait_for_selector('.comm-tab[data-v=owner]'); page.click('.comm-tab[data-v=owner]'); page.wait_for_selector('form[data-f=official]')
    page.fill('form[data-f=official] textarea','إعلان رسمي'); page.check('form[data-f=official] input[name=pin]'); page.click('form[data-f=official] button[type=submit]'); page.wait_for_selector('.comm-post.official'); page.wait_for_timeout(300)
    check('منشور المالك الرسمي مثبّت في الأعلى', 'رسمي' in page.inner_text('.comm-post.official') and page.locator('.comm-post').first.get_attribute('class').find('official')>=0)
    check('أزرار الإشراف تظهر للمالك', page.locator('.comm-post [data-c=mod]').count()>=1)
    page.click('.comm-post.official [data-op=hide]'); page.wait_for_selector('form.dialog'); page.keyboard.press('Enter'); page.wait_for_timeout(700)
    check('الإخفاء يزيل المنشور الرسمي', page.locator('.comm-post.official').count()==0)
    page.click('[data-c=close]')
    # الشريط العلوي لا يتجاوز الشاشة حتى مع تكبير خط النظام وعرض 320
    p2=br.new_context(viewport={'width':320,'height':700},service_workers='block').new_page(); p2.goto(BASE); p2.wait_for_selector('#comm-btn'); p2.add_style_tag(content='html{font-size:135%}'); p2.wait_for_timeout(300)
    ov=p2.evaluate("({sw:document.documentElement.scrollWidth,iw:innerWidth,out:[...document.querySelectorAll('.bar-actions .icon-btn')].filter(b=>b.offsetParent).filter(b=>{const r=b.getBoundingClientRect();return r.left<-0.5||r.right>innerWidth+0.5}).length})")
    check('لا تجاوز أفقي للشريط (320px وخط 135%)', ov['sw']<=ov['iw'] and ov['out']==0, str(ov))
    # --- الاشتراكات ---
    aid=page.evaluate("Control.st.aid"); check('معرّف حساب محلي', bool(aid) and len(aid)>=10)
    mk=lambda **pl: page.evaluate(SIGN,{'priv':kp['priv'],'pl':dict({'i':'x1','a':'*','u':'م','e':0,'t':1},**pl)})
    r=page.evaluate("(c)=>Control.verifyCode(c,'أي إضافة')", mk(n='other-account-1')); check('رمز مربوط بحساب آخر يُرفض', not r['ok'] and 'حساب آخر' in r['why'], str(r))
    r=page.evaluate("(c)=>Control.verifyCode(c,'أي إضافة')", mk(n=aid)); check('رمز بحسابي يُقبل', r['ok'], str(r))
    r=page.evaluate("(c)=>Control.verifyCode(c,'أي إضافة')", mk(n=aid,e=1000)); check('رمز منتهٍ يُرفض مع رسالة تجديد', not r['ok'] and r.get('expired'), str(r))
    r=page.evaluate("(c)=>Control.verifyCode(c+'x','أي إضافة')", mk(n=aid)); check('توقيع مزوَّر يُرفض', not r['ok'])
    # طلب اشتراك مباشر ثم قبول من المالك عبر API ثم تفعيل تلقائي
    page.evaluate("void Control.subRequest({addon:'إضافة جديدة'})"); page.wait_for_selector('form.ctl-contact')
    check('طرق الدفع تظهر في النموذج', '123456' in page.inner_text('form.ctl-contact'))
    page.fill('form.ctl-contact [name=name]','خالد'); page.fill('form.ctl-contact [name=phone]','777'); page.fill('form.ctl-contact [name=proof]','حوالة 55'); page.click('[data-s=direct]'); page.wait_for_timeout(800)
    rq=page.evaluate("Control.st.rq"); check('الطلب حُفظ محلياً مع مفتاح الاستلام', len(rq)==1)
    code=mk(n=aid,a='إضافة جديدة')
    import urllib.request
    def owner(path,body):
        req=urllib.request.Request(API+path,data=json.dumps(body).encode(),method='POST',headers={'Authorization':'Bearer dev-owner-key-0123456789','Content-Type':'application/json'}); return urllib.request.urlopen(req).status
    check('المالك يقبل الطلب', owner('/v1/admin/subreq/%d'%rq[0]['id'],{'status':'approved','code':code})==200)
    page.evaluate("Control.syncCodes()"); page.wait_for_timeout(800)
    check('التفعيل التلقائي عند المشترك', page.evaluate("!!Control.st.subs['إضافة جديدة']") and page.evaluate("Control.st.rq.length")==0)
    check('البوابة تسمح بعد التفعيل', page.evaluate("Control.gate('إضافة جديدة')"))
    check('إضافة غير مسجّلة بلا رمز تُحجب بالقاعدة الافتراضية', page.evaluate("!!Control.policy('إضافة مستقبلية').sub"))
    page.evaluate("void Control.gate('إضافة مستقبلية')"); page.wait_for_selector('form.dialog'); check('نافذة اشتراك مطلوب تظهر', 'اشتراك مطلوب' in page.inner_text('form.dialog'))
finally: srv.terminate()
print('\nفشل: %d'%len(fails)); sys.exit(1 if fails else 0)
