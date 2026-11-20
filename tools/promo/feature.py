# الرسم المميز لمتجر Play (1024×500): python3 tools/promo/feature.py → store/feature-graphic-1024x500.png
import os
from playwright.sync_api import sync_playwright
R=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(R+'/../..')
H=f"""<html><head><meta charset=utf-8><style>html{{background:#161c3d}}*{{box-sizing:border-box;margin:0}}body{{width:1024px;height:500px;direction:rtl;overflow:hidden;font-family:'Noto Naskh Arabic','Noto Sans Arabic','DejaVu Sans',sans-serif;color:#fff;
background:radial-gradient(circle at 12% 8%,#3f2470 0,#161c3d 45%,#10294a 80%,#1b5a7e 130%)}}
.ic{{position:absolute;right:60px;top:122px;width:256px;height:256px;border-radius:56px;box-shadow:0 20px 60px #0008}}
h1{{position:absolute;right:370px;top:120px;font-size:84px;font-weight:800;white-space:nowrap}}h1 b{{background:linear-gradient(90deg,#8b7bff,#4fc3f7);-webkit-background-clip:text;color:transparent}}
p{{position:absolute;right:370px;top:250px;font-size:29px;opacity:.85;white-space:nowrap}}
.pills{{position:absolute;right:370px;top:330px;white-space:nowrap}}.pills span{{display:inline-block;margin-left:10px;padding:9px 20px;border-radius:99px;border:2px solid #ffffff2e;background:#ffffff14;font-size:20px;font-weight:700}}</style></head>
<body><img class=ic src='file://{ROOT}/store/play-icon-512.png'><h1>العيسائي <b>برو</b></h1><p>منظومة أعمالك وإضافات القطاعات ومجتمعك</p>
<div class=pills><span>إضافات القطاعات</span><span>منصة تفاعلية</span><span>يعمل بدون اتصال</span></div></body></html>"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); pg=b.new_page(viewport={'width':1024,'height':500}); open('/tmp/_fg.html','w',encoding='utf8').write(H); pg.goto('file:///tmp/_fg.html'); pg.wait_for_timeout(400)
    pg.screenshot(path=ROOT+'/store/feature-graphic-1024x500.png'); b.close()
print('ok')
