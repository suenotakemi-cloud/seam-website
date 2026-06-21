/* =========================================================
   SalonPro / Favorites — お気に入り（3階層：ブランド／カラー／商品）
   ========================================================= */
(function () {
  const { Store, productCard, svg } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const enc = encodeURIComponent;
  const toast = m => (window.SP_toast ? SP_toast(m) : null);
  const colorTint = (line, family) => {
    const p = SP.DATA.products.find(x => x.line === line && x.family === family);
    return (p && p.ph && p.ph.tint) || '#9aa0a6';
  };

  // デモ用：3階層すべて空なら初期サンプルを投入
  if (Store.favCount() === 0 && Store.getFavBrands().length === 0 && Store.getFavColors().length === 0) {
    ['sh-003', 'sh-005', 'sh-001'].forEach(id => { if (!Store.isFav(id)) Store.toggleFav(id); });
    Store.toggleFavBrand('アディクシー');
    Store.toggleFavColor('アディクシー', 'サファイア');
  }

  function render() {
    const prods = SP.DATA.products.filter(p => Store.isFav(p.id));
    const brands = Store.getFavBrands();
    const colors = Store.getFavColors();

    // ブランド
    qs('#favBrandsSec').hidden = !brands.length;
    qs('#favBrands').innerHTML = brands.map(b => {
      const isColorLine = SP.DATA.products.some(p => p.line === b);
      const href = isColorLine ? `index.html?cat=color&line=${enc(b)}` : `index.html?q=${enc(b)}`;
      return `<a class="fav-chip" href="${href}">${b}<button class="fav-chip__x" data-unbrand="${b}" aria-label="削除">✕</button></a>`;
    }).join('');

    // カラー
    qs('#favColorsSec').hidden = !colors.length;
    qs('#favColors').innerHTML = colors.map(c =>
      `<a class="fav-color" href="index.html?cat=color&line=${enc(c.line)}&family=${enc(c.family)}">` +
      `<button class="fav-color__x" data-uncolor="${c.line}｜${c.family}" aria-label="削除">✕</button>` +
      `<span class="fav-color__sw" style="background:${colorTint(c.line, c.family)}"></span>` +
      `<span class="fav-color__l">${c.line}</span><span class="fav-color__n">${c.family}</span></a>`).join('');

    // 商品
    qs('#favProdSec').hidden = !prods.length;
    qs('#favGrid').innerHTML = prods.map((p, i) => productCard(p, i)).join('');

    const total = brands.length + colors.length + prods.length;
    qs('#favEmpty').hidden = total > 0;
    qs('#favSub').textContent = total > 0 ? `ブランド ${brands.length}・カラー ${colors.length}・商品 ${prods.length}件` : '';
  }

  // ブランド／カラーの削除
  document.addEventListener('click', e => {
    const ub = e.target.closest('[data-unbrand]');
    if (ub) { e.preventDefault(); Store.toggleFavBrand(ub.dataset.unbrand); toast('お気に入りブランドから削除'); render(); return; }
    const uc = e.target.closest('[data-uncolor]');
    if (uc) { e.preventDefault(); const a = uc.dataset.uncolor.split('｜'); Store.toggleFavColor(a[0], a[1]); toast('お気に入りカラーから削除'); render(); return; }
  });

  // 商品グリッド
  qs('#favGrid').addEventListener('click', e => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const id = card.dataset.id;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fav') { Store.toggleFav(id); toast('お気に入りから削除しました'); render(); }
    else if (act === 'favbrand') { const bb = e.target.closest('[data-act]'); const on = Store.toggleFavBrand(bb.dataset.brand); toast(on ? 'お気に入りブランドに追加' : 'お気に入りブランドから削除'); render(); }
    else if (act === 'add') {
      const input = qs('.stepper input', card);
      Store.addToCart(id, Math.max(1, parseInt(input.value, 10) || 1));
      toast('カートに追加しました');
    } else if (act === 'inc' || act === 'dec') {
      const input = qs('.stepper input', card);
      let v = parseInt(input.value, 10) || 1;
      input.value = act === 'inc' ? Math.min(99, v + 1) : Math.max(1, v - 1);
    } else if (!e.target.closest('.card__foot')) {
      location.href = 'product.html?id=' + id;
    }
  });

  render();
})();
