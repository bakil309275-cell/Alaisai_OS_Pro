# خزنة الملفات للإضافات (Alaisai.vault): python3 tests/e2e4.py (يتطلب خادماً على 8765)
import sys
from playwright.sync_api import sync_playwright
import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from seed import seeded
BASE='http://localhost:8765/index.html'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
HTML='''<main><p id=o>...</p></main>'''
JS='''(async()=>{const o=document.getElementById('o');const r={};try{
const b=new Blob([new Uint8Array([1,2,3,250,251,252])],{type:'application/octet-stream'});
await Alaisai.vault.put('a1',b,'x.bin');r.list=await Alaisai.vault.list();const g=await Alaisai.vault.get('a1');r.bytes=[...new Uint8Array(await g.blob.arrayBuffer())];r.name=g.name;
r.usage=await Alaisai.vault.usage();try{await Alaisai.vault.put('bad key',b)}catch(e){r.badKey=e.message}
try{await Alaisai.vault.put('big',new Blob([new Uint8Array(40*1048576)]));r.big='ok';await Alaisai.vault.remove('big')}catch(e){r.big=e.message}
await Alaisai.vault.remove('a1');r.after=(await Alaisai.vault.list()).length;r.none=await Alaisai.vault.get('a1')}catch(e){r.err=e.message}
o.textContent=JSON.stringify(r)})()'''
with sync_playwright() as p:
    b=seeded(p.chromium.launch(args=['--no-sandbox'])); page=b.new_context(service_workers='block').new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card')
    page.evaluate("""([h,j])=>{Addons.put({name:'خزنة',files:[{name:'manifest.json',content:'{"name":"خزنة"}'},{name:'index.html',content:h},{name:'main.js',content:j}]},'local');Addons.install('خزنة')}""",[HTML,JS])
    page.locator('.app-card',has_text='خزنة').first.click(); page.wait_for_timeout(1500)
    import json; r=json.loads(page.frame_locator('iframe').first.locator('#o').inner_text())
    check('الحفظ والقائمة', len(r['list'])==1 and r['list'][0]['name']=='x.bin' and r['list'][0]['size']==6, str(r))
    check('القراءة بايتاً ببايت', r['bytes']==[1,2,3,250,251,252] and r['name']=='x.bin')
    check('الاستخدام', r['usage']=={'count':1,'bytes':6}, str(r['usage']))
    check('مفتاح غير صالح يُرفض', 'مفتاح' in r.get('badKey',''), str(r))
    check('ملف 40 م.ب يُقبل (لا سقف سوى سعة الجهاز)', r.get('big')=='ok', str(r))
    check('الحذف', r['after']==0 and r['none'] is None)
    errs=[e for e in errs if 'serviceWorker' not in e]; check('لا أخطاء JS', not errs, str(errs))
    b.close()
print('FAILED',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
