/* =========================================================
   SalonPro / Home — ログイン後ダッシュボードの制御
   おすすめ/動画の描画・カート追加・バッジ同期・検索遷移
   ========================================================= */
(function () {
  const { Store, placeholder, svg, fmtYen } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const product = id => SP.DATA.products.find(p => p.id === id);

  /* ---- おすすめ（バッジはホーム固有。商品本体は data.js を参照）---- */
  const REC = [
    { id: 'rec-1', badge: 'よく一緒に購入', bcls: 'together' },
    { id: 'rec-2', badge: 'リピート率No.1', bcls: 'repeat' },
    { id: 'rec-3', badge: 'サロン必需品', bcls: 'essential' },
    { id: 'rec-4', badge: '人気上昇中', bcls: 'rising' },
  ];
  const VIDEOS = [
    { tag: '技術セミナー', tcls: 'tech',  dur: '32:10', title: 'レイヤーカットの質感コントロール', who: 'ALBUM OCE', tint: '#a87d90' },
    { tag: '商品活用動画', tcls: 'use',   dur: '18:45', title: 'N.オイルの使い方完全ガイド',     who: 'napla 1215', tint: '#b1a079' },
    { tag: '経営セミナー', tcls: 'biz',   dur: '28:30', title: 'リピート率を上げる顧客管理術',    who: 'OOCE',      tint: '#6d8aa6' },
    { tag: '販促ノウハウ', tcls: 'promo', dur: '15:20', title: '売上につながる店販提案のコツ',    who: 'SAK',       tint: '#897aa3' },
  ];

  function recCard(r) {
    const p = product(r.id);
    if (!p) return '';
    return `
      <article class="rec-card" data-id="${p.id}">
        <span class="rec-badge rec-badge--${r.bcls}">${r.badge}</span>
        <div class="rec-card__media">${placeholder(p.ph, p.brand)}</div>
        <div class="rec-card__brand">${p.brand}</div>
        <div class="rec-card__name">${p.name}</div>
        <div class="rec-card__price">${fmtYen(p.price)}<small>（税込）</small></div>
        <button class="rec-card__add" data-add="${p.id}">${svg('cart')}カートに入れる</button>
      </article>`;
  }
  function videoCard(v) {
    return `
      <article class="video-card">
        <div class="video-card__thumb" style="background:linear-gradient(135deg, ${v.tint}, ${v.tint}bb)">
          <span class="video-card__tag video-card__tag--${v.tcls}">${v.tag}</span>
          <span class="video-card__play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>
          <span class="video-card__dur">${v.dur}</span>
        </div>
        <div class="video-card__title">${v.title}</div>
        <div class="video-card__who">講師：${v.who}</div>
      </article>`;
  }

  /* ---- toast ---- */
  let toastTimer;
  function toast(msg) {
    const t = qs('#toast');
    t.innerHTML = svg('checkc') + msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 1900);
  }

  /* ---- cart badge 同期（一覧と localStorage 共有）---- */
  function syncBadges() {
    const { count } = Store.cartSummary();
    [['#cartBadge', count], ['#tabCartBadge', count]].forEach(([sel, n]) => {
      const el = qs(sel);
      if (el) { el.textContent = n; el.hidden = n <= 0; }
    });
  }

  function init() {
    qs('#recScroll').innerHTML = REC.map(recCard).join('');
    qs('#videoScroll').innerHTML = VIDEOS.map(videoCard).join('');

    Store.subscribe(syncBadges);
    syncBadges();

    // おすすめ：カートに入れる / カード→詳細
    qs('#recScroll').addEventListener('click', e => {
      const btn = e.target.closest('[data-add]');
      if (btn) {
        Store.addToCart(btn.dataset.add, 1);
        const p = product(btn.dataset.add);
        toast(`カートに追加しました（${p ? p.brand : ''}）`);
        return;
      }
      const card = e.target.closest('.rec-card[data-id]');
      if (card) location.href = 'product.html?id=' + card.dataset.id;
    });

    // まとめてカートに入れる（定期購入セット）
    qsa('[data-bulk]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const ids = ['rec-2', 'rec-3', 'rec-4'];
      ids.forEach(id => Store.addToCart(id, 1));
      toast(`${ids.length}商品をカートに追加しました`);
    }));

    // ヘッダー検索 → 一覧へ（クエリを引き継ぐ）
    qs('#homeSearchForm').addEventListener('submit', e => {
      e.preventDefault();
      const q = qs('#homeSearch').value.trim();
      location.href = 'index.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });

    // 未実装の導線は予告トースト
    qsa('[data-soon]').forEach(b => b.addEventListener('click', e => {
      if (b.hasAttribute('data-bulk')) return; // 上で処理済み
      e.preventDefault();
      const dest = SP.LINKS && SP.LINKS[b.dataset.soon];
      if (dest) { location.href = dest; return; }
      toast(b.dataset.soon + 'は次のステップで実装します');
    }));
  }
  document.addEventListener('DOMContentLoaded', init);
})();
