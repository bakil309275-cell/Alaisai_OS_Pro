/* تطبيق السمة المحفوظة قبل الرسم لتفادي الوميض */
try {
  var p = localStorage.getItem('alaisai_theme') || 'auto';
  var light = matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.dataset.theme = p === 'auto' ? (light ? 'light' : 'dark') : p;
} catch (e) {}
