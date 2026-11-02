import json,os,shutil,base64,subprocess
R=os.path.dirname(os.path.abspath(__file__)); OUT=R+'/out'; ENG=R+'/engine'
def F(n,l,t='text',**k): d={'n':n,'l':l}; (t!='text') and d.__setitem__('t',t); d.update(k); return d
ST=['جديد','مؤكد','مكتمل','ملغي']
S=[]
S.append(dict(id='med',folder='الطب والأدوية',name='الطب والأدوية',icon='🩺',emoji='💊',intro='متوفر لدينا:',glyph='grid',
 desc='إدارة عيادة أو صيدلية أو مورّد: أدوية ومعدات بتنبيه النفاد والصلاحية، خدمات، مواعيد، سندات، كتالوج للمشاركة.',
 pal=dict(a='#0d6e6e',a2='#6fd0c8',a3='#ff9d8a',plate='#08302f',rail='#0a1a1a',card='#123433'),
 tagline='طب وأدوية',kinds=['طبيب','مستشفى','صيدلية','ممرض','مورّد أدوية','شركة أدوية','مركز طبي'],
 profileExtra=[F('spec','التخصص'),F('degree','الدرجة العلمية')],
 lists=[dict(id='items',title='الأدوية والمعدات',single='صنف',primary='name',sub=['cat','pack'],badge='price',filter='cat',stock=dict(qty='qty',min='min',exp='expiry'),
   fields=[F('name','اسم الصنف',req=True),F('cat','التصنيف','select',o=['دواء','معدات طبية','مستلزمات','مكمل غذائي','أخرى'],half=True),F('pack','العبوة',half=True,ph='مثال: علبة 20 قرص'),F('qty','الكمية','number',half=True),F('min','حد التنبيه عند النفاد','number',half=True),F('cnt','العدد في العبوة','number',half=True),F('price','السعر','money',half=True),F('expiry','تاريخ الانتهاء','date'),F('note','ملاحظات','textarea',rows=2)]),
  dict(id='services',title='الخدمات',single='خدمة',primary='name',sub=['dur'],badge='price',fields=[F('name','اسم الخدمة',req=True),F('price','السعر','money',half=True),F('dur','المدة',half=True,ph='مثال: 30 دقيقة'),F('desc','الوصف','textarea',rows=3)])],
 book=dict(tab='المواعيد',single='حجز',nameLabel='اسم المريض أو العميل',itemLabel='الخدمة أو الصنف',itemFrom='services',qtyLabel=None,dateLabel='موعد الحجز',statuses=ST,open=['جديد','مؤكد'],done='مكتمل',closed=['ملغي','مكتمل'],upcoming='المواعيد القادمة',empty='سجّل حجوزات المرضى والعملاء، واحسب المتفق عليه والمدفوع والمتبقي تلقائياً مع سند الحوالة.'),
 postKinds=['عرض','إعلان طبي','منشور توعوي'],searchHint='ابحث عن دواء أو خدمة أو مريض أو شركة…',active='الأكثر نشاطاً'))
S.append(dict(id='trip',folder='السفر والرحلات',name='السفر والرحلات',icon='✈️',emoji='✈️',intro='رحلة جديدة:',glyph='globe',
 desc='إدارة مكتب سفر أو حملة حج وعمرة: باقات وأسعار، حجوزات، دفعات وسندات، عروض وكتالوج للمشاركة.',
 pal=dict(a='#1c5fa6',a2='#8fc3f5',a3='#ffc857',plate='#0b2547',rail='#0b1624',card='#14304f'),
 tagline='سفر وسياحة',kinds=['مكتب سفر وسياحة','حملة حج وعمرة','وكالة سياحة','مرشد سياحي'],profileExtra=[F('lic','رقم الترخيص')],
 lists=[dict(id='trips',title='الرحلات والباقات',single='رحلة',primary='title',sub=['cat','to'],badge='price',filter='cat',
   fields=[F('title','اسم الرحلة أو الباقة',req=True),F('cat','النوع','select',o=['حج','عمرة','رحلة سياحية','تذكرة طيران','رحلة داخلية'],half=True),F('seats','المقاعد المتاحة','number',half=True),F('from','من',half=True),F('to','إلى',half=True),F('depart','تاريخ السفر','date',half=True),F('ret','تاريخ العودة','date',half=True),F('price','سعر الفرد','money'),F('incl','تشمل الباقة','textarea',rows=3,ph='السكن، النقل، التأشيرة…')]),
  dict(id='extras',title='خدمات إضافية',single='خدمة',primary='name',sub=[],badge='price',fields=[F('name','الخدمة',req=True,ph='تأشيرة، فندق، نقل…'),F('price','السعر','money'),F('desc','الوصف','textarea',rows=2)])],
 book=dict(tab='الحجوزات',single='حجز',nameLabel='اسم المسافر',itemLabel='الرحلة أو الباقة',itemFrom='trips',qtyLabel='عدد الأفراد',dateLabel='تاريخ السفر',statuses=ST,open=['جديد','مؤكد'],done='مكتمل',closed=['ملغي','مكتمل'],upcoming='رحلات ومواعيد قادمة',empty='سجّل حجوزات المسافرين، وتابع الدفعات وسندات السداد والمتبقي على كل حجز.'),
 postKinds=['عرض سفر','إعلان رحلة','منشور'],searchHint='ابحث عن رحلة أو باقة أو مسافر…',active='أكثر العملاء تعاملاً'))
S.append(dict(id='agri',folder='الزراعة',name='الزراعة',icon='🌱',emoji='🌱',intro='متوفر الآن:',glyph='grid',
 desc='إدارة متجر أو مورّد زراعي: أسمدة ومبيدات بتنبيه النفاد والصلاحية، إرشادات زراعية، طلبات المزارعين وسداداتهم.',
 pal=dict(a='#4d6b21',a2='#b4d77a',a3='#e8c46a',plate='#223208',rail='#131a0c',card='#243516'),
 tagline='زراعة وإمداد',kinds=['متجر أسمدة ومبيدات','مورّد زراعي','مزرعة','مهندس زراعي','شركة زراعية'],profileExtra=[F('spec','المجال')],
 lists=[dict(id='products',title='الأسمدة والمبيدات والمنتجات',single='منتج',primary='name',sub=['cat','maker'],badge='price',filter='cat',stock=dict(qty='qty',min='min',exp='expiry'),
   fields=[F('name','اسم المنتج',req=True),F('cat','التصنيف','select',o=['سماد','مبيد','بذور وشتلات','معدات وري','منتج زراعي','أخرى'],half=True),F('maker','الشركة المنتجة',half=True),F('unit','الوحدة',half=True,ph='كيس، لتر، كيلو'),F('qty','الكمية','number',half=True),F('min','حد التنبيه عند النفاد','number',half=True),F('price','سعر الوحدة','money',half=True),F('expiry','تاريخ الانتهاء','date'),F('usage','طريقة الاستعمال','textarea',rows=3)]),
  dict(id='guides',title='الإرشادات الزراعية',single='إرشاد',primary='title',sub=['crop','season'],fields=[F('title','عنوان الإرشاد',req=True),F('crop','المحصول',half=True),F('season','الموسم',half=True),F('text','التفاصيل','textarea',rows=6)])],
 book=dict(tab='الطلبات',single='طلب',nameLabel='اسم المزارع',itemLabel='المنتج',itemFrom='products',qtyLabel='الكمية',dateLabel='تاريخ التسليم',statuses=['جديد','قيد التجهيز','مسلّم','ملغي'],open=['جديد','قيد التجهيز'],done='مسلّم',closed=['ملغي','مسلّم'],upcoming='طلبات قادمة التسليم',empty='سجّل طلبات المزارعين وربطهم بالمنتجات، وتابع الدفعات والمتبقي لكل طلب.'),
 postKinds=['عرض','نصيحة زراعية','إعلان'],searchHint='ابحث عن سماد أو مبيد أو محصول أو مزارع…',active='أكثر المزارعين تعاملاً'))
S.append(dict(id='estate',folder='العقارات',name='العقارات',icon='🏠',emoji='🏠',intro='للبيع والإيجار:',glyph='home',
 desc='إدارة مكتب عقارات أو وسيط: أراضٍ ومنازل وشقق ومحلات بالصور والموقع والسعر، معاينات وصفقات، عروض وكتالوج للمشاركة.',
 pal=dict(a='#34507a',a2='#a3bff0',a3='#d9b36a',plate='#14233f',rail='#0e1522',card='#1b2b46'),
 tagline='بيع وشراء العقارات',kinds=['مكتب عقارات','وسيط عقاري','مالك','مطوّر عقاري','شركة'],profileExtra=[F('lic','رقم الترخيص')],
 lists=[dict(id='props',title='العقارات',single='عقار',primary='title',sub=['cat','deal','loc'],badge='price',filter='cat',
   fields=[F('title','عنوان العقار',req=True,ph='مثال: أرض 600م² بالحي الشمالي'),F('cat','النوع','select',o=['أرض','منزل','شقة','محل','ورشة','مزرعة','أخرى'],half=True),F('deal','العملية','select',o=['بيع','إيجار'],half=True),F('area','المساحة','number',half=True,u='م²'),F('price','السعر','money',half=True),F('state','الحالة','select',o=['متاح','محجوز','مباع','مؤجّر'],half=True),F('loc','الموقع (المحافظة، المديرية، الحي)',half=True),F('map','رابط الخريطة','url'),F('owner','المالك أو الوسيط',half=True),F('ophone','هاتفه','tel',half=True),F('desc','الوصف والتفاصيل','textarea',rows=3)])],
 book=dict(tab='المعاينات والصفقات',single='معاينة',nameLabel='اسم المهتم',itemLabel='العقار',itemFrom='props',qtyLabel=None,dateLabel='موعد المعاينة',statuses=['جديد','مؤكد','تمت الصفقة','ملغي'],open=['جديد','مؤكد'],done='تمت الصفقة',closed=['ملغي','تمت الصفقة'],upcoming='معاينات قادمة',empty='سجّل معاينات المهتمين والصفقات، واحسب العمولة أو الثمن المتفق عليه والمتبقي منه.'),
 postKinds=['عقار مميز','إعلان','عرض'],searchHint='ابحث عن أرض أو منزل أو شقة أو حي أو مالك…',active='أكثر المهتمين تعاملاً'))
S.append(dict(id='goods',folder='المنقولات والسلع الثمينة',name='المنقولات والسلع الثمينة',icon='💎',emoji='💎',intro='معروض للبيع:',glyph='star',
 desc='إدارة معرض أو تاجر: سيارات ومجوهرات وسلع قيمة بمواصفاتها وصورها وأسعارها، عروض أسعار، طلبات ودفعات، وكتالوج للمشاركة.',
 pal=dict(a='#7d2233',a2='#e8a0ad',a3='#e0b865',plate='#3a0d17',rail='#1a0d11',card='#3a1721'),
 tagline='سلع وقيم ثمينة',kinds=['معرض سيارات','تاجر مجوهرات','تاجر سلع','وسيط'],profileExtra=[F('lic','رقم الترخيص التجاري')],
 lists=[dict(id='items',title='السلع المعروضة',single='سلعة',primary='title',sub=['cat','cond'],badge='price',filter='cat',
   fields=[F('title','اسم السلعة',req=True,ph='مثال: تويوتا هايلكس 2020'),F('cat','التصنيف','select',o=['سيارة','مجوهرات','سلاح مرخص','ساعات','إلكترونيات','أخرى'],half=True),F('cond','الحالة','select',o=['جديد','مستعمل'],half=True),F('price','السعر','money',half=True),F('pay','وسيلة الدفع','select',o=['نقداً','تحويل بنكي','تقسيط','حسب الاتفاق'],half=True),F('state','التوفر','select',o=['متاح','محجوز','مباع'],half=True),F('lic','رقم الترخيص أو التسجيل (إن وجد)',half=True),F('specs','المواصفات الفنية','textarea',rows=4)]),
  dict(id='quotes',title='عروض الأسعار',single='عرض سعر',primary='to',sub=['what'],badge='price',fields=[F('to','المُرسَل إليه',req=True),F('what','السلعة'),F('price','السعر المعروض','money',half=True),F('valid','صالح حتى','date',half=True),F('note','ملاحظات','textarea',rows=2)])],
 book=dict(tab='الطلبات',single='طلب',nameLabel='اسم المشتري',itemLabel='السلعة',itemFrom='items',qtyLabel=None,dateLabel='تاريخ التسليم',statuses=['جديد','مؤكد','مباع','ملغي'],open=['جديد','مؤكد'],done='مباع',closed=['ملغي','مباع'],upcoming='تسليمات قادمة',empty='سجّل طلبات الشراء، وتابع الدفعات والتقسيط والمتبقي لكل مشترٍ.'),
 postKinds=['عرض خاص','سلعة جديدة','إعلان'],searchHint='ابحث عن سيارة أو مجوهرات أو سلعة أو مشترٍ…',active='أكثر المشترين تعاملاً'))
def nrm(c):
    for l in c['lists']:
        for f in l['fields']:
            if f.get('t')=='select' and 'o' not in f: raise SystemExit('bad')
    return c
shutil.rmtree(OUT,ignore_errors=True); os.makedirs(OUT)
for c in S:
    nrm(c); d=f"{OUT}/{c['folder']}"; os.makedirs(d+'/js'); os.makedirs(d+'/fonts')
    for f in os.listdir(ENG):
        if f.endswith('.woff2'): shutil.copy(f'{ENG}/{f}',d+'/fonts/'+f)
    shutil.copy(ENG+'/index.html',d+'/index.html')
    p=c['pal']; css=f":root{{--a:{p['a']};--a2:{p['a2']};--a3:{p['a3']};--plate:{p['plate']};--rail-d:{p['rail']};--card-d:{p['card']}}}\n"+open(ENG+'/style.css').read()
    open(d+'/style.css','w').write(css)
    cfg=dict(id=c['id'],name=c['name'],tagline=c['tagline'],glyph=c['glyph'],kinds=c['kinds'],profileExtra=c['profileExtra'],lists=c['lists'],book=c['book'],postKinds=c['postKinds'],searchHint=c['searchHint'],terms=dict(active=c['active']),emoji=c['emoji'],intro=c['intro'])
    open(d+'/js/cfg.js','w').write("'use strict';\nconst CFG = "+json.dumps(cfg,ensure_ascii=False,indent=1)+";\nCFG.draft = (r, l) => CFG.emoji + ' ' + CFG.intro + ' ' + r[l.primary];\n")
    for n in ['lib','ui','engine','main']: shutil.copy(f'{ENG}/js/{n}.js',f'{d}/js/{n}.js')
    json.dump(dict(name=c['name'],icon=c['icon'],version='1.0.0',description=c['desc'],author='العيسائي برو',scripts=['js/cfg.js','js/lib.js','js/ui.js','js/engine.js','js/main.js'],styles=['style.css']),open(d+'/manifest.json','w'),ensure_ascii=False,indent=2)
    files=[]
    for dp,_,fs in os.walk(d):
        for f in sorted(fs):
            pth=os.path.join(dp,f); n=os.path.relpath(pth,d).replace(os.sep,'/'); b=open(pth,'rb').read()
            files.append({'name':n,'content':base64.b64encode(b).decode(),'bin':True} if f.endswith('.woff2') else {'name':n,'content':b.decode('utf8')})
    files.sort(key=lambda x:x['name']); m=json.load(open(d+'/manifest.json'))
    json.dump(dict(format='alaisai-addon',version=1,id=c['folder'],manifest=dict(m,id=c['folder']),files=files),open(f"{OUT}/{c['folder']}.alaisai-addon.json",'w'),ensure_ascii=False)
    print(c['folder'],os.path.getsize(f"{OUT}/{c['folder']}.alaisai-addon.json"))
json.dump([dict(id=c['id'],folder=c['folder']) for c in S],open(R+'/sectors.json','w'),ensure_ascii=False)
