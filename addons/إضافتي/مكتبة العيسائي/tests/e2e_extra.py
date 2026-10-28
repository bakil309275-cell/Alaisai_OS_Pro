"""اختبارات إضافية: python3 tests/e2e_extra.py  (يتطلب خادماً على BASE وplaywright)"""
import json, base64, re, os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8765/')
fails = []
def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

gh = {'blobs': {}, 'tree': {}}
def gh_route(route, req):
    u = req.url.replace('https://api.github.com', ''); m = req.method
    J = lambda o, s=200: route.fulfill(status=s, content_type='application/json', body=json.dumps(o))
    if m == 'GET' and re.fullmatch(r'/repos/[^/]+/[^/]+', u): return J({'default_branch': 'main', 'permissions': {'push': True}, 'full_name': 'o/r'})
    if '/git/ref/heads/' in u and m == 'GET': return J({'object': {'sha': 'h'}})
    if '/git/commits/h' in u: return J({'tree': {'sha': 't0'}})
    if u.endswith('/git/blobs'): sha = 'b%d' % len(gh['blobs']); gh['blobs'][sha] = base64.b64decode(json.loads(req.post_data)['content']); return J({'sha': sha}, 201)
    if u.endswith('/git/trees') and m == 'POST': gh['pending'] = json.loads(req.post_data)['tree']; return J({'sha': 't1'}, 201)
    if u.endswith('/git/commits') and m == 'POST': return J({'sha': 'c1'}, 201)
    if '/git/refs/heads/' in u and m == 'PATCH':
        for e in gh['pending']: gh['tree'][e['path']] = gh['blobs'].get(e['sha']) if e['sha'] else None
        return J({})
    if '/contents/' in u:
        p = u.split('/contents/')[1].split('?')[0]
        return route.fulfill(status=200, body=gh['tree'][p]) if gh['tree'].get(p) else J({'message': 'Not Found'}, 404)
    return J({'message': 'x'}, 500)

dlg = lambda pg: pg.locator('dialog[open]').last
def fill(pg, label, v): dlg(pg).locator('label', has_text=label).locator('input,textarea,select').first.fill(v)
def btn(pg, t): dlg(pg).locator('.dlg-foot').get_by_role('button', name=t, exact=True).click()
def toast(pg): return pg.inner_text('#toast')
def idb(pg, js): return pg.evaluate(js)

with sync_playwright() as p:
    b = p.chromium.launch()
    # ================= 1) ترحيل بيانات النسخة القديمة =================
    c0 = b.new_context()
    pg = c0.new_page()
    legacy = {'types': [{'id': 'models', 'icon': '📄', 'title': 'النماذج', 'categories': [{'title': 'العقود', 'examples': [{'title': 'عقد قديم', 'text': 'نص قديم', 'files': []}]}]}]}
    pg.add_init_script("if(!localStorage.getItem('__seeded')){localStorage.setItem('__seeded','1');localStorage.setItem('maktabat_alaysaei_meta_vfinal',JSON.stringify(%s));localStorage.setItem('maktabat_alaysaei_admin_vfinal','oldpass1');}" % json.dumps(legacy))
    pg.goto(BASE); pg.wait_for_selector('.strip-item'); pg.click('.cat-row'); pg.wait_for_timeout(200)
    ok(pg.locator('.item-row', has_text='عقد قديم').count() == 1, 'ترحيل بيانات النسخة القديمة')
    ok(pg.evaluate("localStorage.getItem('maktabat_alaysaei_admin_vfinal')") is None, 'كلمة المرور القديمة لم تعد نصاً صريحاً')
    pg.click('#btn-admin'); fill(pg, 'كلمة المرور', 'oldpass1'); btn(pg, 'دخول'); pg.wait_for_selector('body.admin')
    ok(True, 'الدخول بكلمة المرور القديمة بعد التجزئة')
    c0.close()

    # ================= 2) كلمة المرور الخاطئة + تغييرها =================
    ctx = b.new_context(accept_downloads=True); ctx.route('https://api.github.com/**', gh_route)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('.strip-item')
    pg.click('#btn-admin'); fill(pg, 'كلمة المرور (6', 'pw123456'); fill(pg, 'تأكيد', 'pw123456'); btn(pg, 'إنشاء'); pg.wait_for_selector('body.admin')
    pg.click('text=＋ إضافة قسم'); fill(pg, 'اسم القسم', 'قسم'); btn(pg, 'حفظ'); pg.wait_for_selector('.cat-row')
    pg.click('text=🔒 قفل')
    pg.click('#btn-admin'); fill(pg, 'كلمة المرور', 'wrong-one'); btn(pg, 'دخول'); pg.wait_for_timeout(1500)
    ok('غير صحيحة' in toast(pg) and pg.locator('body.admin').count() == 0, 'كلمة مرور خاطئة تُرفض')
    fill(pg, 'كلمة المرور', 'pw123456'); btn(pg, 'دخول'); pg.wait_for_selector('body.admin'); ok(True, 'كلمة المرور الصحيحة تفتح')
    # تغيير كلمة المرور
    pg.click('#btn-admin'); pg.click('text=تغيير كلمة المرور'); fill(pg, 'الحالية', 'bad'); fill(pg, 'الجديدة', 'newpass99'); fill(pg, 'تأكيد الجديدة', 'newpass99'); btn(pg, 'تغيير'); pg.wait_for_timeout(1200)
    ok('غير صحيحة' in toast(pg), 'تغيير كلمة المرور يرفض الحالية الخاطئة')
    fill(pg, 'الحالية', 'pw123456'); btn(pg, 'تغيير'); pg.wait_for_timeout(1200); ok('تم تغيير' in toast(pg), 'تغيير كلمة المرور')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('text=🔒 قفل'); pg.click('#btn-admin'); fill(pg, 'كلمة المرور', 'pw123456'); btn(pg, 'دخول'); pg.wait_for_timeout(1500)
    ok(pg.locator('body.admin').count() == 0, 'القديمة لم تعد تعمل بعد التغيير')
    fill(pg, 'كلمة المرور', 'newpass99'); btn(pg, 'دخول'); pg.wait_for_selector('body.admin'); ok(True, 'الجديدة تعمل')

    # ================= 3) عنصر + تصدير مشفّر + حذف نهائي + استيراد =================
    pg.click('text=➕ نموذج جديد'); fill(pg, 'العنوان', 'بند أ'); fill(pg, 'النص', 'نص البند الأول'); btn(pg, 'إضافة'); pg.wait_for_timeout(300)
    pg.click('#btn-admin'); pg.click('text=تصدير نسخة كاملة (ملف)'); fill(pg, 'عبارة تشفير', 'exportpass1')
    with pg.expect_download() as d: btn(pg, 'تصدير')
    exp = d.value.path(); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('.item-row.sel .dots'); pg.click('.menu >> text=حذف (إلى السلة)'); pg.wait_for_timeout(200)
    pg.click('text=/🗑️ السلة/'); dlg(pg).locator('.trash-row input').check(); btn(pg, 'حذف نهائي للمحدد'); pg.wait_for_timeout(200); btn(pg, 'حذف نهائي'); pg.wait_for_timeout(300); btn(pg, 'إغلاق')
    pg.fill('#search', 'البند الأول'); pg.wait_for_timeout(200); ok(pg.locator('.result').count() == 0, 'الحذف النهائي يزيل العنصر'); pg.fill('#search', '')
    pg.click('#btn-admin')
    with pg.expect_file_chooser() as fc: pg.click('text=استيراد نسخة من ملف')
    fc.value.set_files(exp); pg.wait_for_timeout(300)
    ok('مشفّرة' in dlg(pg).inner_text(), 'الاستيراد يطلب العبارة للنسخة المشفّرة')
    fill(pg, 'عبارة التشفير', 'WRONGPASS1'); btn(pg, 'متابعة'); pg.wait_for_timeout(1500)
    ok('غير صحيحة' in toast(pg), 'عبارة خاطئة تُرفض')
    fill(pg, 'عبارة', 'exportpass1'); btn(pg, 'متابعة'); pg.wait_for_timeout(1500)
    ok('تحتوي النسخة على' in dlg(pg).inner_text(), 'عبارة صحيحة تفتح النسخة')
    btn(pg, 'استيراد'); pg.wait_for_timeout(1200); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.fill('#search', 'البند الأول'); pg.wait_for_timeout(200); ok(pg.locator('.result').count() == 1, 'الاستيراد أعاد العنصر المحذوف نهائياً'); pg.fill('#search', '')

    # ================= 4) استعادة من GitHub =================
    pg.click('#btn-admin'); pg.click('text=المستودع والرمز'); fill(pg, 'رمز الوصول', 'ghp_X'); btn(pg, 'حفظ واختبار'); pg.wait_for_timeout(600); pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('text=☁️ المزامنة والنشر'); dlg(pg).get_by_role('button', name='حفظ النسخة').click(); fill(pg, 'عبارة التشفير', 'ghbackup-1'); fill(pg, 'تأكيد العبارة', 'ghbackup-1'); btn(pg, 'متابعة'); pg.wait_for_timeout(1500)
    ok(gh['tree'].get('backup/library.enc.json') is not None, 'رُفعت نسخة مشفّرة')
    pg.keyboard.press('Escape')
    pg.click('.item-row.sel .dots') if pg.locator('.item-row.sel').count() else None
    pg.keyboard.press('Escape')
    # امسح العنصر نهائياً ثم استعد من GitHub
    pg.fill('#search', 'البند الأول'); pg.wait_for_timeout(200); pg.locator('.result .item-row').first.click(); pg.fill('#search', ''); pg.wait_for_timeout(200)
    pg.click('.item-row.sel .dots'); pg.click('.menu >> text=حذف (إلى السلة)'); pg.wait_for_timeout(200)
    pg.click('text=/🗑️ السلة/'); btn(pg, 'تفريغ السلة'); pg.wait_for_timeout(200); btn(pg, 'تفريغ'); pg.wait_for_timeout(300); btn(pg, 'إغلاق')
    pg.click('text=☁️ المزامنة والنشر'); dlg(pg).get_by_role('button', name='استعادة', exact=True).click(); pg.wait_for_timeout(500)
    fill(pg, 'عبارة', 'ghbackup-1'); btn(pg, 'متابعة'); pg.wait_for_timeout(1500); btn(pg, 'استيراد'); pg.wait_for_timeout(1200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.fill('#search', 'البند الأول'); pg.wait_for_timeout(200); ok(pg.locator('.result').count() == 1, 'الاستعادة من GitHub أعادت العنصر'); pg.fill('#search', '')

    # ================= 5) أزرار الخط =================
    pg.locator('.item-row').first.click(); pg.wait_for_timeout(200)
    before = pg.evaluate("getComputedStyle(document.querySelector('.viewer')).fontSize")
    pg.click('#btn-font-up'); after = pg.evaluate("getComputedStyle(document.querySelector('.viewer')).fontSize")
    ok(float(after[:-2]) > float(before[:-2]), 'تكبير الخط يعمل (%s→%s)' % (before, after))
    # ================= 6) أزرار المراسلة والتثبيت =================
    vc = b.new_context(); vp = vc.new_page(); vp.goto(BASE); vp.wait_for_selector('.strip-item')
    ok(vp.locator('#send-wa').is_enabled() and vp.locator('#send-mail').is_enabled(), 'زرا واتساب والبريد غير معطّلين')
    vp.fill('#visitor-message', 'مرحبا'); vp.click('#send-wa'); vp.wait_for_timeout(300)
    ok('غير مفعّلة' in dlg(vp).inner_text(), 'الزائر يرى رسالة واضحة إن لم تُضبط الوسيلة')
    vp.keyboard.press('Escape')
    ok(vp.locator('#btn-install').is_visible(), 'زر التثبيت ظاهر دائماً')
    vp.click('#btn-install'); vp.wait_for_timeout(300); ok('تثبيت' in dlg(vp).inner_text(), 'زر التثبيت يعرض دليلاً عند غياب الحدث')
    vc.close()
    # المسؤول: يُعرض عليه فتح إعدادات التواصل
    pg.fill('#visitor-message', 'اختبار'); pg.click('#send-mail'); pg.wait_for_timeout(300)
    ok('فتح الإعدادات' in dlg(pg).inner_text() or 'لم تضبط' in dlg(pg).inner_text(), 'المسؤول يُرشد لضبط التواصل')
    btn(pg, 'فتح الإعدادات'); fill(pg, 'رقم واتساب', '967771234567'); fill(pg, 'البريد', 'a@b.com'); btn(pg, 'حفظ'); pg.wait_for_timeout(400)
    ctx.route('https://wa.me/**', lambda r, q: r.fulfill(status=200, content_type='text/html', body='ok'))
    with ctx.expect_page() as np_:
        pg.click('#send-wa')
    np_.value.wait_for_load_state()
    ok('wa.me/967771234567' in np_.value.url and 'text=' in np_.value.url, 'واتساب يفتح الرابط الصحيح بعد ضبط الرقم')
    ok(not errs, 'لا أخطاء JS: ' + '; '.join(errs[:3]))
    b.close()
print('\nFAILS:', fails); sys.exit(1 if fails else 0)
