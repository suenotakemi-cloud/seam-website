/* =========================================================
   SalonPro / Cart — マルチディーラー（中立マーケットプレイス）カート
   カートをディーラー（菊地・コスモ…）別に分割し、各社で
   別々の送料・締め時間・お支払い方法・与信・注文確定を行う。
   ※ ポイント/クーポンは本番でディーラーごとに適用（デモでは省略）。
   ========================================================= */
(function () {
  const { Store, placeholder, svg, fmtYen, STOCK } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const dealer = id => SP.dealer(id);
  const product = id => (SP.DATA.products || []).find(p => p.id === id);

  const TAX_RATE = 0.10;
  const PAY = {
    invoice: { t: '請求書払い（掛け）', s: '月末締め・翌月末払い／担当者の与信承認後に発送' },
    card:    { t: 'クレジットカード', s: 'VISA / Master / JCB / AMEX' },
    bank:    { t: '銀行振込（前払い）', s: '入金確認後の出荷' },
    cod:     { t: '代金引換', s: '配送時にお支払い（代引手数料別）' },
  };
  const PAY_LABEL = { invoice: '請求書払い（掛け）', card: 'クレジットカード', bank: '銀行振込', cod: '代金引換' };

  const arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const shieldSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>';
  const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m7.5 12 3 3 6-6.5"/></svg>';

  const dealerPay = {}; // { dealerId: payKey } 選択中の支払い方法
  const placed = [];    // [{ dealer, orderNo, payKey, total, kake }] 確定済みディーラー

  let toastTimer;
  function toast(msg) {
    const t = qs('#toast'); if (!t) return;
    t.innerHTML = svg('checkc') + msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 1900);
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---- 明細行 ---- */
  function lineItem(p, qty) {
    const s = STOCK[p.stock] || STOCK.in;
    const stockTag = p.stock === 'in' ? '' : `<span class="stock ${s.cls}" style="margin-top:2px">${svg(s.icon)}${s.text}</span>`;
    const unit = SP.unitPrice(p.price, qty), off = SP.tierOff(qty);
    const unitHtml = off > 0
      ? `単価 <span class="yen">${fmtYen(unit)}</span> <s style="color:var(--ink-3)">${fmtYen(p.price)}</s> <span class="qty-off">${Math.round(off * 100)}%OFF</span>`
      : `単価 <span class="yen">${fmtYen(unit)}</span>（税抜）`;
    return `
      <div class="cart-item" data-id="${p.id}">
        <div class="cart-item__media">${placeholder(p.ph, p.brand)}</div>
        <div class="cart-item__main">
          <span class="cart-item__brand">${p.brand}</span>
          <span class="cart-item__name">${p.name}</span>
          ${stockTag}
          <span class="cart-item__unit">${unitHtml}</span>
          <div class="cart-item__ctrl">
            <div class="stepper" data-id="${p.id}">
              <button data-act="dec" aria-label="数量を減らす">${svg('minus')}</button>
              <input type="number" inputmode="numeric" value="${qty}" min="1" max="99" aria-label="数量">
              <button data-act="inc" aria-label="数量を増やす">${svg('plus')}</button>
            </div>
            <button class="cart-item__remove" data-act="remove">${svg('close')}削除</button>
            <span class="cart-item__line">${fmtYen(unit * qty)}</span>
          </div>
        </div>
      </div>`;
  }
  function giftLine(p, q) {
    return `
      <div class="cart-item" data-gid="${p.id}" style="background:var(--gold-soft)">
        <div class="cart-item__media">${placeholder(p.ph, p.brand)}</div>
        <div class="cart-item__main">
          <span class="cart-item__brand">${p.brand}</span>
          <span class="cart-item__name">${p.name}</span>
          <span class="cart-item__unit" style="color:var(--gold-strong);font-weight:800">キャンペーン特典 ${q}本 <span style="background:#fff;border:1px solid var(--gold-line);border-radius:999px;padding:1px 8px;font-size:11px">無料</span></span>
          <div class="cart-item__ctrl">
            <button class="cart-item__remove" data-act="rmgift">${svg('close')}削除</button>
            <span class="cart-item__line">¥0</span>
          </div>
        </div>
      </div>`;
  }

  /* ---- 金額計算（ディーラー単位） ---- */
  function calcDealer(entries, dl) {
    const raw = entries.reduce((a, [p, q]) => a + p.price * q, 0);
    const subtotal = entries.reduce((a, [p, q]) => a + SP.unitPrice(p.price, q) * q, 0);
    const qtyDiscount = raw - subtotal;
    const ship = dl.ship || {};
    const shipping = subtotal === 0 ? 0 : (subtotal >= (ship.freeOver || 3000) ? 0 : (ship.fee || 550));
    const tax = Math.round(subtotal * TAX_RATE);
    return { subtotal, qtyDiscount, shipping, tax, total: subtotal + shipping + tax };
  }

  function payList(dl) {
    let pays = dl.pays || ['invoice'];
    // テナントの決済設定は自社（運営ディーラー）の支払い方法を制御
    const t = SP.TENANT;
    if (dl.id === SP.primaryDealer && t && t.payments) pays = pays.filter(k => t.payments[k] !== false);
    return pays.length ? pays : ['invoice'];
  }
  function payOptions(dl) {
    const avail = payList(dl);
    const sel = (avail.indexOf(dealerPay[dl.id]) >= 0 ? dealerPay[dl.id] : avail[0]) || 'invoice';
    return avail.map(k => {
      const pinfo = PAY[k] || PAY.invoice;
      const extra = (k === 'invoice') ? `・与信枠 残り <b>${fmtYen(dl.credit || 0)}</b>` : '';
      return `<label class="dpay"><input type="radio" name="pay-${dl.id}" value="${k}" ${k === sel ? 'checked' : ''}>
        <span><span class="dpay__t">${pinfo.t}</span><span class="dpay__s">${pinfo.s}${extra}</span></span></label>`;
    }).join('');
  }

  // 添付バンドル（ロックグループ：本数変更不可・組み直しのみ）
  function bundleBlock(b) {
    const paidRows = Object.keys(b.paid || {}).map(pid => {
      const p = product(pid); if (!p) return '';
      return `<div class="bd-line"><span class="bd-line__n">${p.brand} ${p.name}</span><span class="bd-line__q">×${b.paid[pid]}</span><span class="bd-line__p">${fmtYen(p.price * b.paid[pid])}</span></div>`;
    }).join('');
    const freeRows = (b.free || []).map(pid => {
      const p = product(pid); if (!p) return '';
      return `<div class="bd-line bd-line--free"><span class="bd-line__n">${p.brand} ${p.name}</span><span class="bd-line__q">×1</span><span class="bd-line__p">無料添付</span></div>`;
    }).join('');
    return `<div class="bd"><div class="bd__head"><span class="bd__badge">${b.badge || '10＋1'}</span><span class="bd__t">メーカー添付（${b.line}）</span><button class="bd__edit" data-rmbundle="${b.id}">組み直す</button></div>
      <div class="bd__body">${paidRows}${freeRows}</div>
      <div class="bd__note">本数の変更はできません（条件商品）。変更は「組み直す」で選び直してください。無料分（無償現品）はご負担ありません。</div></div>`;
  }

  function dealerSection(dl, entries, gifts, bundles) {
    const c = calcDealer(entries, dl); // entries=全明細（バンドル含む）→合計は正確
    const _av = payList(dl);
    const sel = (_av.indexOf(dealerPay[dl.id]) >= 0 ? dealerPay[dl.id] : _av[0]) || 'invoice';
    const bset = Store.bundlePids ? Store.bundlePids() : {};
    const items = (bundles || []).map(bundleBlock).join('')
      + entries.filter(([p]) => !bset[p.id]).map(([p, q]) => lineItem(p, q)).join('')
      + gifts.map(([p, q]) => giftLine(p, q)).join('');
    const ship = dl.ship || {};
    const shipMsg = c.subtotal >= (ship.freeOver || 3000)
      ? `${shieldSvg}送料無料が適用されています ・ ${ship.cutoff || ''} で${ship.eta || ''}`
      : `あと <b>${fmtYen((ship.freeOver || 3000) - c.subtotal)}</b> で送料無料 ・ ${ship.cutoff || ''} で${ship.eta || ''}`;
    const kake = sel === 'invoice'
      ? `<div class="dcart__kake">${shieldSvg}<div><b style="color:var(--ink)">掛け払いは ${dl.name} の担当者が与信を確認後に発送します。</b>（担当：${dl.rep || '—'}）</div></div>`
      : '';
    const qtyRow = c.qtyDiscount > 0 ? `<div class="dsum__row"><span>まとめ買い割引</span><span class="v">-${fmtYen(c.qtyDiscount)}</span></div>` : '';
    return `
      <section class="dcart" data-dealer="${dl.id}">
        <div class="dcart__head">
          <span class="dcart__badge" style="background:${dl.accent || '#b9923f'}">${dl.name}</span>
          <div><div class="dcart__name">${dl.full || dl.name}</div><div class="dcart__area">${dl.area || ''} ・ ${ship.eta || ''}</div></div>
        </div>
        <div class="dcart__body">
          ${items}
          <div class="dcart__ship">${shipMsg}</div>
          <div class="dcart__paytitle">お支払い方法（${dl.name}）</div>
          <div class="dcart__pay">${payOptions(dl)}</div>
          ${kake}
          <div class="dsum">
            <div class="dsum__row"><span>小計（税抜）</span><span class="v">${fmtYen(c.subtotal)}</span></div>
            ${qtyRow}
            <div class="dsum__row"><span>送料</span><span class="v">${c.shipping === 0 ? '無料' : fmtYen(c.shipping)}</span></div>
            <div class="dsum__row"><span>消費税（10%）</span><span class="v">${fmtYen(c.tax)}</span></div>
            <div class="dsum__total"><span>合計（税込）</span><span class="v">${fmtYen(c.total)}</span></div>
          </div>
          <button class="dcart__cta" data-place="${dl.id}">${Store.needsApproval ? (Store.needsApproval() ? 'オーナーに発注を申請' : dl.name + ' で注文を確定') : dl.name + ' で注文を確定'} ${arrowSvg}</button>
        </div>
      </section>`;
  }

  function doneSection(o) {
    const dl = dealer(o.dealer);
    if (o.approval) {
      // スタッフの発注申請（承認待ち）
      return `
      <section class="dcart dcart--done" data-dealer="${o.dealer}">
        <div class="dcart__head"><span class="dcart__badge" style="background:${dl.accent}">${dl.name}</span>
          <div><div class="dcart__name">${dl.full || dl.name}</div><div class="dcart__area">発注を申請しました</div></div></div>
        <div class="dcart__body">
          <div class="dcart__doneic" style="background:#fff5e0;color:#8a6a1f">${checkSvg}</div>
          <div style="font-size:15px;font-weight:900">オーナーに発注を申請しました</div>
          <p style="font-size:12px;color:var(--ink-2);margin-top:6px;line-height:1.6">オーナー／店長が承認すると発注が確定します。状況は「店舗・スタッフ管理」で確認できます。</p>
          <div class="complete__info" style="text-align:left;margin-top:12px">
            <div class="row"><span class="l">申請番号</span><span class="v">${o.orderNo}</span></div>
            <div class="row"><span class="l">合計（税込）</span><span class="v">${fmtYen(o.total)}</span></div>
          </div>
          <a class="btn btn--ghost btn--block" href="staff.html" style="margin-top:12px">承認状況を見る</a>
        </div>
      </section>`;
    }
    const kakeNote = o.kake
      ? `<p style="font-size:11.5px;color:#7a5a1e;background:#fdf4e7;border:1px solid #f0dcbf;border-radius:var(--r-md);padding:10px 12px;margin:12px 0 0;line-height:1.6;text-align:left">担当者の与信承認後に発送します（未集金防止）。承認次第、発送通知をお送りします。</p>`
      : '';
    return `
      <section class="dcart dcart--done" data-dealer="${o.dealer}">
        <div class="dcart__head"><span class="dcart__badge" style="background:${dl.accent}">${dl.name}</span>
          <div><div class="dcart__name">${dl.full || dl.name}</div><div class="dcart__area">ご注文を受け付けました</div></div></div>
        <div class="dcart__body">
          <div class="dcart__doneic">${checkSvg}</div>
          <div style="font-size:15px;font-weight:900">${dl.name} のご注文を受け付けました</div>
          <div class="complete__info" style="text-align:left;margin-top:12px">
            <div class="row"><span class="l">注文番号</span><span class="v">${o.orderNo}</span></div>
            <div class="row"><span class="l">お支払い</span><span class="v">${PAY_LABEL[o.payKey]}</span></div>
            <div class="row"><span class="l">合計（税込）</span><span class="v">${fmtYen(o.total)}</span></div>
          </div>
          ${kakeNote}
        </div>
      </section>`;
  }

  function syncBadges(count) {
    [['#cartBadge', count], ['#tabCartBadge', count]].forEach(([sel, n]) => {
      const el = qs(sel); if (el) { el.textContent = n; el.hidden = n <= 0; }
    });
  }

  /* ---- 描画 ---- */
  function render() {
    const groups = Store.cartByDealer();
    const giftsObj = Store.getGifts();
    const bset = Store.bundlePids ? Store.bundlePids() : {};                 // バンドル内pid（個別ギフト表示から除外）
    const dealerBundles = Store.bundlesByDealer ? Store.bundlesByDealer() : {};
    const giftGroups = {};
    SP.DATA.products.forEach(p => { const q = giftsObj[p.id]; if (q > 0 && !bset[p.id]) { const d = Store.dealerOf(p); (giftGroups[d] = giftGroups[d] || []).push([p, q]); } });

    const activeIds = Object.keys(groups);
    let count = 0;
    activeIds.forEach(d => groups[d].forEach(it => count += it.qty));
    for (const id in giftsObj) count += giftsObj[id];
    syncBadges(count);

    // 共通の静的セクション（単一注文用）は非表示
    ['#payShared', '#couponShared', '#shipProgress', '#summary', '#orderBar'].forEach(s => { const el = qs(s); if (el) { el.hidden = true; el.style.display = 'none'; } });

    const cartView = qs('#cartView'), emptyView = qs('#emptyView');
    if (!activeIds.length && !placed.length) { cartView.hidden = true; emptyView.hidden = false; return; }
    cartView.hidden = false; emptyView.hidden = true;

    const cc = qs('#cartCount');
    if (cc) cc.innerHTML = activeIds.length ? `<b>${count}</b>点 ・ <b>${activeIds.length}</b>ディーラー` : 'すべて注文済み';

    // 取寄せ注意
    let hasOrder = false; activeIds.forEach(d => groups[d].forEach(it => { if (it.p.stock === 'order' || it.p.stock === 'wait') hasOrder = true; }));
    const alertEl = qs('#cartAlert'); if (alertEl) { alertEl.hidden = !hasOrder; if (hasOrder) qs('#cartAlertText').textContent = '取寄せ商品が含まれます。出荷まで数日かかる場合があります。'; }

    // 発注者バー（誰として発注するか）＋テンプレ保存
    const actor = Store.getActor ? Store.getActor() : { role: 'owner', name: '' };
    const RLBL = { owner: 'オーナー', mgr: '店長', staff: 'スタッフ' };
    const needsAppr = Store.needsApproval && Store.needsApproval();
    let html = '';
    if (activeIds.length) {
      html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid var(--line);border-radius:var(--r-md);padding:10px 13px;margin-bottom:12px">
        <span style="font-size:12.5px">発注者：<b>${actor.name}</b><span style="font-size:11px;color:var(--ink-3);font-weight:700;margin-left:4px">${RLBL[actor.role] || ''}</span></span>
        <a href="staff.html" style="font-size:12px;color:var(--gold-strong);font-weight:800;text-decoration:none">変更</a>
        <button data-save-tpl style="margin-left:auto;height:34px;padding:0 13px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:#fff;font-size:12px;font-weight:800;cursor:pointer">＋ テンプレ保存</button>
      </div>`;
      if (needsAppr) html += `<div style="display:flex;gap:8px;align-items:flex-start;background:#fff5e0;border:1px solid #f0dcbf;border-radius:var(--r-md);padding:10px 13px;margin-bottom:12px;font-size:12px;color:#7a5a1e;line-height:1.6">${shieldSvg}<span><b>スタッフの店舗発注は承認制です。</b>「オーナーに発注を申請」すると、オーナー/店長の承認後に発注が確定します。</span></div>`;
    }
    html += `<div class="dealer-note">${shieldSvg}<span>このカートは<b>ディーラーごと</b>に分かれています。お支払い・送料・配送はそれぞれ別です（${activeIds.length + placed.length}ディーラー）。</span></div>`;
    placed.forEach(o => { html += doneSection(o); });

    const order = [SP.primaryDealer].concat(activeIds.filter(d => d !== SP.primaryDealer));
    const seen = {};
    order.forEach(d => {
      if (!groups[d] || seen[d]) return; seen[d] = true;
      html += dealerSection(dealer(d), groups[d].map(it => [it.p, it.qty]), giftGroups[d] || [], dealerBundles[d] || []);
    });

    if (!activeIds.length && placed.length) {
      html += `<div style="display:grid;gap:12px;max-width:320px;margin:8px auto 0"><a class="btn btn--primary btn--block" href="index.html">買い物を続ける</a><a class="btn btn--ghost btn--block" href="home.html">ホームに戻る</a></div>`;
    }
    qs('#cartList').innerHTML = html;
  }

  /* ---- ディーラー単位の注文確定 ---- */
  function placeOrder(dealerId) {
    const g = Store.cartByDealer()[dealerId];
    if (!g || !g.length) return;
    const dl = dealer(dealerId);
    const c = calcDealer(g.map(it => [it.p, it.qty]), dl);
    const _av = payList(dl);
    const payKey = (_av.indexOf(dealerPay[dealerId]) >= 0 ? dealerPay[dealerId] : _av[0]) || 'invoice';
    const cnt = g.reduce((s, it) => s + it.qty, 0);
    const approval = Store.needsApproval && Store.needsApproval();
    const gObj = Store.getGifts();
    const clearDealer = () => {
      Object.keys(gObj).forEach(pid => { const p = product(pid); if (p && Store.dealerOf(p) === dealerId) Store.removeGift(pid); });
      if (Store.clearDealerBundles) Store.clearDealerBundles(dealerId);
      Store.clearDealerCart(dealerId); // emit → render
    };
    if (approval) {
      // スタッフの店舗発注：確定せず「発注申請」を作成 → オーナー/店長が承認
      const rec = Store.addOrderApproval({
        staff: Store.getActor().name, dealer: dealerId, dealerName: dl.name,
        items: g.map(it => ({ id: it.p.id, qty: it.qty })), total: c.total, count: cnt,
        note: dl.name + ' 店舗発注',
      });
      placed.push({ dealer: dealerId, orderNo: rec.id, payKey, total: c.total, kake: false, approval: true });
      clearDealer();
      toast('オーナーに発注を申請しました');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const now = new Date();
    const prefix = dealerId === 'cosmo' ? 'CO' : 'SP';
    const orderNo = `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(Math.floor(Math.random() * 9000) + 1000)}`;
    placed.push({ dealer: dealerId, orderNo, payKey, total: c.total, kake: payKey === 'invoice' });
    clearDealer();
    toast(`${dl.name} のご注文を受け付けました`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---- イベント ---- */
  function bind() {
    const list = qs('#cartList');
    list.addEventListener('click', e => {
      const place = e.target.closest('[data-place]');
      if (place) { placeOrder(place.dataset.place); return; }
      if (e.target.closest('[data-save-tpl]')) {
        const def = 'テンプレ ' + (new Date().getMonth() + 1) + '/' + new Date().getDate();
        let nm = def; try { const r = window.prompt('発注テンプレートの名前', def); if (r === null) return; nm = r.trim() || def; } catch (e2) {}
        const rec = Store.saveCartAsTemplate(nm);
        toast(rec ? ('「' + nm + '」を保存しました（再購入から呼び出せます）') : 'カートが空です');
        return;
      }
      const rmb = e.target.closest('[data-rmbundle]');
      if (rmb) { Store.removeBundle(rmb.dataset.rmbundle); toast('添付を取り消しました（選び直せます）'); return; }
      const act0 = e.target.closest('[data-act]')?.dataset.act;
      const giftRow = e.target.closest('[data-gid]');
      if (act0 === 'rmgift' && giftRow) { Store.removeGift(giftRow.dataset.gid); toast('特典を削除しました'); return; }
      const row = e.target.closest('[data-id]'); if (!row) return;
      const id = row.dataset.id, act = e.target.closest('[data-act]')?.dataset.act;
      const input = qs('.stepper input', row);
      if (act === 'remove') { Store.removeFromCart(id); toast('削除しました'); }
      else if (act === 'inc') { Store.setQty(id, Math.min(99, (parseInt(input.value, 10) || 1) + 1)); }
      else if (act === 'dec') { Store.setQty(id, Math.max(1, (parseInt(input.value, 10) || 1) - 1)); }
    });
    list.addEventListener('change', e => {
      if (e.target.matches('.stepper input')) {
        const id = e.target.closest('[data-id]').dataset.id;
        Store.setQty(id, Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 1)));
        return;
      }
      const pay = e.target.closest('input[type=radio][name^="pay-"]');
      if (pay) { dealerPay[pay.name.replace('pay-', '')] = pay.value; render(); }
    });

    const sf = qs('#searchForm');
    if (sf) sf.addEventListener('submit', e => { e.preventDefault(); const q = qs('#headerSearch').value.trim(); location.href = 'index.html' + (q ? '?q=' + encodeURIComponent(q) : ''); });
    qsa('[data-soon]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const dest = SP.LINKS && SP.LINKS[b.dataset.soon];
      if (dest) { location.href = dest; return; }
      toast(b.dataset.soon + 'は次のステップで実装します');
    }));
  }

  function init() {
    Store.subscribe(render);
    bind();
    render();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
