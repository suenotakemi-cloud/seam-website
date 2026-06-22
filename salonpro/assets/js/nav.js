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

    // 入荷お知らせ（欠品商品）：全ページ共通のトグル。カード/詳細の data-act="restock" を拾う
    document.addEventListener('click', e => {
      const rb = e.target.closest('[data-act="restock"]');
      if (!rb || !Store || !Store.toggleRestockAlert) return;
      e.preventDefault();
      const host = rb.closest('[data-id]');
      const id = (host && host.dataset.id) || rb.dataset.id;
      if (!id) return;
      const on = Store.toggleRestockAlert(id);
      rb.classList.toggle('is-on', on);
      rb.setAttribute('aria-pressed', on ? 'true' : 'false');
      rb.innerHTML = (SP.svg ? SP.svg(on ? 'checkc' : 'bell') : '') + '<span class="btn-restock__t">' + (on ? '登録済み' : '入荷お知らせ') + '</span>';
      toast(on ? '入荷したらお知らせします' : '入荷お知らせを解除しました');
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
