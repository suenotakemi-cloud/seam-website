/* ───────────────────────────────────────────────────────────────
   SEAM analytics — cookieless / first-party / fire-and-forget
   window.seamTrack(name, props) → POST /api/ev（CF Pages Function → Analytics Engine）
   - Cookie を一切使わない・個人情報を送らない（診断の集計に必要な type/tier/advice 等のみ）
   - sendBeacon で投げっぱなし。失敗してもページに影響しない（try/catch）
   - CF Web Analytics（ページビュー）はダッシュボードで別途ON。本ファイルはファネルの自前イベント用
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── Meta Pixel（広告最適化用）──────────────────────────────────
  // 自前の cookieless 計測はそのまま。Pixel は _fbp Cookie を使うため、
  // サイトの同意方針に従って運用する（将来 CAPI へ寄せる場合は /api/ev から中継可）。
  function cookieChoice() { try { return localStorage.getItem('seam_cookie'); } catch (e) { return null; } }

  (function initPixel() {
    try {
      if (window.fbq) return;
      if (cookieChoice() === 'decline') return; // 「拒否」選択時は発火させない（オプトアウト）
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '852519546926672');
      fbq('track', 'PageView');
    } catch (e) { /* 計測でUIを壊さない */ }
  })();

  // 自前イベント名（または sec_click の label）→ Meta標準/カスタムイベント
  var FB_MAP = {
    finder_start:     ['trackCustom', 'FinderStart'],
    finder_complete:  ['track', 'Lead'],              // 診断完了＝主要CV
    finder_cta:       ['trackCustom', 'FinderCTA'],
    sale_shop_join:   ['track', 'CompleteRegistration'],
    sale_shop_online: ['trackCustom', 'ShopOnlineClick'],
    sale_banner:      ['trackCustom', 'SaleBannerClick'],
    sale_banner_shop: ['trackCustom', 'SaleBannerClick']
  };
  function fbqFire(name, props) {
    try {
      if (!window.fbq || cookieChoice() === 'decline') return;
      var key = name;
      if (name === 'sec_click' && props && props.label && FB_MAP[props.label]) key = props.label;
      var m = FB_MAP[key];
      if (m) fbq(m[0], m[1]);
    } catch (e) { /* 計測でUIを壊さない */ }
  }

  // ── Cookie 同意バナー（多言語・オプトアウト方式）──────────────────
  // 初回訪問で1回だけ表示。「拒否」でPixelを停止（seam_cookie=decline）。
  // 日本の外部送信規律に沿った開示＋停止手段。詳細は /privacy.html。
  (function consentBanner() {
    function show() {
      try {
        if (cookieChoice()) return;                       // 選択済みなら出さない
        if (document.getElementById('seam-cc')) return;
        var lang = 'ja';
        try {
          lang = localStorage.getItem('seamLang');
          if (!lang) {
            var hl = (document.documentElement.lang || 'ja').toLowerCase();
            lang = hl.indexOf('zh-hant') === 0 ? 'tw' : hl.indexOf('zh-hans') === 0 ? 'zh' : hl.slice(0, 2);
          }
        } catch (e) { lang = 'ja'; }
        var T = {
          ja: { m: '当サイトは、広告の効果測定のために Meta ピクセル等の Cookie を利用します。', a: '同意する', d: '拒否する', l: '詳細' },
          en: { m: 'This site uses cookies such as the Meta Pixel to measure ad performance.', a: 'Accept', d: 'Decline', l: 'Details' },
          zh: { m: '本网站使用 Meta 像素等 Cookie 用于广告成效衡量。', a: '同意', d: '拒绝', l: '详情' },
          tw: { m: '本網站使用 Meta 像素等 Cookie 進行廣告成效評估。', a: '同意', d: '拒絕', l: '詳情' },
          ko: { m: '본 사이트는 광고 성과 측정을 위해 Meta 픽셀 등의 쿠키를 사용합니다.', a: '동의', d: '거부', l: '자세히' }
        };
        var t = T[lang] || T.ja;
        var bar = document.createElement('div');
        bar.id = 'seam-cc';
        bar.setAttribute('role', 'dialog');
        bar.setAttribute('aria-label', 'Cookie');
        bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#282624;color:#faf9f7;padding:14px 16px calc(14px + env(safe-area-inset-bottom));font-family:inherit;font-size:13px;line-height:1.6;box-shadow:0 -4px 20px rgba(0,0,0,.25)';
        var wrap = document.createElement('div');
        wrap.style.cssText = 'max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;justify-content:center';
        var msg = document.createElement('span');
        msg.style.cssText = 'flex:1 1 260px;min-width:200px';
        msg.textContent = t.m + ' ';
        var link = document.createElement('a');
        link.href = '/privacy.html'; link.textContent = t.l;
        link.style.cssText = 'color:#e8d9bf;text-decoration:underline;white-space:nowrap';
        msg.appendChild(link);
        var btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:8px;flex:0 0 auto';
        function mkBtn(label, primary) {
          var b = document.createElement('button');
          b.type = 'button'; b.textContent = label;
          b.style.cssText = 'cursor:pointer;border:0;border-radius:999px;padding:9px 20px;font-size:13px;font-weight:600;font-family:inherit;' + (primary ? 'background:#b58a56;color:#fff' : 'background:transparent;color:#faf9f7;border:1px solid rgba(250,249,247,.5)');
          return b;
        }
        var accept = mkBtn(t.a, true), decline = mkBtn(t.d, false);
        function choose(v) {
          try { localStorage.setItem('seam_cookie', v); } catch (e) {}
          try { bar.parentNode.removeChild(bar); } catch (e) {}
        }
        accept.addEventListener('click', function () { choose('accept'); });
        decline.addEventListener('click', function () { choose('decline'); });
        btns.appendChild(decline); btns.appendChild(accept);
        wrap.appendChild(msg); wrap.appendChild(btns);
        bar.appendChild(wrap);
        (document.body || document.documentElement).appendChild(bar);
      } catch (e) { /* 計測でUIを壊さない */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  })();

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
      fbqFire(payload.e, props); // Meta Pixel へミラー（PageViewはinitで発火済みなので除外）
    } catch (e) { /* 計測でUIを壊さない */ }
  }
  window.seamTrack = track;

  // ── v3: ページ行動計測（PIIなし・全ページ共通） ──────────────
  // page_view   = ページ到達（1回）
  // page_engage = 離脱/非表示時に1回だけ「実閲覧秒(sec)・最大スクロール深度%(sd)」をmetaで送る
  // sec_view    = data-track-view="ラベル" の要素が40%見えたら1回（露出）
  // sec_click   = data-track-click="ラベル" のタップ（露出→反応率が取れる）
  track('page_view');

  var _engSent = false, _activeSec = 0, _lastTick = Date.now(), _maxDepth = 0;
  var _wasVisible = document.visibilityState !== 'hidden';
  function _accumulate() {
    var now = Date.now();
    if (_wasVisible) _activeSec += (now - _lastTick) / 1000;
    _lastTick = now;
    _wasVisible = document.visibilityState !== 'hidden';
  }
  var _depthT = 0;
  function _tickDepth() {
    if (_depthT) return;
    _depthT = setTimeout(function () {
      _depthT = 0;
      try {
        var h = document.documentElement;
        var d = Math.min(100, Math.round((window.pageYOffset + window.innerHeight) / Math.max(1, h.scrollHeight) * 100));
        if (d > _maxDepth) _maxDepth = d;
      } catch (e) {}
    }, 400);
  }
  function _flushEngage() {
    if (_engSent) return;
    _engSent = true;
    _accumulate();
    track('page_engage', { meta: { sec: Math.min(1800, Math.round(_activeSec)), sd: _maxDepth } });
  }
  window.addEventListener('scroll', _tickDepth, { passive: true });
  document.addEventListener('visibilitychange', function () {
    _accumulate();
    if (document.visibilityState === 'hidden') _flushEngage();
  });
  window.addEventListener('pagehide', _flushEngage);

  function _wireSections() {
    try {
      _tickDepth();
      var els = document.querySelectorAll('[data-track-view]');
      if (els.length && 'IntersectionObserver' in window) {
        var seen = {};
        var io = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            if (!en.isIntersecting) return;
            var l = en.target.getAttribute('data-track-view');
            io.unobserve(en.target);
            if (!l || seen[l]) return;
            seen[l] = 1;
            track('sec_view', { label: l });
          });
        }, { threshold: 0.4 });
        els.forEach(function (el) { io.observe(el); });
      }
      document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest && e.target.closest('[data-track-click]');
        if (t) track('sec_click', { label: t.getAttribute('data-track-click') });
      }, true);
    } catch (e) { /* 計測でUIを壊さない */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _wireSections);
  else _wireSections();
})();
