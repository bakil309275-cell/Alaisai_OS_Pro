"""اختبار شامل لإضافة الطب في متصفح حقيقي بحجم هاتف: python3 -I tests/e2e_medical.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "addons/medical/index.html").as_uri()
SHOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests/shots"
SHOT.mkdir(parents=True, exist_ok=True)
ok = 0

def check(cond, msg):
    global ok
    assert cond, "FAIL: " + msg
    ok += 1
    print("ok -", msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, locale="ar")
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(URL)
    pg.wait_for_selector(".tabs")

    check(pg.locator(".stat").count() >= 4, "اللوحة الرئيسية تعرض الإحصائيات")

    def fill_by_label(label, value):
        pg.locator(".al-modal .al-row", has=pg.locator(".al-lab", has_text=label)).locator("input,textarea").first.fill(value)

    # --- إضافة جهة ---
    pg.click("[data-tab=entities]")
    pg.click(".al-tb .al-btn")
    fill_by_label("الاسم", "د. أحمد العيسائي")
    fill_by_label("التخصص", "باطنة")
    fill_by_label("المحافظة", "تعز")
    pg.click(".al-crow + .al-btn, .al-contacts > .al-btn")
    pg.locator(".al-crow input").first.fill("771234567")
    pg.locator(".al-mf .al-btn", has_text="حفظ").click()
    check(pg.locator(".al-coll:visible .al-card", has_text="د. أحمد العيسائي").count() == 1, "إضافة جهة وظهورها كبطاقة")

    # حقل مطلوب
    pg.click(".al-tb .al-btn")
    pg.locator(".al-mf .al-btn", has_text="حفظ").click()
    check(pg.locator(".al-modal").count() == 1, "منع الحفظ عند نقص الحقل المطلوب")
    pg.locator(".al-mf .al-btn", has_text="إلغاء").click()

    # --- إضافة صنف دواء مرتبط بجهة ---
    pg.click("[data-tab=medicines]")
    pg.click("[data-tab=medicines]")
    pg.locator("#app .al-coll:visible .al-tb .al-btn").click()
    fill_by_label("الصنف", "باراسيتامول 500")
    fill_by_label("الكمية المتوفرة", "١٠٠")
    fill_by_label("السعر", "250")
    check(pg.locator(".al-modal .al-computed").inner_text() == "25,000", "قيمة المخزون تُحسب فوراً (أرقام عربية)")
    pg.locator(".al-mf .al-btn", has_text="حفظ").click()
    check(pg.locator(".al-coll:visible .al-card", has_text="باراسيتامول").count() == 1, "إضافة صنف دواء")

    # --- حجز مع حساب مالي فوري ---
    pg.click("[data-tab=bookings]")
    pg.locator("#app .al-coll:visible .al-tb .al-btn").click()
    fill_by_label("اسم المراجع", "محمد علي")
    fill_by_label("المتفق عليه", "10000")
    fill_by_label("المدفوع", "4000")
    rem = pg.locator(".al-modal .al-row", has=pg.locator(".al-lab", has_text="المتبقي")).locator("output").inner_text()
    check(rem == "6,000", "المتبقي يُحسب فوراً: " + rem)
    pg.locator(".al-mf .al-btn", has_text="حفظ").click()
    check("6,000" in pg.locator(".al-coll:visible .al-card", has_text="محمد علي").inner_text(), "بطاقة الحجز تعرض المتبقي")

    # --- اللوحة ---
    pg.click("[data-tab=dash]")
    txt = pg.locator(".dash").inner_text()
    check("10,000" in txt and "4,000" in txt and "6,000" in txt, "اللوحة تجمع المتفق والمدفوع والمتبقي")

    # --- بحث شامل عبر الأقسام (يتسامح مع الهمزة/التاء المربوطة) ---
    pg.fill(".al-search", "احمد")
    check(pg.locator(".al-coll:visible .al-card:visible", has_text="د. أحمد").count() == 1, "بحث «احمد» يجد «أحمد»")
    check(pg.locator(".al-coll:visible .al-card:visible", has_text="باراسيتامول").count() == 0, "البحث يُخفي غير المطابق")
    pg.fill(".al-search", "باراسيتامول")
    check(pg.locator(".al-coll:visible .al-card:visible", has_text="باراسيتامول").count() == 1, "بحث شامل يجد صنف الدواء من أي تبويب")
    pg.fill(".al-search", "لا_شيء_هنا")
    check("لا نتائج" in pg.locator(".dash").inner_text(), "رسالة عند عدم وجود نتائج")
    pg.fill(".al-search", "")

    # --- أزرار البطاقة: عرض، قائمة ⋮ (نشر عام / إخفاء)، حذف ---
    pg.click("[data-tab=entities]")
    pg.locator(".al-coll:visible .al-card .al-ib[aria-label=عرض]").click()
    check("باطنة" in pg.locator(".al-modal").inner_text(), "عرض السجل")
    check(pg.locator(".al-modal a[href^='tel:']").count() == 1, "رابط اتصال مباشر من وسيلة التواصل")
    pg.locator(".al-modal .al-x").click()
    pg.locator(".al-coll:visible .al-card .al-ib[aria-label=المزيد]").click()
    pg.locator(".al-menu button", has_text="نشر عام").click()
    check(pg.locator(".al-coll:visible .al-card .al-badge.pub").count() == 1, "نشر عام يضيف شارة «عام»")
    pg.locator(".al-coll:visible .al-card .al-ib[aria-label=المزيد]").click()
    pg.locator(".al-menu button", has_text="إخفاء").click()
    check(pg.locator(".al-coll:visible .al-card.dim").count() == 1, "الإخفاء يُعتّم البطاقة")

    pg.screenshot(path=str(SHOT / "entities.png"))

    # --- هوية الصفحة + صورة ترحيبية ---
    pg.click("[data-tab=dash]")
    pg.click("[aria-label='هوية الصفحة']")
    fill_by_label("اسم الصفحة", "صيدلية النور")
    pg.locator(".al-modal .al-row.chk input").check()
    img = SHOT / "welcome.png"
    pg.evaluate("""() => { const c=document.createElement('canvas'); c.width=300;c.height=200;
      const x=c.getContext('2d'); x.fillStyle='#0e7c66'; x.fillRect(0,0,300,200); window.__w=c.toDataURL('image/png'); }""")
    pg.locator(".al-modal .al-imgbtns").nth(1).locator("button").first.evaluate("e=>e")  # وجود زر الاختيار
    pg.locator(".al-mf .al-btn", has_text="حفظ").click()
    check(pg.locator("#title").inner_text() == "صيدلية النور", "اسم الصفحة يتغير في الرأس")

    # --- حذف ---
    pg.click("[data-tab=bookings]")
    pg.locator(".al-coll:visible .al-card .al-ib[aria-label=حذف]").click()
    pg.locator(".al-mf .al-btn", has_text="نعم").click()
    check(pg.locator(".al-coll:visible .al-card").count() == 0, "حذف الحجز بعد التأكيد")

    # --- الصور الدائرية ---
    check(pg.evaluate("getComputedStyle(document.querySelector('.al-av')).borderRadius") in ("50%", "9999px"), "الصورة/الشعار دائري")

    # --- لا أخطاء ---
    check(errors == [], "لا أخطاء في وحدة التحكم: " + str(errors))
    b.close()

print("\n%d فحصاً نجح" % ok)
