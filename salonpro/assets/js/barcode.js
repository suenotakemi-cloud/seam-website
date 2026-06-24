/* =========================================================
   SalonPro / Barcode — バーコード連続スキャン発注
   読み取るたびにカートへ追加。営業後にそのまま発注。
   カメラ（BarcodeDetector対応環境）＋型番/JAN手入力＋デモコード
   ========================================================= */
(function () {
  const { Store, placeholder, svg, fmtYen } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const product = id => SP.DATA.products.find(x => x.id === id);
  const toast = m => (window.SP_toast ? SP_toast(m) : null);

  const JAN = {
    '4901417727107': 'sh-001', '4988601011037': 'sh-002', '4954835011037': 'co-3',
    '4960299010101': 'tr-001', '4988603011029': 'rec-2',
  };
  let session = {};        // 今回スキャンした {id: qty}
  let scanning = false, stream = null, lastCode = '', lastTime = 0;

  function lookup(code) {
    const c = (code || '').trim(); if (!c) return null;
    if (JAN[c]) return product(JAN[c]);
    if (product(c.toLowerCase())) return product(c.toLowerCase());
    const q = c.toLowerCase();
    return SP.DATA.products.find(p => p.cat !== '_rec' && (p.name + p.brand).toLowerCase().includes(q)) || null;
  }

  function renderPanel() {
    const ids = Object.keys(session);
    const host = qs('#scanResult');
    if (!ids.length) { host.innerHTML = ''; return; }
    const count = ids.reduce((a, id) => a + session[id], 0);
    host.innerHTML = `
      <div style="display:flex;align-items:center;margin-top:22px;margin-bottom:8px">
        <span style="font-weight:800">今回スキャンした商品（${count}点）</span>
      </div>
      ${ids.map(id => {
        const p = product(id), q = session[id];
        return `<div class="scan-result" data-id="${id}" style="margin-top:8px">
          <div class="scan-result__media">${placeholder(p.ph, p.brand)}</div>
          <div class="scan-result__main">
            <div style="font-size:12px;color:var(--ink-3)">${p.brand}</div>
            <div style="font-weight:700;font-size:14px;line-height:1.3">${p.name}</div>
            <div style="font-family:var(--font-num);font-weight:800;margin-top:2px">${fmtYen(p.price)} <span style="font-size:11px;color:var(--ink-3);font-weight:600">×${q}（税抜）</span></div>
          </div>
          <button data-rm="${id}" aria-label="削除" style="width:34px;height:34px;border-radius:999px;color:var(--ink-3);display:flex;align-items:center;justify-content:center">${svg('close')}</button>
        </div>`;
      }).join('')}
      <a class="btn btn--primary btn--block" href="cart.html" style="margin-top:14px;gap:8px">発注へ進む（カートを見る）
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m9 6 6 6-6 6"/></svg>
      </a>`;
  }

  function handleCode(code) {
    const p = lookup(code);
    if (!p) { toast(`「${code}」は見つかりません`); return; }
    Store.addToCart(p.id, 1);
    session[p.id] = (session[p.id] || 0) + 1;
    renderPanel();
    toast(`${p.brand} をカートに追加`);
  }

  // 今回分を削除（カートからも戻す）
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const id = b.dataset.rm;
    Store.setQty(id, Math.max(0, Store.getQty(id) - (session[id] || 0)));
    delete session[id];
    renderPanel();
  });

  // デモコード
  qs('#demoCodes').innerHTML = Object.keys(JAN).map(c => {
    const p = product(JAN[c]);
    return `<button class="demo-code" data-code="${c}">${c}（${p ? p.brand : ''}）</button>`;
  }).join('');
  qs('#demoCodes').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) handleCode(b.dataset.code); });

  // 手入力
  const goManual = () => { const v = qs('#manualCode').value; if (v.trim()) { handleCode(v); qs('#manualCode').value = ''; } };
  qs('#manualGo').addEventListener('click', goManual);
  qs('#manualCode').addEventListener('keydown', e => { if (e.key === 'Enter') goManual(); });

  // カメラ連続スキャン
  function stopCam() {
    scanning = false;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    qs('#scanBox').hidden = true;
    qs('#startCam').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/></svg>カメラで読み取る`;
  }
  qs('#startCam').addEventListener('click', async () => {
    if (scanning) { stopCam(); return; }
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      toast('この環境はカメラ読取に未対応です。手入力・デモコードをご利用ください');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = qs('#scanVideo');
      video.srcObject = stream; await video.play();
      qs('#scanBox').hidden = false;
      scanning = true;
      qs('#startCam').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>読み取りを終了`;
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'] });
      const loop = async () => {
        if (!scanning || !stream || !stream.active) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            const c = codes[0].rawValue, now = Date.now();
            if (c !== lastCode || now - lastTime > 1500) { lastCode = c; lastTime = now; handleCode(c); }
          }
        } catch (e) {}
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) {
      toast('カメラを起動できませんでした。手入力をご利用ください');
      stopCam();
    }
  });
})();
