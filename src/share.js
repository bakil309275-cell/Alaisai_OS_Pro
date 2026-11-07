/* مشاركة العيسائي برو: رسالة جاهزة + رمز QR + أزرار الوسائل الشائعة */
(function () {
  const E = UI.esc;
  const siteUrl = () => { const c = document.querySelector('link[rel=canonical]'); return (c && c.href) || (location.origin + location.pathname.replace(/index\.html$/, '')); };
  const MSG = (u) => `🌟 جرّب «العيسائي برو»: سطح مكتب تطبيقات يعمل بلا إنترنت على جوالك وحاسوبك.\n• ملاحظات وتطبيقاتك في مكان واحد\n• إضافات جاهزة للأطباء والمحامين والعقارات والسفر والزراعة والتجارة\n• تخزين يربط جهازك بدرايف وغيره، ومزامنة مشفّرة\nمجاني، وبياناتك تبقى عندك 👇\n${u}`;
  const Share = {
    url: siteUrl,
    message: MSG,
    open() {
      const u = siteUrl(), root = document.getElementById('dialog-root'), ov = document.createElement('div'); ov.className = 'dialog-overlay';
      ov.innerHTML = `<div class="dialog share-dlg" role="dialog" aria-modal="true" aria-label="مشاركة العيسائي برو"><h3>📤 شارك العيسائي برو</h3>
        <div class="share-qr"><canvas width="200" height="200" aria-label="رمز QR لرابط العيسائي برو" role="img"></canvas><small class="muted">امسح الرمز بكاميرا الجوال لفتح التطبيق وتثبيته</small></div>
        <label class="lbl" for="sh-msg">رسالة المشاركة (عدّلها كما تشاء)</label><textarea id="sh-msg" class="field" rows="7"></textarea>
        <div class="share-btns"><button type="button" class="btn btn-primary" data-s="native">📤 مشاركة</button><button type="button" class="btn" data-s="wa">واتساب</button><button type="button" class="btn" data-s="tg">تيليجرام</button><button type="button" class="btn" data-s="fb">فيسبوك</button><button type="button" class="btn" data-s="x">X</button><button type="button" class="btn" data-s="mail">بريد</button><button type="button" class="btn" data-s="copy">نسخ الرسالة</button><button type="button" class="btn" data-s="link">نسخ الرابط</button><button type="button" class="btn" data-s="qr">⬇️ حفظ QR</button></div>
        <div class="dialog-actions"><button type="button" class="btn" data-s="x0">إغلاق</button></div></div>`;
      root.appendChild(ov); const ta = ov.querySelector('#sh-msg'), cv = ov.querySelector('canvas'); ta.value = MSG(u);
      try { QR.draw(cv, u, 6, 3); cv.style.width = '200px'; cv.style.height = '200px'; } catch (_) { cv.hidden = true; }
      const enc = encodeURIComponent, clip = async (t, ok) => { try { await navigator.clipboard.writeText(t); UI.toast(ok, 'success'); } catch (_) { UI.toast('تعذّر النسخ', 'error'); } };
      ov.addEventListener('click', async (e) => {
        if (e.target === ov) return ov.remove(); const b = e.target.closest('[data-s]'); if (!b) return; const s = b.dataset.s, t = ta.value;
        if (s === 'x0') return ov.remove();
        if (s === 'native') { if (navigator.share) { try { await navigator.share({ text: t }); } catch (er) { if (er && er.name !== 'AbortError') clip(t, 'المشاركة غير متاحة؛ نُسخت الرسالة'); } } else clip(t, 'نُسخت الرسالة، الصقها حيث تشاء'); return; }
        if (s === 'wa') return window.open('https://wa.me/?text=' + enc(t), '_blank', 'noopener');
        if (s === 'tg') return window.open('https://t.me/share/url?url=' + enc(u) + '&text=' + enc(t.replace(u, '').trim()), '_blank', 'noopener');
        if (s === 'fb') return window.open('https://www.facebook.com/sharer/sharer.php?u=' + enc(u), '_blank', 'noopener');
        if (s === 'x') return window.open('https://twitter.com/intent/tweet?text=' + enc(t), '_blank', 'noopener');
        if (s === 'mail') return window.open('mailto:?subject=' + enc('العيسائي برو') + '&body=' + enc(t), '_self');
        if (s === 'copy') return clip(t, 'تم نسخ الرسالة');
        if (s === 'link') return clip(u, 'تم نسخ الرابط');
        if (s === 'qr') { cv.toBlob((bl) => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'alaisai-pro-qr.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }); }
      });
      ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); ov.remove(); } });
      ov.querySelector('[data-s=native]').focus();
    },
  };
  window.Share = Share;
})();
