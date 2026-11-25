# اختبار القوائم الهرمية (5 مستويات): python3 tools/sectors/test_tree.py med 390
import json,sys,os
from playwright.sync_api import sync_playwright
R=os.path.dirname(os.path.abspath(__file__))+'/'
sec=sys.argv[1] if len(sys.argv)>1 else 'med'; W=int(sys.argv[2]) if len(sys.argv)>2 else 390
S={x['id']:x['folder'] for x in json.load(open(R+'sectors.json'))}; folder=S[sec]
pkg=json.load(open(f'{R}out/{folder}.alaisai-addon.json')); fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':W,'height':860 if W>600 else 800},service_workers='block'); page=ctx.new_page()
    page.goto('http://localhost:8765/index.html'); page.wait_for_selector('.start-card'); page.wait_for_timeout(500)
    page.evaluate("""p=>{const a=Addons.validatePackage(p);Addons.put({name:p.id,files:a.files||p.files},'local');Addons.install(p.id)}""",pkg)
    page.locator('.app-card',has_text=folder.split()[0]).first.click(); page.wait_for_timeout(1500)
    fr=page.frame_locator('iframe').first; frame=[f for f in page.frames if f!=page.main_frame][0]
    nav=lambda k: fr.locator(f'#{"tabs" if W<=820 else "rail"} [data-t={k}]').click()
    nav('cat'); fr.locator('.bar [data-act=newRec]').click(); page.wait_for_timeout(250)
    pb=fr.locator('.pickb').first; pb.click(); page.wait_for_timeout(150)
    n0=fr.locator('.pk .pl li').count()
    for lv in range(1,5):
        fr.locator('.pk [data-a]').nth(0 if lv==1 else 0).click(); page.wait_for_timeout(80)
        fr.locator('.pk [data-nv]').fill(f'م{lv+1}'); fr.locator('.pk [data-add]').click(); page.wait_for_timeout(120)
        if lv<4: pass
    # الأول (مستوى 1) → م2 → ...: نضيف تحت أحدث عقدة
    frame.evaluate("""()=>{const k=Object.keys(DB.opts)[0];}""")
    tree=frame.evaluate("JSON.stringify(Object.values(DB.opts)[0])")
    check('أُنشئت فروع متداخلة', 'م2' in tree, tree[:200])
    # أنشئ سلسلة عمق 5 صراحة
    frame.evaluate("""()=>{const k=Object.keys(DB.opts)[0];DB.opts[k]=[{n:'أ',c:[{n:'ب',c:[{n:'ج',c:[{n:'د',c:[{n:'هـ',c:[]}]}]}]}]},'جذر ثانٍ'];persist()}""")
    fr.locator('.pk [data-x]').click(); page.wait_for_timeout(100); pb.click(); page.wait_for_timeout(150)
    check('الفروع مطوية افتراضياً', fr.locator('.pk .pl li.tn').count()==2, str(fr.locator('.pk .pl li').count()))
    fr.locator('.pk .tg').first.click(); page.wait_for_timeout(100)
    check('الطي والفتح بالمثلث', fr.locator('.pk .pl li.tn').count()==3)
    fr.locator('.pk [data-xall]').click(); page.wait_for_timeout(100)
    check('فتح الكل يعرض 5 مستويات', fr.locator('.pk .pl li.tn').count()==6, str(fr.locator('.pk .pl li').count()))
    check('لا زر إضافة فرع في المستوى الخامس', fr.locator('.pk li[aria-level="5"] [data-a]').count()==0 and fr.locator('.pk li[aria-level="4"] [data-a]').count()==1)
    page.screenshot(path=R+f'shots/tree_{W}.png')
    fr.locator('.pk li[aria-level="5"] .po').click(); page.wait_for_timeout(150)
    v=frame.evaluate("document.querySelector('.sheet input[type=hidden]').value")
    check('اختيار مسار كامل', v=='أ › ب › ج › د › هـ', v)
    pb.click(); page.wait_for_timeout(150)
    fr.locator('.pk li[aria-level="1"] [data-e]').first.click(); fr.locator('.pk [data-ev]').fill('أأ'); fr.locator('.pk [data-ok]').click(); page.wait_for_timeout(150)
    v=frame.evaluate("document.querySelector('.sheet input[type=hidden]').value")
    check('إعادة تسمية الأصل تحدّث المسار', v=='أأ › ب › ج › د › هـ', v)
    fr.locator('.pk li[aria-level="1"] [data-d]').first.click(); page.wait_for_timeout(150); fr.locator('.ask [data-y]').last.click(); page.wait_for_timeout(150)
    v=frame.evaluate("document.querySelector('.sheet input[type=hidden]').value")
    check('حذف الفرع بكل فروعه ويفرغ الاختيار', fr.locator('.pk .pl li.tn').count()==1 and v=='', f'{fr.locator(".pk .pl li").count()} {v}')
    fr.locator('.pk [data-x]').click(); page.wait_for_timeout(100)
    # شريط الفلاتر الهرمي
    fr.locator('.sheet header [data-close]').click(); page.wait_for_timeout(300)
    frame.evaluate("""()=>{const k=Object.keys(DB.opts)[0];DB.opts[k]=[{n:'ق1',c:[{n:'ف1',c:[{n:'ع1',c:[]}]},'ف2']},'ق2'];recs(CFG.lists[0].id).push({id:'zz1',[CFG.lists[0].primary]:'عنصر',[CFG.lists[0].filter]:'ق1 › ف1',created:Date.now()});persist();render()}""")
    page.wait_for_timeout(300)
    check('شريط الجذور يعرض كل الأقسام', fr.locator('.chipbar .chips').first.locator('.chip[data-act=flt]').count()>=3)
    fr.locator('.chip[data-k="ق1"]').click(); page.wait_for_timeout(200)
    check('تظهر فروع القسم المحدّد في صف ثانٍ', fr.locator('.chips.sub').count()==1 and fr.locator('.chips.sub .chip[data-k="ق1 › ف1"]').count()==1)
    fr.locator('.chip[data-k="ق1 › ف1"]').click(); page.wait_for_timeout(200)
    check('صف ثالث للمستوى الأعمق وتصفية العناصر', fr.locator('.chips.sub').count()==2 and fr.locator('#view .row').count()==1, str(fr.locator('.chips.sub').count()))
    page.screenshot(path=R+f'shots/chipbar_{W}.png')
    fr.locator('.chip[data-k="ق1 › ف1"]').click(); page.wait_for_timeout(200)
    check('الضغط على المحدّد يصعد درجة', fr.locator('.chip.on[data-k="ق1"]').count()==1)
    fr.locator('[data-act=fltEdit]').click(); page.wait_for_timeout(200)
    check('زر الأقسام يفتح المحرّر', fr.locator('.pk').count()==1 and fr.locator('.pk [data-e]').count()>=2)
    fr.locator('.pk [data-x]').click(); page.wait_for_timeout(100)
    page.reload(); page.wait_for_selector('.app-card'); page.locator('.app-card',has_text=folder.split()[0]).first.click(); page.wait_for_timeout(1500)
    frame=[f for f in page.frames if f!=page.main_frame][0]
    check('تُحفظ الشجرة بعد إعادة التشغيل', 'ق2' in frame.evaluate('JSON.stringify(Object.values(DB.opts))'))
    b.close()
print('FAILED',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
