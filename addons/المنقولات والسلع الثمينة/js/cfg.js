'use strict';
const CFG = {
 "id": "goods",
 "name": "المنقولات والسلع الثمينة",
 "tagline": "سلع وقيم ثمينة",
 "glyph": "star",
 "kinds": [
  "معرض سيارات",
  "تاجر مجوهرات",
  "تاجر سلع",
  "وسيط"
 ],
 "profileExtra": [
  {
   "n": "lic",
   "l": "رقم الترخيص التجاري"
  }
 ],
 "lists": [
  {
   "id": "items",
   "title": "السلع المعروضة",
   "single": "سلعة",
   "primary": "title",
   "sub": [
    "cat",
    "cond"
   ],
   "badge": "price",
   "filter": "cat",
   "fields": [
    {
     "n": "title",
     "l": "اسم السلعة",
     "req": true,
     "ph": "مثال: تويوتا هايلكس 2020"
    },
    {
     "n": "cat",
     "l": "التصنيف",
     "t": "select",
     "o": [
      "سيارة",
      "مجوهرات",
      "سلاح مرخص",
      "ساعات",
      "إلكترونيات",
      "أخرى"
     ],
     "half": true
    },
    {
     "n": "cond",
     "l": "الحالة",
     "t": "select",
     "o": [
      "جديد",
      "مستعمل"
     ],
     "half": true
    },
    {
     "n": "price",
     "l": "السعر",
     "t": "money",
     "half": true
    },
    {
     "n": "pay",
     "l": "وسيلة الدفع",
     "t": "select",
     "o": [
      "نقداً",
      "تحويل بنكي",
      "تقسيط",
      "حسب الاتفاق"
     ],
     "half": true
    },
    {
     "n": "state",
     "l": "التوفر",
     "t": "select",
     "o": [
      "متاح",
      "محجوز",
      "مباع"
     ],
     "half": true
    },
    {
     "n": "lic",
     "l": "رقم الترخيص أو التسجيل (إن وجد)",
     "half": true
    },
    {
     "n": "specs",
     "l": "المواصفات الفنية",
     "t": "textarea",
     "rows": 4
    }
   ]
  },
  {
   "id": "quotes",
   "title": "عروض الأسعار",
   "single": "عرض سعر",
   "primary": "to",
   "sub": [
    "what"
   ],
   "badge": "price",
   "fields": [
    {
     "n": "to",
     "l": "المُرسَل إليه",
     "req": true
    },
    {
     "n": "what",
     "l": "السلعة"
    },
    {
     "n": "price",
     "l": "السعر المعروض",
     "t": "money",
     "half": true
    },
    {
     "n": "valid",
     "l": "صالح حتى",
     "t": "date",
     "half": true
    },
    {
     "n": "note",
     "l": "ملاحظات",
     "t": "textarea",
     "rows": 2
    }
   ]
  }
 ],
 "book": {
  "tab": "الطلبات",
  "single": "طلب",
  "nameLabel": "اسم المشتري",
  "itemLabel": "السلعة",
  "itemFrom": "items",
  "qtyLabel": null,
  "dateLabel": "تاريخ التسليم",
  "statuses": [
   "جديد",
   "مؤكد",
   "مباع",
   "ملغي"
  ],
  "open": [
   "جديد",
   "مؤكد"
  ],
  "done": "مباع",
  "closed": [
   "ملغي",
   "مباع"
  ],
  "upcoming": "تسليمات قادمة",
  "empty": "سجّل طلبات الشراء، وتابع الدفعات والتقسيط والمتبقي لكل مشترٍ."
 },
 "postKinds": [
  "عرض خاص",
  "سلعة جديدة",
  "إعلان"
 ],
 "searchHint": "ابحث عن سيارة أو مجوهرات أو سلعة أو مشترٍ…",
 "terms": {
  "active": "أكثر المشترين تعاملاً"
 },
 "emoji": "💎",
 "intro": "معروض للبيع:"
};
CFG.draft = (r, l) => CFG.emoji + ' ' + CFG.intro + ' ' + r[l.primary];
