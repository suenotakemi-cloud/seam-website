/* =========================================================
   SalonPro / Support — 粗利シミュレーター
   ========================================================= */
(function () {
  const qs = s => document.querySelector(s);
  const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');

  function calc() {
    const price = Math.max(0, parseInt(qs('#calcPrice').value, 10) || 0);
    const cost = Math.max(0, parseInt(qs('#calcCost').value, 10) || 0);
    const qty = Math.max(0, parseInt(qs('#calcQty').value, 10) || 0);
    const unit = price - cost;
    const monthly = unit * qty;
    const rate = price > 0 ? Math.round((unit / price) * 100) : 0;
    qs('#calcMonthly').textContent = yen(monthly);
    qs('#calcRate').textContent = `${rate}% / ${yen(unit)}`;
  }
  ['#calcPrice', '#calcCost', '#calcQty'].forEach(s => qs(s).addEventListener('input', calc));
  calc();
})();
