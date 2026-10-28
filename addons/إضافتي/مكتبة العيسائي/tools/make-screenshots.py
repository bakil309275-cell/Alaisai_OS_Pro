"""يولّد لقطات الشاشة لـ manifest من بيانات نموذجية: python3 tools/make-screenshots.py  (خادم على BASE)"""
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8765/')
ITEMS = [('models', 'العقود المدنية', [('نموذج عقد بيع ابتدائي', 'عقد بيع ابتدائي\n\nحُرر هذا العقد بتاريخ [التاريخ] بين كل من:\n1) [اسم البائع] ويُسمى «الطرف الأول».\n2) [اسم المشتري] ويُسمى «الطرف الثاني».\n\nالبند الأول: يبيع الطرف الأول للطرف الثاني [وصف المبيع] بثمن قدره [المبلغ].\nالبند الثاني: يلتزم الطرف الثاني بسداد الثمن عند [موعد السداد].\nالبند الثالث: يختص القضاء بالفصل في أي نزاع ينشأ عن هذا العقد.'), ('نموذج عقد إيجار', 'عقد إيجار\n\nالطرف الأول (المؤجر): [الاسم]\nالطرف الثاني (المستأجر): [الاسم]\nمدة الإيجار: [المدة] بأجرة قدرها [المبلغ].'), ('نموذج مخالصة مالية', 'أقر أنا [الاسم] باستلام مبلغ [المبلغ] وأبرئ ذمة [الاسم] إبراءً تاماً.')]),
         ('models', 'الدعاوى', [('صيغة عريضة دعوى', 'بسم الله الرحمن الرحيم\n\nإلى فضيلة رئيس [المحكمة]\n\nعريضة دعوى\n\nالوقائع: [..]\nالطلبات: [..]')]),
         ('laws', 'القوانين الإجرائية', [('ملخص مواعيد الطعن', 'جدول إرشادي لمواعيد الطعن (للاستئناس فقط): راجع النص النافذ دائماً.')])]
SEED = """async (items)=>{const L=await import('./js/lib.js');for(const [t,cat,list] of items){const T=L.S.tree.types.find(x=>x.id===t);const c=T.cats.find(x=>x.title===cat)||await L.addCat(t,cat);for(const [title,text] of list)await L.saveItem({typeId:t,catId:c.id,title,kind:'text',text,pub:true});}}"""
os.makedirs('screenshots', exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in [('narrow-1-home', {'width': 540, 'height': 960}), ('wide-1-home', {'width': 1280, 'height': 720})]:
        c = b.new_context(viewport=vp); pg = c.new_page(); pg.goto(BASE); pg.wait_for_selector('.strip-item')
        pg.evaluate(SEED, ITEMS); pg.reload(); pg.wait_for_selector('.strip-item'); pg.wait_for_timeout(300)
        pg.locator('.cat-row').first.click(); pg.wait_for_timeout(150); pg.locator('.item-row').first.click(); pg.wait_for_timeout(300)
        pg.evaluate('window.scrollTo(0,0)'); pg.screenshot(path=f'screenshots/{name}.png'); c.close()
    b.close()
