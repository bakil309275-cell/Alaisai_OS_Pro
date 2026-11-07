'use strict';
const CFG = {
 "id": "estate",
 "name": "العقارات",
 "tagline": "بيع وشراء العقارات",
 "glyph": "home",
 "kinds": [
  "مكتب عقارات",
  "وسيط عقاري",
  "مالك",
  "مطوّر عقاري",
  "شركة"
 ],
 "profileExtra": [
  {
   "n": "lic",
   "l": "رقم الترخيص"
  }
 ],
 "lists": [
  {
   "id": "props",
   "title": "العقارات",
   "single": "عقار",
   "primary": "title",
   "sub": [
    "cat",
    "deal",
    "loc"
   ],
   "badge": "price",
   "filter": "cat",
   "fields": [
    {
     "n": "title",
     "l": "عنوان العقار",
     "req": true,
     "ph": "مثال: أرض 600م² بالحي الشمالي"
    },
    {
     "n": "cat",
     "l": "النوع",
     "t": "select",
     "o": [
      "أرض",
      "منزل",
      "شقة",
      "محل",
      "ورشة",
      "مزرعة",
      "أخرى"
     ],
     "half": true
    },
    {
     "n": "deal",
     "l": "العملية",
     "t": "select",
     "o": [
      "بيع",
      "إيجار"
     ],
     "half": true
    },
    {
     "n": "area",
     "l": "المساحة",
     "t": "number",
     "half": true,
     "u": "م²"
    },
    {
     "n": "price",
     "l": "السعر",
     "t": "money",
     "half": true
    },
    {
     "n": "state",
     "l": "الحالة",
     "t": "select",
     "o": [
      "متاح",
      "محجوز",
      "مباع",
      "مؤجّر"
     ],
     "half": true
    },
    {
     "n": "loc",
     "l": "الموقع (المحافظة، المديرية، الحي)",
     "half": true
    },
    {
     "n": "map",
     "l": "رابط الخريطة",
     "t": "url"
    },
    {
     "n": "owner",
     "l": "المالك أو الوسيط",
     "half": true
    },
    {
     "n": "ophone",
     "l": "هاتفه",
     "t": "tel",
     "half": true
    },
    {
     "n": "desc",
     "l": "الوصف والتفاصيل",
     "t": "textarea",
     "rows": 3
    }
   ]
  }
 ],
 "book": {
  "tab": "المعاينات والصفقات",
  "single": "معاينة",
  "nameLabel": "اسم المهتم",
  "itemLabel": "العقار",
  "itemFrom": "props",
  "qtyLabel": null,
  "dateLabel": "موعد المعاينة",
  "statuses": [
   "جديد",
   "مؤكد",
   "تمت الصفقة",
   "ملغي"
  ],
  "open": [
   "جديد",
   "مؤكد"
  ],
  "done": "تمت الصفقة",
  "closed": [
   "ملغي",
   "تمت الصفقة"
  ],
  "upcoming": "معاينات قادمة",
  "empty": "سجّل معاينات المهتمين والصفقات، واحسب العمولة أو الثمن المتفق عليه والمتبقي منه."
 },
 "postKinds": [
  "عقار مميز",
  "إعلان",
  "عرض"
 ],
 "searchHint": "ابحث عن أرض أو منزل أو شقة أو حي أو مالك…",
 "terms": {
  "active": "أكثر المهتمين تعاملاً"
 },
 "emoji": "🏠",
 "intro": "للبيع والإيجار:"
};
CFG.draft = (r, l) => CFG.emoji + ' ' + CFG.intro + ' ' + r[l.primary];
