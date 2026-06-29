/* ───────────────────────────────────────────────────────────────
   SEAM analytics — cookieless / first-party / fire-and-forget
   window.seamTrack(name, props) → POST /api/ev（CF Pages Function → Analytics Engine）
   - Cookie を一切使わない・個人情報を送らない（診断の集計に必要な type/tier/advice 等のみ）
   - sendBeacon で投げっぱなし。失敗してもページに影響しない（try/catch）
   - CF Web Analytics（ページビュー）はダッシュボードで別途ON。本ファイルはファネルの自前イベント用
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── 流入属性（どこから来たか）を1回だけ算出して全イベントに自動付与 ──
  // referrer は「サイト名(チャネル)」に正規化＝個人は特定しない。UTM は自社で付けたタグ。
  // Cookie 不使用・PII なし（landing の保持のみ sessionStorage を使う＝端末内で完結）。
  function channelOf(ref) {
    if (!ref) return 'direct';
    var h;
    try { h = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return 'other'; }
    if (h.indexOf('seam.site') >= 0) return 'internal';
    if (/(^|\.)google\./.test(h)) return 'google';
    if (/instagram\.com|l\.instagram\.com|ig\./.test(h)) return 'instagram';
    if (/(^|\.)t\.co$|twitter\.com|(^|\.)x\.com$/.test(h)) return 'x';
    if (/line\.me|liff\./.test(h)) return 'line';
    if (/facebook\.com|(^|\.)fb\./.test(h)) return 'facebook';
    if (/yahoo\./.test(h)) return 'yahoo';
    if (/bing\./.test(h)) return 'bing';
    if (/tiktok\./.test(h)) return 'tiktok';
    if (/youtube\.com|youtu\.be/.test(h)) return 'youtube';
    return h.slice(0, 24); // 未知はホスト名そのまま
  }

  var _attr = null;
  function attribution() {
    if (_attr) return _attr;
    var q = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) {}
    var landing;
    try {
      landing = sessionStorage.getItem('seam_landing');
      if (!landing) { landing = location.pathname; sessionStorage.setItem('seam_landing', landing); }
    } catch (e) { landing = location.pathname; }
    var device = '?';
    try {
      var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
      device = (coarse || (window.screen && screen.width && screen.width < 768)) ? 'mobile' : 'desktop';
    } catch (e) {}
    _attr = {
      ref: channelOf(document.referrer),
      utm_source: (q.utm_source || '').slice(0, 32),
      utm_medium: (q.utm_medium || '').slice(0, 24),
      utm_campaign: (q.utm_campaign || '').slice(0, 48),
      device: device,
      lang: (navigator.language || '').slice(0, 5),
      landing: String(landing || '').slice(0, 64)
    };
    return _attr;
  }

  function track(name, props) {
    try {
      var payload = { e: String(name || '').slice(0, 40), p: location.pathname };
      var a = attribution();
      for (var ak in a) if (a[ak] != null && a[ak] !== '') payload[ak] = a[ak];
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
