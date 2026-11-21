# 2.13: رفع أي ملف/فيديو (D1 قطعاً + R2)، حذف الحساب، صلاحيات المالك، حماية إضافات المالك
# python3 tests/e2e16.py (خادم الموقع 8765؛ يشغّل خادمي Worker محليين 8788 (D1) و8789 (R2))
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; fails=[]; OWN='dev-owner-key-0123456789'
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
s1=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8788'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
s2=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8789'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=dict(os.environ,R2='1')); time.sleep(1.5)
import urllib.request
def r2on():
    rq=urllib.request.Request('http://localhost:8789/v1/admin/storage',data=json.dumps({'on':True}).encode(),headers={'authorization':'Bearer '+OWN,'content-type':'application/json'},method='POST'); urllib.request.urlopen(rq).read()
r2on()
def chan(api):
    return json.dumps({'format':'alaisai-channel','version':1,'seq':5,'updated':1,'contact':{},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[],'api':api,'plans':[],'pay':[],'channels':[]})
def opensheet(br, api, ident):
    ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block',accept_downloads=True); page=ctx.new_page()
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=chan(api)))
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800); page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.click('.comm-tab[data-v=me]'); page.click('[data-c=regtoggle]')
    page.fill('input[name=name]','مصور'); page.fill('input[name=ident]',ident); page.fill('input[name=password]','secret-pass-1'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-fbar')
    return ctx,page
def compose(page):
    page.click('.comm-fbar [data-c=compose]'); page.wait_for_selector('form[data-f=post]'); page.click('[data-ddt=dest]'); page.check('input[data-dk=platform]'); page.click('[data-ddt=dest]')
try:
  with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox']))
    # --- D1: ملف 600KB على 3 قطع
    ctx,page=opensheet(br,'http://localhost:8788','up1@x.com'); compose(page)
    check('زر رفع ملف أو فيديو موجود', page.locator('input[name=file]').count()==1 and page.locator('input[name=file]').get_attribute('accept') is None)
    data=bytes((i%251) for i in range(600000))
    page.set_input_files('input[name=file]', files=[{'name':'قائمة الأسعار.zip','mimeType':'application/zip','buffer':data}]); page.wait_for_selector('.comm-th', timeout=20000)
    check('المرفق يظهر بالاسم والحجم', 'قائمة الأسعار' in page.inner_text('.comm-thumbs') and 'ك.ب' in page.inner_text('.comm-thumbs') or 'م.ب' in page.inner_text('.comm-thumbs'), page.inner_text('.comm-thumbs'))
    page.set_input_files('input[name=file]', files=[{'name':'bad.exe','mimeType':'application/x-msdownload','buffer':b'MZ'+b'0'*50}]); page.wait_for_timeout(1200)
    check('الملف التنفيذي يُرفض برسالة', page.locator('.comm-th').count()==1 and page.locator('.toast, [role=status]').filter(has_text='غير مسموح').count()>=1)
    page.fill('textarea[name=text]','قائمة الأسعار الجديدة'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-dchip'); page.click('[data-c=go][data-v=feed]'); page.wait_for_selector('.comm-file', timeout=10000)
    check('بطاقة الملف في الموجز مع زر تنزيل', 'قائمة الأسعار.zip' in page.inner_text('.comm-file') and page.locator('[data-c=fdl]').count()==1)
    with page.expect_download(timeout=20000) as dl: page.click('[data-c=fdl]')
    d=dl.value; pth=d.path(); got=open(pth,'rb').read(); check('التنزيل يعيد الملف مطابقاً بايتاً ببايت', got==data and d.suggested_filename=='قائمة الأسعار.zip', str(len(got)))
    # --- حذف الحساب
    page.click('.comm-tab[data-v=me]'); page.click('[data-c=edit]'); page.wait_for_selector('[data-c=delacc]'); check('زر حذف الحساب ضمن تعديل الملف الشخصي', True)
    page.click('[data-c=delacc]'); page.wait_for_selector('.dialog-overlay'); page.click('.dialog-overlay button[type=submit], .dialog-overlay [data-ok]'); page.wait_for_selector('.dialog-overlay input[type=password]')
    page.fill('.dialog-overlay input[type=password]','wrong-pass-12'); page.click('.dialog-overlay button[type=submit]'); page.wait_for_timeout(900)
    check('كلمة مرور خاطئة لا تحذف', page.evaluate("!!Community.st.user"))
    if page.locator('.dialog-overlay input[type=password]').count()==0:
        page.click('[data-c=delacc]'); page.wait_for_selector('.dialog-overlay'); page.click('.dialog-overlay button[type=submit], .dialog-overlay [data-ok]'); page.wait_for_selector('.dialog-overlay input[type=password]')
    page.fill('.dialog-overlay input[type=password]','secret-pass-1'); page.click('.dialog-overlay button[type=submit]'); page.wait_for_timeout(1500)
    check('بعد الحذف يخرج الحساب من الجهاز', page.evaluate("!Community.st.user"))
    r=page.evaluate("async()=>{const r=await fetch('http://localhost:8788/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ident:'up1@x.com',password:'secret-pass-1'})});return r.status}")
    check('الدخول بالحساب المحذوف مرفوض من الخادم', r==401)
    page.close(); ctx.close()
    # --- R2: فيديو مباشر + صلاحيات المالك
    ctx,page=opensheet(br,'http://localhost:8789','up2@x.com'); compose(page)
    page.set_input_files('input[name=file]', files=[{'name':'clip.mp4','mimeType':'video/mp4','buffer':b'\x00\x00\x00\x18ftypmp42'+b'0'*5000}]); page.wait_for_selector('.comm-th', timeout=20000)
    page.fill('textarea[name=text]','فيديو المنتج'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-dchip'); page.click('[data-c=go][data-v=feed]'); page.wait_for_selector('video.comm-vid', timeout=10000)
    check('فيديو R2 يُعرض بمشغّل مباشر', page.get_attribute('video.comm-vid','src').startswith('http://localhost:8789/v1/files/'))
    check('زر حذف المنشور للمالك مخفي عن العميل', page.locator('[data-op=delpost]').count()==0)
    page.evaluate("Community.owner=%s;Community.render()"%json.dumps(OWN)); page.wait_for_selector('[data-op=delpost]')
    page.click('[data-op=delpost]'); page.wait_for_selector('.dialog-overlay'); page.click('.dialog-overlay button[type=submit], .dialog-overlay [data-ok]'); page.wait_for_timeout(1500)
    n=page.evaluate("async()=>(await (await fetch('http://localhost:8789/v1/posts')).json()).posts.length"); check('المالك حذف المنشور نهائياً', n==0, str(n))
    page.close(); ctx.close()
    # --- حماية إضافات المالك
    ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page(); page.goto(BASE); page.wait_for_function("window.Addons&&window.Store&&Store.db"); page.wait_for_timeout(500)
    r=page.evaluate("""async()=>{Addons.put({name:'إضافة المالك',files:Addons.template('إضافة المالك')},'catalog');Addons.put({name:'إضافتي',files:Addons.template('إضافتي')},'local');
      return [await Addons.canDelete('إضافة المالك'), await Addons.canDelete('إضافتي'), Addons.isOwnerAddon('إضافة المالك')]}""")
    check('العميل: لا حذف لإضافة المالك ويحذف إضافته', r==[False,True,True], str(r))
    try: page.evaluate("RepoAddons.purge('إضافة المالك')"); ok=False
    except Exception as e: ok='للمالك' in str(e)
    check('purge يرفض إضافة المالك للعميل', ok and page.evaluate("!!Addons.get('إضافة المالك')"))
    page.close(); ctx.close(); br.close()
finally:
  s1.kill(); s2.kill()
print('e2e16: fails=%d'%len(fails)); sys.exit(1 if fails else 0)
