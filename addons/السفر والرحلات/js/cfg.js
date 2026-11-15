'use strict';
const CFG = {
 "id": "trip",
 "name": "السفر والرحلات",
 "tagline": "سفر وسياحة",
 "glyph": "globe",
 "kinds": [
  "مكتب سفر وسياحة",
  "حملة حج وعمرة",
  "وكالة سياحة",
  "مرشد سياحي"
 ],
 "profileExtra": [
  {
   "n": "lic",
   "l": "رقم الترخيص"
  }
 ],
 "lists": [
  {
   "id": "trips",
   "title": "الرحلات والباقات",
   "single": "رحلة",
   "primary": "title",
   "sub": [
    "cat",
    "to"
   ],
   "badge": "price",
   "filter": "cat",
   "fields": [
    {
     "n": "title",
     "l": "اسم الرحلة أو الباقة",
     "req": true
    },
    {
     "n": "cat",
     "l": "النوع",
     "t": "select",
     "o": [
      "حج",
      "عمرة",
      "رحلة سياحية",
      "تذكرة طيران",
      "رحلة داخلية"
     ],
     "half": true
    },
    {
     "n": "seats",
     "l": "المقاعد المتاحة",
     "t": "number",
     "half": true
    },
    {
     "n": "from",
     "l": "من",
     "half": true
    },
    {
     "n": "to",
     "l": "إلى",
     "half": true
    },
    {
     "n": "depart",
     "l": "تاريخ السفر",
     "t": "date",
     "half": true
    },
    {
     "n": "ret",
     "l": "تاريخ العودة",
     "t": "date",
     "half": true
    },
    {
     "n": "price",
     "l": "سعر الفرد",
     "t": "money"
    },
    {
     "n": "incl",
     "l": "تشمل الباقة",
     "t": "textarea",
     "rows": 3,
     "ph": "السكن، النقل، التأشيرة…"
    }
   ]
  },
  {
   "id": "extras",
   "title": "خدمات إضافية",
   "single": "خدمة",
   "primary": "name",
   "sub": [],
   "badge": "price",
   "fields": [
    {
     "n": "name",
     "l": "الخدمة",
     "req": true,
     "ph": "تأشيرة، فندق، نقل…"
    },
    {
     "n": "price",
     "l": "السعر",
     "t": "money"
    },
    {
     "n": "desc",
     "l": "الوصف",
     "t": "textarea",
     "rows": 2
    }
   ]
  }
 ],
 "book": {
  "tab": "الحجوزات",
  "single": "حجز",
  "nameLabel": "اسم المسافر",
  "itemLabel": "الرحلة أو الباقة",
  "itemFrom": "trips",
  "qtyLabel": "عدد الأفراد",
  "dateLabel": "تاريخ السفر",
  "statuses": [
   "جديد",
   "مؤكد",
   "مكتمل",
   "ملغي"
  ],
  "open": [
   "جديد",
   "مؤكد"
  ],
  "done": "مكتمل",
  "closed": [
   "ملغي",
   "مكتمل"
  ],
  "upcoming": "رحلات ومواعيد قادمة",
  "empty": "سجّل حجوزات المسافرين، وتابع الدفعات وسندات السداد والمتبقي على كل حجز."
 },
 "postKinds": [
  "عرض سفر",
  "إعلان رحلة",
  "منشور"
 ],
 "searchHint": "ابحث عن رحلة أو باقة أو مسافر…",
 "terms": {
  "active": "أكثر العملاء تعاملاً"
 },
 "emoji": "✈️",
 "intro": "رحلة جديدة:"
};
CFG.draft = (r, l) => CFG.emoji + ' ' + CFG.intro + ' ' + r[l.primary];
