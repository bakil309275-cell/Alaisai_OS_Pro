# اختبار الإضافات والمتجر والمزامنة (مع خادم GitHub وهمي): python3 tests/e2e2.py
import json, hashlib, base64, sys, re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; PW='Alaisai#2026'; TOKEN='github_pat_testtoken1234567890abcdef'
fails=[]
def check(name, cond, extra=''):
    print(('✓ ' if cond else '✗ ')+name, '' if cond else extra)
    if not cond: fails.append(name)

# ---------- GitHub وهمي ----------
class GH:
    def __init__(s): s.files={}; s.log=[]
    def sha(s,c): return hashlib.sha1(b'blob %d\0'%len(c)+c).hexdigest()  # بصمة Git blob الحقيقية
    def handle(s, route):
        req=route.request; url=req.url.split('api.github.com')[1]; path,_,q=url.partition('?')
        cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,POST,DELETE,OPTIONS','content-type':'application/json'}
        if req.method=='OPTIONS': return route.fulfill(status=204,headers=cors)
        if req.headers.get('authorization')!='Bearer '+TOKEN: return route.fulfill(status=401,headers=cors,body='{}')
        s.log.append((req.method,path))
        m=re.match(r'/repos/me/vault$',path)
        if m: return route.fulfill(status=200,headers=cors,body=json.dumps({'full_name':'me/vault','private':True,'permissions':{'push':True}}))
        if path=='/repos/me/vault/branches/main': return route.fulfill(status=200,headers=cors,body='{}')
        if path.startswith('/repos/me/vault/git/trees/'):
            return route.fulfill(status=200,headers=cors,body=json.dumps({'truncated':False,'tree':[{'path':k,'type':'blob','sha':s.sha(v)} for k,v in s.files.items()]}))
        m=re.match(r'/repos/me/vault/contents/(.+)$',path)
        if m:
            f=m.group(1)
            if req.method=='DELETE':
                b=json.loads(req.post_data)
                if f not in s.files or b.get('sha')!=s.sha(s.files[f]): return route.fulfill(status=409,headers=cors,body='{}')
                del s.files[f]; return route.fulfill(status=200,headers=cors,body='{}')
            if req.method=='GET':
                if f not in s.files: return route.fulfill(status=404,headers=cors,body='{}')
                if 'raw' in req.headers.get('accept',''): return route.fulfill(status=200,headers={**cors,'content-type':'text/plain; charset=utf-8'},body=s.files[f])
                c=s.files[f]; return route.fulfill(status=200,headers=cors,body=json.dumps({'type':'file','sha':s.sha(c),'encoding':'base64','content':base64.encodebytes(c).decode()}))
            if req.method=='PUT':
                b=json.loads(req.post_data); c=base64.b64decode(b['content'])
                if f in s.files and b.get('sha')!=s.sha(s.files[f]): return route.fulfill(status=409,headers=cors,body='{"message":"sha mismatch"}')
                if f not in s.files and b.get('sha'): return route.fulfill(status=422,headers=cors,body='{}')
                s.files[f]=c; return route.fulfill(status=200,headers=cors,body=json.dumps({'content':{'sha':s.sha(c)}}))
        route.fulfill(status=404,headers=cors,body='{}')

def dialog_pw(page, pw=PW):
    page.wait_for_selector('.dialog'); page.fill('.dialog input[type=password]',pw); page.keyboard.press('Enter')
def open_admin(page):
    page.click('#admin-gate'); page.wait_for_timeout(500)
    if page.locator('.dialog input[name=p1]').count():
        page.fill('input[name=p1]',PW); page.fill('input[name=p2]',PW); page.keyboard.press('Enter')
    elif page.locator('.dialog input[type=password]').count(): dialog_pw(page)
    page.wait_for_selector('.tabs',timeout=8000)

with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':1100,'height':800},accept_downloads=True)
    gh=GH(); ctx.route('https://api.github.com/**',gh.handle)
    page=ctx.new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(600)

    # ===== الإضافات =====
    open_admin(page); page.click('[data-act=tab][data-tab=storage]')
    page.click('[data-ex=newaddon]'); page.fill('input[name=name]','demo'); page.keyboard.press('Enter'); page.wait_for_timeout(500)
    check('أُنشئت إضافة بملفاتها الأربعة', page.locator('.file-item .name').count()==4)
    page.click('[data-ex=preview]'); page.wait_for_timeout(800)
    fr=page.frame_locator('#addon-preview iframe')
    check('المعاينة تعمل وAlaisai.set يعدّ الفتح', fr.locator('#n').inner_text(timeout=4000)=='1')
    page.click('[data-ex=install]'); page.wait_for_timeout(400)
    page.click('#close-stage'); check('الإضافة ظهرت على سطح المكتب', page.locator('.app-card:has-text("demo")').count()==1)
    page.locator('.app-card:has-text("demo")').click(); page.wait_for_timeout(800)
    check('التطبيق المثبّت يعمل ويتذكّر العدّاد', page.frame_locator('.app-frame').locator('#n').inner_text(timeout=4000)=='2')
    page.frame_locator('.app-frame').locator('#btn').click(); page.wait_for_timeout(300)
    check('إشعار الإضافة وصل للنظام', 'تعمل الإضافة' in page.inner_text('#toast-wrap'))
    check('إطار الإضافة معزول', 'allow-same-origin' not in page.get_attribute('.app-frame','sandbox'))
    page.keyboard.press('Escape')

    # تصدير ثم حذف ثم استيراد
    open_admin(page); page.click('[data-act=tab][data-tab=storage]'); page.locator('[data-ex=open][data-folder=demo]').first.click()
    with page.expect_download() as d: page.click('[data-ex=exportaddon]')
    pkg=json.load(open(d.value.path())); check('حزمة التصدير صحيحة', pkg['format']=='alaisai-addon' and pkg['id']=='demo' and len(pkg['files'])==4)
    page.click('[data-ex=deladdon]'); page.click('.dialog button[type=submit]'); page.wait_for_timeout(400)
    check('الحذف أزال الأيقونة أيضاً', page.locator('.app-card:has-text("demo")').count()==0)
    with page.expect_file_chooser() as fc: page.click('[data-ex=importaddon]')
    fc.value.set_files(d.value.path()); page.wait_for_timeout(700)
    check('الاستيراد أعاد الإضافة', page.locator('.file-item .name').count()==4)
    bad=json.dumps({'format':'alaisai-addon','version':1,'id':'../x','files':[]}); open('/tmp/claude-0/badaddon.json','w').write(bad)
    page.click('[data-ex=root]')
    with page.expect_file_chooser() as fc: page.click('[data-ex=importaddon]')
    fc.value.set_files('/tmp/claude-0/badaddon.json'); page.wait_for_timeout(500)
    check('حزمة خبيثة المعرّف تُرفض', 'معرّف' in page.inner_text('#toast-wrap'))
    page.keyboard.press('Escape')

    # ===== المتجر =====
    page.click('#store-btn'); page.wait_for_selector('[data-cat=calculator]')
    N=len(json.load(open('catalog/index.json'))['addons']); check('الكتالوج يعرض كل الإضافات المبنية (%d)'%N, page.locator('[data-cat]').count()==N, str(page.locator('[data-cat]').count()))
    page.click('[data-cat=calculator]'); page.wait_for_timeout(1200)
    check('تثبيت الحاسبة من المتجر', 'مثبّتة' in page.inner_text('#cat-list'))
    page.keyboard.press('Escape'); page.locator('.app-card:has-text("الحاسبة")').click(); page.wait_for_timeout(800)
    f=page.frame_locator('.app-frame')
    for k in ['7','×','8','=']: f.locator('#keys button',has_text=re.compile('^'+re.escape(k)+'$')).first.click()
    check('الحاسبة: 7×8=56', f.locator('#out').inner_text()=='56', f.locator('#out').inner_text())
    page.screenshot(path='/tmp/claude-0/shots/calc.png'); page.click('#close-stage')
    page.click('#store-btn'); page.wait_for_selector('[data-cat=todo]'); page.click('[data-cat=todo]'); page.wait_for_timeout(1000); page.keyboard.press('Escape')
    page.locator('.app-card:has-text("المهام")').click(); page.wait_for_timeout(700)
    f=page.frame_locator('.app-frame'); f.locator('#in').fill('اشتري خبزاً'); f.locator('#f button').click(); page.wait_for_timeout(300)
    page.keyboard.press('Escape'); page.wait_for_timeout(500); page.reload(); page.wait_for_selector('.app-card')
    page.locator('.app-card:has-text("المهام")').click(); page.wait_for_timeout(900)
    check('المهام تبقى بعد إعادة التحميل', 'اشتري خبزاً' in page.frame_locator('.app-frame').locator('#list').inner_text())
    page.keyboard.press('Escape')

    # ===== روابط مباشرة =====
    page.goto(BASE+'?app=notes'); page.wait_for_selector('.notes'); check('رابط مباشر ?app=notes', True)
    page.goto(BASE+'?store=1'); page.wait_for_selector('#cat-list'); check('رابط مباشر ?store=1', True); page.keyboard.press('Escape')

    # ===== مزامنة GitHub =====
    page.goto(BASE); page.wait_for_selector('.app-card')
    page.get_by_text('الملاحظات').first.click(); page.wait_for_selector('.notes'); page.click('[data-new]'); page.fill('[data-title]','سري'); page.fill('[data-body]','نص-سري-للغاية-12345'); page.wait_for_timeout(1200); page.keyboard.press('Escape')
    open_admin(page); page.click('[data-act=tab][data-tab=sync]'); page.click('[data-sy=setup]'); page.wait_for_selector('.dialog input[name=owner]')
    page.fill('input[name=owner]','me'); page.fill('input[name=repo]','vault'); page.fill('input[name=token]',TOKEN); page.fill('input[name=pass]','عبارة-التشفير-1'); page.keyboard.press('Enter'); page.wait_for_timeout(1500)
    check('إعداد المزامنة واختبار الاتصال', 'ناجح' in page.inner_text('#toast-wrap') or page.locator('[data-sy=push]').count()==1)
    check('شارة المزامنة ظهرت', page.locator('#sync-badge:not([hidden])').count()==1)
    page.click('[data-sy=push]'); page.wait_for_timeout(2000)
    f='alaisai-backup.json'; check('رُفع ملف إلى المستودع', f in gh.files)
    remote=gh.files.get(f,b'').decode(); check('المحتوى المرفوع مشفّر (لا نص صريح)', 'نص-سري' not in remote and 'سري' not in remote and '"encrypted": true' in remote.replace('":true','": true') or '"encrypted":true' in remote)
    st=page.evaluate("[Sync.state, !!Sync.cfg.lastSha]"); check('الحالة متزامن', st[0]=='idle' and st[1], str(st))
    # الرمز غير مخزّن نصاً
    dump=page.evaluate("""()=>new Promise(r=>{const q=indexedDB.open('alaisai_os');q.onsuccess=()=>{const t=q.result.transaction('kv').objectStore('kv');const o={};const c=t.openCursor();c.onsuccess=e=>{const cur=e.target.result;if(cur){try{o[cur.key]=JSON.stringify(cur.value)}catch(_){o[cur.key]='[CryptoKey]'};cur.continue()}else r(o)}}})""")
    alltext=json.dumps(dump,ensure_ascii=False); check('الرمز وعبارة التشفير غير موجودين نصاً في التخزين', TOKEN not in alltext and 'عبارة-التشفير-1' not in alltext)
    check('نسخ التصدير لا تحوي إعدادات المزامنة', 'github_pat' not in json.dumps(page.evaluate("Store.exportPayload()")))
    # تعارض: جهاز آخر غيّر السحابة
    other=json.loads(gh.files[f]); gh.files[f]=json.dumps(other).encode()+b' '
    page.evaluate("Store.db.notes.push({id:'zz',title:'محلية',body:'x',updated:Date.now()}); Store.save()"); page.wait_for_timeout(500)
    page.click('[data-sy=push]'); page.wait_for_selector('.dialog select[name=c]',timeout=6000); check('اكتشاف التعارض', True)
    page.select_option('select[name=c]','push'); page.click('.dialog button[type=submit]'); page.wait_for_timeout(2000)
    check('حلّ التعارض برفع نسخة الجهاز', page.evaluate("Sync.state")=='idle', page.evaluate("Sync.state"))
    # سحب: تغيير بيانات محلياً ثم السحب من السحابة يعيد الحالة
    page.evaluate("Store.db.notes=[]; Store.save()"); page.wait_for_timeout(600)
    with page.expect_navigation(timeout=20000):
        page.click('[data-sy=pull]'); page.wait_for_timeout(400)
        if page.locator('.dialog input[type=password]').count(): dialog_pw(page)
        page.wait_for_selector('.dialog h3:has-text("سحب")',timeout=8000); page.click('.dialog button[type=submit]')
    page.wait_for_selector('.app-card'); page.wait_for_timeout(800)
    check('السحب أعاد الملاحظات من السحابة', page.evaluate("Store.db.notes.length")>=2, str(page.evaluate("Store.db.notes.length")))
    check('كلمة المرور المحلية باقية بعد السحب', page.evaluate("!!Store.db.config.passHash"))
    # المزامنة التلقائية
    open_admin(page); page.click('[data-act=tab][data-tab=sync]'); page.click('[data-sy=auto]'); page.wait_for_timeout(500)
    if page.locator('.dialog input[type=password]').count(): dialog_pw(page); page.wait_for_timeout(500)
    check('تفعيل التلقائية', page.evaluate("Sync.cfg.auto")==True)
    before=len([l for l in gh.log if l[0]=='PUT']); page.keyboard.press('Escape')
    page.evaluate("Store.db.notes.push({id:'auto1',title:'تلقائي',body:'y',updated:Date.now()}); Store.save(); Sync.scheduleAuto(300)"); page.wait_for_timeout(5500)
    check('الرفع التلقائي حدث', len([l for l in gh.log if l[0]=='PUT'])>before, str(gh.log[-4:]))
    # ===== ملفات الإضافات ↔ المستودع =====
    page.evaluate("Sync.cfg.auto=false"); page.wait_for_timeout(300)
    page.evaluate("Sync.syncAddons()"); page.wait_for_timeout(2500)
    check('نُشرت ملفات الإضافة المحلية في addons/ بالمستودع', all(('addons/demo/'+n) in gh.files for n in ['manifest.json','index.html','main.js','style.css']), str([k for k in gh.files if k.startswith('addons')]))
    check('ملفات الإضافة في المستودع نص عادي مطابق', b'Alaisai' in gh.files.get('addons/demo/main.js',b''))
    gh.files['addons/fromrepo/manifest.json']=json.dumps({'id':'fromrepo','name':'من المستودع','icon':'📦','version':'1.0.0','description':'وُضعت في المستودع'},ensure_ascii=False).encode()
    gh.files['addons/fromrepo/index.html']='<main><h1 id="t">نسخة 1</h1></main>'.encode()
    page.evaluate("Sync.check()"); page.wait_for_timeout(2500)
    check('اكتشاف إضافة جديدة من المستودع', page.evaluate("RepoAddons.items.some(i=>i.name==='fromrepo'&&i.state==='new')"), page.evaluate("JSON.stringify(RepoAddons.items.map(i=>[i.name,i.state]))"))
    check('الإضافة الجديدة لم تُثبَّت تلقائياً', page.evaluate("!Addons.get('fromrepo')"))
    page.keyboard.press('Escape'); page.click('#store-btn'); page.wait_for_selector('[data-repo=fromrepo]',timeout=6000)
    check('المتجر يعرض إضافة المستودع باسمها وشارة «جديد»', 'من المستودع' in page.inner_text('#cat-list') and 'جديد' in page.inner_text('#cat-list'))
    page.click('[data-repo=fromrepo]'); page.wait_for_timeout(1500)
    check('تثبيت إضافة المستودع', page.evaluate("Addons.isInstalled('fromrepo')"))
    page.keyboard.press('Escape'); page.locator('.app-card:has-text("من المستودع")').click(); page.wait_for_timeout(800)
    check('إضافة المستودع تعمل', page.frame_locator('.app-frame').locator('#t').inner_text(timeout=4000)=='نسخة 1'); page.keyboard.press('Escape')
    gh.files['addons/fromrepo/index.html']='<main><h1 id="t">نسخة 2</h1></main>'.encode()
    page.evaluate("Sync.check()"); page.wait_for_timeout(3000)
    check('تحديث المستودع يصل تلقائياً للإضافة المثبّتة', 'نسخة 2' in page.evaluate("Addons.get('fromrepo').files.find(f=>f.name==='index.html').content"))
    def store_delete(name):
        page.click('#store-btn'); page.wait_for_selector('[data-del=%s]'%name); page.click('[data-del=%s]'%name)
        page.wait_for_selector('.dialog button[type=submit]'); page.click('.dialog button[type=submit]'); page.wait_for_timeout(500)
        if page.locator('.dialog input[type=password]').count(): dialog_pw(page); page.wait_for_timeout(1500)
        page.wait_for_timeout(1500)
    # «حذف» = إزالة من سطح المكتب فقط، وتبقى قابلة للتثبيت
    page.click('#store-btn'); page.wait_for_selector('[data-uninst=fromrepo]'); page.click('[data-uninst=fromrepo]'); page.wait_for_timeout(500)
    check('«حذف» أزال الأيقونة وأبقى الإضافة وملفاتها', page.evaluate("!Addons.isInstalled('fromrepo') && !!Addons.get('fromrepo')") and page.locator('.app-card:has-text("من المستودع")').count()==0)
    check('بعد «حذف» تبقى قابلة للتثبيت في المتجر', page.locator('[data-repo=fromrepo]').count()==1 and page.locator('[data-uninst=fromrepo]').count()==0)
    page.click('[data-repo=fromrepo]'); page.wait_for_timeout(1200)
    check('إعادة التثبيت تعمل', page.evaluate("Addons.isInstalled('fromrepo')"))
    # «تراجع» في الحذف النهائي لا يحذف شيئاً
    page.click('[data-del=fromrepo]'); page.wait_for_selector('.dialog [data-cancel]'); check('نص التحذير يذكر عدم القابلية للتثبيت', 'لن تعود قابلة للتثبيت' in page.inner_text('.dialog'))
    page.click('.dialog [data-cancel]'); page.wait_for_timeout(400)
    check('التراجع أبقى الإضافة وملفاتها في المستودع', page.evaluate("!!Addons.get('fromrepo')") and any(k.startswith('addons/fromrepo/') for k in gh.files))
    page.keyboard.press('Escape')
    store_delete('fromrepo')
    check('الحذف النهائي أزال الإضافة وأيقونتها محلياً', page.evaluate("!Addons.get('fromrepo')") and page.locator('.app-card:has-text("من المستودع")').count()==0)
    check('الحذف النهائي حذف ملفاتها من المستودع فوراً', not any(k.startswith('addons/fromrepo/') for k in gh.files), str([k for k in gh.files if k.startswith('addons')]))
    check('لم يُحذف شيء آخر من المستودع', all(('addons/demo/'+n) in gh.files for n in ['manifest.json','index.html','main.js','style.css']) and 'alaisai-backup.json' in gh.files)
    page.keyboard.press('Escape')
    # حذفها من المستودع يدوياً (من GitHub) لا يُعيد رفعها: تظهر «محذوفة من المستودع»
    for k in [k for k in gh.files if k.startswith('addons/demo/')]: del gh.files[k]
    page.evaluate("Sync.syncAddons()"); page.wait_for_timeout(2500)
    check('لا إعادة رفع لما حُذف من المستودع عمداً', not any(k.startswith('addons/demo/') for k in gh.files), str([k for k in gh.files if k.startswith('addons')]))
    check('الإضافة تظهر بحالة «gone» وتبقى محلياً', page.evaluate("RepoAddons.items.some(i=>i.name==='demo'&&i.state==='gone')") and page.evaluate("!!Addons.get('demo')"))
    page.click('#store-btn'); page.wait_for_selector('[data-republish=demo]'); check('المتجر يعرض شارة المحذوفة وزر إعادة النشر', 'محذوفة من المستودع' in page.inner_text('#cat-list'))
    page.click('[data-republish=demo]'); page.wait_for_timeout(2500)
    check('إعادة النشر أعادت الملفات', all(('addons/demo/'+n) in gh.files for n in ['manifest.json','index.html','main.js','style.css']))
    page.keyboard.press('Escape')
    page.evaluate("Sync.push({auto:true})"); page.wait_for_timeout(3000)
    # حذف محلي من المستكشف (المسار القديم) تحذف مزامنته ملفات addons/ أيضاً
    page.evaluate("Addons.remove('demo')"); page.evaluate("Sync.push({auto:true})"); page.wait_for_timeout(3000)
    check('الحذف المحلي حذف الملفات من addons/ في المستودع بعد المزامنة', not any(k.startswith('addons/demo/') for k in gh.files), str([k for k in gh.files if k.startswith('addons')]))
    # عبارة خاطئة
    page.evaluate("Sync.pass='خطأ-خطأ-خطأ'")
    try: page.evaluate("Sync.fetchRemote()"); ok=False
    except Exception as e: ok='عبارة' in str(e)
    check('عبارة تشفير خاطئة تُرفض بوضوح', ok)
    check('لا أخطاء JavaScript غير ملتقطة', not errs, str(errs))
    b.close()
print('\nFAILED:',fails) if fails else print('\nكل اختبارات الإضافات والمزامنة نجحت')
sys.exit(1 if fails else 0)
