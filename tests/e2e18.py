# 2.14: عرض الفيديو بغلاف + تشغيل تلقائي صامت + نقرة لرفع الصوت + مالك: زر تفعيل R2
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from seed import seeded
BASE='http://localhost:8765/index.html'; fails=[]; OWN='dev-owner-key-0123456789'
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=270x480:rate=10:duration=2','-c:v','libvpx','-b:v','200k','/tmp/t_e2e18.webm'],check=True)
s1=subprocess.Popen(['node','--no-warnings','tools/worker/serve.mjs','8788'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=dict(os.environ,R2='1')); time.sleep(1.5)
chan=json.dumps({'format':'alaisai-channel','version':1,'seq':5,'updated':1,'contact':{},'pub':None,'revoked':[],'retain':{'archiveDays':60,'deleteDays':240},'addons':{},'items':[],'api':'http://localhost:8788','plans':[],'pay':[],'channels':[]})
try:
  with sync_playwright() as p:
    br=seeded(p.chromium.launch(args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']))
    ctx=br.new_context(viewport={'width':390,'height':800},service_workers='block'); page=ctx.new_page()
    ctx.route('**/control/channel.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=chan))
    page.goto(BASE); page.wait_for_selector('#comm-btn'); page.wait_for_timeout(800); page.click('#comm-btn'); page.wait_for_selector('.comm-sheet'); page.click('.comm-tab[data-v=me]'); page.click('[data-c=regtoggle]')
    page.fill('input[name=name]','صانع'); page.fill('input[name=ident]','vid1@x.com'); page.fill('input[name=password]','secret-pass-1'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-fbar')
    page.click('.comm-fbar [data-c=compose]'); page.wait_for_selector('form[data-f=post]'); page.click('[data-ddt=dest]'); page.check('input[data-dk=platform]'); page.click('[data-ddt=dest]')
    page.set_input_files('input[name=file]', '/tmp/t_e2e18.webm'); page.wait_for_selector('.comm-th img', timeout=25000)
    check('غلاف الفيديو يُولَّد ويظهر في المعاينة', True)
    page.fill('textarea[name=text]','فيديو قصير'); page.click('.comm-form button[type=submit]'); page.wait_for_selector('.comm-dchip'); page.click('[data-c=go][data-v=feed]'); page.wait_for_selector('.comm-vp, video.comm-vid', timeout=15000)
    page.wait_for_timeout(300)
    data=page.evaluate("async()=>{const j=await (await fetch('http://localhost:8788/v1/posts')).json();return j.posts[0].media[0]}")
    check('الخادم حفظ الغلاف والنسبة', str(data.get('poster','')).startswith('data:image/jpeg') and 0.4 < data.get('ar',0) < 0.7, str({k:str(v)[:30] for k,v in data.items()}))
    page.evaluate("const e=document.querySelector('.comm-vp'); if(e) e.scrollIntoView({block:'center'})")
    try: page.wait_for_selector('video.comm-vid', timeout=12000)
    except Exception:
        print('DBG', page.evaluate("(()=>{const e=document.querySelector('.comm-vp');return e?JSON.stringify({r:e.getBoundingClientRect(),d:e.dataset,busy:e.dataset.busy}):'none'})()"), page.evaluate('!!window.IntersectionObserver'), page.evaluate('Community.vcache.size')); raise
    page.wait_for_timeout(1200)
    st=page.evaluate("(()=>{const v=document.querySelector('video.comm-vid');return {muted:v.muted,paused:v.paused,t:v.currentTime,ar:v.style.aspectRatio}})()")
    check('يعمل تلقائياً صامتاً أثناء الظهور', st['muted'] and not st['paused'] and st['t']>0, str(st))
    page.click('video.comm-vid'); page.wait_for_timeout(300)
    check('النقر يرفع الصوت', page.evaluate("document.querySelector('video.comm-vid').muted")==False)
    # زر R2 للمالك
    page.evaluate("Community.owner=%s"%json.dumps(OWN)); page.click('.comm-tab[data-v=owner]') if page.locator('.comm-tab[data-v=owner]').count() else page.evaluate("Community.go('owner')")
    page.wait_for_selector('#own-stor [data-stor]', timeout=10000); check('بطاقة التخزين تعرض R2 مربوطاً وزر التفعيل', 'مربوطة' in page.inner_text('#own-stor') and 'D1' in page.inner_text('#own-stor'))
    page.click('#own-stor [data-stor]'); page.wait_for_function("document.querySelector('#own-stor').innerText.includes('R2 (حتى')", timeout=8000)
    check('زر واحد يفعّل R2', True)
    br.close()
finally:
  s1.kill()
print('e2e18: fails=%d'%len(fails)); sys.exit(1 if fails else 0)
