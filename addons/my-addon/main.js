(function() {
  let timer = null;
  let timeLeft = 25 * 60;
  let isRunning = false;

  const display = document.getElementById('pomo-display');
  const startBtn = document.getElementById('pomo-start');
  const resetBtn = document.getElementById('pomo-reset');
  const status = document.getElementById('pomo-status');

  function updateDisplay() {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    display.textContent = `${mins}:${secs}`;
  }

  startBtn.addEventListener('click', () => {
    if (isRunning) {
      clearInterval(timer);
      isRunning = false;
      startBtn.textContent = 'استئناف';
      status.textContent = '⏸️ تم إيقاف المؤقت مؤقتاً.';
    } else {
      startBtn.textContent = 'إيقاف مؤقت';
      status.textContent = '🔥 جاري التركيز والعمل... واصل!';
      timer = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          updateDisplay();
        } else {
          clearInterval(timer);
          isRunning = false;
          startBtn.textContent = 'تشغيل';
          status.textContent = '🎉 انتهى وقت الجلسة! خذ استراحة قصيرة.';
          if (window.UI && UI.toast) UI.toast('🎉 انتهت جلسة التركيز بنجاح!', 'success');
        }
      }, 1000);
      isRunning = true;
    }
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(timer);
    isRunning = false;
    timeLeft = 25 * 60;
    updateDisplay();
    startBtn.textContent = 'تشغيل';
    status.textContent = '🔄 تم إعادة الضبط. ابدأ من جديد!';
  });
})();
