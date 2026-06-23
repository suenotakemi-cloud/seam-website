/* =========================================================
   SalonPro / Reorder — 前回注文の一括再注文・定番セット・よく買う
   ========================================================= */
(function () {
  const { Store, placeholder, svg, fmtYen } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const product = id => SP.DATA.products.find(x => x.id === id);
  const toast = m => (window.SP_toast ? SP_toast(m) : null);

  const PREV = [{ id: 'sh-001', qty: 2 }, { id: 'sh-005', qty: 1 }, { id: 'co-3', qty: 3 }, { id: 'tr-001', qty: 1 }];
  const SETS = [
    { name: 'カラー定番セット', items: [['co-3', 2], ['co-7', 2], ['co-22', 1]] },
    { name: 'サロン消耗セット', items: [['sh-005', 1], ['tr-003', 1], ['sh-010', 1]] },
  ];
  const FREQ = [
    { id: 'rec-2', n: 3 }, { id: 'sh-005', n: 3 }, { id: 'sh-002', n: 2 },
    { id: 'tr-001', n: 2 }, { id: 'sh-010', n: 2 }, { id: 'co-26', n: 1 }, { id: 'sh-024', n: 1 },
  ];
  // 消耗予測（前回購入からの経過日数で補充提案）
  const REPLENISH = [{ id: 'sh-005', days: 18 }, { id: 'co-23', days: 25 }, { id: 'tr-002', days: 30 }];

  function thumb(p) { return `<span class="ro-thumb">${placeholder(p.ph, p.brand)}</span>`; }

  function renderPrev() {
    qs('#prevOrderList').innerHTML = PREV.map(({ id, qty }) => {
      const p = product(id); if (!p) return '';
      return `<label class="ro-item">
        <input type="checkbox" class="ro-item__chk" data-id="${id}" data-qty="${qty}" checked>
        ${thumb(p)}
        <span class="ro-main">
          <span class="ro-brand">${p.brand}</span>
          <span class="ro-name">${p.name}</span>
          <span class="ro-qty">数量 ${qty}</span>
        </span>
        <span class="ro-price">${fmtYen(p.price * qty)}</span>
      </label>`;
    }).join('');
    updatePrevFoot();
  }
  function updatePrevFoot() {
    const checked = qsa('#prevOrderList .ro-item__chk:checked');
    const count = checked.reduce((a, c) => a + parseInt(c.dataset.qty, 10), 0);
    qs('#prevSel').textContent = count;
    qs('#prevBulk').disabled = count === 0;
  }

  function renderSets() {
    qs('#setList').innerHTML = SETS.map((set, i) => {
      const ps = set.items.map(([id]) => product(id)).filter(Boolean);
      const total = set.items.reduce((a, [id, q]) => a + (product(id) ? product(id).price * q : 0), 0);
      const cnt = set.items.reduce((a, [, q]) => a + q, 0);
      return `<div class="set-card">
        <div class="set-card__top">
          <span class="set-card__thumbs">${ps.slice(0, 3).map(thumb).join('')}</span>
          <span class="set-card__info">
            <span class="set-card__name">${set.name}</span>
            <span class="set-card__meta">${cnt}点・${fmtYen(total)}（税抜）</span>
          </span>
          <button class="btn btn--primary set-card__btn" data-set="${i}">カートに入れる</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderFreq() {
    const sorted = [...FREQ].sort((a, b) => b.n - a.n);
    qs('#freqScroll').innerHTML = sorted.map(({ id, n }) => {
      const p = product(id); if (!p) return '';
      return `<article class="rec-card" data-id="${id}">
        <span class="rec-badge rec-badge--repeat">月${n}回</span>
        <div class="rec-card__media">${placeholder(p.ph, p.brand)}</div>
        <div class="rec-card__brand">${p.brand}</div>
        <div class="rec-card__name">${p.name}</div>
        <div class="rec-card__price">${fmtYen(p.price)}<small>（税抜）</small></div>
        <button class="rec-card__add" data-add="${id}">${svg('cart')}カートに入れる</button>
      </article>`;
    }).join('');
  }

  function renderReplenish() {
    qs('#replenishList').innerHTML = REPLENISH.map(({ id, days }) => {
      const p = product(id); if (!p) return '';
      return `<div class="ro-item" data-id="${id}">
        ${thumb(p)}
        <span class="ro-main">
          <span class="ro-brand">${p.brand}</span>
          <span class="ro-name">${p.name}</span>
          <span class="ro-qty" style="color:var(--stock-order);font-weight:700">前回購入から${days}日・そろそろ補充</span>
        </span>
        <button class="btn btn--ghost" data-replenish="${id}" style="height:38px;flex:none;padding:0 16px">追加</button>
      </div>`;
    }).join('');
  }

  function bind() {
    // 前回と同じ内容で一括再注文
    qs('#repeatAll').addEventListener('click', () => {
      PREV.forEach(({ id, qty }) => Store.addToCart(id, qty));
      toast('前回と同じ内容をカートに入れました');
    });
    // 消耗予測からの補充
    qs('#replenishList').addEventListener('click', e => {
      const b = e.target.closest('[data-replenish]'); if (!b) return;
      Store.addToCart(b.dataset.replenish, 1);
      toast('補充分をカートに入れました');
    });

    qs('#prevOrderList').addEventListener('change', e => { if (e.target.classList.contains('ro-item__chk')) updatePrevFoot(); });
    qs('#prevBulk').addEventListener('click', () => {
      const checked = qsa('#prevOrderList .ro-item__chk:checked');
      checked.forEach(c => Store.addToCart(c.dataset.id, parseInt(c.dataset.qty, 10)));
      toast(`${checked.length}商品をカートに入れました`);
    });
    qs('#setList').addEventListener('click', e => {
      const btn = e.target.closest('[data-set]'); if (!btn) return;
      const set = SETS[+btn.dataset.set];
      set.items.forEach(([id, q]) => Store.addToCart(id, q));
      toast(`${set.name}をカートに入れました`);
    });
    qs('#freqScroll').addEventListener('click', e => {
      const btn = e.target.closest('[data-add]');
      if (btn) { Store.addToCart(btn.dataset.add, 1); toast('カートに追加しました'); return; }
      const card = e.target.closest('.rec-card[data-id]');
      if (card) location.href = 'product.html?id=' + card.dataset.id;
    });
  }

  qs('#repeatAllCount').textContent = PREV.reduce((a, p) => a + p.qty, 0);
  renderPrev();
  renderSets();
  renderReplenish();
  renderFreq();
  bind();
})();
