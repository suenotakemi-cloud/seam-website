/* /links の登場：SEAM が一文字ずつ → 金の区切り → タイルが下から順に（約1.6秒）。予約や店舗の行き先は押せる */
(() => {
  const root = document.documentElement;
  function run() {
    const b = document.querySelector('.lk-head b'); if (!b) return;
    if (!document.querySelector('.lk-rule')) { const r = document.createElement('i'); r.className = 'lk-rule'; r.setAttribute('aria-hidden', 'true'); b.after(r); }
    if (!root.classList.contains('lk-intro')) return;
    const t = b.textContent; b.setAttribute('aria-label', t); b.textContent = '';
    [...t].forEach((c, i) => { const s = document.createElement('span'); s.className = 'lk-ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i); s.textContent = c; b.appendChild(s); }); b.classList.add('lk-split');
    document.querySelectorAll('.lk-list>li').forEach((li, i) => li.style.setProperty('--i', i));
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('lk-go')));
    setTimeout(() => root.classList.add("lk-done"), 1700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
})();
