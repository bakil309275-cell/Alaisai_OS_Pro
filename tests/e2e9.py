# المشاركة والإطلاق: python3 tests/e2e9.py (يتطلب خادماً على 8765؛ يفك QR بـ cv2 إن وُجدت)
import sys,base64,io
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/index.html'; fails=[]
def check(n,c,x=''):
    print(('✓ ' if c else '✗ ')+n,'' if c else x)
    if not c: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); page=b.new_context(viewport={'width':360,'height':740},service_workers='block').new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(BASE); page.wait_for_selector('.app-card'); page.wait_for_timeout(600)
    btns=page.locator('.bar-actions .icon-btn:visible'); n=btns.count(); boxes=[btns.nth(i).bounding_box() for i in range(n)]
    check('أزرار الشريط كلها داخل الشاشة (360px)', all(bx and bx['x']>=0 and bx['x']+bx['width']<=360 for bx in boxes), str(boxes))
    page.screenshot(path='/tmp/header360.png',clip={'x':0,'y':0,'width':360,'height':70})
    page.locator('#share-btn').click(); page.wait_for_selector('.share-dlg')
    url=page.evaluate("Share.url()"); msg=page.locator('#sh-msg').input_value()
    check('الرسالة تحوي الرابط', url in msg and url.startswith('https://'), url)
    data=page.evaluate("document.querySelector('.share-qr canvas').toDataURL('image/png')")
    try:
        import cv2,numpy as np
        img=cv2.imdecode(np.frombuffer(base64.b64decode(data.split(',')[1]),np.uint8),cv2.IMREAD_GRAYSCALE); img=cv2.resize(img,None,fx=2,fy=2,interpolation=cv2.INTER_NEAREST)
        val,_,_=cv2.QRCodeDetector().detectAndDecode(img); check('رمز QR يُقرأ ويطابق الرابط', val==url, repr(val))
    except ImportError: print('تخطّي فك QR (cv2 غير متاح)')
    page.screenshot(path='/tmp/share.png')
    page.locator('[data-s=link]').click(); page.wait_for_timeout(200)
    page.locator('[data-s=x0]').click(); page.wait_for_timeout(100); check('الإغلاق', page.locator('.share-dlg').count()==0)
    check('صفر أخطاء JS', not [e for e in errs if 'serviceWorker' not in e], str(errs))
    b.close()
print('FAILED',fails) if fails else print('ALL OK'); sys.exit(1 if fails else 0)
