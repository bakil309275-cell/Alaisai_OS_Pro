// واجهة النظام متاحة عبر Alaisai: toast / get / set / remove / keys
(async () => {
  const n = ((await Alaisai.get("opens")) || 0) + 1;
  await Alaisai.set("opens", n);
  document.getElementById("n").textContent = n;
  document.getElementById("btn").onclick = () => Alaisai.toast("تعمل الإضافة بنجاح ✅");
})();
