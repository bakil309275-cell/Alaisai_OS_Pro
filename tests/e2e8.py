# مركز التخزين الموحّد: python3 tests/e2e8.py (يتطلب خادماً على 8765 وnode)
import sys,json,re,subprocess,time
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
srv=subprocess.Popen(['node','tests/webdav_mock.mjs','8789'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL); srv.stdout.readline()
DRIVE={'files':{},'folder':None,'n':0}
CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'}
GSI="window.google={accounts:{oauth2:{initTokenClient:function(o){return{requestAccessToken:function(){setTimeout(function(){o.callback({access_token:'tok',expires_in:3600})},10)}}}}}};"
def gdrive(route):
    r=route.request; u=r.url
    if r.method=='OPTIONS': return route.fulfill(status=204,headers=CORS)
    if 'accounts.google.com/gsi/client' in u: return route.fulfill(status=200,content_type='application/javascript',body=GSI)
    if r.headers.get('authorization')!='Bearer tok': return route.fulfill(status=401,headers=CORS,body='{}')
    J=lambda o,s=200: route.fulfill(status=s,headers={**CORS,'content-type':'application/json'},body=json.dumps(o))
    if '/upload/drive/v3/files' in u:
        bd=re.search(r'boundary=(\S+)',r.headers['content-type']).group(1).encode(); parts=r.post_data_buffer.split(b'--'+bd)
        meta=json.loads(parts[1].split(b'\r\n\r\n',1)[1].strip()); data=parts[2].split(b'\r\n\r\n',1)[1][:-2]
        DRIVE['n']+=1; fid='f%d'%DRIVE['n']; DRIVE['files'][fid]={'name':meta['name'],'data':data,'parent':meta['parents'][0]}; return J({'id':fid,'size':str(len(data))})
    m=re.search(r'/drive/v3/files/([^?]+)',u)
    if m and r.method=='GET' and 'alt=media' in u: f=DRIVE['files'].get(m.group(1)); return route.fulfill(status=200 if f else 404,headers={**CORS,'content-type':'application/octet-stream'},body=f['data'] if f else b'')
    if m and r.method=='DELETE': DRIVE['files'].pop(m.group(1),None); return route.fulfill(status=204,headers=CORS)
    if '/drive/v3/about' in u: return J({'storageQuota':{'limit':'15000000000','usage':'1000'}})
    if r.method=='POST' and '/drive/v3/files' in u: DRIVE['folder']='folder1'; return J({'id':'folder1'})
    if '/drive/v3/files' in u and r.method=='GET':
        if 'vnd.google-apps.folder' in u: return J({'files':[{'id':DRIVE['folder']}] if DRIVE['folder'] else []})
        return J({'files':[{'id':k,'name':v['name'],'size':str(len(v['data'])),'mimeType':'text/plain','modifiedTime':'2026-11-05T10:00:00Z'} for k,v in DRIVE['files'].items()]})
    return route.fulfill(status=404,headers=CORS,body='{}')
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':390,'height':800},service_workers='block'); ctx.route('https://www.googleapis.com/**',gdrive); ctx.route('https://accounts.google.com/**',gdrive); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('.app-card'); pg.wait_for_timeout(800)
    R=lambda js,*a: pg.evaluate(js,*a)
    check('زر المساحات يفتح المركز', True); pg.locator('#hub-btn').click(); pg.wait_for_selector('.hub-src'); check('المصدر المحلي موجود', pg.locator('.hub-src').count()==1)
    # WebDAV
    R("async()=>{await Cloud.addSource({type:'webdav',name:'سحابتي',url:'http://localhost:8789/dav',user:'u'},{pass:'p'})}")
    wid=R("Cloud.sources[0].id")
    r=R("async(id)=>{const b=new Blob(['مرحبا webdav'],{type:'text/plain'});const x=await Cloud.put('ملف أ.txt',b,{src:id});const l=await Cloud.list(id);const g=await(await Cloud.getBlob(id,l[0].ref)).text();const q=await Cloud.quotaOf(id);return {x,l,g,q}}",wid)
    check('WebDAV: رفع وقراءة وسرد', r['g']=='مرحبا webdav' and len(r['l'])==1 and r['l'][0]['size']>0, str(r))
    check('WebDAV: السعة', r['q']=={'used':500,'total':1000500}, str(r['q']))
    check('WebDAV: كلمة المرور مشفّرة في التخزين', not R("async()=>JSON.stringify(await Store.get('cloudsec')).includes('\"pass\"')"))
    R("async(id)=>{const l=await Cloud.list(id);await Cloud.del(id,l[0].ref)}",wid); check('WebDAV: حذف', R("async(id)=>(await Cloud.list(id)).length",wid)==0)
    # Google Drive
    R("async()=>{await Cloud.addSource({type:'gdrive',name:'درايف',clientId:'123.apps.googleusercontent.com'})}"); gid=R("Cloud.sources[1].id")
    r=R("async(id)=>{await Cloud.put('صورة.png',new Blob([new Uint8Array([1,2,3,250])],{type:'image/png'}),{src:id});const l=await Cloud.list(id);const g=new Uint8Array(await(await Cloud.getBlob(id,l[0].ref)).arrayBuffer());return {n:l.length,name:l[0].name,g:[...g],q:await Cloud.quotaOf(id)}}",gid)
    check('Drive: رفع متعدد الأجزاء وقراءة بايتاً ببايت', r['n']==1 and r['name']=='صورة.png' and r['g']==[1,2,3,250], str(r))
    check('Drive: السعة', r['q']=={'used':1000,'total':15000000000}, str(r['q']))
    # مجلد على الجهاز (OPFS يحاكي File System Access)
    R("async()=>{const h=await navigator.storage.getDirectory();h.queryPermission=async()=>'granted';await Cloud.addSource({type:'fsa',name:'💽 قرص'},null,await h.getDirectoryHandle('hub',{create:true}).then(d=>{d.queryPermission=async()=>'granted';return d}))}")
    fid=R("Cloud.sources[2].id")
    r=R("async(id)=>{await Cloud.put('من القرص.txt',new Blob(['disk'],{type:'text/plain'}),{src:id});const l=await Cloud.list(id);return [l.length,await(await Cloud.getBlob(id,l[0].ref)).text()]}",fid)
    check('مجلد القرص: رفع وقراءة', r==[1,'disk'], str(r))
    # روابط
    R("async()=>{const s=await Cloud.addSource({type:'link',name:'روابطي',links:[]});await Cloud.addLink(s.id,'تقرير','https://drive.google.com/file/d/ABCDEFGHIJKLMNOP/view')}")
    check('الروابط: تُحفظ وتتحوّل لرابط تنزيل مباشر', R("Cloud.direct(Cloud.sources[3].links[0].url)")=='https://drive.google.com/uc?export=download&id=ABCDEFGHIJKLMNOP')
    bad=R("async()=>{try{await Cloud.addLink(Cloud.sources[3].id,'x','javascript:alert(1)');return false}catch(e){return true}}"); check('رابط javascript: يُرفض', bad)
    # كل الملفات
    pg.reload(); pg.wait_for_selector('.app-card'); pg.wait_for_timeout(800)
    check('المصادر تُحفظ بعد إعادة التحميل', R("Cloud.sources.length")==4 and R("Object.keys(Cloud.sec).length")==1)
    pg.locator('#hub-btn').click(); pg.wait_for_selector('.hub-src'); pg.wait_for_timeout(1500)
    check('5 مصادر معروضة (محلي + 4)', pg.locator('.hub-src').count()==5)
    pg.locator('[data-h=all]').click(); pg.wait_for_selector('[data-hq]'); pg.wait_for_timeout(1500)
    nm=pg.locator('[data-hl]').inner_text(); check('كل الملفات تجمع من المصادر', 'صورة.png' in nm and 'من القرص.txt' in nm and 'تقرير' in nm, nm)
    pg.locator('[data-hq]').fill('قرص'); pg.wait_for_timeout(150); check('البحث في كل الملفات', pg.locator('[data-hl] .admin-row').count()==1)
    pg.screenshot(path='/tmp/hub.png')
    # جسر pool من إضافة + التوجيه التلقائي
    R("""()=>{Addons.put({name:'مخزن',files:[{name:'manifest.json',content:'{"name":"مخزن"}'},{name:'index.html',content:'<main id=o>..</main>'},{name:'main.js',content:`(async()=>{const r={};try{
      r.src=await Alaisai.pool.sources();await Alaisai.pool.put('k1',new Blob([new Uint8Array([9,8,7])],{type:'application/octet-stream'}),'x.bin',${JSON.stringify('')});
      const g=await Alaisai.pool.get('k1');r.bytes=[...new Uint8Array(await g.blob.arrayBuffer())];r.list=await Alaisai.pool.list();
      try{await Alaisai.pool.put('bad key',new Blob(['a']))}catch(e){r.bad=e.message}
      await Alaisai.pool.remove('k1');r.after=(await Alaisai.pool.list()).length}catch(e){r.err=e.message}
      document.getElementById('o').textContent=JSON.stringify(r)})()`}]},'local');Addons.install('مخزن')}""")
    pg.locator('#close-stage').click() if pg.locator('#stage-overlay:not(.hidden)').count() else None
    pg.locator('.app-card',has_text='مخزن').first.click(); pg.wait_for_timeout(2500)
    o=json.loads(pg.frame_locator('iframe').first.locator('#o').inner_text())
    check('الإضافة تكتب وتقرأ عبر pool (تلقائي: الجهاز أولاً)', o.get('bytes')==[9,8,7] and len(o['list'])==1 and o['list'][0]['src']=='local' and o['after']==0 and 'مفتاح' in o.get('bad',''), str(o))
    check('الإضافة ترى المصادر القابلة للكتابة', len(o['src'])==4, str(o.get('src')))
    check('صفر أخطاء JS', not [e for e in errs if 'serviceWorker' not in e], str(errs))
    b.close()
finally:
    srv.terminate()
print('FAILED',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
