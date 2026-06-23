/* ───────────────────────────────────────────────────────────────
   SEAM analytics — cookieless / first-party / fire-and-forget
   window.seamTrack(name, props) → POST /api/ev（CF Pages Function → Analytics Engine）
   - Cookie を一切使わない・個人情報を送らない（診断の集計に必要な type/tier/advice 等のみ）
   - sendBeacon で投げっぱなし。失敗してもページに影響しない（try/catch）
   - CF Web Analytics（ページビュー）はダッシュボードで別途ON。本ファイルはファネルの自前イベント用
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  function track(name, props) {
    try {
      var payload = { e: String(name || '').slice(0, 40), p: location.pathname };
      if (props && typeof props === 'object') {
        for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k) && props[k] != null) payload[k] = props[k];
      }
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/ev', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/ev', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(function () {});
      }
      if (window.dataLayer && window.dataLayer.push) window.dataLayer.push(payload); // GTM等を後で足す場合の保険
    } catch (e) { /* 計測でUIを壊さない */ }
  }
  window.seamTrack = track;
})();
