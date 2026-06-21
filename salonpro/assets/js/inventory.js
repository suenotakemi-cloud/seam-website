/* =========================================================
   SalonPro / Inventory — 在庫管理・棚卸し
   ========================================================= */
(function () {
  const { Store, Salon, placeholder, svg, fmtYen } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const toast = m => (window.SP_toast ? SP_toast(m) : null);
  const LOW = Salon.LOW;
  let filter = '';

  function statusOf(qty) {
    if (qty <= 0) return { cls: 'out', label: '在庫切れ' };
    if (qty <= LOW) return { cls: 'low', label: '残りわずか' };
    return { cls: 'in', label: '在庫あり' };
  }
  const thumb = p => `<span class="ro-thumb">${placeholder(p.ph, p.brand)}</span>`;

  function row(it, withStepper) {
    const s = statusOf(it.qty);
    const ctrl = withStepper
      ? `<div class="inv-row__ctrl">
           <div class="inv-stepper" data-id="${it.id}">
             <button data-act="dec" aria-label="減らす">${svg('minus')}</button>
             <input type="number" inputmode="numeric" value="${it.qty}" min="0" aria-label="在庫数">
             <button data-act="inc" aria-label="増やす">${svg('plus')}</button>
           </div>
           <button class="btn btn--ghost" data-order="${it.id}">発注</button>
         </div>`
      : `<div class="inv-row__ctrl">
           <span style="font-size:13px;color:var(--ink-2)">在庫 <b style="font-family:var(--font-num);color:var(--ink)">${it.qty}</b></span>
           <button class="btn btn--ghost" data-order="${it.id}" style="margin-left:auto">発注</button>
         </div>`;
    return `<div class="ro-item" data-id="${it.id}">
      ${thumb(it.p)}
      <span class="ro-main">
        <span class="ro-brand">${it.p.brand}</span>
        <span class="ro-name">${it.p.name}</span>
        <span class="stk-badge stk-badge--${s.cls}" style="margin-top:3px">${s.label}</span>
        ${ctrl}
      </span>
    </div>`;
  }

  function render() {
    const items = Salon.items();
    const low = Salon.lowItems();
    qs('#invTotal').textContent = items.length;
    qs('#invLow').textContent = low.filter(x => x.qty > 0).length;
    qs('#invOut').textContent = low.filter(x => x.qty <= 0).length;

    qs('#lowSection').style.display = low.length ? '' : 'none';
    qs('#lowList').innerHTML = low.map(it => row(it, false)).join('');
    qs('#lowCount').textContent = low.length;

    const all = filter
      ? items.filter(it => (it.p.name + it.p.brand + it.id).toLowerCase().includes(filter))
      : items;
    qs('#stockList').innerHTML = all.length ? all.map(it => row(it, true)).join('')
      : '<div class="empty-lite" style="padding:24px"><div class="empty-lite__t">該当する在庫がありません</div></div>';
  }

  function bind() {
    qs('#stockList').addEventListener('click', e => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'inc') Salon.addStock(id, 1);
      else if (act === 'dec') Salon.addStock(id, -1);
      else if (e.target.closest('[data-order]')) { Store.addToCart(e.target.closest('[data-order]').dataset.order, 1); toast('発注カートに追加しました'); }
    });
    qs('#stockList').addEventListener('change', e => {
      if (!e.target.matches('.inv-stepper input')) return;
      Salon.setStock(e.target.closest('[data-id]').dataset.id, parseInt(e.target.value, 10) || 0);
    });
    qs('#lowList').addEventListener('click', e => {
      const b = e.target.closest('[data-order]'); if (!b) return;
      Store.addToCart(b.dataset.order, 1); toast('発注カートに追加しました');
    });
    qs('#bulkOrder').addEventListener('click', () => {
      const low = Salon.lowItems();
      low.forEach(it => Store.addToCart(it.id, Math.max(1, 6 - it.qty)));
      toast(`${low.length}商品を発注カートに追加しました`);
    });
    qs('#invCode').addEventListener('input', e => { filter = e.target.value.trim().toLowerCase(); render(); });
  }

  Salon.subscribe(render);
  bind();
  render();
})();
