# اختبار إضافة قطاع: python3 tools/sectors/test.py med 1100  (يتطلب خادماً على 8765 وبناءً سابقاً)
import json,sys,struct,zlib
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; R=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/'
sec=sys.argv[1]; W=int(sys.argv[2]) if len(sys.argv)>2 else 1100
S={x['id']:x['folder'] for x in json.load(open(R+'sectors.json'))}; folder=S[sec]
pkg=json.load(open(f'{R}out/{folder}.alaisai-addon.json')); fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
def png(r,g,b,n=40):
    def ch(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    row=b'\x00'+bytes([r,g,b])*n
    return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',n,n,8,2,0,0,0))+ch(b'IDAT',zlib.compress(row*n))+ch(b'IEND',b'')
open('/tmp/p1.png','wb').write(png(200,40,40)); open('/tmp/p2.png','wb').write(png(30,90,200))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); ctx=b.new_context(viewport={'width':W,'height':860 if W>600 else 800},service_workers='block',accept_downloads=True); page=ctx.new_page()
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(500)
    page.evaluate("""p=>{const a=Addons.validatePackage(p);Addons.put({name:p.id,files:a.files||p.files},'local');Addons.install(p.id)}""",pkg)
    def op():
        page.locator('.app-card',has_text=folder.split()[0]).first.click(); page.wait_for_timeout(1500); return page.frame_locator('iframe').first
    fr=op(); frame=[f for f in page.frames if f!=page.main_frame][0]
    nav=lambda k: fr.locator(f'#{"tabs" if W<=820 else "rail"} [data-t={k}]').click()
    O=f'{R}shots/{sec}_{W}_'
    check('الصفحة الرئيسية تظهر', fr.locator('.card-id').count()==1); page.screenshot(path=O+'1home.png')
    # ملفي
    nav('me'); fr.locator('[data-act=editMe]').click(); fr.locator('#f_name').fill('جهة الاختبار'); fr.locator('#f_gov').fill('عدن'); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(300)
    fr.locator('[data-act=addC][data-k=phones]').click(); fr.locator('#f_v').fill('+967 777 123 456'); fr.locator('#f_t').fill('واتساب'); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(300)
    with page.expect_file_chooser() as fc: fr.locator('[data-act=logo]').click()
    fc.value.set_files('/tmp/p1.png'); page.wait_for_timeout(800)
    check('الشعار دائري يُحفظ', fr.locator('.card-id .av img').count()==1 and frame.evaluate("DB.profile.logo.startsWith('data:image')"))
    check('الهاتف في الملف', '777 123 456' in fr.locator('#view').inner_text())
    # كتالوج: سجل بصورتين
    nav('cat'); fr.locator('.bar [data-act=newRec]').click(); page.wait_for_timeout(200)
    first=frame.evaluate("CFG.lists[0].fields[0].n"); fr.locator(f'#f_{first}').fill('صنف اختبار')
    st=frame.evaluate("CFG.lists[0].stock?CFG.lists[0].stock:null")
    if st: fr.locator(f'#f_{st["qty"]}').fill('3'); fr.locator(f'#f_{st["min"]}').fill('5')
    with page.expect_file_chooser() as fc: fr.locator('[data-add]').click()
    fc.value.set_files(['/tmp/p1.png','/tmp/p2.png']); page.wait_for_timeout(1200)
    check('صورتان في النموذج', fr.locator('.phe .pe .th img').count()==2, str(fr.locator('.phe .pe').count())); page.screenshot(path=O+'2form.png')
    fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(600)
    check('الصف مع صورة مصغّرة', fr.locator('.row .th img').count()==1)
    page.screenshot(path=O+'3cat.png')
    # قوائم منسدلة قابلة للتعديل
    fr.locator('.bar [data-act=newRec]').click(); page.wait_for_timeout(250)
    pb=fr.locator('.pickb').first; n0=frame.evaluate("optsOf(CFG.lists[0].fields.find(f=>f.t==='select')).length")
    check('الحقل يبدأ بأول خيار', pb.inner_text().strip()!='اختر…', pb.inner_text()); pb.click(); page.wait_for_timeout(150)
    check('القائمة تعرض كل الخيارات مع قلم وسلة', fr.locator('.pk .pl li').count()==n0 and fr.locator('.pk [data-e]').count()==n0 and fr.locator('.pk [data-d]').count()==n0, str(fr.locator('.pk .pl li').count())); page.screenshot(path=O+'6picker.png')
    fr.locator('.pk [data-nv]').fill('خيار مضاف'); fr.locator('.pk [data-add]').click(); page.wait_for_timeout(200)
    check('إضافة خيار جديد واختياره', pb.inner_text().strip()=='خيار مضاف' and fr.locator('.pk').count()==0)
    pb.click(); page.wait_for_timeout(150); check('الخيار الجديد في القائمة', fr.locator('.pk .pl li').count()==n0+1)
    fr.locator(f'.pk [data-e="{n0}"]').click(); fr.locator('.pk [data-ev]').fill('خيار معدّل'); fr.locator('.pk [data-ok]').click(); page.wait_for_timeout(150)
    check('تعديل الخيار يحدّث الحقل', pb.inner_text().strip()=='خيار معدّل', pb.inner_text())
    fr.locator('.pk [data-d="0"]').click(); page.wait_for_timeout(150); fr.locator('.ask [data-y]').last.click(); page.wait_for_timeout(150)
    check('حذف خيار من القائمة', fr.locator('.pk .pl li').count()==n0)
    fr.locator('.pk [data-i="0"]').click(); page.wait_for_timeout(150)
    check('اختيار خيار', pb.inner_text().strip()!='خيار معدّل' and frame.evaluate("document.querySelector('.sheet input[type=hidden]').value")==pb.inner_text().strip())
    fr.locator('.sheet header [data-close]').click(); page.wait_for_timeout(300)
    check('القائمة المعدّلة تُحفظ', frame.evaluate("Object.values(DB.opts).some(a=>a.includes('خيار معدّل'))"))
    # قائمة الإجراءات
    fr.locator('[data-act=recMenu]').first.click(); page.wait_for_timeout(200); check('قائمة الثلاث نقاط', fr.locator('.menu .mi').count()==8); fr.locator('[data-k=vis]').click(); page.wait_for_timeout(200)
    check('جعله خاصاً', frame.evaluate("DB.lists[CFG.lists[0].id][0].vis")=='prv')
    fr.locator('[data-act=recMenu]').first.click(); fr.locator('[data-k=hide]').click(); page.wait_for_timeout(200); check('إخفاء', fr.locator('.row').count()==0 or fr.locator('.chip',has_text='المخفي').count()==1)
    fr.locator('.chip',has_text='المخفي').click(); page.wait_for_timeout(150); fr.locator('[data-act=recMenu]').first.click(); fr.locator('[data-k=hide]').click(); fr.locator('[data-k=vis]').count()
    page.wait_for_timeout(200); fr.locator('.chip',has_text='الكل').first.click(); page.wait_for_timeout(150)
    fr.locator('[data-act=recMenu]').first.click(); fr.locator('[data-k=vis]').click(); page.wait_for_timeout(200)
    fr.locator('[data-act=viewRec]').first.click(); page.wait_for_timeout(500); check('العرض مع معرض صور', fr.locator('.gal .th img').count()==2); page.screenshot(path=O+'4view.png'); fr.locator('.sheet header [data-close]').click()
    # حجز + دفعة
    nav('book'); fr.locator('[data-act=newBook]').first.click(); fr.locator('#f_name').fill('عميل اختبار'); fr.locator('#f_agreed').fill('1000'); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(300)
    print(frame.evaluate('JSON.stringify(DB.bookings)')); fr.locator('[data-act=viewBook]').first.click(); page.wait_for_timeout(300); fr.locator('[data-k=pay]').click(); page.wait_for_timeout(200)
    fr.locator('#f_amount').fill('400'); page.wait_for_timeout(150); check('المتبقي مباشرة 600', '600' in fr.locator('.live').inner_text(), fr.locator('.live').inner_text())
    with page.expect_file_chooser() as fc: fr.locator('.phe [data-add]').click()
    fc.value.set_files('/tmp/p2.png'); page.wait_for_timeout(700); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(500)
    check('الدفعة والمتبقي', '600' in fr.locator('.sheet .ledger').inner_text() and fr.locator('.sheet [data-prt]').count()==1); page.screenshot(path=O+'5book.png'); fr.locator('.sheet header [data-close]').click()
    # منشور واستفسار
    nav('msg'); fr.locator('[data-act=draftPost]').click(); page.wait_for_timeout(200); fr.locator('[data-i]').first.click(); page.wait_for_timeout(300)
    check('نص مقترح', 'صنف اختبار' in fr.locator('#f_text').input_value() or 'صنف اختبار' in fr.locator('#f_title').input_value()); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(300)
    fr.locator('[data-act=seg][data-k=inq]').click(); fr.locator('[data-act=newInq]').click(); fr.locator('#f_from').fill('سائل'); fr.locator('#f_text').fill('كم السعر؟'); fr.locator('#f_phone').fill('+967 700 000 000'); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(300)
    check('استفسار محفوظ', frame.evaluate("DB.inquiries.length")==1); page.screenshot(path=O+'6msg.png')
    # الرئيسية: إحصاءات وتنبيهات
    nav('home'); page.wait_for_timeout(300); t=fr.locator('#view').inner_text(); check('إحصاءات المتبقي', '600' in t, t[:200])
    if st: check('تنبيه النفاد', 'نفاد قريب' in t)
    check('الأكثر نشاطاً', 'عميل اختبار' in t); page.screenshot(path=O+'7home.png')
    # بحث شامل
    fr.locator('#top [data-act=search], #rail [data-act=search]').first.click() if False else frame.evaluate("A.search()"); page.wait_for_timeout(200); fr.locator('#gq').fill('عميل'); page.wait_for_timeout(200); check('بحث شامل', fr.locator('#gres .row').count()>=1)
    fr.locator('.sheet header [data-close]').click()
    # الكتالوج للمشاركة
    nav('me'); 
    with page.expect_download() as dl: fr.locator('[data-act=exportCatalog]').click()
    html=open(dl.value.path(),encoding='utf8').read(); check('كتالوج HTML مستقل', 'جهة الاختبار' in html and 'صنف اختبار' in html and 'data:image/jpeg' in html and '<script' not in html, html[:100])
    # نسخة احتياطية
    with page.expect_download() as dl: fr.locator('[data-act=export]').click()
    bk=json.load(open(dl.value.path())); check('نسخة احتياطية', bk['sector']==sec and len(bk['bookings'])==1)
    # صورة ترحيبية
    with page.expect_file_chooser() as fc: fr.locator('[data-act=splashPick]').click()
    fc.value.set_files('/tmp/p2.png'); page.wait_for_timeout(700); fr.locator('[data-act=splashTest]').click(); page.wait_for_timeout(400)
    check('الصورة الترحيبية تظهر', fr.locator('.splash img').count()==1); page.wait_for_timeout(3600); check('وتختفي تلقائياً', fr.locator('.splash').count()==0)
    page.screenshot(path=O+'8me.png')
    # قفل
    fr.locator('[data-act=lockSet]').click(); fr.locator('#f_a').fill('1234'); fr.locator('#f_b').fill('1234'); fr.locator('.sheet form button[type=submit]').click(); page.wait_for_timeout(800)
    frame.evaluate("flush()"); page.wait_for_timeout(1200); page.evaluate("Store.flush()"); page.wait_for_timeout(900)
    print('KEYS',page.evaluate("Object.keys(Store.db.appData['addon:'+CFGNAME]||{})".replace('CFGNAME',json.dumps(folder))))
    page.reload(); page.wait_for_selector('.app-card'); fr=op()
    print('KEYS2',page.evaluate("Object.keys(Store.db.appData['addon:'+CFGNAME]||{})".replace('CFGNAME',json.dumps(folder))))
    check('شاشة القفل بعد إعادة التحميل', fr.locator('.lockscr').count()==1)
    fr.locator('#lp').fill('0000'); fr.locator('.lockscr button').click(); page.wait_for_timeout(1200); check('كلمة خاطئة', 'غير صحيحة' in fr.locator('#le').inner_text())
    fr.locator('#lp').fill('1234'); fr.locator('.lockscr button').click(); page.wait_for_timeout(1500); check('الدخول', fr.locator('.lockscr').count()==0)
    frame=[f for f in page.frames if f!=page.main_frame][0]; check('القوائم المخصّصة باقية بعد إعادة التحميل', frame.evaluate("Object.values(DB.opts).some(a=>a.includes('خيار معدّل'))"))
    nav('cat'); page.wait_for_timeout(500); check('البيانات والصور باقية', fr.locator('.row .th img').count()==1)
    errs=[e for e in errs if 'serviceWorker' not in e]; check('لا أخطاء JS', not errs, str(errs))
    b.close()
print('FAILED',fails) if fails else print('ALL OK')
