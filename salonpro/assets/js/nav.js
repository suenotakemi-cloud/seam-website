/* =========================================================
   SalonPro / nav — 全ページ共通のヘッダー/タブ挙動
   カートバッジ同期・検索→一覧遷移・未実装リンクのトースト
   （独自JSを持たないコンテンツ系ページで読み込む）
   ========================================================= */
(function () {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const Store = window.SP && SP.Store;

  let tt;
  function toast(msg) {
    const t = qs('#toast');
    if (!t) return;
    t.innerHTML = (SP.svg ? SP.svg('checkc') : '') + msg;
    t.classList.add('is-visible');
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove('is-visible'), 1900);
  }
  window.SP_toast = toast;

  function syncBadges() {
    if (!Store) return;
    const { count } = Store.cartSummary();
    [['#cartBadge', count], ['#tabCartBadge', count]].forEach(([sel, n]) => {
      const el = qs(sel);
      if (el) { el.textContent = n; el.hidden = n <= 0; }
    });
  }

  function init() {
    if (Store) { Store.subscribe(syncBadges); syncBadges(); }

    const sf = qs('#searchForm');
    if (sf) sf.addEventListener('submit', e => {
      e.preventDefault();
      const q = (qs('#headerSearch') || {}).value;
      location.href = 'index.html' + (q && q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '');
    });

    qsa('[data-soon]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const dest = SP.LINKS && SP.LINKS[b.dataset.soon];
      if (dest) { location.href = dest; return; }
      toast(b.dataset.soon + 'は次のステップで実装します');
    }));
  }
  document.addEventListener('DOMContentLoaded', init);
})();
