'use strict';
const CFG = {
 "id": "med",
 "name": "الطب والأدوية",
 "tagline": "طب وأدوية",
 "glyph": "grid",
 "kinds": [
  "طبيب",
  "مستشفى",
  "صيدلية",
  "ممرض",
  "مورّد أدوية",
  "شركة أدوية",
  "مركز طبي"
 ],
 "profileExtra": [
  {
   "n": "spec",
   "l": "التخصص"
  },
  {
   "n": "degree",
   "l": "الدرجة العلمية"
  }
 ],
 "lists": [
  {
   "id": "items",
   "title": "الأدوية والمعدات",
   "single": "صنف",
   "primary": "name",
   "sub": [
    "cat",
    "pack"
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
     "l": "اسم الصنف",
     "req": true
    },
    {
     "n": "cat",
     "l": "التصنيف",
     "t": "select",
     "o": [
      "دواء",
      "معدات طبية",
      "مستلزمات",
      "مكمل غذائي",
      "أخرى"
     ],
     "half": true
    },
    {
     "n": "pack",
     "l": "العبوة",
     "half": true,
     "ph": "مثال: علبة 20 قرص"
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
     "n": "cnt",
     "l": "العدد في العبوة",
     "t": "number",
     "half": true
    },
    {
     "n": "price",
     "l": "السعر",
     "t": "money",
     "half": true
    },
    {
     "n": "expiry",
     "l": "تاريخ الانتهاء",
     "t": "date"
    },
    {
     "n": "note",
     "l": "ملاحظات",
     "t": "textarea",
     "rows": 2
    }
   ]
  },
  {
   "id": "services",
   "title": "الخدمات",
   "single": "خدمة",
   "primary": "name",
   "sub": [
    "dur"
   ],
   "badge": "price",
   "fields": [
    {
     "n": "name",
     "l": "اسم الخدمة",
     "req": true
    },
    {
     "n": "price",
     "l": "السعر",
     "t": "money",
     "half": true
    },
    {
     "n": "dur",
     "l": "المدة",
     "half": true,
     "ph": "مثال: 30 دقيقة"
    },
    {
     "n": "desc",
     "l": "الوصف",
     "t": "textarea",
     "rows": 3
    }
   ]
  }
 ],
 "book": {
  "tab": "المواعيد",
  "single": "حجز",
  "nameLabel": "اسم المريض أو العميل",
  "itemLabel": "الخدمة أو الصنف",
  "itemFrom": "services",
  "qtyLabel": null,
  "dateLabel": "موعد الحجز",
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
  "upcoming": "المواعيد القادمة",
  "empty": "سجّل حجوزات المرضى والعملاء، واحسب المتفق عليه والمدفوع والمتبقي تلقائياً مع سند الحوالة."
 },
 "postKinds": [
  "عرض",
  "إعلان طبي",
  "منشور توعوي"
 ],
 "searchHint": "ابحث عن دواء أو خدمة أو مريض أو شركة…",
 "terms": {
  "active": "الأكثر نشاطاً"
 },
 "emoji": "💊",
 "intro": "متوفر لدينا:"
};
CFG.draft = (r, l) => CFG.emoji + ' ' + CFG.intro + ' ' + r[l.primary];
