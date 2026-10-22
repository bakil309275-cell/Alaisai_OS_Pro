const area = document.getElementById('note-area');
Alaisai.get('saved_note').then((v) => { if (typeof v === 'string') area.value = v; });
document.getElementById('save-btn').addEventListener('click', async () => {
  await Alaisai.set('saved_note', area.value);
  Alaisai.toast('تم الحفظ!');
});
