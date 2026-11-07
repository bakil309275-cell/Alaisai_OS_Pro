'use strict';
const CFG = {
 "id": "agri",
 "name": "الزراعة",
 "tagline": "زراعة وإمداد",
 "glyph": "grid",
 "kinds": [
  "متجر أسمدة ومبيدات",
  "مورّد زراعي",
  "مزرعة",
  "مهندس زراعي",
  "شركة زراعية"
 ],
 "profileExtra": [
  {
   "n": "spec",
   "l": "المجال"
  }
 ],
 "lists": [
  {
   "id": "products",
   "title": "الأسمدة والمبيدات والمنتجات",
   "single": "منتج",
   "primary": "name",
   "sub": [
    "cat",
    "maker"
   ],
   "badge": "price",
   "filter": "cat",
   "stock": {
    "qty": "qty",
    "min": "min",
    "exp": "expiry"
   },
   "fields": [
    {
     "n": "name",
     "l": "اسم المنتج",
     "req": true
    },
    {
     "n": "cat",
     "l": "التصنيف",
     "t": "select",
     "o": [
      "سماد",
      "مبيد",
      "بذور وشتلات",
      "معدات وري",
      "منتج زراعي",
      "أخرى"
     ],
     "half": true
    },
    {
     "n": "maker",
     "l": "الشركة المنتجة",
     "half": true
    },
    {
     "n": "unit",
     "l": "الوحدة",
     "half": true,
     "ph": "كيس، لتر، كيلو"
    },
    {
     "n": "qty",
     "l": "الكمية",
     "t": "number",
     "half": true
    },
    {
     "n": "min",
     "l": "حد التنبيه عند النفاد",
     "t": "number",
     "half": true
    },
    {
     "n": "price",
     "l": "سعر الوحدة",
     "t": "money",
     "half": true
    },
    {
     "n": "expiry",
     "l": "تاريخ الانتهاء",
     "t": "date"
    },
    {
     "n": "usage",
     "l": "طريقة الاستعمال",
     "t": "textarea",
     "rows": 3
    }
   ]
  },
  {
   "id": "guides",
   "title": "الإرشادات الزراعية",
   "single": "إرشاد",
   "primary": "title",
   "sub": [
    "crop",
    "season"
   ],
   "fields": [
    {
     "n": "title",
     "l": "عنوان الإرشاد",
     "req": true
    },
    {
     "n": "crop",
     "l": "المحصول",
     "half": true
    },
    {
     "n": "season",
     "l": "الموسم",
     "half": true
    },
    {
     "n": "text",
     "l": "التفاصيل",
     "t": "textarea",
     "rows": 6
    }
   ]
  }
 ],
 "book": {
  "tab": "الطلبات",
  "single": "طلب",
  "nameLabel": "اسم المزارع",
  "itemLabel": "المنتج",
  "itemFrom": "products",
  "qtyLabel": "الكمية",
  "dateLabel": "تاريخ التسليم",
  "statuses": [
   "جديد",
   "قيد التجهيز",
   "مسلّم",
   "ملغي"
  ],
  "open": [
   "جديد",
   "قيد التجهيز"
  ],
  "done": "مسلّم",
  "closed": [
   "ملغي",
   "مسلّم"
  ],
  "upcoming": "طلبات قادمة التسليم",
  "empty": "سجّل طلبات المزارعين وربطهم بالمنتجات، وتابع الدفعات والمتبقي لكل طلب."
 },
 "postKinds": [
  "عرض",
  "نصيحة زراعية",
  "إعلان"
 ],
 "searchHint": "ابحث عن سماد أو مبيد أو محصول أو مزارع…",
 "terms": {
  "active": "أكثر المزارعين تعاملاً"
 },
 "emoji": "🌱",
 "intro": "متوفر الآن:"
};
CFG.draft = (r, l) => CFG.emoji + ' ' + CFG.intro + ' ' + r[l.primary];
