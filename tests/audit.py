# تدقيق الجودة: قابلية التثبيت (CDP)، SEO، إمكانية الوصول (تباين/أسماء/عناوين)، الأداء. python3 tests/audit.py
import json, re, sys, os
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'; fails=[]; warns=[]
def ok(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n, '' if c else x)
    if not c: fails.append(n)
def warn(n,c,x=''):
    print(('✓ ' if c else '⚠ ')+n, '' if c else x)
    if not c: warns.append(n)

CONTRAST_JS = r'''
() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = ({r,g,b}) => { const f = (v) => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const blend = (top, bot) => ({ r: top.r*top.a+bot.r*(1-top.a), g: top.g*top.a+bot.g*(1-top.a), b: top.b*top.a+bot.b*(1-top.a), a: 1 });
  const bgOf = (el) => { // يركّب الخلفيات من الأب إلى الابن
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let base = { r: 255, g: 255, b: 255, a: 1 }, grad = null;
    for (const e of chain.reverse()) { const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) { const cols = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])); grad = cols; base = cols[Math.floor(cols.length/2)] || base; }
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { base = blend(c, base); grad = null; } }
    return { base, grad };
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    if (el.closest('[hidden],.sr-only,iframe')) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const { base } = bgOf(el); const f = blend(fg, base);
    const l1 = lum(f), l2 = lum(base), ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({ text: t.textContent.trim().slice(0, 30), ratio: +ratio.toFixed(2), need, el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') });
  }
  return out;
}
'''
NAMES_JS = r'''
() => { const bad = [];
  document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]').forEach((e) => {
    const r = e.getBoundingClientRect(); if (!r.width || e.closest('[hidden]')) return;
    const lab = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector('label[for="'+e.id+'"]')) || e.closest('label') || e.title || (e.textContent||'').trim() || e.getAttribute('placeholder');
    if (!lab) bad.push(e.outerHTML.slice(0, 80)); });
  return bad; }
'''
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':412,'height':823},device_scale_factor=2,is_mobile=True,has_touch=True)
    page=ctx.new_page(); logs=[]
    page.on('console',lambda m: logs.append((m.type,m.text)) if m.type in ('error','warning') else None)
    cdp=ctx.new_cdp_session(page); cdp.send('Page.enable')
    page.goto(BASE+'index.html'); page.wait_for_selector('.app-card'); page.wait_for_timeout(1500)

    # ----- قابلية التثبيت و manifest -----
    inst=cdp.send('Page.getInstallabilityErrors').get('installabilityErrors',[])
    ok('Chrome: لا أخطاء قابلية تثبيت', not inst, json.dumps(inst,ensure_ascii=False))
    man=cdp.send('Page.getAppManifest'); ok('manifest بلا أخطاء تحليل', not man.get('errors'), str(man.get('errors')))
    m=json.load(open('manifest.json',encoding='utf8'))
    from PIL import Image
    for ic in m['icons']:
        pth=ic['src']; w,h=map(int,ic['sizes'].split('x')); im=Image.open(pth)
        ok(f'أيقونة {pth} بالأبعاد الصحيحة', im.size==(w,h), str(im.size))
    ok('أيقونة maskable موجودة', any(i['purpose']=='maskable' for i in m['icons']))
    ok('أيقونة 192 و512 (any)', {'192x192','512x512'} <= {i['sizes'] for i in m['icons'] if i['purpose']=='any'})
    ok('اختصارات manifest', len(m.get('shortcuts',[]))>=1)
    for k in ('name','short_name','start_url','scope','display','theme_color','background_color','lang','id','description'): ok('manifest.'+k, k in m)
    warn('manifest.screenshots (واجهة تثبيت غنية)', bool(m.get('screenshots')))

    # ----- SEO / أفضل الممارسات -----
    html=open('index.html',encoding='utf8').read()
    title=page.title(); ok('العنوان 10-70 حرفاً', 10<=len(title)<=70, title)
    desc=page.get_attribute('meta[name=description]','content'); ok('الوصف 70-170 حرفاً', 70<=len(desc)<=170, str(len(desc)))
    ok('viewport', bool(page.get_attribute('meta[name=viewport]','content')))
    ok('lang و dir', page.get_attribute('html','lang')=='ar' and page.get_attribute('html','dir')=='rtl')
    ok('canonical مطلق', page.get_attribute('link[rel=canonical]','href').startswith('https://'))
    ok('Open Graph كامل', all(page.locator(f'meta[property="og:{k}"]').count() for k in ('title','description','image','url','type')))
    ld=json.loads(page.inner_text('script[type="application/ld+json"]') if False else page.evaluate("document.querySelector('script[type=\"application/ld+json\"]').textContent")); ok('JSON-LD صالح', ld.get('@type')=='SoftwareApplication')
    ok('h1 واحد', page.locator('h1').count()==1)
    ok('ملفات SEO موجودة', all(os.path.exists(f) for f in ('robots.txt','sitemap.xml','404.html','privacy.html','terms.html','.well-known/security.txt')))
    ids=page.evaluate("[...document.querySelectorAll('[id]')].map(e=>e.id)"); ok('لا معرّفات مكررة', len(ids)==len(set(ids)))
    errs=[l for l in logs if l[0]=='error']; ok('لا أخطاء في console', not errs, str(errs[:3]))
    ok('لا موارد خارجية', not re.search(r'(src|href)="https?://(?!bakil309275-cell)', html.replace('https://github.com','')) )
    ok('صور بنص بديل', page.evaluate("[...document.images].every(i=>i.alt!==null && i.hasAttribute('alt'))"))

    # ----- إمكانية الوصول -----
    bad=page.evaluate(NAMES_JS); ok('كل العناصر التفاعلية لها اسم', not bad, str(bad[:3]))
    ok('تخطّي إلى المحتوى', page.locator('.skip-link').count()==1)
    small=page.evaluate("""[...document.querySelectorAll('button,a[href],[role=button],input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&!e.closest('[hidden],.sr-only')&&!e.classList.contains('skip-link')&&(r.height<40||r.width<40)}).map(e=>e.id||e.className||e.tagName)""")
    warn('أهداف اللمس ≥ 40px في الصفحة الرئيسية', not small, str(small[:6]))
    for theme in ('dark','light'):
        page.evaluate(f"Store.db.settings.theme='{theme}';UI.applyTheme('{theme}')"); page.wait_for_timeout(900)
        v=page.evaluate(CONTRAST_JS); ok(f'تباين الألوان (رئيسية، {theme})', not v, json.dumps(v[:5],ensure_ascii=False))
        page.get_by_text('الملاحظات').first.click(); page.wait_for_selector('.notes'); v=page.evaluate(CONTRAST_JS); ok(f'تباين الألوان (ملاحظات، {theme})', not v, json.dumps(v[:5],ensure_ascii=False)); page.click('#close-stage')
        page.click('#store-btn'); page.wait_for_selector('#cat-list .admin-row'); v=page.evaluate(CONTRAST_JS); ok(f'تباين الألوان (متجر، {theme})', not v, json.dumps(v[:5],ensure_ascii=False)); page.click('#close-stage')
        page.evaluate("void UI.dialog({title:'عنوان',message:'رسالة توضيحية',fields:[{id:'a',label:'حقل',type:'text'},{id:'b',label:'قائمة',type:'select',options:[['1','أ']]}],danger:true})"); page.wait_for_selector('.dialog'); v=page.evaluate(CONTRAST_JS); ok(f'تباين الألوان (حوار، {theme})', not v, json.dumps(v[:5],ensure_ascii=False)); page.keyboard.press('Escape')
        page.click('#admin-gate'); page.wait_for_timeout(500)
        if page.locator('.dialog input[name=p1]').count(): page.fill('input[name=p1]','Alaisai#2026'); page.fill('input[name=p2]','Alaisai#2026'); page.keyboard.press('Enter')
        page.wait_for_selector('.tabs')
        for tab in ('apps','logs','system','backup','sync','storage'):
            page.click(f'[data-act=tab][data-tab={tab}]'); page.wait_for_timeout(250); v=page.evaluate(CONTRAST_JS); ok(f'تباين الألوان (إدارة/{tab}، {theme})', not v, json.dumps(v[:5],ensure_ascii=False))
        bad=page.evaluate(NAMES_JS); ok(f'أسماء العناصر في الإدارة ({theme})', not bad, str(bad[:3])); page.click('#close-stage')
    # لوحة المفاتيح: Tab يصل لأول بطاقة
    page.goto(BASE+'index.html'); page.wait_for_selector('.app-card'); page.keyboard.press('Tab'); ok('أول Tab يركّز رابط التخطّي', page.evaluate("document.activeElement.className")=='skip-link')

    # ----- الأداء (محاكاة جوال متوسط: CPU×4، شبكة 4G بطيئة) -----
    ctx2=b.new_context(viewport={'width':412,'height':823},device_scale_factor=2,is_mobile=True); pg=ctx2.new_page(); c2=ctx2.new_cdp_session(pg)
    c2.send('Network.enable'); c2.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':1.6*1024*1024/8,'uploadThroughput':750*1024/8})
    c2.send('Emulation.setCPUThrottlingRate',{'rate':4})
    pg.add_init_script("""window.__m={cls:0,lcp:0,long:0};new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)__m.cls+=e.value}).observe({type:'layout-shift',buffered:true});
      new PerformanceObserver(l=>{for(const e of l.getEntries())__m.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(l=>{for(const e of l.getEntries())__m.long+=Math.max(0,e.duration-50)}).observe({type:'longtask',buffered:true});""")
    pg.goto(BASE+'index.html'); pg.wait_for_selector('.app-card'); pg.wait_for_timeout(2500)
    perf=pg.evaluate("""()=>{const n=performance.getEntriesByType('navigation')[0];const fcp=performance.getEntriesByName('first-contentful-paint')[0];const res=performance.getEntriesByType('resource');
      return {fcp:fcp&&fcp.startTime,lcp:__m.lcp,cls:__m.cls,tbt:__m.long,dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd,reqs:res.length+1,kb:Math.round((n.transferSize+res.reduce((a,r)=>a+r.transferSize,0))/1024),kbDecoded:Math.round((n.decodedBodySize+res.reduce((a,r)=>a+r.decodedBodySize,0))/1024)}}""")
    print('الأداء (جوال بطيء):', json.dumps(perf))
    ok('FCP < 1.8s', perf['fcp'] and perf['fcp']<1800, str(perf['fcp'])); ok('LCP < 2.5s', perf['lcp']<2500, str(perf['lcp'])); ok('CLS < 0.1', perf['cls']<0.1, str(perf['cls'])); ok('TBT < 200ms', perf['tbt']<200, str(perf['tbt']))
    warn('عدد الطلبات ≤ 30', perf['reqs']<=30, str(perf['reqs']))
    b.close()
print('\nFAILED:',fails) if fails else print('\nكل فحوص الجودة نجحت')
if warns: print('تنبيهات:',warns)
sys.exit(1 if fails else 0)
