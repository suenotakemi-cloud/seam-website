/* =========================================================
   SalonPro / POS — 店販レジ
   会計 → Salon.recordSale で売上記録＆在庫自動減
   ========================================================= */
(function () {
  const { Salon, placeholder, svg, fmtYen } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const product = id => SP.DATA.products.find(x => x.id === id);
  const toast = m => (window.SP_toast ? SP_toast(m) : null);

  // 店販上代（税込）＝卸価格 × 1.6 を10円丸め
  const retail = p => Math.round(p.price * 1.6 / 10) * 10;
  const PICK = ['sh-001', 'sh-003', 'sh-005', 'tr-001', 'tr-002', 'rec-1', 'rec-2', 'rec-3', 'rec-4', 'sh-024', 'sh-010', 'sh-017'];
  const JAN = { '4901417727107': 'sh-001', '4988601011037': 'sh-002', '4954835011037': 'co-001', '4960299010101': 'tr-001', '4988603011029': 'rec-2' };

  let cart = {}; // {id: qty}
  let payMethod = 'cash';

  const total = () => Object.keys(cart).reduce((a, id) => a + retail(product(id)) * cart[id], 0);

  function renderSummary() {
    const t = Salon.todaySales();
    qs('#todaySales').textContent = fmtYen(t.total);
    qs('#todayCount').textContent = t.count;
    qs('#todayUnits').textContent = t.units;
  }

  function renderGrid() {
    qs('#posGrid').innerHTML = PICK.map(id => {
      const p = product(id); if (!p) return '';
      const stk = Salon.stock(id);
      return `<button class="pos-tile" data-add="${id}">
        <span class="pos-tile__media">${placeholder(p.ph, p.brand)}</span>
        <span class="pos-tile__name">${p.name}</span>
        <span class="pos-tile__price">${fmtYen(retail(p))}</span>
        <span class="pos-tile__stk" style="${stk <= 0 ? 'color:var(--stock-low)' : ''}">在庫 ${stk}</span>
      </button>`;
    }).join('');
  }

  function renderReg() {
    const ids = Object.keys(cart);
    const host = qs('#regList');
    if (!ids.length) { host.innerHTML = '<div class="reg-empty">商品をタップ／スキャンして会計に追加してください</div>'; }
    else {
      host.innerHTML = ids.map(id => {
        const p = product(id), q = cart[id];
        return `<div class="reg-item" data-id="${id}">
          <span class="reg-thumb">${placeholder(p.ph, p.brand)}</span>
          <span class="reg-main"><span class="reg-name">${p.name}</span><span class="reg-price">${fmtYen(retail(p))} × ${q}</span></span>
          <span class="reg-stepper"><button data-act="dec">${svg('minus')}</button><span>${q}</span><button data-act="inc">${svg('plus')}</button></span>
          <span class="reg-line">${fmtYen(retail(p) * q)}</span>
        </div>`;
      }).join('');
    }
    qs('#regTotal').textContent = fmtYen(total());
    qs('#checkoutBtn').disabled = !ids.length;
  }

  function add(id, n = 1) { if (!product(id)) return false; cart[id] = (cart[id] || 0) + n; renderReg(); return true; }

  function openPay() {
    qs('#payTotal').textContent = fmtYen(total());
    qs('#cashGiven').value = '';
    qs('#cashChange').textContent = '¥0';
    setMethod('cash');
    qs('#overlay').classList.add('is-open');
    qs('#paySheet').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closePay() {
    qs('#overlay').classList.remove('is-open');
    qs('#paySheet').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function setMethod(m) {
    payMethod = m;
    document.querySelectorAll('.pay-method').forEach(b => b.setAttribute('aria-pressed', b.dataset.pay === m));
    qs('#cashArea').style.display = m === 'cash' ? '' : 'none';
  }
  function updateChange() {
    const given = parseInt(qs('#cashGiven').value, 10) || 0;
    const c = given - total();
    qs('#cashChange').textContent = c >= 0 ? fmtYen(c) : '不足';
    qs('#cashChange').style.color = c >= 0 ? '' : 'var(--stock-low)';
  }

  function checkout() {
    const t = total();
    if (payMethod === 'cash') {
      const given = parseInt(qs('#cashGiven').value, 10) || 0;
      if (given < t) { toast('お預かりが不足しています'); return; }
    }
    const lines = Object.keys(cart).map(id => ({ id, qty: cart[id], price: retail(product(id)) }));
    const change = payMethod === 'cash' ? (parseInt(qs('#cashGiven').value, 10) || 0) - t : 0;
    Salon.recordSale(lines, t);     // 売上記録＋在庫自動減
    cart = {};
    closePay();
    qs('#doneAmt').textContent = fmtYen(t);
    qs('#doneChange').textContent = payMethod === 'cash' ? `おつり ${fmtYen(change)}` : 'クレジット決済';
    qs('#posDone').classList.add('is-open');
    renderReg();
  }

  function bind() {
    qs('#posGrid').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) { add(b.dataset.add); toast('追加しました'); } });
    qs('#regList').addEventListener('click', e => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'inc') cart[id]++;
      else if (act === 'dec') { cart[id]--; if (cart[id] <= 0) delete cart[id]; }
      else return;
      renderReg();
    });
    const lookup = c => { c = (c || '').trim(); if (!c) return null; if (JAN[c]) return JAN[c]; if (product(c.toLowerCase())) return c.toLowerCase(); const q = c.toLowerCase(); const p = SP.DATA.products.find(x => x.cat !== '_rec' && (x.name + x.brand).toLowerCase().includes(q)); return p ? p.id : null; };
    const goCode = () => { const id = lookup(qs('#posCode').value); if (id) { add(id); qs('#posCode').value = ''; toast('追加しました'); } else toast('商品が見つかりません'); };
    qs('#posCodeGo').addEventListener('click', goCode);
    qs('#posCode').addEventListener('keydown', e => { if (e.key === 'Enter') goCode(); });

    qs('#checkoutBtn').addEventListener('click', openPay);
    qs('#payCancel').addEventListener('click', closePay);
    qs('#overlay').addEventListener('click', closePay);
    document.querySelectorAll('.pay-method').forEach(b => b.addEventListener('click', () => setMethod(b.dataset.pay)));
    qs('#cashGiven').addEventListener('input', updateChange);
    qs('#quickCash').innerHTML = ['ぴったり', '1000', '5000', '10000'].map(v => `<button data-cash="${v}">${v === 'ぴったり' ? v : '¥' + Number(v).toLocaleString()}</button>`).join('');
    qs('#quickCash').addEventListener('click', e => { const b = e.target.closest('[data-cash]'); if (!b) return; qs('#cashGiven').value = b.dataset.cash === 'ぴったり' ? total() : b.dataset.cash; updateChange(); });
    qs('#payDo').addEventListener('click', checkout);
    qs('#newSale').addEventListener('click', () => { qs('#posDone').classList.remove('is-open'); });
  }

  Salon.subscribe(() => { renderSummary(); renderGrid(); });
  renderSummary(); renderGrid(); renderReg(); bind();
})();
