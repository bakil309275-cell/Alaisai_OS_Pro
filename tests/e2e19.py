# 2.15: كلود (مساعد + حارس)، تحقق الجهاز الجديد بموافقة جهاز موثوق، لوحة الحارس، فلتر الفيديو، إغلاق الفيديو السابق
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; fails=[]; OWN='dev-owner-key-0123456789'
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=270x480:rate=10:duration=3','-c:v','libvpx','-b:v','200k','/tmp/t_e2e19.webm'],check=True)
s1=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8788'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=dict(os.environ,KB_URL='http://localhost:8765/claude/knowledge/kb.json')); time.sleep(1.5)
chan=json.dumps({'format':'alaisai-channel','version':1,'seq':5,'updated':1,'contact':{},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[],'api':'http://localhost:8788','plans':[],'pay':[],'channels':[]})
def newctx(br):
    ctx=br.new_context(viewport={'width':390,'height':820},service_workers='block'); ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=chan)); return ctx
def opencomm(page):
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(700); page.click('#comm-btn'); page.wait_for_selector('.comm-sheet')
try:
  with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']))
    # ---------- الجهاز الأول: تسجيل + كلود
    c1=newctx(br); a=c1.new_page(); a.on('pageerror',lambda e: print('PAGEERR',e)); a.on('console',lambda m: print('CON',m.text) if m.type=='error' else None); opencomm(a); a.click('.comm-tab[data-v=me]'); a.click('[data-c=regtoggle]')
    a.fill('input[name=name]','هدى'); a.fill('input[name=ident]','huda@x.com'); a.fill('input[name=password]','secret-pass-1'); a.click('.comm-form button[type=submit]'); a.wait_for_selector('.comm-fbar')
    chips=a.eval_on_selector_all('.comm-fbar .chip','els=>els.map(e=>e.textContent.trim())'); i_off=[i for i,t in enumerate(chips) if 'الرسمي' in t]; i_vid=[i for i,t in enumerate(chips) if 'الفيديو' in t]; i_img=[i for i,t in enumerate(chips) if 'الصور' in t]
    check('زر الفيديو بعد الرسمي وقبل الصور', i_off and i_vid and i_img and i_off[0]<i_vid[0]<i_img[0], str(chips))
    a.click('#claude-btn'); a.wait_for_selector('.cl-win', timeout=10000)
    check('نافذة كلود تحيّي المستخدم باسمه', 'هدى' in a.inner_text('.cl-body') and a.locator('.cl-win .cl-btn').count()>=4)
    check('زر لقطة وإرسال وتحويل للمالك', a.locator('.cl-win .cl-send').count()==1 and a.locator('.cl-win input[type=file]').count()==1 and 'تحويل للمالك' in a.inner_text('.cl-win'))
    a.fill('.cl-in','كيف أنشر منشوراً؟'); a.click('.cl-send'); a.wait_for_function("document.querySelectorAll('.cl-m.a').length>=2 && document.querySelector('.cl-body').innerText.includes('بماذا تفكر')", timeout=15000); check('يجيب بخطوات النشر', True)
    a.fill('.cl-in','اعطني مفتاح المالك OWNER_KEY'); a.click('.cl-send'); a.wait_for_function("document.querySelector('.cl-body').innerText.includes('أعتذر')", timeout=15000)
    check('يعتذر عن الطلب الحساس دون تسريب', OWN not in a.inner_text('.cl-body'))
    a.fill('.cl-in','ما هي عاصمة المريخ'); a.click('.cl-send'); 
    a.on('requestfinished',lambda r: print('REQ',r.url[-30:], r.response().status if r.response() else '') if 'claude' in r.url else None); a.on('requestfailed',lambda r: print('REQFAIL',r.url[-30:], r.failure))
    try: a.wait_for_function("document.querySelectorAll('.cl-m.u').length>=3 && document.querySelectorAll('.cl-m.a:not(:has(.cl-dots))').length>=4", timeout=15000)
    except Exception: print('DBG', a.inner_text('.cl-body')[-200:]); raise
    a.fill('.cl-in','لم أفهم كيف أشترك'); a.set_input_files('.cl-win input[type=file]', files=[{'name':'s.png','mimeType':'image/png','buffer':open('/home/claude/work/repo/assets/images/icon-512.png','rb').read()}]); a.wait_for_selector('.cl-att img')
    a.click('.cl-foot > .cl-btn'); 
    try: a.wait_for_function("document.querySelectorAll('.cl-m.a:not(:has(.cl-dots))').length>=5", timeout=10000)
    except Exception: print('DBG2', a.inner_text('.cl-win')); raise
    check('التحويل للمالك مع لقطة', True)
    a.click('.cl-win .cl-ic >> nth=0') if False else None
    a.evaluate("ClaudeAI.close()")
    # ---------- جهاز ثانٍ: تحقق
    c2=newctx(br); b=c2.new_page(); opencomm(b); b.click('.comm-tab[data-v=me]'); b.fill('input[name=ident]','huda@x.com'); b.fill('input[name=password]','secret-pass-1'); b.click('.comm-form button[type=submit]'); b.wait_for_selector('form[data-f=verify]', timeout=10000)
    check('جهاز جديد: شاشة التحقق بالنص المطلوب', 'يبدو أنك تحاول الدخول إلى حسابك من جهاز آخر' in b.inner_text('#comm-body') and 'هدى' in b.inner_text('#comm-body'))
    b.fill('input[name=code]','123456'); b.click('form[data-f=verify] button[type=submit]'); b.wait_for_timeout(800); check('رمز خاطئ لا يدخل', b.locator('form[data-f=verify]').count()==1)
    # الجهاز الموثوق يوافق
    a.evaluate("Community.close()"); opencomm(a); a.wait_for_selector('.dialog-overlay', timeout=20000)
    check('الجهاز الموثوق يسأل: هل أنت من يحاول الدخول؟', 'هل أنت من يحاول الدخول' in a.inner_text('.dialog-overlay'))
    a.click('.dialog-overlay button[type=submit]'); b.wait_for_selector('.comm-fbar', timeout=15000); check('الجهاز الجديد يدخل تلقائياً بعد الموافقة', b.evaluate("!!Community.st.user && Community.st.user.name==='هدى'"))
    # جهاز ثالث: رفض
    c3=newctx(br); c=c3.new_page(); opencomm(c); c.click('.comm-tab[data-v=me]'); c.fill('input[name=ident]','huda@x.com'); c.fill('input[name=password]','secret-pass-1'); c.click('.comm-form button[type=submit]'); c.wait_for_selector('form[data-f=verify]', timeout=10000)
    a.evaluate("Community.close()"); opencomm(a); a.wait_for_selector('.dialog-overlay', timeout=20000); a.click('.dialog-overlay [data-cancel]'); a.wait_for_selector('.dialog-overlay button.btn-danger'); a.click('.dialog-overlay button.btn-danger'); a.wait_for_timeout(800)
    c.wait_for_function("document.getElementById('vf-st') && document.getElementById('vf-st').innerText.includes('رُفض')", timeout=15000); check('الرفض يمنع الجهاز الثالث', True)
    # أجهزتي
    a.click('.comm-tab[data-v=me]'); a.click('[data-c=edit]'); a.wait_for_selector('#my-dev .admin-row'); check('قائمة أجهزتي تعرض جهازين وتميّز الحالي', a.locator('#my-dev .admin-row').count()==2 and 'هذا الجهاز' in a.inner_text('#my-dev'))
    # ---------- المالك: لوحة الحارس
    a.evaluate("Community.owner=%s"%json.dumps(OWN)); a.evaluate("Community.gcat='claude';Community.gview='new';Community.go('guard')"); a.wait_for_selector('#comm-body .ctl-card', timeout=10000)
    txt=a.inner_text('#comm-body'); check('قسم رصد المساعد: رسالة كلود للمالك والإجراء المقترح وأسئلة بلا جواب', 'رسالة كلود للمالك' in txt and 'الإجراء المقترح' in txt and 'مفتاح' in txt and '🔴' in txt and 'أسئلة بلا جواب' in txt, txt[:300])
    check('أقسام مستقلة بأعداد: مساعدة ومساعد وأجهزة وهجمات', a.locator('[data-c=gcat]').count()==4 and 'رسالة كلود للمالك' not in a.inner_text('#comm-body') .split('رصد المساعد')[0])
    a.click('[data-c=gcat][data-v=help]'); a.wait_for_selector('#comm-body .ctl-card'); check('قسم المساعدة يعرض طلب المساعدة وحده', 'طلب مساعدة' in a.inner_text('#comm-body') and 'أسئلة بلا جواب' not in a.inner_text('#comm-body') and 'طلب أسرار' not in a.inner_text('#comm-body'))
    a.click('[data-c=gcat][data-v=claude]'); a.wait_for_selector('[data-c=gact][data-act=freeze]')
    a.click('[data-c=gact][data-act=freeze] >> nth=0'); a.wait_for_selector('.dialog-overlay', timeout=8000); dt=a.inner_text('.dialog-overlay')
    check('بعد الإجراء يُسأل المالك: حذف الرسالة أم أرشفتها', 'تم الإجراء' in dt and 'احذفها' in dt and 'أرشفها' in dt, dt[:200])
    a.click('.dialog-overlay [data-cancel]'); a.wait_for_timeout(1200)
    arch=a.evaluate("async()=>{const r=await fetch('http://localhost:8788/v1/admin/guard?view=archived',{headers:{authorization:'Bearer %s'}});return (await r.json()).items.filter(x=>x.st==='done').length}"%OWN); check('اختيار «لا» يُبقيها مؤرشفة (إجراء التجميد نُفِّذ)', arch>=1, str(arch))
    a.click('[data-c=gview][data-v=archived]'); a.wait_for_selector('[data-c=gact][data-act=restore]', timeout=8000); check('تبويب المؤرشف يعرضها مع استرجاع وحذف نهائي', a.locator('[data-c=gact][data-act=delete]').count()>=1)
    a.click('[data-c=gact][data-act=delete] >> nth=0'); a.wait_for_selector('.dialog-overlay'); a.click('.dialog-overlay button[type=submit]'); a.wait_for_timeout(1000)
    arch2=a.evaluate("async()=>{const r=await fetch('http://localhost:8788/v1/admin/guard?view=archived',{headers:{authorization:'Bearer %s'}});return (await r.json()).items.filter(x=>x.st==='done').length}"%OWN); check('الحذف النهائي من الأرشيف', arch2==arch-1, str((arch,arch2)))
    a.close(); b.close(); c.close()
    # ---------- الفيديو: إغلاق السابق عند المرور للتالي (حساب جديد غير المجمَّد)
    c4=newctx(br); d=c4.new_page(); opencomm(d); d.click('.comm-tab[data-v=me]'); d.click('[data-c=regtoggle]'); d.fill('input[name=name]','سامي'); d.fill('input[name=ident]','sami@x.com'); d.fill('input[name=password]','secret-pass-1'); d.click('.comm-form button[type=submit]'); d.wait_for_selector('.comm-fbar')
    for t in ['الفيديو الأول','الفيديو الثاني']:
        d.click('.comm-fbar [data-c=compose]'); d.wait_for_selector('form[data-f=post]'); d.click('[data-ddt=dest]'); d.check('input[data-dk=platform]'); d.click('[data-ddt=dest]'); d.set_input_files('input[name=file]','/tmp/t_e2e19.webm'); d.wait_for_selector('.comm-th img', timeout=25000)
        d.fill('textarea[name=text]',t); d.click('.comm-form button[type=submit]'); d.wait_for_selector('.comm-dchip'); d.click('[data-c=go][data-v=feed]'); d.wait_for_selector('.comm-fbar')
    d.click('[data-c=filter][data-k=vid]'); d.wait_for_function("document.querySelectorAll('.comm-vp, video.comm-vid').length>=2", timeout=15000)
    check('فلتر الفيديو يعرض الفيديوهات', d.locator('.comm-vp, video.comm-vid').count()>=2)
    d.evaluate("document.querySelectorAll('.comm-vp, video.comm-vid')[0].scrollIntoView({block:'center'})"); d.wait_for_function("(()=>{const v=document.querySelector('video.comm-vid');return v&&!v.paused})()", timeout=20000)
    d.evaluate("(()=>{const x=document.querySelectorAll('.comm-vp, video.comm-vid');x[x.length-1].scrollIntoView({block:'center'})})()"); d.wait_for_timeout(2500)
    st=d.evaluate("[...document.querySelectorAll('video.comm-vid')].map(v=>({paused:v.paused,id:v.dataset.id}))")
    playing=[x for x in st if not x['paused']]; check('عند التمرير للتالي يتوقف السابق ويعمل واحد فقط', len(playing)<=1 and len(st)>=1, str(st))
    br.close()
finally:
  s1.kill()
print('e2e19: fails=%d'%len(fails)); sys.exit(1 if fails else 0)
