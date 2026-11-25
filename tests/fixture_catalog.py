# كتالوج تجريبي للاختبارات: النظام لا يشحن أي إضافة، فنبني كتالوجاً من tests/fixtures/addons ونقدّمه عبر route
import subprocess, pathlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(tempfile.gettempdir()) / 'alaisai-fixture-catalog'
def build():
    subprocess.run(['node', 'tools/build-catalog.mjs', '--src', 'tests/fixtures/addons', '--out', str(OUT)], cwd=ROOT, check=True, capture_output=True)
def install(ctx, base='http://localhost:8765'):
    build()
    def h(route):
        rel = route.request.url.split('/catalog/', 1)[1].split('?')[0]
        f = OUT / rel
        if f.is_file(): return route.fulfill(status=200, body=f.read_bytes(), headers={'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'})
        route.fulfill(status=404, body='')
    ctx.route(base + '/catalog/**', h)
def count():
    import json
    return len(json.load(open(OUT / 'index.json'))['addons'])
