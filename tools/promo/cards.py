# صور الترويج: python3 tools/promo/cards.py  → promo/img/{share,story,square}.png
import os
from playwright.sync_api import sync_playwright
R=os.path.dirname(os.path.abspath(__file__)); IMG=os.path.abspath(R+'/../../promo/img')
CSS="""*{box-sizing:border-box;margin:0}body{font-family:'Noto Naskh Arabic','Noto Sans Arabic','DejaVu Sans',sans-serif;direction:rtl;background:#0f3d36;color:#fff;overflow:hidden}
.bg{position:absolute;inset:0;background:radial-gradient(circle at 85% 10%,#1f8a76 0,#0f3d36 55%,#0a2a26)}
.ph{position:absolute;border-radius:44px;border:10px solid #06201c;box-shadow:0 30px 80px #0008;overflow:hidden;background:#fff}.ph img{width:100%;display:block}
h1{font-weight:800;line-height:1.25}.pill{display:inline-block;background:#ffffff1f;border:2px solid #ffffff40;border-radius:99px;padding:8px 22px;margin:6px}
.url{color:#ffd166;font-weight:700;direction:ltr;display:inline-block}"""
def page(w,h,body): return f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body style='width:{w}px;height:{h}px'><div class=bg></div>{body}</body></html>"
T="العيسائي برو"; SUB="منظومة أعمالك في جيبك: تطبيقاتك وإضافات القطاعات وتخزينك في مكان واحد"; U="bakil309275-cell.github.io/Alaisai_OS_Pro"
share=page(1200,630,f"""<div style='position:absolute;right:60px;top:70px;width:640px'><h1 style='font-size:84px'>{T}</h1><p style='font-size:34px;margin:22px 0;line-height:1.6;opacity:.92'>{SUB}</p><span class=pill style='font-size:26px'>يعمل بدون إنترنت</span><span class=pill style='font-size:26px'>مجاني</span><span class=pill style='font-size:26px'>بياناتك عندك</span><p class=url style='font-size:22px;margin-top:26px;white-space:nowrap'>{U}</p></div>
<div class=ph style='left:40px;top:70px;width:215px;transform:rotate(-5deg)'><img src='file://{IMG}/shot_home.png'></div><div class=ph style='left:250px;top:130px;width:215px;transform:rotate(4deg)'><img src='file://{IMG}/shot_med.png'></div>""")
story=page(1080,1920,f"""<div style='position:absolute;right:70px;left:70px;top:110px;text-align:center'><h1 style='font-size:130px'>{T}</h1><p style='font-size:46px;margin-top:26px;line-height:1.6;opacity:.92'>{SUB}</p></div>
<div class=ph style='left:90px;top:560px;width:430px;transform:rotate(-4deg)'><img src='file://{IMG}/shot_home.png'></div><div class=ph style='right:90px;top:640px;width:430px;transform:rotate(4deg)'><img src='file://{IMG}/shot_med.png'></div>
<div style='position:absolute;left:0;right:0;bottom:110px;text-align:center'><span class=pill style='font-size:40px'>إضافات للأطباء والمحامين والعقارات والسفر</span><br><span class=pill style='font-size:40px'>تخزين يربط جوالك بدرايف</span><p class=url style='font-size:34px;margin-top:40px;white-space:nowrap'>{U}</p></div>""")
square=page(1080,1080,f"""<div style='position:absolute;right:60px;left:60px;top:50px;text-align:center'><h1 style='font-size:90px'>{T}</h1><p style='font-size:32px;margin:14px 0;line-height:1.5;opacity:.92'>{SUB}</p><span class=pill style='font-size:28px'>مجاني</span><span class=pill style='font-size:28px'>بدون إنترنت</span><p class=url style='font-size:28px;margin-top:14px;white-space:nowrap'>{U}</p></div>
<div class=ph style='left:150px;top:470px;width:300px;transform:rotate(-4deg)'><img src='file://{IMG}/shot_news.png'></div><div class=ph style='left:520px;top:490px;width:300px;transform:rotate(4deg)'><img src='file://{IMG}/shot_hub.png'></div>""")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--allow-file-access-from-files'])
    for n,(w,h,html) in {'share':(1200,630,share),'story':(1080,1920,story),'square':(1080,1080,square)}.items():
        f=f'/tmp/{n}.html'; open(f,'w').write(html); pg=b.new_page(viewport={'width':w,'height':h}); pg.goto('file://'+f); pg.wait_for_timeout(400); pg.screenshot(path=f'{IMG}/{n}.png')
    b.close()
print('ok')
