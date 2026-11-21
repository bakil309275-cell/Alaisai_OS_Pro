# 2.13: تحديث التطبيق المغلَّف (Capacitor) من المستودع: الملفات المضمَّنة ثم OTA عبر Service Worker، والتراجع الآمن
# يحتاج openssl (شهادة محلية) — يشغّل خادم https على 8766 للمستودع، و«مستودع بعيد» وهمي على 8767
import sys, os, json, ssl, subprocess, threading, time, http.server, functools
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')); fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
d='/tmp/ssl'
if not os.path.exists(d+'/c.pem'): os.makedirs(d,exist_ok=True); subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',d+'/k.pem','-out',d+'/c.pem','-days','2','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],check=True,capture_output=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def end_headers(self): self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Cache-Control','no-store'); super().end_headers()
def srv(port,directory,tls):
    h=functools.partial(Q,directory=directory); s=http.server.ThreadingHTTPServer(('127.0.0.1',port),h)
    if tls: c=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); c.load_cert_chain(d+'/c.pem',d+'/k.pem'); s.socket=c.wrap_socket(s.socket,server_side=True)
    threading.Thread(target=s.serve_forever,daemon=True).start(); return s
# «المستودع البعيد»: نسخة من الجذر بملفات قليلة معدّلة (إصدار 9.9.9)
import shutil
R='/tmp/remote_repo'; shutil.rmtree(R,ignore_errors=True); os.makedirs(R)
for f in ['release-manifest.json','index.html','sw.js','manifest.json']: shutil.copy(os.path.join(ROOT,f),R)
shutil.copytree(os.path.join(ROOT,'src'),R+'/src'); shutil.copytree(os.path.join(ROOT,'assets'),R+'/assets')
import re
VER=re.search(r"APP_VERSION = '([^']+)'",open(ROOT+'/src/version.js',encoding='utf8').read()).group(1)
vs=open(R+'/src/version.js',encoding='utf8').read().replace("APP_VERSION = '"+VER+"'","APP_VERSION = '9.9.9'"); open(R+'/src/version.js','w',encoding='utf8').write(vs)
m=json.load(open(R+'/release-manifest.json')); m['version']='9.9.9'; m['files']['src/version.js']='f'*40; json.dump(m,open(R+'/release-manifest.json','w'))
a=srv(8766,ROOT,True); b=srv(8767,R,False)
INIT="window.Capacitor={isNativePlatform:()=>true};window.NATIVE_REMOTE='http://localhost:8767/';"
try:
  with sync_playwright() as p:
    br=p.chromium.launch(args=['--no-sandbox','--ignore-certificate-errors'])
    ctx=br.new_context(viewport={'width':390,'height':800}); ctx.add_init_script(INIT); page=ctx.new_page()
    page.goto('https://localhost:8766/index.html'); page.wait_for_function("window.NativeUpdate&&NativeUpdate.native"); page.wait_for_function("navigator.serviceWorker.controller||true"); page.wait_for_timeout(2500)
    check('الوضع المغلَّف يُكتشف', page.evaluate("NativeUpdate.native===true"))
    check('الإصدار المضمَّن '+VER, page.evaluate("APP_VERSION")==VER)
    page.reload(); page.wait_for_timeout(1500)  # ليتحكّم الـ SW
    r=page.evaluate("async()=>{const r=await NativeUpdate.check();return r}"); check('اكتشف تحديثاً وحمّل ملفاً متغيّراً', r['state']=='updated' and r['n']==1, str(r))
    page.reload(); page.wait_for_function("window.APP_VERSION", timeout=15000)
    v=page.evaluate("APP_VERSION"); check('بعد إعادة التشغيل يعمل الإصدار الجديد من مخزن OTA', v=='9.9.9', v)
    r=page.evaluate("async()=>NativeUpdate.check()"); check('لا تحديث جديد بعدها', r['state']=='current', str(r))
    # تراجع آمن: علم الإقلاع عالق = انهيار → حذف OTA والعودة للمضمَّن
    page.evaluate("localStorage.setItem('ota_boot','1')"); page.reload(); page.wait_for_timeout(2500); page.wait_for_function("window.APP_VERSION")
    v=page.evaluate("APP_VERSION"); check('انهيار بعد تحديث يرجع للإصدار المضمَّن', v==VER, v)
    br.close()
  # متصفح عادي (http أو بلا Capacitor): لا يتدخل
  with sync_playwright() as p:
    br=p.chromium.launch(args=['--no-sandbox','--ignore-certificate-errors']); pg=br.new_page(); pg.goto('https://localhost:8766/index.html'); pg.wait_for_function("window.NativeUpdate")
    check('المتصفح العادي لا يفعّل التحديث الذاتي', pg.evaluate("NativeUpdate.native===false")); br.close()
finally:
  a.shutdown(); b.shutdown()
print('e2e17: fails=%d'%len(fails)); sys.exit(1 if fails else 0)
