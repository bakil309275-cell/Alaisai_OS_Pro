"""بذرة اختبار: المشروع يبدأ بسطح مكتب فارغ، فتعيد الاختبارات القديمة التطبيقات الثلاثة عبر اعتراض storage.js فقط."""
SEED = ("registry: [{ id: 'app_1', name: 'الترحيب', icon: '✨', type: 'html', content: '<h1>مرحباً</h1>', order: 0 },"
        " { id: 'app_2', name: 'المتصفح', icon: '🌐', type: 'url', content: 'https://www.bing.com', order: 1 },"
        " { id: 'app_3', name: 'الملاحظات', icon: '📝', type: 'notes', content: '', order: 2 }],")

def _patch(route):
    r = route.fetch(); body = r.text().replace('registry: [],', SEED, 1)
    route.fulfill(response=r, body=body, headers={**r.headers, 'content-type': 'application/javascript'})

def seeded(browser):
    """يلفّ browser.new_context ليبذر كل سياق جديد."""
    orig = browser.new_context
    def nc(*a, **k):
        c = orig(*a, **k); c.route('**/src/storage.js*', _patch); return c
    browser.new_context = nc
    return browser
