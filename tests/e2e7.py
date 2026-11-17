# الواجهة الخلفية والتفاعل: python3 tests/e2e7.py (يتطلب خادماً على 8765 و node 22 للخلفية)
import sys,json,time,subprocess,os
from playwright.sync_api import sync_playwright
import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from seed import seeded
BASE='http://localhost:8765/index.html'; API='http://localhost:8788'; fails=[]; KEY='dev-owner-key-0123456789'
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
srv=subprocess.Popen(['node','tools/worker/serve.mjs','8788'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env={**os.environ,'OWNER_KEY':KEY}); srv.stdout.readline()
now=int(time.time()*1000)
chan={'format':'alaisai-channel','version':1,'seq':1,'updated':now,'api':API,'contact':{'whatsapp':'967777000000','telegram':'','email':'','facebook':'','note':''},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[{'id':'a1','kind':'post','title':'منشور','body':'نص','link':'','aud':'all','level':'info','created':now,'expires':0,'pin':False}]}
def route(r): r.fulfill(status=200,content_type='application/json',body=json.dumps(chan))
try:
  with sync_playwright() as p:
    b=seeded(p.chromium.launch(args=['--no-sandbox']))
    def newpage():
        ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); ctx.route('**/control/channel.json*',route); pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(BASE); pg.wait_for_selector('.app-card'); pg.wait_for_timeout(1500); return pg
    errs=[]; A=newpage(); B=newpage()
    check('الجهازان سُجّلا في الخلفية', A.evaluate("Control.st.users")>=2 or B.evaluate("Control.st.users")>=2, str(A.evaluate("Control.st")))
    A.locator('#news-btn').click(); A.wait_for_selector('.ctl-rx'); 
    A.locator('.rx[data-k=like]').click(); A.wait_for_timeout(700)
    check('يظهر تفاعلي فوراً', A.locator('.rx[data-k=like].on').count()==1 and A.locator('.rx[data-k=like] span').inner_text()=='1', A.locator('.ctl-rx').inner_text())
    B.locator('#news-btn').click(); B.wait_for_selector('.ctl-rx'); B.wait_for_timeout(900)
    check('الجهاز الآخر يرى العدّاد العام', B.locator('.rx[data-k=like] span').inner_text()=='1', B.locator('.ctl-rx').inner_text())
    B.locator('.rx[data-k=like]').click(); B.wait_for_timeout(500); B.locator('.rx[data-k=love]').click(); B.wait_for_timeout(700)
    A.locator('#close-stage').click(); A.wait_for_timeout(200); A.locator('#news-btn').click(); A.wait_for_selector('.ctl-rx'); A.wait_for_timeout(900)
    check('العدّاد يتجمّع من الجهازين', A.locator('.rx[data-k=like] span').inner_text()=='2' and A.locator('.rx[data-k=love] span').inner_text()=='1', A.locator('.ctl-rx').inner_text())
    A.locator('.rx[data-k=like]').click(); A.wait_for_timeout(600)
    check('إلغاء التفاعل ينقص العدّاد', A.locator('.rx[data-k=like] span').inner_text()=='1' and A.locator('.rx[data-k=like].on').count()==0)
    check('يظهر عدد المستخدمين', 'مستخدم' in A.locator('.ctl-users').inner_text(), A.locator('.ctl-card').inner_text()[:80])
    A.screenshot(path='/tmp/ctl_rx.png')
    # الإرسال المباشر
    A.locator('#close-stage').click(); A.wait_for_timeout(200)
    A.evaluate("setTimeout(()=>Control.contact({kind:'req',subject:'طلب تجريبي',text:'أريد الاشتراك',addon:'الطب'}),0)"); A.wait_for_selector('.ctl-contact')
    A.locator('.ctl-contact [name=name]').fill('سالم'); A.locator('.ctl-contact [name=phone]').fill('777000111'); A.locator('.ctl-contact [data-s=direct]').click(); A.wait_for_timeout(900)
    check('الرسالة المباشرة أُرسلت وأُغلقت النافذة', A.locator('.ctl-contact').count()==0)
    # لوحة المالك
    A.evaluate("""async(k)=>{const v=document.createElement('div');document.body.appendChild(v);window.__v=v;Control.sub='inbox';await Control.panel(v);Control.draft.api=Control.ch.api;const kk=await Sync.deviceKey(true);await Store.set('ctrlapi',await Sec.seal(kk,k))}""",KEY)
    A.evaluate("Control.body()"); A.locator('[data-c=loadinbox]').click(); A.wait_for_selector('.ctl-stats',timeout=8000)
    t=A.locator('#ctl-inbox').inner_text()
    check('المالك يرى الإحصاءات والرسالة', 'سالم' in t and 'أريد الاشتراك' in t and A.locator('.ctl-stats b').first.inner_text()=='2', t[:150])
    A.locator('[data-c=delmsg]').first.click(); A.wait_for_timeout(900)
    check('حذف الرسالة', 'لا توجد رسائل' in A.locator('#ctl-inbox').inner_text())
    # دون اتصال: التفاعل يُحفظ محلياً ويُرسل لاحقاً
    check('صفر أخطاء JS', not [e for e in errs if 'serviceWorker' not in e], str(errs))
    b.close()
finally:
    srv.terminate()
print('FAILED',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
