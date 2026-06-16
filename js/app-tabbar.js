/* =========================================================================
   SEAM App-style bottom tab bar (mobile only)
   - 5タブ: ホーム / 診断 / ショップ / 店舗 / 予約
   - デスクトップ(≥1024px)では非表示（上部ヘッダーが担う）
   - 5言語ラベル（localStorage seamLang 連動）
   - finder.html では読み込まない（独自の没入フロー＋固定CTAのため）
   ========================================================================= */
(function () {
  if (window.__seamTabbarInit) return;
  window.__seamTabbarInit = true;

  // finder は除外（呼び出し側で読み込まない想定だが二重防御）
  if (/\/finder\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  var LABELS = {
    ja: { home: 'ホーム', finder: '診断', shop: 'ショップ', stores: '店舗', book: '予約' },
    en: { home: 'Home', finder: 'Diagnosis', shop: 'Shop', stores: 'Stores', book: 'Booking' },
    zh: { home: '首页', finder: '诊断', shop: '商店', stores: '门店', book: '预约' },
    tw: { home: '首頁', finder: '診斷', shop: '商店', stores: '門市', book: '預約' },
    ko: { home: '홈', finder: '진단', shop: '샵', stores: '매장', book: '예약' }
  };
  function lang() {
    try { return localStorage.getItem('seamLang') || 'ja'; } catch (e) { return 'ja'; }
  }

  // アイコン（線画 / currentColor）
  var IC = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5"/>',
    finder: '<path d="M12 3.5l1.8 4.4 4.7.3-3.6 3 1.2 4.6L12 13.4 7.9 15.8l1.2-4.6-3.6-3 4.7-.3z"/>',
    shop: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    stores: '<path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    book: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 9.5h16M8.5 3.5v4M15.5 3.5v4"/><path d="M9 14.5l2 2 4-4"/>'
  };

  // タブ定義（href / アイコン / 現在ページ判定の正規表現）
  var TABS = [
    { key: 'home',   href: 'index.html',     match: /(^\/$|\/index\.html|\/$)/ },
    { key: 'finder', href: 'finder.html',    match: /\/finder\.html/ },
    { key: 'shop',   href: 'brand.html',     match: /\/brand\.html/ },
    { key: 'stores', href: 'shop.html#stores', match: /\/shop\.html/ },
    { key: 'book',   href: 'hairsalon.html', match: /\/(hairsalon|headspa)\.html/ }
  ];

  var path = location.pathname;
  function isActive(t) { return t.match.test(path); }

  function build() {
    var L = LABELS[lang()] || LABELS.ja;
    var nav = document.getElementById('seam-tabbar');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'seam-tabbar';
      nav.setAttribute('aria-label', 'メインナビ');
      document.body.appendChild(nav);
    }
    nav.innerHTML = TABS.map(function (t) {
      var active = isActive(t);
      return '<a href="' + t.href + '"' + (active ? ' aria-current="page"' : '') + ' class="seam-tab' + (active ? ' is-active' : '') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[t.key] + '</svg>'
        + '<span>' + (L[t.key] || '') + '</span></a>';
    }).join('');
  }

  function injectStyle() {
    if (document.getElementById('seam-tabbar-style')) return;
    var s = document.createElement('style');
    s.id = 'seam-tabbar-style';
    s.textContent = [
      '#seam-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;',
      'background:rgba(250,248,244,0.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
      'border-top:1px solid #E2DDD3;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -4px 20px rgba(26,24,21,0.05);}',
      '#seam-tabbar .seam-tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;',
      'padding:9px 2px 8px;text-decoration:none;color:#8C7A63;transition:color .2s;-webkit-tap-highlight-color:transparent;}',
      '#seam-tabbar .seam-tab svg{width:22px;height:22px;opacity:.85;}',
      '#seam-tabbar .seam-tab span{font-size:10px;letter-spacing:.04em;font-family:"Noto Sans JP",sans-serif;line-height:1;}',
      '#seam-tabbar .seam-tab.is-active{color:#B8945A;}',
      '#seam-tabbar .seam-tab.is-active svg{opacity:1;}',
      'body{padding-bottom:calc(58px + env(safe-area-inset-bottom));}',
      '@media (min-width:1024px){#seam-tabbar{display:none;}body{padding-bottom:0;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function init() {
    injectStyle();
    build();
    window.addEventListener('seamlangchange', build);
    window.addEventListener('storage', function (e) { if (e.key === 'seamLang') build(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
