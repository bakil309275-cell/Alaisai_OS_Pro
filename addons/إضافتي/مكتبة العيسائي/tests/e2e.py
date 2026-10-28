import json, base64, sys, re
from playwright.sync_api import sync_playwright

import os
BASE = os.environ.get('BASE', 'http://localhost:8765/')
OUT = os.environ.get('OUT', '/tmp')
fails = []
def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

# ---- خادم GitHub وهمي ----
gh = {'blobs': {}, 'commits': [], 'tree': {}}
def gh_route(route, req):
    u = req.url.replace('https://api.github.com', ''); m = req.method
    def J(o, s=200): route.fulfill(status=s, content_type='application/json', body=json.dumps(o))
    if m == 'GET' and re.fullmatch(r'/repos/[^/]+/[^/]+', u): return J({'default_branch': 'main', 'permissions': {'push': True}, 'private': False, 'full_name': 'o/r'})
    if '/git/ref/heads/' in u and m == 'GET': return J({'object': {'sha': 'head1'}})
    if '/git/commits/head1' in u: return J({'tree': {'sha': 'tree0'}})
    if u.endswith('/git/blobs'):
        body = json.loads(req.post_data); sha = 'b%d' % len(gh['blobs']); gh['blobs'][sha] = base64.b64decode(body['content']); return J({'sha': sha}, 201)
    if u.endswith('/git/trees') and m == 'POST':
        body = json.loads(req.post_data); gh['pending'] = body['tree']; return J({'sha': 'tree1'}, 201)
    if u.endswith('/git/commits') and m == 'POST': gh['msg'] = json.loads(req.post_data)['message']; return J({'sha': 'c1'}, 201)
    if '/git/refs/heads/' in u and m == 'PATCH':
        for e in gh['pending']:
            gh['tree'][e['path']] = gh['blobs'].get(e['sha']) if e['sha'] else None
        return J({'ok': 1})
    if '/git/trees/main' in u: return J({'tree': [{'type': 'blob', 'path': p} for p in gh['tree'] if gh['tree'][p] is not None]})
    if '/contents/' in u:
        p = u.split('/contents/')[1].split('?')[0]
        if gh['tree'].get(p): return route.fulfill(status=200, body=gh['tree'][p])
        return J({'message': 'Not Found'}, 404)
    return J({'message': 'unhandled ' + u}, 500)

def dlg(page): return page.locator('dialog[open]').last
def fill(page, label, val):
    dlg(page).locator('label', has_text=label).locator('input,textarea,select').first.fill(val)
def btn(page, text):
    dlg(page).locator('.dlg-foot').get_by_role('button', name=text, exact=True).click()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(accept_downloads=True, viewport={'width': 1200, 'height': 900}); ctx.route('https://api.github.com/**', gh_route)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); bad = []; pg.on('response', lambda r: bad.append(r.url) if r.status >= 400 else None); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    dialogs = []; pg.on('dialog', lambda d: (dialogs.append(d.message), d.accept()))
    pg.goto(BASE); pg.wait_for_selector('.strip-item')
    ok(pg.locator('.strip-item').count() >= 6, 'الأنواع الافتراضية تظهر')
    ok(pg.evaluate('navigator.serviceWorker.ready.then(()=>true)'), 'service worker جاهز')

    # كلمة المرور
    pg.click('#btn-admin'); fill(pg, 'كلمة المرور (6', 'secret123'); fill(pg, 'تأكيد', 'secret123'); btn(pg, 'إنشاء')
    pg.wait_for_selector('body.admin'); ok(True, 'إنشاء كلمة المرور ودخول الإدارة')
    # قسم
    pg.click('text=＋ إضافة قسم'); fill(pg, 'اسم القسم', 'العقود المدنية'); btn(pg, 'حفظ')
    pg.wait_for_selector('.cat-row'); ok(pg.locator('.cat-row').count() == 1, 'إضافة قسم')
    # نموذج (XSS في العنوان)
    pg.click('text=➕ نموذج جديد'); fill(pg, 'العنوان', '<img src=x onerror="window.__x=1"> عقد بيع'); fill(pg, 'النص', 'يبيع الطرف الأول للطرف الثاني <script>window.__y=1</script> السيارة');
    dlg(pg).locator('input[type=file]').set_input_files({'name': 'a.txt', 'mimeType': 'text/plain', 'buffer': b'hello'}); btn(pg, 'إضافة')
    pg.wait_for_selector('#viewer-content .t'); pg.wait_for_timeout(300)
    ok(pg.evaluate('window.__x') is None and pg.evaluate('window.__y') is None, 'لا تنفيذ لـ XSS في العنوان/النص')
    ok('<img' in pg.inner_text('#item-title'), 'العنوان يُعرض كنص')
    ok(pg.locator('.file-row').count() == 1, 'المرفق يظهر')
    # سري غير منشور
    pg.click('text=➕ نموذج جديد'); fill(pg, 'العنوان', 'ملف موكل سري'); fill(pg, 'النص', 'سري'); dlg(pg).locator('input[type=checkbox]').uncheck(); btn(pg, 'إضافة'); pg.wait_for_timeout(300)
    # بحث (تطبيع عربي: بيع / ابيع)
    pg.fill('#search', 'السياره'); pg.wait_for_timeout(200)
    ok(pg.locator('.result').count() == 1 and pg.locator('mark').count() >= 1, 'البحث العربي المطبَّع مع تظليل')
    pg.fill('#search', '')
    # محرر
    pg.click('text=✍️ محرر المستندات'); dlg(pg).locator('.editor-meta input[type=text]').fill('عريضة أحمد')
    dlg(pg).locator('#legal-editor').evaluate("e=>{e.innerHTML+='<p>نص العريضة</p><script>window.__z=1</script><img src=x onerror=window.__z=2>'}")
    btn(pg, '💾 حفظ في المكتبة'); pg.wait_for_selector('#viewer-content .doc'); pg.wait_for_timeout(300)
    ok('نص العريضة' in pg.inner_text('#viewer-content') and pg.evaluate('window.__z') is None, 'حفظ مستند المحرر وتعقيمه')
    # سلة
    pg.click('.item-row.sel .dots'); pg.click('.menu >> text=حذف (إلى السلة)'); pg.wait_for_timeout(300)
    pg.click('text=/🗑️ السلة/'); ok(dlg(pg).locator('.trash-row').count() == 1, 'العنصر المحذوف يظهر في السلة (حقيقي)')
    dlg(pg).locator('.trash-row input').check(); btn(pg, '♻️ استعادة المحدد'); pg.wait_for_timeout(300); btn(pg, 'إغلاق'); pg.wait_for_timeout(200)
    pg.fill('#search', 'عريضة'); pg.wait_for_timeout(200); ok(pg.locator('.result').count() == 1, 'الاستعادة من السلة تعمل'); pg.fill('#search', '')
    # تصدير/استيراد مشفّر
    pg.click('#btn-admin'); pg.click('text=تصدير نسخة كاملة (ملف)'); fill(pg, 'عبارة تشفير', 'passphrase1')
    with pg.expect_download() as d: btn(pg, 'تصدير')
    path = d.value.path(); data = open(path, encoding='utf-8').read(); ok('"alaisai": 1' in data.replace(':', ': ') or '"alaisai":1' in data, 'ملف التصدير مشفّر'); ok('عقد بيع' not in data, 'لا نص صريح في النسخة المشفّرة')
    # GitHub
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('#btn-admin'); pg.click('text=المستودع والرمز'); fill(pg, 'رمز الوصول', 'ghp_FAKE'); btn(pg, 'حفظ واختبار'); pg.wait_for_timeout(500)
    ok('نجح' in pg.inner_text('#toast') or 'اتصال' in pg.inner_text('#toast'), 'اختبار اتصال GitHub')
    tok = pg.evaluate("new Promise(r=>{const q=indexedDB.open('alaisai_library_v2');q.onsuccess=()=>{const g=q.result.transaction('kv').objectStore('kv').get('settings');g.onsuccess=()=>r(JSON.stringify(g.result.value))}})")
    ok('ghp_FAKE' not in tok and 'tokenEnc' in tok, 'الرمز مخزّن مشفّراً لا نصاً')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('text=☁️ المزامنة والنشر'); dlg(pg).get_by_role('button', name='نشر الآن').click(); pg.wait_for_timeout(300)
    ok('علنياً' in dlg(pg).inner_text(), 'تأكيد النشر يعرض ما سيُنشر'); btn(pg, 'نشر 1 عنصر'); pg.wait_for_timeout(1500)
    lib = gh['tree'].get('data/library.json'); ok(lib is not None, 'تم commit لـ data/library.json')
    libj = json.loads(lib); titles = [i['title'] for i in libj['items']]
    ok('ملف موكل سري' not in lib.decode() and len(titles) == 1 and 'عريضة أحمد' not in lib.decode(), 'العنصر غير المنشور لم يُرفع'); ok(any(k.startswith('data/files/') for k in gh['tree']), 'المرفق رُفع')
    # نسخة احتياطية
    dlg(pg).get_by_role('button', name='حفظ النسخة').click(); fill(pg, 'عبارة التشفير', 'backup-pass-1'); fill(pg, 'تأكيد العبارة', 'backup-pass-1'); btn(pg, 'متابعة'); pg.wait_for_timeout(1500)
    ok(gh['tree'].get('backup/library.enc.json') is not None and b'\xd9' not in gh['tree']['backup/library.enc.json'][:0] and 'ملف موكل' not in gh['tree']['backup/library.enc.json'].decode(), 'نسخة احتياطية مشفّرة على GitHub')
    pg.keyboard.press('Escape')
    # قفل
    pg.click('text=🔒 قفل'); ok(pg.locator('body.admin').count() == 0 and pg.locator('.dots').count() == 0, 'القفل يخفي أدوات التعديل')
    # عمل دون اتصال
    ctx.set_offline(True); pg.reload(); pg.wait_for_selector('.strip-item'); ok(pg.locator('.strip-item').count() >= 6, 'يعمل دون اتصال بعد التحميل الأول'); ctx.set_offline(False)
    errs = [e for e in errs if 'Content Security Policy' not in e and 'Failed to load resource' not in e]
    ok(all(u.endswith('/x') for u in bad), 'لا طلبات فاشلة سوى حمولة الاختبار المقصودة /x: %s' % bad)
    ok(not errs, 'لا أخطاء في الكونسول: ' + '; '.join(errs[:3]))

    # ---- زائر جديد يرى المكتبة المنشورة فقط ----
    v = b.new_context(viewport={'width': 400, 'height': 800});
    v.route('**/data/library.json', lambda r, q: r.fulfill(status=200, content_type='application/json', body=lib))
    v.route('**/data/files/*', lambda r, q: r.fulfill(status=200, body=b'hello'))
    vp = v.new_page(); verr = []; vp.on('pageerror', lambda e: verr.append(str(e))); vp.goto(BASE); vp.wait_for_selector('.strip-item'); vp.wait_for_timeout(800)
    vp.click('.strip-item >> text=النماذج'); vp.click('.cat-row'); vp.wait_for_timeout(200)
    ok(vp.locator('.item-row').count() == 1, 'الزائر يرى النماذج المنشورة'); ok(vp.locator('.dots').count() == 0 and vp.locator('text=ملف موكل سري').count() == 0, 'الزائر بلا أدوات تعديل ولا يرى الخاص')
    vp.locator('.item-row').first.click(); vp.wait_for_selector('.file-row')
    with vp.expect_download() as dd: vp.click('.file-row >> text=تنزيل')
    ok(open(dd.value.path(), 'rb').read() == b'hello', 'تنزيل مرفق منشور')
    ok(vp.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), 'لا تمرير أفقي على الهاتف')
    vp.screenshot(path=OUT + '/mobile.png')
    ok(not verr, 'زائر بلا أخطاء JS')
    pg.screenshot(path=OUT + '/desk.png')
    b.close()
print('\nFAILS:', fails); sys.exit(1 if fails else 0)
